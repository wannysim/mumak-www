// S1 글자·사진 래스터 비교 하네스. 회색 플레이스홀더이며 시안이 아니다.
// 근거: tech-research.md 0장(호환성 원칙)·1장(α/β, 텍스처 해상도, 재래스터 규칙), spikes.md S1-1–S1-12.
// 결과를 기록한 뒤 버리는 하네스다(spikes.md "버릴지 올릴지").

import { loadEmbeddedFont, PRETENDARD_VARIABLE_URL, type EmbeddedFont } from './font-embed';
import {
  rasterizeTestPage,
  readCanvasRegion,
  releaseCanvas,
  verifyLateDraw,
  type LateDrawCheck,
  type PaintCheck,
  type RasterOutput,
  type SvgSizing,
} from './foreign-object-raster';
import {
  createMeasurer,
  LOAD_EVENTS,
  measureName,
  RASTER_EVENTS,
  summarizeByKey,
  type StepDurations,
  type StepTimer,
} from './measure';
import {
  compareTopDownWithBottomUp,
  computeBackingSize,
  devicePixelError,
  devicePixelPlacement,
  devicePixelSnapCandidates,
  isIntegralDevicePixel,
  magnifierSourceRect,
  photoSourceCoverage,
  sameSize,
  texelsPerPixel,
  textureBytes,
  type DevicePixelPlacement,
  type DurationSummary,
  type PixelComparison,
  type Point,
  type Size,
} from './raster-math';
import {
  formatBytes,
  formatSize,
  renderKeyValueTable,
  renderMeasureTable,
  type MeasureTableRow,
  type TableRow,
} from './report';
import { watchRetrasterTriggers, type DevicePixelSizeSource, type RetrasterTrigger } from './retraster-watch';
import {
  createTestPage,
  DEFAULT_PAGE_CSS_SIZE,
  setTestPageSize,
  TEST_FONT_FAMILY,
  TEST_FONT_WEIGHT_RANGE,
  TEST_PAGE_CSS,
  TEST_PHOTO_URL,
} from './test-page';
import { createWebglTexturePanel, UNPACK_SETTINGS, type TextureFilter } from './webgl-texture-panel';

type ScaleMode = 'auto' | 1 | 2 | 3;

type PixelComparisonRecord =
  | ({
      status: 'compared';
      /** 2D 원본 대 WebGL 드로잉 버퍼. 화면 합성 단계는 들어가지 않는다. */
      scope: 'drawing-buffer';
      filter: TextureFilter;
      scale: number;
      devicePixelRatio: number;
      size: Size;
      /** 비교할 때 패널 3 캔버스의 문서 위치(기기 px). 정수가 아니면 화면에서는 1:1이 아닐 수 있다. */
      screenPlacement: DevicePixelPlacement | null;
    } & PixelComparison)
  | { status: 'size-mismatch'; rasterSize: Size; drawingBufferSize: Size }
  | { status: 'unavailable'; reason: string };

type LogEntry = { at: string; sinceLoadMs: number; message: string };

type UploadOutcome = 'uploaded' | 'skipped-context-lost' | 'failed' | 'no-webgl';

/** 래스터 한 건의 기록. 결과 JSON의 rasters 배열이 이것이다. */
type RasterRecord = {
  generation: number;
  key: string;
  reason: string;
  status: 'running' | 'committed' | 'discarded' | 'failed';
  /** 페이지 로드 뒤 처음 반영된 래스터. 요약에서 빼고 따로 보인다. */
  cold: boolean;
  cssSize: Size;
  scale: number;
  sizing: SvgSizing;
  devicePixelRatio: number;
  backing: Size | null;
  steps: StepDurations;
  paint: PaintCheck | null;
  upload: UploadOutcome | null;
  lateDraw: LateDrawCheck | { skipped: string } | null;
  error: string | null;
};

type HarnessState = {
  cssSize: Size;
  scaleMode: ScaleMode;
  sizing: SvgSizing;
  filter: TextureFilter;
  finishAfterUpload: boolean;
  overlay: boolean;
  textureVisible: boolean;
  blinkTimer: number | null;
  blinkIntervalMs: number;
  rasterReady: boolean;
  generation: number;
  records: RasterRecord[];
  rasterRecord: RasterRecord | null;
  coldCommitted: boolean;
  loadSteps: StepDurations;
  lastRequestedKey: string;
  debounceTimer: number | null;
  scheduledTriggerMark: string | null;
  fontUrl: string;
  font: EmbeddedFont | null;
  fontError: string | null;
  raster: RasterOutput | null;
  rasterCount: number;
  glBackingReason: string;
  observesDevicePixelContentBox: boolean;
  observedDevicePixelBox: { size: Size; source: DevicePixelSizeSource } | null;
  pixelComparison: PixelComparisonRecord | null;
  magnifierCenter: Point;
  magnifierFrame: number | null;
  magnifierIncludesGl: boolean;
  glMagnifierDrawn: boolean;
  snapFrame: number | null;
};

const PAGE_SIZE_LIMITS = { min: 120, maxWidth: 1600, maxHeight: 2400 } as const;
/** 1장 "다시 그리는 동안": 크기 변화는 멈춘 뒤 150ms(제안값), DPR 변화는 바로 예약. */
const SIZE_DEBOUNCE_MS = 150;
const BLINK_LIMITS = { min: 50, max: 5000, fallback: 500 } as const;
const MAGNIFIER_CSS_SIZE = 256;
const MAGNIFICATION = 4;
const LOG_LIMIT = 300;
const RECORD_LIMIT = 200;
/** 늦은 다시 그리기 비교까지 기다리는 시간. 하네스 판정용 임시값. */
const LATE_DRAW_DELAY_MS = 250;
const SNAP_TOLERANCE_CSS_PX = 1e-6;
/** 무대를 옮길 수 있는 최대 거리. 패널 안쪽 여백(harness.css)이 이것과 테두리를 담는다. */
const MAX_SNAP_SHIFT_CSS_PX = 4;

const SCALE_MODES: Record<string, ScaleMode> = { auto: 'auto', '1': 1, '2': 2, '3': 3 };

// ── 요소 ─────────────────────────────────────────────────────────

function byId<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`#${id} 요소가 없다`);
  return element;
}

