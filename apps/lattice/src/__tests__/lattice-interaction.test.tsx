import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Lattice } from '../components/lattice';

// ---- MediaPipe mock ------------------------------------------------------
// 실제 wasm/카메라 없이 track 루프를 구동하기 위해 손 랜드마크를 주입한다.
const mocks = vi.hoisted(() => ({
  detectForVideo: vi.fn(),
  close: vi.fn(),
}));

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  HandLandmarker: {
    createFromOptions: vi.fn(async () => ({
      detectForVideo: mocks.detectForVideo,
      close: mocks.close,
    })),
  },
}));

// 손 하나를 표현하는 최소 랜드마크 셋 (wrist 0, thumb 4, index 8, middleMcp 9)
function hand(mid: { x: number; y: number }, pinching: boolean) {
  const spread = pinching ? 0.02 : 0.2;
  const landmarks: Array<{ x: number; y: number }> = [];
  landmarks[0] = { x: mid.x, y: mid.y + 0.3 };
  landmarks[4] = { x: mid.x - spread / 2, y: mid.y };
  landmarks[8] = { x: mid.x + spread / 2, y: mid.y };
  landmarks[9] = { x: mid.x, y: mid.y + 0.1 };
  return landmarks;
}

// 화면 px 좌표를 랜드마크 mid 좌표로 역변환 (미러링·EDGE_MARGIN 리매핑의 역함수)
function handAt(px: number, py: number, pinching: boolean) {
  const fx = px / window.innerWidth;
  const fy = py / window.innerHeight;
  return hand({ x: 1 - (0.18 + fx * 0.64), y: 0.18 + fy * 0.64 }, pinching);
}

let currentHand: Array<{ x: number; y: number }> | null = null;
let hitElement: Element | null = null;

// ---- rAF 수동 스텝 -------------------------------------------------------
let rafQueue: FrameRequestCallback[] = [];
let now = 0;

function stepFrames(count = 1) {
  for (let i = 0; i < count; i++) {
    const callbacks = rafQueue;
    rafQueue = [];
    now += 16;
    act(() => {
      callbacks.forEach(cb => cb(now));
    });
  }
}

// ---- canvas 2d mock ------------------------------------------------------
type FakeCtx = ReturnType<typeof createFakeCtx>;
const createdCtxs: FakeCtx[] = [];
let throwOnDrawImage = false;
let throwOnGetImageData = false;

function createFakeCtx() {
  return {
    font: '',
    textBaseline: '',
    fillStyle: '',
    measureText: () => ({ width: 6 }),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(() => {
      if (throwOnDrawImage) throw new Error('taint');
    }),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => {
      if (throwOnGetImageData) throw new Error('taint');
      return { data: new Uint8ClampedArray(w * h * 4).fill(140) };
    }),
  };
}

function setRect(el: Element, rect: { left: number; top: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      x: rect.left,
      y: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      toJSON: () => ({}),
    }) as DOMRect;
}

const stopTrack = vi.fn();

beforeEach(() => {
  currentHand = null;
  hitElement = null;
  rafQueue = [];
  now = 0;
  createdCtxs.length = 0;
  throwOnDrawImage = false;
  throwOnGetImageData = false;
  stopTrack.mockClear();
  mocks.detectForVideo.mockImplementation(() => ({
    landmarks: currentHand ? [currentHand] : [],
  }));

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })),
    },
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    writable: true,
    value: null,
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, 'readyState', {
    configurable: true,
    get: () => 4,
  });
  // videoWidth/videoHeight는 HTMLVideoElement 쪽 getter가 우선하므로 거기에 정의한다
  Object.defineProperty(window.HTMLVideoElement.prototype, 'videoWidth', {
    configurable: true,
    get: () => 320,
  });
  Object.defineProperty(window.HTMLVideoElement.prototype, 'videoHeight', {
    configurable: true,
    get: () => 180,
  });
  window.HTMLMediaElement.prototype.play = vi.fn(async () => {});
  window.HTMLCanvasElement.prototype.getContext = vi.fn(() => {
    const ctx = createFakeCtx();
    createdCtxs.push(ctx);
    return ctx;
  }) as never;
  document.elementFromPoint = vi.fn(() => hitElement);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderReady() {
  const view = render(<Lattice />);
  await screen.findByText(/pinch chip/);
  return view;
}

const panes = () => document.querySelectorAll('[data-pane-id]');
const paneEl = (id: number) => document.querySelector<HTMLElement>(`[data-pane-id="${id}"]`)!;

