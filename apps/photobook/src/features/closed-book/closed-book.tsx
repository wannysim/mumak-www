import * as React from 'react';
import { preload } from 'react-dom';

import { photoSourceOf } from '@/content/pages';
import { COVER_BACK_LINES, COVER_TAGLINE, coverDescription, PERSON_NAME, UI_TEXT } from '@/content/temporary';
import { BookPage } from '@/features/book-spread/book-page';
import { useDocumentKeyDown } from '@/hooks/use-document-key-down';
import { useHeldArrows } from '@/hooks/use-held-arrows';
import { useSafeAreaInsets } from '@/hooks/use-safe-area-insets';
import { joinClassNames } from '@/lib/class-names';
import { isActivationTarget } from '@/lib/keyboard-focus';
import type { BookEvent, ClosedMotion } from '@/model/book/book-state';
import { initialView } from '@/model/book/book-state';
import type { ClosedPlacement, OpenGeometry } from '@/model/book/geometry';
import { computeClosedPlacement, coverLayout } from '@/model/book/geometry';
import { closedBookKeyAction } from '@/model/book/keyboard';
import type { Viewport } from '@/model/book/layout';
import type { TransitionPose } from '@/model/book/opening';
import { bookMotionFrame, closedPerspective, outlineBounds, projectedBookOutline } from '@/model/book/projection';
import type { Quat, Vec3 } from '@/model/book/quaternion';
import { multiplyQuat, quatFromAxisAngle, toCssMatrix3d, Y_AXIS } from '@/model/book/quaternion';
import type { BookFace, Orientation } from '@/model/book/rotation';
import { coverAngleDeg, faceNormal, facingOf, isTurnedAway } from '@/model/book/rotation';
import type { SpinGesture, SpinGestureEvent } from '@/model/book/spin';
import { IDLE_SPIN_GESTURE, reduceSpinGesture, touchGuardInsets } from '@/model/book/spin';
import type { BookView } from '@/model/fold';

import './closed-book.css';

/** 펼치면 처음 드러나는 쪽(앞표지 안쪽 1쪽과 그 아래 2쪽). 손이 닿을 때 미리 받는다. */
const FIRST_SPREAD_PAGES: readonly number[] = [1, 2];

/**
 * 닫힌 책 아래 접지 그림자: 폭 = 닫힌 책 폭 × 1.3, 높이 = 두께 × 2.6, 중심은 책 아래 가장자리에서 두께 × 0.2 위.
 * 임시, open-decisions G0 "닫힌 책 형태·재질·조명, 그림자"(시안 closed-a).
 */
const GROUND_SHADOW_WIDTH_RATIO = 1.3;
const GROUND_SHADOW_HEIGHT_OF_DEPTH = 2.6;
const GROUND_SHADOW_LIFT_OF_DEPTH = 0.2;

/**
 * 책등 이름을 그릴 최소 정도(책등 면 법선의 z). 이보다 비스듬하면 책등이 몇 px 띠로 눌려 세로 글자가 검은 점처럼 보여 숨긴다
 * (뒤표지로 덮은 쉬는 자세의 책등이 약 0.19). 임시, open-decisions G0 "앞표지·뒤표지·책등에 넣을 정보".
 */
const SPINE_LABEL_MIN_FACING = 0.3;

function warmFirstSpread() {
  for (const page of FIRST_SPREAD_PAGES) {
    const source = photoSourceOf(page);
    if (source !== null) {
      preload(source, { as: 'image' });
    }
  }
}

function bookTransform(placement: ClosedPlacement, pose: TransitionPose): string {
  const { offset, scale } = bookMotionFrame(placement, pose.travel);
  return [
    `translate3d(${offset.x}px, ${offset.y}px, ${offset.z}px)`,
    `scale3d(${scale}, ${scale}, ${scale})`,
    toCssMatrix3d(pose.orientation),
  ].join(' ');
}

function groundShadowStyle(placement: ClosedPlacement, travel: number): React.CSSProperties {
  const { frontBox, scale, depth, center } = placement;
  const closedDepth = depth * scale;
  const width = frontBox.width * GROUND_SHADOW_WIDTH_RATIO;
  const height = closedDepth * GROUND_SHADOW_HEIGHT_OF_DEPTH;
  return {
    left: center.x - width / 2,
    top: frontBox.y + frontBox.height - closedDepth * GROUND_SHADOW_LIFT_OF_DEPTH - height / 2,
    width,
    height,
    opacity: 1 - travel,
  };
}

const HIDDEN: React.CSSProperties = { visibility: 'hidden' };

