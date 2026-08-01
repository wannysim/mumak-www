import * as React from 'react';

import { profileHoldFrames, type ShareFrameStream } from '@/lib/share/frames';
import type { QrEncodeRequest, QrEncodeResponse, QrMatrix } from '@/lib/share/qr-matrix';

export type ShareSendStats = {
  /** 마지막으로 표시한 풀 인덱스 */
  symbolIndex: number;
  /** 누적 표시 수 */
  displayedSymbols: number;
  /** 실측 화면 주사율 */
  displayFps: number;
  /** 실측 초당 심볼 수 */
  symbolsPerSecond: number;
  /** 실측 초당 바이트 = symbolsPerSecond * blockBytes */
  bytesPerSecond: number;
  /** 화면이 가려진 시간을 뺀 표시 경과 시간 */
  elapsedMs: number;
};

const IDLE_STATS: ShareSendStats = {
  symbolIndex: 0,
  displayedSymbols: 0,
  displayFps: 0,
  symbolsPerSecond: 0,
  bytesPerSecond: 0,
  elapsedMs: 0,
};

/** qrcode-generator는 Error가 아니라 문자열을 던진다. 워커 밖에서는 message가 비어 자체 문구가 필요하다. */
const ENCODE_FAILED = 'QR 이미지를 만들지 못했습니다. 더 느린 속도를 선택해 주세요.';
/** 실측 전 가정값. 첫 창이 차면 실측으로 바뀐다. */
const ASSUMED_DISPLAY_FPS = 60;
const FPS_WINDOW_FRAMES = 30;
/** 통계 리렌더가 표시 루프를 잡아먹지 않게 하는 간격 */
const STATS_INTERVAL_MS = 250;
const MAX_ENCODER_WORKERS = 3;
/** 워커 하나가 한 번에 굽는 심볼 수를 이 배수로 잘게 나눠 진행률이 계단으로 튀지 않게 한다. */
const BATCHES_PER_WORKER = 4;

function encoderCount(poolSize: number): number {
  const cores = navigator.hardwareConcurrency > 0 ? navigator.hardwareConcurrency : 2;
  return Math.max(1, Math.min(MAX_ENCODER_WORKERS, cores - 1, poolSize));
}

type BatchRunner = { run(request: QrEncodeRequest): Promise<QrEncodeResponse>; dispose(): void };

/**
 * ponytail: `Worker`가 없는 환경(jsdom 단위 테스트)에서는 워커와 똑같은 순수 함수를 메인 스레드에서 돌린다.
 * 동적 import라 `qrcode-generator` 21 KB가 메인 청크에서 빠져 별도 청크로 나간다. 브라우저에는 항상
 * Worker가 있으므로 그 청크는 실제로 내려받히지 않는다(프리캐시에는 남는다).
 * 천장: 메인 스레드 인코딩은 풀이 크면 UI를 멈춘다. 사용자 경로는 이 분기를 타지 않는다.
 * 업그레이드 경로: 테스트에 `@vitest/web-worker`를 넣으면 분기와 청크를 함께 지울 수 있다.
 */
function createRunner(): BatchRunner {
  if (typeof Worker === 'undefined') {
    return {
      run: async request => (await import('@/lib/share/qr-matrix')).encodeQrBatch(request),
      dispose: () => {},
    };
  }

  const worker = new Worker(new URL('../lib/share/qr-encoder.worker.ts', import.meta.url), { type: 'module' });
  // terminate()는 message도 error도 내지 않는다. 남은 약속을 여기서 깨지 않으면 형제 pump가 영원히
  // await한 채 구운 매트릭스를 붙잡는다.
  let abandon: (() => void) | null = null;
  return {
    run: request =>
      new Promise<QrEncodeResponse>((resolve, reject) => {
        const onMessage = (event: MessageEvent<QrEncodeResponse>) => {
          detach();
          resolve(event.data);
        };
        const onError = () => {
          detach();
          reject(new Error(ENCODE_FAILED));
        };
        function detach() {
          abandon = null;
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
        }
        abandon = onError;
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        // 메인 스레드에서 넘길 transferable은 없다. 빈 목록을 명시해 postMessage 오버로드를 고정한다.
        worker.postMessage(request, []);
      }),
    dispose: () => {
      abandon?.();
      worker.terminate();
    },
  };
}

/** 풀 전체를 인덱스 구간으로 쪼개 워커들이 먼저 비는 순서대로 가져가게 한다. */
async function encodePool(
  stream: ShareFrameStream,
  onProgress: (encoded: number) => void,
  cancelled: () => boolean
): Promise<QrMatrix[]> {
  const { profile, poolSize } = stream;
  const runners = Array.from({ length: encoderCount(poolSize) }, createRunner);
  const batchSize = Math.max(1, Math.ceil(poolSize / (runners.length * BATCHES_PER_WORKER)));
  const matrices: QrMatrix[] = [];
  let next = 0;
  let encoded = 0;

  const pump = async (runner: BatchRunner) => {
    while (next < poolSize && !cancelled()) {
      const startIndex = next;
      next = Math.min(poolSize, startIndex + batchSize);
      const frames = Array.from({ length: next - startIndex }, (_, offset) => stream.frameAt(startIndex + offset));
      const response = await runner.run({
        frames,
        startIndex,
        typeNumber: profile.typeNumber,
        level: profile.level,
      });
      response.bits.forEach((bits, offset) => {
        matrices[response.startIndex + offset] = { moduleCount: response.moduleCount, bits };
      });
      encoded += frames.length;
      onProgress(encoded);
    }
  };

  try {
    await Promise.all(runners.map(runner => pump(runner)));
  } finally {
    for (const runner of runners) runner.dispose();
  }
  return matrices;
}