describe('hand gestures', () => {
  it('should spawn a pane when a chip is pinched and released elsewhere', async () => {
    await renderReady();
    expect(panes()).toHaveLength(2);

    hitElement = screen.getByRole('button', { name: 'filter heat' });
    currentHand = hand({ x: 0.5, y: 0.5 }, false);
    stepFrames();
    // 핀치 비율에 EMA가 걸려 있어 임계값을 넘기려면 프레임 몇 개가 필요하다
    currentHand = hand({ x: 0.5, y: 0.5 }, true);
    stepFrames(3);

    // 집는 동안 커서에 필터 이름 태그가 붙는다
    expect(within(screen.getByTestId('hand-cursor')).getByText('heat')).toBeInTheDocument();

    hitElement = null;
    currentHand = hand({ x: 0.4, y: 0.4 }, false);
    stepFrames(3);

    expect(panes()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'adjust heat pane' })).toBeInTheDocument();
  });

  it('should move a pane while pinching its body', async () => {
    await renderReady();
    const before = paneEl(1).style.left;

    // pane 1: x140 y150 w340 h240 — 몸통 중앙을 집으면 이동
    hitElement = paneEl(1);
    currentHand = handAt(310, 270, false);
    stepFrames();
    currentHand = handAt(310, 270, true);
    stepFrames(3);
    currentHand = handAt(500, 400, true);
    stepFrames(5);
    currentHand = handAt(500, 400, false);
    stepFrames(3);

    expect(paneEl(1).style.left).not.toBe(before);
  });

  it('should resize a pane while pinching near its bottom-right corner', async () => {
    await renderReady();

    hitElement = paneEl(1);
    // pane 1의 우하단 꼭짓점(480, 390) 근처를 집으면 r+b 리사이즈
    currentHand = handAt(477, 387, false);
    stepFrames();
    currentHand = handAt(477, 387, true);
    stepFrames(3);
    currentHand = handAt(700, 560, true);
    stepFrames(10);

    const { width, height } = paneEl(1).style;
    expect(Number.parseFloat(width)).toBeGreaterThan(340);
    expect(Number.parseFloat(height)).toBeGreaterThan(240);
  });

  it('should move a video layer while pinching its body', async () => {
    await renderReady();
    const bunny = document.querySelector<HTMLElement>('[data-video-id="bunny"]')!;
    const before = bunny.style.left;

    // bunny 초기 rect: x≈61 y≈77 w≈430 — 중앙(276, 198)을 집으면 이동
    hitElement = bunny;
    currentHand = handAt(276, 198, false);
    stepFrames();
    currentHand = handAt(276, 198, true);
    stepFrames(3);
    currentHand = handAt(500, 350, true);
    stepFrames(5);

    expect(bunny.style.left).not.toBe(before);
  });

  it('should hide the cursor and drop any grab when the hand disappears', async () => {
    await renderReady();
    const cursor = screen.getByTestId('hand-cursor');

    hitElement = screen.getByRole('button', { name: 'filter vhs' });
    currentHand = hand({ x: 0.5, y: 0.5 }, false);
    stepFrames();
    currentHand = hand({ x: 0.5, y: 0.5 }, true);
    stepFrames(3);
    expect(cursor.style.opacity).toBe('1');
    expect(within(cursor).getByText('vhs')).toBeInTheDocument();

    currentHand = null;
    stepFrames();
    expect(cursor.style.opacity).toBe('0');
    expect(within(cursor).queryByText('vhs')).not.toBeInTheDocument();
    // 손이 사라진 채 놓였으므로 존이 생성되지 않는다
    expect(panes()).toHaveLength(2);
  });

  it('should move the webcam PIP while pinching its body', async () => {
    await renderReady();
    const cam = document.querySelector<HTMLElement>('[data-video-id="cam"]')!;
    const before = cam.style.left;

    // cam 초기 rect: x24 y645 w176 h99 — 중앙(112, 694)을 집으면 이동
    hitElement = cam;
    currentHand = handAt(112, 694, false);
    stepFrames();
    currentHand = handAt(112, 694, true);
    stepFrames(3);
    currentHand = handAt(400, 400, true);
    stepFrames(5);

    expect(cam.style.left).not.toBe(before);
  });

  it('should close a pane when its close button is pinched', async () => {
    await renderReady();
    expect(panes()).toHaveLength(2);

    hitElement = screen.getAllByRole('button', { name: 'close pane' })[0]!;
    currentHand = hand({ x: 0.5, y: 0.5 }, false);
    stepFrames();
    currentHand = hand({ x: 0.5, y: 0.5 }, true);
    stepFrames(3);

    expect(panes()).toHaveLength(1);
  });

  it('should stop the acquired camera stream when unmounted before init settles', async () => {
    const view = render(<Lattice />);
    view.unmount();
    await act(async () => {});
    expect(stopTrack).toHaveBeenCalled();
  });
});

