import { useEffect, useRef, useState } from 'react';

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

const DEFAULT_TICK_MS = 1000;

/**
 * 서버에서 받은 progress_ms 를 클라이언트에서 부드럽게 보간한다.
 * - 재생 중이면 매 tick(기본 1초)마다 (now - fetchedAt) 만큼 더해서 진행
 * - duration 을 초과하지 않도록 clamp
 * - 일시정지/null progress 인 경우 보간 중단 (서버 값을 그대로 노출)
 * - trackId 또는 fetchedAt 이 변하면 보간 기준을 새 값으로 리셋
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
  const baselineRef = useRef<{ trackId: string | null; progressMs: number; fetchedAt: number } | null>(
    progressMs != null && trackId != null ? { trackId, progressMs, fetchedAt } : null
  );

  const computeProgress = () => {
    if (progressMs == null) return null;
    if (!isPlaying) return clampProgress(progressMs, durationMs);
    const baseline = baselineRef.current;
    if (!baseline || baseline.trackId !== trackId) {
      return clampProgress(progressMs, durationMs);
    }
    const elapsed = Math.max(0, now() - baseline.fetchedAt);
    return clampProgress(baseline.progressMs + elapsed, durationMs);
  };

  const [interpolated, setInterpolated] = useState<number | null>(computeProgress);

  useEffect(() => {
    if (progressMs == null || trackId == null) {
      baselineRef.current = null;
      setInterpolated(null);
      return;
    }
    baselineRef.current = { trackId, progressMs, fetchedAt };
    setInterpolated(clampProgress(progressMs, durationMs));
  }, [trackId, progressMs, fetchedAt, durationMs]);

  useEffect(() => {
    if (!isPlaying || progressMs == null || trackId == null) return;

    const tick = () => {
      const baseline = baselineRef.current;
      if (!baseline) return;
      const elapsed = Math.max(0, now() - baseline.fetchedAt);
      setInterpolated(clampProgress(baseline.progressMs + elapsed, durationMs));
    };

    const id = setInterval(tick, tickIntervalMs);
    return () => clearInterval(id);
  }, [isPlaying, trackId, progressMs, durationMs, tickIntervalMs, now]);

  return { progressMs: interpolated, durationMs };
}

function clampProgress(value: number, durationMs: number | null): number {
  if (durationMs == null || durationMs <= 0) return Math.max(0, value);
  return Math.min(Math.max(0, value), durationMs);
}
