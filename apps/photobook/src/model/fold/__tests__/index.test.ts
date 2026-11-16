import { describe, expect, it } from 'vitest';

import { toModelPageSize } from '../book-frame';
import { curlPoint, limitRadiusToSpine, solveCurlPose } from '../cylinder';
import type {
  BookFrame,
  GestureEvent,
  GestureState,
  PageSize,
  PointerSample,
  Rect,
  ReleaseOutcome,
  TurnPose,
  Vec2,
} from '../index';
import {
  computeTurnPose,
  createClickTurnPath,
  createSettlePath,
  decideRelease,
  DEFAULT_DRAG_START_DISTANCE_PX,
  DEFAULT_RELEASE_CONFIG,
  DEFAULT_TURN_TIMING,
  estimateVelocity,
  IDLE_GESTURE,
  projectToOuterEdge,
  reduceGesture,
  reflectAcrossFold,
  samplePointerPath,
  splitPageByFold,
  toModelPoint,
  toScreenPoint,
} from '../index';
import type { InputSurface } from '../input-priority';
import { polygonArea } from '../reflect-fold';

type FrameCase = {
  readonly name: string;
  readonly frame: BookFrame;
  readonly screenPage: { readonly screenWidth: number; readonly screenHeight: number };
  readonly forwardPageRect: Rect;
};

/** spikes.md S2-6: 같은 시나리오를 좌우 펼침(세로 책등)과 위아래 배치(가로 책등)로 돌린다. */
const frameCases: FrameCase[] = [
  {
    name: 'vertical spine',
    frame: { spineAxis: 'vertical', spineOrigin: { x: 500, y: 100 } },
    screenPage: { screenWidth: 400, screenHeight: 600 },
    forwardPageRect: { x: 500, y: 100, width: 400, height: 600 },
  },
  {
    name: 'horizontal spine',
    frame: { spineAxis: 'horizontal', spineOrigin: { x: 100, y: 500 } },
    screenPage: { screenWidth: 600, screenHeight: 400 },
    forwardPageRect: { x: 100, y: 500, width: 600, height: 400 },
  },
];

type DragResult = {
  readonly modelPoses: TurnPose[];
  readonly outcome: ReleaseOutcome;
  readonly settleEnd: Vec2;
};

/** 모델 좌표의 드래그 경로를 화면 이벤트로 바꿔 공개 API 흐름 전체를 돌린다. */
function runDragTurn(frameCase: FrameCase, modelPath: readonly PointerSample[]): DragResult {
  const { frame, screenPage, forwardPageRect } = frameCase;
  const page: PageSize = toModelPageSize(screenPage, frame.spineAxis);
  const surface: InputSurface = {
    interactiveRegions: [],
    turnRegions: [{ direction: 'forward', rect: forwardPageRect }],
  };
  const context = { surface, dragStartDistancePx: DEFAULT_DRAG_START_DISTANCE_PX };

  let gesture: GestureState = IDLE_GESTURE;
  let grab: Vec2 | null = null;
  const samples: PointerSample[] = [];
  const modelPoses: TurnPose[] = [];
  let outcome: ReleaseOutcome = 'return';
  let settleEnd: Vec2 = { x: Number.NaN, y: Number.NaN };

  modelPath.forEach((sample, index) => {
    const screenPoint = toScreenPoint(sample, frame, 'forward');
    const isFirst = index === 0;
    const isLast = index === modelPath.length - 1;
    const event: GestureEvent = isFirst
      ? { type: 'down', pointerId: 7, point: screenPoint }
      : { type: isLast ? 'up' : 'move', pointerId: 7, point: screenPoint };
    const step = reduceGesture(gesture, event, context);
    gesture = step.state;
    const modelPoint = toModelPoint(screenPoint, frame, 'forward');

    if (step.effect.type === 'drag-start') {
      grab = projectToOuterEdge(toModelPoint(step.effect.origin, frame, 'forward'), page);
    }
    if (grab !== null && step.effect.type !== 'none') {
      samples.push({ x: modelPoint.x, y: modelPoint.y, t: sample.t });
      modelPoses.push(computeTurnPose(grab, modelPoint, page));
    }
    if (grab !== null && step.effect.type === 'drag-end') {
      const lastPose = modelPoses.at(-1)!;
      outcome = decideRelease(
        { progress: lastPose.progress, velocity: estimateVelocity(samples) },
        DEFAULT_RELEASE_CONFIG
      );
      const settle = createSettlePath(grab, lastPose.pointer, outcome);
      settleEnd = samplePointerPath(settle, DEFAULT_TURN_TIMING.durationMs, DEFAULT_TURN_TIMING);
    }
  });

  return { modelPoses, outcome, settleEnd };
}

function linearModelDrag(from: Vec2, to: Vec2, durationMs: number, stepMs: number): PointerSample[] {
  const samples: PointerSample[] = [];
  for (let t = 0; t <= durationMs; t += stepMs) {
    const ratio = t / durationMs;
    samples.push({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio, t });
  }
  return samples;
}

