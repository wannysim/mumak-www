import * as React from 'react';

import type { KaraokeShareBundle } from '@/lib/share/bundle';
import { ShareFrameCollector, shareProfileByCode } from '@/lib/share/frames';
import { startScanLoop, type ScanLoop } from '@/lib/share/scan-loop';

export type ShareReceiveStats = {
  rank: number;
  blockCount: number;
  objectBytes: number;
  /** 실측 초당 디코드 심볼 수 */
  scansPerSecond: number;
  /** 실측 초당 복원 바이트 = rank 증가 속도 * blockBytes */
  bytesPerSecond: number;
  droppedSymbols: number;
  etaSeconds: number | null;
  /** 첫 디코드부터의 경과 시간. 카메라를 켜 두고 겨누지 않은 시간은 세지 않는다. */
  elapsedMs: number;
};

const IDLE_STATS: ShareReceiveStats = {
  rank: 0,
  blockCount: 0,
  objectBytes: 0,
  scansPerSecond: 0,
  bytesPerSecond: 0,
  droppedSymbols: 0,
  etaSeconds: null,
  elapsedMs: 0,
};

const STATS_INTERVAL_MS = 250;
const CAMERA_DENIED = '카메라 권한이 필요합니다. 브라우저 설정에서 허용한 뒤 다시 시도해 주세요.';
const CAMERA_UNAVAILABLE = '이 브라우저에서는 카메라를 쓸 수 없습니다. 공유 파일을 이용해 주세요.';
const CAMERA_FAILED = '카메라를 시작하지 못했습니다.';
const READ_FAILED = 'QR 데이터를 읽지 못했습니다.';

/** focusMode는 아직 표준 MediaTrackConstraintSet에 없다(Image Capture 확장). */
const CONTINUOUS_FOCUS = { focusMode: 'continuous' } as unknown as MediaTrackConstraintSet;

/** 전부 ideal이라 약한 카메라에서도 실패하지 않고 기기 능력만큼만 얻는다. */
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: 'environment',
    width: { ideal: 3840 },
    height: { ideal: 2160 },
    frameRate: { ideal: 60 },
    advanced: [CONTINUOUS_FOCUS],
  },
};

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

