import * as React from 'react';
import { preload } from 'react-dom';

import { photoSourceOf } from '@/content/pages';
import { COVER_BACK_LINES, COVER_TAGLINE, coverDescription, PERSON_NAME, UI_TEXT } from '@/content/temporary';
import { BookPage } from '@/features/book-spread/book-page';
import { joinClassNames } from '@/lib/class-names';
import type { ClosedPlacement, OpenGeometry } from '@/model/book/geometry';
import { closedHitBox, computeClosedPlacement } from '@/model/book/geometry';
import { closedBookKeyAction } from '@/model/book/keyboard';
import type { Viewport } from '@/model/book/layout';
import type { OpeningPose } from '@/model/book/opening';
import type { Rotation, RotateGesture, RotateGestureEvent } from '@/model/book/rotation';
import { IDLE_ROTATE_GESTURE, isFaceTurnedAway, reduceRotateGesture } from '@/model/book/rotation';

import './closed-book.css';

/** 앞표지 안쪽이 1쪽, 그 아래 첫 쪽이 2쪽이다(src/model/fold/pages.ts: 1쪽은 넘길 장에 속하지 않는다). */
const INSIDE_COVER_PAGE = 1;
const PAGE_UNDER_COVER = 2;

/**
 * 닫힌 책 아래 접지 그림자: 폭 = 닫힌 책 폭 × 1.3, 높이 = 두께 × 2.6, 중심은 책 아래 가장자리에서 두께 × 0.2 위.
 * 임시, open-decisions G0 "닫힌 책 형태·재질·조명, 그림자"(시안 closed-a).
 */
const GROUND_SHADOW_WIDTH_RATIO = 1.3;
const GROUND_SHADOW_HEIGHT_OF_DEPTH = 2.6;
const GROUND_SHADOW_LIFT_OF_DEPTH = 0.2;

function warmFirstSpread() {
  for (const page of [INSIDE_COVER_PAGE, PAGE_UNDER_COVER]) {
    const source = photoSourceOf(page);
    if (source !== null) {
      preload(source, { as: 'image' });
    }
  }
}

