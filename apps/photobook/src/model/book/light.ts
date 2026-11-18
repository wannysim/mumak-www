import type { Vec2 } from '@/model/fold';

import type { ClosedPlacement } from './geometry';
import type { Viewport } from './layout';
import { bookCorners, closedPerspective, convexHull, projectStagePoint, toStagePoint } from './projection';
import type { Quat, Vec3 } from './quaternion';
import { rotateVec3 } from './quaternion';
import type { SunPosition } from './sun';

/**
 * 화면 밖의 해가 닫힌 책을 비추는 연출(2026-11-18 사용자 제안). 해 위치(sun.ts)를 무대의 빛 방향으로 옮기고,
 * 그 빛으로 면 밝기(돌릴 때 바뀌는 면 음영)와 바닥에 떨어지는 그림자를 계산한다. 순수 함수다.
 *
 * - 무대 좌표는 projection.ts와 같다: x 오른쪽, y 아래, z 보는 사람 쪽. 빛 방향은 빛이 오는 쪽을 가리키는 단위 벡터다.
 * - 보는 사람은 남쪽을 보고 있다: 동쪽이 화면 왼쪽, 남쪽이 화면 안쪽(책 뒤), 서쪽이 오른쪽이다. 그래서 해는 아침에 왼쪽에서 떠
 *   한낮에 책 뒤편 하늘을 지나 오른쪽으로 지고, 그림자는 아침에 책 오른쪽, 한낮에 보는 사람 쪽, 오후에 왼쪽으로 진다(사용자 예시).
 * - 해가 어디 있든 책 바로 아래에 접지 그림자(위에서 곧장 내리비춘 발자국)를 따로 둔다. 해가 책 앞쪽에 있어 그림자가 책 뒤로
 *   숨는 자세(여름 이른 아침·늦은 저녁, 밤)에도 책이 떠 보이지 않게 한다.
 * - 바닥은 쉬는 책의 아래 가장자리 높이에 있는 수평면이다. 책은 가운데를 축으로 자유 회전하므로 바닥 아래로 내려간 꼭짓점은
 *   그 자리에 그림자가 붙은 것으로 본다(바닥은 그려지지 않는다).
 * 모든 수치는 임시, open-decisions G0 "닫힌 책 형태·재질·조명, 그림자".
 */

export type SceneLight = {
  /** 빛이 오는 쪽(무대 좌표, 단위 벡터). y는 항상 음수(위에서 온다). */
  readonly direction: Vec3;
  /** 직접광 세기 0..1. 해가 지평선 가까이 있거나 밤이면 줄어 면 음영과 그림자가 옅어진다. */
  readonly strength: number;
};

/**
 * 그림자·음영에 쓰는 고도 범위. 해의 고도 0–90°를 이 범위로 눌러 담는다.
 * 해 뜰 녘 그대로의 낮은 고도는 그림자가 화면 밖까지 늘어나므로 길이를 책 높이의 약 2배 안으로 묶는다.
 */
const LIGHT_ALTITUDE_MIN_DEG = 28;
const LIGHT_ALTITUDE_MAX_DEG = 80;

/** 박명: 해 고도가 이 범위를 지나며 낮빛에서 밤빛으로 바뀐다(시민 박명 ±6°). */
const TWILIGHT_LOW_DEG = -6;
const TWILIGHT_HIGH_DEG = 6;
/** 해가 이 고도에 오르면 직접광이 다 세진다. */
const FULL_SUN_ALTITUDE_DEG = 15;

/** 밤빛: 책 뒤편 높은 하늘(남쪽)에서 비추는 달빛 같은 약한 빛. */
const NIGHT_LIGHT_ALTITUDE_DEG = 55;
const NIGHT_LIGHT_AZIMUTH_DEG = 180;
const NIGHT_LIGHT_STRENGTH = 0.35;

/**
 * 면 밝기 = 환경광 + 직접광 × 세기 × max(0, 법선·빛) + 보는 쪽 보조광 × max(0, 법선 z).
 * 한낮의 해는 책 뒤에 있어 표지가 역광이 된다. 보조광은 보는 사람을 향한 표지 그림이 그래도 어둡게 가라앉지 않게 하고,
 * 음영 차이는 주로 옆면(책등·책배·윗면·아랫면)에서 난다.
 */
const AMBIENT_LIGHT = 0.65;
const KEY_LIGHT = 0.3;
const VIEW_FILL_LIGHT = 0.3;

/** 접지 그림자를 만드는 빛: 바로 위에서 곧장 내리비춘다. */
const OVERHEAD: Vec3 = { x: 0, y: -1, z: 0 };

