import { describe, expect, it } from 'vitest';

import { SCREEN_EDGE_DRAG_GUARD_PX } from '../geometry';
import { outlineBounds } from '../projection';
import type { Quat } from '../quaternion';
import { dotQuat, IDENTITY_QUAT, multiplyQuat, quatFromAxisAngle, Y_AXIS } from '../quaternion';
import { DEGREES_PER_DRAG_PX, INITIAL_ORIENTATION } from '../rotation';
import type { EdgeInsets, Spin, SpinGesture, SpinGestureEvent, SpinSurface } from '../spin';
import {
  advanceSpin,
  IDLE_SPIN_GESTURE,
  isOnSpinSurface,
  isSpinDone,
  MAX_SPIN_DEG_PER_MS,
  reduceSpinGesture,
  SPIN_DECAY_TIME_MS,
  SPIN_STOP_DEG_PER_MS,
  spinAngleAt,
  spinOrientation,
  spinStopMs,
  startSpin,
  stepSpin,
  touchGuardInsets,
} from '../spin';

const WIDTH = 1280;

/** 기운 책을 투영한 듯한 마름모(화면 좌표). 감싼 사각형은 (500, 200)–(780, 600)이고 그 모서리는 책 밖이다. */
const TILTED_OUTLINE = [
  { x: 640, y: 200 },
  { x: 780, y: 400 },
  { x: 640, y: 600 },
  { x: 500, y: 400 },
];
const HEIGHT = 800;
const SURFACE: SpinSurface = {
  viewportWidth: WIDTH,
  viewportHeight: HEIGHT,
  touchInsets: touchGuardInsets({ top: 0, right: 0, bottom: 0, left: 0 }),
  bookOutline: TILTED_OUTLINE,
};

function run(events: SpinGestureEvent[], gesture: SpinGesture = IDLE_SPIN_GESTURE) {
  let current = gesture;
  const effects = [];
  for (const event of events) {
    const step = reduceSpinGesture(current, event, SURFACE);
    current = step.gesture;
    effects.push(step.effect);
  }
  return { gesture: current, effects };
}

function down(x: number, y: number, time = 0, pointerType = 'touch'): SpinGestureEvent {
  return { type: 'down', pointerId: 1, pointerType, point: { x, y }, time };
}

function move(x: number, y: number, time: number): SpinGestureEvent {
  return { type: 'move', pointerId: 1, point: { x, y }, time };
}

function up(x: number, y: number, time: number): SpinGestureEvent {
  return { type: 'up', pointerId: 1, point: { x, y }, time };
}

function expectSameRotation(actual: Quat, expected: Quat, digits = 9) {
  expect(Math.abs(dotQuat(actual, expected))).toBeCloseTo(1, digits);
}

