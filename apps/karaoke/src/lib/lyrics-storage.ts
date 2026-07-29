import { LYRICS_DATABASE } from '@/lib/client-storage';
import type { LyricLine } from '@/lib/lyrics';
import {
  MAX_LYRICS_LIBRARY_SONGS,
  parseLyricsFile,
  serializeLyricsLibraryBackup,
  type StoredLyricsEntry,
} from '@/lib/lyrics-import';

const LYRICS_RECORD_SCHEMA_VERSION = 1;
const CHANNEL_NAME = 'karaoke-local-library-changes';
const WRITE_LOCK_NAME = 'karaoke-local-library-write';

type StoredLyrics = {
  schemaVersion: typeof LYRICS_RECORD_SCHEMA_VERSION;
  slug: string;
  lyrics: LyricLine[];
  updatedAt: string;
};

type LyricsChangeListener = (slug: string | null) => void;

const listeners = new Set<LyricsChangeListener>();
let broadcastChannel: BroadcastChannel | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseStoredLyricsRecord(value: unknown): StoredLyrics {
  if (!isRecord(value)) throw new Error('저장된 가사 레코드의 형식이 올바르지 않습니다.');
  if (value.schemaVersion !== LYRICS_RECORD_SCHEMA_VERSION) {
    throw new Error('저장된 가사 형식의 버전을 읽을 수 없습니다.');
  }
  if (typeof value.slug !== 'string' || value.slug.trim().length === 0) {
    throw new Error('저장된 가사의 곡 식별자를 읽을 수 없습니다.');
  }
  if (typeof value.updatedAt !== 'string') {
    throw new Error('저장된 가사의 수정 시각을 읽을 수 없습니다.');
  }

  return {
    schemaVersion: LYRICS_RECORD_SCHEMA_VERSION,
    slug: value.slug,
    lyrics: parseLyricsFile(value.lyrics).lyrics,
    updatedAt: value.updatedAt,
  };
}

function indexedDb(): IDBFactory | null {
  return 'indexedDB' in globalThis ? globalThis.indexedDB : null;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error ?? new Error('로컬 저장소 요청에 실패했습니다.')), {
      once: true,
    });
  });
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
      'abort',
      () => reject(transaction.error ?? new Error('로컬 저장소 작업이 중단됐습니다.')),
      { once: true }
    );
    transaction.addEventListener(
      'error',
      () => reject(transaction.error ?? new Error('로컬 저장소 작업에 실패했습니다.')),
      { once: true }
    );
  });
}

async function openDatabase(): Promise<IDBDatabase | null> {
  const factory = indexedDb();
  if (!factory) return null;

  const request = factory.open(LYRICS_DATABASE.name, LYRICS_DATABASE.version);
  request.addEventListener('upgradeneeded', () => {
    if (!request.result.objectStoreNames.contains(LYRICS_DATABASE.storeName)) {
      request.result.createObjectStore(LYRICS_DATABASE.storeName, { keyPath: 'slug' });
    }
  });

  const database = await requestResult(request);
  database.addEventListener('versionchange', () => database.close(), { once: true });
  return database;
}

function receiveLyricsChanged(slug: string | null) {
  for (const listener of listeners) listener(slug);
}

function lyricsBroadcastChannel(): BroadcastChannel | null {
  if (broadcastChannel !== undefined) return broadcastChannel;
  if (typeof globalThis.BroadcastChannel !== 'function') {
    broadcastChannel = null;
    return broadcastChannel;
  }

  broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  broadcastChannel.addEventListener('message', event => {
    const slug = event.data;
    if (slug === null || typeof slug === 'string') receiveLyricsChanged(slug);
  });
  return broadcastChannel;
}

function notifyLyricsChanged(slug: string | null) {
  receiveLyricsChanged(slug);
  lyricsBroadcastChannel()?.postMessage(slug);
}

export function subscribeLyricsChanges(listener: LyricsChangeListener): () => void {
  lyricsBroadcastChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 확인 창과 실제 저장을 한 임계 구역으로 묶어, 여러 탭이 동시에 같은 곡을
 * 덮어쓸 때 확인 없는 last-write-wins가 생기지 않게 한다.
 */
export async function withLyricsLibraryWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  if ('navigator' in globalThis && 'locks' in navigator) {
    return navigator.locks.request(WRITE_LOCK_NAME, operation);
  }
  return operation();
}

export async function readStoredLyrics(slug: string): Promise<LyricLine[]> {
  const database = await openDatabase();
  if (!database) return [];

  try {
    const transaction = database.transaction(LYRICS_DATABASE.storeName, 'readonly');
    const record = await requestResult<unknown>(transaction.objectStore(LYRICS_DATABASE.storeName).get(slug));
    await transactionCompleted(transaction);
    if (!record) return [];
    return parseStoredLyricsRecord(record).lyrics;
  } finally {
    database.close();
  }
}

export async function saveStoredLyrics(slug: string, lyrics: LyricLine[]): Promise<void> {
  await saveStoredLyricsBatch([{ slug, lyrics }]);
}

