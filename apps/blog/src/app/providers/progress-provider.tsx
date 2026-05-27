'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import * as React from 'react';

const LOADING_GROW_MS = 6000;
const DONE_FADE_MS = 200;
const SAFETY_TIMEOUT_MS = 8000;
const TRICKLE_TARGET = 0.85;

type Phase = 'idle' | 'loading' | 'done';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

function isInternalNavigationClick(event: MouseEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const target = event.target;
  if (!(target instanceof Element)) return false;

  const anchor = target.closest('a');
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (!anchor.href) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;

  // Hash-only / identical URL: not a real navigation, App Router won't repaint.
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return false;
  }

  return true;
}

function PageTransitionBar({ phase, reducedMotion }: { phase: Phase; reducedMotion: boolean }) {
  if (phase === 'idle') return null;

  const isLoading = phase === 'loading';
  const transform = `scaleX(${isLoading ? TRICKLE_TARGET : 1})`;
  const opacity = phase === 'done' ? 0 : 1;
  const transition = reducedMotion
    ? `opacity ${DONE_FADE_MS}ms linear`
    : isLoading
      ? `transform ${LOADING_GROW_MS}ms cubic-bezier(0.1, 0.5, 0.2, 1), opacity ${DONE_FADE_MS}ms linear`
      : `transform ${DONE_FADE_MS}ms ease-out, opacity ${DONE_FADE_MS}ms linear`;

  return (
    <div
      data-testid="page-transition-progress"
      className="pointer-events-none fixed top-0 right-0 left-0 z-70 h-1"
      role="progressbar"
      aria-label="Page transition progress"
      aria-hidden={phase === 'done'}
    >
      <div
        className="h-full w-full origin-left"
        style={{
          backgroundColor: 'var(--ring)',
          boxShadow: '0 0 8px var(--ring), 0 0 2px var(--ring)',
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
  const phaseRef = React.useRef<Phase>('idle');
  phaseRef.current = phase;

  const clearTimers = React.useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const startLoading = React.useCallback(() => {
    clearTimers();
    setPhase('loading');
    timersRef.current.push(
      setTimeout(() => {
        if (phaseRef.current === 'loading') {
          setPhase('done');
          timersRef.current.push(setTimeout(() => setPhase('idle'), DONE_FADE_MS));
        }
      }, SAFETY_TIMEOUT_MS)
    );
  }, [clearTimers]);

  const completeLoading = React.useCallback(() => {
    clearTimers();
    setPhase('done');
    timersRef.current.push(setTimeout(() => setPhase('idle'), DONE_FADE_MS));
  }, [clearTimers]);

  // Observe internal anchor clicks to surface the bar *during* navigation.
  // Why this is safe on webkit (unlike the previous @bprogress integration):
  //  - capture phase, passive — no preventDefault, no stopPropagation
  //  - no history.pushState/replaceState wrapping
  //  - state update is deferred via queueMicrotask so it never runs
  //    synchronously inside webkit's click dispatch.
  React.useEffect(() => {
    if (reducedMotion) return;

    const onClick = (event: MouseEvent) => {
      if (!isInternalNavigationClick(event)) return;
      queueMicrotask(() => startLoading());
    };

    document.addEventListener('click', onClick, { capture: true, passive: true });
    return () => document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
  }, [reducedMotion, startLoading]);

  // Settle the bar when the new route commits (or trigger a brief flash for
  // programmatic navigations that bypassed the click observer).
  React.useEffect(() => {
    if (firstMountRef.current) {
      firstMountRef.current = false;
      return;
    }

    if (reducedMotion) {
      clearTimers();
      setPhase('done');
      timersRef.current.push(setTimeout(() => setPhase('idle'), DONE_FADE_MS));
      return;
    }

    if (phaseRef.current === 'loading') {
      completeLoading();
    } else {
      setPhase('loading');
      timersRef.current.push(setTimeout(() => completeLoading(), 80));
    }
  }, [pathname, searchParams, reducedMotion, clearTimers, completeLoading]);

  React.useEffect(() => clearTimers, [clearTimers]);

  return (
    <>
      <PageTransitionBar phase={phase} reducedMotion={reducedMotion} />
      {children}
    </>
  );
}
