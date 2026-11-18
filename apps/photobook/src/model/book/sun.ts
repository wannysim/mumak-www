/**
 * 접속한 기기의 현지 시각과 날짜로 본 해의 위치. 화면에는 보이지 않는 해가 닫힌 책을 비춘다는 연출의 입력이다(light.ts).
 * 2026-11-18 사용자 제안: 아침·오후·날짜에 따라 그림자와 면 밝기가 달라지는 작은 디테일.
 *
 * - 천문 정밀도가 목적이 아니다. 현지 시계를 태양시로 보고(경도·균시차·일광 절약 시간 무시) 적위는 코사인 근사로 잡는다.
 * - 기기 위치는 묻지 않는다(권한 요청 없음). 위도는 한 값으로 둔다.
 * - 각도는 deg. 방위각은 북 0°, 동 90°, 남 180°, 서 270°(시계 방향)다.
 */

/** 해를 띄울 위도(deg). 임시, open-decisions G0 "닫힌 책 형태·재질·조명, 그림자"(서울 37.5°N). */
export const SUN_LATITUDE_DEG = 37.5;

/** 지구 자전축 기울기(deg). 적위의 진폭. */
const AXIAL_TILT_DEG = 23.44;

/** 동지(12월 21일 무렵)가 1월 1일보다 며칠 앞서는지. 적위 코사인 근사의 위상. */
const DAYS_FROM_WINTER_SOLSTICE_TO_NEW_YEAR = 10;

const DAYS_PER_YEAR = 365;
const DEGREES_PER_HOUR = 15;
const SOLAR_NOON_HOUR = 12;
const MS_PER_DAY = 86_400_000;

const DEGREES_TO_RADIANS = Math.PI / 180;

export type SunPosition = {
  /** 지평선 위 고도(deg). 음수면 해가 진 뒤다. */
  readonly altitudeDeg: number;
  /** 방위각(deg, 북 0 → 동 90 → 남 180 → 서 270). */
  readonly azimuthDeg: number;
};

/** 현지 날짜 기준 1월 1일 = 1. 일광 절약 시간 전환일에도 하루씩 늘도록 정오끼리 뺀다. */
export function dayOfYear(date: Date): number {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), SOLAR_NOON_HOUR);
  const newYearNoon = new Date(date.getFullYear(), 0, 1, SOLAR_NOON_HOUR);
  return Math.round((noon.getTime() - newYearNoon.getTime()) / MS_PER_DAY) + 1;
}

/** 태양 적위(deg). 동지 -23.44°, 하지 +23.44°. */
export function solarDeclinationDeg(day: number): number {
  return -AXIAL_TILT_DEG * Math.cos(((2 * Math.PI) / DAYS_PER_YEAR) * (day + DAYS_FROM_WINTER_SOLSTICE_TO_NEW_YEAR));
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

/** 현지 시각 date에 latitudeDeg에서 본 해의 고도와 방위각. */
export function solarPosition(date: Date, latitudeDeg: number = SUN_LATITUDE_DEG): SunPosition {
  const latitude = latitudeDeg * DEGREES_TO_RADIANS;
  const declination = solarDeclinationDeg(dayOfYear(date)) * DEGREES_TO_RADIANS;
  const solarHour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const hourAngle = (solarHour - SOLAR_NOON_HOUR) * DEGREES_PER_HOUR * DEGREES_TO_RADIANS;

  const sinAltitude = clampUnit(
    Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)
  );
  const altitude = Math.asin(sinAltitude);
  const cosAltitudeLatitude = Math.cos(altitude) * Math.cos(latitude);
  // 해가 천정에 있으면 방위각이 정해지지 않는다. 남쪽으로 둔다.
  const azimuthFromNorth =
    cosAltitudeLatitude === 0
      ? Math.PI
      : Math.acos(clampUnit((Math.sin(declination) - sinAltitude * Math.sin(latitude)) / cosAltitudeLatitude));
  // 오전(시간각 < 0)은 동쪽 반원, 오후는 서쪽 반원이다.
  const azimuth = hourAngle > 0 ? 2 * Math.PI - azimuthFromNorth : azimuthFromNorth;

  return { altitudeDeg: altitude / DEGREES_TO_RADIANS, azimuthDeg: azimuth / DEGREES_TO_RADIANS };
}
