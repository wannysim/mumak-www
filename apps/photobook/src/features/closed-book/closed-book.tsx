import * as React from 'react';
import { preload } from 'react-dom';

import { COVER_ART } from '@/content/covers';
import { photoSourceOf } from '@/content/pages';
import { coverDescription, PERSON_NAME, UI_TEXT } from '@/content/temporary';
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
import type { ContactShadow, SceneLight } from '@/model/book/light';
import { castShadowOutline, contactShadow, faceShade } from '@/model/book/light';
import type { TransitionPose } from '@/model/book/opening';
import { bookMotionFrame, closedPerspective, outlineBounds, projectedBookOutline } from '@/model/book/projection';
import type { Quat, Vec3 } from '@/model/book/quaternion';
import { multiplyQuat, quatFromAxisAngle, toCssMatrix3d, Y_AXIS } from '@/model/book/quaternion';
import type { BookFace, CoverSide, Orientation } from '@/model/book/rotation';
import { coverAngleDeg, faceNormal, facingOf, isTurnedAway } from '@/model/book/rotation';
import type { SpinGesture, SpinGestureEvent } from '@/model/book/spin';
import { IDLE_SPIN_GESTURE, reduceSpinGesture, touchGuardInsets } from '@/model/book/spin';
import type { BookView, Vec2 } from '@/model/fold';

import './closed-book.css';

/** 펼치면 처음 드러나는 쪽(앞표지 안쪽 1쪽과 그 아래 2쪽). 손이 닿을 때 미리 받는다. */
const FIRST_SPREAD_PAGES: readonly number[] = [1, 2];

/**
 * 바닥 그림자(light.ts castShadowOutline)의 진하기와 번짐. 진한 층과 넓게 번진 층 두 겹으로 부드러운 가장자리를 흉내 낸다.
 * 진하기는 직접광 세기(밤·해 질 녘이면 옅다)를 곱하고, 번짐은 닫힌 책 높이에 비례한다.
 * 임시, open-decisions G0 "닫힌 책 형태·재질·조명, 그림자".
 */
const CAST_SHADOW_CORE_OPACITY = 0.3;
const CAST_SHADOW_SOFT_OPACITY = 0.2;
const CAST_SHADOW_CORE_BLUR_OF_HEIGHT = 0.012;
const CAST_SHADOW_SOFT_BLUR_OF_HEIGHT = 0.05;

/** 접지 그림자(light.ts contactShadow): 해와 무관하게 책이 바닥에 닿은 자리에 깔린다. 진하기는 닿은 정도를 곱한다. 임시, 위와 같은 행. */
const CONTACT_SHADOW_OPACITY = 0.28;
const CONTACT_SHADOW_BLUR_OF_HEIGHT = 0.02;

/** 앞·뒤 판 두께 띠(책배·윗면·아랫면 양 끝의 표지 색) = 쪽 폭의 비율. 임시, open-decisions G0 "닫힌 책 형태·재질". */
const BOARD_RATIO = 0.012;

/** 면 음영 막 투명도의 소수 자리. 매 프레임 새로 계산하므로 문자열 길이를 줄인다. */
const SHADE_DIGITS = 3;

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

