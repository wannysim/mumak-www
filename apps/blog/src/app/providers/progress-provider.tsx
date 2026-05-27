'use client';

import { useProgress } from '@bprogress/next';
import { ProgressProvider as BProgressProvider } from '@bprogress/next/app';
import { usePathname, useSearchParams } from 'next/navigation';
import * as React from 'react';

const PROGRESS_COLOR = 'var(--primary)';
const PROGRESS_HEIGHT = '2px';
const PROGRESS_DELAY_MS = 120;
const PROGRESS_STOP_DELAY_MS = 50;

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

function PageTransitionTrigger() {
  const { start, stop } = useProgress();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const firstMountRef = React.useRef(true);

  React.useEffect(() => {
    if (firstMountRef.current) {
      firstMountRef.current = false;
      return;
    }
    // When the App Router commits a new path/search, the navigation has
    // already started; surface a short "start → stop" transition so the
    // configured delay + stopDelay still produces a visible bar for
    // non-trivial navigations.
    start();
    stop();
  }, [pathname, searchParams, start, stop]);

  return null;
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <BProgressProvider
      color={PROGRESS_COLOR}
      height={PROGRESS_HEIGHT}
      delay={PROGRESS_DELAY_MS}
      stopDelay={PROGRESS_STOP_DELAY_MS}
      options={{
        showSpinner: false,
        easing: reducedMotion ? 'linear' : 'ease',
        speed: reducedMotion ? 0 : 200,
        trickle: !reducedMotion,
      }}
      shallowRouting
      disableAnchorClick
    >
      <PageTransitionTrigger />
      {children}
    </BProgressProvider>
  );
}