const errorBox = byId('errors', HTMLDivElement);
const widthInput = byId('page-width', HTMLInputElement);
const heightInput = byId('page-height', HTMLInputElement);
const sizingSelect = byId('svg-sizing', HTMLSelectElement);
const finishCheckbox = byId('measure-finish', HTMLInputElement);
const overlayCheckbox = byId('overlay', HTMLInputElement);
const blinkButton = byId('blink', HTMLButtonElement);
const blinkIntervalInput = byId('blink-interval', HTMLInputElement);
const blinkStatus = byId('blink-status', HTMLSpanElement);
const rerasterButton = byId('reraster', HTMLButtonElement);
const pixelCompareButton = byId('pixel-compare', HTMLButtonElement);
const resetMeasuresButton = byId('reset-measures', HTMLButtonElement);
const copyButton = byId('copy-json', HTMLButtonElement);
const copyStatus = byId('copy-status', HTMLSpanElement);
const jsonFallback = byId('json-fallback', HTMLTextAreaElement);
const domStage = byId('dom-stage', HTMLDivElement);
const rasterStage = byId('raster-stage', HTMLDivElement);
const glStage = byId('gl-stage', HTMLDivElement);
const glCanvas = byId('gl-canvas', HTMLCanvasElement);
const glOverlayNote = byId('gl-overlay-note', HTMLParagraphElement);
const glFailureNote = byId('gl-failure', HTMLParagraphElement);
const domCaption = byId('dom-caption', HTMLParagraphElement);
const rasterCaption = byId('raster-caption', HTMLParagraphElement);
const glCaption = byId('gl-caption', HTMLParagraphElement);
const magnifierCaption = byId('magnifier-caption', HTMLParagraphElement);
const magnifierRasterCanvas = byId('magnifier-raster', HTMLCanvasElement);
const magnifierGlCanvas = byId('magnifier-gl', HTMLCanvasElement);
const pixelCompareResult = byId('pixel-compare-result', HTMLParagraphElement);
const measureScope = byId('measure-scope', HTMLParagraphElement);
const measureTable = byId('measure-table', HTMLTableElement);
const rasterTable = byId('raster-table', HTMLTableElement);
const envTable = byId('env-table', HTMLTableElement);
const logList = byId('log', HTMLOListElement);
const scaleButtons = [...document.querySelectorAll<HTMLButtonElement>('button[data-scale]')];
const filterButtons = [...document.querySelectorAll<HTMLButtonElement>('button[data-filter]')];
const stages = [domStage, rasterStage, glStage];
/** 이 요소들의 크기가 바뀌면 그 아래 무대의 위치가 바뀐다. */
const layoutShiftSources = [
  ...document.querySelectorAll<HTMLElement>('.h-header, #errors, .h-controls, .h-panels, .h-panel'),
];

// ── 상태 ─────────────────────────────────────────────────────────

const params = new URLSearchParams(window.location.search);
const measurer = createMeasurer();
const logEntries: LogEntry[] = [];

const state: HarnessState = {
  cssSize: {
    width: readIntParam('w', PAGE_SIZE_LIMITS.min, PAGE_SIZE_LIMITS.maxWidth, DEFAULT_PAGE_CSS_SIZE.width),
    height: readIntParam('h', PAGE_SIZE_LIMITS.min, PAGE_SIZE_LIMITS.maxHeight, DEFAULT_PAGE_CSS_SIZE.height),
  },
  scaleMode: SCALE_MODES[params.get('scale') ?? 'auto'] ?? 'auto',
  sizing: 'draw-scale',
  filter: 'linear',
  finishAfterUpload: false,
  overlay: false,
  textureVisible: true,
  blinkTimer: null,
  blinkIntervalMs: BLINK_LIMITS.fallback,
  rasterReady: false,
  generation: 0,
  records: [],
  rasterRecord: null,
  coldCommitted: false,
  loadSteps: {},
  lastRequestedKey: '',
  debounceTimer: null,
  scheduledTriggerMark: null,
  fontUrl: params.get('font') ?? PRETENDARD_VARIABLE_URL,
  font: null,
  fontError: null,
  raster: null,
  rasterCount: 0,
  glBackingReason: '아직 없음',
  observesDevicePixelContentBox: false,
  observedDevicePixelBox: null,
  pixelComparison: null,
  // 기본 돋보기 위치는 10px 문단 근처(CSS px).
  magnifierCenter: { x: 80, y: 190 },
  magnifierFrame: null,
  magnifierIncludesGl: false,
  glMagnifierDrawn: false,
  snapFrame: null,
};
const stageOffsets = new Map<HTMLElement, Point>();

// ── 시작 ─────────────────────────────────────────────────────────

injectTestPageCss();
const testPage = createTestPage(document, state.cssSize);
domStage.append(testPage);
const domPhoto = testPage.querySelector('img');

const glResult = createWebglTexturePanel(glCanvas, {
  log,
  currentSource: () => state.raster?.canvas ?? null,
  onRestored: () => {
    renderAll();
    scheduleMagnifiers(false);
  },
});
const glPanel = glResult.ok ? glResult.panel : null;
const glFailure = glResult.ok ? null : glResult.reason;
if (glFailure) {
  glFailureNote.textContent = glFailure;
  glFailureNote.hidden = false;
  showError(glFailure);
}

applyCssSize();
syncGlBacking('시작');
setupControls();
setupDevicePixelSnap();
const retrasterWatch = watchRetrasterTriggers(glCanvas, onTrigger);
state.observesDevicePixelContentBox = retrasterWatch.observesDevicePixelContentBox;
renderAll();
void start();

async function start(): Promise<void> {
  log(`시작: DPR ${window.devicePixelRatio}, 쪽 ${formatSize(state.cssSize)}, 배율 ${describeScaleMode()}`);
  await prepareFont();
  await waitForDomPhoto();
  state.rasterReady = true;
  requestRaster('첫 래스터', { force: true });
}

async function prepareFont(): Promise<void> {
  const loadTimer = measurer.createStepTimer();
  state.loadSteps = loadTimer.steps;
  try {
    state.font = await loadEmbeddedFont({
      url: state.fontUrl,
      family: TEST_FONT_FAMILY,
      weightRange: TEST_FONT_WEIGHT_RANGE,
      timer: loadTimer,
    });
    log(
      `서체 준비: ${formatBytes(state.font.byteLength)}, data URL ${state.font.dataUrlCharacters.toLocaleString('en-US')}자`
    );
  } catch (error) {
    state.fontError = describeError(error);
    showError(
      `서체를 불러오지 못했다(${state.fontError}). DOM과 SVG 모두 대체 서체(serif)로 그린다. 이 상태의 측정값은 기록하지 않는다.`
    );
  }
  try {
    // 1장: 필요한 서체가 준비되기 전에는 래스터하지 않는다.
    await document.fonts.load(`400 16px "${TEST_FONT_FAMILY}"`);
  } catch (error) {
    log(`document.fonts.load 실패: ${describeError(error)}`);
  }
}

async function waitForDomPhoto(): Promise<void> {
  if (!domPhoto) return;
  try {
    await domPhoto.decode();
  } catch (error) {
    showError(`DOM 사진을 불러오지 못했다(${TEST_PHOTO_URL}): ${describeError(error)}`);
  }
}

function injectTestPageCss(): void {
  const style = document.createElement('style');
  style.id = 's1-test-page-css';
  style.textContent = TEST_PAGE_CSS;
  document.head.append(style);
}

// ── 래스터 ───────────────────────────────────────────────────────

function currentScale(): number {
  return state.scaleMode === 'auto' ? window.devicePixelRatio : state.scaleMode;
}

/** 1장 재래스터 키: 쪽 CSS 크기와 텍스처 배율. 하네스는 SVG 크기 방식도 넣는다. */
function rasterKeyOf(cssSize: Size, scale: number, sizing: SvgSizing): string {
  return `${formatSize(cssSize)}@${scale}/${sizing}`;
}

function rasterKey(): string {
  return rasterKeyOf(state.cssSize, currentScale(), state.sizing);
}

function requestRaster(reason: string, options: { debounceMs?: number; force?: boolean } = {}): void {
  if (!state.rasterReady) {
    log(`래스터 보류(서체 준비 전): ${reason}`);
    return;
  }
  const key = rasterKey();
  if (!options.force && key === state.lastRequestedKey) {
    log(`재래스터 생략(키 같음 ${key}): ${reason}`);
    return;
  }
  state.lastRequestedKey = key;
  state.generation += 1;
  const generation = state.generation;
  const debounceMs = options.debounceMs ?? 0;
  if (state.debounceTimer !== null) window.clearTimeout(state.debounceTimer);
  if (state.scheduledTriggerMark) performance.clearMarks(state.scheduledTriggerMark);
  const triggerMark = measurer.mark('trigger');
  state.scheduledTriggerMark = triggerMark;
  log(`재래스터 예약 #${generation}: ${reason}, 키 ${key}${debounceMs > 0 ? `, ${debounceMs}ms 디바운스` : ''}`);
  state.debounceTimer = window.setTimeout(() => {
    state.debounceTimer = null;
    state.scheduledTriggerMark = null;
    void runRaster(generation, triggerMark, reason);
  }, debounceMs);
}

