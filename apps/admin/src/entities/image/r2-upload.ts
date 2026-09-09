import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import type { ObjectStore, StoredObject } from '@/src/shared/lib/r2-store';

import { ImageUploadError, isImageManifest, withPreparedImage, toResult, verifyPublicImages } from './image-upload';
import type { ImageManifest, ImageUploadResult, PreparedImage, PublicImageVerifier } from './image-upload';

const MiB = 1024 * 1024;
const RESERVATION_BYTES = 160 * MiB;
const STORAGE_LIMIT = 8_000_000_000;
const DAILY_LIMIT = 20;
const TICKET_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LEDGER_KEY = 'blog/control/upload-budget.json';
// private staging의 lifecycle 만료 주기. R2 콘솔의 `expire-blog-staging` 규칙과 같아야 한다.
const STAGING_LIFECYCLE_MS = 24 * 60 * 60_000;
// 예약 회수는 staging 바이트가 확실히 사라진 뒤여야 한다. lifecycle 삭제와 사용량 집계 지연을
// 감안해 만료 주기의 세 배를 유예로 둔다. 이 값이 lifecycle보다 짧아지면 아직 남아 있는
// 바이트를 회수해 예산을 초과 admission하게 된다.
const RECLAIM_DELAY_MS = 3 * STAGING_LIFECYCLE_MS;
type Allocation = { bytes: number; reclaimAt?: number };
type Ledger = {
  version: 2;
  day: string;
  attempts: number;
  lastIssuedAt: number;
  allocations: Record<string, Allocation>;
};
type Ticket = {
  version: 1;
  bytes: number;
  expiresAt: number;
  state: 'ready' | 'processing' | 'done';
  assetId?: string;
};

export class R2UploadError extends Error {
  constructor(
    public readonly code: 'daily_limit' | 'storage_limit' | 'invalid_ticket' | 'upload_busy' | 'invalid_upload'
  ) {
    super(code);
  }
}

