import * as React from 'react';

import { PAGE_COUNT } from '@/content/pages';
import { closedAnnouncement, folioReading, landingAnnouncement } from '@/content/temporary';
import { BookSpread } from '@/features/book-spread/book-spread';
import { ClosedBook } from '@/features/closed-book/closed-book';
import { RunningHead } from '@/features/running-head/running-head';
import { useDocumentKeyDown } from '@/hooks/use-document-key-down';
import { useFrameLoop } from '@/hooks/use-frame-loop';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';
import { useViewportSize } from '@/hooks/use-viewport-size';
import { hasFocusedElement } from '@/lib/keyboard-focus';
import type { Announcement, BookEvent, BookScene } from '@/model/book/book-state';
import {
  canClose,
  createInitialBookState,
  folioPages,
  initialView,
  needsFrames,
  needsResync,
  reduceBook,
} from '@/model/book/book-state';
import { closingPoseAt, coverDragProgress, coverPose, coverReturnProgress } from '@/model/book/closing';
import { formatFolio } from '@/model/book/folio';
import { computeOpenGeometry } from '@/model/book/geometry';
import { documentKeyAction } from '@/model/book/keyboard';
import { decideLayout, runningHeadParts } from '@/model/book/layout';
import type { TransitionPose } from '@/model/book/opening';
import { openingPoseAt } from '@/model/book/opening';
import { INITIAL_ORIENTATION } from '@/model/book/rotation';
import type { BookView, PageLayout } from '@/model/fold';

type SpreadScene = Extract<BookScene, { phase: 'open' | 'turning' | 'closing' }>;

type Transition = { readonly pose: TransitionPose; readonly view: BookView };

/** 펼치거나 덮는 중인 3D 책의 자세. 손으로 덮는 중·되돌아가는 중에는 표지 판이 덮인 정도를 따른다(closing.ts coverPose). */
function transitionFor(scene: BookScene, layout: PageLayout, reducedMotion: boolean): Transition | null {
  if (scene.phase === 'opening') {
    return { pose: openingPoseAt(scene.timeline, scene.elapsedMs), view: initialView(layout) };
  }
  if (scene.phase !== 'closing') {
    return null;
  }
  const { stage } = scene;
  if (stage.type === 'transition') {
    return { pose: closingPoseAt(stage.timeline, stage.elapsedMs), view: scene.view };
  }
  const progress = stage.type === 'drag' ? coverDragProgress(stage.drag) : coverReturnProgress(stage.cover);
  return { pose: coverPose(scene.side, progress, reducedMotion), view: scene.view };
}

type HeadFolio = { readonly folio: string; readonly reading: string } | null;

/**
 * 펼친 책이면 쪽 번호(착지 때 갱신). 닫힌 책·여닫는 중에는 없다: 잡지 표지에는 쪽 번호가 없고, 펼치는 순간 쪽 번호가
 * 나타나 책 안에 들어왔다는 신호가 된다(2026-11-16 사용자 결정, plan.md 러닝 헤드).
 */
function headFolio(scene: BookScene): HeadFolio {
  const pages = folioPages(scene);
  return pages === null ? null : { folio: formatFolio(pages, PAGE_COUNT), reading: folioReading(pages, PAGE_COUNT) };
}

/** 넘겨주는 동안 펼친 책 DOM의 모습. 동작 줄이기 교차면 전체 투명도, 아니면 책 테두리·그림자·화살표만 들이고 낸다. */
function handoffStyle(pose: TransitionPose): React.CSSProperties {
  return pose.crossfade ? { opacity: pose.handoff } : ({ '--chrome-reveal': pose.handoff } as React.CSSProperties);
}

/**
 * 펼친 책 DOM에 넘길 장면과 모습. 펼침 끝·덮기 시작의 넘겨주기 동안에는 3D 책 아래에 그린다(opening.ts·closing.ts).
 * 손으로 덮는 중·되돌아가는 중에는 포인터를 붙잡고 다음 입력을 받도록 남겨 두되, 보이는 것은 3D 책이 맡는다.
 */
function spreadFor(
  scene: BookScene,
  transition: Transition | null,
  layout: PageLayout
): { scene: SpreadScene; style: React.CSSProperties | undefined } | null {
  if (scene.phase === 'open' || scene.phase === 'turning') {
    return { scene, style: undefined };
  }
  if (transition === null || scene.phase === 'closed') {
    return null;
  }
  const { pose } = transition;
  if (scene.phase === 'closing' && scene.stage.type !== 'transition') {
    return { scene, style: pose.crossfade ? { opacity: pose.handoff } : { opacity: 0 } };
  }
  if (pose.handoff <= 0) {
    return null;
  }
  const spreadScene: SpreadScene = scene.phase === 'opening' ? { phase: 'open', view: initialView(layout) } : scene;
  return { scene: spreadScene, style: handoffStyle(pose) };
}

function announcementText(announcement: Announcement): string {
  return announcement.kind === 'pages'
    ? landingAnnouncement(announcement.pages)
    : closedAnnouncement(announcement.side);
}

