import type { BookScene } from '@/model/book/book-state';
import type { OpenGeometry } from '@/model/book/geometry';
import { pageBoxes, turnFrame } from '@/model/book/geometry';
import { computeLeafLayers, toCssMatrix, toCssPolygon } from '@/model/book/leaf-geometry';
import { currentTurnPose } from '@/model/book/turn-session';
import type { Rect } from '@/model/fold';
import { visiblePages } from '@/model/fold';

/**
 * 펼친 책에 그릴 쪽 요소 목록. 쪽마다 key가 같아서 쉬는 상태 ↔ 넘김 중 역할이 바뀌어도 같은 DOM 요소가 이어진다
 * (착지 순간 이미지를 다시 붙이지 않는다). 좌표는 책 좌표(book-local, CSS px)다.
 *
 * 역할:
 * - rest: 쉬는 상태의 보이는 쪽. 변환 없음.
 * - static: 넘김 중 움직이지 않는 반대쪽 쪽.
 * - upper: 넘어가는 장 중 지금 보이는 면. 평평한 부분만 clip-path로 남긴다.
 * - revealed: 넘어가는 장 아래에서 드러나는 쪽.
 * - flap: 넘어가는 장의 다른 면. 접힘선 반사 변환으로 그린다. 세로 휴대폰 한 쪽 배치에서는 흰 종이(page null).
 *
 * 넘김 중 움직이는 쪽(upper·revealed·flap)은 inert로 둔다(tech-research.md 7장 공통 규칙).
 * 동작 줄이기에서 끄는 동안은 곡면 없이 펼침면 전체를 교차한다: 다음 화면의 쪽을 아래에 두고 지금 화면의 쪽(모두 upper)을
 * 진행도만큼 투명하게 한다. 한 쪽만 바꾸면 있지 않은 펼침(예: 03 + 06)이 보이기 때문이다(임시, 7장 U7 (c)).
 */
type PageLayerRole = 'rest' | 'static' | 'upper' | 'revealed' | 'flap';

export type PageLayer = {
  readonly key: string;
  /** null이면 내용 없는 흰 종이. */
  readonly page: number | null;
  readonly role: PageLayerRole;
  readonly box: Rect;
  readonly clipPath: string | null;
  readonly transform: string | null;
  readonly opacity: number | null;
  readonly zIndex: number;
  readonly inert: boolean;
};

type OpenScene = Extract<BookScene, { phase: 'open' | 'turning' }>;
type TurningScene = Extract<BookScene, { phase: 'turning' }>;

/** 쌓는 순서. 가운데 접힘 그늘(book-spread.css, z-index 3)은 윗장 위, 날개 아래에 온다. */
const LAYER_ORDER: Readonly<Record<PageLayerRole, number>> = {
  rest: 1,
  static: 1,
  revealed: 1,
  upper: 2,
  flap: 4,
};

function layer(
  page: number | null,
  role: PageLayerRole,
  box: Rect,
  overrides: Partial<Pick<PageLayer, 'clipPath' | 'transform' | 'opacity'>> = {}
): PageLayer {
  return {
    key: page === null ? 'blank-flap' : `page-${page}`,
    page,
    role,
    box,
    clipPath: overrides.clipPath ?? null,
    transform: overrides.transform ?? null,
    opacity: overrides.opacity ?? null,
    zIndex: LAYER_ORDER[role],
    inert: role !== 'rest' && role !== 'static',
  };
}

function boxAt(origin: { readonly x: number; readonly y: number }, geometry: OpenGeometry): Rect {
  return { x: origin.x, y: origin.y, width: geometry.page.width, height: geometry.page.height };
}

function restLayers(scene: OpenScene, geometry: OpenGeometry): PageLayer[] {
  const boxes = pageBoxes(geometry);
  return visiblePages(scene.view).map((page, index) => layer(page, 'rest', boxes[index] as Rect));
}

/** 넘기는 장의 두 면과 드러나는 쪽, 움직이지 않는 쪽. */
function turningPages(scene: TurningScene): {
  readonly upper: number;
  readonly under: number | null;
  readonly revealed: number;
  readonly still: number | null;
} {
  const { view, move } = scene;
  if (view.layout === 'single' || move.turn === null) {
    return {
      upper: visiblePages(view)[0] as number,
      under: null,
      revealed: visiblePages(move.view)[0] as number,
      still: null,
    };
  }
  const { turn } = move;
  const [left, right] = visiblePages(view) as [number, number];
  return turn.direction === 'forward'
    ? { upper: turn.frontPage, under: turn.backPage, revealed: turn.revealedPage, still: left }
    : { upper: turn.backPage, under: turn.frontPage, revealed: turn.revealedPage, still: right };
}

/** 동작 줄이기: 다음 화면 위에 지금 화면을 진행도만큼 투명하게 겹친다. */
function crossfadeLayers(scene: TurningScene, geometry: OpenGeometry, progress: number): PageLayer[] {
  const boxes = pageBoxes(geometry);
  const nextPages = visiblePages(scene.move.view).map((page, index) => layer(page, 'revealed', boxes[index] as Rect));
  const currentPages = visiblePages(scene.view).map((page, index) =>
    layer(page, 'upper', boxes[index] as Rect, { opacity: 1 - progress })
  );
  return [...nextPages, ...currentPages];
}

function turningLayers(scene: TurningScene, geometry: OpenGeometry, reducedMotion: boolean): PageLayer[] {
  const { session } = scene;
  const pose = currentTurnPose(session);
  if (reducedMotion) {
    return crossfadeLayers(scene, geometry, pose.progress);
  }
  const pages = turningPages(scene);
  const leaf = computeLeafLayers(
    { frame: turnFrame(geometry, session.direction), direction: session.direction, page: session.page },
    pose.fold
  );
  const upperBox = boxAt(leaf.upperOrigin, geometry);
  const layers: PageLayer[] = [];
  if (pages.still !== null) {
    layers.push(layer(pages.still, 'static', boxAt(leaf.flapRestOrigin, geometry)));
  }
  layers.push(layer(pages.revealed, 'revealed', upperBox));
  layers.push(layer(pages.upper, 'upper', upperBox, { clipPath: toCssPolygon(leaf.upperClip) }));
  layers.push(
    layer(pages.under, 'flap', boxAt({ x: 0, y: 0 }, geometry), {
      clipPath: toCssPolygon(leaf.flapClip),
      transform: toCssMatrix(leaf.flapTransform),
    })
  );
  return layers;
}

export function describePageLayers(scene: OpenScene, geometry: OpenGeometry, reducedMotion: boolean): PageLayer[] {
  return scene.phase === 'open' ? restLayers(scene, geometry) : turningLayers(scene, geometry, reducedMotion);
}
