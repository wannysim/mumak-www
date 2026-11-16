import * as React from 'react';
import { preload } from 'react-dom';

import { photoSourceOf } from '@/content/pages';
import { UI_TEXT } from '@/content/temporary';
import { useDocumentKeyDown } from '@/hooks/use-document-key-down';
import { joinClassNames } from '@/lib/class-names';
import { isTextEntry } from '@/lib/keyboard-focus';
import type { BookEvent, BookScene } from '@/model/book/book-state';
import { closingSideAt, turnBaseView } from '@/model/book/book-state';
import type { OpenGeometry } from '@/model/book/geometry';
import { toBookLocal } from '@/model/book/geometry';
import { openBookKeyAction } from '@/model/book/keyboard';
import type { CoverSide } from '@/model/book/rotation';
import type { GestureContext, GestureEvent, GestureState, TurnDirection, Vec2 } from '@/model/fold';
import {
  DEFAULT_DRAG_START_DISTANCE_PX,
  IDLE_GESTURE,
  nextView,
  previousView,
  reduceGesture,
  visiblePages,
} from '@/model/fold';

import { BookPage } from './book-page';
import type { PageLayer } from './page-layers';
import { describePageLayers } from './page-layers';

import './book-spread.css';

type SpreadScene = Extract<BookScene, { phase: 'open' | 'turning' | 'closing' }>;

const TURN_DIRECTIONS: readonly TurnDirection[] = ['backward', 'forward'];

