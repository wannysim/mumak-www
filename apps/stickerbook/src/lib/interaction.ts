export type Segment = { left: number; top: number; width: number; height: number };
export type BookLayout = {
  mode: 'spread';
  compact: boolean;
  width: number;
  height: number;
  gap: number;
  x: number;
  y: number;
  posture: 'flat' | 'book' | 'tabletop';
};

export function computeLayout(area: Segment, segments: readonly Segment[] = []): BookLayout {
  const ordered = segments.toSorted((a, b) => a.left - b.left || a.top - b.top);
  const [first, second] = ordered;
  const horizontal = first && second && second.left >= first.left + first.width - 1;
  const vertical = first && second && second.top >= first.top + first.height - 1;
  const availableHeight = Math.max(1, (vertical ? first.top + first.height - area.top : area.height) - 32);
  const compact = availableHeight < 200;
  const gap = horizontal ? Math.max(0, second.left - first.left - first.width) + 12 : 0;
  const maxWidth = horizontal ? Math.min(first.width, second.width) - 30 : (area.width - 40) / 2;
  const pageWidth = Math.max(1, Math.min(480, maxWidth, availableHeight * (availableHeight < 200 ? 1.45 : 480 / 620)));
  const width = pageWidth * 2 + gap;
  const height = availableHeight < 200 ? Math.min(availableHeight, pageWidth / 1.45) : (pageWidth * 620) / 480;
  const x = horizontal ? first.left + first.width - area.left - pageWidth - 6 : (area.width - width) / 2;
  return {
    mode: 'spread',
    compact,
    width,
    height,
    gap,
    x,
    y: Math.max(12, (availableHeight + 32 - height) / 2),
    posture: horizontal ? 'book' : vertical ? 'tabletop' : 'flat',
  };
}

export function visibleStart(page: number) {
  return Math.floor(page / 2) * 2;
}

export function nextPage(page: number, direction: -1 | 1, count: number) {
  return Math.max(0, Math.min(count - 2, visibleStart(page) + direction * 2));
}

export function shouldCompleteTurn(progress: number, velocity: number) {
  return progress > 0.25 || (progress > 0.06 && velocity > 0.45);
}

export function peelResult(distance: number, peakVelocity: number): 'attached' | 'clean' | 'residue' {
  if (distance < 64) return 'attached';
  return peakVelocity > 0.65 ? 'residue' : 'clean';
}

export type PaperGrip = { y: number; pullY: number };
export const DEFAULT_GRIP: PaperGrip = { y: 0.88, pullY: 0 };