describe('spin gesture (whole screen)', () => {
  it('should keep touches off the left and right screen edges and the safe area, but take a mouse anywhere', () => {
    expect(isOnSpinSurface({ x: SCREEN_EDGE_DRAG_GUARD_PX, y: 0 }, 'touch', SURFACE)).toBe(true);
    expect(isOnSpinSurface({ x: SCREEN_EDGE_DRAG_GUARD_PX, y: HEIGHT }, 'touch', SURFACE)).toBe(true);
    expect(isOnSpinSurface({ x: SCREEN_EDGE_DRAG_GUARD_PX - 1, y: 400 }, 'touch', SURFACE)).toBe(false);
    expect(isOnSpinSurface({ x: WIDTH - SCREEN_EDGE_DRAG_GUARD_PX + 1, y: 400 }, 'pen', SURFACE)).toBe(false);
    expect(isOnSpinSurface({ x: 1, y: 400 }, 'mouse', SURFACE)).toBe(true);
    expect(isOnSpinSurface({ x: WIDTH, y: 0 }, 'mouse', SURFACE)).toBe(true);
    const edge = run([down(10, 400), move(200, 400, 16), up(200, 400, 32)]);
    expect(edge.effects.map(effect => effect.type)).toEqual(['none', 'none', 'none']);
    const mouseEdge = run([down(10, 400, 0, 'mouse'), move(200, 400, 16), up(200, 400, 32)]);
    expect(mouseEdge.effects.map(effect => effect.type)).toEqual(['grab', 'drag', 'release']);
  });

  it('should leave the safe area to the system and keep at least 24px on the sides for touches', () => {
    // 예: 세로 아이폰 위 Dynamic Island 59px·아래 홈 막대 34px, 가로 아이폰 옆 노치 59px.
    const portrait: EdgeInsets = { top: 59, right: 0, bottom: 34, left: 0 };
    expect(touchGuardInsets(portrait)).toEqual({ top: 59, right: SCREEN_EDGE_DRAG_GUARD_PX, bottom: 34, left: 24 });
    expect(touchGuardInsets({ top: 0, right: 59, bottom: 21, left: 59 })).toEqual({
      top: 0,
      right: 59,
      bottom: 21,
      left: 59,
    });
    const surface: SpinSurface = { ...SURFACE, touchInsets: touchGuardInsets(portrait) };
    expect(isOnSpinSurface({ x: 400, y: 58 }, 'touch', surface)).toBe(false);
    expect(isOnSpinSurface({ x: 400, y: 59 }, 'touch', surface)).toBe(true);
    expect(isOnSpinSurface({ x: 400, y: HEIGHT - 34 }, 'touch', surface)).toBe(true);
    expect(isOnSpinSurface({ x: 400, y: HEIGHT - 33 }, 'touch', surface)).toBe(false);
    expect(isOnSpinSurface({ x: 400, y: 10 }, 'mouse', surface)).toBe(true);
    expect(reduceSpinGesture(IDLE_SPIN_GESTURE, down(400, 10), surface).effect.type).toBe('none');
  });

  it('should grab on press, then rotate by what moved since the last event once past 8px', () => {
    const { effects, gesture } = run([down(100, 100), move(105, 100, 10), move(110, 100, 20), move(130, 90, 30)]);
    expect(effects).toEqual([
      { type: 'grab' },
      { type: 'none' },
      // 시작 거리에 닿으면 누른 점부터 따라잡는다.
      { type: 'drag', delta: { x: 10, y: 0 } },
      { type: 'drag', delta: { x: 20, y: -10 } },
    ]);
    expect(gesture.phase).toBe('dragging');
  });

  it('should open on a tap inside the projected book, and do nothing on a tap elsewhere or a long press-move', () => {
    expect(run([down(640, 400), move(644, 400, 10), up(644, 403, 20)]).effects.at(-1)).toEqual({ type: 'open' });
    // 다각형 경계 위도 책이다.
    expect(run([down(710, 300), up(710, 300, 20)]).effects.at(-1)).toEqual({ type: 'open' });
    // 빈 곳 탭.
    expect(run([down(100, 100), move(104, 100, 10), up(104, 103, 20)]).effects.at(-1)).toEqual({ type: 'none' });
    // 감싼 사각형 안이지만 다각형 밖(기운 책 옆 빈 모서리)은 책이 아니다.
    const bounds = outlineBounds(TILTED_OUTLINE);
    const corner = { x: bounds.x + 20, y: bounds.y + 20 };
    expect(run([down(corner.x, corner.y), up(corner.x, corner.y, 20)]).effects.at(-1)).toEqual({ type: 'none' });
    // 책 위에서 눌렀어도 시작 거리 밖에서 끌기 없이 뗀 누름은 아무 일도 없다.
    expect(run([down(640, 400), up(700, 400, 20)]).effects.at(-1)).toEqual({ type: 'none' });
  });

  it('should release with the last move and the windowed velocity', () => {
    const { effects, gesture } = run([down(100, 100), move(120, 100, 10), move(220, 100, 50), up(240, 100, 60)]);
    const release = effects.at(-1);
    expect(release).toMatchObject({ type: 'release', delta: { x: 20, y: 0 } });
    // 처음부터 60ms 동안 140px: 창(100ms)보다 짧으면 가장 오래된 표본부터 잰다.
    expect(release?.type === 'release' && release.velocity.x).toBeCloseTo(140 / 60);
    expect(gesture).toBe(IDLE_SPIN_GESTURE);
  });

  it('should release without speed when the pointer is held still before lifting', () => {
    const { effects } = run([down(100, 100), move(200, 100, 10), move(200, 100, 300), up(200, 100, 400)]);
    expect(effects.at(-1)).toEqual({ type: 'release', delta: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } });
  });

  it('should stop without inertia on cancel while dragging, and ignore other pointers', () => {
    const dragging = run([down(100, 100), move(150, 100, 10)]).gesture;
    expect(reduceSpinGesture(dragging, { type: 'cancel', pointerId: 1 }, SURFACE).effect).toEqual({
      type: 'release',
      delta: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    });
    const pressed = run([down(100, 100)]).gesture;
    expect(reduceSpinGesture(pressed, { type: 'cancel', pointerId: 1 }, SURFACE)).toEqual({
      gesture: IDLE_SPIN_GESTURE,
      effect: { type: 'none' },
    });
    const other = reduceSpinGesture(dragging, { ...move(400, 400, 20), pointerId: 2 }, SURFACE);
    expect(other).toEqual({ gesture: dragging, effect: { type: 'none' } });
    expect(reduceSpinGesture(dragging, down(300, 300), SURFACE).gesture).toBe(dragging);
    expect(reduceSpinGesture(IDLE_SPIN_GESTURE, move(300, 300, 0), SURFACE).effect).toEqual({ type: 'none' });
  });
});

