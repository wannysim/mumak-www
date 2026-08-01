import QrScanner from 'qr-scanner';

/**
 * `QrScanner.createQrEngine()`은 플랫폼에 `BarcodeDetector`가 있으면 그것을, 없으면 jsQR 워커를 준다.
 * 즉 이 루프는 두 번째 스캔 라이브러리 없이 iOS Safari까지 커버한다.
 */
type QrEngine = Awaited<ReturnType<typeof QrScanner.createQrEngine>>;

type ScanBox = { x: number; y: number; width: number; height: number };

/** `QrScanner.ScanRegion`과 구조적으로 호환된다. 값을 항상 채우므로 여기서는 전부 필수다. */
type ScanRegion = ScanBox & { downScaledWidth: number; downScaledHeight: number };

export type ScanLoop = { stop(): void };

export type ScanLoopOptions = {
  video: HTMLVideoElement;
  /**
   * 보내는 쪽이 동시에 표시하는 QR 개수. 수집기의 `profileCode`에서 나오며 매 라운드 새로 읽는다.
   * MK3 프레임을 하나도 받지 못한 동안은 **모른다**는 뜻으로 `null`이다 — 그 상태를 불리언 플래그로
   * 들고 있으면 낯선 QR 하나가 플래그를 꺼 버려 회전 스케줄이 영영 멈춘다.
   */
  getLaneCount: () => 1 | 2 | null;
  onSymbol: (text: string) => void;
  /** 카메라 프레임 한 라운드마다 호출. `decodedCount`는 그 라운드에서 디코드한 심볼 수. */
  onScanTick: (decodedCount: number) => void;
};

/**
 * 축소 상한. **모듈 수에서 유도하지 않는다.**
 *
 * 광학 루프백 실측(jsQR 워커, 당시 후보 심볼 4종 × 화면 밀도 5종 = 20조합):
 * 모듈당 3픽셀로 줄이면 10/20, 4픽셀 15/20, 5픽셀 15/20, 6픽셀 13/20, 8픽셀 15/20만 읽히고
 * **축소를 하지 않으면 20/20**이 읽힌다. 실패는 해상도가 아니라 리샘플링 위상 때문이며
 * (같은 배율이 같은 심볼에서 화면 밀도와 무관하게 항상 실패했다) 비정수 축소가 모듈 경계를
 * 계통적으로 뭉갠다. 모듈당 3픽셀에서는 V25-L이 통째로 안 읽혔다.
 * 그래서 축소는 4K 프레임의 디코드 비용을 묶는 용도로만 남기고, 1080p급 이하는 원본 그대로 넘긴다.
 * 1200²에서 jsQR 한 장이 약 40ms이므로 초당 20~25장이 디코더 상한이다.
 * 프로파일의 `targetSymbolsPerSecond`가 이 값을 넘으면 표시만 빨라지고 전송은 느려진다.
 */
const MAX_SCAN_SIDE = 1200;

/**
 * 짧은 축이 상한을 넘을 때만 줄인다. 가로세로 비율은 유지한다
 * (비등방 축소는 모듈을 직사각형으로 만들어 디코드를 깨뜨린다). 원본보다 크게 늘리지도 않는다.
 *
 * ponytail: 긴 축은 묶지 않는다. 4K 프레임은 2133x1200(2.6 Mpx)까지 커진다.
 * 천장: 그만큼 jsQR 한 장이 느려진다. 그래도 긴 축을 묶으면 축소 배율이 더 공격적이 되는데,
 * 위 실측이 "축소 자체가 디코드를 깨뜨린다"고 말하므로 비용보다 실패가 나쁘다.
 * 업그레이드 경로: 픽셀 총량 상한으로 바꾸되, 바꾸기 전에 V25-L 디코드율을 다시 측정할 것.
 */
function downScaled(region: ScanBox): ScanRegion {
  const scale = Math.min(1, MAX_SCAN_SIDE / Math.min(region.width, region.height));
  return {
    ...region,
    downScaledWidth: Math.round(region.width * scale),
    downScaledHeight: Math.round(region.height * scale),
  };
}

/** jsQR 워커만 정리 대상이다. `BarcodeDetector`는 참조를 놓으면 끝난다. */
function terminateEngine(engine: QrEngine): void {
  if ('terminate' in engine) engine.terminate();
}

/**
 * `BarcodeDetector.detect()`는 **프레임 안의 모든 코드를 배열로** 준다. `QrScanner.scanImage()`가
 * 그중 하나만 쓰기 때문에 그동안 못 쓰고 있었을 뿐이다. 이 분기에서는 분할도, 축도, 송·수신 기하
 * 합의도 필요 없다 — 2레인 송신이 한 프레임에서 두 심볼로 그대로 나온다.
 */
function isMultiDetectEngine(engine: QrEngine): engine is Extract<QrEngine, { detect: unknown }> {
  return 'detect' in engine;
}

function halves(width: number, height: number, axis: 'y' | 'x'): ScanBox[] {
  if (axis === 'y') {
    const half = Math.floor(height / 2);
    return [
      { x: 0, y: 0, width, height: half },
      { x: 0, y: height - half, width, height: half },
    ];
  }
  const half = Math.floor(width / 2);
  return [
    { x: 0, y: 0, width: half, height },
    { x: width - half, y: 0, width: half, height },
  ];
}