export async function saveStoredLyricsBatch(entries: readonly { slug: string; lyrics: LyricLine[] }[]): Promise<void> {
  if (entries.length === 0) return;

  const normalizedEntries = entries.map(entry => {
    const slug = entry.slug.trim();
    if (!slug) throw new Error('저장할 곡의 slug가 없습니다.');
    return { slug, lyrics: parseLyricsFile(entry.lyrics).lyrics };
  });
  if (new Set(normalizedEntries.map(entry => entry.slug)).size !== normalizedEntries.length) {
    throw new Error('같은 곡을 한 번에 두 번 저장할 수 없습니다.');
  }

  const database = await openDatabase();
  if (!database) throw new Error('이 브라우저에서는 기기 저장소를 사용할 수 없습니다.');

  try {
    const transaction = database.transaction(LYRICS_DATABASE.storeName, 'readwrite');
    const store = transaction.objectStore(LYRICS_DATABASE.storeName);
    const completed = transactionCompleted(transaction);
    try {
      const [storedKeys, storedRecords] = await Promise.all([
        requestResult(store.getAllKeys()),
        requestResult<unknown[]>(store.getAll()),
      ]);
      const resultingSlugs = new Set(storedKeys.filter((key): key is string => typeof key === 'string'));
      for (const entry of normalizedEntries) resultingSlugs.add(entry.slug);
      if (resultingSlugs.size > MAX_LYRICS_LIBRARY_SONGS) {
        throw new Error(`가사 보관함은 최대 ${MAX_LYRICS_LIBRARY_SONGS}곡까지 저장할 수 있습니다.`);
      }

      const resultingLibrary = new Map<string, StoredLyricsEntry>();
      for (const record of storedRecords) {
        try {
          const { slug, lyrics } = parseStoredLyricsRecord(record);
          resultingLibrary.set(slug, { slug, lyrics });
        } catch {
          // 읽을 수 없는 기존 레코드는 전체 백업에서도 제외되므로 크기 계산에서도 건너뛴다.
        }
      }
      for (const entry of normalizedEntries) resultingLibrary.set(entry.slug, entry);
      serializeLyricsLibraryBackup([...resultingLibrary.values()]);

      const updatedAt = new Date().toISOString();
      for (const entry of normalizedEntries) {
        store.put({
          schemaVersion: LYRICS_RECORD_SCHEMA_VERSION,
          slug: entry.slug,
          lyrics: entry.lyrics,
          updatedAt,
        } satisfies StoredLyrics);
      }
      await completed;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // 이미 완료되거나 중단된 transaction이면 그대로 원래 오류를 전달한다.
      }
      await completed.catch(() => {});
      throw error;
    }
  } finally {
    database.close();
  }

  for (const entry of normalizedEntries) notifyLyricsChanged(entry.slug);
}

export async function listStoredLyrics(): Promise<string[]> {
  const database = await openDatabase();
  if (!database) return [];

  try {
    const transaction = database.transaction(LYRICS_DATABASE.storeName, 'readonly');
    const keys = await requestResult(transaction.objectStore(LYRICS_DATABASE.storeName).getAllKeys());
    await transactionCompleted(transaction);
    return keys.filter((key): key is string => typeof key === 'string').toSorted();
  } finally {
    database.close();
  }
}

export async function readStoredLyricsLibrary(): Promise<{
  entries: StoredLyricsEntry[];
  skippedRecordCount: number;
}> {
  const database = await openDatabase();
  if (!database) return { entries: [], skippedRecordCount: 0 };

  try {
    const transaction = database.transaction(LYRICS_DATABASE.storeName, 'readonly');
    const records = await requestResult<unknown[]>(transaction.objectStore(LYRICS_DATABASE.storeName).getAll());
    await transactionCompleted(transaction);
    const entries: StoredLyricsEntry[] = [];
    let skippedRecordCount = 0;
    for (const record of records) {
      try {
        const { slug, lyrics } = parseStoredLyricsRecord(record);
        entries.push({ slug, lyrics });
      } catch {
        skippedRecordCount += 1;
      }
    }
    return {
      entries: entries.toSorted((a, b) => a.slug.localeCompare(b.slug)),
      skippedRecordCount,
    };
  } finally {
    database.close();
  }
}

export async function deleteStoredLyrics(slug: string): Promise<void> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) throw new Error('지울 곡의 slug가 없습니다.');

  const database = await openDatabase();
  if (!database) return;

  try {
    const transaction = database.transaction(LYRICS_DATABASE.storeName, 'readwrite');
    transaction.objectStore(LYRICS_DATABASE.storeName).delete(normalizedSlug);
    await transactionCompleted(transaction);
  } finally {
    database.close();
  }

  notifyLyricsChanged(normalizedSlug);
}

export async function clearStoredLyrics(): Promise<void> {
  const database = await openDatabase();
  if (!database) return;

  try {
    const transaction = database.transaction(LYRICS_DATABASE.storeName, 'readwrite');
    transaction.objectStore(LYRICS_DATABASE.storeName).clear();
    await transactionCompleted(transaction);
  } finally {
    database.close();
  }

  notifyLyricsChanged(null);
}
