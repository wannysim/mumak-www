import { useEffect, useState } from 'react';

interface UseProgressInterpolationOptions {
  trackId: string | null;
  progressMs: number | null;
  durationMs: number | null;
  isPlaying: boolean;
  /** 폴링 응답 수신 시각 (ms epoch). 동일 trackId라도 이 값이 변하면 보간 기준을 재설정. */
  fetchedAt: number;
  /** 보간 갱신 주기 (ms). 기본 1000. */
  tickIntervalMs?: number;
  /** 현재 시간 ms epoch 공급자 (테스트용). 기본 Date.now. */
  now?: () => number;
}

interface UseProgressInterpolationReturn {
  /** 보간된 현재 재생 위치 (ms). progress/duration이 없으면 null. */
  progressMs: number | null;
  /** duration_ms (편의 재노출). */
  durationMs: number | null;
}

interface Baseline {
  trackId: string;
  progressMs: number;
  fetchedAt: number;
}

const DEFAULT_TICK_MS = 1000;
/**
 * 새 폴 응답이 보간 예측값과 이 임계치 안에서 다르면 "정상 drift" 로 간주하고 UI 를 흔들지 않는다.
 * Spotify 의 progress_ms 는 100~500ms 정도의 lag/jitter 가 있어, 매 폴마다 raw 값으로 baseline 을
 * 다시 찍으면 작은 후진 점프가 시각적으로 보인다 (43→44→43→44). seek/track 변경처럼 진짜 큰
 * 차이가 날 때만 visible reset.
 */
const DRIFT_TOLERANCE_MS = 2000;

/**
 * 서버에서 받은 progress_ms 를 클라이언트에서 부드럽게 보간한다.
 * - 상태는 baseline(트랙·기준 진행도·수신 시각)과 마지막 tick 시각뿐이고,
 *   표시 값은 둘에서 render 중에 파생된다 (별도 보간 상태 없음)
 * - baseline 조정은 useEffect 가 아니라 render 중 prev 비교로 수행해
 *   조정 전 값으로 한 프레임을 먼저 그리는 일이 없다
 * - 재생 중이면 매 tick(기본 1초)마다 tick 시각만 갱신해 재계산을 유발
 * - duration 을 초과하지 않도록 clamp
 * - 일시정지/null progress 인 경우 보간 중단 (서버 값을 그대로 노출)
 * - trackId 가 바뀌거나 progress 가 예측값과 크게 다를 때(seek)만 baseline 을 visible reset
 */
export function useProgressInterpolation({
  trackId,
  progressMs,
  durationMs,
  isPlaying,
  fetchedAt,
  tickIntervalMs = DEFAULT_TICK_MS,
  now = Date.now,
}: UseProgressInterpolationOptions): UseProgressInterpolationReturn {
  const [baseline, setBaseline] = useState<Baseline | null>(
    progressMs != null && trackId != null ? { trackId, progressMs, fetchedAt } : null
  );
  const [tickNow, setTickNow] = useState(() => now());

  if (progressMs == null || trackId == null) {
    if (baseline !== null) setBaseline(null);
  } else if (baseline == null || baseline.trackId !== trackId) {
    // 새 트랙: baseline reset. tick 시각도 갱신해 lag(now-fetchedAt) 보정이 즉시 반영되게 한다.
    setBaseline({ trackId, progressMs, fetchedAt });
    setTickNow(now());
  } else {
    const interpolatedAtFetch = baseline.progressMs + Math.max(0, fetchedAt - baseline.fetchedAt);
    const drift = Math.abs(progressMs - interpolatedAtFetch);
    if (drift >= DRIFT_TOLERANCE_MS) {
      // seek 등 진짜 점프만 visible reset. tolerance 안의 drift 는 baseline 을 흔들지 않아
      // 작은 후진 점프가 UI 에 보이지 않는다.
      setBaseline({ trackId, progressMs, fetchedAt });
      setTickNow(now());
    }
  }

  useEffect(() => {
    if (!isPlaying || trackId == null) return;

    const id = setInterval(() => setTickNow(now()), tickIntervalMs);
    return () => clearInterval(id);
  }, [isPlaying, trackId, tickIntervalMs, now]);

  const interpolated = (() => {
    if (progressMs == null) return null;
    if (!isPlaying) return clampProgress(progressMs, durationMs);
    if (baseline == null || baseline.trackId !== trackId) return clampProgress(progressMs, durationMs);
    const elapsed = Math.max(0, tickNow - baseline.fetchedAt);
    return clampProgress(baseline.progressMs + elapsed, durationMs);
  })();

  return { progressMs: interpolated, durationMs };
}

function clampProgress(value: number, durationMs: number | null): number {
  if (durationMs == null || durationMs <= 0) return Math.max(0, value);
  return Math.min(Math.max(0, value), durationMs);
}