/**
 * 회전 스케줄. **송신과 수신이 분할축을 합의하지 않는다.**
 *
 * 프레임은 레인 기하를 싣지 않고(레인은 표시 문제일 뿐이다) 카메라 방향은 수신만 안다. 예전 설계는
 * 카메라 프레임의 종횡비로 축을 골랐는데, 세로로 쌓인 두 코드를 가로 프레임에서 좌우로 잘라 둘 다
 * 못 읽고 한 번 그 상태에 들어가면 빠져나오지 못했다. 그래서 축을 고르지 않고 라운드마다 돌린다:
 *
 *   phase 0: 전체 프레임 (한쪽 레인만 카메라에 들어온 경우도 여기서 잡힌다)
 *   phase 1: 위/아래 절반 (화면 그대로의 배치)
 *   phase 2: 좌/우 절반 (카메라를 90도 돌려 든 경우)
 *
 * 상태도, 정체 감지도, 복구 로직도 없이 세 배치가 3라운드마다 모두 덮인다. 30fps면 한 바퀴가 0.1초다.
 * 회전을 끄는 유일한 조건은 **단일 레인으로 확인된 것**이다(`lanes === 1`). 레인 수를 아직 모르면
 * (`null`) 계속 돈다 — 낯선 QR이 하나 읽혔다는 사실은 레인 수에 대해 아무것도 알려주지 않는다.
 */
function roundRegions(width: number, height: number, round: number, rotate: boolean): ScanBox[] {
  const whole: ScanBox = { x: 0, y: 0, width, height };
  if (!rotate) return [whole];
  const phase = round % 3;
  if (phase === 0) return [whole];
  return halves(width, height, phase === 1 ? 'y' : 'x');
}

/**
 * 카메라 프레임을 한 장씩 디코더에 넘긴다.
 *
 * - 카메라 프레임마다 한 라운드. `requestVideoFrameCallback`이 있으면 그것을 쓰고 없으면 rAF로 떨어진다.
 * - 이전 라운드가 안 끝났으면 그 카메라 프레임은 버린다. 이 백프레셔가 없으면 워커 큐가 밀린다.
 */
export function startScanLoop(options: ScanLoopOptions): ScanLoop {
  const { video, getLaneCount, onSymbol, onScanTick } = options;
  /**
   * 엔진 생성은 워커 로드라서 프레임마다 하면 안 된다. 영역 하나당 슬롯 하나를 재사용한다
   * (jsQR 워커 하나에 두 스캔을 동시에 던지면 응답이 엇갈리고, 캔버스를 공유하면 픽셀이 겹친다).
   * 회전 스케줄의 최대 영역 수가 2라 슬롯도 최대 2개다.
   */
  const slots: { engine: Promise<QrEngine>; canvas: HTMLCanvasElement }[] = [];
  const usesFrameCallback = typeof video.requestVideoFrameCallback === 'function';
  let stopped = false;
  let running = false;
  let round = 0;
  let frameHandle: number | null = null;

  function slotAt(index: number) {
    slots[index] ??= { engine: QrScanner.createQrEngine(), canvas: document.createElement('canvas') };
    return slots[index]!;
  }

  const scanRegions = async (regions: readonly ScanBox[]): Promise<string[]> => {
    // 두 영역을 직렬로 await하지 않는다. 슬롯이 갈라져 있으므로 함께 던지고 둘 다 기다린다.
    const settled = await Promise.allSettled(
      regions.map((region, index) => {
        const slot = slotAt(index);
        return QrScanner.scanImage(video, {
          scanRegion: downScaled(region),
          qrEngine: slot.engine,
          canvas: slot.canvas,
          returnDetailedScanResult: true,
          // 대부분의 rejection은 'No QR code found'다. 프레임 하나를 놓치는 건 파운틴 코드에서 공짜다.
        });
      })
    );
    return settled.flatMap(result => (result.status === 'fulfilled' ? [result.value.data] : []));
  };

  const runRound = async (roundIndex: number) => {
    const engine = await slotAt(0).engine.catch(() => null);
    if (stopped) return;
    const texts = !engine
      ? []
      : isMultiDetectEngine(engine)
        ? await engine
            .detect(video)
            .then(codes => codes.map(code => code.rawValue))
            .catch(() => [])
        : await scanRegions(roundRegions(video.videoWidth, video.videoHeight, roundIndex, getLaneCount() !== 1));

    // stop() 뒤에 도착한 결과를 흘리면 이미 떠난 화면에서 전송이 완료돼 드로어가 튄다.
    if (stopped) return;
    for (const text of texts) onSymbol(text);
    onScanTick(texts.length);
  };

  const onFrame = () => {
    frameHandle = null;
    if (stopped) return;
    if (running || video.videoWidth === 0 || video.videoHeight === 0) {
      schedule();
      return;
    }
    running = true;
    void runRound(round++).finally(() => {
      running = false;
    });
    schedule();
  };

  // onFrame이 stopped를 먼저 보고 빠지므로 여기서 다시 확인할 필요는 없다.
  function schedule() {
    frameHandle = usesFrameCallback ? video.requestVideoFrameCallback(onFrame) : requestAnimationFrame(onFrame);
  }

  schedule();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      if (frameHandle !== null) {
        if (usesFrameCallback) video.cancelVideoFrameCallback(frameHandle);
        else cancelAnimationFrame(frameHandle);
        frameHandle = null;
      }
      for (const slot of slots) void slot.engine.then(terminateEngine, () => {});
      slots.length = 0;
    },
  };
}