describe('spin inertia', () => {
  const flick = { x: 1, y: 0 };

  function spinFrom(velocity: { x: number; y: number }): Spin {
    const spin = startSpin(INITIAL_ORIENTATION, velocity);
    if (spin === null) {
      throw new Error('spin expected');
    }
    return spin;
  }

  it('should not spin when released below the stop speed', () => {
    expect(startSpin(INITIAL_ORIENTATION, { x: 0, y: 0 })).toBeNull();
    expect(startSpin(INITIAL_ORIENTATION, { x: SPIN_STOP_DEG_PER_MS / DEGREES_PER_DRAG_PX / 2, y: 0 })).toBeNull();
  });

  it('should spin around the screen axis of the drag and cap the speed', () => {
    const spin = spinFrom(flick);
    expect(spin.speed).toBeCloseTo(DEGREES_PER_DRAG_PX);
    // 오른쪽으로 던지면 화면 세로축(+y)으로 돈다.
    expect(spin.axis.x === 0 && spin.axis.y === 1 && spin.axis.z === 0).toBe(true);
    expect(spinFrom({ x: 0, y: 50 }).speed).toBe(MAX_SPIN_DEG_PER_MS);
  });

  it('should decay exponentially and stop at the stop speed', () => {
    const spin = spinFrom(flick);
    const stop = spinStopMs(spin);
    expect(stop).toBeCloseTo(SPIN_DECAY_TIME_MS * Math.log(DEGREES_PER_DRAG_PX / SPIN_STOP_DEG_PER_MS));
    // 각속도 = 돈 각도의 시간 미분. τ에서 처음의 1/e, 멈추기 직전에는 정지 임계 위다.
    const speedAt = (time: number) => (spinAngleAt(spin, time + 0.0005) - spinAngleAt(spin, time - 0.0005)) / 0.001;
    expect(speedAt(SPIN_DECAY_TIME_MS)).toBeCloseTo(spin.speed / Math.E, 6);
    expect(speedAt(stop - 1)).toBeGreaterThan(SPIN_STOP_DEG_PER_MS);
    expect(spinAngleAt(spin, stop + 1)).toBe(spinAngleAt(spin, stop));
    const total = spinAngleAt(spin, stop);
    expect(total).toBeCloseTo((spin.speed - SPIN_STOP_DEG_PER_MS) * SPIN_DECAY_TIME_MS);
    expect(spinAngleAt(spin, stop + 5000)).toBe(total);
    expect(spinAngleAt(spin, -10)).toBe(0);
  });

  it.each([1000 / 120, 1000 / 60, 1000 / 30])('should land on the same pose stepping every %f ms', dtMs => {
    const start = spinFrom({ x: 1.5, y: -0.7 });
    let spin = start;
    const steps = Math.round(600 / dtMs);
    for (let index = 0; index < steps; index += 1) {
      spin = stepSpin(spin, dtMs);
    }
    expect(spin.elapsedMs).toBeCloseTo(600, 9);
    const reference = spinOrientation({ ...start, elapsedMs: 600 });
    expectSameRotation(spinOrientation(spin), reference, 12);
    expect(isSpinDone(spin)).toBe(false);
    // 프레임 시각으로 나아가는 실제 경로(advanceSpin)도 간격마다 stepSpin으로 같은 자세에 닿는다.
    let framed = advanceSpin(start, 1000);
    for (let index = 1; index <= steps; index += 1) {
      framed = advanceSpin(framed, 1000 + index * dtMs);
    }
    expectSameRotation(spinOrientation(framed), reference, 12);
  });

  it('should keep turning the same way it was flicked and then rest for good', () => {
    const spin = spinFrom(flick);
    const turned = spinOrientation({ ...spin, elapsedMs: SPIN_DECAY_TIME_MS });
    expectSameRotation(
      turned,
      multiplyQuat(quatFromAxisAngle(Y_AXIS, spinAngleAt(spin, SPIN_DECAY_TIME_MS)), INITIAL_ORIENTATION)
    );
    const stopped = stepSpin(spin, spinStopMs(spin));
    expect(isSpinDone(stopped)).toBe(true);
    expect(spinOrientation(stepSpin(stopped, 1000))).toEqual(spinOrientation(stopped));
    expect(stepSpin(spin, -5).elapsedMs).toBe(0);
  });

  it('should start counting from the first frame', () => {
    const spin = startSpin(IDENTITY_QUAT, flick);
    if (spin === null) {
      throw new Error('spin expected');
    }
    const first = advanceSpin(spin, 500);
    expect(first).toMatchObject({ lastTime: 500, elapsedMs: 0 });
    expect(spinOrientation(first)).toEqual(IDENTITY_QUAT);
    expect(advanceSpin(first, 516).elapsedMs).toBe(16);
    expect(advanceSpin(first, 400)).toMatchObject({ lastTime: 500, elapsedMs: 0 });
    expect(advanceSpin(advanceSpin(first, 516), 548).elapsedMs).toBe(48);
  });
});
