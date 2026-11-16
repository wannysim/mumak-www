import { useEffect, useEffectEvent } from 'react';

/**
 * active인 동안만 requestAnimationFrame을 돌려 프레임 시각(ms)을 넘긴다. 쉬는 동안에는 돌리지 않는다
 * (tech-research.md 3장). 위치 계산은 받은 시각의 경과 시간으로만 하므로 주사율과 무관하다(0장).
 */
export function useFrameLoop(active: boolean, onFrame: (time: number) => void): void {
  const handleFrame = useEffectEvent(onFrame);
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    let frameId = requestAnimationFrame(function tick(time) {
      handleFrame(time);
      frameId = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frameId);
  }, [active]);
}
