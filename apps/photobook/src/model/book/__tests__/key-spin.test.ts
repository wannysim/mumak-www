import { describe, expect, it } from 'vitest';

import type { KeySpin } from '../key-spin';
import {
  advanceKeySpin,
  KEY_SPIN_DEG_PER_MS,
  keySpinOrientation,
  keySpinTarget,
  keySpinVelocity,
  startKeySpin,
} from '../key-spin';
import { angleBetweenQuat, IDENTITY_QUAT } from '../quaternion';
import { SPIN_DECAY_TIME_MS } from '../spin';

const REST = { velocity: { x: 0, y: 0 }, lastTime: null };

function at(spin: KeySpin, elapsedMs: number): KeySpin {
  return { ...spin, elapsedMs };
}

describe('key spin', () => {
  it('should aim at the same slow speed in any arrow direction and none for cancelled arrows', () => {
    expect(keySpinTarget({ x: 1, y: 0 })).toEqual({ x: KEY_SPIN_DEG_PER_MS, y: 0 });
    expect(keySpinTarget({ x: 0, y: -1 })).toEqual({ x: 0, y: -KEY_SPIN_DEG_PER_MS });
    const diagonal = keySpinTarget({ x: 1, y: 1 });
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(KEY_SPIN_DEG_PER_MS);
    expect(keySpinTarget({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('should ease into the speed and turn at it once settled', () => {
    const spin = startKeySpin(IDENTITY_QUAT, REST, keySpinTarget({ x: 1, y: 0 }), false);
    expect(keySpinVelocity(spin)).toEqual({ x: 0, y: 0 });
    expect(keySpinOrientation(spin)).toBe(IDENTITY_QUAT);
    // 시간 상수만큼 지나면 목표의 1 - 1/e ≈ 63%.
    expect(keySpinVelocity(at(spin, SPIN_DECAY_TIME_MS)).x).toBeCloseTo(KEY_SPIN_DEG_PER_MS * (1 - Math.exp(-1)));
    // 돈 각도 θ(t) = ω(t - τ(1 - e^(-t/τ))). 2초면 60° × 2 - 60° × 0.25 × (1 - e^-8).
    const expected = KEY_SPIN_DEG_PER_MS * (2000 - SPIN_DECAY_TIME_MS * (1 - Math.exp(-2000 / SPIN_DECAY_TIME_MS)));
    expect(angleBetweenQuat(keySpinOrientation(at(spin, 2000)), IDENTITY_QUAT)).toBeCloseTo(expected, 6);
    expect(keySpinVelocity(at(spin, 2000)).x).toBeCloseTo(KEY_SPIN_DEG_PER_MS, 4);
  });

  it('should start at full speed without easing for reduced motion', () => {
    const spin = startKeySpin(IDENTITY_QUAT, REST, keySpinTarget({ x: 0, y: 1 }), true);
    expect(keySpinVelocity(spin)).toEqual({ x: 0, y: KEY_SPIN_DEG_PER_MS });
    expect(angleBetweenQuat(keySpinOrientation(at(spin, 500)), IDENTITY_QUAT)).toBeCloseTo(30, 6);
  });

  it('should carry the speed it starts with and settle toward the new direction', () => {
    // 오른쪽으로 빠르게 돌던 중 아래 화살표: 처음에는 오른쪽 빠르기 그대로, 점점 아래로만 돈다.
    const spin = startKeySpin(IDENTITY_QUAT, { velocity: { x: 0.3, y: 0 }, lastTime: 40 }, { x: 0, y: 0.06 }, false);
    expect(spin.lastTime).toBe(40);
    expect(keySpinVelocity(spin)).toEqual({ x: 0.3, y: 0 });
    const later = keySpinVelocity(at(spin, 3000));
    expect(later.x).toBeCloseTo(0, 4);
    expect(later.y).toBeCloseTo(0.06, 4);
  });

  it('should advance by frame time and hold the pose on the first frame', () => {
    const spin = startKeySpin(IDENTITY_QUAT, REST, keySpinTarget({ x: 1, y: 0 }), false);
    const first = advanceKeySpin(spin, 1000);
    expect(first).toMatchObject({ lastTime: 1000, elapsedMs: 0 });
    expect(advanceKeySpin(first, 1016)).toMatchObject({ lastTime: 1016, elapsedMs: 16 });
    // 시각이 거꾸로 오면 시간이 흐르지 않는다.
    expect(advanceKeySpin(first, 990)).toMatchObject({ lastTime: 1000, elapsedMs: 0 });
  });
});
