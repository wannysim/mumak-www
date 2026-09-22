import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AuthSession, DashboardClient } from '@/lib/dashboard-client';
import type { DashboardMode, DashboardSnapshot } from '@/lib/dashboard-schema';

type DataStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

type ModeData = {
  status: DataStatus;
  snapshots: DashboardSnapshot[];
  message?: string;
};

type ModeSelection = {
  episodeId: string | null;
  month: string | null;
};

// 수동 새로고침이 성공했는지 알려주려면 호출부가 결과를 받아야 한다. 화면 상태만으로는
// "이미 같은 데이터였다"와 "요청이 나가지도 않았다"를 구분할 수 없다.
type RefreshOutcome = {
  status: 'loaded' | 'empty' | 'error' | 'skipped';
  asOf?: string;
};

const EMPTY_DATA: ModeData = { status: 'idle', snapshots: [] };
const EMPTY_SELECTION: ModeSelection = { episodeId: null, month: null };

function orderSnapshots(snapshots: DashboardSnapshot[]) {
  return snapshots.toSorted(
    (left, right) => right.month.localeCompare(left.month) || Date.parse(right.asOf) - Date.parse(left.asOf)
  );
}

function nextSelection(snapshots: DashboardSnapshot[], current: ModeSelection): ModeSelection {
  const episodeId = snapshots.some(snapshot => snapshot.episodeId === current.episodeId)
    ? current.episodeId
    : (snapshots[0]?.episodeId ?? null);
  const episodeSnapshots = snapshots.filter(snapshot => snapshot.episodeId === episodeId);
  const month = episodeSnapshots.some(snapshot => snapshot.month === current.month)
    ? current.month
    : (episodeSnapshots[0]?.month ?? null);
  return { episodeId, month };
}

