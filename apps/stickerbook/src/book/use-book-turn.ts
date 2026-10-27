import { useCallback, useEffect, useRef, useState } from 'react';

import type { Turn } from '@/book/turning-page';
import { DEFAULT_GRIP, nextPage, visibleStart, type BookLayout, type PaperGrip } from '@/lib/interaction';

export function useBookTurn(layout: BookLayout, count: number, reduced: boolean) {
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const active = useRef<Turn | null>(null);
  const frame = useRef(0);
  const cancel = useCallback(() => {
    cancelAnimationFrame(frame.current);
    active.current = null;
    setTurn(null);
  }, []);
  useEffect(() => {
    // Layout and reduced motion are external changes that must terminate the active renderer.
    // oxlint-disable-next-line react/set-state-in-effect
    cancel();
    return () => cancelAnimationFrame(frame.current);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [layout, reduced, cancel]);
  function begin(direction: -1 | 1, instant = false, grip: PaperGrip = DEFAULT_GRIP) {
    if (active.current) return false;
    const from = visibleStart(page);
    const to = nextPage(page, direction, count);
    if (from === to) return false;
    if (reduced || instant) {
      setPage(to);
      return false;
    }
    active.current = { from, to, direction, progress: 0, grip };
    setTurn(active.current);
    return true;
  }
  function drag(progress: number, pullY = active.current?.grip.pullY ?? 0) {
    if (!active.current) return;
    active.current = {
      ...active.current,
      progress: Math.max(0, Math.min(1, progress)),
      grip: { ...active.current.grip, pullY },
    };
    setTurn(active.current);
  }
  function settle(complete: boolean) {
    const current = active.current;
    if (!current) return;
    if (!complete && current.progress === 0) {
      cancel();
      return;
    }
    cancelAnimationFrame(frame.current);
    const from = current.progress;
    const target = complete ? 1 : 0;
    const duration = Math.max(160, Math.abs(target - from) * 280);
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      drag(from + (target - from) * eased, current!.grip.pullY * (1 - eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else {
        if (complete) setPage(current!.to);
        active.current = null;
        setTurn(null);
      }
    }
    frame.current = requestAnimationFrame(tick);
  }
  function navigate(direction: -1 | 1, instant = false) {
    if (begin(direction, instant)) settle(true);
  }
  return { page, turn, begin, drag, settle, navigate, cancel, busy: !!turn };
}