async function runRaster(generation: number, triggerMark: string, reason: string): Promise<void> {
  const timer = measurer.createStepTimer();
  const cssSize = { ...state.cssSize };
  const scale = currentScale();
  const sizing = state.sizing;
  const record: RasterRecord = {
    generation,
    key: rasterKeyOf(cssSize, scale, sizing),
    reason,
    status: 'running',
    cold: false,
    cssSize,
    scale,
    sizing,
    devicePixelRatio: window.devicePixelRatio,
    backing: null,
    steps: timer.steps,
    paint: null,
    upload: null,
    lateDraw: null,
    error: null,
  };
  pushRecord(record);
  const totalMark = measurer.mark('raster-total');
  let output: RasterOutput;
  try {
    output = await rasterizeTestPage({
      pageElement: testPage,
      cssSize,
      scale,
      sizing,
      pageCss: TEST_PAGE_CSS,
      fontFaceRule: state.font?.fontFaceRule ?? '',
      photoUrl: TEST_PHOTO_URL,
      rasterId: generation,
      timer,
      log,
    });
  } catch (error) {
    performance.clearMarks(totalMark);
    performance.clearMarks(triggerMark);
    record.status = 'failed';
    record.error = describeError(error);
    showError(`래스터 #${generation} 실패: ${record.error}`);
    return;
  }
  record.backing = { width: output.backing.width, height: output.backing.height };
  record.paint = output.paint;
  if (generation !== state.generation) {
    // 1장: 트리거마다 세대 번호를 올리고, 끝난 작업이 옛 세대면 버린다.
    log(`옛 세대 #${generation} 결과를 버림(현재 #${state.generation})`);
    record.status = 'discarded';
    releaseCanvas(output.canvas);
    performance.clearMarks(totalMark);
    performance.clearMarks(triggerMark);
    renderAll();
    return;
  }
  commitRaster(output, record, timer, triggerMark, totalMark);
}

function commitRaster(
  output: RasterOutput,
  record: RasterRecord,
  timer: StepTimer,
  triggerMark: string,
  totalMark: string
): void {
  const previous = state.raster;
  output.canvas.id = 'raster-canvas';
  output.canvas.className = 'h-canvas';
  output.canvas.setAttribute('role', 'img');
  output.canvas.setAttribute('aria-label', `foreignObject 래스터 ${formatSize(output.backing)}`);
  setCanvasCssSize(output.canvas, state.cssSize);
  rasterStage.replaceChildren(output.canvas);
  state.raster = output;
  state.rasterRecord = record;

  record.upload = uploadToTexture(output.canvas, timer);
  // 하네스는 패널 2에 원본을 보여야 해서 현재 래스터는 남기고, 바뀐 옛 캔버스만 해제한다.
  // 컨텍스트 복구 때는 패널이 현재 래스터(state.raster)를 다시 올리므로 옛 캔버스를 해제해도 된다.
  if (previous) releaseCanvas(previous.canvas);

  timer.measureSince('raster-total', totalMark);
  record.cold = !state.coldCommitted;
  state.coldCommitted = true;
  const sinceTrigger = timer.measureSince(record.cold ? 'first-raster' : 'reraster', triggerMark);
  record.status = 'committed';
  state.rasterCount += 1;
  log(
    `래스터 #${record.generation} 반영${record.cold ? '(첫 래스터)' : ''}: 2D ${formatSize(output.backing)}, 배율 ${output.scale}, 트리거부터 ${sinceTrigger.toFixed(1)}ms`
  );
  document.body.dataset.s1State = 'ready';
  document.body.dataset.s1Rasters = String(state.rasterCount);
  renderAll();
  scheduleMagnifiers(false);
  window.setTimeout(() => runLateVerification(output, record, timer), LATE_DRAW_DELAY_MS);
}

function uploadToTexture(source: HTMLCanvasElement, timer: StepTimer | null): UploadOutcome {
  if (!glPanel) return 'no-webgl';
  if (glPanel.isContextLost()) {
    log('WebGL 컨텍스트 손실 중이라 업로드를 미룬다. 복구 때 현재 래스터를 올린다.');
    return 'skipped-context-lost';
  }
  try {
    const upload = (): void => glPanel.upload(source, state.finishAfterUpload);
    if (timer) timer.timeSync('tex-image-2d', upload);
    else upload();
    glPanel.draw();
    return 'uploaded';
  } catch (error) {
    showError(`텍스처 업로드 실패: ${describeError(error)}`);
    return 'failed';
  }
}

/** 하네스 전용: 반영 뒤 같은 SVG를 다시 그려 비교한다(WebKit 219770). raster-total 밖이다. */
function runLateVerification(output: RasterOutput, record: RasterRecord, timer: StepTimer): void {
  if (state.raster !== output) {
    record.lateDraw = { skipped: '비교 전에 새 래스터로 바뀜' };
    return;
  }
  try {
    const check = timer.timeSync('late-verify', () => verifyLateDraw(output, LATE_DRAW_DELAY_MS));
    record.lateDraw = check;
    if (check.differs) {
      log(
        `늦은 다시 그리기가 첫 결과와 다르다(${check.differingRegions.join(', ')}). 첫 그리기가 서체·사진 준비 전이었다(WebKit 219770 의심). 늦은 결과로 바꿔 다시 올린다.`
      );
      record.upload = uploadToTexture(output.canvas, null);
      scheduleMagnifiers(false);
    } else {
      log(`늦은 다시 그리기 비교(${LATE_DRAW_DELAY_MS}ms 뒤): 래스터 #${record.generation}과 같다.`);
    }
  } catch (error) {
    record.lateDraw = { skipped: describeError(error) };
    log(`늦은 다시 그리기 비교 실패: ${describeError(error)}`);
  }
  renderAll();
}

function pushRecord(record: RasterRecord): void {
  state.records.push(record);
  while (state.records.length > RECORD_LIMIT) {
    const oldestIndex = state.records.findIndex(candidate => !candidate.cold);
    state.records.splice(oldestIndex === -1 ? 0 : oldestIndex, 1);
  }
}

function resetMeasures(): void {
  state.records = state.records.filter(record => record.status === 'running');
  const names = new Set(
    performance
      .getEntriesByType('measure')
      .map(entry => entry.name)
      .filter(name => name.startsWith('sb:s1:'))
  );
  for (const name of names) performance.clearMeasures(name);
  log('측정 초기화: 래스터 기록과 sb:s1 measure를 지웠다(로드 사건 값은 남긴다).');
  renderAll();
}

// ── WebGL 백킹과 트리거 ──────────────────────────────────────────

/**
 * 과제 규칙: WebGL 캔버스 백킹 = 쪽 CSS 크기 × 실제 devicePixelRatio.
 * ResizeObserver의 기기 픽셀 상자는 관찰값으로만 기록하고 CSS×DPR과 맞는지 표시한다.
 * (headless Chromium의 DSF 에뮬레이션은 devicePixelContentBoxSize에 CSS px 값을 줬다. 실기기 값은 미확인.)
 */