function polygonPoints(outline: readonly Vec2[]): string {
  return outline.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

/**
 * 바닥에 떨어진 책 그림자. 해 그림자는 빛(light)과 책 자세를 따라 모양·길이·방향이 바뀌고(2026-11-18 사용자 요청),
 * 접지 그림자는 책이 바닥에 닿은 자리에만 깔린다. 펼치거나 덮는 동안에는 옮겨 간 정도만큼 옅어진다.
 */
function CastShadow({
  sunOutline,
  contact,
  light,
  placement,
  travel,
}: {
  sunOutline: readonly Vec2[];
  contact: ContactShadow;
  light: SceneLight;
  placement: ClosedPlacement;
  travel: number;
}) {
  // useId 값의 기호(«», :)가 url(#…) 참조를 깨지 않게 영숫자만 남긴다.
  const filterId = `cast-shadow-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const height = placement.frontBox.height;
  const sunPoints = polygonPoints(sunOutline);
  const sunFade = light.strength * (1 - travel);
  const filters = [
    { id: `${filterId}-core`, blur: height * CAST_SHADOW_CORE_BLUR_OF_HEIGHT },
    { id: `${filterId}-soft`, blur: height * CAST_SHADOW_SOFT_BLUR_OF_HEIGHT },
    { id: `${filterId}-contact`, blur: height * CONTACT_SHADOW_BLUR_OF_HEIGHT },
  ];
  return (
    <svg className="closed-book__cast-shadow" aria-hidden="true">
      <defs>
        {/* 번짐이 다각형 상자 밖으로 퍼져도 잘리지 않게 필터 영역을 넉넉히 잡는다. */}
        {filters.map(filter => (
          <filter key={filter.id} id={filter.id} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={filter.blur} />
          </filter>
        ))}
      </defs>
      <polygon
        className="closed-book__sun-shadow"
        points={sunPoints}
        filter={`url(#${filterId}-soft)`}
        opacity={CAST_SHADOW_SOFT_OPACITY * sunFade}
      />
      <polygon
        className="closed-book__sun-shadow"
        points={sunPoints}
        filter={`url(#${filterId}-core)`}
        opacity={CAST_SHADOW_CORE_OPACITY * sunFade}
      />
      <polygon
        className="closed-book__contact-shadow"
        points={polygonPoints(contact.outline)}
        filter={`url(#${filterId}-contact)`}
        opacity={CONTACT_SHADOW_OPACITY * contact.strength * (1 - travel)}
      />
    </svg>
  );
}

/** 면 위 검은 막. 빛을 등진 만큼 어둡다(light.ts faceShade). */
function FaceShade({ shade }: { shade: number }) {
  return <div className="closed-book__shade" style={{ opacity: Number(shade.toFixed(SHADE_DIGITS)) }} />;
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
 * 표지 그림. 내용은 버튼 설명(coverDescription)이 읽으므로 장식으로 둔다.
 * 앞표지는 첫 화면에 바로 보이는 그림이라 먼저 받는다.
 */
function CoverArt({ side }: { side: CoverSide }) {
  return (
    <img
      className="closed-book__cover-art"
      src={COVER_ART[side].src}
      alt=""
      decoding="async"
      fetchPriority={side === 'front' ? 'high' : 'auto'}
      draggable={false}
    />
  );
}

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
  light,
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
  /** 화면 밖 해의 빛(use-scene-light.ts). 면 음영과 바닥 그림자를 정한다. */
  light: SceneLight;
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
  const sunShadowOutline = castShadowOutline(viewport, placement, pose.orientation, light, pose.travel);
  const contact = contactShadow(viewport, placement, pose.orientation, pose.travel);
  // 펼친 쪽 자리로 옮겨 갈수록 음영을 빼서, 넘겨줄 때 음영 없는 DOM 쪽과 밝기가 어긋나지 않게 한다.
  const shadeOf = (board: Quat, face: BookFace) => faceShade(board, faceNormal(face), light) * (1 - pose.travel);

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
    '--board': `${target.width * BOARD_RATIO}px`,
    '--cover-front-color': COVER_ART.front.background,
    '--cover-back-color': COVER_ART.back.background,
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
      <CastShadow
        sunOutline={sunShadowOutline}
        contact={contact}
        light={light}
        placement={placement}
        travel={pose.travel}
      />
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
            style={{ backgroundColor: COVER_ART.front.background, ...faceStyle(frontBoard, faceNormal('front')) }}
          >
            <CoverArt side="front" />
            <FaceShade shade={shadeOf(frontBoard, 'front')} />
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
          <div
            className="closed-book__face closed-book__back"
            style={{ backgroundColor: COVER_ART.back.background, ...faceStyle(backBoard, faceNormal('back')) }}
          >
            <CoverArt side="back" />
            <FaceShade shade={shadeOf(backBoard, 'back')} />
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
            <FaceShade shade={shadeOf(pose.orientation, face)} />
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