/** 카메라 수명주기 + `scan-loop` + 수집 통계. */
export function useShareScanner({
  active,
  onComplete,
  onError,
}: {
  active: boolean;
  onComplete: (bundle: KaraokeShareBundle) => void;
  onError: (message: string) => void;
}): {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  starting: boolean;
  scanning: boolean;
  decoding: boolean;
  stats: ShareReceiveStats;
  start: () => Promise<void>;
  /** 카메라를 끄고 모은 조각까지 버린다. 스캔 화면의 유일한 복구 조작이다. */
  reset: () => void;
} {
  const [starting, setStarting] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [decoding, setDecoding] = React.useState(false);
  const [stats, setStats] = React.useState<ShareReceiveStats>(IDLE_STATS);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const loopRef = React.useRef<ScanLoop | null>(null);
  const collectorRef = React.useRef(new ShareFrameCollector());
  const decodingRef = React.useRef(false);
  const startingRef = React.useRef(false);
  const requestRef = React.useRef(0);
  // startedAt은 첫 디코드 시각이다. performance.now()가 0일 수 있으므로 null을 미시작 표시로 쓴다.
  const metricsRef = React.useRef<{ startedAt: number | null; decoded: number; lastFlushAt: number }>({
    startedAt: null,
    decoded: 0,
    lastFlushAt: 0,
  });

  // 스캔 루프는 start() 시점의 클로저를 오래 붙잡고 있다. 콜백만 ref로 최신화해 stale 호출을 막는다.
  const callbacks = React.useRef({ onComplete, onError });
  React.useEffect(() => {
    callbacks.current = { onComplete, onError };
  });

  const stop = React.useCallback(() => {
    requestRef.current += 1;
    startingRef.current = false;
    loopRef.current?.stop();
    loopRef.current = null;
    if (streamRef.current) {
      stopTracks(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStarting(false);
    setScanning(false);
  }, []);

  const reset = React.useCallback(() => {
    stop();
    collectorRef.current.reset();
    decodingRef.current = false;
    metricsRef.current = { startedAt: null, decoded: 0, lastFlushAt: 0 };
    setDecoding(false);
    setStats(IDLE_STATS);
  }, [stop]);

  const start = React.useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    const requestId = ++requestRef.current;
    setStarting(true);

    const flushStats = (force: boolean) => {
      const metrics = metricsRef.current;
      const now = performance.now();
      if (!force && now - metrics.lastFlushAt < STATS_INTERVAL_MS) return;
      metrics.lastFlushAt = now;

      const progress = collectorRef.current.progress;
      const elapsedMs = metrics.startedAt === null ? 0 : now - metrics.startedAt;
      const seconds = elapsedMs / 1000;
      const blocksPerSecond = seconds > 0 ? progress.rank / seconds : 0;
      const blockBytes = progress.blockCount > 0 ? progress.objectBytes / progress.blockCount : 0;
      const remaining = progress.blockCount - progress.rank;
      setStats({
        rank: progress.rank,
        blockCount: progress.blockCount,
        objectBytes: progress.objectBytes,
        scansPerSecond: seconds > 0 ? metrics.decoded / seconds : 0,
        bytesPerSecond: blocksPerSecond * blockBytes,
        droppedSymbols: progress.droppedSymbols,
        etaSeconds: blocksPerSecond > 0 && remaining > 0 ? remaining / blocksPerSecond : null,
        elapsedMs,
      });
    };

    const fail = (error: unknown, fallback: string) => {
      reset();
      callbacks.current.onError(error instanceof Error ? error.message : fallback);
    };

    // 스캔 루프는 onSymbol을 라운드 안에서 동기로 부른다. 여기서 throw하면 라운드가 통째로 깨지므로 반드시 잡는다.
    const handleSymbol = (text: string) => {
      if (decodingRef.current) return;
      let complete = false;
      try {
        complete = collectorRef.current.add(text).complete;
      } catch (error) {
        fail(error, READ_FAILED);
        return;
      }
      if (!complete) return;

      decodingRef.current = true;
      stop();
      setDecoding(true);
      flushStats(true);
      void collectorRef.current
        .decode()
        .then(bundle => {
          setDecoding(false);
          callbacks.current.onComplete(bundle);
        })
        .catch((error: unknown) => {
          fail(error, READ_FAILED);
        });
    };

    try {
      const video = videoRef.current;
      if (!video) throw new Error('카메라 화면을 준비하지 못했습니다.');
      if (typeof navigator.mediaDevices?.getUserMedia !== 'function') throw new Error(CAMERA_UNAVAILABLE);

      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      if (requestId !== requestRef.current) {
        stopTracks(stream);
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      // muted + playsInline이라 자동재생 정책에 걸리지 않는다. 막히더라도 루프가 videoWidth를 기다린다.
      try {
        await video.play();
      } catch {
        /* 자동재생 차단은 스캔을 막지 않는다 */
      }
      if (requestId !== requestRef.current) return;

      loopRef.current = startScanLoop({
        video,
        // 매 라운드 다시 읽는다. latch하지 않으므로 보내는 쪽이 프로파일을 바꿔도 다음 라운드에 따라간다.
        // MK3 프레임을 아직 못 받았으면 `null`("모른다")이다. 1로 내려 잡으면 스캔 루프가 회전
        // 스케줄을 끄고 전체 프레임만 보게 되어 2레인 송신을 영영 못 읽는다.
        getLaneCount: () => shareProfileByCode(collectorRef.current.progress.profileCode ?? '')?.lanes ?? null,
        onSymbol: handleSymbol,
        onScanTick: decodedCount => {
          const metrics = metricsRef.current;
          if (decodedCount > 0) {
            metrics.startedAt ??= performance.now();
            metrics.decoded += decodedCount;
          }
          flushStats(false);
        },
      });
      setScanning(true);
    } catch (error) {
      stop();
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      callbacks.current.onError(denied ? CAMERA_DENIED : error instanceof Error ? error.message : CAMERA_FAILED);
    } finally {
      startingRef.current = false;
      if (requestId === requestRef.current) setStarting(false);
    }
  }, [reset, stop]);

  React.useEffect(() => {
    if (!active) stop();
  }, [active, stop]);

  React.useEffect(() => {
    const stopWhenHidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      document.removeEventListener('visibilitychange', stopWhenHidden);
      stop();
    };
  }, [stop]);

  return { videoRef, starting, scanning, decoding, stats, start, reset };
}
