import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useShareFrameStream } from '../hooks/use-share-frame-stream';
import { shareProfile, type ShareFrameStream, type ShareProfileId } from '../lib/share/frames';
import {
  encodeQrBatch,
  encodeQrMatrix,
  type QrEncodeRequest,
  type QrEncodeResponse,
  type QrMatrix,
} from '../lib/share/qr-matrix';

type FrameCallback = (time: number) => void;

const FRAME_60HZ = 1000 / 60;
const FRAME_120HZ = 1000 / 120;

let pendingFrames = new Map<number, FrameCallback>();
let nextFrameHandle = 1;
let clock = 0;

/**
 * 실제 프레임 문자열 대신 짧은 alphanumeric 문자열과 낮은 QR 버전을 쓴다. 이 훅이 검증할 것은 펌프의
 * 타이밍이지 와이어 포맷이 아니고, V40 174장을 진짜로 굽는 데는 몇 초가 걸린다.
 */
function fakeStream(id: ShareProfileId, poolSize: number, frameAt = (index: number) => `MK3 POOL ${index}`) {
  const profile = { ...shareProfile(id), typeNumber: 4 };
  return {
    profile,
    id: 'ABCDEF01',
    blockCount: poolSize - 8,
    payloadBytes: 128,
    objectBytes: 128,
    poolSize,
    frameAt,
  } satisfies ShareFrameStream;
}

/** 프레임마다 act를 새로 연다. 한 act 안에서 60프레임을 돌리면 React가 전부 묶어 리렌더 한 번으로 만든다. */
async function advanceFrames(count: number, stepMs: number) {
  for (let index = 0; index < count; index += 1) {
    clock += stepMs;
    const due = [...pendingFrames.values()];
    pendingFrames.clear();
    await act(async () => {
      for (const callback of due) callback(clock);
    });
  }
}

type Lanes = readonly (QrMatrix | null)[];

/** 레인 배열은 심볼이 넘어갈 때만 새 참조가 된다. 통계만 갱신된 리렌더는 세지 않는다. */
function symbolChanges(seen: Lanes[]): Lanes[] {
  return seen.filter((lanes, index) => index === 0 || lanes !== seen[index - 1]);
}

/** 갱신마다 어느 레인이 넘어갔는지. 2레인이 엇갈리는지 보려면 라운드가 아니라 레인 단위로 봐야 한다. */
function laneAdvances(seen: Lanes[]): { lane: number; matrix: QrMatrix | null }[] {
  const advances: { lane: number; matrix: QrMatrix | null }[] = [];
  for (let index = 1; index < seen.length; index += 1) {
    const previous = seen[index - 1]!;
    const current = seen[index]!;
    if (current === previous) continue;
    current.forEach((matrix, lane) => {
      if (matrix !== previous[lane]) advances.push({ lane, matrix });
    });
  }
  return advances;
}

function renderStream(stream: ShareFrameStream | null) {
  const seen: Lanes[] = [];
  const view = renderHook(() => {
    const value = useShareFrameStream(stream);
    seen.push(value.lanes);
    return value;
  });
  return { ...view, seen };
}

async function renderReadyStream(stream: ShareFrameStream) {
  const view = renderStream(stream);
  await waitFor(() => expect(view.result.current.ready).toBe(true));
  view.seen.length = 0;
  return view;
}