function syncGlBacking(reason: string): void {
  if (!glPanel) return;
  glPanel.setBackingSize(computeBackingSize(state.cssSize, window.devicePixelRatio));
  state.glBackingReason = reason;
  // 1장: 새 텍스처가 준비될 때까지 옛 텍스처를 새 크기에 늘려 그린다.
  glPanel.draw();
  renderAll();
  scheduleMagnifiers(false);
}

// ── 기기 픽셀 스냅 ───────────────────────────────────────────────

/**
 * 무대(캔버스의 부모)의 왼쪽 위를 가장 가까운 기기 픽셀 경계로 옮긴다. 머리·설명 글의 줄 높이 때문에
 * 무대가 소수 기기 px(예: DPR 2.625에서 y 597.52)에 놓이면 브라우저가 캔버스를 화면에서 다시 샘플링해
 * 드로잉 버퍼가 1:1이어도 화면은 1:1이 아니다.
 * 이동은 transform이 아니라 상대 위치(top·left)로 한다. headless Chromium 153에서 transform으로 옮기면
 * 레이어의 배치 위치를 먼저 기기 px로 반올림한 뒤 transform을 더해 오히려 소수 위치가 됐다(DSF 1·2에서도 어긋남).
 * 상대 위치는 배치 위치에 들어가 반올림할 것이 없게 만든다. 형제 배치에는 영향이 없어 되먹임도 없다.
 * 위치는 문서 기준(뷰포트 위치 + 스크롤)으로 맞춘다. 같은 Chromium은 스크롤·시각 뷰포트 오프셋을 합성 때 기기 px로
 * 반올림했고(getBoundingClientRect는 반올림 전 값), 뷰포트 기준으로 맞추면 스크롤한 뒤 어긋났다. 다른 엔진은 미확인.
 * 크기 변화·DPR 변화·위쪽 요소 크기 변화 때 다시 맞춘다.
 */
function setupDevicePixelSnap(): void {
  const layoutObserver = new ResizeObserver(() => scheduleSnap());
  for (const element of layoutShiftSources) layoutObserver.observe(element);
  window.addEventListener('resize', scheduleSnap);
  scheduleSnap();
}

/** 문서 기준 CSS 위치(왼쪽 위). */
function documentPosition(element: Element): Point {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + window.scrollX, y: rect.top + window.scrollY };
}

function scheduleSnap(): void {
  if (state.snapFrame !== null) return;
  state.snapFrame = requestAnimationFrame(() => {
    state.snapFrame = null;
    snapStagesToDevicePixels();
  });
}

function snapStagesToDevicePixels(): void {
  const devicePixelRatio = window.devicePixelRatio;
  let changed = false;
  for (const stage of stages) {
    const previous = stageOffsets.get(stage) ?? { x: 0, y: 0 };
    // 이동을 지우고 원래 배치 위치를 읽는다. 같은 작업 안이라 화면에 그려지지 않는다.
    stage.style.left = '';
    stage.style.top = '';
    const base = documentPosition(stage);
    const offset = {
      x: snapStageAxis(stage, 'left', base.x, devicePixelRatio),
      y: snapStageAxis(stage, 'top', base.y, devicePixelRatio),
    };
    stageOffsets.set(stage, offset);
    if (
      Math.abs(offset.x - previous.x) > SNAP_TOLERANCE_CSS_PX ||
      Math.abs(offset.y - previous.y) > SNAP_TOLERANCE_CSS_PX
    ) {
      changed = true;
    }
  }
  if (changed) renderAll();
}

/** 후보 이동을 가까운 순으로 적용해 보고, 실제 위치가 정수 기기 px가 되는 첫 후보를 남긴다. 없으면 오차가 가장 작은 것. */
function snapStageAxis(
  stage: HTMLElement,
  side: 'left' | 'top',
  basePosition: number,
  devicePixelRatio: number
): number {
  if (isIntegralDevicePixel(basePosition, devicePixelRatio)) return 0;
  let best = { offset: 0, error: devicePixelError(basePosition, devicePixelRatio) };
  for (const offset of devicePixelSnapCandidates(basePosition, devicePixelRatio, MAX_SNAP_SHIFT_CSS_PX)) {
    stage.style[side] = `${offset}px`;
    const position = documentPosition(stage);
    const actual = side === 'left' ? position.x : position.y;
    const error = devicePixelError(actual, devicePixelRatio);
    if (error < best.error) best = { offset, error };
    if (isIntegralDevicePixel(actual, devicePixelRatio)) break;
  }
  stage.style[side] = best.offset === 0 ? '' : `${best.offset}px`;
  return best.offset;
}

/** 문서 기준 기기 px 위치. 화면 위치 = 이것 − 기기 px로 반올림된 스크롤(Chromium 관찰). */
function placementOf(element: Element | null): DevicePixelPlacement | null {
  if (!element?.isConnected) return null;
  return devicePixelPlacement(documentPosition(element), window.devicePixelRatio);
}

function describePlacement(placement: DevicePixelPlacement | null): string {
  if (!placement) return '–';
  const position = `(${placement.x.toFixed(3)}, ${placement.y.toFixed(3)})`;
  return `${position} ${placement.integral ? '정수 기기 px' : '소수 기기 px: 화면에서 다시 샘플링될 수 있다'}`;
}

function describeStageOffsets(): string {
  const names: [HTMLElement, string][] = [
    [domStage, 'DOM'],
    [rasterStage, '2D'],
    [glStage, 'WebGL'],
  ];
  return names
    .map(([stage, name]) => {
      const offset = stageOffsets.get(stage) ?? { x: 0, y: 0 };
      return `${name} (${offset.x.toFixed(4)}, ${offset.y.toFixed(4)})`;
    })
    .join(' · ');
}

function screenPlacementJson(): Record<string, unknown> {
  return {
    note: '문서 기준 기기 px. 정수여야 화면 합성 때 다시 샘플링되지 않는다(스크롤은 합성 때 기기 px로 반올림된다고 가정, headless Chromium 153 관찰).',
    domPage: placementOf(testPage),
    rasterCanvas: placementOf(state.raster?.canvas ?? null),
    glCanvas: placementOf(glCanvas),
    stageSnapOffsetsCssPx: {
      dom: stageOffsets.get(domStage) ?? { x: 0, y: 0 },
      raster: stageOffsets.get(rasterStage) ?? { x: 0, y: 0 },
      gl: stageOffsets.get(glStage) ?? { x: 0, y: 0 },
    },
  };
}

function describeGlBacking(buffer: Size): string {
  const expected = computeBackingSize(state.cssSize, window.devicePixelRatio);
  return sameSize(buffer, expected)
    ? `${formatSize(buffer)} = CSS×DPR`
    : `${formatSize(buffer)} ≠ CSS×DPR ${formatSize(expected)}`;
}

function describeDevicePixelBox(): string {
  const observed = state.observedDevicePixelBox;
  if (!observed) return '아직 관찰 안 됨';
  const expected = computeBackingSize(state.cssSize, window.devicePixelRatio);
  const matches = observed.size.width === expected.width && observed.size.height === expected.height;
  return `${formatSize(observed.size)} (${observed.source}) ${matches ? '= CSS×DPR' : `≠ CSS×DPR ${formatSize(expected)}`}`;
}