/** 회전 행렬로 돌린 면 법선이 확실히 돌아섰으면 숨긴다(rotation.ts isTurnedAway). */
function faceStyle(orientation: Quat, normal: Vec3): React.CSSProperties | undefined {
  return isTurnedAway(facingOf(orientation, normal)) ? HIDDEN : undefined;
}

function spineLabelStyle(orientation: Quat): React.CSSProperties | undefined {
  return facingOf(orientation, faceNormal('spine')) < SPINE_LABEL_MIN_FACING ? HIDDEN : undefined;
}

const EDGE_FACES: readonly Exclude<BookFace, 'front' | 'back'>[] = ['spine', 'fore', 'top', 'bottom'];

/**
 * 닫힌 3D 책(CSS 3D, 시안 closed-a 기준). 앞·뒤표지는 fursona 명함 앞뒷면이다.
 * - 자세는 쿼터니언을 matrix3d로 건다. 여섯 면(앞표지·뒤표지·책등·책배·윗면·아랫면)을 모두 그린다.
 * - 3D 책은 펼친 뒤 쪽 크기로 그리고 scale로 줄인다. 펼침이 끝나면 변환 없는 DOM 쪽과 같은 크기에 착지한다.
 * - 닫힌 채면 화면 전체(좌우 가장자리 24px 제외)가 회전 영역이다. 어디를 끌어도 돌고, 놓으면 관성으로 돌다 선다.
 *   끌지 않고 뗀 탭이 책을 원근 투영한 다각형 안이면 펼친다(spin.ts가 판정). 빈 곳 탭은 아무 일도 하지 않는다.
 * - 면은 책 안쪽부터 DOM에 둔다: 덮이는 쪽(under)을 표지 판보다 먼저 그려, 3D 정렬 대신 DOM 순서로 칠하는 엔진
 *   (Playwright 헤드리스 Firefox·WebKit에서 관찰)과 판이 거의 닫혀 두 면이 1px 간격으로 붙는 순간(Chromium)에도 판이 위에 온다.
 * - 키보드·보조 기술은 투영 다각형을 감싼 버튼 하나로 받는다: Enter·Space는 펼침.
 * - 닫힌 상태면 포커스가 책에 없어도(body) Enter·Space로 펼치고, 화살표는 누르는 동안 돈다(use-held-arrows.ts, key-spin.ts).
 *   다른 컨트롤에 포커스가 있으면 Enter·Space는 그 컨트롤 몫이다. 2026-11-16 사용자 결정(책에 포커스 표시가 생기지 않게).
 *   포인터 클릭은 위 판별이 맡으므로 버튼의 포인터 click은 쓰지 않는다.
 * - 펼치거나 덮는 동안(transition)에는 버튼이 aria-disabled이고 포인터를 받지 않는다.
 *   전환 자세(opening.ts·closing.ts)의 표지 판·이동·넘겨주기 투명도를 그대로 그린다. 앞표지와 뒤표지가 각각 책등을 축으로 도는 판이다.
 */
