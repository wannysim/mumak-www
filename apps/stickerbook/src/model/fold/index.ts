/**
 * S2 fold 모델 공개 API. 플랫폼 API(window·document·performance)와 Math.random을 쓰지 않는 순수 함수다.
 * 시간은 인자로 받고, 단위는 CSS px·ms·px/ms다. 좌표계는 book-frame.ts 주석을 따른다.
 *
 * 흐름(드래그와 클릭이 같은 모델):
 * 1. 화면 좌표를 toModelPoint로 모델 좌표로 바꾼다.
 * 2. 누를 때 reduceGesture로 입력 주인(링크·스티커·레코드 > 넘김)과 클릭·드래그를 가린다.
 * 3. 넘김이면 클릭이든 드래그든 누른 점(클릭은 click의 point, 드래그는 drag-start의 origin)을
 *    projectToOuterEdge로 바깥 가장자리에 투영해 잡은 점으로 삼는다. 누른 점은 입력 주인과 속도에만 쓴다.
 *    드래그 시작 프레임에는 가장자리와 포인터 사이 거리의 절반 폭이 한 번에 접히므로, 넘김 영역의 폭(G2)이
 *    첫 프레임 접힘의 상한이다(turn-pose.ts).
 * 4. 드래그면 포인터를, 클릭이면 createClickTurnPath를 samplePointerPath로 샘플링한 가상 포인터를
 *    computeTurnPose에 넣는다(책등 제한 → 반사 접힘 → 진행도).
 * 5. 원통으로 그릴 때는 limitRadiusToSpine으로 반지름을 고르고 solveCurlPose·curlPoint로 정점을 옮긴다.
 * 6. 놓으면 estimateVelocity와 decideRelease로 완주·복귀를 정하고 createSettlePath로 착지한다.
 */
/*
 * 이 파일은 앱(src/model/book, src/features)이 쓰는 것만 다시 내보낸다. 원통 넘김(cylinder.ts)처럼 앱이 아직 쓰지 않는
 * 함수·상수는 각 모듈에서 그대로 export되고, 테스트(공개 API 흐름 테스트 포함)는 그 모듈에서 직접 가져다 쓴다.
 * 앱이 쓰게 되면 여기에 다시 더한다.
 */
export type { BookFrame, PageSize, TurnDirection } from './book-frame';
export { toModelPoint, toScreenPoint } from './book-frame';
export { createClickTurnPath } from './click-turn';
export type { GestureContext, GestureEvent, GestureState, Rect } from './input-priority';
export { DEFAULT_DRAG_START_DISTANCE_PX, hasReachedDragStart, IDLE_GESTURE, reduceGesture } from './input-priority';
export type { BookView, PageLayout, ViewMove } from './pages';
export { assertPageCount, nextView, previousView, spreadPages, viewOfPage, visiblePages } from './pages';
export type { Easing, PathTiming, PointerPath } from './pointer-path';
export { DEFAULT_TURN_TIMING, isPathFinished, samplePointerPath } from './pointer-path';
export type { FoldLine } from './reflect-fold';
export { reflectAcrossFold, splitPageByFold } from './reflect-fold';
export type { ReleaseConfig, ReleaseOutcome } from './release';
export { createSettlePath, decideRelease, DEFAULT_RELEASE_CONFIG } from './release';
export type { TurnPose } from './turn-pose';
export { computeTurnPose, projectToOuterEdge } from './turn-pose';
export type { PointerSample } from './velocity';
export { estimateVelocity, retainSamplesForWindow } from './velocity';
export type { Vec2 } from './vector';