function onTrigger(trigger: RetrasterTrigger): void {
  switch (trigger.kind) {
    case 'dpr': {
      log(`matchMedia(resolution) change: DPR ${trigger.previous} → ${trigger.current}`);
      // devicePixelContentBoxSize가 없는 엔진은 CSS 크기가 그대로면 ResizeObserver가 오지 않는다.
      // 그래서 WebGL 백킹을 여기서 직접 맞춘다.
      syncGlBacking('DPR 변경');
      scheduleSnap();
      if (state.scaleMode === 'auto') requestRaster('DPR 변경(바로 예약)');
      else log(`배율을 ${state.scaleMode}로 강제 중이라 2D 래스터는 그대로 두고 WebGL 백킹만 바뀐다`);
      renderAll();
      return;
    }
    case 'resize': {
      state.observedDevicePixelBox = { size: trigger.devicePixelSize, source: trigger.source };
      log(`ResizeObserver: CSS ${formatSize(trigger.cssSize)}, 기기 픽셀 상자 ${describeDevicePixelBox()}`);
      syncGlBacking('ResizeObserver');
      return;
    }
    case 'visual-viewport': {
      const cause =
        trigger.scale === 1
          ? '확대 배율 1(창 크기·주소창·DPR 변화 등, 원인은 앞뒤 로그로 본다)'
          : '핀치 확대 상태(핀치는 DPR을 바꾸지 않아 키가 그대로다)';
      log(
        `visualViewport resize: ${trigger.width.toFixed(1)}×${trigger.height.toFixed(1)}, scale ${trigger.scale}. ${cause}`
      );
      renderAll();
      return;
    }
  }
}

// ── 조작 ─────────────────────────────────────────────────────────

function setupControls(): void {
  widthInput.value = String(state.cssSize.width);
  heightInput.value = String(state.cssSize.height);
  blinkIntervalInput.value = String(state.blinkIntervalMs);
  syncPressed();

  const onSizeChange = (): void => {
    const width = clampInt(
      widthInput.valueAsNumber,
      PAGE_SIZE_LIMITS.min,
      PAGE_SIZE_LIMITS.maxWidth,
      state.cssSize.width
    );
    const height = clampInt(
      heightInput.valueAsNumber,
      PAGE_SIZE_LIMITS.min,
      PAGE_SIZE_LIMITS.maxHeight,
      state.cssSize.height
    );
    widthInput.value = String(width);
    heightInput.value = String(height);
    if (width === state.cssSize.width && height === state.cssSize.height) return;
    state.cssSize = { width, height };
    applyCssSize();
    requestRaster('쪽 CSS 크기 변경', { debounceMs: SIZE_DEBOUNCE_MS });
  };
  widthInput.addEventListener('change', onSizeChange);
  heightInput.addEventListener('change', onSizeChange);

  for (const button of scaleButtons) {
    button.addEventListener('click', () => {
      state.scaleMode = SCALE_MODES[button.dataset.scale ?? 'auto'] ?? 'auto';
      syncPressed();
      requestRaster(`배율 ${describeScaleMode()} 선택`, { force: true });
    });
  }

  sizingSelect.addEventListener('change', () => {
    state.sizing = sizingSelect.value === 'viewbox-scale' ? 'viewbox-scale' : 'draw-scale';
    requestRaster(`SVG 크기 방식 ${state.sizing}`, { force: true });
  });

  for (const button of filterButtons) {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter === 'nearest' ? 'nearest' : 'linear';
      syncPressed();
      glPanel?.setFilter(state.filter);
      glPanel?.draw();
      log(`텍스처 필터: ${state.filter.toUpperCase()}`);
      renderAll();
      scheduleMagnifiers(true);
    });
  }

  finishCheckbox.addEventListener('change', () => {
    state.finishAfterUpload = finishCheckbox.checked;
    log(`texImage2D 뒤 gl.finish(): ${state.finishAfterUpload ? '켬' : '끔'}`);
  });
  overlayCheckbox.addEventListener('change', () => setOverlay(overlayCheckbox.checked));
  blinkButton.addEventListener('click', () => setBlinking(state.blinkTimer === null));
  blinkIntervalInput.addEventListener('change', () => {
    state.blinkIntervalMs = clampInt(
      blinkIntervalInput.valueAsNumber,
      BLINK_LIMITS.min,
      BLINK_LIMITS.max,
      BLINK_LIMITS.fallback
    );
    blinkIntervalInput.value = String(state.blinkIntervalMs);
    if (state.blinkTimer !== null) setBlinking(true);
  });
  rerasterButton.addEventListener('click', () => requestRaster('수동 다시 래스터', { force: true }));
  pixelCompareButton.addEventListener('click', runPixelComparison);
  resetMeasuresButton.addEventListener('click', resetMeasures);
  copyButton.addEventListener('click', () => void copyResultJson());

  document.addEventListener('keydown', event => {
    if (event.code !== 'KeyB' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      return;
    }
    event.preventDefault();
    setBlinking(state.blinkTimer === null);
  });

  for (const stage of [domStage, rasterStage, glStage]) {
    stage.addEventListener('pointermove', event => {
      const rect = stage.getBoundingClientRect();
      state.magnifierCenter = {
        x: Math.min(Math.max(event.clientX - rect.left, 0), state.cssSize.width),
        y: Math.min(Math.max(event.clientY - rect.top, 0), state.cssSize.height),
      };
      scheduleMagnifiers(true);
    });
  }
}

function syncPressed(): void {
  for (const button of scaleButtons) {
    const mode = SCALE_MODES[button.dataset.scale ?? ''];
    button.setAttribute('aria-pressed', String(mode === state.scaleMode));
  }
  for (const button of filterButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.filter === state.filter));
  }
}

function applyCssSize(): void {
  setTestPageSize(testPage, state.cssSize);
  for (const stage of [domStage, rasterStage, glStage]) setCanvasCssSize(stage, state.cssSize);
  setCanvasCssSize(glCanvas, state.cssSize);
  // 새 래스터가 올 때까지 옛 래스터를 새 CSS 크기에 늘려 보인다.
  if (state.raster) setCanvasCssSize(state.raster.canvas, state.cssSize);
}

function setCanvasCssSize(element: HTMLElement, cssSize: Size): void {
  element.style.width = `${cssSize.width}px`;
  element.style.height = `${cssSize.height}px`;
}

function setOverlay(on: boolean): void {
  if (state.overlay === on) return;
  state.overlay = on;
  overlayCheckbox.checked = on;
  if (on) {
    glCanvas.classList.add('h-overlay');
    domStage.append(glCanvas);
  } else {
    setBlinking(false);
    glCanvas.classList.remove('h-overlay');
    glStage.prepend(glCanvas);
  }
  glOverlayNote.hidden = !on;
  glPanel?.draw();
  setTextureVisible(true);
  scheduleSnap();
  log(on ? '겹쳐 보기 켬: 패널 3 캔버스를 패널 1 위 같은 자리에 올렸다' : '겹쳐 보기 끔');
}

function setBlinking(on: boolean): void {
  const wasBlinking = state.blinkTimer !== null;
  if (state.blinkTimer !== null) {
    window.clearInterval(state.blinkTimer);
    state.blinkTimer = null;
  }
  if (on) {
    if (!state.overlay) setOverlay(true);
    state.blinkTimer = window.setInterval(() => setTextureVisible(!state.textureVisible), state.blinkIntervalMs);
    log(`깜빡임 시작: ${state.blinkIntervalMs}ms 주기`);
  } else {
    setTextureVisible(true);
    if (wasBlinking) log('깜빡임 정지');
  }
  blinkButton.setAttribute('aria-pressed', String(on));
  blinkButton.textContent = on ? '깜빡임 정지 (B)' : '깜빡임 시작 (B)';
}

