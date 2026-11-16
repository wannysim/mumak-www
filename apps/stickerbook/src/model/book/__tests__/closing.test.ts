import { describe, expect, it } from 'vitest';

import type { BookView, TurnDirection } from '@/model/fold';
import { toModelPoint, toScreenPoint } from '@/model/fold';
import { facingFace } from '@/test/book-faces';

import type { ClosingTimeline, CoverDrag } from '../closing';
import {
  advanceCoverReturn,
  beginCoverDrag,
  closingDuration,
  closingPoseAt,
  continueCoverDrag,
  COVER_DRAG_TRACKING_RAMP,
  coverDragProgress,
  coverLens,
  coverPose,
  coverReturnProgress,
  coverSideFor,
  createClosingTimeline,
  isClosingDone,
  isCoverReturnDone,
  releaseCoverDrag,
  startCoverReturn,
} from '../closing';
import type { OpenGeometry } from '../geometry';
import { computeClosedPlacement, computeOpenGeometry, coverLayout, turnFrame } from '../geometry';
import type { Viewport } from '../layout';
import {
  OPEN_COVER_DURATION_MS,
  OPEN_HANDOFF_DURATION_MS,
  REDUCED_MOTION_CROSSFADE_MS,
  turnDuration,
} from '../opening';
import { closedPerspective, projectBookPoint } from '../projection';
import type { CoverSide } from '../rotation';
import { facingOrientation, restOrientation } from '../rotation';

const spreadViewport: Viewport = { width: 1440, height: 900 };
const phoneViewport: Viewport = { width: 390, height: 844 };
const spread = computeOpenGeometry(spreadViewport, 'spread');
const phone = computeOpenGeometry(phoneViewport, 'single');
const width = spread.page.width;
const y = 300;

function coverSetup(open: OpenGeometry, direction: TurnDirection) {
  const setup = { frame: turnFrame(open, direction), direction, page: open.page };
  return { ...setup, lens: coverLens(setup, open) };
}

/** 첫 펼침에서 왼쪽 쪽 바깥 가장자리 근처(책 좌표)를 잡아 오른쪽으로 끈다(앞표지 덮기). */
function frontDrag(fingerX: number, time = 16) {
  return beginCoverDrag(coverSetup(spread, 'backward'), { x: 10, y }, { x: fingerX, y }, time);
}

/**
 * 덮인 정도 progress에서 판 바깥 끝이 화면에 그려지는 x. 닫힌 책 컴포넌트가 CSS에 거는 변환을 그대로 따른다:
 * 표지 판은 translateZ(±두께/2) rotateY(∓180°·열린 정도)이고 축은 책 상자의 왼쪽 가장자리, 책은 펼친 쪽 자리(travel 1)에서
 * 표지가 정면을 보는 자세다. 투영은 탭 판정과 같은 projectBookPoint다(덮기 모델의 역계산과 무관한 기준).
 */
function renderedEdgeX(viewport: Viewport, open: OpenGeometry, side: CoverSide, view: BookView, progress: number) {
  const placement = computeClosedPlacement(viewport, open, coverLayout(open, side, view).body);
  const boardWidth = placement.target.width;
  const angle = Math.PI * (1 - progress);
  const lift = boardWidth * Math.sin(angle);
  const edge = {
    x: -boardWidth / 2 + boardWidth * Math.cos(angle),
    y: 0,
    z: side === 'front' ? placement.depth / 2 + lift : -placement.depth / 2 - lift,
  };
  return projectBookPoint(edge, placement, facingOrientation(side), 1, closedPerspective(viewport)).x;
}

/** 판 끝이 화면에 그려진 x와 손가락이 정한 판 끝 자리(edgeX를 화면으로 옮긴 x)의 차이(px). */
function trackingError(viewport: Viewport, open: OpenGeometry, view: BookView, drag: CoverDrag): number {
  const side = coverSideFor(drag.direction);
  const target = toScreenPoint({ x: drag.edgeX, y: 0 }, drag.frame, drag.direction).x + open.book.x;
  return renderedEdgeX(viewport, open, side, view, coverDragProgress(drag)) - target;
}

/** 바깥 가장자리 근처를 잡고 책등 너머까지 n단계로 끈 덮인 정도들. */
function progressAlongDrag(open: OpenGeometry, direction: TurnDirection, origin: { x: number; y: number }) {
  const setup = coverSetup(open, direction);
  const drag = beginCoverDrag(setup, origin, origin, 0);
  const sign = direction === 'backward' ? 1 : -1;
  return Array.from({ length: 101 }, (_, index) => {
    const finger = { x: origin.x + sign * open.page.width * 2.2 * (index / 100), y: origin.y };
    return continueCoverDrag(drag, finger, index);
  });
}

