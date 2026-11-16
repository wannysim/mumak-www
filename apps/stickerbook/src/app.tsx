import * as React from 'react';

import { PAGE_COUNT } from '@/content/pages';
import { FACE_LABELS, folioReading, landingAnnouncement } from '@/content/temporary';
import { BookSpread } from '@/features/book-spread/book-spread';
import { ClosedBook } from '@/features/closed-book/closed-book';
import { RunningHead } from '@/features/running-head/running-head';
import { useFrameLoop } from '@/hooks/use-frame-loop';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';
import { useViewportSize } from '@/hooks/use-viewport-size';
import type { BookScene } from '@/model/book/book-state';
import {
  createInitialBookState,
  folioPages,
  initialView,
  needsFrames,
  needsResync,
  reduceBook,
} from '@/model/book/book-state';
import { formatFolio } from '@/model/book/folio';
import { computeOpenGeometry } from '@/model/book/geometry';
import { decideLayout, runningHeadParts } from '@/model/book/layout';
import type { OpeningPose } from '@/model/book/opening';
import { openingPoseAt } from '@/model/book/opening';
import { INITIAL_ROTATION, visibleFace } from '@/model/book/rotation';
import type { PageLayout } from '@/model/fold';

type OpenScene = Extract<BookScene, { phase: 'open' | 'turning' }>;

/** 닫힌 책·펼치는 중이면 지금 보이는 면 이름(펼치며 앞면으로 도는 동안에는 실제 각도), 펼친 책이면 쪽 번호(착지 때 갱신). */
function folioFor(scene: BookScene, opening: OpeningPose | null): { folio: string; reading: string | null } {
  const pages = folioPages(scene);
  if (pages !== null) {
    return { folio: formatFolio(pages, PAGE_COUNT), reading: folioReading(pages, PAGE_COUNT) };
  }
  const rotation = opening?.rotation ?? (scene.phase === 'closed' ? scene.rotation : INITIAL_ROTATION);
  return { folio: FACE_LABELS[visibleFace(rotation)], reading: null };
}

/** 펼친 책 DOM에 넘길 장면. 펼침 끝(handoff)에는 3D 책 아래에 첫 화면을 미리 그린다(opening.ts). */
function spreadSceneFor(scene: BookScene, opening: OpeningPose | null, layout: PageLayout): OpenScene | null {
  if (scene.phase === 'open' || scene.phase === 'turning') {
    return scene;
  }
  return opening !== null && opening.handoff > 0 ? { phase: 'open', view: initialView(layout) } : null;
}

/**
 * 넘겨주는 동안 펼친 책 DOM의 모습. 동작 줄이기 교차면 전체 투명도, 아니면 책 바깥 테두리·그림자·화살표만 들인다
 * (쪽은 3D 책이 같은 자리에서 덮고 있다가 사라진다).
 */
function spreadStyleFor(opening: OpeningPose | null): React.CSSProperties | undefined {
  if (opening === null) {
    return undefined;
  }
  return opening.crossfade
    ? { opacity: opening.handoff }
    : ({ '--chrome-reveal': opening.handoff } as React.CSSProperties);
}

/**
 * 1페이즈 앱: 닫힌 3D 책 → 클릭으로 펼침 → 사진 잡지 넘김. 상태는 순수 모델(src/model/book)이 갖고,
 * 이 컴포넌트는 화면 크기·동작 줄이기 설정·프레임 시각을 모델에 넣고 결과를 그린다.
 */
export function App() {
  const viewport = useViewportSize();
  const layout = decideLayout(viewport);
  const reducedMotion = usePrefersReducedMotion();
  const [state, dispatch] = React.useReducer(reduceBook, PAGE_COUNT, createInitialBookState);
  const geometry = computeOpenGeometry(viewport, layout);

  // 화면 크기가 바뀌어 배치·쪽 크기가 달라지면 렌더 중에 상태에 확정한다(React의 "이전 렌더 값으로 상태 맞추기" 패턴).
  // 렌더에서만 맞추면 상태에는 넘기던 장이 남아, 원래 크기로 돌아올 때 되살아난다.
  if (needsResync(state.scene, geometry)) {
    dispatch({ type: 'resize', geometry });
  }
  const { scene } = state;

  useFrameLoop(needsFrames(scene), time => dispatch({ type: 'frame', time, geometry, reducedMotion }));

  const opening = scene.phase === 'opening' ? openingPoseAt(scene.timeline, scene.elapsedMs) : null;
  const { folio, reading } = folioFor(scene, opening);

  const spreadScene = spreadSceneFor(scene, opening, layout);

  return (
    <>
      <RunningHead parts={runningHeadParts(viewport, layout)} folio={folio} folioReading={reading} />
      <main aria-label="Stickerbook" className="min-h-svh">
        {spreadScene === null ? null : (
          <BookSpread
            scene={spreadScene}
            geometry={geometry}
            pageCount={PAGE_COUNT}
            reducedMotion={reducedMotion}
            onBookEvent={dispatch}
            style={spreadStyleFor(opening)}
          />
        )}
        {scene.phase === 'closed' || scene.phase === 'opening' ? (
          <ClosedBook
            viewport={viewport}
            geometry={geometry}
            rotation={scene.phase === 'closed' ? scene.rotation : scene.timeline.from}
            rotationAnimated={scene.phase === 'closed' && scene.rotationAnimated}
            opening={opening}
            reducedMotion={reducedMotion}
            onRotate={rotation => dispatch({ type: 'rotate', rotation })}
            onRotateStep={step => dispatch({ type: 'rotate-step', step })}
            onOpen={() => dispatch({ type: 'open', reducedMotion })}
          />
        ) : null}
      </main>
      {/* 착지 때 한 번 알린다. 되돌아가면 바뀌지 않는다. 같은 문구로 다시 착지해도 새 노드로 다시 읽힌다. */}
      <p role="status" className="sr-only">
        {state.landing === null ? null : (
          <span key={state.landing.serial}>{landingAnnouncement(state.landing.pages)}</span>
        )}
      </p>
    </>
  );
}