function setTextureVisible(visible: boolean): void {
  state.textureVisible = visible;
  glCanvas.style.visibility = visible ? '' : 'hidden';
  if (!state.overlay) blinkStatus.textContent = '겹쳐 보기 꺼짐';
  else blinkStatus.textContent = visible ? '지금 보이는 것: 텍스처(패널 3)' : '지금 보이는 것: DOM(패널 1)';
}

// ── 돋보기와 1:1 비교 ────────────────────────────────────────────

/**
 * includeGl: 패널 3 돋보기도 그린다. WebGL 드로잉 버퍼를 2D로 읽으면 GPU 지연(ReadPixels stall)이 생겨
 * 로드·래스터 직후에는 그리지 않고, 포인터·필터 같은 사용자 입력 때만 그린다.
 */
function scheduleMagnifiers(includeGl: boolean): void {
  state.magnifierIncludesGl ||= includeGl;
  if (state.magnifierFrame !== null) return;
  state.magnifierFrame = requestAnimationFrame(() => {
    state.magnifierFrame = null;
    const withGl = state.magnifierIncludesGl;
    state.magnifierIncludesGl = false;
    drawMagnifiers(withGl);
  });
}

function drawMagnifiers(includeGl: boolean): void {
  const raster = state.raster;
  if (!raster) return;
  drawMagnified(magnifierRasterCanvas, raster.canvas, raster.backing.width / raster.cssSize.width);
  if (glPanel && includeGl && !glPanel.isContextLost()) {
    // preserveDrawingBuffer가 꺼져 있으므로 같은 작업 안에서 다시 그린 뒤 복사한다.
    glPanel.draw();
    drawMagnified(magnifierGlCanvas, glCanvas, glPanel.drawingBufferSize().width / state.cssSize.width);
    state.glMagnifierDrawn = true;
  }
  const center = state.magnifierCenter;
  const glNote = state.glMagnifierDrawn
    ? includeGl
      ? ''
      : ' 패널 3 돋보기는 마지막 포인터 입력 때 그린 것이다.'
    : ' 패널 3 돋보기는 포인터를 올리면 그린다(로드 때 드로잉 버퍼 읽기 지연을 피한다).';
  magnifierCaption.textContent = `중심 (${center.x.toFixed(0)}, ${center.y.toFixed(0)}) CSS px. 원본 픽셀 하나를 기기 픽셀 ${MAGNIFICATION}×${MAGNIFICATION}로 최근접 확대.${glNote}`;
}

function drawMagnified(target: HTMLCanvasElement, source: HTMLCanvasElement, sourcePixelsPerCssPixel: number): void {
  const backing = computeBackingSize(
    { width: MAGNIFIER_CSS_SIZE, height: MAGNIFIER_CSS_SIZE },
    window.devicePixelRatio
  );
  if (target.width !== backing.width) target.width = backing.width;
  if (target.height !== backing.height) target.height = backing.height;
  setCanvasCssSize(target, { width: MAGNIFIER_CSS_SIZE, height: MAGNIFIER_CSS_SIZE });
  const context = target.getContext('2d');
  if (!context) return;
  const region = magnifierSourceRect(
    {
      x: state.magnifierCenter.x * sourcePixelsPerCssPixel,
      y: state.magnifierCenter.y * sourcePixelsPerCssPixel,
    },
    Math.floor(backing.width / MAGNIFICATION),
    { width: source.width, height: source.height }
  );
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#808080';
  context.fillRect(0, 0, backing.width, backing.height);
  context.drawImage(
    source,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width * MAGNIFICATION,
    region.height * MAGNIFICATION
  );
}

function runPixelComparison(): void {
  state.pixelComparison = comparePanels();
  log(describePixelComparison(state.pixelComparison));
  renderAll();
}

/**
 * S1-2 보조: 배율 = DPR일 때 2D 원본과 WebGL 드로잉 버퍼가 같은 화소인지. 다르면 텍셀:드로잉 버퍼 픽셀이 어긋난 것이다.
 * 화면 합성은 보지 않는다. 화면 1:1은 캔버스 문서 위치가 정수 기기 px인지(screenPlacement)와 기기 스크린샷으로 본다.
 */
function comparePanels(): PixelComparisonRecord {
  const raster = state.raster;
  if (!glPanel || !raster) return { status: 'unavailable', reason: glFailure ?? '래스터 전' };
  if (glPanel.isContextLost()) return { status: 'unavailable', reason: 'WebGL 컨텍스트 손실 중' };
  const bufferSize = glPanel.drawingBufferSize();
  if (raster.canvas.width !== bufferSize.width || raster.canvas.height !== bufferSize.height) {
    return { status: 'size-mismatch', rasterSize: { ...raster.backing }, drawingBufferSize: bufferSize };
  }
  try {
    // 사본에서 읽는다. 원본을 여러 번 읽으면 Chromium이 그 캔버스를 CPU로 내릴 수 있다(readCanvasRegion).
    const source = readCanvasRegion(raster.canvas, { x: 0, y: 0, ...bufferSize });
    const output = glPanel.readPixels();
    return {
      status: 'compared',
      scope: 'drawing-buffer',
      filter: state.filter,
      scale: raster.scale,
      devicePixelRatio: window.devicePixelRatio,
      size: bufferSize,
      screenPlacement: placementOf(glCanvas),
      ...compareTopDownWithBottomUp(source, output, bufferSize),
    };
  } catch (error) {
    return { status: 'unavailable', reason: describeError(error) };
  }
}

function describePixelComparison(record: PixelComparisonRecord): string {
  switch (record.status) {
    case 'compared': {
      const placement = record.screenPlacement;
      const screenNote = placement
        ? placement.integral
          ? '패널 3 문서 위치 정수 기기 px'
          : '패널 3 문서 위치가 소수 기기 px라 화면에서는 1:1이 아닐 수 있다'
        : '패널 3 위치 모름';
      return `1:1 픽셀 비교(2D 원본 대 WebGL 드로잉 버퍼, ${formatSize(record.size)}, ${record.filter.toUpperCase()}): 다른 픽셀 ${record.mismatched.toLocaleString('en-US')}/${record.compared.toLocaleString('en-US')}, 차이 1 초과 ${record.mismatchedBeyondOne.toLocaleString('en-US')}, 최대 채널 차이 ${record.maxChannelDelta}. ${screenNote}.`;
    }
    case 'size-mismatch':
      return `1:1 픽셀 비교 안 함: 크기가 다르다(2D ${formatSize(record.rasterSize)}, WebGL ${formatSize(record.drawingBufferSize)}). 배율 ≠ 실제 DPR.`;
    case 'unavailable':
      return `1:1 픽셀 비교 불가: ${record.reason}`;
  }
}

// ── 표와 결과 JSON ───────────────────────────────────────────────

function renderAll(): void {
  renderMeasureTable(measureTable, measureTableRows());
  measureScope.textContent = describeMeasureScope();
  renderKeyValueTable(rasterTable, rasterRows());
  renderKeyValueTable(envTable, environmentRows());
  renderCaptions();
  pixelCompareResult.textContent = state.pixelComparison
    ? describePixelComparison(state.pixelComparison)
    : '1:1 픽셀 비교: 아직 안 함';
}