function bookTransform(placement: ClosedPlacement, rotation: Rotation, travel: number): string {
  const { target, center, scale, depth } = placement;
  const offsetX = (center.x - (target.x + target.width / 2)) * (1 - travel);
  const offsetY = (center.y - (target.y + target.height / 2)) * (1 - travel);
  const size = scale + (1 - scale) * travel;
  // 펼침이 끝나면 앞표지 면이 z = 0에 오도록 두께 절반만큼 뒤로 민다. 원근 때문에 크기가 달라 보이지 않게 하려는 것이다.
  const depthOffset = (-depth / 2) * travel;
  return [
    `translate3d(${offsetX}px, ${offsetY}px, ${depthOffset}px)`,
    `scale3d(${size}, ${size}, ${size})`,
    `rotateX(${rotation.pitch}deg)`,
    `rotateY(${rotation.yaw}deg)`,
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

/** 확실히 돌아선 큰 면은 숨긴다(rotation.ts isFaceTurnedAway). 키 회전 전환 중에는 화면 각도와 상태 각도가 달라 쓰지 않는다. */
function faceStyle(faceYaw: number, useHint: boolean): React.CSSProperties | undefined {
  return useHint && isFaceTurnedAway(faceYaw) ? { visibility: 'hidden' } : undefined;
}

/**
 * 닫힌 3D 책(CSS 3D, 시안 closed-a 기준). 앞·뒤표지는 fursona 명함 앞뒷면이다.
 * - 3D 책은 펼친 뒤 쪽 크기로 그리고 scale로 줄인다. 펼침이 끝나면 변환 없는 DOM 쪽과 같은 크기에 착지한다.
 * - 판정은 보이는 책 폭을 덮는 버튼 하나다(geometry.ts closedHitBox). 드래그는 회전, 클릭·Enter·Space는 펼침, ←/→는 90° 회전이다.
 * - 펼치는 동안 버튼은 aria-disabled이고 포인터를 받지 않는다. 펼친 뒤 포커스는 책 영역으로 옮겨진다.
 * - 펼침 끝(handoff)에는 아래에 펼친 책 DOM이 그려지고 이 3D 무대는 투명도를 1 - handoff로 줄인다(opening.ts).
 */
function ClosedBook({
  viewport,
  geometry,
  rotation,
  rotationAnimated,
  opening,
  reducedMotion,
  onRotate,
  onRotateStep,
  onOpen,
  className,
  ...props
}: React.ComponentProps<'div'> & {
  viewport: Viewport;
  geometry: OpenGeometry;
  rotation: Rotation;
  rotationAnimated: boolean;
  /** 펼치는 중이면 그 순간의 자세, 닫힌 채면 null. */
  opening: OpeningPose | null;
  reducedMotion: boolean;
  onRotate: (rotation: Rotation) => void;
  onRotateStep: (step: 1 | -1) => void;
  onOpen: () => void;
}) {
  const descriptionId = React.useId();
  const gestureRef = React.useRef<RotateGesture>(IDLE_ROTATE_GESTURE);
  const suppressClickRef = React.useRef(false);

  const placement = computeClosedPlacement(viewport, geometry);
  const { target, scale, depth } = placement;
  const travel = opening === null ? 0 : opening.travel;
  const pose = opening === null ? rotation : opening.rotation;
  const coverAngle = opening === null ? 0 : opening.coverAngle;
  const isOpening = opening !== null;
  const isAnimatingRotation = rotationAnimated && !reducedMotion && !isOpening;
  const useFaceHint = !isAnimatingRotation;
  const hitBox = closedHitBox(placement, pose);

  function stepGesture(event: React.PointerEvent<HTMLButtonElement>, gestureEvent: RotateGestureEvent) {
    if (isOpening) {
      return;
    }
    const step = reduceRotateGesture(gestureRef.current, gestureEvent, rotation);
    gestureRef.current = step.gesture;
    if (step.suppressClick !== null) {
      suppressClickRef.current = step.suppressClick;
    }
    if (step.rotation !== null) {
      onRotate(step.rotation);
    }
    if (gestureEvent.type === 'down' && step.gesture.phase === 'pressed') {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
  }

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (event.detail > 0 && suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const action = closedBookKeyAction(event);
    if (action === null) {
      return;
    }
    event.preventDefault();
    if (action === 'open') {
      onOpen();
    } else {
      onRotateStep(action === 'rotate-right' ? 1 : -1);
    }
  }

  const bookStyle = {
    left: target.x,
    top: target.y,
    width: target.width,
    height: target.height,
    transform: bookTransform(placement, pose, travel),
    '--book-w': `${target.width}px`,
    '--book-h': `${target.height}px`,
    '--book-d': `${depth}px`,
    '--closed-scale': scale,
    '--cover-angle': `${coverAngle}deg`,
    '--edge-opacity': 1 - travel,
    '--chrome-reveal': travel,
  } as React.CSSProperties;

  const stageStyle: React.CSSProperties | undefined =
    opening !== null && opening.handoff > 0 ? { opacity: 1 - opening.handoff } : undefined;

  return (
    <div
      className={joinClassNames('closed-stage', className)}
      data-phase={isOpening ? 'opening' : 'closed'}
      style={stageStyle}
      {...props}
    >
      <div className="closed-book__shadow" style={groundShadowStyle(placement, travel)} aria-hidden="true" />
      <div
        className="closed-book"
        style={bookStyle}
        data-layout={geometry.layout}
        data-animated={isAnimatingRotation}
        aria-hidden="true"
      >
        <div className="closed-book__cover">
          <div
            className="closed-book__face closed-book__cover-front"
            style={faceStyle(pose.yaw + coverAngle, useFaceHint)}
          >
            <p>{PERSON_NAME}</p>
            <p>{COVER_TAGLINE}</p>
          </div>
          {isOpening ? (
            <div
              className="closed-book__face closed-book__cover-inside"
              style={faceStyle(pose.yaw + coverAngle + 180, useFaceHint)}
            >
              <BookPage page={INSIDE_COVER_PAGE} layout={geometry.layout} />
              <div className="closed-book__page-chrome" />
            </div>
          ) : null}
        </div>
        {isOpening ? (
          <div className="closed-book__face closed-book__first-page" style={faceStyle(pose.yaw, useFaceHint)}>
            <BookPage page={PAGE_UNDER_COVER} layout={geometry.layout} />
            <div className="closed-book__page-chrome" />
          </div>
        ) : null}
        <div className="closed-book__face closed-book__back" style={faceStyle(pose.yaw + 180, useFaceHint)}>
          {COVER_BACK_LINES.map(line => (
            <p key={line}>{line}</p>
          ))}
        </div>
        {/* 책등에는 이름을 세로로 둔다. 임시, open-decisions G0 "앞표지·뒤표지·책등에 넣을 정보". */}
        <div className="closed-book__face closed-book__spine">
          <span className="closed-book__spine-label">{PERSON_NAME}</span>
        </div>
        <div className="closed-book__face closed-book__fore" />
        <div className="closed-book__face closed-book__top" />
        <div className="closed-book__face closed-book__bottom" />
      </div>
      <button
        type="button"
        className="closed-book__hit"
        aria-label={UI_TEXT.openBook}
        aria-describedby={descriptionId}
        aria-disabled={isOpening ? true : undefined}
        style={{ left: hitBox.x, top: hitBox.y, width: hitBox.width, height: hitBox.height }}
        onPointerEnter={warmFirstSpread}
        onFocus={warmFirstSpread}
        onPointerDown={event => {
          if (event.button !== 0) {
            return;
          }
          warmFirstSpread();
          stepGesture(event, {
            type: 'down',
            pointerId: event.pointerId,
            point: { x: event.clientX, y: event.clientY },
          });
        }}
        onPointerMove={event =>
          stepGesture(event, {
            // 누른 버튼이 없는데 누른 상태라면 pointerup을 놓친 것이다. 그 자리에서 뗀 것으로 본다.
            type: event.buttons === 0 && gestureRef.current.phase !== 'idle' ? 'up' : 'move',
            pointerId: event.pointerId,
            point: { x: event.clientX, y: event.clientY },
          })
        }
        onPointerUp={event =>
          stepGesture(event, { type: 'up', pointerId: event.pointerId, point: { x: event.clientX, y: event.clientY } })
        }
        onPointerCancel={event => stepGesture(event, { type: 'cancel', pointerId: event.pointerId })}
        onLostPointerCapture={event => stepGesture(event, { type: 'cancel', pointerId: event.pointerId })}
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
