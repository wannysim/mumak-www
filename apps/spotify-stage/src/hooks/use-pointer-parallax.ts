import { type RefObject, useEffect } from 'react';

/** iOS 13+ 의 DeviceOrientationEvent.requestPermission 을 타입 안전하게 다루기 위한 형태. */
type OrientationPermission = { requestPermission?: () => Promise<PermissionState> };

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/**
 * 마우스 이동(데스크톱)과 기기 기울기(모바일 자이로)를 -1~1 로 정규화해
 * 대상 엘리먼트에 --parallax-x/--parallax-y CSS 변수(px)로 기록한다.
 * rAF 로 부드럽게 lerp 하며, React 리렌더 없이 DOM 에 직접 쓴다.
 */
export function usePointerParallax(
  targetRef: RefObject<HTMLElement | null>,
  { enabled, strength }: { enabled: boolean; strength: number }
): void {
  useEffect(() => {
    const element = targetRef.current;
    if (!element) {
      return;
    }

    if (!enabled) {
      element.style.setProperty('--parallax-x', '0px');
      element.style.setProperty('--parallax-y', '0px');
      return;
    }

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId = 0;

    const onPointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      targetY = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    const onOrientation = (event: DeviceOrientationEvent) => {
      // gamma: 좌우 기울기(-90~90), beta: 앞뒤 기울기(-180~180). 중립을 45도로 본다.
      targetX = clampUnit((event.gamma ?? 0) / 45);
      targetY = clampUnit(((event.beta ?? 45) - 45) / 45);
    };

    // iOS 는 사용자 제스처 안에서 권한을 요청해야 deviceorientation 이 흐른다.
    const requestGyroPermission = () => {
      const orientation = window.DeviceOrientationEvent as unknown as OrientationPermission | undefined;
      orientation?.requestPermission?.().catch(() => undefined);
    };

    const loop = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      element.style.setProperty('--parallax-x', `${(currentX * strength).toFixed(2)}px`);
      element.style.setProperty('--parallax-y', `${(currentY * strength).toFixed(2)}px`);
      rafId = window.requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('pointerdown', requestGyroPermission, { once: true });
    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('pointerdown', requestGyroPermission);
      window.cancelAnimationFrame(rafId);
    };
  }, [targetRef, enabled, strength]);
}