function renderCaptions(): void {
  domCaption.textContent = `CSS ${formatSize(state.cssSize)}. 서체 ${state.font ? 'Pretendard Variable(FontFace, 같은 바이트)' : '대체 serif(서체 실패 또는 준비 전)'}.`;
  const raster = state.raster;
  const rasterPlacement = placementOf(raster?.canvas ?? null);
  rasterCaption.textContent = raster
    ? `백킹 ${formatSize(raster.backing)} = CSS ${formatSize(raster.cssSize)} × 배율 ${raster.scale}${raster.backing.exact ? '' : '(반올림)'}. ${raster.sizing}. 문서 위치 ${rasterPlacement?.integral ? '정수' : '소수'} 기기 px.`
    : '래스터 전';
  if (!glPanel) {
    glCaption.textContent = glFailure ?? '';
    return;
  }
  if (glPanel.isContextLost()) {
    glCaption.textContent = 'WebGL 컨텍스트 손실 중. 복구되면 현재 래스터를 다시 올린다.';
    return;
  }
  const buffer = glPanel.drawingBufferSize();
  const texture = glPanel.textureSize();
  const texelRatio = texture ? texelsPerPixel(texture, buffer) : null;
  const ratioText = texelRatio
    ? texelRatio.width === 1 && texelRatio.height === 1
      ? '1:1'
      : `${texelRatio.width.toFixed(3)}×${texelRatio.height.toFixed(3)} 텍셀/픽셀`
    : '–';
  const glPlacement = placementOf(glCanvas);
  const screenText = glPlacement?.integral
    ? '문서 위치 정수 기기 px'
    : '문서 위치 소수 기기 px(화면에서는 1:1이 아닐 수 있다)';
  glCaption.textContent = `백킹 ${describeGlBacking(buffer)}(${state.glBackingReason}), DPR ${window.devicePixelRatio}. 텍스처 ${texture ? formatSize(texture) : '–'}, 텍셀:드로잉 버퍼 픽셀 ${ratioText}, ${screenText}, ${state.filter.toUpperCase()}.`;
}

function currentSummaryKey(): string | null {
  return state.rasterRecord?.key ?? null;
}

function coldRecord(): RasterRecord | null {
  return state.records.find(record => record.cold) ?? null;
}

function warmSummaries(): ReturnType<typeof summarizeByKey> {
  return summarizeByKey(
    state.records.map(record => ({
      key: record.key,
      steps: record.steps,
      includeInSummary: record.status === 'committed' && !record.cold,
    }))
  );
}

function measureTableRows(): MeasureTableRow[] {
  const summaryKey = currentSummaryKey();
  const keySummary = warmSummaries().find(summary => summary.key === summaryKey);
  const cold = coldRecord();
  return [
    ...LOAD_EVENTS.map(event => ({
      event,
      name: measureName(event),
      first: state.loadSteps[event] ?? null,
      summary: null,
    })),
    ...RASTER_EVENTS.map(event => ({
      event,
      name: measureName(event),
      first: cold?.steps[event] ?? null,
      summary: keySummary?.events[event] ?? null,
    })),
  ];
}

function describeMeasureScope(): string {
  const summaryKey = currentSummaryKey();
  if (!summaryKey) return '아직 반영한 래스터가 없다.';
  const keySummary = warmSummaries().find(summary => summary.key === summaryKey);
  const cold = coldRecord();
  const coldText = cold
    ? `첫 래스터 열: #${cold.generation} 키 ${cold.key}${cold.key === summaryKey ? '' : '(요약 키와 다름)'}`
    : '첫 래스터 열: 기록 없음(초기화됨)';
  return `요약 키 ${summaryKey}: 같은 키로 반영한 래스터 n=${keySummary?.count ?? 0}(첫 래스터·버린 세대·실패 제외). ${coldText}. 로드 사건(font-*)은 1회 값. late-verify는 하네스 전용이라 raster-total에 없다. 다른 키의 요약은 결과 JSON summariesByKey에 있다.`;
}

function describePaintCheck(paint: PaintCheck): string {
  if (paint.firstDrawComplete) return `빠짐 없음(내용 영역 ${paint.probedRegionCount}곳 모두 그려짐)`;
  const first = paint.transparentOnFirstDraw ? '전부 투명' : `빠진 영역 ${paint.missingOnFirstDraw.join(', ')}`;
  const after = paint.missingAfterRedraw;
  const afterText =
    after === null
      ? '다시 그리지 않음'
      : after.length === 0
        ? '다시 그린 뒤 채워짐'
        : `다시 그린 뒤에도 빠짐: ${after.join(', ')}`;
  return `첫 그리기 ${first} → ${afterText}`;
}

function describeLateDraw(record: RasterRecord | null): string {
  const late = record?.lateDraw;
  if (!late) return '대기 중';
  if ('skipped' in late) return `건너뜀: ${late.skipped}`;
  if (!late.differs) return `같음(${late.delayMs}ms 뒤 다시 그림)`;
  return `다름: ${late.differingRegions.join(', ')} → 늦은 결과로 바꿔 다시 올림`;
}

function rasterRows(): TableRow[] {
  const raster = state.raster;
  const rows: TableRow[] = [
    ['쪽 CSS 크기(임시)', formatSize(state.cssSize)],
    ['래스터 배율', `${currentScale()} (${describeScaleMode()})`],
    ['재래스터 키', rasterKey()],
    ['반영한 래스터 수', String(state.rasterCount)],
  ];
  if (!raster) return rows;
  const buffer = glPanel?.drawingBufferSize();
  const texture = glPanel?.textureSize();
  const font = state.font;
  rows.push(
    ['2D 백킹', `${formatSize(raster.backing)}${raster.backing.exact ? '' : ' (CSS×배율 반올림)'}`],
    ['SVG 크기 방식', raster.sizing],
    [
      'WebGL 드로잉 버퍼',
      glPanel?.isContextLost()
        ? '컨텍스트 손실 중'
        : buffer
          ? `${describeGlBacking(buffer)} (${state.glBackingReason})`
          : '–',
    ],
    ['패널 2 캔버스 문서 위치(기기 px)', describePlacement(placementOf(raster.canvas))],
    ['패널 3 캔버스 문서 위치(기기 px)', describePlacement(placementOf(glCanvas))],
    ['무대 스냅 이동(CSS px)', describeStageOffsets()],
    ['기기 픽셀 상자(ResizeObserver)', describeDevicePixelBox()],
    ['텍스처 크기', texture ? formatSize(texture) : '–'],
    ['텍스처 바이트(폭×높이×4)', texture ? formatBytes(textureBytes(texture)) : '–'],
    ['2D 중간 캔버스 바이트', formatBytes(textureBytes(raster.backing))],
    ['WebGL 드로잉 버퍼 바이트(색만)', buffer ? formatBytes(textureBytes(buffer)) : '–'],
    ['SVG 문자 수', raster.svgCharacters.toLocaleString('en-US')],
    ['SVG data URL 문자 수', raster.svgUrlCharacters.toLocaleString('en-US')],
    [
      '서체',
      font
        ? `${font.url} · ${formatBytes(font.byteLength)} · data URL ${font.dataUrlCharacters.toLocaleString('en-US')}자 · transferSize ${font.transferSize ?? '없음'} · encodedBodySize ${font.encodedBodySize ?? '없음'}`
        : `실패: ${state.fontError ?? '준비 전'}`,
    ],
    [
      '사진',
      `${TEST_PHOTO_URL} · ${formatBytes(raster.photoBytes)}${domPhoto ? ` · 원본 ${domPhoto.naturalWidth}×${domPhoto.naturalHeight}` : ''}`,
    ],
    ['사진 원본 폭 ÷ (CSS 폭 × 배율)', describePhotoCoverage(raster.scale)],
    ['첫 그리기 내용 확인(WebKit 219770·39059)', describePaintCheck(raster.paint)],
    [`늦은 다시 그리기 비교(${LATE_DRAW_DELAY_MS}ms 뒤, 임시)`, describeLateDraw(state.rasterRecord)]
  );
  return rows;
}

