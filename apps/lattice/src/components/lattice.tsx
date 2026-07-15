import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Dices } from 'lucide-react';
import * as React from 'react';

import {
  type AsciiMode,
  type AsciiTarget,
  coverSourceRect,
  luminanceToChar,
  renderAsciiFrame,
  saturateChannel,
} from './lattice/ascii';

// 순수 헬퍼는 lattice/ascii.ts로 이동했다. 기존 테스트 import 경로 유지를 위해 re-export.
export { coverSourceRect, luminanceToChar, saturateChannel };

// CC0/공개 샘플 영상. 전부 CORS(ACAO) 허용 소스만 사용 —
// ascii 존이 canvas getImageData로 픽셀을 읽어야 해서 필수 조건이다.
// x/y/w는 viewport %, z로 레이어를 서로 겹친다
const VIDEOS = [
  {
    id: 'bunny',
    src: 'https://mdn.github.io/learning-area/html/multimedia-and-embedding/video-and-audio-content/rabbit320.mp4',
    x: 6,
    y: 10,
    w: 42,
    z: 10,
  },
  {
    id: 'sintel',
    src: 'https://mdn.github.io/shared-assets/videos/sintel-short.mp4',
    x: 38,
    y: 6,
    w: 34,
    z: 20,
  },
  {
    id: 'flower',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    x: 14,
    y: 48,
    w: 30,
    z: 30,
  },
  {
    id: 'friday',
    src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
    x: 40,
    y: 44,
    w: 36,
    z: 10,
  },
];

const FILTERS: Record<string, string> = {
  mono: 'grayscale(1) contrast(1.15)',
  heat: 'hue-rotate(310deg) saturate(2.4)',
  acid: 'invert(1) hue-rotate(180deg)',
  dream: 'blur(3px) brightness(1.15) saturate(1.4)',
  vhs: 'sepia(0.7) contrast(1.3) saturate(1.6)',
  // css backdrop-filter가 아니라 canvas 합성(AsciiPane)으로 렌더링되는 특수 필터
  ascii: 'none',
  'ascii-rgb': 'none',
  dots: 'none',
};

// canvas(AsciiPane)로 렌더되는 필터 → 렌더 모드. 나머지 키는 CSS backdrop-filter.
const CANVAS_FILTER_MODE: Record<string, AsciiMode> = {
  ascii: 'mono',
  'ascii-rgb': 'rgb',
  dots: 'dots',
};
const canvasFilterMode = (key: string): AsciiMode | undefined => CANVAS_FILTER_MODE[key];

// z 오름차순 겹침 순서는 고정이다. 프레임마다 존마다 toSorted로 새 배열을
// 뽑지 않도록 모듈 스코프에서 한 번만 정렬한다.
const VIDEOS_BY_Z = [...VIDEOS].toSorted((a, b) => a.z - b.z);

type Pane = { id: number; filter: string; x: number; y: number; w: number; h: number };

const INITIAL_PANES: Pane[] = [
  { id: 1, filter: 'mono', x: 140, y: 150, w: 340, h: 240 },
  { id: 2, filter: 'ascii-rgb', x: 540, y: 380, w: 400, h: 270 },
];

const PANE_MIN_W = 140;
const PANE_MIN_H = 100;
const PANE_DEFAULT_W = 340;
const PANE_DEFAULT_H = 240;
// 박스 가장자리에서 이 거리(px) 안을 잡으면 이동 대신 해당 변 리사이즈로 판정한다
const EDGE_GRAB = 16;

type Box = { x: number; y: number; w: number; h: number };
export type ResizeEdges = { l: boolean; r: boolean; t: boolean; b: boolean };

// 잡은 지점이 어느 변에 가까운지 판정. 어느 변도 아니면 null(= 이동).
export function edgesAt(box: Box, cx: number, cy: number, grab = EDGE_GRAB): ResizeEdges | null {
  const near = (value: number, target: number) => Math.abs(value - target) <= grab;
  const edges = {
    l: near(cx, box.x),
    r: near(cx, box.x + box.w),
    t: near(cy, box.y),
    b: near(cy, box.y + box.h),
  };
  return edges.l || edges.r || edges.t || edges.b ? edges : null;
}

