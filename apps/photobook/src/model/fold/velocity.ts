import type { Vec2 } from './vector';

/**
 * 포인터 속도 추정(px/ms). 화면 주사율과 무관하게 같은 값을 내는 것이 목적이다(tech-research.md 0장).
 *
 * 방법: 마지막 샘플 시각 tEnd에서 시간 창 windowMs만큼 거슬러 간 시각 tStart의 위치를 샘플 사이 선형 보간으로
 * 구하고, (위치(tEnd) - 위치(tStart)) / (tEnd - tStart)를 속도로 쓴다.
 * 샘플이 30·60·120Hz 어느 간격으로 들어와도 같은 구간의 평균 속도를 재므로, 일정한 속도로 움직이면
 * 간격과 상관없이 같은 값이 나온다. 샘플 시각이 들쭉날쭉해도 마찬가지다.
 *
 * - 시간은 인자로 받는다. PointerEvent.timeStamp 같은 값을 호출부가 넣는다. 놓은 순간의 속도가 필요하면
 *   pointerup 위치·시각도 마지막 샘플로 넣는다.
 * - 샘플 사이는 등속으로 움직였다고 보고 선형 보간한다. 이벤트가 오래 끊긴 뒤 위치가 바뀌면 그 이동을 끊긴
 *   구간 전체에 고르게 나눈다. 그래서 멈췄다가 한 샘플 만에 튕기면 실제보다 느리게 잰다(엔지니어링 선택, 임시).
 *   "끊김 = 멈춤"으로 보려면 정상 샘플 간격(30Hz 33ms)과 끊김을 가르는 임계가 필요하고, 그러면 주사율마다
 *   창이 달라진다. 오차는 창 시작을 걸치는 한 구간에서만 생긴다. S2 실기기 드래그에서 다시 본다.
 *   호출부는 PointerEvent.getCoalescedEvents()의 샘플까지 넣어 구간을 짧게 유지한다.
 * - 기록이 창보다 짧으면 가장 오래된 샘플부터 잰다. 샘플이 하나뿐이거나 시간 폭이 0이면 속도 0이다.
 * - 샘플 시각은 감소하지 않는다고 가정한다(호출부가 순서대로 넣는다).
 */
export type PointerSample = {
  readonly x: number;
  readonly y: number;
  /** ms. 단조 증가하는 시계(예: PointerEvent.timeStamp). */
  readonly t: number;
};

/**
 * 속도 시간 창. 임시값(제안, 엔지니어링). 놓기 직전 짧은 구간만 보려는 값이며 근거 실측은 아직 없다.
 * S2 실기기 드래그에서 다시 잰다.
 */
export const DEFAULT_VELOCITY_WINDOW_MS = 100;

const ZERO_VELOCITY: Vec2 = { x: 0, y: 0 };

export function estimateVelocity(
  samples: readonly PointerSample[],
  windowMs: number = DEFAULT_VELOCITY_WINDOW_MS
): Vec2 {
  const last = samples.at(-1);
  if (last === undefined) {
    return ZERO_VELOCITY;
  }
  const windowStartTime = last.t - windowMs;
  const start = positionAtTime(samples, windowStartTime);
  const elapsed = last.t - start.t;
  if (elapsed <= 0) {
    return ZERO_VELOCITY;
  }
  return { x: (last.x - start.x) / elapsed, y: (last.y - start.y) / elapsed };
}

/**
 * 창 계산에 필요한 샘플만 남긴다. 창 시작보다 오래된 샘플은 보간에 쓸 하나만 남기고 버린다.
 * 새 배열을 돌려주며 인자를 바꾸지 않는다.
 */
export function retainSamplesForWindow(
  samples: readonly PointerSample[],
  windowMs: number = DEFAULT_VELOCITY_WINDOW_MS
): PointerSample[] {
  const last = samples.at(-1);
  if (last === undefined) {
    return [];
  }
  const windowStartTime = last.t - windowMs;
  let firstKeptIndex = 0;
  samples.forEach((sample, index) => {
    if (sample.t <= windowStartTime) {
      firstKeptIndex = index;
    }
  });
  return samples.slice(firstKeptIndex);
}

/**
 * 시각 time의 위치(샘플 사이 선형 보간).
 * time이 기록보다 이르면 가장 오래된 샘플을, 늦으면 마지막 샘플을 그 샘플의 시각과 함께 돌려준다.
 */
function positionAtTime(samples: readonly PointerSample[], time: number): PointerSample {
  let before = samples[0] as PointerSample;
  if (time <= before.t) {
    return before;
  }
  let after: PointerSample | undefined;
  for (const sample of samples) {
    if (sample.t > time) {
      after = sample;
      break;
    }
    before = sample;
  }
  if (after === undefined) {
    return before;
  }
  // before.t <= time < after.t 이므로 분모는 0보다 크다.
  const ratio = (time - before.t) / (after.t - before.t);
  return {
    x: before.x + (after.x - before.x) * ratio,
    y: before.y + (after.y - before.y) * ratio,
    t: time,
  };
}