function useDashboardController(client: DashboardClient) {
  const [mode, setMode] = useState<DashboardMode>('paper');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authRevision, setAuthRevision] = useState(0);
  const [dataByMode, setDataByMode] = useState<Record<DashboardMode, ModeData>>({
    paper: EMPTY_DATA,
    live: EMPTY_DATA,
  });
  const [selectionByMode, setSelectionByMode] = useState<Record<DashboardMode, ModeSelection>>({
    paper: EMPTY_SELECTION,
    live: EMPTY_SELECTION,
  });
  const modeRef = useRef(mode);
  // 새로고침 직후 토스트에 쓸 기준 시각을 뽑으려면 방금 고른 선택을 렌더 밖에서 읽어야 한다.
  const selectionRef = useRef(selectionByMode);
  selectionRef.current = selectionByMode;
  const requestRevision = useRef<Record<DashboardMode, number>>({ paper: 0, live: 0 });
  const requestControllers = useRef<Partial<Record<DashboardMode, AbortController>>>({});

  const invalidateRequest = useCallback((targetMode: DashboardMode) => {
    requestRevision.current[targetMode] += 1;
    requestControllers.current[targetMode]?.abort();
    delete requestControllers.current[targetMode];
  }, []);

  const clearLiveData = useCallback(() => {
    invalidateRequest('live');
    setDataByMode(current => ({ ...current, live: EMPTY_DATA }));
    setSelectionByMode(current => ({ ...current, live: EMPTY_SELECTION }));
  }, [invalidateRequest]);

  useEffect(() => {
    let active = true;
    let authGeneration = 0;
    const unsubscribe = client.onAuthStateChange((event, nextSession) => {
      authGeneration += 1;
      clearLiveData();
      setSession(nextSession);
      setAuthStatus(nextSession ? 'authenticated' : 'anonymous');
      setAuthRevision(revision => revision + 1);
      if (event === 'SIGNED_OUT') setSession(null);
    });
    const generation = authGeneration;

    void client
      .getSession()
      .then(nextSession => {
        if (!active || generation !== authGeneration) return;
        setSession(nextSession);
        setAuthStatus(nextSession ? 'authenticated' : 'anonymous');
      })
      .catch(() => {
        if (!active || generation !== authGeneration) return;
        clearLiveData();
        setSession(null);
        setAuthStatus('anonymous');
      });

    return () => {
      active = false;
      unsubscribe();
      invalidateRequest('paper');
      invalidateRequest('live');
    };
  }, [clearLiveData, client, invalidateRequest]);

  const loadSnapshots = useCallback(
    async (targetMode: DashboardMode): Promise<RefreshOutcome> => {
      if (document.visibilityState === 'hidden') return { status: 'skipped' };
      if (targetMode === 'live' && (!session || authStatus !== 'authenticated')) return { status: 'skipped' };

      invalidateRequest(targetMode);
      const revision = requestRevision.current[targetMode];
      const controller = new AbortController();
      requestControllers.current[targetMode] = controller;
      setDataByMode(current => ({
        ...current,
        [targetMode]: { ...current[targetMode], status: 'loading', message: undefined },
      }));

      try {
        const snapshots = orderSnapshots(await client.fetchSnapshots(targetMode, controller.signal));
        if (
          controller.signal.aborted ||
          revision !== requestRevision.current[targetMode] ||
          modeRef.current !== targetMode
        ) {
          return { status: 'skipped' };
        }
        setDataByMode(current => ({
          ...current,
          [targetMode]: { status: snapshots.length === 0 ? 'empty' : 'ready', snapshots },
        }));
        const selection = nextSelection(snapshots, selectionRef.current[targetMode]);
        setSelectionByMode(current => ({ ...current, [targetMode]: selection }));
        if (snapshots.length === 0) return { status: 'empty' };
        const selected = snapshots.find(
          snapshot => snapshot.episodeId === selection.episodeId && snapshot.month === selection.month
        );
        return { status: 'loaded', asOf: selected?.asOf };
      } catch (error) {
        if (
          controller.signal.aborted ||
          revision !== requestRevision.current[targetMode] ||
          modeRef.current !== targetMode
        ) {
          return { status: 'skipped' };
        }
        setDataByMode(current => ({
          ...current,
          [targetMode]: {
            status: 'error',
            snapshots: [],
            message: error instanceof Error ? error.message : '운용 내역을 불러오지 못했습니다.',
          },
        }));
        return { status: 'error' };
      } finally {
        if (requestControllers.current[targetMode] === controller) delete requestControllers.current[targetMode];
      }
    },
    [authStatus, client, invalidateRequest, session]
  );

  useEffect(() => {
    if (mode === 'paper' || authStatus !== 'loading') void loadSnapshots(mode);
  }, [authRevision, authStatus, loadSnapshots, mode]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadSnapshots(modeRef.current);
    }, 60_000);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        invalidateRequest(modeRef.current);
        return;
      }
      void loadSnapshots(modeRef.current);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [invalidateRequest, loadSnapshots]);

  const selectMode = useCallback(
    (nextMode: DashboardMode) => {
      if (nextMode === modeRef.current) return;
      invalidateRequest(modeRef.current);
      clearLiveData();
      modeRef.current = nextMode;
      setMode(nextMode);
    },
    [clearLiveData, invalidateRequest]
  );

  const selectEpisode = useCallback(
    (episodeId: string) => {
      const snapshots = dataByMode[mode].snapshots.filter(snapshot => snapshot.episodeId === episodeId);
      setSelectionByMode(current => ({
        ...current,
        [mode]: { episodeId, month: snapshots[0]?.month ?? null },
      }));
    },
    [dataByMode, mode]
  );

  const selectMonth = useCallback(
    (month: string) => {
      setSelectionByMode(current => ({ ...current, [mode]: { ...current[mode], month } }));
    },
    [mode]
  );

  const signOut = useCallback(async () => {
    clearLiveData();
    setSession(null);
    setAuthStatus('anonymous');
    await client.signOut();
  }, [clearLiveData, client]);

  const selection = selectionByMode[mode];
  const data = dataByMode[mode];
  const episodes = useMemo(() => {
    const labelByEpisodeId = new Map<string, string>();
    for (const snapshot of data.snapshots) {
      if (!labelByEpisodeId.has(snapshot.episodeId)) labelByEpisodeId.set(snapshot.episodeId, snapshot.label);
    }
    return Array.from(labelByEpisodeId, ([id, label]) => ({ id, label }));
  }, [data.snapshots]);
  const months = useMemo(
    () => data.snapshots.filter(snapshot => snapshot.episodeId === selection.episodeId).map(snapshot => snapshot.month),
    [data.snapshots, selection.episodeId]
  );
  const selectedSnapshot =
    data.snapshots.find(snapshot => snapshot.episodeId === selection.episodeId && snapshot.month === selection.month) ??
    null;

  return {
    mode,
    session,
    authStatus,
    data,
    episodes,
    months,
    selectedEpisodeId: selection.episodeId,
    selectedMonth: selection.month,
    selectedSnapshot,
    selectMode,
    selectEpisode,
    selectMonth,
    refresh: () => loadSnapshots(mode),
    requestMagicLink: (email: string) => client.requestMagicLink(email),
    signOut,
  };
}

export { useDashboardController, type AuthStatus, type DataStatus, type ModeData, type RefreshOutcome };
