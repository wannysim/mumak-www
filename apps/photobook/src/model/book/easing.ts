import type { Easing } from '@/model/fold';

/**
 * CSS `cubic-bezier(x1, y1, x2, y2)`와 같은 곡선을 경과 시간 비율에 적용하는 easing.
 * 시간 기반이라 주사율과 무관하다(tech-research.md 0장 "easing은 경과 시간 기준").
 *
 * x(t) = 진행 비율이 되는 매개변수 t를 뉴턴법으로 먼저 찾고, 수렴하지 않으면 이분 탐색으로 마무리한 뒤 y(t)를 돌려준다.
 * x1·x2가 [0, 1] 안이면 x(t)가 단조 증가라 해가 하나다(CSS 명세가 x를 [0, 1]로 제한하는 이유).
 */
const NEWTON_ITERATIONS = 8;
const BISECTION_ITERATIONS = 40;
const SOLVE_EPSILON = 1e-7;

function bezierComponent(t: number, p1: number, p2: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * p1 + 3 * inverse * t * t * p2 + t * t * t;
}

function bezierSlope(t: number, p1: number, p2: number): number {
  const inverse = 1 - t;
  return 3 * inverse * inverse * p1 + 6 * inverse * t * (p2 - p1) + 3 * t * t * (1 - p2);
}

function solveCurveParameter(x: number, x1: number, x2: number): number {
  let t = x;
  for (let iteration = 0; iteration < NEWTON_ITERATIONS; iteration += 1) {
    const error = bezierComponent(t, x1, x2) - x;
    if (Math.abs(error) < SOLVE_EPSILON) {
      return t;
    }
    const slope = bezierSlope(t, x1, x2);
    if (Math.abs(slope) < SOLVE_EPSILON) {
      break;
    }
    t -= error / slope;
  }
  let low = 0;
  let high = 1;
  t = x;
  for (let iteration = 0; iteration < BISECTION_ITERATIONS; iteration += 1) {
    const value = bezierComponent(t, x1, x2);
    if (Math.abs(value - x) < SOLVE_EPSILON) {
      return t;
    }
    if (value < x) {
      low = t;
    } else {
      high = t;
    }
    t = (low + high) / 2;
  }
  return t;
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new RangeError(`cubic-bezier의 x는 [0, 1] 안이어야 한다: ${x1}, ${x2}`);
  }
  return linearProgress => {
    if (linearProgress <= 0) {
      return 0;
    }
    if (linearProgress >= 1) {
      return 1;
    }
    return bezierComponent(solveCurveParameter(linearProgress, x1, x2), y1, y2);
  };
}

/**
 * 펼침 전환 easing. 임시, open-decisions G3 "모션 기준(표지 열림과 넘김)".
 * ryo.lu 전환의 `cubic-bezier(.16,1,.3,1)`를 후보 그대로 옮겼다(plan.md 참고 자료).
 */
export const OPEN_EASING: Easing = cubicBezier(0.16, 1, 0.3, 1);

/**
 * 펼치기 전 앞면으로 돌아오는 구간의 easing. 끝에서 멈췄다가 표지 열기가 빠르게 시작하면 그 사이가 멈춤처럼 보여
 * (expo-out 두 번), 천천히 출발해 천천히 서는 곡선으로 둔다. 임시, open-decisions G3 "모션 기준"·"뒷면을 보던 중 클릭했을 때의 펼침 동작".
 */
export const RETURN_EASING: Easing = cubicBezier(0.65, 0, 0.35, 1);
