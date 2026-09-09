/** @jest-environment node */
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';

import type { ObjectStore, StoredObject } from '@/src/shared/lib/r2-store';

import { createR2Uploader } from '../r2-upload';

function memoryStore() {
  const objects = new Map<string, StoredObject>();
  const store: ObjectStore = {
    async get(bucket, key, maxBytes) {
      const object = objects.get(`${bucket}/${key}`);
      if (object && object.body.length > maxBytes) throw new Error('oversized');
      return object;
    },
    async put(bucket, key, body, { match }) {
      const id = `${bucket}/${key}`;
      const previous = objects.get(id);
      if (match === '*' ? previous !== undefined : previous?.etag !== match) return false;
      objects.set(id, { body: Buffer.from(body), etag: randomUUID() });
      return true;
    },
    async presign(key, bytes) {
      return `https://upload.example/${key}?bytes=${bytes}`;
    },
  };
  function set(key: string, value: unknown) {
    objects.set(`private/${key}`, { body: Buffer.from(JSON.stringify(value)), etag: randomUUID() });
  }
  function json(key: string) {
    return JSON.parse(objects.get(`private/${key}`)!.body.toString());
  }
  return { store, objects, set, json };
}

describe('R2 image publication', () => {
  let memory: ReturnType<typeof memoryStore>;
  let timestamp: number;
  let input: Buffer;
  let verify: jest.Mock;
  let uploader: ReturnType<typeof createR2Uploader>;
  const ledgerKey = 'blog/control/upload-budget.json';
  const reclaimDelay = 72 * 60 * 60_000;

  beforeAll(async () => {
    input = await sharp({ create: { width: 32, height: 18, channels: 3, background: '#305090' } })
      .jpeg()
      .toBuffer();
  });
  beforeEach(() => {
    memory = memoryStore();
    timestamp = Date.UTC(2026, 8, 9);
    verify = jest.fn().mockResolvedValue(undefined);
    uploader = createR2Uploader(memory.store, { now: () => timestamp, verifyPublic: verify });
  });

  async function prepare(bytes = input.length) {
    timestamp += 6_000;
    const ticket = await uploader.issue(bytes);
    await memory.store.put('private', `blog/staging/${ticket.ticketId}`, input, {
      contentType: 'application/octet-stream',
      match: '*',
    });
    return ticket;
  }

  it('publishes real sanitized bytes and returns a verified immutable URL', async () => {
    const ticket = await prepare();
    expect(ticket.headers).toEqual({ 'Content-Type': 'application/octet-stream', 'If-None-Match': '*' });
    const result = await uploader.publish(ticket.ticketId);
    expect(result.duplicate).toBe(false);
    expect(result.width).toBe(32);
    expect(verify).toHaveBeenCalledWith(result);
    const source = memory.objects.get(`private/blog/${result.assetId}/source.jpg`)!.body;
    expect(createHash('sha256').update(source).digest('hex')).toBe(result.assetId);
    expect(memory.objects.has(`public/blog/${result.assetId}/source.jpg`)).toBe(false);
    expect(memory.objects.has(`private/blog/staging/${ticket.ticketId}`)).toBe(true);
    expect(memory.json(ledgerKey).allocations[ticket.ticketId]).toEqual({
      bytes: input.length + Object.values(result.bytes).reduce((a, b) => a + b, 8192),
    });
    const replay = await uploader.publish(ticket.ticketId);
    expect(replay.duplicate).toBe(true);
  });

  it('keeps stored renditions when a new ticket uploads a duplicate', async () => {
    const first = await uploader.publish((await prepare()).ticketId);
    const key = `public/blog/${first.assetId}/content-v1/image.jpg`;
    const original = memory.objects.get(key);
    const second = await uploader.publish((await prepare()).ticketId);
    expect(second.duplicate).toBe(true);
    expect(memory.objects.get(key)).toBe(original);
  });

  it('recovers an interrupted publication using a fresh ticket without overwriting completed objects', async () => {
    const originalPut = memory.store.put;
    let failed = false;
    memory.store.put = async (...args) => {
      if (args[0] === 'public' && args[1].endsWith('.webp') && !failed) {
        failed = true;
        throw new Error('network');
      }
      return originalPut(...args);
    };
    await expect(uploader.publish((await prepare()).ticketId)).rejects.toMatchObject({ code: 'storage_failure' });
    const original = [...memory.objects.entries()].find(([key]) => key.startsWith('public/'))!;
    const result = await uploader.publish((await prepare()).ticketId);
    expect(result.duplicate).toBe(true);
    expect(memory.objects.get(original[0])).toBe(original[1]);
  });

  it('refuses a corrupted public object without replacing it', async () => {
    const result = await uploader.publish((await prepare()).ticketId);
    const key = `public/blog/${result.assetId}/content-v1/image.jpg`;
    const bad = { body: Buffer.from('broken'), etag: 'bad' };
    memory.objects.set(key, bad);
    await expect(uploader.publish((await prepare()).ticketId)).rejects.toMatchObject({ code: 'corruption' });
    expect(memory.objects.get(key)).toBe(bad);
  });

  it('refuses a mismatching canonical source', async () => {
    const result = await uploader.publish((await prepare()).ticketId);
    memory.objects.set(`private/blog/${result.assetId}/source.jpg`, { body: Buffer.from('collision'), etag: 'bad' });
    await expect(uploader.publish((await prepare()).ticketId)).rejects.toMatchObject({ code: 'collision' });
  });

  it('claims one ticket once across two server instances', async () => {
    const ticket = await prepare();
    const other = createR2Uploader(memory.store, { now: () => timestamp, verifyPublic: verify });
    const outcomes = await Promise.allSettled([uploader.publish(ticket.ticketId), other.publish(ticket.ticketId)]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1);
  });

  it('serializes admission across independent instances', async () => {
    const other = createR2Uploader(memory.store, { now: () => timestamp, verifyPublic: verify });
    const outcomes = await Promise.allSettled([uploader.issue(1), other.issue(1)]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(Object.keys(memory.json(ledgerKey).allocations)).toHaveLength(1);
  });

  it('retains reservations on failure and rejects replay of a processing ticket', async () => {
    const ticket = await prepare(input.length + 1);
    await expect(uploader.publish(ticket.ticketId)).rejects.toMatchObject({ code: 'invalid_upload' });
    await expect(uploader.publish(ticket.ticketId)).rejects.toMatchObject({ code: 'upload_busy' });
    expect(memory.json(ledgerKey).allocations[ticket.ticketId].bytes).toBe(160 * 1024 * 1024);
  });

  it('reclaims abandoned reservations once the staging lifecycle has removed their bytes', async () => {
    const abandoned = [await prepare(), await prepare(), await prepare()];
    timestamp += reclaimDelay;
    const next = await uploader.issue(1);
    const { allocations } = memory.json(ledgerKey);
    expect(Object.keys(allocations)).toEqual([next.ticketId]);
    expect(allocations[next.ticketId].bytes).toBe(160 * 1024 * 1024);
    for (const ticket of abandoned) {
      await expect(uploader.publish(ticket.ticketId)).rejects.toMatchObject({ code: 'invalid_ticket' });
    }
  });

  it('never reclaims a reservation whose publication could have written permanent objects', async () => {
    verify.mockRejectedValue(new Error('unreachable'));
    const ticket = await prepare();
    await expect(uploader.publish(ticket.ticketId)).rejects.toMatchObject({ code: 'public_verification_failed' });
    timestamp += reclaimDelay;
    await uploader.issue(1);
    expect(memory.json(ledgerKey).allocations[ticket.ticketId].bytes).toBe(160 * 1024 * 1024);
  });

  it('keeps version 1 allocations as settled bytes that are never reclaimed', async () => {
    const legacy = randomUUID();
    memory.set(ledgerKey, {
      version: 1,
      day: '2026-09-09',
      attempts: 1,
      lastIssuedAt: 0,
      allocations: { [legacy]: 4096 },
    });
    await uploader.issue(1);
    timestamp += reclaimDelay;
    await uploader.issue(1);
    const ledger = memory.json(ledgerKey);
    expect(ledger.version).toBe(2);
    expect(ledger.allocations[legacy]).toEqual({ bytes: 4096 });
  });

  it('rejects missing staging, invalid images and failed public verification', async () => {
    const missing = await uploader.issue(3);
    await expect(uploader.publish(missing.ticketId)).rejects.toMatchObject({ code: 'invalid_upload' });
    const invalid = await prepare();
    memory.objects.get(`private/blog/staging/${invalid.ticketId}`)!.body.fill(0);
    await expect(uploader.publish(invalid.ticketId)).rejects.toBeDefined();
    verify.mockRejectedValue(new Error('unreachable'));
    await expect(uploader.publish((await prepare()).ticketId)).rejects.toMatchObject({
      code: 'public_verification_failed',
    });
  });

  it.each([0, -1, 1.2, NaN, 32 * 1024 * 1024 + 1])(
    'rejects invalid admission size %s without storage writes',
    async bytes => {
      await expect(uploader.issue(bytes)).rejects.toMatchObject({ code: 'invalid_upload' });
      expect(memory.objects.size).toBe(0);
    }
  );

  it('enforces the daily limit across restarts and allows the next UTC day', async () => {
    for (let index = 0; index < 20; index++) await prepare();
    timestamp += 6_000;
    await expect(uploader.issue(1)).rejects.toMatchObject({ code: 'daily_limit' });
    timestamp += 86_400_000;
    await expect(uploader.issue(1)).resolves.toHaveProperty('ticketId');
  });

  it('stops conservatively before the 8 GB reservation budget is exhausted', async () => {
    for (let day = 0; day < 2; day++) {
      for (let index = 0; index < 20; index++) await prepare();
      timestamp += 86_400_000;
    }
    for (let index = 0; index < 7; index++) await prepare();
    timestamp += 6_000;
    await expect(uploader.issue(1)).rejects.toMatchObject({ code: 'storage_limit' });
  });

  it.each(['../../source.jpg', 'https://example.com', randomUUID()])(
    'rejects invalid or missing ticket %s',
    async ticket => {
      await expect(uploader.publish(ticket)).rejects.toMatchObject({ code: 'invalid_ticket' });
    }
  );

  it('rejects an expired ticket before transforming', async () => {
    const ticket = await prepare();
    timestamp += 16 * 60_000;
    await expect(uploader.publish(ticket.ticketId)).rejects.toMatchObject({ code: 'invalid_ticket' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('fails closed if ledger or ticket metadata is corrupt', async () => {
    memory.set(ledgerKey, { allocations: {} });
    await expect(uploader.issue(1)).rejects.toMatchObject({ code: 'corruption' });
    const id = randomUUID();
    memory.set(`blog/control/tickets/${id}.json`, { state: 'ready' });
    await expect(uploader.publish(id)).rejects.toMatchObject({ code: 'invalid_ticket' });
  });

  it.each([
    { version: 3, day: '2026-09-09', attempts: 0, lastIssuedAt: 0, allocations: {} },
    { version: 2, day: 1, attempts: 0, lastIssuedAt: 0, allocations: {} },
    { version: 2, day: '2026-09-09', attempts: -1, lastIssuedAt: 0, allocations: {} },
    { version: 2, day: '2026-09-09', attempts: 0, lastIssuedAt: 0, allocations: { [randomUUID()]: { bytes: 0 } } },
    {
      version: 2,
      day: '2026-09-09',
      attempts: 0,
      lastIssuedAt: 0,
      allocations: { [randomUUID()]: { bytes: 1, reclaimAt: -1 } },
    },
    { version: 2, day: '2026-09-09', attempts: 0, lastIssuedAt: 0, allocations: { 'not-a-ticket': { bytes: 1 } } },
  ])('fails closed on a malformed ledger %#', async ledger => {
    memory.set(ledgerKey, ledger);
    await expect(uploader.issue(1)).rejects.toMatchObject({ code: 'corruption' });
  });

  it('bounds retries on persistent conditional-write contention', async () => {
    memory.store.put = jest.fn().mockResolvedValue(false);
    await expect(uploader.issue(1)).rejects.toMatchObject({ code: 'upload_busy' });
    expect(memory.store.put).toHaveBeenCalledTimes(5);
  });
});
