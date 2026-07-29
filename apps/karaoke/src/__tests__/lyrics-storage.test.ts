import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LyricLine } from '../lib/lyrics';
import { MAX_LYRICS_BACKUP_SIZE } from '../lib/lyrics-import';

const lines: LyricLine[] = [{ time: 1, jp: '練習の一行', pron: '렌슈노 이치교', ko: '연습용 한 줄' }];

async function freshStorage() {
  return import('../lib/lyrics-storage');
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
  });
}

async function putRawRecord(record: unknown) {
  const database = await requestResult(indexedDB.open('karaoke-local-library', 1));
  const transaction = database.transaction('lyrics', 'readwrite');
  transaction.objectStore('lyrics').put(record);
  await transactionCompleted(transaction);
  database.close();
}

describe('lyrics storage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('saves, reads, lists, exports, and clears lyrics through real IndexedDB transactions', async () => {
    const storage = await freshStorage();

    await storage.saveStoredLyricsBatch([
      { slug: 'odoriko', lyrics: lines },
      { slug: 'kaiju-no-hanauta', lyrics: [{ time: 2, jp: '練習曲', pron: '', ko: '' }] },
    ]);

    expect(await storage.readStoredLyrics('odoriko')).toEqual(lines);
    expect(await storage.readStoredLyrics('missing-song')).toEqual([]);
    expect(await storage.listStoredLyrics()).toEqual(['kaiju-no-hanauta', 'odoriko']);
    expect(await storage.readStoredLyricsLibrary()).toEqual({
      entries: [
        { slug: 'kaiju-no-hanauta', lyrics: [{ time: 2, jp: '練習曲', pron: '', ko: '' }] },
        { slug: 'odoriko', lyrics: lines },
      ],
      skippedRecordCount: 0,
    });

    await storage.clearStoredLyrics();
    expect(await storage.listStoredLyrics()).toEqual([]);
  });

  it('validates a whole batch before opening a write transaction', async () => {
    const storage = await freshStorage();

    await expect(storage.saveStoredLyricsBatch([])).resolves.toBeUndefined();
    await expect(storage.saveStoredLyrics('  ', lines)).rejects.toThrow('slug가 없습니다');
    await expect(
      storage.saveStoredLyricsBatch([
        { slug: 'odoriko', lyrics: lines },
        { slug: 'odoriko', lyrics: lines },
      ])
    ).rejects.toThrow('같은 곡');
    await expect(storage.saveStoredLyrics('odoriko', [{ time: -1, jp: '연습', pron: '', ko: '' }])).rejects.toThrow(
      '시간이 올바르지'
    );
    expect(await storage.listStoredLyrics()).toEqual([]);
  });

  it('keeps every exported library within the re-importable song limit', async () => {
    const storage = await freshStorage();
    const entries = Array.from({ length: 50 }, (_, index) => ({ slug: `song-${index}`, lyrics: lines }));

    await storage.saveStoredLyricsBatch(entries);
    await expect(storage.saveStoredLyrics('one-too-many', lines)).rejects.toThrow('최대 50곡');
    expect(await storage.listStoredLyrics()).toHaveLength(50);
  });

  it('rejects a write that would make the complete library too large to export', async () => {
    const storage = await freshStorage();
    vi.spyOn(TextEncoder.prototype, 'encode').mockReturnValue({
      byteLength: MAX_LYRICS_BACKUP_SIZE + 1,
    } as Uint8Array<ArrayBuffer>);

    await expect(storage.saveStoredLyrics('oversized', lines)).rejects.toThrow('전체 백업이 24MB보다 큽니다');
    expect(await storage.listStoredLyrics()).toEqual([]);
  });

  it('rejects a corrupt current record while salvaging valid records for backup', async () => {
    const storage = await freshStorage();
    await storage.saveStoredLyrics('odoriko', lines);
    await putRawRecord({
      schemaVersion: 999,
      slug: 'broken-version',
      lyrics: lines,
      updatedAt: new Date().toISOString(),
    });
    await putRawRecord({
      schemaVersion: 1,
      slug: 'broken-date',
      lyrics: lines,
      updatedAt: 123,
    });

    await expect(storage.readStoredLyrics('broken-version')).rejects.toThrow('버전을 읽을 수 없습니다');
    await expect(storage.readStoredLyrics('broken-date')).rejects.toThrow('수정 시각을 읽을 수 없습니다');
    expect(await storage.readStoredLyricsLibrary()).toEqual({
      entries: [{ slug: 'odoriko', lyrics: lines }],
      skippedRecordCount: 2,
    });
  });

  it('notifies local subscribers and stops after unsubscribe', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const storage = await freshStorage();
    const listener = vi.fn();
    const unsubscribe = storage.subscribeLyricsChanges(listener);

    await storage.saveStoredLyrics('odoriko', lines);
    await storage.clearStoredLyrics();
    expect(listener).toHaveBeenNthCalledWith(1, 'odoriko');
    expect(listener).toHaveBeenNthCalledWith(2, null);

    unsubscribe();
    await storage.saveStoredLyrics('odoriko', lines);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('broadcasts changes and accepts only valid cross-tab messages', async () => {
    class FakeBroadcastChannel {
      static instance: FakeBroadcastChannel | undefined;
      readonly postMessage = vi.fn();
      private messageListener?: (event: MessageEvent) => void;

      constructor(readonly name: string) {
        FakeBroadcastChannel.instance = this;
      }

      addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
        if (type === 'message') this.messageListener = listener as (event: MessageEvent) => void;
      }

      emit(data: unknown) {
        this.messageListener?.(new MessageEvent('message', { data }));
      }
    }
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    const storage = await freshStorage();
    const listener = vi.fn();
    storage.subscribeLyricsChanges(listener);

    FakeBroadcastChannel.instance?.emit('odoriko');
    FakeBroadcastChannel.instance?.emit(null);
    FakeBroadcastChannel.instance?.emit(123);
    await storage.saveStoredLyrics('napori', lines);

    expect(FakeBroadcastChannel.instance?.name).toBe('karaoke-local-library-changes');
    expect(FakeBroadcastChannel.instance?.postMessage).toHaveBeenCalledWith('napori');
    expect(listener.mock.calls).toEqual([['odoriko'], [null], ['napori']]);
  });

  it('uses Web Locks when available and has a direct fallback', async () => {
    const storage = await freshStorage();
    const operation = vi.fn().mockResolvedValue('saved');
    const request = vi.fn((_name: string, callback: () => Promise<string>) => callback());
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });

    await expect(storage.withLyricsLibraryWriteLock(operation)).resolves.toBe('saved');
    expect(request).toHaveBeenCalledWith('karaoke-local-library-write', operation);

    Reflect.deleteProperty(navigator, 'locks');
    await expect(storage.withLyricsLibraryWriteLock(operation)).resolves.toBe('saved');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('degrades read-only operations cleanly when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const storage = await freshStorage();

    expect(await storage.readStoredLyrics('odoriko')).toEqual([]);
    expect(await storage.listStoredLyrics()).toEqual([]);
    expect(await storage.readStoredLyricsLibrary()).toEqual({ entries: [], skippedRecordCount: 0 });
    await expect(storage.clearStoredLyrics()).resolves.toBeUndefined();
    await expect(storage.saveStoredLyrics('odoriko', lines)).rejects.toThrow('기기 저장소를 사용할 수 없습니다');
  });
});
