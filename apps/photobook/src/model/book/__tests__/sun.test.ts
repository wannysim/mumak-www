import { describe, expect, it } from 'vitest';

import { dayOfYear, solarDeclinationDeg, solarPosition, SUN_LATITUDE_DEG } from '../sun';

/** 현지 시각. 월은 1부터 센다. */
function local(month: number, day: number, hour: number, minute = 0): Date {
  return new Date(2026, month - 1, day, hour, minute);
}

describe('sun', () => {
  it('should count the local day of the year from January 1', () => {
    expect(dayOfYear(local(1, 1, 0))).toBe(1);
    expect(dayOfYear(local(3, 20, 23, 59))).toBe(79);
    expect(dayOfYear(local(12, 31, 12))).toBe(365);
  });

  it('should swing the declination between the solstices', () => {
    expect(solarDeclinationDeg(dayOfYear(local(6, 21, 12)))).toBeCloseTo(23.44, 0);
    expect(solarDeclinationDeg(dayOfYear(local(12, 21, 12)))).toBeCloseTo(-23.44, 0);
    expect(Math.abs(solarDeclinationDeg(dayOfYear(local(3, 20, 12))))).toBeLessThan(1.5);
  });

  it('should put the noon sun due south, high in summer and low in winter', () => {
    const summer = solarPosition(local(6, 21, 12));
    const winter = solarPosition(local(12, 21, 12));
    expect(summer.azimuthDeg).toBeCloseTo(180, 5);
    expect(summer.altitudeDeg).toBeCloseTo(90 - SUN_LATITUDE_DEG + 23.44, 0);
    expect(winter.altitudeDeg).toBeCloseTo(90 - SUN_LATITUDE_DEG - 23.44, 0);
  });

  it('should rise in the east around six on the equinox and stay below the horizon at midnight', () => {
    const sunrise = solarPosition(local(3, 20, 6));
    expect(Math.abs(sunrise.altitudeDeg)).toBeLessThan(1.5);
    expect(sunrise.azimuthDeg).toBeGreaterThan(85);
    expect(sunrise.azimuthDeg).toBeLessThan(95);
    expect(solarPosition(local(3, 20, 0)).altitudeDeg).toBeLessThan(-30);
  });

  it('should mirror the morning and the afternoon around noon', () => {
    const morning = solarPosition(local(9, 1, 9));
    const afternoon = solarPosition(local(9, 1, 15));
    expect(morning.altitudeDeg).toBeCloseTo(afternoon.altitudeDeg, 6);
    expect(morning.azimuthDeg).toBeLessThan(180);
    expect(morning.azimuthDeg + afternoon.azimuthDeg).toBeCloseTo(360, 6);
  });
});
