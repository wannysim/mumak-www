/**
 * "이 곡이 얼마나 쎈가"를 0~1 로 추정한다.
 * 실제 오디오 분석(audio-features)은 신규 앱에 막혀 있어, 대신 우리가 받을 수 있는 신호
 * (앨범 아트 색감 + 기기 볼륨 + 장르)를 합쳐 mood 기반 energy 를 만든다.
 */

import type { Palette } from '@/lib/color/palette';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16) || 0,
    g: parseInt(normalized.slice(2, 4), 16) || 0,
    b: parseInt(normalized.slice(4, 6), 16) || 0,
  };
}

function saturation({ r, g, b }: Rgb): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function distance(a: Rgb, b: Rgb): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/** 앨범 아트의 채도(가장 vivid 한 색) + 색 다양성(colorfulness)으로 0~1. */
export function colorEnergy(palette: Palette): number {
  const colors = palette.swatches.map(hexToRgb);
  if (colors.length === 0) {
    return 0.4;
  }

  const maxSaturation = Math.max(...colors.map(saturation));

  let maxPairDistance = 0;
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      maxPairDistance = Math.max(maxPairDistance, distance(colors[i]!, colors[j]!));
    }
  }
  const colorfulness = clamp01(maxPairDistance / 300);

  return clamp01(0.6 * maxSaturation + 0.4 * colorfulness);
}

const HIGH_ENERGY_GENRES = [
  'edm',
  'techno',
  'house',
  'trance',
  'dubstep',
  'drum and bass',
  'dnb',
  'hardcore',
  'metal',
  'rock',
  'punk',
  'trap',
  'rap',
  'hip hop',
  'dance',
  'electro',
  'hyperpop',
  'k-pop',
  'rave',
  'bass',
];

const LOW_ENERGY_GENRES = [
  'ambient',
  'acoustic',
  'classical',
  'piano',
  'jazz',
  'lo-fi',
  'lofi',
  'sleep',
  'meditation',
  'folk',
  'singer-songwriter',
  'chill',
  'ballad',
  'soundtrack',
  'new age',
];

/** 장르 키워드로 0~1 (모르면 중립 0.5). */
export function genreEnergy(genres: string[]): number {
  if (genres.length === 0) {
    return 0.5;
  }
  const matches = (keywords: string[]) => genres.some(genre => keywords.some(keyword => genre.includes(keyword)));
  const high = matches(HIGH_ENERGY_GENRES);
  const low = matches(LOW_ENERGY_GENRES);

  if (high && !low) {
    return 0.85;
  }
  if (low && !high) {
    return 0.2;
  }
  return 0.5;
}

export interface EnergyInputs {
  palette: Palette;
  volumePercent: number | null;
  genres: string[];
  isExplicit: boolean;
}

/** 색(0.45) + 볼륨(0.30) + 장르(0.20) + explicit(0.05) 가중 합. */
export function computeEnergy({ palette, volumePercent, genres, isExplicit }: EnergyInputs): number {
  const volume = volumePercent == null ? 0.5 : volumePercent / 100;
  return clamp01(0.45 * colorEnergy(palette) + 0.3 * volume + 0.2 * genreEnergy(genres) + (isExplicit ? 0.05 : 0));
}
