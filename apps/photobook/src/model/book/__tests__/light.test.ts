import { describe, expect, it } from 'vitest';

import type { Vec2 } from '@/model/fold';

import { computeClosedPlacement, computeOpenGeometry } from '../geometry';
import { castShadowOutline, contactShadowOutline, faceShade, floorY, NIGHT_LIGHT, sceneLightFromSun } from '../light';
import { projectedBookOutline } from '../projection';
import { IDENTITY_QUAT, quatFromAxisAngle, Y_AXIS } from '../quaternion';
import { faceNormal, INITIAL_ORIENTATION } from '../rotation';
import { solarPosition } from '../sun';

const viewport = { width: 1440, height: 900 };
const placement = computeClosedPlacement(viewport, computeOpenGeometry(viewport, 'spread'));

/** 춘분(3월 20일) 현지 시각의 빛. */
function equinoxLight(hour: number, minute = 0) {
  return sceneLightFromSun(solarPosition(new Date(2026, 2, 20, hour, minute)));
}

function centroid(points: readonly Vec2[]): Vec2 {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function lowest(points: readonly Vec2[]): number {
  return Math.max(...points.map(point => point.y));
}

describe('light', () => {
  describe('sceneLightFromSun', () => {
    it('should light the book from the left in the morning and from the right in the afternoon', () => {
      expect(equinoxLight(9).direction.x).toBeLessThan(-0.3);
      expect(equinoxLight(15).direction.x).toBeGreaterThan(0.3);
    });

    it('should put the noon sun above and behind the book, at full strength', () => {
      const noon = equinoxLight(12);
      expect(Math.abs(noon.direction.x)).toBeLessThan(1e-6);
      expect(noon.direction.y).toBeLessThan(0);
      expect(noon.direction.z).toBeLessThan(0);
      expect(noon.strength).toBe(1);
    });

    it('should keep a low sun high enough that the shadow stays near the book', () => {
      const earlyMorning = equinoxLight(6, 45);
      expect(-earlyMorning.direction.y).toBeGreaterThanOrEqual(Math.sin((28 * Math.PI) / 180) - 1e-9);
      expect(earlyMorning.strength).toBeLessThan(1);
    });

    it('should switch to the weak night light after dusk', () => {
      const night = equinoxLight(23);
      expect(night.strength).toBeCloseTo(NIGHT_LIGHT.strength, 9);
      expect(night.direction.x).toBeCloseTo(NIGHT_LIGHT.direction.x, 9);
      expect(night.direction.y).toBeCloseTo(NIGHT_LIGHT.direction.y, 9);
      expect(night.direction.z).toBeCloseTo(NIGHT_LIGHT.direction.z, 9);
    });

    it('should return unit directions', () => {
      for (const hour of [0, 5, 7, 12, 17, 19, 21]) {
        const { direction } = equinoxLight(hour);
        expect(Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2)).toBeCloseTo(1, 9);
      }
    });
  });

  describe('faceShade', () => {
    it('should darken the side turned away from the sun and keep the lit side bright', () => {
      const morning = equinoxLight(9);
      const afternoon = equinoxLight(15);
      // 책배(오른쪽 면)는 아침에 해를 등지고 오후에 해를 본다. 책등(왼쪽 면)은 반대다.
      expect(faceShade(INITIAL_ORIENTATION, faceNormal('fore'), morning)).toBeGreaterThan(
        faceShade(INITIAL_ORIENTATION, faceNormal('fore'), afternoon) + 0.1
      );
      expect(faceShade(INITIAL_ORIENTATION, faceNormal('spine'), morning)).toBeLessThan(
        faceShade(INITIAL_ORIENTATION, faceNormal('spine'), afternoon) - 0.1
      );
    });

    it('should keep the cover facing the viewer nearly as drawn even against the noon sun', () => {
      expect(faceShade(IDENTITY_QUAT, faceNormal('front'), equinoxLight(12))).toBeLessThan(0.1);
    });

    it('should stay between untouched and the ambient floor', () => {
      for (const face of ['front', 'back', 'spine', 'fore', 'top', 'bottom'] as const) {
        for (const light of [equinoxLight(8), equinoxLight(12), equinoxLight(16), NIGHT_LIGHT]) {
          const shade = faceShade(INITIAL_ORIENTATION, faceNormal(face), light);
          expect(shade).toBeGreaterThanOrEqual(0);
          expect(shade).toBeLessThanOrEqual(0.35 + 1e-9);
        }
      }
    });
  });

  describe('shadows', () => {
    const bookCenterX = placement.center.x;

    it('should cast the morning shadow to the right of the book and the afternoon shadow to the left', () => {
      const morning = castShadowOutline(viewport, placement, INITIAL_ORIENTATION, equinoxLight(9));
      const afternoon = castShadowOutline(viewport, placement, INITIAL_ORIENTATION, equinoxLight(15));
      expect(centroid(morning).x).toBeGreaterThan(bookCenterX + 50);
      expect(centroid(afternoon).x).toBeLessThan(bookCenterX - 50);
    });

    it('should cast the noon shadow toward the viewer, below the book', () => {
      const noon = castShadowOutline(viewport, placement, INITIAL_ORIENTATION, equinoxLight(12));
      expect(lowest(noon)).toBeGreaterThan(lowest(projectedBookOutline(viewport, placement, INITIAL_ORIENTATION)));
      expect(Math.abs(centroid(noon).x - bookCenterX)).toBeLessThan(40);
    });

    it('should change the shadow as the book turns', () => {
      const light = equinoxLight(9);
      const facing = castShadowOutline(viewport, placement, IDENTITY_QUAT, light);
      const edgeOn = castShadowOutline(viewport, placement, quatFromAxisAngle(Y_AXIS, 90), light);
      const width = (points: readonly Vec2[]) =>
        Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x));
      expect(Math.abs(width(facing) - width(edgeOn))).toBeGreaterThan(20);
    });

    it('should lay the contact shadow on the floor right under the book', () => {
      const contact = contactShadowOutline(viewport, placement, IDENTITY_QUAT);
      expect(contact.length).toBeGreaterThanOrEqual(4);
      expect(Math.abs(centroid(contact).x - bookCenterX)).toBeLessThan(1);
      // 바닥은 쉬는 책의 아래 가장자리 높이다. 원근 때문에 앞쪽 가장자리는 조금 아래로 내려온다.
      expect(Math.abs(centroid(contact).y - floorY(placement))).toBeLessThan(20);
    });
  });
});
