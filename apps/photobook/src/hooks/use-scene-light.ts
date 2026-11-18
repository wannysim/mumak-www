import { useMemo, useSyncExternalStore } from 'react';

import type { SceneLight } from '@/model/book/light';
import { sceneLightFromSun } from '@/model/book/light';
import { solarPosition } from '@/model/book/sun';

/**
 * 기기 현지 시각의 해로 본 닫힌 책 조명(light.ts). 해는 천천히 움직이므로 1분마다 다시 읽는다.
 * 개발 서버에서는 주소에 `?at=07:30`(오늘 그 시각) 또는 `?at=2026-06-21T07:30`(그날 그 시각)을 붙여 다른 시각을 미리 본다.
 */
const SUN_REFRESH_MS = 60_000;
const TIME_ONLY = /^(\d{1,2}):(\d{2})$/;

/** 개발 서버에서만 ?at= 시각을 읽는다. 읽을 수 없으면 null(지금 시각을 쓴다). */
function previewTime(search: string): number | null {
  const value = new URLSearchParams(search).get('at');
  if (value === null) {
    return null;
  }
  const timeOnly = TIME_ONLY.exec(value);
  if (timeOnly !== null) {
    const today = new Date();
    today.setHours(Number(timeOnly[1]), Number(timeOnly[2]), 0, 0);
    return today.getTime();
  }
  // 시간대 표시가 없는 날짜·시각 문자열은 현지 시각으로 읽힌다.
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/** 1분 단위로 끊은 지금 시각(ms). 같은 분 안에서는 같은 값이라 다시 그리지 않는다. */
function readMinute(): number {
  const preview = import.meta.env.DEV ? previewTime(window.location.search) : null;
  const now = preview ?? Date.now();
  return now - (now % SUN_REFRESH_MS);
}

function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, SUN_REFRESH_MS);
  return () => window.clearInterval(timer);
}

export function useSceneLight(): SceneLight {
  const minute = useSyncExternalStore(subscribe, readMinute, readMinute);
  return useMemo(() => sceneLightFromSun(solarPosition(new Date(minute))), [minute]);
}