function describePhotoCoverage(scale: number): string {
  if (!domPhoto || domPhoto.naturalWidth === 0) return '–';
  const cssWidth = domPhoto.getBoundingClientRect().width;
  const coverage = photoSourceCoverage(domPhoto.naturalWidth, cssWidth, scale);
  const verdict = coverage < 1 ? '원본이 모자라 늘려 그림' : '원본이 충분함';
  return `${domPhoto.naturalWidth} ÷ (${cssWidth.toFixed(1)} × ${scale}) = ${coverage.toFixed(2)} (${verdict})`;
}

function environmentRows(): TableRow[] {
  const environment = glPanel?.environment;
  const viewport = window.visualViewport;
  const rows: TableRow[] = [
    ['UA', navigator.userAgent],
    ['devicePixelRatio', String(window.devicePixelRatio)],
    ['화면(screen)', `${screen.width}×${screen.height} (avail ${screen.availWidth}×${screen.availHeight})`],
    ['창(inner)', `${window.innerWidth}×${window.innerHeight}`],
    [
      'visualViewport',
      viewport ? `${viewport.width.toFixed(1)}×${viewport.height.toFixed(1)}, scale ${viewport.scale}` : '없음',
    ],
    [
      'ResizeObserver devicePixelContentBox',
      state.observesDevicePixelContentBox ? '지원' : '미지원(contentBox×DPR로 계산)',
    ],
  ];
  if (!environment) {
    rows.push(['WebGL2', glFailure ?? '없음']);
    return rows;
  }
  rows.push(
    ['WebGL2', environment.version],
    ['GLSL', environment.shadingLanguageVersion],
    ['렌더러(UNMASKED)', environment.unmaskedRenderer ?? '확장 없음'],
    ['벤더(UNMASKED)', environment.unmaskedVendor ?? '확장 없음'],
    ['RENDERER', environment.renderer],
    ['VENDOR', environment.vendor],
    ['MAX_TEXTURE_SIZE', String(environment.maxTextureSize)],
    ['MAX_RENDERBUFFER_SIZE', String(environment.maxRenderbufferSize)],
    ['MAX_VIEWPORT_DIMS', environment.maxViewportDims],
    ['컨텍스트 속성', JSON.stringify(environment.contextAttributes)],
    ['업로드 설정', JSON.stringify(UNPACK_SETTINGS)]
  );
  return rows;
}

function buildResultJson(): Record<string, unknown> {
  return {
    harness: 'apps/stickerbook/spikes/s1',
    recordedAt: new Date().toISOString(),
    note: '회색 플레이스홀더 하네스 측정값이다. 시안 아님. 성능 수치는 실기기 값만 쓴다(spikes.md).',
    config: {
      cssSize: state.cssSize,
      scaleMode: state.scaleMode,
      scale: currentScale(),
      sizing: state.sizing,
      filter: state.filter,
      finishAfterUpload: state.finishAfterUpload,
      fontUrl: state.fontUrl,
      photoUrl: TEST_PHOTO_URL,
      lateDrawDelayMs: LATE_DRAW_DELAY_MS,
    },
    environment: Object.fromEntries(environmentRows()),
    raster: Object.fromEntries(rasterRows()),
    screenPlacement: screenPlacementJson(),
    measureNotes: {
      loadSteps: '페이지 로드 1회(font-fetch·font-register·font-embed)',
      summariesByKey: '재래스터 키별, 반영된 래스터만, 첫 래스터(cold)·버린 세대·실패 제외',
      rasters: '래스터 한 건씩(steps는 sb:s1:<사건> ms). cold는 페이지 로드 뒤 첫 반영',
      drawFlush: 'draw-flush는 1px 읽기로 미룬 SVG 래스터를 끝낸 시간. 운영 경로에서는 이 비용이 tex-image-2d로 간다',
    },
    loadSteps: roundSteps(state.loadSteps),
    summaryKey: currentSummaryKey(),
    summariesByKey: warmSummaries().map(summary => ({
      ...summary,
      events: Object.fromEntries(
        Object.entries(summary.events).map(([event, durations]) => [event, roundSummary(durations)])
      ),
    })),
    rasters: state.records.map(record => ({ ...record, steps: roundSteps(record.steps) })),
    pixelComparison: state.pixelComparison,
    log: logEntries,
  };
}

function roundMs(ms: number): number {
  return Math.round(ms * 1000) / 1000;
}

function roundSummary(summary: DurationSummary): DurationSummary {
  return {
    count: summary.count,
    last: roundMs(summary.last),
    median: roundMs(summary.median),
    min: roundMs(summary.min),
    max: roundMs(summary.max),
  };
}

function roundSteps(steps: StepDurations): StepDurations {
  return Object.fromEntries(Object.entries(steps).map(([event, ms]) => [event, roundMs(ms)]));
}

async function copyResultJson(): Promise<void> {
  const text = JSON.stringify(buildResultJson(), null, 2);
  jsonFallback.value = text;
  try {
    await navigator.clipboard.writeText(text);
    jsonFallback.hidden = true;
    copyStatus.textContent = `복사함(${text.length.toLocaleString('en-US')}자)`;
  } catch (error) {
    jsonFallback.hidden = false;
    jsonFallback.focus();
    jsonFallback.select();
    copyStatus.textContent = `클립보드에 쓰지 못했다(${describeError(error)}). 아래 텍스트를 선택해 두었다.`;
  }
}

// ── 로그와 오류 ──────────────────────────────────────────────────

function log(message: string): void {
  const now = new Date();
  const entry: LogEntry = { at: now.toISOString(), sinceLoadMs: Math.round(performance.now()), message };
  logEntries.push(entry);
  if (logEntries.length > LOG_LIMIT) logEntries.shift();
  const item = document.createElement('li');
  const time = document.createElement('time');
  time.dateTime = entry.at;
  time.textContent = `${clockText(now)} (+${entry.sinceLoadMs}ms)`;
  item.append(time, ` ${message}`);
  logList.prepend(item);
  while (logList.childElementCount > LOG_LIMIT) logList.lastElementChild?.remove();
}

function showError(message: string): void {
  const paragraph = document.createElement('p');
  paragraph.textContent = message;
  errorBox.append(paragraph);
  errorBox.hidden = false;
  log(`오류: ${message}`);
}

function clockText(date: Date): string {
  const pad = (value: number, length = 2): string => String(value).padStart(length, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describeScaleMode(): string {
  return state.scaleMode === 'auto' ? `자동=DPR ${window.devicePixelRatio}` : `강제 ${state.scaleMode}`;
}

function readIntParam(name: string, min: number, max: number, fallback: number): number {
  const raw = params.get(name);
  return raw === null ? fallback : clampInt(Number(raw), min, max, fallback);
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), min), max);
}
