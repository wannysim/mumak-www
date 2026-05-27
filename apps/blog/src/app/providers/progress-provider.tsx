'use client';

import { ProgressProvider as BProgressProvider } from '@bprogress/next/app';
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
    >
      {children}
    </BProgressProvider>
  );
}
