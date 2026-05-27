'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import * as React from 'react';

const LOADING_DURATION_MS = 600;
const FADE_DURATION_MS = 200;
const TRICKLE_TARGET = 0.85;

type Phase = 'idle' | 'loading' | 'done';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

function PageTransitionBar({ phase, reducedMotion }: { phase: Phase; reducedMotion: boolean }) {
  if (phase === 'idle') return null;

  const isLoading = phase === 'loading';
  const transform = `scaleX(${isLoading ? TRICKLE_TARGET : 1})`;
  const opacity = phase === 'done' ? 0 : 1;
  const transition = reducedMotion
    ? `opacity ${FADE_DURATION_MS}ms linear`
    : `transform ${LOADING_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${FADE_DURATION_MS}ms linear`;

  return (
    <div
      data-testid="page-transition-progress"
      className="pointer-events-none fixed top-0 right-0 left-0 z-70 h-0.5"
      role="progressbar"
      aria-label="Page transition progress"
      aria-hidden={phase === 'done'}
    >
      <div
        className="h-full w-full origin-left"
        style={{
          backgroundColor: 'var(--accent)',
          transform,
          opacity,
          transition,
        }}
      />
    </div>
  );
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reducedMotion = usePrefersReducedMotion();

  const [phase, setPhase] = React.useState<Phase>('idle');
  const firstMountRef = React.useRef(true);
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = React.useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  React.useEffect(() => {
    if (firstMountRef.current) {
      firstMountRef.current = false;
      return;
    }

    clearTimers();

    if (reducedMotion) {
      setPhase('done');
      timersRef.current.push(setTimeout(() => setPhase('idle'), FADE_DURATION_MS));
      return;
    }

    setPhase('loading');
    timersRef.current.push(setTimeout(() => setPhase('done'), LOADING_DURATION_MS));
    timersRef.current.push(setTimeout(() => setPhase('idle'), LOADING_DURATION_MS + FADE_DURATION_MS));
  }, [pathname, searchParams, reducedMotion, clearTimers]);

  React.useEffect(() => clearTimers, [clearTimers]);

  return (
    <>
      <PageTransitionBar phase={phase} reducedMotion={reducedMotion} />
      {children}
    </>
  );
}