// 선택된 변들을 커서 위치로 끌어 리사이즈. 반대편 변은 고정되고 최소 크기를 지킨다.
export function resizeBox<T extends Box>(
  box: T,
  edges: ResizeEdges,
  cx: number,
  cy: number,
  minW = PANE_MIN_W,
  minH = PANE_MIN_H
): T {
  let { x, y, w, h } = box;
  const right = x + w;
  const bottom = y + h;
  if (edges.r) w = Math.max(minW, cx - x);
  if (edges.b) h = Math.max(minH, cy - y);
  if (edges.l) {
    x = Math.min(cx, right - minW);
    w = right - x;
  }
  if (edges.t) {
    y = Math.min(cy, bottom - minH);
    h = bottom - y;
  }
  return { ...box, x, y, w, h };
}

// 잡은 변 조합 → 네이티브 커서. 가장자리가 아니면 이동, 꼭짓점은 대각 리사이즈.
export function cursorForEdges(edges: ResizeEdges | null) {
  if (!edges) return 'move';
  if ((edges.l && edges.t) || (edges.r && edges.b)) return 'nwse-resize';
  if ((edges.r && edges.t) || (edges.l && edges.b)) return 'nesw-resize';
  if (edges.l || edges.r) return 'ew-resize';
  return 'ns-resize';
}

// 핀치 임계값 — 엄지-검지 거리를 손바닥 길이(손목~중지 뿌리)로 나눈 비율.
// 절대 거리가 아니라서 손이 카메라에서 멀어져도 판정이 일정하다.
const PINCH_ON = 0.35;
const PINCH_OFF = 0.5;
// 핀치 비율 자체의 프레임 간 노이즈를 누르는 EMA 계수
const PINCH_RATIO_SMOOTHING = 0.5;
// 카메라 프레임 가장자리는 손이 잘리므로 중앙 영역만 화면 전체로 사상
const EDGE_MARGIN = 0.18;

export function pinchDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function nextPinch(wasPinching: boolean, ratio: number) {
  return wasPinching ? ratio < PINCH_OFF : ratio < PINCH_ON;
}

export function remapToScreen(v: number) {
  return Math.min(1, Math.max(0, (v - EDGE_MARGIN) / (1 - 2 * EDGE_MARGIN)));
}

// One Euro Filter — 천천히 움직일 땐 저역 통과로 떨림을 누르고,
// 빨리 움직일 땐 컷오프를 올려 지연 없이 따라온다. (Casiez et al. 2012)
export function createOneEuro(minCutoff = 1.2, beta = 0.02, dCutoff = 1) {
  let prev: { t: number; x: number; dx: number } | null = null;
  const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
  return (x: number, tMs: number) => {
    if (!prev) {
      prev = { t: tMs, x, dx: 0 };
      return x;
    }
    const dt = Math.max((tMs - prev.t) / 1000, 1e-3);
    const dxRaw = (x - prev.x) / dt;
    const dx = prev.dx + alpha(dCutoff, dt) * (dxRaw - prev.dx);
    const cutoff = minCutoff + beta * Math.abs(dx);
    const filtered = prev.x + alpha(cutoff, dt) * (x - prev.x);
    prev = { t: tMs, x: filtered, dx };
    return filtered;
  };
}