const DEGREES_TO_RADIANS = Math.PI / 180;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(from: number, to: number, value: number): number {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

function normalize(v: Vec3): Vec3 {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  return length === 0 ? { x: 0, y: -1, z: 0 } : { x: v.x / length, y: v.y / length, z: v.z / length };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** 고도·방위를 무대 빛 방향으로. 남쪽을 보는 사람 기준: 동 → 화면 왼쪽, 남 → 화면 안쪽, 서 → 오른쪽, 북 → 보는 사람 쪽. */
function stageDirection(altitudeDeg: number, azimuthDeg: number): Vec3 {
  const altitude = altitudeDeg * DEGREES_TO_RADIANS;
  const azimuth = azimuthDeg * DEGREES_TO_RADIANS;
  return {
    x: -Math.sin(azimuth) * Math.cos(altitude),
    y: -Math.sin(altitude),
    z: Math.cos(azimuth) * Math.cos(altitude),
  };
}

/** 해 고도 0–90°를 그림자·음영용 고도 범위로 눌러 담는다. 지평선 아래는 하한으로 둔다(밤빛과 섞이는 동안). */
function lightAltitudeDeg(sunAltitudeDeg: number): number {
  const t = clamp01(sunAltitudeDeg / 90);
  return LIGHT_ALTITUDE_MIN_DEG + (LIGHT_ALTITUDE_MAX_DEG - LIGHT_ALTITUDE_MIN_DEG) * t;
}

export const NIGHT_LIGHT: SceneLight = {
  direction: stageDirection(NIGHT_LIGHT_ALTITUDE_DEG, NIGHT_LIGHT_AZIMUTH_DEG),
  strength: NIGHT_LIGHT_STRENGTH,
};

export function sceneLightFromSun(sun: SunPosition): SceneLight {
  const sunDirection = stageDirection(lightAltitudeDeg(sun.altitudeDeg), sun.azimuthDeg);
  const daylight = smoothstep(TWILIGHT_LOW_DEG, TWILIGHT_HIGH_DEG, sun.altitudeDeg);
  const night = NIGHT_LIGHT.direction;
  return {
    direction: normalize({
      x: night.x + (sunDirection.x - night.x) * daylight,
      y: night.y + (sunDirection.y - night.y) * daylight,
      z: night.z + (sunDirection.z - night.z) * daylight,
    }),
    strength:
      NIGHT_LIGHT_STRENGTH +
      (1 - NIGHT_LIGHT_STRENGTH) * smoothstep(TWILIGHT_LOW_DEG, FULL_SUN_ALTITUDE_DEG, sun.altitudeDeg),
  };
}

/**
 * 면 어둡기 0..1(0이면 그대로, 1이면 검정). orientation은 그 면을 돌린 자세(표지 판이면 판의 자세), normal은 책 좌표 법선이다.
 * 컴포넌트는 이 값을 면 위 검은 막의 투명도로 건다.
 */
export function faceShade(orientation: Quat, normal: Vec3, light: SceneLight): number {
  const facing = rotateVec3(orientation, normal);
  const key = Math.max(0, dot(facing, light.direction)) * light.strength;
  const fill = Math.max(0, facing.z);
  return 1 - clamp01(AMBIENT_LIGHT + KEY_LIGHT * key + VIEW_FILL_LIGHT * fill);
}

/** 바닥 높이(무대 y): 쉬는 닫힌 책의 아래 가장자리. */
export function floorY(placement: ClosedPlacement): number {
  return placement.frontBox.y + placement.frontBox.height;
}

/**
 * 바닥에 떨어진 책 그림자(화면 좌표 볼록 다각형). 8개 꼭짓점을 빛 반대쪽으로 바닥까지 밀고 무대 원근으로 투영한다.
 * 책이 돌면 꼭짓점이 따라 돌아 그림자 모양과 길이가 바뀐다.
 */
export function castShadowOutline(
  viewport: Viewport,
  placement: ClosedPlacement,
  orientation: Quat,
  light: SceneLight,
  travel = 0
): Vec2[] {
  return shadowAlong(light.direction, viewport, placement, orientation, travel);
}

/** 접지 그림자: 책을 바로 위에서 바닥에 내리비춘 발자국. 자세를 따라 모양이 바뀐다. */
export function contactShadowOutline(
  viewport: Viewport,
  placement: ClosedPlacement,
  orientation: Quat,
  travel = 0
): Vec2[] {
  return shadowAlong(OVERHEAD, viewport, placement, orientation, travel);
}

function shadowAlong(
  direction: Vec3,
  viewport: Viewport,
  placement: ClosedPlacement,
  orientation: Quat,
  travel: number
): Vec2[] {
  const perspective = closedPerspective(viewport);
  const floor = floorY(placement);
  // 빛이 위에서 오므로 -y > 0이다. 고도 하한(LIGHT_ALTITUDE_MIN_DEG) 덕에 0에 가까워지지 않는다.
  const rise = -direction.y;
  return convexHull(
    bookCorners(placement).map(corner => {
      const point = toStagePoint(corner, placement, orientation, travel);
      const run = Math.max(floor - point.y, 0) / rise;
      return projectStagePoint(
        { x: point.x - direction.x * run, y: floor, z: point.z - direction.z * run },
        perspective
      );
    })
  );
}
