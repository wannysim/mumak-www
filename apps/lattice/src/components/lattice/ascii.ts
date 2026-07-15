// ascii 존 렌더 코어 — 존 아래 겹친 영상/웹캠 영역만 저해상도로 합성한 뒤
// 밝기를 문자로 치환해 그린다. lattice.tsx의 AsciiPane rAF 루프와
// bench 하니스가 공유하는 단일 소스.

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
// 프로덕션은 HTMLVideoElement, bench는 videoWidth/videoHeight/readyState를
// 흉내낸 canvas를 넘긴다 (실제 grBCR·drawImage 비용을 그대로 측정하기 위함).
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

export function renderAsciiFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sample: HTMLCanvasElement,
  sampleCtx: CanvasRenderingContext2D,
  pane: AsciiPaneBox,
  targets: AsciiTarget[],
  colored: boolean,
  fontSize = 10
) {
  const { x: px, y: py, w: pw, h: ph } = pane;
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = 'top';
  const cols = Math.max(1, Math.floor(pw / ctx.measureText('@').width));
  const rows = Math.max(1, Math.floor(ph / fontSize));
  if (sample.width !== cols || sample.height !== rows) {
    sample.width = cols;
    sample.height = rows;
  }
  sampleCtx.fillStyle = '#000';
  sampleCtx.fillRect(0, 0, cols, rows);

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
    } catch {
      // CORS taint 등 — 해당 영상만 건너뛴다
    }
  }

  let data: Uint8ClampedArray;
  try {
    data = sampleCtx.getImageData(0, 0, cols, rows).data;
  } catch {
    return;
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, pw, ph);
  const charW = ctx.measureText('@').width;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let r = 0; r < rows; r++) {
    if (colored) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        const red = data[i] ?? 0;
        const green = data[i + 1] ?? 0;
        const blue = data[i + 2] ?? 0;
        const char = luminanceToChar(0.2126 * red + 0.7152 * green + 0.0722 * blue);
        if (char === ' ') continue;
        const avg = (red + green + blue) / 3;
        ctx.fillStyle = `rgb(${saturateChannel(red, avg)},${saturateChannel(green, avg)},${saturateChannel(blue, avg)})`;
        ctx.fillText(char, c * charW, r * fontSize);
      }
    } else {
      let line = '';
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 4;
        line += luminanceToChar(0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0));
      }
      ctx.fillText(line, 0, r * fontSize);
    }
  }
}