describe('mouse fallback', () => {
  it('should spawn a pane at screen center when a chip is clicked', async () => {
    await renderReady();
    fireEvent.click(screen.getByRole('button', { name: 'filter dream' }));

    expect(panes()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'adjust dream pane' })).toBeInTheDocument();
  });

  it('should remove a pane when its close button is clicked', async () => {
    await renderReady();
    fireEvent.click(within(paneEl(1)).getByRole('button', { name: 'close pane' }));

    expect(panes()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'adjust mono pane' })).not.toBeInTheDocument();
  });

  it('should move a pane by dragging its body with the pointer', async () => {
    await renderReady();
    const before = paneEl(1).style.left;

    // 몸통 중앙(가장자리에서 16px 이상 안쪽)에서 시작하면 이동
    fireEvent.pointerDown(screen.getByRole('button', { name: 'adjust mono pane' }), {
      clientX: 310,
      clientY: 270,
    });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 430, clientY: 350 }));
    fireEvent(window, new MouseEvent('pointerup', {}));

    expect(paneEl(1).style.left).not.toBe(before);
    // pointerup 이후에는 더 움직이지 않는다
    const settled = paneEl(1).style.left;
    fireEvent(window, new MouseEvent('pointermove', { clientX: 500, clientY: 500 }));
    expect(paneEl(1).style.left).toBe(settled);
  });

  it('should resize a pane from its bottom-right corner with the pointer', async () => {
    await renderReady();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'adjust mono pane' }), {
      clientX: 478,
      clientY: 388,
    });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 700, clientY: 560 }));
    fireEvent(window, new MouseEvent('pointerup', {}));

    expect(Number.parseFloat(paneEl(1).style.width)).toBeGreaterThan(340);
    expect(Number.parseFloat(paneEl(1).style.height)).toBeGreaterThan(240);
  });

  it('should resize a pane from its left edge keeping the right side fixed', async () => {
    await renderReady();

    // pane 1 왼쪽 변(x=140) 근처에서 시작해 왼쪽으로 끌면 넓어진다
    fireEvent.pointerDown(screen.getByRole('button', { name: 'adjust mono pane' }), {
      clientX: 142,
      clientY: 270,
    });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 40, clientY: 270 }));
    fireEvent(window, new MouseEvent('pointerup', {}));

    const style = paneEl(1).style;
    expect(Number.parseFloat(style.left)).toBeLessThan(140);
    expect(Number.parseFloat(style.width)).toBeGreaterThan(340);
    // 오른쪽 변은 고정
    expect(Number.parseFloat(style.left) + Number.parseFloat(style.width)).toBeCloseTo(480);
  });

  it('should spawn a pane where a chip is dropped after a pointer drag', async () => {
    await renderReady();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'filter heat' }), {
      clientX: 900,
      clientY: 300,
    });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 400, clientY: 300 }));
    fireEvent(window, new MouseEvent('pointerup', { clientX: 400, clientY: 300 }));

    expect(panes()).toHaveLength(3);
    // 놓은 지점(400,300)을 중심으로 기본 크기(340x240) 존이 생성된다
    const spawned = document.querySelector<HTMLElement>('[data-pane-id="3"]')!;
    expect(spawned.style.left).toBe('230px');
    expect(spawned.style.top).toBe('180px');

    // 드래그 직후 따라오는 click은 무시되고, 그다음 일반 클릭은 다시 생성한다
    fireEvent.click(screen.getByRole('button', { name: 'filter heat' }));
    expect(panes()).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'filter heat' }));
    expect(panes()).toHaveLength(4);
  });

  it('should keep a mouse drag alive while the tracker sees no hand', async () => {
    await renderReady();

    // 마우스 사용 중에는 보통 손이 카메라 프레임에 없다 — 그 상태의 트래커
    // 프레임이 진행 중인 마우스 드래그를 지우면 안 된다 (회귀 방지)
    currentHand = null;
    fireEvent.pointerDown(screen.getByRole('button', { name: 'adjust mono pane' }), {
      clientX: 310,
      clientY: 270,
    });
    stepFrames(5);
    fireEvent(window, new MouseEvent('pointermove', { clientX: 430, clientY: 350 }));
    fireEvent(window, new MouseEvent('pointerup', {}));

    // offX 170 유지 → 430 - 170 = 260
    expect(paneEl(1).style.left).toBe('260px');
  });

  it('should keep the chip carry ghost visible while the tracker sees no hand', async () => {
    await renderReady();
    const cursor = screen.getByTestId('hand-cursor');

    currentHand = null;
    fireEvent.pointerDown(screen.getByRole('button', { name: 'filter heat' }), {
      clientX: 900,
      clientY: 300,
    });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 500, clientY: 300 }));
    stepFrames(5);

    expect(cursor.style.opacity).toBe('1');
    expect(within(cursor).getByText('heat')).toBeInTheDocument();

    fireEvent(window, new MouseEvent('pointerup', { clientX: 500, clientY: 300 }));
    expect(panes()).toHaveLength(3);
  });

  it('should move a video layer by dragging its cover button', async () => {
    await renderReady();
    const bunny = document.querySelector<HTMLElement>('[data-video-id="bunny"]')!;
    const before = bunny.style.left;

    fireEvent.pointerDown(screen.getByRole('button', { name: 'adjust bunny layer' }), {
      clientX: 276,
      clientY: 198,
    });
    fireEvent(window, new MouseEvent('pointermove', { clientX: 420, clientY: 300 }));
    fireEvent(window, new MouseEvent('pointerup', {}));

    expect(bunny.style.left).not.toBe(before);
  });
});

