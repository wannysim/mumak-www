import { type CSSProperties, useEffect, useRef, useState } from 'react';

interface Burst {
  id: number;
  energy: number;
  accent: string;
}

/**
 * 곡이 바뀔 때 화면 중앙에서 퍼지는 일회성 충격파(블룸).
 * 세기(opacity·scale)는 새 곡의 energy 에 비례한다. 최초 마운트에는 터지지 않는다.
 */
export function EnergyBurst({ trackKey, energy, accent }: { trackKey: string; energy: number; accent: string }) {
  const [burst, setBurst] = useState<Burst | null>(null);
  const idRef = useRef(0);
  const prevKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevKeyRef.current !== null && prevKeyRef.current !== trackKey) {
      idRef.current += 1;
      setBurst({ id: idRef.current, energy, accent });
    }
    prevKeyRef.current = trackKey;
  }, [trackKey, energy, accent]);

  if (!burst) {
    return null;
  }

  const peakOpacity = 0.25 + burst.energy * 0.55;
  const peakScale = 1.8 + burst.energy * 1.4;

  return (
    <div className="pointer-events-none absolute inset-0 -z-[5] grid place-items-center" aria-hidden="true">
      <div
        key={burst.id}
        className="size-[60vmax] rounded-full blur-3xl"
        style={
          {
            background: `radial-gradient(circle, ${burst.accent} 0%, transparent 70%)`,
            '--burst-opacity': peakOpacity,
            '--burst-scale': peakScale,
            animation: 'stage-burst 1000ms ease-out forwards',
          } as CSSProperties
        }
        onAnimationEnd={() => setBurst(null)}
      />
    </div>
  );
}
