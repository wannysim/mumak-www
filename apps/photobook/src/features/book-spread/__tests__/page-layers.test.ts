import { describe, expect, it } from 'vitest';

import type { BookScene } from '@/model/book/book-state';
import { computeOpenGeometry, turnFrame } from '@/model/book/geometry';
import type { OpenGeometry } from '@/model/book/geometry';
import { advanceTurn, beginClickTurn, beginDragTurn, continueDragTurn } from '@/model/book/turn-session';
import type { TurnDirection } from '@/model/fold';
import { nextView, previousView } from '@/model/fold';

import { describePageLayers } from '../page-layers';

const spread = computeOpenGeometry({ width: 1440, height: 900 }, 'spread');
const single = computeOpenGeometry({ width: 390, height: 844 }, 'single');
const PAGE_COUNT = 8;

function clickTurning(
  geometry: OpenGeometry,
  view: Extract<BookScene, { phase: 'open' }>['view'],
  direction: TurnDirection,
  elapsedMs: number
): Extract<BookScene, { phase: 'turning' }> {
  const move = direction === 'forward' ? nextView(view, PAGE_COUNT) : previousView(view, PAGE_COUNT);
  if (move === null) {
    throw new Error('move expected');
  }
  const setup = { frame: turnFrame(geometry, direction), direction, page: geometry.page };
  const session = advanceTurn(advanceTurn(beginClickTurn(setup, null), 0), elapsedMs);
  return { phase: 'turning', view, move, session };
}

describe('describePageLayers', () => {
  it('should lay out the visible pages at rest without transforms', () => {
    const layers = describePageLayers({ phase: 'open', view: { layout: 'spread', spread: 1 } }, spread, false);
    expect(layers.map(layer => [layer.key, layer.role, layer.box.x, layer.inert])).toEqual([
      ['page-3', 'rest', 0, false],
      ['page-4', 'rest', spread.page.width, false],
    ]);
    expect(layers.every(layer => layer.clipPath === null && layer.transform === null && layer.opacity === null)).toBe(
      true
    );
    const phone = describePageLayers({ phase: 'open', view: { layout: 'single', page: 5 } }, single, false);
    expect(phone.map(layer => layer.key)).toEqual(['page-5']);
  });

  it('should split a forward turn into the still page, the revealed page, the clipped leaf and its back', () => {
    const scene = clickTurning(spread, { layout: 'spread', spread: 0 }, 'forward', 400);
    const layers = describePageLayers(scene, spread, false);
    const byRole = Object.fromEntries(layers.map(layer => [layer.role, layer]));
    expect(byRole.static?.page).toBe(1);
    expect(byRole.static?.inert).toBe(false);
    expect(byRole.revealed?.page).toBe(4);
    expect(byRole.upper?.page).toBe(2);
    expect(byRole.upper?.clipPath).toMatch(/^polygon\(/);
    expect(byRole.flap?.page).toBe(3);
    expect(byRole.flap?.transform).toMatch(/^matrix\(/);
    expect(byRole.flap?.box).toMatchObject({ x: 0, y: 0 });
    expect([byRole.revealed, byRole.upper, byRole.flap].every(layer => layer?.inert)).toBe(true);
    expect(byRole.flap!.zIndex).toBeGreaterThan(byRole.upper!.zIndex);
  });

  it('should mirror the roles going backward', () => {
    const scene = clickTurning(spread, { layout: 'spread', spread: 2 }, 'backward', 400);
    const layers = describePageLayers(scene, spread, false);
    const pages = Object.fromEntries(layers.map(layer => [layer.role, layer.page]));
    expect(pages).toEqual({ static: 6, revealed: 3, upper: 5, flap: 4 });
    const upper = layers.find(layer => layer.role === 'upper');
    expect(upper?.box.x).toBe(0);
  });

  it('should fold the single page over blank paper', () => {
    const forward = describePageLayers(
      clickTurning(single, { layout: 'single', page: 2 }, 'forward', 300),
      single,
      false
    );
    expect(forward.map(layer => [layer.key, layer.role])).toEqual([
      ['page-3', 'revealed'],
      ['page-2', 'upper'],
      ['blank-flap', 'flap'],
    ]);
    const backward = describePageLayers(
      clickTurning(single, { layout: 'single', page: 3 }, 'backward', 300),
      single,
      false
    );
    expect(backward.map(layer => [layer.page, layer.role])).toEqual([
      [2, 'revealed'],
      [3, 'upper'],
      [null, 'flap'],
    ]);
  });

  it('should crossfade whole spreads with reduced motion', () => {
    const view = { layout: 'spread', spread: 0 } as const;
    const move = nextView(view, PAGE_COUNT);
    if (move === null) {
      throw new Error('move expected');
    }
    const setup = { frame: turnFrame(spread, 'forward'), direction: 'forward' as const, page: spread.page };
    const origin = { x: spread.page.width * 2 - 5, y: 300 };
    const session = continueDragTurn(
      beginDragTurn(setup, origin, { x: origin.x - 20, y: 300 }, 0),
      { x: 507, y: 300 },
      50
    );
    const layers = describePageLayers({ phase: 'turning', view, move, session }, spread, true);
    // 다음 펼침(03–04)을 아래에, 지금 펼침(01–02)을 위에 같은 투명도로 겹친다. 있지 않은 펼침(01 + 04)이 보이지 않는다.
    expect(layers.map(layer => [layer.key, layer.role, layer.box.x])).toEqual([
      ['page-3', 'revealed', 0],
      ['page-4', 'revealed', spread.page.width],
      ['page-1', 'upper', 0],
      ['page-2', 'upper', spread.page.width],
    ]);
    const current = layers.filter(layer => layer.role === 'upper');
    expect(current[0]?.opacity).toBeCloseTo(0.5, 1);
    expect(current[1]?.opacity).toBe(current[0]?.opacity);
    expect(layers.every(layer => layer.clipPath === null && layer.transform === null && layer.inert)).toBe(true);
  });
});
