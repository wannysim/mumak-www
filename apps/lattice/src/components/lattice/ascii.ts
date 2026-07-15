// ascii 존 렌더 코어 — 존 아래 겹친 영상/웹캠 영역만 저해상도로 합성한 뒤
// 밝기를 문자로 치환해 그린다. AsciiPane의 rAF 루프에서 프레임마다 호출한다.
// DOM/컴포넌트에 의존하지 않는 순수 함수라 오프스크린으로도 그대로 돌릴 수 있다.

export const ASCII_CHARS = ' .:-=+*#%@';

export function luminanceToChar(luminance: number) {
  const index = Math.min(ASCII_CHARS.length - 1, Math.floor((luminance / 256) * ASCII_CHARS.length));
  return ASCII_CHARS.charAt(index);
}

// object-fit: cover로 표시된 요소에서 실제로 보이는 원본 픽셀 영역(중앙 크롭)을 구한다
export function coverSourceRect(videoW: number, videoH: number, dispW: number, dispH: number) {
  const scale = Math.max(dispW / videoW, dispH / videoH);
  const sw = dispW / scale;
  const sh = dispH / scale;
  return { sx: (videoW - sw) / 2, sy: (videoH - sh) / 2, sw, sh };
}

// 채도를 끌어올려 컬러 ascii가 원본보다 쨍하게 보이도록 한다
export function saturateChannel(value: number, average: number, factor = 1.8) {
  return Math.max(0, Math.min(255, average + (value - average) * factor));
}

// drawImage 가능한 영상 소스 + 겹침 순서상의 미러 여부.
// HTMLVideoElement에 직접 묶지 않고 필요한 최소 형태(고유 크기·rect·readyState)만
// 요구해, 렌더 코어를 특정 DOM 요소 타입과 분리한다.
export type AsciiTarget = {
  el: {
    readyState: number;
    videoWidth: number;
    videoHeight: number;
    getBoundingClientRect(): {
      left: number;
      top: number;
      right: number;
      bottom: number;
      width: number;
      height: number;
    };
  } & CanvasImageSource;
  mirror: boolean;
};

export type AsciiPaneBox = { x: number; y: number; w: number; h: number };

// 캔버스로 합성 렌더되는 필터 모드. mono/rgb는 문자로, dots는 밝기에 비례한 원으로 그린다.
export type AsciiMode = 'mono' | 'rgb' | 'dots';

// dots 모드 셀 한 변(px). 정사각 셀 중앙에 밝기 비례 반지름의 원을 찍는다.
const DOT_CELL = 8;
const TAU = Math.PI * 2;

export function renderAsciiFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sample: HTMLCanvasElement,
  sampleCtx: CanvasRenderingContext2D,
  pane: AsciiPaneBox,
  targets: AsciiTarget[],
  mode: AsciiMode,
  fontSize = 10
) {
  const { x: px, y: py, w: pw, h: ph } = pane;
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  // 셀 격자: 문자 모드는 monospace 글자폭 x fontSize, dots는 정사각 DOT_CELL.
  let cellW: number;
  let cellH: number;
  if (mode === 'dots') {
    cellW = DOT_CELL;
    cellH = DOT_CELL;
  } else {
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';
    cellW = ctx.measureText('@').width;
    cellH = fontSize;
  }
  const cols = Math.max(1, Math.floor(pw / cellW));
  const rows = Math.max(1, Math.floor(ph / cellH));
  if (sample.width !== cols || sample.height !== rows) {
    sample.width = cols;
    sample.height = rows;
  }
  sampleCtx.fillStyle = '#000';
  sampleCtx.fillRect(0, 0, cols, rows);

  let drew = false;
  for (const target of targets) {
    const el = target.el;
    if (!el || el.readyState < 2 || !el.videoWidth) continue;
    const r = el.getBoundingClientRect();
    const ix = Math.max(px, r.left);
    const iy = Math.max(py, r.top);
    const iw = Math.min(px + pw, r.right) - ix;
    const ih = Math.min(py + ph, r.bottom) - iy;
    if (iw <= 0 || ih <= 0) continue;
    const src = coverSourceRect(el.videoWidth, el.videoHeight, r.width, r.height);
    const sx = src.sx + ((ix - r.left) / r.width) * src.sw;
    const sw = (iw / r.width) * src.sw;
    const sh = (ih / r.height) * src.sh;
    const sy = src.sy + ((iy - r.top) / r.height) * src.sh;
    const dx = ((ix - px) / pw) * cols;
    const dy = ((iy - py) / ph) * rows;
    const dw = (iw / pw) * cols;
    const dh = (ih / ph) * rows;
    try {
      if (target.mirror) {
        // 셀피 프리뷰는 -scale-x로 미러링돼 있으므로 소스/대상 x를 함께 뒤집는다
        sampleCtx.save();
        sampleCtx.scale(-1, 1);
        sampleCtx.drawImage(el, el.videoWidth - sx - sw, sy, sw, sh, -dx - dw, dy, dw, dh);
        sampleCtx.restore();
      } else {
        sampleCtx.drawImage(el, sx, sy, sw, sh, dx, dy, dw, dh);
      }
      drew = true;
    } catch {
      // CORS taint 등 — 해당 영상만 건너뛴다
    }
  }

  // 존이 어떤 영상과도 겹치지 않으면 결과는 전부 검정(공백)이다. 비싼 getImageData
  // 읽기와 cols*rows 셀 루프를 건너뛰고 캔버스만 검정으로 지운다. shuffle 등으로
  // 빈 영역에 놓인 존이 많을수록 절약이 커진다.
  if (!drew) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, pw, ph);
    return;
  }

  let data: Uint8ClampedArray;
  try {
    data = sampleCtx.getImageData(0, 0, cols, rows).data;
  } catch {
    return;
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, pw, ph);

  if (mode === 'dots') {
    // 밝기 → 반지름의 흰 원. 전부 같은 색이라 서브패스를 한 path에 모아 한 번만 fill한다
    // (셀마다 beginPath/fill 하는 것보다 훨씬 싸다).
    const maxR = cellH / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    for (let r = 0; r < rows; r++) {
      const cy = r * cellH + maxR;
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        const lum = 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
        const radius = (lum / 255) * maxR;
        if (radius < 0.35) continue; // 너무 어두운 셀은 비워 검정 배경을 남긴다
        const cx = c * cellW + maxR;
        ctx.moveTo(cx + radius, cy); // arc 앞 moveTo로 서브패스 간 연결선 방지
        ctx.arc(cx, cy, radius, 0, TAU);
      }
    }
    ctx.fill();
    return;
  }

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let r = 0; r < rows; r++) {
    if (mode === 'rgb') {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        const red = data[i] ?? 0;
        const green = data[i + 1] ?? 0;
        const blue = data[i + 2] ?? 0;
        const char = luminanceToChar(0.2126 * red + 0.7152 * green + 0.0722 * blue);
        if (char === ' ') continue;
        const avg = (red + green + blue) / 3;
        // 정수 채널로 rgb() 문자열을 만든다 — 셀마다 실행되는 CSS 컬러 파서 비용을 줄인다.
        // 캔버스 백스토어가 8bit라 float은 어차피 반올림돼 그려지므로 Math.round는 픽셀 동일.
        ctx.fillStyle = `rgb(${Math.round(saturateChannel(red, avg))},${Math.round(saturateChannel(green, avg))},${Math.round(saturateChannel(blue, avg))})`;
        ctx.fillText(char, c * cellW, r * cellH);
      }
    } else {
      let line = '';
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        line += luminanceToChar(0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0));
      }
      ctx.fillText(line, 0, r * cellH);
    }
  }
}