/**
 * 사전 인코딩 → rAF 표시 펌프.
 *
 * 실시간 인코딩은 폰에서 불가능하므로(V25 한 장에 12ms, 폰은 3~5배) 풀을 먼저 다 굽고, 표시 루프는
 * 구운 비트셋을 넘기기만 한다. `hold`는 실측 주사율에서 유도하므로 120Hz 기기가 목표 심볼 수를
 * 두 배로 넘기지 않는다.
 */
export function useShareFrameStream(stream: ShareFrameStream | null): {
  /** 레인별 현재 매트릭스. 준비 전에는 빈 배열 */
  lanes: readonly (QrMatrix | null)[];
  /** 0..1. 사전 인코딩 진행률 */
  preparedRatio: number;
  ready: boolean;
  /** 사전 인코딩 실패 안내. 스펙에 없지만 없으면 진행률이 말없이 멈춘다. */
  error: string | null;
  stats: ShareSendStats;
} {
  const [lanes, setLanes] = React.useState<readonly (QrMatrix | null)[]>([]);
  const [preparedRatio, setPreparedRatio] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<ShareSendStats>(IDLE_STATS);
  const poolRef = React.useRef<QrMatrix[]>([]);

  React.useEffect(() => {
    setLanes([]);
    setPreparedRatio(0);
    setReady(false);
    setError(null);
    setStats(IDLE_STATS);
    poolRef.current = [];
    if (!stream) return;

    let cancelled = false;
    void encodePool(
      stream,
      encoded => {
        if (!cancelled) setPreparedRatio(encoded / stream.poolSize);
      },
      () => cancelled
    )
      .then(matrices => {
        if (cancelled) return;
        poolRef.current = matrices;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError(ENCODE_FAILED);
      });

    return () => {
      cancelled = true;
    };
  }, [stream]);

  React.useEffect(() => {
    if (!stream || !ready) return;
    const pool = poolRef.current;
    const { blockBytes, lanes: laneCount } = stream.profile;
    let shown: (QrMatrix | null)[] = Array.from({ length: laneCount }, () => null);
    setLanes(shown);
    let handle: number | null = null;
    let frameCount = 0;
    let cursor = 0;
    let displayed = 0;
    let displayFps = ASSUMED_DISPLAY_FPS;
    let windowFrames = 0;
    let windowStart = 0;
    let startedAt = 0;
    let pausedAt: number | null = null;
    let pausedMs = 0;
    let lastStatsAt = 0;

    const tick = (now: number) => {
      handle = requestAnimationFrame(tick);
      if (startedAt === 0) {
        startedAt = now;
        lastStatsAt = now;
      }

      // 창을 여는 프레임은 세지 않는다. 세면 N프레임에 N-1간격이라 실측 fps가 3%쯤 높게 나온다.
      if (windowStart === 0) {
        windowStart = now;
        windowFrames = 0;
      } else {
        windowFrames += 1;
        if (windowFrames >= FPS_WINDOW_FRAMES) {
          if (now > windowStart) displayFps = (windowFrames * 1000) / (now - windowStart);
          windowFrames = 0;
          windowStart = now;
        }
      }

      /**
       * 레인 l은 `frameCount % hold === l`에서 한 칸 넘어간다. hold는 실측 fps에서 나오므로 목표
       * 심볼 수가 지켜지고, 레인끼리 refresh가 겹치지 않아(엇갈림) 항상 한 레인은 안정돼 있다.
       * 두 레인이 하나의 cursor를 나눠 쓰므로 레인 0은 짝수, 레인 1은 홀수 인덱스를 표시한다
       * — `poolSizeFor`가 홀수를 보장해야 그 패리티가 한 바퀴마다 뒤집힌다.
       */
      const hold = profileHoldFrames(stream.profile, displayFps);
      const lane = frameCount % hold;
      if (lane < laneCount) {
        shown = shown.with(lane, pool[cursor % pool.length] ?? null);
        setLanes(shown);
        cursor += 1;
        displayed += 1;
      }
      frameCount += 1;

      if (now - lastStatsAt < STATS_INTERVAL_MS) return;
      lastStatsAt = now;
      const elapsedMs = now - startedAt - pausedMs;
      const symbolsPerSecond = elapsedMs > 0 ? (displayed * 1000) / elapsedMs : 0;
      setStats({
        symbolIndex: cursor === 0 ? 0 : (cursor - 1) % pool.length,
        displayedSymbols: displayed,
        displayFps,
        symbolsPerSecond,
        bytesPerSecond: symbolsPerSecond * blockBytes,
        elapsedMs,
      });
    };

    const pause = () => {
      if (handle === null) return;
      cancelAnimationFrame(handle);
      handle = null;
      // 멈춘 시간이 fps 창에 섞이면 재개 직후 hold가 1로 떨어진다. 창을 버리고 다시 연다.
      windowStart = 0;
      if (startedAt !== 0) pausedAt = performance.now();
    };

    const resume = () => {
      if (handle !== null) return;
      if (pausedAt !== null) {
        pausedMs += performance.now() - pausedAt;
        pausedAt = null;
      }
      handle = requestAnimationFrame(tick);
    };

    const onVisibilityChange = () => (document.hidden ? pause() : resume());
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (!document.hidden) resume();

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      pause();
    };
  }, [ready, stream]);

  return { lanes, preparedRatio, ready, error, stats };
}