export function createR2Uploader(
  store: ObjectStore,
  options: { now?: () => number; verifyPublic?: PublicImageVerifier } = {}
) {
  const now = options.now ?? Date.now;

  async function updateLedger(change: (ledger: Ledger) => void) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const object = await store.get('private', LEDGER_KEY, MiB);
      const ledger = object ? parseLedger(object) : emptyLedger();
      reclaimExpired(ledger, now());
      change(ledger);
      if (await putJson(LEDGER_KEY, ledger, object?.etag ?? '*')) return;
    }
    throw new R2UploadError('upload_busy');
  }

  async function putJson(key: string, value: unknown, match = '*') {
    return store.put('private', key, Buffer.from(JSON.stringify(value)), { contentType: 'application/json', match });
  }

  async function issue(bytes: number) {
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > 32 * MiB) throw new R2UploadError('invalid_upload');
    const ticketId = randomUUID();
    const timestamp = now();
    const day = new Date(timestamp).toISOString().slice(0, 10);
    await updateLedger(ledger => {
      if (ledger.day !== day) {
        ledger.day = day;
        ledger.attempts = 0;
      }
      if (ledger.attempts >= DAILY_LIMIT) throw new R2UploadError('daily_limit');
      if (timestamp - ledger.lastIssuedAt < 5_000) throw new R2UploadError('upload_busy');
      const reserved = Object.values(ledger.allocations).reduce((sum, value) => sum + value.bytes, MiB);
      if (reserved + RESERVATION_BYTES > STORAGE_LIMIT || Object.keys(ledger.allocations).length >= 5_000) {
        throw new R2UploadError('storage_limit');
      }
      ledger.attempts++;
      ledger.lastIssuedAt = timestamp;
      ledger.allocations[ticketId] = { bytes: RESERVATION_BYTES, reclaimAt: timestamp + RECLAIM_DELAY_MS };
    });
    const ticket: Ticket = { version: 1, bytes, expiresAt: timestamp + 15 * 60_000, state: 'ready' };
    if (!(await putJson(ticketKey(ticketId), ticket))) throw new R2UploadError('upload_busy');
    return {
      ticketId,
      uploadUrl: await store.presign(stagingKey(ticketId), bytes),
      headers: {
        'Content-Type': 'application/octet-stream',
        'If-None-Match': '*',
      },
    };
  }

  async function publish(ticketId: string): Promise<ImageUploadResult> {
    if (!TICKET_PATTERN.test(ticketId)) throw new R2UploadError('invalid_ticket');
    const object = await store.get('private', ticketKey(ticketId), 4096);
    const ticket = parseTicket(object);
    if (ticket.expiresAt < now()) throw new R2UploadError('invalid_ticket');
    if (ticket.state === 'done' && ticket.assetId) {
      const manifest = await readManifest(ticket.assetId);
      return toResult(manifest, true);
    }
    if (ticket.state !== 'ready' || !object) throw new R2UploadError('upload_busy');
    // ticket을 claim하면 영구 객체를 만들 수 있고, 중단되면 실제 사용량을 장부만으로 알 수 없다.
    // 그래서 claim 전에 자동 회수 대상에서 먼저 뺀다. 이 순서라면 장부 경합으로 실패해도 ticket은
    // 아직 ready여서 같은 ticket으로 다시 시도할 수 있다.
    await updateLedger(ledger => {
      const allocation = ledger.allocations[ticketId];
      if (!allocation) throw new ImageUploadError('corruption');
      delete allocation.reclaimAt;
    });
    if (!(await putJson(ticketKey(ticketId), { ...ticket, state: 'processing' }, object.etag)))
      throw new R2UploadError('upload_busy');
    const input = await store.get('private', stagingKey(ticketId), 32 * MiB);
    if (!input || input.body.length !== ticket.bytes) throw new R2UploadError('invalid_upload');
    const published = await withPreparedImage(input.body, async prepared => {
      try {
        return await commit(prepared);
      } catch (error) {
        // collision·corruption처럼 사람이 확인해야 하는 코드를 전송 실패로 뭉개지 않는다.
        throw error instanceof ImageUploadError ? error : new ImageUploadError('storage_failure', error);
      }
    });
    const permanentBytes = Object.values(published.bytes).reduce((sum, bytes) => sum + bytes, 0);
    await updateLedger(ledger => {
      if (!(ticketId in ledger.allocations)) throw new ImageUploadError('corruption');
      ledger.allocations[ticketId] = { bytes: ticket.bytes + permanentBytes + 8192 };
    });
    const claimed = await store.get('private', ticketKey(ticketId), 4096);
    if (
      !claimed ||
      !(await putJson(ticketKey(ticketId), { ...ticket, state: 'done', assetId: published.assetId }, claimed.etag))
    ) {
      throw new ImageUploadError('storage_failure');
    }
    return published;
  }

  async function readManifest(assetId: string) {
    const object = await store.get('private', `blog/${assetId}/manifest.json`, 16_384);
    const value: unknown = object && JSON.parse(object.body.toString('utf8'));
    if (!isImageManifest(value) || value.assetId !== assetId || value.source.sha256 !== assetId)
      throw new ImageUploadError('corruption');
    return value;
  }

  async function commit({ manifest: localManifest, files: localFiles }: PreparedImage) {
    const result = toResult(localManifest, false);
    const prefix = `blog/${result.assetId}`;
    const totalBytes = Object.values(result.bytes).reduce((sum, bytes) => sum + bytes, 0);
    if (totalBytes > 128 * MiB - 8192) throw new ImageUploadError('payload_too_large');
    const created = await putJson(`${prefix}/manifest.json`, localManifest);
    const manifest = created ? localManifest : await readManifest(result.assetId);
    const files = [
      {
        bucket: 'private' as const,
        key: `${prefix}/source.jpg`,
        file: localFiles.source,
        expected: manifest.source,
        type: 'image/jpeg',
      },
      {
        bucket: 'public' as const,
        key: `${prefix}/content-v1/image.jpg`,
        file: localFiles.jpeg,
        expected: manifest.variants['content-v1'].jpeg,
        type: 'image/jpeg',
      },
      {
        bucket: 'public' as const,
        key: `${prefix}/content-v1/image.webp`,
        file: localFiles.webp,
        expected: manifest.variants['content-v1'].webp,
        type: 'image/webp',
      },
    ];
    for (const file of files) {
      const existing = await store.get(file.bucket, file.key, 128 * MiB);
      const incoming = await readFile(file.file);
      if (file.bucket === 'private' && existing && !existing.body.equals(incoming))
        throw new ImageUploadError('collision');
      if (existing) {
        assertBytes(existing.body, file.expected);
        continue;
      }
      assertBytes(incoming, file.expected);
      if (!(await store.put(file.bucket, file.key, incoming, { contentType: file.type, match: '*' }))) {
        const raced = await store.get(file.bucket, file.key, 128 * MiB);
        if (!raced) throw new ImageUploadError('corruption');
        assertBytes(raced.body, file.expected);
      }
    }
    const published = toResult(manifest, !created);
    await verify(published, manifest);
    return published;
  }

  async function verify(result: ImageUploadResult, manifest: ImageManifest) {
    try {
      await (options.verifyPublic ? options.verifyPublic(result) : verifyPublicImages(result, manifest));
    } catch (error) {
      throw error instanceof ImageUploadError ? error : new ImageUploadError('public_verification_failed', error);
    }
  }

  return { issue, publish };
}

