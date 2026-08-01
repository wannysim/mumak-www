'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { cn } from '@mumak/ui/lib/utils';

const LOADING_GROW_MS = 6000;
const DONE_FADE_MS = 200;
const SAFETY_TIMEOUT_MS = 8000;
const TRICKLE_TARGET = 0.85;
const INITIAL_SCALE = 0.08;

type Phase = 'idle' | 'loading' | 'done';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onStoreChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onStoreChange);
  return () => query.removeEventListener('change', onStoreChange);
}

function usePrefersReducedMotion() {
  return React.useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
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

function PageTransitionBar({ phase, scale, reducedMotion }: { phase: Phase; scale: number; reducedMotion: boolean }) {
  const t = useTranslations('common');

  if (phase === 'idle') return null;

  const isLoading = phase === 'loading';
  const opacity = phase === 'done' ? 0 : 1;
  // The fill is the native progress value, so its growth transition lives on the
  // ::-webkit-progress-value / ::-moz-progress-bar pseudo-elements and is fed in via
  // a CSS variable (pseudo-elements can't take inline styles). Opacity still
  // transitions on the element itself.
  const valueTransition = reducedMotion
    ? 'none'
    : isLoading
      ? `width ${LOADING_GROW_MS}ms cubic-bezier(0.1, 0.5, 0.2, 1)`
      : `width ${DONE_FADE_MS}ms ease-out`;

  return (
    <progress
      data-testid="page-transition-progress"
      className={cn(
        'pointer-events-none fixed top-0 right-0 left-0 z-70 h-1 w-full appearance-none border-0 bg-transparent',
        '[&::-webkit-progress-bar]:bg-transparent',
        '[&::-webkit-progress-value]:bg-[var(--ring)] [&::-webkit-progress-value]:shadow-[0_0_8px_var(--ring),0_0_2px_var(--ring)] [&::-webkit-progress-value]:[transition:var(--ptb-value-transition)]',
        '[&::-moz-progress-bar]:bg-[var(--ring)] [&::-moz-progress-bar]:shadow-[0_0_8px_var(--ring),0_0_2px_var(--ring)] [&::-moz-progress-bar]:[transition:var(--ptb-value-transition)]'
      )}
      aria-label={t('pageTransitionProgress')}
      aria-hidden={phase === 'done'}
      value={scale}
      max={1}
      style={
        {
          opacity,
          transition: `opacity ${DONE_FADE_MS}ms linear`,
          '--ptb-value-transition': valueTransition,
        } as React.CSSProperties
      }
    />
  );
}

// useSearchParams()를 쓰는 상태 머신은 이 컴포넌트로 분리한다. ProgressProvider가
// children을 직접 감싸면 useSearchParams의 CSR bailout이 전체 페이지로 전파되어
// 정적 페이지가 클라이언트 렌더로 떨어진다(SEO 손실). 이 컴포넌트만 Suspense로
// 감싸고 children은 형제로 두어, 페이지 본문은 정적 prerender를 유지한다.
function PageTransitionIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reducedMotion = usePrefersReducedMotion();

  // phase와 scale은 항상 함께 바뀌므로 하나의 상태로 묶어 단계마다
  // setState가 한 번만 일어나도록 한다 (중간 상태 노출 방지).
  const [bar, setBar] = React.useState<{ phase: Phase; scale: number }>({ phase: 'idle', scale: INITIAL_SCALE });
  const firstMountRef = React.useRef(true);
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = React.useRef<number | null>(null);
  const phaseRef = React.useRef<Phase>('idle');
  phaseRef.current = bar.phase;

  const clearTimers = React.useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startLoading = React.useCallback(() => {
    clearTimers();
    // Mount the bar at a small width first, then grow toward the trickle target on
    // the next frame so the CSS transform transition actually animates (it can't
    // animate from an initial mount value). Without this the bar snaps to 85% and
    // freezes there, which reads as "stuck", not "loading".
    setBar({ phase: 'loading', scale: INITIAL_SCALE });
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        if (phaseRef.current === 'loading') setBar(prev => ({ ...prev, scale: TRICKLE_TARGET }));
      });
    });
    timersRef.current.push(
      setTimeout(() => {
        if (phaseRef.current === 'loading') {
          setBar({ phase: 'done', scale: 1 });
          timersRef.current.push(setTimeout(() => setBar(prev => ({ ...prev, phase: 'idle' })), DONE_FADE_MS));
        }
      }, SAFETY_TIMEOUT_MS)
    );
  }, [clearTimers]);

  const completeLoading = React.useCallback(() => {
    clearTimers();
    setBar({ phase: 'done', scale: 1 });
    timersRef.current.push(setTimeout(() => setBar(prev => ({ ...prev, phase: 'idle' })), DONE_FADE_MS));
  }, [clearTimers]);

  // startLoading is recreated whenever its deps change. Wrapping it as an Effect
  // Event lets the click observer call the latest version without listing it as a
  // reactive dependency, so the document listener isn't torn down and re-added on
  // every render — the subscription only depends on reducedMotion.
  const onStartLoading = React.useEffectEvent(() => startLoading());

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
      queueMicrotask(() => onStartLoading());
    };

    document.addEventListener('click', onClick, { capture: true, passive: true });
    return () => document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
  }, [reducedMotion]);

  // Settle the bar when the new route commits (or trigger a brief flash for
  // programmatic navigations that bypassed the click observer).
  // cleanup으로 clearTimers를 반환해, 이전 내비게이션이 남긴 타이머/raf가
  // 다음 커밋이나 언마운트 시점에 항상 정리되도록 한다 (200ms 내 연속
  // 내비게이션에서 이전 done→idle 타이머가 새 flash를 끊는 것도 방지).
  React.useEffect(() => {
    if (firstMountRef.current) {
      firstMountRef.current = false;
      return;
    }

    if (reducedMotion) {
      completeLoading();
    } else if (phaseRef.current === 'loading') {
      completeLoading();
    } else {
      setBar({ phase: 'loading', scale: INITIAL_SCALE });
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          if (phaseRef.current === 'loading') setBar(prev => ({ ...prev, scale: TRICKLE_TARGET }));
        });
      });
      timersRef.current.push(setTimeout(() => completeLoading(), 80));
    }

    return clearTimers;
  }, [pathname, searchParams, reducedMotion, clearTimers, completeLoading]);

  React.useEffect(() => clearTimers, [clearTimers]);

  return <PageTransitionBar phase={bar.phase} scale={bar.scale} reducedMotion={reducedMotion} />;
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <React.Suspense>
        <PageTransitionIndicator />
      </React.Suspense>
      {children}
    </>
  );
}
