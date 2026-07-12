import { describe, expect, it } from 'vitest';

import {
  coverSourceRect,
  createOneEuro,
  luminanceToChar,
  nextPinch,
  pinchDistance,
  remapToScreen,
  saturateChannel,
} from '../components/lattice';

describe('pinchDistance', () => {
  it('should return euclidean distance between two landmarks', () => {
    expect(pinchDistance({ x: 0, y: 0 }, { x: 0.03, y: 0.04 })).toBeCloseTo(0.05);
  });
});

describe('nextPinch', () => {
  it('should start pinching only below the on-ratio', () => {
    expect(nextPinch(false, 0.3)).toBe(true);
    expect(nextPinch(false, 0.4)).toBe(false);
  });

  it('should keep pinching until the off-ratio (hysteresis)', () => {
    expect(nextPinch(true, 0.45)).toBe(true);
    expect(nextPinch(true, 0.55)).toBe(false);
  });
});

describe('luminanceToChar', () => {
  it('should map dark to blank and bright to dense characters', () => {
    expect(luminanceToChar(0)).toBe(' ');
    expect(luminanceToChar(255)).toBe('@');
  });

  it('should map mid luminance to a mid-ramp character', () => {
    expect(luminanceToChar(128)).toBe('+');
  });
});

describe('saturateChannel', () => {
  it('should push channels away from the average and clamp to 0..255', () => {
    expect(saturateChannel(200, 100)).toBe(255);
    expect(saturateChannel(20, 100)).toBe(0);
    expect(saturateChannel(100, 100)).toBe(100);
  });
});

describe('coverSourceRect', () => {
  it('should crop top and bottom when the video is taller than the display box', () => {
    // 4:3 원본을 16:9 박스에 cover — 가로가 기준 스케일이 되고 세로가 잘린다
    expect(coverSourceRect(320, 240, 160, 90)).toEqual({ sx: 0, sy: 30, sw: 320, sh: 180 });
  });

  it('should return the full frame when aspect ratios match', () => {
    expect(coverSourceRect(1920, 1080, 960, 540)).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });
});

describe('createOneEuro', () => {
  it('should pass a constant signal through unchanged', () => {
    const filter = createOneEuro();
    expect(filter(0.5, 0)).toBe(0.5);
    expect(filter(0.5, 16)).toBeCloseTo(0.5);
    expect(filter(0.5, 32)).toBeCloseTo(0.5);
  });

  it('should converge monotonically toward a step input', () => {
    const filter = createOneEuro();
    filter(0, 0);
    let prev = 0;
    for (let i = 1; i <= 60; i++) {
      const next = filter(1, i * 16);
      expect(next).toBeGreaterThan(prev);
      expect(next).toBeLessThanOrEqual(1);
      prev = next;
    }
    expect(prev).toBeGreaterThan(0.9);
  });
});

describe('remapToScreen', () => {
  it('should stretch the camera center region to the full 0..1 range', () => {
    expect(remapToScreen(0.5)).toBeCloseTo(0.5);
    expect(remapToScreen(0.18)).toBeCloseTo(0);
    expect(remapToScreen(0.82)).toBeCloseTo(1);
  });

  it('should clamp values outside the center region', () => {
    expect(remapToScreen(0.05)).toBe(0);
    expect(remapToScreen(0.95)).toBe(1);
  });
});