function assertBytes(bytes: Buffer, expected: { bytes: number; sha256: string }) {
  if (bytes.length !== expected.bytes || createHash('sha256').update(bytes).digest('hex') !== expected.sha256)
    throw new ImageUploadError('corruption');
}

function ticketKey(id: string) {
  return `blog/control/tickets/${id}.json`;
}
function stagingKey(id: string) {
  return `blog/staging/${id}`;
}

function parseTicket(object: StoredObject | undefined): Ticket {
  const value: unknown = object && JSON.parse(object.body.toString('utf8'));
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.bytes) ||
    typeof value.bytes !== 'number' ||
    value.bytes < 1 ||
    value.bytes > 32 * MiB ||
    typeof value.expiresAt !== 'number' ||
    !Number.isSafeInteger(value.expiresAt) ||
    !['ready', 'processing', 'done'].includes(String(value.state)) ||
    (value.state === 'done' && (typeof value.assetId !== 'string' || !/^[0-9a-f]{64}$/.test(value.assetId)))
  )
    throw new R2UploadError('invalid_ticket');
  return value as Ticket;
}

function emptyLedger(): Ledger {
  return { version: 2, day: '', attempts: 0, lastIssuedAt: 0, allocations: {} };
}

// 발행 단계에 들어가지 못한 예약만 회수한다. 그 ticket의 staging 객체는 lifecycle이 이미
// 지웠고 영구 객체는 만들어진 적이 없으므로, 남은 예약은 실제 사용량과 무관하다.
function reclaimExpired(ledger: Ledger, timestamp: number) {
  for (const [id, allocation] of Object.entries(ledger.allocations)) {
    if (allocation.reclaimAt !== undefined && allocation.reclaimAt <= timestamp) delete ledger.allocations[id];
  }
}

function parseLedger(object: StoredObject): Ledger {
  const value: unknown = JSON.parse(object.body.toString('utf8'));
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) throw new ImageUploadError('corruption');
  const { day, attempts, lastIssuedAt, allocations } = value;
  if (typeof day !== 'string' || !isCounter(attempts) || !isCounter(lastIssuedAt) || !isRecord(allocations)) {
    throw new ImageUploadError('corruption');
  }
  return {
    version: 2,
    day,
    attempts,
    lastIssuedAt,
    allocations: Object.fromEntries(
      Object.entries(allocations).map(([id, entry]) => {
        if (!TICKET_PATTERN.test(id)) throw new ImageUploadError('corruption');
        return [id, parseAllocation(entry)];
      })
    ),
  };
}

// version 1 장부는 예약과 정산을 구분하지 못한다. 회수하지 않는 정산으로 읽어 기존 보수적
// 회계를 유지한다.
function parseAllocation(entry: unknown): Allocation {
  if (isReservedBytes(entry)) return { bytes: entry };
  if (!isRecord(entry) || !isReservedBytes(entry.bytes)) throw new ImageUploadError('corruption');
  const { bytes, reclaimAt } = entry;
  if (reclaimAt === undefined) return { bytes };
  if (!isCounter(reclaimAt)) throw new ImageUploadError('corruption');
  return { bytes, reclaimAt };
}

function isReservedBytes(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= RESERVATION_BYTES;
}

function isCounter(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