function TurnGlyph({ direction }: { direction: TurnDirection }) {
  // 얇은 선 화살표 1rem. 표시는 임시, open-decisions G2 "클릭 넘김 영역의 배치와 표시"(시안 flip-hint).
  const path = direction === 'forward' ? 'M2 8h12M9.5 3.5 14 8l-4.5 4.5' : 'M14 8H2M6.5 3.5 2 8l4.5 4.5';
  return (
    <svg className="turn-button__glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function PageLayerView({ layer, layout }: { layer: PageLayer; layout: OpenGeometry['layout'] }) {
  const surfaceStyle: React.CSSProperties = {
    left: layer.box.x,
    top: layer.box.y,
    width: layer.box.width,
    height: layer.box.height,
    clipPath: layer.clipPath ?? undefined,
    transform: layer.transform ?? undefined,
  };
  return (
    <div
      className="page-layer pointer-events-none absolute inset-0"
      data-role={layer.role}
      inert={layer.inert}
      style={{ zIndex: layer.zIndex, opacity: layer.opacity ?? undefined }}
    >
      <div className="page-surface absolute origin-top-left bg-background" style={surfaceStyle}>
        {layer.page === null ? null : <BookPage page={layer.page} layout={layout} />}
      </div>
    </div>
  );
}

/** 이웃 펼침의 사진을 미리 받아 넘기는 순간 빈 쪽이 보이지 않게 한다. */
function preloadNeighbors(scene: SpreadScene, pageCount: number): void {
  const moves = [nextView(scene.view, pageCount), previousView(scene.view, pageCount)];
  for (const move of moves) {
    if (move === null) {
      continue;
    }
    const pages = move.turn === null ? [] : [move.turn.frontPage, move.turn.backPage];
    for (const page of [...pages, ...visiblePages(move.view)]) {
      const source = photoSourceOf(page);
      if (source !== null) {
        preload(source, { as: 'image' });
      }
    }
  }
}

function pointOf(event: React.PointerEvent<HTMLElement>): Vec2 {
  return { x: event.clientX, y: event.clientY };
}

function buttonLabel(direction: TurnDirection, closeSide: CoverSide | null): string {
  if (closeSide !== null) {
    return closeSide === 'front' ? UI_TEXT.closeFront : UI_TEXT.closeBack;
  }
  return direction === 'forward' ? UI_TEXT.nextPage : UI_TEXT.previousPage;
}

/**
 * 펼친 책. 쪽 바깥 가장자리 띠에서 화면 가장자리까지가 넘김 버튼 기둥이다(이전 쪽·다음 쪽).
 * - 양 끝(첫 펼침의 이전, 마지막 펼침의 다음)에서는 넘길 장이 없어 같은 기둥이 표지 덮기 버튼이 된다(앞표지 덮기·뒤표지 덮기).
 *   드래그·버튼·←/→가 모두 같은 넘김 입력이고, 상태 기계가 끝에서는 덮기로 바꾼다(book-state.ts).
 * - 손으로 덮는 동안(closing)에도 이 영역이 포인터를 붙잡고 있어야 해서 그대로 남는다. 보이는 것은 3D 책이 맡는다(app.tsx).
 * - 클릭(포인터·키보드·보조 기술)은 버튼의 click 하나로 받는다. 포인터 클릭이면 누른 높이를 잡는다.
 * - 드래그는 책 영역의 Pointer Events와 fold 모델 reduceGesture로 판별한다. 시작 영역은 geometry.dragZones다.
 *   넘김이 입력 주인이 되면 누른 요소에 포인터를 붙잡아, 손을 뗀 곳이 러닝 헤드 위든 창 밖이든 pointerup을 받는다.
 *   버튼을 누르지 않은 move가 오거나(놓친 pointerup) 포인터를 잃으면 각각 놓기·취소로 본다.
 *   드래그 뒤 버튼에 오는 click은 넘김으로 보지 않는다.
 * - ←/→는 포커스가 책에 없어도(문서 전체) 받는다(2026-11-16 사용자 결정). 자동 착지 중에 오면 지금 장을 착지시키고 이어서
 *   넘긴다(book-state.ts).
 * - 펼친 직후 포커스는 takeFocus일 때만 책 영역으로 옮긴다(사라질 닫힌 책 버튼에 포커스가 있었을 때).
 */
function BookSpread({
  scene,
  geometry,
  pageCount,
  reducedMotion,
  takeFocus,
  onBookEvent,
  className,
  style,
  ...props
}: React.ComponentProps<'section'> & {
  scene: SpreadScene;
  geometry: OpenGeometry;
  pageCount: number;
  reducedMotion: boolean;
  /** 나타날 때 책 영역으로 포커스를 옮길지(App이 펼치기를 일으킨 입력 때의 포커스로 정한다). */
  takeFocus: boolean;
  onBookEvent: (event: BookEvent) => void;
}) {
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const pagesRef = React.useRef<HTMLDivElement | null>(null);
  const gestureRef = React.useRef<GestureState>(IDLE_GESTURE);
  const suppressClickRef = React.useRef(false);
  const { layout } = geometry;

  // 나타날 때 takeFocus면(펼치기를 일으킨 입력 때 사라질 닫힌 책 버튼에 포커스가 있었다. Tab으로 온 키보드·보조 기술 사용자)
  // 책 영역으로 포커스를 옮긴다. 포커스가 body였으면(문서 단위 키·포인터로 쓰는 중) 옮기지 않아 책에 포커스 표시가 생기지
  // 않는다(2026-11-16 사용자 결정, tech-research.md 7장 공통 규칙 "포커스된 노드가 사라지기 전에 옮긴다").
  const focusIfAsked = React.useEffectEvent(() => {
    if (takeFocus) {
      sectionRef.current?.focus({ preventScroll: true });
    }
  });
  React.useEffect(() => {
    focusIfAsked();
  }, []);

  // 어느 방향이든 넘길 장이 있으면 넘기고, 끝이면 덮는다. 그래서 받을 수 있는지는 방향과 무관하다.
  const baseView = turnBaseView(scene);
  const canAct = baseView !== null;
  const endView = baseView ?? scene.view;
  const closeSides: Record<TurnDirection, CoverSide | null> = {
    backward: closingSideAt(endView, 'backward', pageCount),
    forward: closingSideAt(endView, 'forward', pageCount),
  };
  const gestureContext: GestureContext = {
    surface: {
      interactiveRegions: [],
      turnRegions: canAct ? TURN_DIRECTIONS.map(direction => ({ direction, rect: geometry.dragZones[direction] })) : [],
    },
    dragStartDistancePx: DEFAULT_DRAG_START_DISTANCE_PX,
  };

  preloadNeighbors(scene, pageCount);

  /** 넘어가는 쪽 안에 포커스가 있으면 inert가 되기 전에 책 영역으로 옮긴다(tech-research.md 7장). */
  function moveFocusOutOfPages() {
    if (pagesRef.current?.contains(document.activeElement)) {
      sectionRef.current?.focus({ preventScroll: true });
    }
  }

  function turnByClick(direction: TurnDirection, press: Vec2 | null) {
    if (!canAct) {
      return;
    }
    moveFocusOutOfPages();
    onBookEvent({ type: 'turn-click', direction, press, geometry, reducedMotion });
  }

  function handleButtonClick(direction: TurnDirection, event: React.MouseEvent<HTMLButtonElement>) {
    const fromPointer = event.detail > 0;
    if (fromPointer && suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    turnByClick(direction, fromPointer ? toBookLocal({ x: event.clientX, y: event.clientY }, geometry) : null);
  }

  // ←/→는 포커스가 책에 없어도(body·러닝 헤드) 넘긴다(2026-11-16 사용자 결정, tech-research.md 7장 공통 규칙 "키 범위").
  // 입력칸·편집 영역의 화살표는 글자 커서 몫이다.
  useDocumentKeyDown(event => {
    if (event.defaultPrevented || isTextEntry(event.target)) {
      return;
    }
    const action = openBookKeyAction(event);
    if (action === null) {
      return;
    }
    event.preventDefault();
    turnByClick(action === 'next' ? 'forward' : 'backward', null);
  });

  function stepGesture(event: React.PointerEvent<HTMLElement>, gestureEvent: GestureEvent) {
    const wasPressed = gestureRef.current.phase === 'pressed';
    const step = reduceGesture(gestureRef.current, gestureEvent, gestureContext);
    gestureRef.current = step.state;
    const { effect } = step;
    if (wasPressed && gestureEvent.type === 'up' && effect.type === 'none') {
      // 드래그가 시작되지 않은 채 시작 거리 밖에서 뗐다. 클릭을 취소한 것으로 본다(input-priority.ts).
      suppressClickRef.current = true;
    }
    if (effect.type === 'drag-start' && effect.owner.type === 'turn') {
      moveFocusOutOfPages();
      onBookEvent({
        type: 'turn-drag-start',
        direction: effect.owner.direction,
        origin: toBookLocal(effect.origin, geometry),
        point: toBookLocal(effect.point, geometry),
        time: event.timeStamp,
        geometry,
      });
    } else if (effect.type === 'drag-move') {
      onBookEvent({
        type: 'turn-drag-move',
        point: toBookLocal(effect.point, geometry),
        time: event.timeStamp,
        geometry,
      });
    } else if (effect.type === 'drag-end') {
      suppressClickRef.current = true;
      onBookEvent({
        type: 'turn-drag-end',
        point: toBookLocal(effect.point, geometry),
        time: event.timeStamp,
        geometry,
        reducedMotion,
      });
    } else if (effect.type === 'drag-cancel') {
      suppressClickRef.current = true;
      onBookEvent({ type: 'turn-drag-cancel', geometry, reducedMotion });
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }
    suppressClickRef.current = false;
    stepGesture(event, { type: 'down', pointerId: event.pointerId, point: pointOf(event) });
    if (gestureRef.current.phase !== 'pressed') {
      return;
    }
    // 누른 요소(버튼이면 버튼)에 붙잡아야 click이 그 버튼으로 간다. 붙잡으면 up이 어디서 오든 이 영역이 받는다.
    if (event.target instanceof Element) {
      event.target.setPointerCapture?.(event.pointerId);
    }
    // 마우스로 쪽 위를 끌 때 글자 선택·이미지 끌기가 시작되지 않게 한다(터치는 touch-action으로 막는다).
    if (event.pointerType === 'mouse') {
      event.preventDefault();
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const point = pointOf(event);
    // 누른 버튼이 하나도 없는데 누른 상태라면 pointerup을 놓친 것이다. 그 자리에서 뗀 것으로 본다.
    const type = event.buttons === 0 && gestureRef.current.phase !== 'idle' ? 'up' : 'move';
    stepGesture(event, { type, pointerId: event.pointerId, point });
  }

  const layers = describePageLayers(scene, geometry, reducedMotion);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- 넘김 드래그는 책 영역(region) 안에서만 받는다. ←/→는 문서 단위로 받는다(tech-research.md 7장 공통 규칙 "키 범위"). 클릭 대안은 안의 네이티브 버튼이다.
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-label={UI_TEXT.bookRegion}
      className={joinClassNames(
        'book-stage fixed inset-0 overflow-hidden data-[phase=closing]:select-none data-[phase=turning]:select-none',
        className
      )}
      data-layout={layout}
      data-phase={scene.phase}
      data-motion={reducedMotion ? 'reduced' : 'full'}
      style={{ ...style, '--turn-gutter': `${geometry.book.x}px` } as React.CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={event => stepGesture(event, { type: 'up', pointerId: event.pointerId, point: pointOf(event) })}
      onPointerCancel={event => stepGesture(event, { type: 'cancel', pointerId: event.pointerId })}
      onLostPointerCapture={event => stepGesture(event, { type: 'cancel', pointerId: event.pointerId })}
      {...props}
    >
      <div
        className="book absolute touch-none bg-background select-none"
        data-layout={layout}
        style={{
          left: geometry.book.x,
          top: geometry.book.y,
          width: geometry.book.width,
          height: geometry.book.height,
        }}
      >
        <div className="book__chrome pointer-events-none absolute inset-0" aria-hidden="true" />
        <div ref={pagesRef} className="book__pages absolute inset-0">
          {layers.map(layer => (
            <PageLayerView key={layer.key} layer={layer} layout={layout} />
          ))}
        </div>
        {layout === 'spread' ? (
          <div className="book__fold-shade pointer-events-none absolute inset-0 z-3" aria-hidden="true" />
        ) : null}
      </div>
      {TURN_DIRECTIONS.map(direction => {
        const zone = geometry.turnZones[direction];
        return (
          <button
            key={direction}
            type="button"
            className="turn-button absolute z-20 cursor-pointer touch-none border-0 bg-transparent p-0 text-foreground select-none"
            data-direction={direction}
            aria-label={buttonLabel(direction, closeSides[direction])}
            data-action={closeSides[direction] === null ? 'turn' : 'close'}
            style={{ left: zone.x, top: zone.y, width: zone.width, height: zone.height }}
            onClick={event => handleButtonClick(direction, event)}
          >
            <TurnGlyph direction={direction} />
          </button>
        );
      })}
    </section>
  );
}

export { BookSpread };