beforeEach(() => {
  pendingFrames = new Map();
  nextFrameHandle = 1;
  clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameCallback) => {
    const handle = nextFrameHandle++;
    pendingFrames.set(handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => {
    pendingFrames.delete(handle);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useShareFrameStream', () => {
  it('stays idle without a stream', () => {
    const { result } = renderStream(null);

    expect(result.current).toMatchObject({ ready: false, preparedRatio: 0, error: null, lanes: [] });
    expect(pendingFrames.size).toBe(0);
  });

  it('bakes the whole pool before the first symbol is displayed', async () => {
    const { result } = renderStream(fakeStream('safe', 12));

    expect(result.current.ready).toBe(false);
    expect(result.current.lanes).toEqual([]);
    // 풀이 다 구워지기 전에는 표시 루프를 아예 걸지 않는다.
    expect(pendingFrames.size).toBe(0);

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.preparedRatio).toBe(1);
    expect(pendingFrames.size).toBe(1);
  });

  it('advances one symbol every hold frame derived from the measured display fps', async () => {
    // safe = 초당 10심볼. 60Hz에서 hold = 6이므로 1초에 10번 넘어간다.
    const { result, seen } = await renderReadyStream(fakeStream('safe', 12));

    await advanceFrames(60, FRAME_60HZ);

    expect(symbolChanges(seen)).toHaveLength(10);
    expect(result.current.stats.displayFps).toBeCloseTo(60, 0);
    expect(result.current.stats.symbolsPerSecond).toBeGreaterThan(8);
    expect(result.current.stats.bytesPerSecond).toBeCloseTo(
      result.current.stats.symbolsPerSecond * shareProfile('safe').blockBytes,
      5
    );
  });

  it('halves the symbol rate per refresh on a 120Hz display so the target rate holds', async () => {
    const { seen } = await renderReadyStream(fakeStream('fast', 32));

    // 첫 창(30프레임)이 차야 실측 fps가 60 가정을 대체한다.
    await advanceFrames(60, FRAME_120HZ);
    seen.length = 0;
    await advanceFrames(60, FRAME_120HZ);

    // hold가 3에서 6으로 올라가 60프레임(500ms) 동안 20번이 아니라 10번만 넘어간다.
    expect(symbolChanges(seen)).toHaveLength(10);
  });

  it('staggers two lanes over one shared cursor so lane 0 takes even and lane 1 odd pool indices', async () => {
    // max = 초당 60심볼 / 2레인. 60Hz에서 hold = 2라 매 refresh마다 한 레인씩 엇갈려 넘어간다.
    const poolSize = 11;
    const { result, seen } = await renderReadyStream(fakeStream('max', poolSize));
    const indexOfMatrix = new Map(
      Array.from({ length: poolSize }, (_, index) => [encodeQrMatrix(`MK3 POOL ${index}`, 4, 'L').bits.join(), index])
    );

    await advanceFrames(60, FRAME_60HZ);

    expect(result.current.lanes).toHaveLength(2);
    // renderReadyStream이 준비 직후 렌더를 버리므로 첫 갱신의 기준선(양쪽 모두 빈 상태)을 되돌려 준다.
    const advances = laneAdvances([[null, null], ...seen]);
    // 두 레인이 같은 refresh에 바뀌면 카메라가 두 장 다 흐릿한 순간을 잡는다. 항상 엇갈려야 한다.
    expect(advances.map(advance => advance.lane).slice(0, 8)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    // 두 레인 합산이 목표 60장/s다. 통계는 250ms마다 흘리므로 마지막 창까지만 반영된다.
    expect(advances).toHaveLength(60);
    expect(result.current.stats.symbolsPerSecond).toBeGreaterThan(55);

    const poolIndexes = (lane: number) =>
      advances.filter(advance => advance.lane === lane).map(advance => indexOfMatrix.get(advance.matrix!.bits.join()));
    // 공유 cursor를 한 칸씩 올리므로 레인 0은 짝수 cursor, 레인 1은 홀수 cursor를 받는다.
    expect(poolIndexes(0).slice(0, 6)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(poolIndexes(1).slice(0, 6)).toEqual([1, 3, 5, 7, 9, 0]);
    // poolSize가 홀수라 한 바퀴마다 패리티가 뒤집힌다. 한쪽 레인만 보이는 수신도 결국 전부 본다.
    expect(new Set(poolIndexes(0)).size).toBe(poolSize);
  });

  it('pauses while the document is hidden and does not count the pause as elapsed time', async () => {
    const { result, seen } = await renderReadyStream(fakeStream('safe', 12));
    await advanceFrames(30, FRAME_60HZ);
    const displayedBeforeHiding = result.current.stats.displayedSymbols;
    expect(displayedBeforeHiding).toBeGreaterThan(0);

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    seen.length = 0;
    clock += 10_000;
    await advanceFrames(30, FRAME_60HZ);
    expect(symbolChanges(seen)).toHaveLength(0);

    hidden.mockReturnValue(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    await advanceFrames(30, FRAME_60HZ);

    expect(result.current.stats.displayedSymbols).toBeGreaterThan(displayedBeforeHiding);
    // 숨긴 동안 흐른 10초는 빠져야 한다. 안 빼면 실측 심볼/초가 10배 낮게 보인다.
    expect(result.current.stats.elapsedMs).toBeLessThan(1200);
  });

  it('reports an encoder failure instead of freezing at a partial ratio', async () => {
    // qrcode-generator는 alphanumeric 문자셋 밖의 글자에 문자열을 던진다(Error가 아니다).
    const { result } = renderStream(fakeStream('safe', 12, index => `mk3 pool ${index}`));

    await waitFor(() => expect(result.current.error).toMatch(/더 느린 속도를 선택해 주세요/u));
    expect(result.current.ready).toBe(false);
  });

  it('encodes through workers when the platform has them and terminates them afterwards', async () => {
    const workers = installFakeWorker();
    const { result } = renderStream(fakeStream('safe', 12));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(workers.length).toBeGreaterThan(0);
    expect(workers[0]!.options).toEqual({ type: 'module' });
    expect(workers.every(worker => worker.terminated)).toBe(true);
    // 풀을 워커당 한 덩어리로 굽지 않는다. 한 덩어리면 진행률이 0에서 1로 한 번에 튄다.
    const batches = workers.reduce((total, worker) => total + worker.batches, 0);
    expect(batches).toBeGreaterThan(workers.length);
  });

  it('surfaces a worker error event, which carries no usable message of its own', async () => {
    installFakeWorker({ failing: true });
    const { result } = renderStream(fakeStream('safe', 12));

    await waitFor(() => expect(result.current.error).toMatch(/QR 이미지를 만들지 못했습니다/u));
  });
});

type FakeWorkerRecord = { options: WorkerOptions | undefined; terminated: boolean; batches: number };

/** Vite가 워커 URL을 어떻게 바꿔 쓰든 생성자만 가로챈다. 배관 계약(transfer 없이 message/error)만 흉내낸다. */
function installFakeWorker({ failing = false } = {}): FakeWorkerRecord[] {
  const records: FakeWorkerRecord[] = [];

  class FakeWorker {
    private readonly listeners = new Map<string, Set<(event: unknown) => void>>();
    private readonly record: FakeWorkerRecord;

    constructor(_url: string | URL, options?: WorkerOptions) {
      this.record = { options, terminated: false, batches: 0 };
      records.push(this.record);
    }

    addEventListener(type: string, listener: (event: unknown) => void) {
      const bucket = this.listeners.get(type) ?? new Set();
      bucket.add(listener);
      this.listeners.set(type, bucket);
    }

    removeEventListener(type: string, listener: (event: unknown) => void) {
      this.listeners.get(type)?.delete(listener);
    }

    postMessage(request: QrEncodeRequest) {
      this.record.batches += 1;
      const response: QrEncodeResponse | null = failing ? null : encodeQrBatch(request);
      queueMicrotask(() => {
        for (const listener of this.listeners.get(response ? 'message' : 'error') ?? []) {
          listener(response ? { data: response } : new Event('error'));
        }
      });
    }

    terminate() {
      this.record.terminated = true;
    }
  }

  vi.stubGlobal('Worker', FakeWorker);
  return records;
}