describe('closing', () => {
  it('should close the front cover going back from the start and the back cover going forward from the end', () => {
    expect(coverSideFor('backward')).toBe('front');
    expect(coverSideFor('forward')).toBe('back');
  });

  describe('cover drag (hard board)', () => {
    it('should stand the board on the spine when the finger reaches the spine and lay it down past it', () => {
      // 판 끝을 20px 들면 이미 약 20° 선다(acos 사상은 다 열린 쪽에서 가파르다).
      expect(coverDragProgress(frontDrag(30))).toBeGreaterThan(0.05);
      expect(coverDragProgress(frontDrag(30))).toBeLessThan(0.15);
      // 누른 점이 바깥 가장자리 근처라 배율은 거의 1이다. 손가락이 책등(책 좌표 x = 쪽 폭)에 닿으면 0.5.
      expect(coverDragProgress(frontDrag(width))).toBeCloseTo(0.5, 1);
      expect(coverDragProgress(frontDrag(width * 2))).toBeCloseTo(1, 1);
      expect(coverDragProgress(frontDrag(width * 3))).toBe(1);
      // 반대쪽(바깥)으로 끌면 다 열린 채다.
      expect(coverDragProgress(frontDrag(-200))).toBe(0);
    });

    it('should scale a press far inside the page so the finger at the spine is still the halfway point', () => {
      const setup = coverSetup(spread, 'backward');
      const inner = beginCoverDrag(setup, { x: width * 0.4, y }, { x: width * 0.4 + 10, y }, 0);
      expect(inner.scale).toBeCloseTo(1 / 0.6);
      expect(coverDragProgress(continueCoverDrag(inner, { x: width, y }, 50))).toBeCloseTo(0.5);
      // 책등에 아주 가까이 누르면 배율은 2에서 멈춘다(넘김과 같은 상한).
      const nearSpine = beginCoverDrag(setup, { x: width * 0.9, y }, { x: width * 0.9 + 10, y }, 0);
      expect(nearSpine.scale).toBe(2);
    });

    it('should complete past the middle and return before it, with the same release rule as turns', () => {
      const dragged = continueCoverDrag(frontDrag(30, 0), { x: width * 1.3, y }, 1000);
      expect(releaseCoverDrag(dragged, { x: width * 1.3, y }, 1100).outcome).toBe('complete');
      const short = continueCoverDrag(frontDrag(30, 0), { x: width * 0.6, y }, 1000);
      const slow = releaseCoverDrag(short, { x: width * 0.6, y }, 1200);
      expect(slow.outcome).toBe('return');
      expect(slow.progress).toBeLessThan(0.5);
    });

    it('should complete a short but fast flick toward closing', () => {
      const flicked = continueCoverDrag(frontDrag(30, 0), { x: 80, y }, 20);
      const released = releaseCoverDrag(flicked, { x: 140, y }, 40);
      expect(released.progress).toBeLessThan(0.5);
      expect(released.outcome).toBe('complete');
    });

    it('should map the back cover drag from the last spread the same way', () => {
      const drag = beginCoverDrag(coverSetup(spread, 'forward'), { x: width * 2 - 10, y }, { x: width * 2 - 30, y }, 0);
      expect(coverDragProgress(drag)).toBeLessThan(0.15);
      expect(coverDragProgress(continueCoverDrag(drag, { x: width, y }, 100))).toBeCloseTo(0.5, 1);
    });

    it('should take the stage perspective origin into model coordinates', () => {
      // 펼침면은 책등이 화면 가운데(원근 원점)라 0, 세로 폰은 화면 가운데가 쪽 가운데라 책등에서 쪽 폭의 절반.
      expect(coverSetup(spread, 'backward').lens.originX).toBeCloseTo(0);
      expect(coverSetup(spread, 'forward').lens.originX).toBeCloseTo(0);
      expect(coverSetup(phone, 'backward').lens.originX).toBeCloseTo(phone.page.width / 2);
      const origin = closedPerspective({ width: 390, height: 844 }).origin.x - phone.book.x;
      expect(coverSetup(phone, 'forward').lens.originX).toBeCloseTo(
        toModelPoint({ x: origin, y: 0 }, turnFrame(phone, 'forward'), 'forward').x
      );
      expect(coverSetup(spread, 'backward').lens.distance).toBe(
        closedPerspective({ width: 1440, height: 900 }).distance
      );
    });

    it.each([
      ['spread, front cover', spreadViewport, spread, { layout: 'spread', spread: 0 }, 'backward', 10],
      [
        'spread, back cover',
        spreadViewport,
        spread,
        { layout: 'spread', spread: 3 },
        'forward',
        spread.book.width - 10,
      ],
      ['phone, front cover from page 1', phoneViewport, phone, { layout: 'single', page: 1 }, 'backward', 10],
      [
        'phone, back cover from page 8',
        phoneViewport,
        phone,
        { layout: 'single', page: 8 },
        'forward',
        phone.book.width - 10,
      ],
    ] as const)(
      'should keep the drawn board edge under the finger (%s)',
      (_, viewport, open, view, direction, pressX) => {
        // 바깥 가장자리에서 10px 안쪽을 잡는다(책 좌표).
        const origin = { x: pressX, y };
        const drags = progressAlongDrag(open, direction, origin);
        const progress = drags.map(coverDragProgress);
        // 손가락을 책등 쪽으로 옮기면 판은 되돌아가지 않는다(단조).
        for (const [index, value] of progress.entries()) {
          expect(value).toBeGreaterThanOrEqual((progress[index - 1] ?? 0) - 1e-12);
        }
        expect(progress[0]).toBe(0);
        expect(progress.at(-1)).toBe(1);
        // 판이 막 들리거나 거의 덮인 양 끝을 뺀 가운데에서는 화면의 판 끝이 손가락 자리와 1px 안으로 맞는다.
        const middle = drags.filter(drag => {
          const flat = Math.acos(drag.edgeX / drag.page.width) / Math.PI;
          return flat >= COVER_DRAG_TRACKING_RAMP && flat <= 1 - COVER_DRAG_TRACKING_RAMP;
        });
        expect(middle.length).toBeGreaterThan(20);
        for (const drag of middle) {
          expect(Math.abs(trackingError(viewport, open, view, drag))).toBeLessThan(1);
        }
      }
    );

    it('should lift the board more than a flat drag would when the edge is halfway to the spine', () => {
      // 손가락이 쪽 폭 절반만큼 왔을 때(판 끝 x = 쪽 폭/2). 원근이 없으면 acos(1/2)/π = 1/3이다.
      // 들린 판 끝은 원근 원점(책등)에서 멀어져 보이므로, 손가락 아래에 두려면 판이 더 서야 한다.
      // 바깥 가장자리(책 좌표 x = 0)를 잡으면 배율 1이라 판 끝 자리가 손가락 자리다.
      const drag = beginCoverDrag(coverSetup(spread, 'backward'), { x: 0, y }, { x: width / 2, y }, 0);
      expect(drag.edgeX).toBeCloseTo(width / 2, 9);
      const progress = coverDragProgress(drag);
      expect(progress).toBeGreaterThan(1 / 3 + 0.02);
      // 판 끝이 화면 x = 책등 - 쪽 폭/2(책 좌표 x = 쪽 폭/2)에 그려진다.
      const spine = spread.book.x + width;
      expect(renderedEdgeX(spreadViewport, spread, 'front', { layout: 'spread', spread: 0 }, progress)).toBeCloseTo(
        spine - width / 2,
        6
      );
      expect(releaseCoverDrag(drag, { x: width / 2, y }, 1000).progress).toBeCloseTo(progress, 9);
    });

    it('should not jump when the board starts to lift, easing the perspective correction in', () => {
      const flatAt = (drag: CoverDrag) => Math.acos(drag.edgeX / width) / Math.PI;
      const justLifted = frontDrag(12);
      expect(coverDragProgress(justLifted)).toBeGreaterThanOrEqual(flatAt(justLifted));
      expect(coverDragProgress(justLifted) - flatAt(justLifted)).toBeLessThan(0.01);
    });
  });

  describe('return', () => {
    it('should reopen from the release point with the opening easing and take time proportional to it', () => {
      const cover = startCoverReturn(0.4);
      expect(isCoverReturnDone(cover)).toBe(false);
      const first = advanceCoverReturn(cover, 100);
      expect(coverReturnProgress(first)).toBe(0.4);
      const middle = advanceCoverReturn(first, 100 + OPEN_COVER_DURATION_MS * 0.2);
      expect(coverReturnProgress(middle)).toBeLessThan(0.4);
      expect(coverReturnProgress(middle)).toBeGreaterThan(0);
      const done = advanceCoverReturn(first, 100 + OPEN_COVER_DURATION_MS * 0.4);
      expect(isCoverReturnDone(done)).toBe(true);
      expect(coverReturnProgress(done)).toBe(0);
      expect(advanceCoverReturn(first, 50).elapsedMs).toBe(0);
    });
  });

  it('should turn only the board while dragging, or crossfade to the resting closed book with reduced motion', () => {
    expect(coverPose('back', 0.25, false)).toEqual({
      orientation: facingOrientation('back'),
      side: 'back',
      coverOpen: 0.75,
      travel: 1,
      handoff: 0,
      crossfade: false,
    });
    expect(coverPose('front', 0.25, true)).toEqual({
      orientation: restOrientation('front'),
      side: 'front',
      coverOpen: 0,
      travel: 0,
      handoff: 0.75,
      crossfade: true,
    });
  });

  describe('closing timeline (opening played backwards)', () => {
    const fromButton: ClosingTimeline = createClosingTimeline('front', {
      coverOpen: 1,
      fromDom: true,
      reducedMotion: false,
    });

    it('should hand over from the open book, close the cover while travelling, then turn to rest', () => {
      expect(fromButton.returnMs).toBeCloseTo(turnDuration(facingOrientation('front'), restOrientation('front')));
      expect(closingDuration(fromButton)).toBeCloseTo(
        OPEN_HANDOFF_DURATION_MS + OPEN_COVER_DURATION_MS + fromButton.returnMs
      );
      expect(closingPoseAt(fromButton, 0)).toEqual({
        orientation: facingOrientation('front'),
        side: 'front',
        coverOpen: 1,
        travel: 1,
        handoff: 1,
        crossfade: false,
      });
      expect(closingPoseAt(fromButton, OPEN_HANDOFF_DURATION_MS / 2)).toMatchObject({ handoff: 0.5, coverOpen: 1 });
      const closing = closingPoseAt(fromButton, OPEN_HANDOFF_DURATION_MS + OPEN_COVER_DURATION_MS / 4);
      expect(closing.handoff).toBe(0);
      expect(closing.coverOpen).toBeLessThan(1);
      expect(closing.coverOpen).toBeGreaterThan(0);
      expect(closing.travel).toBeCloseTo(closing.coverOpen);
      const closed = closingPoseAt(fromButton, OPEN_HANDOFF_DURATION_MS + OPEN_COVER_DURATION_MS);
      expect(closed).toMatchObject({ coverOpen: 0, travel: 0 });
      const turning = closingPoseAt(fromButton, closingDuration(fromButton) - fromButton.returnMs / 2);
      expect(turning.orientation).not.toEqual(fromButton.from);
      expect(turning.orientation).not.toEqual(fromButton.to);
      expect(isClosingDone(fromButton, closingDuration(fromButton) - 1)).toBe(false);
      expect(isClosingDone(fromButton, closingDuration(fromButton))).toBe(true);
      expect(closingPoseAt(fromButton, closingDuration(fromButton)).orientation).toBe(fromButton.to);
    });

    it('should start closing the cover right away instead of holding it open (2026-11-16 decision)', () => {
      // 역재생(천천히 출발)은 시작 지연 때문에 앱이 느려 보여 뺐다. 표지가 닫히기 시작하고 0.1초면 반 넘게 닫혀 있어야 한다.
      const soon = closingPoseAt(fromButton, OPEN_HANDOFF_DURATION_MS + 100);
      expect(soon.coverOpen).toBeLessThan(0.5);
      expect(soon.travel).toBeCloseTo(soon.coverOpen);
    });

    it('should continue from the released board angle without a handover after a drag', () => {
      const timeline = createClosingTimeline('back', { coverOpen: 0.3, fromDom: false, reducedMotion: false });
      expect(timeline.handoffMs).toBe(0);
      expect(closingPoseAt(timeline, 0)).toMatchObject({ coverOpen: 0.3, travel: 1, handoff: 0 });
      expect(facingFace(closingPoseAt(timeline, closingDuration(timeline)).orientation)).toBe('back');
    });

    it('should only crossfade to the resting closed book with reduced motion', () => {
      const timeline = createClosingTimeline('back', { coverOpen: 1, fromDom: true, reducedMotion: true });
      expect(closingDuration(timeline)).toBe(REDUCED_MOTION_CROSSFADE_MS);
      expect(closingPoseAt(timeline, REDUCED_MOTION_CROSSFADE_MS / 4)).toEqual({
        orientation: restOrientation('back'),
        side: 'back',
        coverOpen: 0,
        travel: 0,
        handoff: 0.75,
        crossfade: true,
      });
    });
  });
});
