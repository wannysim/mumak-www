/**
 * 앨범 아트에서 대표 색을 추출한다.
 * 외부 라이브러리 없이 canvas 다운샘플 + 색 양자화로 dominant/accent/muted 를 뽑는다.
 */

export interface Palette {
  /** 가장 넓은 면적을 차지하는 색. */
  dominant: string;
  /** 채도 높은 강조색(블롭/액센트용). */
  accent: string;
  /** dominant 를 어둡게 깐 배경 베이스. */
  base: string;
  /** dominant 위에 얹는 가독 텍스트 색. */
  foreground: string;
  /** mesh 그라데이션용 대표색 모음(최대 5색, 충분히 다른 색끼리). */
  swatches: string[];
  /** 전체 톤이 어두운지. */
  isDark: boolean;
}

/** SSR/추출 실패 시 쓰는 중립 팔레트. */
export const NEUTRAL_PALETTE: Palette = {
  dominant: '#3f3f46',
  accent: '#a1a1aa',
  base: '#18181b',
  foreground: '#fafafa',
  swatches: ['#3f3f46', '#52525b', '#27272a', '#71717a'],
  isDark: true,
};

const MAX_SWATCHES = 5;
/** 두 색이 "다른 색"으로 인정되는 최소 RGB 거리. 너무 비슷하면 mesh 가 단조로워진다. */
const MIN_SWATCH_DISTANCE = 48;

interface Sample {
  r: number;
  g: number;
  b: number;
  count: number;
}

function colorDistance(a: Sample, b: Sample): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/** 점수(면적×채도) 순으로 정렬한 뒤, 서로 충분히 다른 색만 골라 mesh 스와치를 만든다. */
function pickSwatches(entries: Sample[]): string[] {
  const ranked = [...entries].toSorted((a, b) => {
    const scoreA = a.count * (0.3 + saturation(a.r, a.g, a.b));
    const scoreB = b.count * (0.3 + saturation(b.r, b.g, b.b));
    return scoreB - scoreA;
  });

  const picked: Sample[] = [];
  for (const sample of ranked) {
    if (picked.length >= MAX_SWATCHES) {
      break;
    }
    if (picked.every(p => colorDistance(p, sample) >= MIN_SWATCH_DISTANCE)) {
      picked.push(sample);
    }
  }

  return picked.map(s => toHex(s.r, s.g, s.b));
}

interface Bucket {
  count: number;
  r: number;
  g: number;
  b: number;
}

function toHex(r: number, g: number, b: number): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** 상대 휘도 (0~1). 0.5 미만이면 어두운 색. */
function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** HSV 채도 근사 (0~1). */
function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function scale(r: number, g: number, b: number, factor: number): [number, number, number] {
  return [Math.min(255, r * factor), Math.min(255, g * factor), Math.min(255, b * factor)];
}

/**
 * 이미지를 작은 canvas 에 그려 색 분포를 양자화한다.
 * @throws canvas tainted(CORS 실패) 시 getImageData 가 던진다 → 호출부에서 catch.
 */
export function extractPalette(image: HTMLImageElement): Palette {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return NEUTRAL_PALETTE;
  }

  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<number, Bucket>();
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0;
    if (alpha < 125) {
      continue;
    }
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    // 채널당 4비트로 양자화(16단계)해 비슷한 색을 한 버킷으로 묶는다.
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  if (buckets.size === 0) {
    return NEUTRAL_PALETTE;
  }

  const entries = Array.from(buckets.values()).map(bucket => ({
    r: bucket.r / bucket.count,
    g: bucket.g / bucket.count,
    b: bucket.b / bucket.count,
    count: bucket.count,
  }));

  // dominant: 가장 면적이 넓은 색
  const dominant = entries.reduce((best, current) => (current.count > best.count ? current : best));

  // accent: 면적 × 채도 가중으로 가장 "생생한" 색. 없으면 dominant 로 폴백.
  const accent = entries.reduce((best, current) => {
    const score = current.count * (0.2 + saturation(current.r, current.g, current.b));
    const bestScore = best.count * (0.2 + saturation(best.r, best.g, best.b));
    return score > bestScore ? current : best;
  });

  const dominantLum = luminance(dominant.r, dominant.g, dominant.b);
  const isDark = dominantLum < 0.5;

  const [br, bg, bb] = scale(dominant.r, dominant.g, dominant.b, isDark ? 0.45 : 0.3);

  const dominantHex = toHex(dominant.r, dominant.g, dominant.b);
  const accentHex = toHex(accent.r, accent.g, accent.b);
  const swatches = pickSwatches(entries);

  return {
    dominant: dominantHex,
    accent: accentHex,
    base: toHex(br, bg, bb),
    foreground: dominantLum < 0.55 ? '#fafafa' : '#0a0a0a',
    // 단색 커버라 스와치가 빈약하면 dominant/accent 로 최소 보장.
    swatches: swatches.length >= 2 ? swatches : [dominantHex, accentHex],
    isDark,
  };
}
