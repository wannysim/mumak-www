import { useLayoutEffect, useState, type RefObject } from 'react';

import { computeLayout, type BookLayout, type Segment } from '@/lib/interaction';

type FoldWindow = Window & { viewport?: { segments?: Segment[] } };
type FoldNavigator = Navigator & { devicePosture?: EventTarget & { type: string } };

export function useBookLayout(ref: RefObject<HTMLElement | null>) {
  const [layout, setLayout] = useState<BookLayout>(() => computeLayout({ left: 0, top: 0, width: 900, height: 650 }));
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const bounds = element.getBoundingClientRect();
      const next = computeLayout(bounds, (window as FoldWindow).viewport?.segments);
      setLayout(current => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    const observer = new ResizeObserver(update);
    const posture = (navigator as FoldNavigator).devicePosture;
    observer.observe(element);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    posture?.addEventListener('change', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      posture?.removeEventListener('change', update);
    };
  }, [ref]);
  return layout;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useLayoutEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}
