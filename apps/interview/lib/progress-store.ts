'use client';
import { useSyncExternalStore } from 'react';

import { parseCloudProgress, parseProgressWrite, type CloudProgress, type ProgressWrite } from '@/lib/cloud-progress';
import { emptyProgress, parseProgress, STORAGE_KEY, type Progress } from '@/lib/progress';

type Snapshot = {
  progress: Progress;
  ready: boolean;
  error: string;
  blocked: boolean;
  status: 'loading' | 'saved' | 'saving' | 'offline' | 'conflict';
  conflict: CloudProgress | null;
};
const initial: Snapshot = {
  progress: emptyProgress(),
  ready: false,
  error: '',
  blocked: false,
  status: 'loading',
  conflict: null,
};
const CACHE_KEY = 'next-stop:cloud:v1';
const OUTBOX_PREFIX = 'next-stop:outbox:v1:';
const TAB_KEY = 'next-stop:tab:v1';
let snapshot = initial;
let revision: string | null = null;
let dirty = false;
let pending: ProgressWrite | null = null;
let outboxKey = '';
let loading = false;
let busy = false;
let initialized = false;
let localReady = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let localError = '';
const listeners = new Set<() => void>();
const same = (a: Progress, b: Progress) => JSON.stringify(a) === JSON.stringify(b);
function publish(change: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...change };
  listeners.forEach(listener => listener());
}
function persist() {
  try {
    if (dirty) {
      localStorage.setItem(
        outboxKey,
        JSON.stringify({ revision, progress: snapshot.progress, pending, updatedAt: Date.now() })
      );
    } else {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ revision, progress: snapshot.progress }));
      localStorage.removeItem(outboxKey);
    }
    localError = '';
  } catch {
    localError = '기기에 저장하지 못했어요. 화면의 초안은 유지 중이에요. 서버 저장 전에는 백업을 내려받아 주세요.';
  }
}
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => void synchronize(), 800);
}
function fail(error: unknown) {
  const expired = error instanceof Error && error.message === '401';
  publish({
    ready: initialized || localReady || snapshot.blocked,
    blocked: snapshot.blocked,
    status: 'offline',
    error:
      localError ||
      (expired
        ? '로그인이 만료됐어요. 초안을 백업한 뒤 다시 로그인해 주세요.'
        : '서버에 연결하지 못했어요. 이 기기의 초안을 보관 중이며, 연결되면 다시 저장해요.'),
  });
}
async function request(method: 'GET' | 'PUT', body?: ProgressWrite) {
  const response = await fetch('/api/progress', {
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok && response.status !== 409) throw new Error(String(response.status));
  return { conflict: response.status === 409, document: parseCloudProgress(await response.json()) };
}
function conflict(document: CloudProgress) {
  publish({
    ready: true,
    blocked: true,
    status: 'conflict',
    conflict: document,
    error: '다른 기기의 기록과 달라요. 이 기기의 초안은 보관했어요. 백업 후 사용할 기록을 선택해 주세요.',
  });
}
export async function synchronize() {
  if (!outboxKey || busy || snapshot.conflict || (snapshot.blocked && initialized)) return;
  busy = true;
  try {
    if (!initialized) {
      const { document } = await request('GET');
      initialized = true;
      if (snapshot.blocked) {
        conflict(document);
        return;
      }
      if (dirty) {
        if (pending?.revision === document.revision) {
          revision = document.revision;
          dirty = !same(snapshot.progress, pending.progress);
          pending = null;
          persist();
        } else if (document.revision !== revision) {
          conflict(document);
          return;
        }
      } else {
        revision = document.revision;
        publish({ progress: document.progress });
        persist();
      }
      publish({ ready: true });
    }
    if (dirty) {
      pending ??= { baseRevision: revision, revision: crypto.randomUUID(), progress: snapshot.progress };
      persist();
      publish({ status: 'saving', error: localError });
      const sent = pending;
      const result = await request('PUT', sent);
      if (result.conflict) {
        conflict(result.document);
        return;
      }
      if (result.document.revision !== sent.revision) throw new Error('Unexpected acknowledgement');
      revision = result.document.revision;
      dirty = !same(snapshot.progress, sent.progress);
      pending = null;
      persist();
      publish({ status: dirty ? 'saving' : 'saved', error: localError });
      if (dirty) schedule();
    } else {
      const startedWith = snapshot.progress;
      const { document } = await request('GET');
      // An edit made while GET was in flight retains its original base revision.
      if (dirty || snapshot.progress !== startedWith) return;
      revision = document.revision;
      publish({ progress: document.progress, status: 'saved', error: localError });
      persist();
    }
  } catch (error) {
    fail(error);
  } finally {
    busy = false;
    if (dirty && snapshot.status === 'saving') schedule();
  }
}
// A lock lives for the document's lifetime and is released by the browser on close.
// It prevents duplicated sessionStorage from giving two tabs the same outbox owner.
async function claimOutbox(id: string) {
  return new Promise<boolean>((resolve, reject) => {
    void navigator.locks
      .request(OUTBOX_PREFIX + id, { ifAvailable: true }, async lock => {
        if (!lock) {
          resolve(false);
          return;
        }
        resolve(true);
        await new Promise<void>(() => {});
      })
      .catch(reject);
  });
}
function outboxUpdatedAt(key: string) {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return value &&
      typeof value === 'object' &&
      'updatedAt' in value &&
      typeof value.updatedAt === 'number' &&
      Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : 0;
  } catch {
    // A damaged or concurrently removed candidate must not block all draft recovery.
    // Keep the raw record untouched; normal parsing protects it if it is selected.
    return 0;
  }
}
async function load() {
  loading = true;
  if (!navigator.locks) {
    publish({
      ready: true,
      blocked: true,
      error: '이 브라우저는 안전한 기록 저장을 지원하지 않아요. 최신 Safari나 Chrome을 사용해 주세요.',
    });
    return;
  }
  try {
    const previousTab = sessionStorage.getItem(TAB_KEY);
    let tab = previousTab && (await claimOutbox(previousTab)) ? previousTab : null;
    if (!tab) {
      const candidates = Object.keys(localStorage).filter(key => key.startsWith(OUTBOX_PREFIX));
      for (const candidate of candidates.toSorted((a, b) => outboxUpdatedAt(b) - outboxUpdatedAt(a))) {
        const id = candidate.slice(OUTBOX_PREFIX.length);
        if (await claimOutbox(id)) {
          tab = id;
          break;
        }
      }
    }
    if (!tab) {
      tab = crypto.randomUUID();
      if (!(await claimOutbox(tab))) throw new Error('Outbox unavailable');
    }
    sessionStorage.setItem(TAB_KEY, tab);
    outboxKey = OUTBOX_PREFIX + tab;
    const raw = localStorage.getItem(outboxKey);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      const document = parseCloudProgress(value);
      revision = document.revision;
      if (value && typeof value === 'object' && 'pending' in value && value.pending)
        pending = parseProgressWrite(value.pending);
      dirty = true;
      localReady = true;
      snapshot = { ...snapshot, progress: document.progress, ready: true };
    } else {
      const cache = localStorage.getItem(CACHE_KEY);
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (cache) {
        const document = parseCloudProgress(JSON.parse(cache));
        revision = document.revision;
        localReady = true;
        snapshot = { ...snapshot, progress: document.progress, ready: true };
      } else if (legacy) {
        localReady = true;
        snapshot = { ...snapshot, progress: parseProgress(legacy), ready: true };
        dirty = true;
      }
    }
  } catch {
    snapshot = {
      ...snapshot,
      ready: true,
      blocked: true,
      error: '기존 데이터를 보호하기 위해 저장을 멈췄어요. 기록을 백업한 뒤 복원해 주세요.',
    };
  }
  if (dirty && localReady) persist();
  publish({ ready: localReady || snapshot.blocked });
  void synchronize();
}
function wake() {
  if (document.visibilityState === 'visible') void synchronize();
}
function leaving(event: BeforeUnloadEvent) {
  if (dirty) {
    event.preventDefault();
    event.returnValue = '';
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    if (!outboxKey && !loading) void load();
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('beforeunload', leaving);
    document.addEventListener('visibilitychange', wake);
  }
  const interval = setInterval(wake, 30000);
  return () => {
    listeners.delete(listener);
    clearInterval(interval);
    if (!listeners.size) {
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('beforeunload', leaving);
      document.removeEventListener('visibilitychange', wake);
    }
  };
}
export function saveProgress(update: (value: Progress) => Progress, force = false) {
  if (!outboxKey) return false;
  if (((!initialized && !localReady) || snapshot.blocked) && !force) return false;
  // Even an import/reset cannot silently bypass a remote conflict.
  if (snapshot.conflict || (!initialized && !localReady)) return false;
  let progress: Progress;
  try {
    progress = parseProgress(JSON.stringify(update(snapshot.progress)));
  } catch {
    publish({
      error:
        '기록의 크기나 형식 제한을 넘었어요. 이번 변경은 저장하지 않았고 기존 기록은 유지했어요. 백업 후 긴 메모·코드를 줄여 주세요.',
    });
    return false;
  }
  if (same(progress, snapshot.progress) && !snapshot.blocked) return true;
  dirty = true;
  publish({ progress, ready: true, blocked: false, status: 'saving' });
  persist();
  publish({ error: localError });
  schedule();
  return true;
}
export function resolveConflict(keepLocal: boolean) {
  const remote = snapshot.conflict;
  if (!remote) return;
  revision = remote.revision;
  pending = null;
  dirty = keepLocal;
  publish({
    progress: keepLocal ? snapshot.progress : remote.progress,
    conflict: null,
    blocked: false,
    status: keepLocal ? 'saving' : 'saved',
    error: '',
  });
  persist();
  publish({ error: localError });
  if (dirty) schedule();
}
export function hasUnsavedProgress() {
  return dirty || snapshot.status === 'conflict';
}
export function useProgress() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => initial
  );
}