function ClosedBook({
  viewport,
  geometry,
  orientation,
  transition,
  phase,
  motion,
  reducedMotion,
  buttonRef,
  onBookEvent,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  viewport: Viewport;
  geometry: OpenGeometry;
  /** 닫힌 채 쉬거나 도는 자세. 전환 중에는 쓰지 않는다. */
  orientation: Orientation;
  /** 펼치거나 덮는 중이면 그 순간의 자세와 기준 화면, 닫힌 채면 null. */
  transition: { readonly pose: TransitionPose; readonly view: BookView } | null;
  phase: 'closed' | 'opening' | 'closing';
  motion: ClosedMotion['type'];
  reducedMotion: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  onBookEvent: (event: BookEvent) => void;
}) {
  const descriptionId = React.useId();
  const gestureRef = React.useRef<SpinGesture>(IDLE_SPIN_GESTURE);
  const touchInsets = touchGuardInsets(useSafeAreaInsets());
  const interactive = phase === 'closed';
  useHeldArrows(interactive, direction => onBookEvent({ type: 'key-spin', direction, reducedMotion }));
  useDocumentKeyDown(event => {
    if (!interactive || event.defaultPrevented || event.isComposing || isActivationTarget(event.target)) {
      return;
    }
    if (closedBookKeyAction(event) === 'open') {
      event.preventDefault();
      onBookEvent({ type: 'open', reducedMotion });
    }
  });

  const pose: TransitionPose = transition?.pose ?? {
    orientation,
    side: 'front',
    coverOpen: 0,
    travel: 0,
    handoff: 0,
    crossfade: false,
  };
  const cover = coverLayout(geometry, pose.side, transition?.view ?? initialView(geometry.layout));
  const placement = computeClosedPlacement(viewport, geometry, cover.body);
  const { target, scale, depth } = placement;
  const perspective = closedPerspective(viewport);
  const outline = projectedBookOutline(viewport, placement, pose.orientation, pose.travel);
  const hitBox = outlineBounds(outline);
  const showPages = transition !== null && !pose.crossfade;

  const frontAngle = coverAngleDeg('front', pose.side === 'front' ? pose.coverOpen : 0);
  const backAngle = coverAngleDeg('back', pose.side === 'back' ? pose.coverOpen : 0);
  const frontBoard = multiplyQuat(pose.orientation, quatFromAxisAngle(Y_AXIS, frontAngle));
  const backBoard = multiplyQuat(pose.orientation, quatFromAxisAngle(Y_AXIS, backAngle));

  function stepGesture(event: React.PointerEvent<HTMLElement>, gestureEvent: SpinGestureEvent) {
    if (!interactive) {
      return;
    }
    const step = reduceSpinGesture(gestureRef.current, gestureEvent, {
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      touchInsets,
      bookOutline: outline,
    });
    gestureRef.current = step.gesture;
    const { effect } = step;
    if (effect.type === 'grab') {
      warmFirstSpread();
      // 붙잡으면 손을 뗀 곳이 러닝 헤드 위든 창 밖이든 pointerup을 받는다.
      if (event.target instanceof Element) {
        event.target.setPointerCapture?.(event.pointerId);
      }
      // 마우스로 끌 때 글자 선택과 포커스 이동이 일어나지 않게 한다(터치는 touch-action으로 막는다).
      if (event.pointerType === 'mouse') {
        event.preventDefault();
      }
      onBookEvent({ type: 'spin-grab' });
    } else if (effect.type === 'drag') {
      onBookEvent({ type: 'spin-drag', delta: effect.delta });
    } else if (effect.type === 'release') {
      onBookEvent({ type: 'spin-release', delta: effect.delta, velocity: effect.velocity, reducedMotion });
    } else if (effect.type === 'open') {
      onBookEvent({ type: 'open', reducedMotion });
    }
  }

  function pointerEvent(
    event: React.PointerEvent<HTMLElement>,
    type: 'down' | 'move' | 'up'
  ): Extract<SpinGestureEvent, { type: 'down' | 'move' | 'up' }> {
    const sample = { pointerId: event.pointerId, point: { x: event.clientX, y: event.clientY }, time: event.timeStamp };
    // 누를 때만 입력 종류를 넘긴다. 터치·펜은 화면 가장자리에서 회전을 시작하지 않는다(spin.ts isOnSpinSurface).
    return type === 'down' ? { type, pointerType: event.pointerType, ...sample } : { type, ...sample };
  }

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    // 포인터 탭은 위 판별(투영 다각형)이 이미 맡았다. 키보드·보조 기술 활성화(detail 0)만 여기서 펼친다.
    if (event.detail === 0) {
      onBookEvent({ type: 'open', reducedMotion });
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (closedBookKeyAction(event) === 'open') {
      event.preventDefault();
      onBookEvent({ type: 'open', reducedMotion });
    }
  }

  const bookStyle = {
    left: target.x,
    top: target.y,
    width: target.width,
    height: target.height,
    transform: bookTransform(placement, pose),
    '--book-w': `${target.width}px`,
    '--book-h': `${target.height}px`,
    '--book-d': `${depth}px`,
    '--closed-scale': scale,
    '--cover-angle': `${frontAngle}deg`,
    '--back-cover-angle': `${backAngle}deg`,
    '--edge-opacity': 1 - pose.travel,
    '--chrome-reveal': pose.travel,
  } as React.CSSProperties;

  const stageStyle: React.CSSProperties = {
    perspective: `${perspective.distance}px`,
    perspectiveOrigin: `${perspective.origin.x}px ${perspective.origin.y}px`,
    opacity: pose.handoff > 0 ? 1 - pose.handoff : undefined,
  };

  const insideSide = pose.side === 'front' ? 'left' : 'right';
  const underSide = pose.side === 'front' ? 'right' : 'left';

  return (
    <div
      className={joinClassNames('closed-stage', className)}
      data-phase={phase}
      data-motion={motion}
      style={stageStyle}
      onPointerDown={event => {
        if (event.button === 0) {
          stepGesture(event, pointerEvent(event, 'down'));
        }
      }}
      onPointerMove={event =>
        // 누른 버튼이 없는데 누른 상태라면 pointerup을 놓친 것이다. 그 자리에서 뗀 것으로 본다.
        stepGesture(
          event,
          pointerEvent(event, event.buttons === 0 && gestureRef.current.phase !== 'idle' ? 'up' : 'move')
        )
      }
      onPointerUp={event => stepGesture(event, pointerEvent(event, 'up'))}
      onPointerCancel={event => stepGesture(event, { type: 'cancel', pointerId: event.pointerId })}
      onLostPointerCapture={event => stepGesture(event, { type: 'cancel', pointerId: event.pointerId })}
      {...props}
    >
      <div className="closed-book__shadow" style={groundShadowStyle(placement, pose.travel)} aria-hidden="true" />
      <div className="closed-book" style={bookStyle} data-layout={geometry.layout} aria-hidden="true">
        {showPages ? (
          <div
            className="closed-book__face closed-book__under closed-book__page"
            data-cover={pose.side}
            data-page-side={underSide}
            style={faceStyle(pose.orientation, faceNormal(pose.side))}
          >
            <BookPage page={cover.under} layout={geometry.layout} />
            <div className="closed-book__page-chrome" />
          </div>
        ) : null}
        <div className="closed-book__cover">
          <div
            className="closed-book__face closed-book__cover-front"
            style={faceStyle(frontBoard, faceNormal('front'))}
          >
            <p>{PERSON_NAME}</p>
            <p>{COVER_TAGLINE}</p>
          </div>
          {showPages && pose.side === 'front' ? (
            <div
              className="closed-book__face closed-book__cover-inside closed-book__page"
              data-page-side={insideSide}
              style={faceStyle(frontBoard, faceNormal('back'))}
            >
              <BookPage page={cover.inside} layout={geometry.layout} />
              <div className="closed-book__page-chrome" />
            </div>
          ) : null}
        </div>
        <div className="closed-book__back-cover">
          <div className="closed-book__face closed-book__back" style={faceStyle(backBoard, faceNormal('back'))}>
            {COVER_BACK_LINES.map(line => (
              <p key={line}>{line}</p>
            ))}
          </div>
          {showPages && pose.side === 'back' ? (
            <div
              className="closed-book__face closed-book__back-inside closed-book__page"
              data-page-side={insideSide}
              style={faceStyle(backBoard, faceNormal('front'))}
            >
              <BookPage page={cover.inside} layout={geometry.layout} />
              <div className="closed-book__page-chrome" />
            </div>
          ) : null}
        </div>
        {EDGE_FACES.map(face => (
          <div
            key={face}
            className={`closed-book__face closed-book__${face}`}
            style={faceStyle(pose.orientation, faceNormal(face))}
          >
            {/* 책등에는 이름을 세로로 둔다. 임시, open-decisions G0 "앞표지·뒤표지·책등에 넣을 정보". */}
            {face === 'spine' ? (
              <span className="closed-book__spine-label" style={spineLabelStyle(pose.orientation)}>
                {PERSON_NAME}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {interactive ? (
        // 회전 영역: 닫힌 채일 때 화면 전체(결정 B.1). 마우스는 화면 끝까지 돌릴 수 있다.
        // 터치는 가장자리(좌우 Safari 뒤로·앞으로, 위아래 safe area)를 브라우저·시스템 제스처에 남긴다(spin.ts touchGuardInsets,
        // HIG 반영). 그래서 touch-action: none은 안쪽 영역(과 책 버튼)에만 걸고, 가장자리는 기본값으로 둔다.
        // 러닝 헤드 글자 위에서도 끌 수 있게 러닝 헤드는 닫힌 동안 포인터를 통과시킨다(running-head.tsx).
        <div
          className="closed-surface pointer-events-auto absolute inset-0 cursor-grab active:cursor-grabbing"
          aria-hidden="true"
        >
          <div
            className="closed-surface__touch absolute touch-none"
            style={{
              top: touchInsets.top,
              right: touchInsets.right,
              bottom: touchInsets.bottom,
              left: touchInsets.left,
            }}
          />
        </div>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className="closed-book__hit"
        aria-label={UI_TEXT.openBook}
        aria-describedby={descriptionId}
        aria-disabled={interactive ? undefined : true}
        style={{ left: hitBox.x, top: hitBox.y, width: hitBox.width, height: hitBox.height }}
        onPointerEnter={warmFirstSpread}
        onFocus={warmFirstSpread}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      />
      <p id={descriptionId} hidden>
        {coverDescription()}
      </p>
    </div>
  );
}

export { ClosedBook };