/**
 * 1페이즈 앱: 닫힌 3D 책 → 클릭으로 펼침 → 사진 잡지 넘김 → 다시 덮기. 상태는 순수 모델(src/model/book)이 갖고,
 * 이 컴포넌트는 화면 크기·동작 줄이기 설정·프레임 시각·문서 키(Esc)를 모델에 넣고 결과를 그린다.
 * 덮고 나면 포커스를 닫힌 책 버튼으로 옮기고 상태 영역에 한 번 알린다(tech-research.md 7장 책 닫기 행).
 */
export function App() {
  const viewport = useViewportSize();
  const layout = decideLayout(viewport);
  const reducedMotion = usePrefersReducedMotion();
  const [state, dispatch] = React.useReducer(reduceBook, PAGE_COUNT, createInitialBookState);
  const geometry = computeOpenGeometry(viewport, layout);
  const closedButtonRef = React.useRef<HTMLButtonElement | null>(null);

  // 화면 크기가 바뀌어 배치·쪽 크기가 달라지면 렌더 중에 상태에 확정한다(React의 "이전 렌더 값으로 상태 맞추기" 패턴).
  // 렌더에서만 맞추면 상태에는 넘기던 장이 남아, 원래 크기로 돌아올 때 되살아난다.
  if (needsResync(state.scene, geometry)) {
    dispatch({ type: 'resize', geometry });
  }
  const { scene, announcement } = state;

  useFrameLoop(needsFrames(scene), time => dispatch({ type: 'frame', time, geometry, reducedMotion }));

  // 사용자 입력으로 생긴 사건은 그때 앱 안 요소에 포커스가 있었는지 함께 적어 둔다(펼친 뒤·덮은 뒤 포커스 이동).
  // 동작 줄이기 펼침이나 손으로 덮기를 놓을 때는 사라질 요소가 같은 렌더에서 빠져, 효과가 돌 때는 이미 포커스가 body라서다.
  // 포커스가 body였으면(문서 단위 키·포인터로 쓰는 중) 옮기지 않아 책에 포커스 표시가 생기지 않는다(2026-11-16 사용자 결정).
  const [focusInApp, setFocusInApp] = React.useState(false);
  function send(event: BookEvent) {
    setFocusInApp(hasFocusedElement());
    dispatch(event);
  }

  const closeToFront: BookEvent = { type: 'close', side: 'front', geometry, reducedMotion };
  useDocumentKeyDown(event => {
    if (documentKeyAction(event) === 'close' && !event.defaultPrevented && canClose(state.scene)) {
      event.preventDefault();
      send(closeToFront);
    }
  });

  // 덮기 전환이 시작되면 사라질 펼친 책(과 덮은 뒤 글자로 바뀌는 러닝 헤드 이름) 대신 닫힌 책 버튼에 포커스를 둔다.
  // 버튼은 전환 중 aria-disabled로 이미 그려져 있다. 덮은 알림이 새로 쓰일 때(착지) 한 번 더 확인한다
  // (tech-research.md 7장 공통 규칙 "포커스된 노드가 사라지기 전에 옮긴다", 책 닫기 행).
  // 덮기를 일으킨 입력 때 포커스가 body였으면 옮기지 않는다(사라질 노드가 없다).
  const closingStarted = scene.phase === 'closing' && scene.stage.type === 'transition';
  const closedSerial = announcement?.kind === 'closed' ? announcement.serial : null;
  const closedBookFocusKey = closingStarted ? 'closing' : closedSerial;
  const focusClosedBook = React.useEffectEvent(() => {
    if (focusInApp) {
      closedButtonRef.current?.focus({ preventScroll: true });
    }
  });
  React.useEffect(() => {
    if (closedBookFocusKey !== null) {
      focusClosedBook();
    }
  }, [closedBookFocusKey]);

  const transition = transitionFor(scene, layout, reducedMotion);
  const pageFolio = headFolio(scene);
  const spread = spreadFor(scene, transition, layout);

  return (
    <>
      <RunningHead
        parts={runningHeadParts(viewport, layout)}
        folio={pageFolio?.folio ?? null}
        folioReading={pageFolio?.reading ?? null}
        nameAction={scene.phase === 'closed' ? null : { disabled: !canClose(scene), onPress: () => send(closeToFront) }}
      />
      <main aria-label="Photobook" className="min-h-svh">
        {spread === null ? null : (
          <BookSpread
            scene={spread.scene}
            geometry={geometry}
            pageCount={PAGE_COUNT}
            reducedMotion={reducedMotion}
            takeFocus={focusInApp}
            onBookEvent={send}
            style={spread.style}
          />
        )}
        {scene.phase === 'closed' || transition !== null ? (
          <ClosedBook
            viewport={viewport}
            geometry={geometry}
            orientation={scene.phase === 'closed' ? scene.orientation : INITIAL_ORIENTATION}
            transition={transition}
            phase={scene.phase === 'closed' ? 'closed' : scene.phase === 'opening' ? 'opening' : 'closing'}
            motion={scene.phase === 'closed' ? scene.motion.type : 'rest'}
            reducedMotion={reducedMotion}
            buttonRef={closedButtonRef}
            onBookEvent={send}
          />
        ) : null}
      </main>
      {/* 착지·덮기 때 한 번 알린다. 되돌아가면 바뀌지 않는다. 같은 문구로 다시 알려도 새 노드로 다시 읽힌다. */}
      <p role="status" className="sr-only">
        {announcement === null ? null : <span key={announcement.serial}>{announcementText(announcement)}</span>}
      </p>
    </>
  );
}
