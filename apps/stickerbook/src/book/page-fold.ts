import type { PaperGrip } from '@/lib/interaction';

type Point = { x: number; y: number };
type Matrix = [number, number, number, number, number, number];
type FoldPiece = { face: 'front' | 'back'; clip: string; matrix: Matrix; shade: number; shading?: string };

// Clip in page coordinates, before applying the transform. Page contents keep
// their real CSS width and font metrics, including container-query units.
function clipPolygon(points: Point[], nx: number, ny: number, limit: number, below: boolean) {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const da = a.x * nx + a.y * ny - limit;
    const db = b.x * nx + b.y * ny - limit;
    const insideA = below ? da <= 0 : da >= 0;
    const insideB = below ? db <= 0 : db >= 0;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = da / (da - db);
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return result;
}

export function pageFold(width: number, height: number, progress: number, direction: -1 | 1, grip: PaperGrip) {
  const p = Math.max(0, Math.min(1, progress));
  const tilt = Math.max(-0.75, Math.min(0.75, (grip.y - 0.5) * 1.3 + grip.pullY * 0.9)) * (1 - p);
  const nx = Math.cos(tilt);
  const ny = Math.sin(tilt);
  const spineDistance = Math.max(0, nx * width - (p * width) / nx);
  const crease = spineDistance + Math.max(0, ny * height);
  const radius = Math.min(0.085 * width * Math.sin(Math.PI * p), spineDistance * 0.65);
  const rectangle = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const pieces: FoldPiece[] = [];
  function add(
    low: number,
    high: number,
    slope: number,
    intercept: number,
    shade: number,
    edgeShades?: [number, number]
  ) {
    let polygon = clipPolygon(rectangle, nx, ny, crease + high, true);
    polygon = clipPolygon(polygon, nx, ny, crease + low, false);
    if (polygon.length < 3) return;
    const face = slope >= 0 ? 'front' : 'back';
    // Canonical coordinates run from spine to outer edge. Reverse-side content
    // has opposite intrinsic x coordinates, so its letters remain upright.
    const mirror = (face === 'front') !== (direction === 1);
    const localSign = mirror ? -1 : 1;
    const localOffset = mirror ? width : 0;
    const a = 1 + (slope - 1) * nx * nx;
    const b = (slope - 1) * nx * ny;
    const d = 1 + (slope - 1) * ny * ny;
    const shift = intercept + (1 - slope) * crease;
    const matrix: Matrix = [
      direction * a * localSign,
      b * localSign,
      direction * b,
      d,
      direction * (a * localOffset + shift * nx),
      b * localOffset + shift * ny,
    ];
    const clip = `polygon(${polygon.map(point => `${mirror ? width - point.x : point.x}px ${point.y}px`).join(',')})`;
    // A continuous gradient across each band avoids visible brightness steps.
    const gradientX = nx * localSign;
    const minimum = Math.min(0, gradientX * width) + Math.min(0, ny * height);
    const offset = crease - nx * localOffset - minimum;
    const angle = (Math.atan2(gradientX, -ny) * 180) / Math.PI;
    const shading = edgeShades
      ? `linear-gradient(${angle}deg, rgb(0 0 0 / ${edgeShades[0]}) ${offset + low}px, rgb(0 0 0 / ${edgeShades[1]}) ${offset + high}px)`
      : undefined;
    pieces.push({ face, clip, matrix, shade, shading });
  }
  const extent = width + height + 1;
  if (p === 0) {
    add(-extent, extent, 1, 0, 0);
  } else if (p === 1) {
    add(-extent, extent, -1, 0, 0);
  } else {
    add(-extent, -radius, 1, 0, 0);
    // Only the narrow curl is compressed; the two flat faces remain full-size.
    // Twelve affine bands approximate an orthographic half-cylinder.
    const bands = 12;
    const project = (distance: number) =>
      -radius + ((2 * radius) / Math.PI) * Math.sin(((distance + radius) / (2 * radius)) * Math.PI);
    if (radius > 0.001) {
      for (let i = 0; i < bands; i++) {
        const low = -radius + (2 * radius * i) / bands;
        const high = -radius + (2 * radius * (i + 1)) / bands;
        const slope = (project(high) - project(low)) / (high - low);
        // Subpixel overlap prevents hairline gaps between clipped bands.
        add(low - 0.3, high + 0.3, slope, project(low) - slope * low, Math.sin((Math.PI * (i + 0.5)) / bands) * 0.16, [
          Math.sin((Math.PI * i) / bands) * 0.16,
          Math.sin((Math.PI * (i + 1)) / bands) * 0.16,
        ]);
      }
    }
    add(radius, extent, -1, 0, 0);
  }
  return pieces;
}