describe('fold model public API', () => {
  describe.each(frameCases)('drag turn with a $name', frameCase => {
    it('should fold only a thin strip on the first drag frame when pressed near the edge', () => {
      const result = runDragTurn(frameCase, linearModelDrag({ x: 395, y: 300 }, { x: 315, y: 300 }, 160, 16));
      const firstPose = result.modelPoses[0]!;

      // 누른 점 395에서 8px 움직인 387이 첫 드래그 프레임이다. 잡은 점은 바깥 가장자리 400으로 투영된다.
      expect(firstPose.grab).toEqual({ x: 400, y: 300 });
      expect(firstPose.pointer).toEqual({ x: 387, y: 300 });
      expect(polygonArea(splitPageByFold({ width: 400, height: 600 }, firstPose.fold!).folded)).toBeCloseTo(
        6.5 * 600,
        6
      );
    });

    it('should keep the grabbed corner under the pointer for every move', () => {
      const result = runDragTurn(frameCase, linearModelDrag({ x: 395, y: 590 }, { x: 120, y: 500 }, 400, 16));

      expect(result.modelPoses.length).toBeGreaterThan(10);
      for (const pose of result.modelPoses) {
        if (pose.fold === null) {
          continue;
        }
        const landed = reflectAcrossFold(pose.grab, pose.fold);
        expect(landed.x).toBeCloseTo(pose.pointer.x, 9);
        expect(landed.y).toBeCloseTo(pose.pointer.y, 9);
      }
    });

    it('should return a slow, short drag to the grab point', () => {
      const result = runDragTurn(frameCase, linearModelDrag({ x: 395, y: 590 }, { x: 300, y: 560 }, 800, 16));

      expect(result.outcome).toBe('return');
      expect(result.settleEnd).toEqual({ x: 400, y: 590 });
    });

    it('should complete a fast flick before the spine', () => {
      const result = runDragTurn(frameCase, linearModelDrag({ x: 395, y: 590 }, { x: 250, y: 560 }, 160, 8));

      expect(result.modelPoses.at(-1)!.progress).toBeLessThan(0.5);
      expect(result.outcome).toBe('complete');
      expect(result.settleEnd).toEqual({ x: -400, y: 590 });
    });
  });

  it('should produce the same model output for both spine axes', () => {
    const drag = linearModelDrag({ x: 395, y: 590 }, { x: 80, y: 420 }, 400, 16);
    const [vertical, horizontal] = frameCases.map(frameCase => runDragTurn(frameCase, drag));

    expect(horizontal).toEqual(vertical);
  });

  it('should produce identical output when the same input sequence is replayed', () => {
    const drag = linearModelDrag({ x: 395, y: 590 }, { x: -50, y: 450 }, 500, 16);
    const first = runDragTurn(frameCases[0]!, drag);
    const second = runDragTurn(frameCases[0]!, drag);

    expect(second).toStrictEqual(first);
  });

  describe('click turn through the same model', () => {
    const page: PageSize = { width: 400, height: 600 };
    const grab = projectToOuterEdge({ x: 330, y: 540 }, page);
    const path = createClickTurnPath(grab, page);
    const posesAt = (refreshRateHz: number) => {
      const frameCount = (refreshRateHz * DEFAULT_TURN_TIMING.durationMs) / 1000;
      return Array.from({ length: frameCount + 1 }, (_, frame) => {
        const elapsedMs = (frame * 1000) / refreshRateHz;
        return {
          elapsedMs,
          pose: computeTurnPose(grab, samplePointerPath(path, elapsedMs, DEFAULT_TURN_TIMING), page),
        };
      });
    };

    it('should land at progress 1 at 30, 60 and 120Hz', () => {
      for (const refreshRateHz of [30, 60, 120]) {
        expect(posesAt(refreshRateHz).at(-1)!.pose.progress).toBe(1);
      }
    });

    it('should give the same pose at the same elapsed time regardless of refresh rate', () => {
      const at30 = posesAt(30);
      const at120 = new Map(posesAt(120).map(({ elapsedMs, pose }) => [elapsedMs, pose]));
      for (const { elapsedMs, pose } of at30) {
        expect(at120.get(elapsedMs)).toStrictEqual(pose);
      }
    });

    it('should keep the grabbed point under the virtual pointer on a spine-safe cylinder', () => {
      for (const { pose } of posesAt(60)) {
        const radius = limitRadiusToSpine(pose.grab, pose.pointer, page, 60);
        const curl = solveCurlPose(pose.grab, pose.pointer, radius);
        if (curl === null) {
          continue;
        }
        const curledGrab = curlPoint(pose.grab, curl);
        expect(Math.abs(curledGrab.x - pose.pointer.x)).toBeLessThanOrEqual(0.01);
        expect(Math.abs(curledGrab.y - pose.pointer.y)).toBeLessThanOrEqual(0.01);
      }
    });
  });
});