describe('shuffle', () => {
  it('should place every layer within the viewport', async () => {
    await renderReady();
    fireEvent.click(screen.getByRole('button', { name: 'shuffle layout' }));

    const boxes = [...document.querySelectorAll<HTMLElement>('[data-video-id], [data-pane-id]')];
    expect(boxes.length).toBeGreaterThan(0);
    for (const el of boxes) {
      const left = Number.parseFloat(el.style.left);
      const top = Number.parseFloat(el.style.top);
      const width = Number.parseFloat(el.style.width);
      const height = Number.parseFloat(el.style.height);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(window.innerWidth + 0.001);
      expect(top + height).toBeLessThanOrEqual(window.innerHeight + 0.001);
    }
  });
});

describe('ascii panes', () => {
  it('should composite overlapping videos (and mirrored webcam) into character cells', async () => {
    await renderReady();
    // 초기 ascii-rgb 존(x540 y380 w400 h270)과 겹치도록 비디오·웹캠 rect를 배치
    setRect(screen.getByLabelText('bunny layer'), { left: 600, top: 400, width: 200, height: 120 });
    setRect(screen.getByLabelText('webcam preview'), {
      left: 560,
      top: 500,
      width: 176,
      height: 99,
    });
    stepFrames(2);

    const drew = createdCtxs.filter(ctx => ctx.drawImage.mock.calls.length > 0);
    expect(drew.length).toBeGreaterThan(0);
    // 웹캠 미러링 경로: scale(-1, 1) 후 drawImage
    expect(createdCtxs.some(ctx => ctx.scale.mock.calls.some(c => c[0] === -1))).toBe(true);
    // 문자 렌더링이 실제로 일어난다 (컬러 모드는 셀 단위 fillText)
    expect(createdCtxs.some(ctx => ctx.fillText.mock.calls.length > 0)).toBe(true);
  });

  it('should render row-batched text for the mono ascii pane', async () => {
    await renderReady();
    fireEvent.click(screen.getByRole('button', { name: 'filter ascii' }));
    stepFrames(2);

    // 모노 모드는 행 단위 문자열을 그린다 — 길이 1 초과의 fillText 호출 존재
    const monoRow = createdCtxs.some(ctx =>
      ctx.fillText.mock.calls.some(call => typeof call[0] === 'string' && call[0].length > 1)
    );
    expect(monoRow).toBe(true);
  });

  it('should survive a tainted canvas without crashing', async () => {
    await renderReady();
    setRect(screen.getByLabelText('bunny layer'), { left: 600, top: 400, width: 200, height: 120 });
    throwOnDrawImage = true;
    throwOnGetImageData = true;
    stepFrames(2);
    throwOnGetImageData = false;
    stepFrames(1);

    expect(paneEl(2)).toBeInTheDocument();
  });
});
