import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startScanLoop, type ScanLoopOptions } from '../lib/share/scan-loop';

const qr = vi.hoisted(() => ({
  createQrEngine: vi.fn(),
  scanImage: vi.fn(),
}));

vi.mock('qr-scanner', () => ({ default: qr }));

const FRAME_METADATA: VideoFrameCallbackMetadata = {
  expectedDisplayTime: 0,
  height: 0,
  mediaTime: 0,
  presentationTime: 0,
  presentedFrames: 0,
  width: 0,
};

/** rAF 대체용. 실제 타이머에 의존하지 않고 테스트가 프레임을 하나씩 밀어 준다. */
const animationFrames: FrameRequestCallback[] = [];
const cancelAnimationFrameSpy = vi.fn();

function createVideo(width: number, height: number): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'videoWidth', { value: width, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: height, configurable: true });
  return video;
}

/** jsdom에는 requestVideoFrameCallback이 없으므로 필요한 테스트에서만 심는다. */
function withFrameCallback(video: HTMLVideoElement) {
  const callbacks: VideoFrameRequestCallback[] = [];
  const cancel = vi.fn();
  let handle = 0;
  video.requestVideoFrameCallback = callback => {
    callbacks.push(callback);
    handle += 1;
    return handle;
  };
  video.cancelVideoFrameCallback = cancel;
  return {
    cancel,
    pending: () => callbacks.length,
    tick() {
      const callback = callbacks.shift();
      if (!callback) throw new Error('예약된 video frame callback이 없습니다.');
      callback(0, FRAME_METADATA);
    },
  };
}

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function startLoop(video: HTMLVideoElement, overrides: Partial<ScanLoopOptions> = {}) {
  return startScanLoop({ video, getLaneCount: () => 1, onSymbol: vi.fn(), onScanTick: vi.fn(), ...overrides });
}

function deferred() {
  let resolveWith: (value: { data: string; cornerPoints: [] }) => void = () => {};
  const promise = new Promise<{ data: string; cornerPoints: [] }>(resolve => {
    resolveWith = resolve;
  });
  return { promise, resolve: resolveWith };
}

function scanRegionOf(call: number): Record<string, number> {
  return qr.scanImage.mock.calls[call]?.[1].scanRegion;
}

/** 한 라운드에서 던진 영역들. 회전 스케줄은 라운드 단위로 검증해야 의미가 있다. */
function scanRegionsSince(start: number): Record<string, number>[] {
  return qr.scanImage.mock.calls.slice(start).map(call => call[1].scanRegion);
}