// ascii 존 — 존 아래에 겹친 비디오·웹캠의 해당 영역만 잘라 저해상도로 합성한 뒤
// 밝기를 문자(mono/rgb) 또는 원(dots)으로 치환해 그린다. 영상이 없는 영역은 검정으로 남는다.
function AsciiPane({
  pane,
  videoEls,
  mode,
}: {
  pane: Pane;
  videoEls: React.RefObject<Record<string, HTMLVideoElement | null>>;
  mode: AsciiMode;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const paneRef = React.useRef(pane);
  React.useEffect(() => {
    paneRef.current = pane;
  });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sample = document.createElement('canvas');
    const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
    if (!ctx || !sampleCtx) return;

    const FONT_SIZE = 10;
    // ascii는 저해상도 스타일 이펙트라 30fps면 충분하다. 60fps 대비 렌더 비용 절반 —
    // 존이 늘수록 커지는 프레임당 getImageData/fillText 총량을 가장 크게 줄이는 지점.
    const FRAME_INTERVAL = 1000 / 30;
    let rafId = 0;
    let lastFrame = -Infinity;

    const draw = (t: number) => {
      rafId = requestAnimationFrame(draw);
      if (t - lastFrame < FRAME_INTERVAL) return;
      lastFrame = t;
      // 낮은 z부터 그려 실제 화면과 같은 겹침 순서를 유지한다. 웹캠 PIP는 최상단.
      const els = videoEls.current;
      const targets: AsciiTarget[] = [];
      for (const v of VIDEOS_BY_Z) {
        const el = els[v.id];
        if (el) targets.push({ el, mirror: false });
      }
      if (els.cam) targets.push({ el: els.cam, mirror: true });
      renderAsciiFrame(ctx, canvas, sample, sampleCtx, paneRef.current, targets, mode, FONT_SIZE);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [videoEls, mode]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}

type TrackingStatus = 'loading' | 'ready' | 'error';

const pad2 = (n: number) => String(n).padStart(2, '0');

function CornerBrackets() {
  return (
    <>
      <span className="pointer-events-none absolute -left-px -top-px size-4 border-l border-t border-white/80" />
      <span className="pointer-events-none absolute -right-px -top-px size-4 border-r border-t border-white/80" />
      <span className="pointer-events-none absolute -bottom-px -left-px size-4 border-b border-l border-white/80" />
      <span className="pointer-events-none absolute -bottom-px -right-px size-4 border-b border-r border-white/80" />
    </>
  );
}

type DragState = {
  // 손 추적 루프는 'hand' 드래그만 소유한다 — 손이 프레임에 없다고
  // 마우스가 진행 중인 드래그를 지우면 안 된다
  source: 'hand' | 'mouse';
  kind: 'pane' | 'video';
  id: number | string;
  edges: ResizeEdges | null; // null이면 이동
  offX: number;
  offY: number;
};

const CAM_W = 176;
const CAM_H = 99;

// 초기 % 배치를 현재 viewport 기준 px 박스로 변환 (이후에는 자유 배치).
// 웹캠 PIP('cam')도 같은 박스로 관리해 동일하게 이동/리사이즈된다.
const initialVideoRects = (): Record<string, Box> =>
  Object.fromEntries([
    ...VIDEOS.map(v => {
      const w = (v.w / 100) * window.innerWidth;
      return [
        v.id,
        { x: (v.x / 100) * window.innerWidth, y: (v.y / 100) * window.innerHeight, w, h: (w * 9) / 16 },
      ] as const;
    }),
    ['cam', { x: 24, y: window.innerHeight - 24 - CAM_H, w: CAM_W, h: CAM_H }] as const,
  ]);

export function Lattice() {
  const [panes, setPanes] = React.useState<Pane[]>(INITIAL_PANES);
  const [videoRects, setVideoRects] = React.useState<Record<string, Box>>(initialVideoRects);
  const [grabbed, setGrabbed] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<TrackingStatus>('loading');
  const camRef = React.useRef<HTMLVideoElement>(null);
  const cursorRef = React.useRef<HTMLDivElement>(null);
  const coordRef = React.useRef<HTMLSpanElement>(null);
  const grabbedRef = React.useRef<string | null>(null);
  const videoEls = React.useRef<Record<string, HTMLVideoElement | null>>({});
  const panesRef = React.useRef(panes);
  const videoRectsRef = React.useRef(videoRects);
  React.useEffect(() => {
    panesRef.current = panes;
    videoRectsRef.current = videoRects;
  });
  const dragRef = React.useRef<DragState | null>(null);
  const nextPaneId = React.useRef(INITIAL_PANES.length + 1);

  const spawnPane = (filter: string, cx: number, cy: number) => {
    const id = nextPaneId.current++;
    setPanes(prev => [
      ...prev,
      {
        id,
        filter,
        x: cx - PANE_DEFAULT_W / 2,
        y: cy - PANE_DEFAULT_H / 2,
        w: PANE_DEFAULT_W,
        h: PANE_DEFAULT_H,
      },
    ]);
  };

  const closePane = (id: number) => setPanes(prev => prev.filter(p => p.id !== id));

  // 모든 영상·웹캠·필터 존을 뷰포트 안에서 랜덤 위치·크기로 재배치
  const shuffle = () => {
    const { innerWidth: vw, innerHeight: vh } = window;
    const rand = (min: number, max: number) => min + Math.random() * Math.max(0, max - min);
    const place = (w: number, h: number): Box => ({ x: rand(0, vw - w), y: rand(0, vh - h), w, h });
    // 영상은 16:9로 뽑아 자연스럽게, 필터 존은 자유 비율
    const videoBox = () => {
      const w = rand(220, vw * 0.45);
      return place(w, Math.min((w * 9) / 16, vh * 0.9));
    };
    const paneBox = () => place(rand(PANE_MIN_W, vw * 0.5), rand(PANE_MIN_H, vh * 0.6));
    const filterKeys = Object.keys(FILTERS);
    const randomFilter = () => filterKeys[Math.floor(Math.random() * filterKeys.length)]!;

    setVideoRects(prev => Object.fromEntries(Object.keys(prev).map(id => [id, videoBox()])));
    setPanes(prev => prev.map(p => ({ ...p, filter: randomFilter(), ...paneBox() })));
  };

  // 마우스로 칩을 끌어다 놓으면 그 자리에 존 생성 (8px 미만 이동은 클릭으로 간주)
  const chipDraggedRef = React.useRef(false);
  // 마우스 칩 캐리가 진행 중이면 손 추적 루프가 커서/하이라이트를 끄지 못하게 막는다
  const mouseChipRef = React.useRef(false);

  const onChipPointerDown = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    chipDraggedRef.current = false;
    mouseChipRef.current = true;
    setGrabbed(key);
    const cursor = cursorRef.current;
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) chipDraggedRef.current = true;
      if (cursor && chipDraggedRef.current) {
        cursor.style.opacity = '1';
        cursor.dataset.state = 'carry';
        cursor.style.transform = `translate3d(${ev.clientX}px, ${ev.clientY}px, 0)`;
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      mouseChipRef.current = false;
      setGrabbed(null);
      if (cursor) {
        cursor.style.opacity = '0';
        cursor.dataset.state = 'idle';
      }
      if (chipDraggedRef.current) spawnPane(key, ev.clientX, ev.clientY);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const onChipClick = (key: string) => () => {
    // 드래그로 이미 생성한 경우 뒤따라오는 click은 무시한다
    if (chipDraggedRef.current) {
      chipDraggedRef.current = false;
      return;
    }
    spawnPane(key, window.innerWidth / 2 + panesRef.current.length * 24, window.innerHeight / 2);
  };

  const boxOf = (kind: DragState['kind'], id: DragState['id']): Box | undefined =>
    kind === 'pane' ? panesRef.current.find(p => p.id === id) : videoRectsRef.current[String(id)];

  // 잡은 위치가 가장자리면 해당 변 리사이즈, 아니면 이동
  const beginDrag = (
    source: DragState['source'],
    kind: DragState['kind'],
    id: DragState['id'],
    cx: number,
    cy: number
  ) => {
    const box = boxOf(kind, id);
    if (!box) return;
    dragRef.current = {
      source,
      kind,
      id,
      edges: edgesAt(box, cx, cy),
      offX: cx - box.x,
      offY: cy - box.y,
    };
  };

  const updateDrag = (cx: number, cy: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const apply = <T extends Box>(box: T): T =>
      drag.edges ? resizeBox(box, drag.edges, cx, cy) : { ...box, x: cx - drag.offX, y: cy - drag.offY };
    if (drag.kind === 'pane') {
      setPanes(prev => prev.map(p => (p.id === drag.id ? apply(p) : p)));
    } else {
      setVideoRects(prev => ({ ...prev, [drag.id]: apply(prev[String(drag.id)]!) }));
    }
  };

  // 가장자리에 가까우면 방향 리사이즈 커서, 아니면 이동 커서 (드래그 중엔 body 커서가 고정)
  const onBoxHover = (kind: DragState['kind'], id: DragState['id']) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current) return;
    const box = boxOf(kind, id);
    if (box) e.currentTarget.style.cursor = cursorForEdges(edgesAt(box, e.clientX, e.clientY));
  };

  const onBoxPointerDown = (kind: DragState['kind'], id: DragState['id']) => (e: React.PointerEvent) => {
    e.preventDefault();
    beginDrag('mouse', kind, id, e.clientX, e.clientY);
    // 드래그 동안 커서가 박스를 벗어나도 유지되도록 body에 고정
    document.body.style.cursor = cursorForEdges(dragRef.current?.edges ?? null);
    const move = (ev: PointerEvent) => updateDrag(ev.clientX, ev.clientY);
    const up = () => {
      document.body.style.cursor = '';
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  React.useEffect(() => {
    let disposed = false;
    let rafId = 0;
    let stream: MediaStream | null = null;
    let landmarker: HandLandmarker | null = null;
    let pinching = false;
    let pinchRatio: number | null = null;
    let filterX: ReturnType<typeof createOneEuro> | null = null;
    let filterY: ReturnType<typeof createOneEuro> | null = null;

    const grab = (filterKey: string | null) => {
      grabbedRef.current = filterKey;
      setGrabbed(filterKey);
    };

    const hitTest = (x: number, y: number, attr: string) =>
      document.elementFromPoint(x, y)?.closest<HTMLElement>(`[${attr}]`)?.getAttribute(attr) ?? null;

    const dirOf = (e: ResizeEdges) =>
      (e.l || e.r) && (e.t || e.b) ? 'resize-xy' : e.l || e.r ? 'resize-x' : 'resize-y';

    // 커서 아래에 무엇이 있는지 → 핀치했을 때 일어날 동작을 미리 알려주는 hover 상태
    const hoverStateAt = (x: number, y: number) => {
      if (grabbedRef.current) return 'carry';
      if (hitTest(x, y, 'data-pane-close')) return 'close';
      if (hitTest(x, y, 'data-shuffle')) return 'chip';
      if (hitTest(x, y, 'data-filter-chip')) return 'chip';
      const paneId = hitTest(x, y, 'data-pane-id');
      const videoId = paneId ? null : hitTest(x, y, 'data-video-id');
      if (!paneId && !videoId) return 'idle';
      const box = paneId ? boxOf('pane', Number(paneId)) : boxOf('video', videoId!);
      if (!box) return 'idle';
      const edges = edgesAt(box, x, y);
      return edges ? dirOf(edges) : 'move';
    };

    const onPinchStart = (x: number, y: number) => {
      // 마우스가 드래그 중이면 손이 그 드래그를 가로채지 않는다
      if (dragRef.current?.source === 'mouse') return;
      if (hitTest(x, y, 'data-shuffle')) {
        shuffle();
        return;
      }
      const close = hitTest(x, y, 'data-pane-close');
      if (close) {
        closePane(Number(close));
        return;
      }
      const chip = hitTest(x, y, 'data-filter-chip');
      if (chip) {
        grab(chip);
        return;
      }
      const paneId = hitTest(x, y, 'data-pane-id');
      if (paneId) {
        beginDrag('hand', 'pane', Number(paneId), x, y);
        return;
      }
      const videoId = hitTest(x, y, 'data-video-id');
      if (videoId) beginDrag('hand', 'video', videoId, x, y);
    };

    const onPinchEnd = (x: number, y: number) => {
      if (grabbedRef.current) {
        spawnPane(grabbedRef.current, x, y);
        grab(null);
      }
      if (dragRef.current?.source === 'hand') dragRef.current = null;
    };

    // 손 추적(MediaPipe 추론)은 프레임당 가장 비싼 작업이다. 커서 갱신은 30fps면
    // 충분하므로 detectForVideo 호출을 30fps로 제한해 상시 GPU/CPU 부하를 절반으로 낮춘다.
    const TRACK_INTERVAL = 1000 / 30;
    let lastTrack = -Infinity;

    const track = (t: number) => {
      rafId = requestAnimationFrame(track);
      if (t - lastTrack < TRACK_INTERVAL) return;
      lastTrack = t;

      const cam = camRef.current;
      const cursor = cursorRef.current;
      if (!cam || !cursor || !landmarker) return;

      if (cam.readyState >= 2) {
        const result = landmarker.detectForVideo(cam, t);
        const hand = result.landmarks[0];
        const wrist = hand?.[0];
        const thumbTip = hand?.[4];
        const indexTip = hand?.[8];
        const middleMcp = hand?.[9];
        if (wrist && thumbTip && indexTip && middleMcp) {
          // 커서 앵커는 엄지-검지 중간점 — 핀치 동작으로 검지가 움직여도 커서가 밀리지 않는다.
          // 셀피 뷰라 x를 미러링하고, 랜드마크 노이즈는 One Euro Filter로 누른다.
          const mid = { x: (thumbTip.x + indexTip.x) / 2, y: (thumbTip.y + indexTip.y) / 2 };
          filterX ??= createOneEuro();
          filterY ??= createOneEuro();
          const x = filterX(remapToScreen(1 - mid.x), t) * window.innerWidth;
          const y = filterY(remapToScreen(mid.y), t) * window.innerHeight;
          cursor.style.opacity = '1';
          cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
          if (coordRef.current) {
            coordRef.current.textContent = `X:${pad2(Math.round((x / window.innerWidth) * 100))} Y:${pad2(Math.round((y / window.innerHeight) * 100))}`;
          }

          const palmLength = Math.max(pinchDistance(wrist, middleMcp), 1e-6);
          const rawRatio = pinchDistance(thumbTip, indexTip) / palmLength;
          pinchRatio = pinchRatio === null ? rawRatio : pinchRatio + PINCH_RATIO_SMOOTHING * (rawRatio - pinchRatio);

          const wasPinching = pinching;
          pinching = nextPinch(pinching, pinchRatio);
          cursor.dataset.pinching = String(pinching);

          if (!wasPinching && pinching) {
            onPinchStart(x, y);
          } else if (wasPinching && pinching) {
            if (dragRef.current?.source === 'hand') updateDrag(x, y);
          } else if (wasPinching && !pinching) {
            onPinchEnd(x, y);
          }

          // 드래그 중이면 그 동작을, 아니면 커서 아래 hover 의도를 커서 디자인에 반영
          const drag = dragRef.current;
          cursor.dataset.state =
            drag?.source === 'hand' ? (drag.edges ? dirOf(drag.edges) : 'move') : hoverStateAt(x, y);
        } else {
          // 손이 프레임에 없을 때는 손이 소유한 상태만 정리한다 —
          // 마우스 드래그/칩 캐리는 건드리지 않는다 (마우스 사용 중엔 보통 손이 없다)
          pinching = false;
          pinchRatio = null;
          filterX = null;
          filterY = null;
          if (!mouseChipRef.current) {
            cursor.style.opacity = '0';
            cursor.dataset.state = 'idle';
          }
          if (grabbedRef.current) grab(null);
          if (dragRef.current?.source === 'hand') dragRef.current = null;
        }
      }
    };

    const init = async () => {
      // 카메라 권한을 먼저 확보해서 거부/미지원이면 모델 다운로드 없이 바로 폴백으로 빠진다
      const [media, vision] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } }),
        FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'),
      ]);
      stream = media;
      landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });
      if (disposed) {
        // cleanup이 이미 지나간 뒤라 여기서 직접 스트림을 정리해야 한다
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      const cam = camRef.current!;
      cam.srcObject = stream;
      await cam.play();
      setStatus('ready');
      rafId = requestAnimationFrame(track);
    };

    init().catch(() => {
      // 카메라 확보 후 모델 초기화가 실패한 경우 스트림을 잡아둔 채 방치하지 않는다
      stream?.getTracks().forEach(t => t.stop());
      setStatus('error');
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach(t => t.stop());
      landmarker?.close();
    };
    // eslint 대응이 아니라 실제로 마운트 1회만 실행되어야 하는 카메라/모델 초기화
  }, []);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:72px_72px] font-mono uppercase text-white">
      {VIDEOS.map((video, i) => {
        const rect = videoRects[video.id]!;
        return (
          <div
            key={video.id}
            data-video-id={video.id}
            className="absolute"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: video.z }}
          >
            <video
              ref={el => {
                videoEls.current[video.id] = el;
              }}
              aria-label={`${video.id} layer`}
              src={video.src}
              crossOrigin="anonymous"
              autoPlay
              muted
              loop
              playsInline
              className="size-full bg-white/5 object-cover"
            />
            <button
              type="button"
              aria-label={`adjust ${video.id} layer`}
              onPointerDown={onBoxPointerDown('video', video.id)}
              onPointerMove={onBoxHover('video', video.id)}
              className="absolute inset-0 size-full cursor-move"
            />
            <CornerBrackets />
            <span className="pointer-events-none absolute left-0 top-0 bg-black/70 px-2 py-1 text-[10px] tracking-[0.2em] text-white/90">
              CH_{pad2(i + 1)} {video.id}
            </span>
            <span className="pointer-events-none absolute bottom-0 right-0 bg-black/70 px-2 py-1 text-[10px] tracking-[0.2em] text-white/70">
              X:{pad2(Math.round((rect.x / window.innerWidth) * 100))} Y:
              {pad2(Math.round((rect.y / window.innerHeight) * 100))} W:
              {pad2(Math.round((rect.w / window.innerWidth) * 100))}
            </span>
          </div>
        );
      })}

      {panes.map(pane => {
        const mode = canvasFilterMode(pane.filter);
        return (
          <div
            key={pane.id}
            data-pane-id={pane.id}
            className="absolute border border-dashed border-white/70"
            style={{
              left: pane.x,
              top: pane.y,
              width: pane.w,
              height: pane.h,
              zIndex: 35,
              backdropFilter: FILTERS[pane.filter],
              WebkitBackdropFilter: FILTERS[pane.filter],
            }}
          >
            {mode && <AsciiPane pane={pane} videoEls={videoEls} mode={mode} />}
            <button
              type="button"
              aria-label={`adjust ${pane.filter} pane`}
              onPointerDown={onBoxPointerDown('pane', pane.id)}
              onPointerMove={onBoxHover('pane', pane.id)}
              className="absolute inset-0 size-full cursor-move"
            />
            <span className="pointer-events-none absolute left-0 top-0 bg-white px-2 py-1 text-[10px] tracking-[0.2em] text-black">
              FLT:{pane.filter}
            </span>
            <button
              type="button"
              aria-label="close pane"
              data-pane-close={pane.id}
              onClick={() => closePane(pane.id)}
              className="absolute right-0 top-0 flex size-10 cursor-pointer items-center justify-center bg-black/70 text-base text-white/80 transition-colors hover:bg-white hover:text-black"
            >
              ✕
            </button>
          </div>
        );
      })}

      <header className="absolute left-6 top-6 z-40">
        <h1 className="text-lg tracking-[0.4em]">Lattice</h1>
        <p className="mt-1 text-[11px] tracking-[0.2em] text-white/50">
          {status === 'loading' && 'initializing hand tracker'}
          {status === 'error' && 'camera offline — drag chips & boxes with mouse'}
          {status === 'ready' && 'pinch chip → drop zone · pinch body → move · pinch edge → resize'}
        </p>
      </header>

      <button
        type="button"
        aria-label="shuffle layout"
        data-shuffle="1"
        onClick={shuffle}
        className="absolute right-6 top-6 z-50 flex size-16 items-center justify-center border border-white/30 bg-black/50 text-white/80 backdrop-blur transition-colors hover:border-white/70 hover:bg-white/10 hover:text-white"
      >
        <Dices className="size-5" />
      </button>

      <nav className="absolute right-6 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-3">
        {Object.entries(FILTERS).map(([key, value], i) => (
          <button
            key={key}
            type="button"
            aria-label={`filter ${key}`}
            data-filter-chip={key}
            onPointerDown={onChipPointerDown(key)}
            onClick={onChipClick(key)}
            className={`flex w-52 items-center gap-4 border px-5 py-4 text-base tracking-[0.25em] backdrop-blur transition-colors ${
              grabbed === key ? 'border-white bg-white/25' : 'border-white/30 bg-black/50 hover:border-white/70'
            }`}
          >
            <span className="text-xs text-white/40">F{i + 1}</span>
            {canvasFilterMode(key) ? (
              <span
                className={`flex size-5 items-center justify-center border border-white/50 text-[11px] normal-case ${
                  key === 'ascii-rgb'
                    ? 'bg-[linear-gradient(135deg,#f59e0b,#ec4899,#3b82f6)] bg-clip-text text-transparent'
                    : ''
                }`}
              >
                {key === 'dots' ? '●' : '@'}
              </span>
            ) : (
              <span className="size-5 bg-[linear-gradient(135deg,#f59e0b,#ec4899,#3b82f6)]" style={{ filter: value }} />
            )}
            {key}
          </button>
        ))}
      </nav>

      {/* 필터 존(z 35)보다 아래(z 32)에 둬서 웹캠 프리뷰에도 backdrop-filter/ascii가 적용된다 */}
      <div
        data-video-id="cam"
        className="absolute z-[32]"
        style={{
          left: videoRects.cam!.x,
          top: videoRects.cam!.y,
          width: videoRects.cam!.w,
          height: videoRects.cam!.h,
        }}
      >
        <video
          ref={el => {
            camRef.current = el;
            videoEls.current.cam = el;
          }}
          aria-label="webcam preview"
          muted
          playsInline
          className="size-full -scale-x-100 bg-white/5 object-cover opacity-80"
        />
        <button
          type="button"
          aria-label="adjust cam layer"
          onPointerDown={onBoxPointerDown('video', 'cam')}
          onPointerMove={onBoxHover('video', 'cam')}
          className="absolute inset-0 size-full cursor-move"
        />
        <CornerBrackets />
        <span className="pointer-events-none absolute left-2 top-1.5 text-[10px] tracking-[0.2em] text-white/70">
          CAM_00
        </span>
      </div>

      {/* 코너 브래킷·pane 테두리와 같은 각진 라인 언어. 밝은 영상 위 가시성은 검은 외곽선(drop-shadow)으로 확보 */}
      <div
        ref={cursorRef}
        data-testid="hand-cursor"
        data-state="idle"
        className="pointer-events-none absolute left-0 top-0 z-[60] opacity-0 [filter:drop-shadow(0_0_2px_rgba(0,0,0,0.9))]"
      >
        <span className="absolute size-5 -translate-x-1/2 -translate-y-1/2 border border-white/80 transition-all [[data-state=move]>&]:bg-white/10 [[data-state=chip]>&]:scale-110 [[data-state=chip]>&]:border-white [[data-state=carry]>&]:border-white [[data-state=carry]>&]:bg-white/20 [[data-state=resize-x]>&]:scale-x-150 [[data-state=resize-y]>&]:scale-y-150 [[data-state=resize-xy]>&]:scale-150 [[data-state=close]>&]:border-red-500" />
        <span className="absolute size-1 -translate-x-1/2 -translate-y-1/2 bg-white transition-all [[data-pinching=true]>&]:scale-[5] [[data-state=close]>&]:bg-red-500" />
        <span
          ref={coordRef}
          className="absolute left-4 top-3.5 whitespace-nowrap text-[10px] tracking-[0.2em] text-white/80"
        />
        {grabbed && (
          <span className="absolute left-4 top-8 bg-white px-1.5 py-0.5 text-[10px] tracking-widest text-black">
            {grabbed}
          </span>
        )}
      </div>
    </div>
  );
}
