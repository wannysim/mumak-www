// performance.mark/measure 계측. 이름은 spikes.md 공통 측정 방법의 sb:<스파이크>:<사건>을 따른다.
// 수치는 래스터 한 건마다 따로 모은다(StepTimer). 배율·SVG 크기 방식·쪽 크기가 다른 래스터를 한 요약에 섞지 않으려고
// 요약은 재래스터 키별로 내고, 첫 래스터(cold)와 버린 세대는 요약에서 뺀다.

import { summarizeDurations, type DurationSummary } from './raster-math';

/** 페이지 로드 때 한 번 재는 사건. */
export const LOAD_EVENTS = ['font-fetch', 'font-register', 'font-embed'] as const;

/**
 * 래스터 한 건의 사건. 순서가 표 순서다.
 * - draw-image: drawImage 호출(명령 기록). Chromium은 SVG 래스터를 미뤄 두므로 여기 비용이 거의 없다.
 * - draw-flush: 1px 읽기로 미룬 래스터를 끝까지 실행시킨 시간. 운영 경로(읽기 없음)에서는 이 비용이 texImage2D로 간다.
 * - paint-probe: 내용 영역을 사본 캔버스로 복사해 읽고 글자·사진이 그려졌는지 보는 시간(WebKit 219770 우회 판정).
 * - blank-redraw: 내용이 빠졌을 때 한 프레임 뒤 다시 그리고 다시 판정한 시간.
 * - raster-total: 사진 인라인부터 텍스처 반영까지(late-verify 제외).
 * - first-raster / reraster: 트리거부터 반영까지. 첫 래스터는 재래스터가 아니라서 이름을 나눈다.
 * - late-verify: 반영 뒤 하네스만 하는 늦은 다시 그리기 비교. raster-total에 넣지 않는다.
 */
export const RASTER_EVENTS = [
  'photo-inline',
  'serialize',
  'svg-encode',
  'decode',
  'draw-image',
  'draw-flush',
  'paint-probe',
  'blank-redraw',
  'tex-image-2d',
  'raster-total',
  'first-raster',
  'reraster',
  'late-verify',
] as const;

type LoadEvent = (typeof LOAD_EVENTS)[number];
type RasterEvent = (typeof RASTER_EVENTS)[number];
export type MeasureEvent = LoadEvent | RasterEvent;

export type StepDurations = Partial<Record<MeasureEvent, number>>;

export type StepTimer = {
  /** 이 타이머로 잰 사건별 ms. 같은 사건을 두 번 재면 더한다. */
  readonly steps: StepDurations;
  /** startMark부터 지금까지를 event로 measure하고 ms를 돌려준다. */
  measureSince(event: MeasureEvent, startMark: string): number;
  time<T>(event: MeasureEvent, run: () => Promise<T>): Promise<T>;
  timeSync<T>(event: MeasureEvent, run: () => T): T;
};

export type Measurer = {
  /** 이름이 고유한 시작 mark를 찍고 그 이름을 돌려준다. */
  mark(label: string): string;
  /** 래스터 한 건(또는 로드 한 번)의 수치를 따로 모으는 타이머. */
  createStepTimer(): StepTimer;
};

export function measureName(event: MeasureEvent): string {
  return `sb:s1:${event}`;
}

export function createMeasurer(): Measurer {
  let sequence = 0;

  function mark(label: string): string {
    sequence += 1;
    const name = `sb:s1:${label}:start:${sequence}`;
    performance.mark(name);
    return name;
  }

  function createStepTimer(): StepTimer {
    const steps: StepDurations = {};

    function measureSince(event: MeasureEvent, startMark: string): number {
      const name = measureName(event);
      const endMark = `${startMark}:end`;
      performance.mark(endMark);
      // 오래된 Safari는 measure()가 undefined를 돌려줬다. 그때는 entry 목록에서 읽는다.
      const entry: PerformanceMeasure | undefined = performance.measure(name, startMark, endMark);
      const duration = entry?.duration ?? performance.getEntriesByName(name, 'measure').at(-1)?.duration ?? 0;
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      steps[event] = (steps[event] ?? 0) + duration;
      return duration;
    }

    async function time<T>(event: MeasureEvent, run: () => Promise<T>): Promise<T> {
      const startMark = mark(event);
      try {
        return await run();
      } finally {
        measureSince(event, startMark);
      }
    }

    function timeSync<T>(event: MeasureEvent, run: () => T): T {
      const startMark = mark(event);
      try {
        return run();
      } finally {
        measureSince(event, startMark);
      }
    }

    return { steps, measureSince, time, timeSync };
  }

  return { mark, createStepTimer };
}

export type StepRecord = { key: string; steps: StepDurations; includeInSummary: boolean };

export type KeySummary = { key: string; count: number; events: Partial<Record<RasterEvent, DurationSummary>> };

/** includeInSummary인 기록만 재래스터 키별로 묶어 사건마다 요약한다. 키 순서는 처음 나온 순서. */
export function summarizeByKey(records: readonly StepRecord[]): KeySummary[] {
  const groups = new Map<string, StepRecord[]>();
  for (const record of records) {
    if (!record.includeInSummary) continue;
    const group = groups.get(record.key) ?? [];
    group.push(record);
    groups.set(record.key, group);
  }
  return [...groups].map(([key, group]) => {
    const events: Partial<Record<RasterEvent, DurationSummary>> = {};
    for (const event of RASTER_EVENTS) {
      const values = group.flatMap(record => {
        const value = record.steps[event];
        return value === undefined ? [] : [value];
      });
      const summary = summarizeDurations(values);
      if (summary) events[event] = summary;
    }
    return { key, count: group.length, events };
  });
}