describe('startScanLoop', () => {
  beforeEach(() => {
    qr.createQrEngine.mockImplementation(() => Promise.resolve({ terminate: vi.fn() }));
    qr.scanImage.mockResolvedValue({ data: 'MK3:M0000000A:1:0:PAYLOAD', cornerPoints: [] });
    animationFrames.length = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('scans the whole frame at native resolution', async () => {
    const video = createVideo(1280, 720);
    const frames = withFrameCallback(video);
    const loop = startLoop(video);

    frames.tick();
    await flush();

    expect(qr.scanImage).toHaveBeenCalledTimes(1);
    // 짧은 축(720)이 상한 1200보다 작으므로 리샘플링하지 않는다.
    // 비정수 축소는 특정 심볼에서 jsQR을 결정적으로 실패시킨다(광학 루프백 실측).
    expect(scanRegionOf(0)).toMatchObject({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      downScaledWidth: 1280,
      downScaledHeight: 720,
    });

    loop.stop();
  });

  it('caps a 4K frame on its short axis while keeping the aspect ratio', async () => {
    const video = createVideo(3840, 2160);
    const frames = withFrameCallback(video);
    const loop = startLoop(video);

    frames.tick();
    await flush();

    // 비등방 축소는 모듈을 직사각형으로 만들어 디코드를 깨뜨린다. 2160 -> 1200이면 3840 -> 2133이다.
    expect(scanRegionOf(0)).toMatchObject({ downScaledWidth: 2133, downScaledHeight: 1200 });

    loop.stop();
  });

  it('rotates the region schedule every round instead of picking a split axis', async () => {
    // 가로 카메라 프레임 + 세로로 쌓인 2레인. 종횡비로 축을 고르던 예전 설계는 여기서 좌우로 잘라
    // 두 코드를 반씩 물었고, 한 번 그 상태가 되면 영원히 0장이었다. 축을 고르지 않는 것이 정답이다.
    const video = createVideo(3840, 2160);
    const frames = withFrameCallback(video);
    // 스캔이 계속 실패해도 스케줄이 돌아야 한다. 성공하면 부트스트랩이 꺼져 조건이 섞인다.
    qr.scanImage.mockRejectedValue(new Error('No QR code found'));
    const loop = startLoop(video, { getLaneCount: () => 2 });

    const rounds: Record<string, number>[][] = [];
    for (let round = 0; round < 4; round += 1) {
      const before = qr.scanImage.mock.calls.length;
      frames.tick();
      await flush();
      rounds.push(scanRegionsSince(before));
    }

    // phase 0: 전체 프레임 — 한쪽 레인만 카메라에 들어온 수신도 여기서 잡힌다.
    expect(rounds[0]).toMatchObject([{ x: 0, y: 0, width: 3840, height: 2160 }]);
    // phase 1: 위/아래 — 화면 그대로의 배치
    expect(rounds[1]).toMatchObject([
      { x: 0, y: 0, width: 3840, height: 1080 },
      { x: 0, y: 1080, width: 3840, height: 1080 },
    ]);
    // phase 2: 좌/우 — 카메라를 90도 돌려 든 경우
    expect(rounds[2]).toMatchObject([
      { x: 0, y: 0, width: 1920, height: 2160 },
      { x: 1920, y: 0, width: 1920, height: 2160 },
    ]);
    expect(rounds[3]).toEqual(rounds[0]);

    loop.stop();
  });

  it('gives each region of a round its own engine and canvas', async () => {
    const video = createVideo(1000, 1000);
    const frames = withFrameCallback(video);
    qr.scanImage.mockRejectedValue(new Error('No QR code found'));
    const loop = startLoop(video, { getLaneCount: () => 2 });

    frames.tick();
    await flush();
    frames.tick();
    await flush();

    // 워커 하나에 두 스캔을 동시에 던지면 응답이 엇갈리고, 캔버스를 공유하면 픽셀이 겹친다.
    expect(qr.scanImage).toHaveBeenCalledTimes(3);
    expect(qr.scanImage.mock.calls[2]?.[1].qrEngine).not.toBe(qr.scanImage.mock.calls[1]?.[1].qrEngine);
    expect(qr.scanImage.mock.calls[2]?.[1].canvas).not.toBe(qr.scanImage.mock.calls[1]?.[1].canvas);
    // 슬롯은 재사용한다. 회전 스케줄의 최대 영역 수가 2라 엔진도 2개를 넘지 않는다.
    expect(qr.createQrEngine).toHaveBeenCalledTimes(2);
    expect(qr.scanImage.mock.calls[1]?.[1].qrEngine).toBe(qr.scanImage.mock.calls[0]?.[1].qrEngine);

    loop.stop();
  });

  it('runs the rotation while the lane count is unknown and settles on the whole frame for a single lane', async () => {
    const video = createVideo(1000, 1000);
    const frames = withFrameCallback(video);
    qr.scanImage.mockRejectedValueOnce(new Error('No QR code found'));
    let laneCount: 1 | 2 | null = null;
    const loop = startLoop(video, { getLaneCount: () => laneCount });

    // 아직 MK3 프레임을 못 받았으면 레인 수를 모른다. 전체 프레임으로 시작하되 회전을 함께 돌린다.
    frames.tick();
    await flush();
    expect(qr.scanImage).toHaveBeenCalledTimes(1);

    const unknownRound = qr.scanImage.mock.calls.length;
    frames.tick();
    await flush();
    expect(scanRegionsSince(unknownRound)).toHaveLength(2);

    // 단일 레인으로 확인되면 전체 프레임 1영역으로 돌아간다. 회전을 끄는 유일한 조건이다.
    laneCount = 1;
    const settledRound = qr.scanImage.mock.calls.length;
    frames.tick();
    await flush();
    expect(scanRegionsSince(settledRound)).toMatchObject([{ x: 0, y: 0, width: 1000, height: 1000 }]);

    loop.stop();
  });

  it('keeps rotating after a foreign QR decodes while the lane count is still unknown', async () => {
    // 낯선 QR이 하나 읽혀도 레인 수는 여전히 모른다. 예전에는 "디코드가 있었다"로 부트스트랩 플래그를
    // 껐는데, 그 플래그가 단조라서 MK3가 아닌 QR 한 장이 회전을 영구히 멈췄고 2레인 송신은 그 상태에서
    // 영원히 0장이었다. 모른다는 상태를 레인 수 자체(null)로 표현하면 그 문이 사라진다.
    const video = createVideo(3840, 2160);
    const frames = withFrameCallback(video);
    qr.scanImage.mockResolvedValue({ data: 'https://example.test/not-a-share-frame', cornerPoints: [] });
    const loop = startLoop(video, { getLaneCount: () => null });

    // phase 0(전체) → phase 1(위/아래) 두 라운드를 흘려보내고 phase 2를 확인한다.
    for (let round = 0; round < 2; round += 1) {
      frames.tick();
      await flush();
    }
    const rotatedRound = qr.scanImage.mock.calls.length;
    frames.tick();
    await flush();
    expect(scanRegionsSince(rotatedRound)).toMatchObject([
      { x: 0, y: 0, width: 1920, height: 2160 },
      { x: 1920, y: 0, width: 1920, height: 2160 },
    ]);

    loop.stop();
  });

  it('takes every code a BarcodeDetector finds in one frame without splitting the frame', async () => {
    // detect()는 프레임 안의 모든 코드를 배열로 준다. scanImage()가 그중 하나만 쓸 뿐이다.
    // 이 분기에서는 분할도, 축도, 송·수신 기하 합의도 필요 없다.
    const detect = vi
      .fn()
      .mockResolvedValue([{ rawValue: 'MK3:M0000000A:1:0:LANE1' }, { rawValue: 'MK3:M0000000A:1:1:LANE2' }]);
    qr.createQrEngine.mockImplementation(() => Promise.resolve({ detect }));
    const video = createVideo(3840, 2160);
    const frames = withFrameCallback(video);
    const onSymbol = vi.fn();
    const onScanTick = vi.fn();
    const loop = startLoop(video, { getLaneCount: () => 2, onSymbol, onScanTick });

    frames.tick();
    await flush();

    expect(qr.scanImage).not.toHaveBeenCalled();
    expect(detect).toHaveBeenCalledWith(video);
    expect(onSymbol.mock.calls.flat()).toEqual(['MK3:M0000000A:1:0:LANE1', 'MK3:M0000000A:1:1:LANE2']);
    expect(onScanTick).toHaveBeenLastCalledWith(2);

    loop.stop();
  });

  it('keeps scanning when a BarcodeDetector rejects', async () => {
    const detect = vi.fn().mockRejectedValue(new Error('detect failed'));
    qr.createQrEngine.mockImplementation(() => Promise.resolve({ detect }));
    const video = createVideo(1280, 720);
    const frames = withFrameCallback(video);
    const onSymbol = vi.fn();
    const onScanTick = vi.fn();
    const loop = startLoop(video, { onSymbol, onScanTick });

    frames.tick();
    await flush();
    expect(onSymbol).not.toHaveBeenCalled();
    expect(onScanTick).toHaveBeenLastCalledWith(0);

    frames.tick();
    await flush();
    expect(detect).toHaveBeenCalledTimes(2);

    loop.stop();
  });

  it('skips camera frames while the previous round is still running', async () => {
    const video = createVideo(1280, 720);
    const frames = withFrameCallback(video);
    const pending = deferred();
    qr.scanImage.mockReturnValueOnce(pending.promise);
    const onScanTick = vi.fn();
    const loop = startLoop(video, { onScanTick });

    frames.tick();
    await flush();
    frames.tick();
    frames.tick();

    expect(qr.scanImage).toHaveBeenCalledTimes(1);
    expect(onScanTick).not.toHaveBeenCalled();

    pending.resolve({ data: 'MK3:F0000000A:1:0:PAYLOAD', cornerPoints: [] });
    await flush();
    expect(onScanTick).toHaveBeenCalledTimes(1);

    frames.tick();
    await flush();
    expect(qr.scanImage).toHaveBeenCalledTimes(2);

    loop.stop();
  });

  it('falls back to requestAnimationFrame when the video has no frame callback', async () => {
    const video = createVideo(1280, 720);
    const loop = startLoop(video);

    expect(animationFrames).toHaveLength(1);
    animationFrames.shift()?.(0);
    await flush();

    expect(qr.scanImage).toHaveBeenCalledTimes(1);
    expect(animationFrames).toHaveLength(1);

    loop.stop();
    expect(cancelAnimationFrameSpy).toHaveBeenCalledTimes(1);
  });

  it('reuses one engine and one canvas across single lane rounds and terminates the worker on stop', async () => {
    const engine = { terminate: vi.fn() };
    qr.createQrEngine.mockImplementation(() => Promise.resolve(engine));
    const video = createVideo(1920, 1080);
    const frames = withFrameCallback(video);
    const loop = startLoop(video);

    frames.tick();
    await flush();
    frames.tick();
    await flush();

    // 엔진 생성은 워커 로드다. 프레임마다 만들면 스캔이 아니라 워커 부팅만 하게 된다.
    expect(qr.createQrEngine).toHaveBeenCalledTimes(1);
    expect(qr.scanImage).toHaveBeenCalledTimes(2);
    expect(qr.scanImage.mock.calls[1]?.[1].qrEngine).toBe(qr.scanImage.mock.calls[0]?.[1].qrEngine);
    expect(qr.scanImage.mock.calls[1]?.[1].canvas).toBe(qr.scanImage.mock.calls[0]?.[1].canvas);

    loop.stop();
    await flush();

    expect(engine.terminate).toHaveBeenCalledTimes(1);
    expect(frames.cancel).toHaveBeenCalledTimes(1);

    loop.stop();
    expect(frames.cancel).toHaveBeenCalledTimes(1);
  });

  it('leaves a BarcodeDetector engine alone on stop', async () => {
    qr.createQrEngine.mockImplementation(() => Promise.resolve({ detect: vi.fn().mockResolvedValue([]) }));
    const video = createVideo(1920, 1080);
    const frames = withFrameCallback(video);
    const loop = startLoop(video);

    frames.tick();
    await flush();
    loop.stop();
    await flush();

    expect(qr.createQrEngine).toHaveBeenCalledTimes(1);
  });

  it('survives an engine that never loads', async () => {
    qr.createQrEngine.mockImplementation(() => Promise.reject(new Error('worker load failed')));
    const video = createVideo(1920, 1080);
    const frames = withFrameCallback(video);
    const onSymbol = vi.fn();
    const onScanTick = vi.fn();
    const loop = startLoop(video, { onSymbol, onScanTick });

    frames.tick();
    await flush();
    expect(onSymbol).not.toHaveBeenCalled();
    expect(onScanTick).toHaveBeenLastCalledWith(0);
    expect(qr.scanImage).not.toHaveBeenCalled();

    // stop()이 실패한 엔진 프로미스를 붙잡지 않으면 unhandled rejection으로 테스트가 깨진다.
    loop.stop();
    await flush();
    expect(qr.createQrEngine).toHaveBeenCalledTimes(1);
  });

  it('reports failed decodes without calling onSymbol and keeps scanning', async () => {
    const video = createVideo(1920, 1080);
    const frames = withFrameCallback(video);
    qr.scanImage.mockRejectedValueOnce(new Error('No QR code found'));
    const onSymbol = vi.fn();
    const onScanTick = vi.fn();
    const loop = startLoop(video, { onSymbol, onScanTick });

    frames.tick();
    await flush();
    expect(onSymbol).not.toHaveBeenCalled();
    expect(onScanTick).toHaveBeenLastCalledWith(0);

    frames.tick();
    await flush();
    expect(onSymbol).toHaveBeenCalledWith('MK3:M0000000A:1:0:PAYLOAD');

    loop.stop();
  });

  it('waits for video dimensions before scanning', async () => {
    const video = createVideo(0, 0);
    const frames = withFrameCallback(video);
    const loop = startLoop(video);

    frames.tick();
    await flush();

    expect(qr.scanImage).not.toHaveBeenCalled();
    // 프레임을 버렸어도 다음 프레임은 계속 예약한다.
    expect(frames.pending()).toBe(1);

    Object.defineProperty(video, 'videoWidth', { value: 1920, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 1080, configurable: true });
    frames.tick();
    await flush();
    expect(qr.scanImage).toHaveBeenCalledTimes(1);

    loop.stop();
  });

  it('does not scan again after stop', async () => {
    const video = createVideo(1920, 1080);
    const frames = withFrameCallback(video);
    const loop = startLoop(video);

    loop.stop();
    expect(frames.cancel).toHaveBeenCalledTimes(1);
    // 취소된 콜백이 뒤늦게 한 번 더 불려도 라운드를 시작하지 않는다.
    frames.tick();
    await flush();

    expect(qr.scanImage).not.toHaveBeenCalled();
    expect(frames.pending()).toBe(0);
  });

  it('drops a symbol that arrives from a round already in flight when stop is called', async () => {
    const video = createVideo(1920, 1080);
    const frames = withFrameCallback(video);
    const pending = deferred();
    qr.scanImage.mockReturnValueOnce(pending.promise);
    const onSymbol = vi.fn();
    const onScanTick = vi.fn();
    const loop = startLoop(video, { onSymbol, onScanTick });

    frames.tick();
    await flush();
    expect(qr.scanImage).toHaveBeenCalledTimes(1);

    // BarcodeDetector 경로에서는 stop()이 진행 중인 디코드를 죽이지 못한다. 늦게 도착한 심볼을
    // 그대로 흘리면 사용자가 이미 떠난 화면에서 전송이 완료돼 드로어가 '가져오기 확인'으로 튄다.
    loop.stop();
    pending.resolve({ data: 'MK3:F0000000A:1:0:PAYLOAD', cornerPoints: [] });
    await flush();

    expect(onSymbol).not.toHaveBeenCalled();
    expect(onScanTick).not.toHaveBeenCalled();
  });
});
