// 패널 3: 2D 캔버스를 WebGL2 텍스처로 올려 화면 정렬 사각형에 그린다.
// 근거: tech-research.md 1장(텍스처 해상도 = 쪽 CSS 크기 × 실제 DPR, px을 clip 좌표로 바로 매핑해 텍셀:픽셀 1:1),
// 같은 장 최대 텍스처 크기 예외, 0장(WebGL2가 유일한 기본 렌더 경로). 하네스라 대체 경로는 두지 않는다.

import { pixelRectToClipQuad, type Size } from './raster-math';

export type TextureFilter = 'nearest' | 'linear';

/** 업로드 설정. 2D 캔버스는 내부가 premultiplied라 그대로 올리고, 둘 다 sRGB라 색 공간 변환은 끈다. */
export const UNPACK_SETTINGS = {
  UNPACK_FLIP_Y_WEBGL: false,
  UNPACK_PREMULTIPLY_ALPHA_WEBGL: true,
  UNPACK_COLORSPACE_CONVERSION_WEBGL: 'NONE',
} as const;

/** 쪽이 불투명이라 alpha:false. preserveDrawingBuffer는 운영과 같게 끄고, 읽을 때는 같은 작업 안에서 다시 그린다. */
const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  powerPreference: 'default',
};

type WebglEnvironment = {
  version: string;
  shadingLanguageVersion: string;
  vendor: string;
  renderer: string;
  unmaskedVendor: string | null;
  unmaskedRenderer: string | null;
  maxTextureSize: number;
  maxRenderbufferSize: number;
  maxViewportDims: string;
  contextAttributes: WebGLContextAttributes | null;
};

type WebglTexturePanel = {
  readonly canvas: HTMLCanvasElement;
  readonly environment: WebglEnvironment;
  setBackingSize(size: Size): void;
  /** 컨텍스트 손실 중에는 0×0이다. */
  drawingBufferSize(): Size;
  /** 컨텍스트 손실 중이거나 아직 안 올렸으면 null. */
  textureSize(): Size | null;
  isContextLost(): boolean;
  upload(source: HTMLCanvasElement, finish: boolean): void;
  setFilter(filter: TextureFilter): void;
  draw(): void;
  /** 다시 그린 직후 같은 작업 안에서 읽는다. 행 순서는 아래에서 위. */
  readPixels(): Uint8Array;
};

export type WebglPanelResult = { ok: true; panel: WebglTexturePanel } | { ok: false; reason: string };

export type WebglPanelHooks = {
  log: (message: string) => void;
  /** 복구 때 다시 올릴 현재 원본. 손실 중에 새 래스터가 반영됐을 수 있어서 패널이 옛 원본을 들고 있지 않는다. */
  currentSource: () => HTMLCanvasElement | null;
  /** 복구해서 다시 그린 뒤 부른다(표·돋보기 갱신). */
  onRestored: () => void;
};

type GpuResources = {
  program: WebGLProgram;
  vertexArray: WebGLVertexArrayObject;
  vertexBuffer: WebGLBuffer;
  texture: WebGLTexture;
  samplerLocation: WebGLUniformLocation | null;
};

const VERTEX_SOURCE = `#version 300 es
layout(location = 0) in vec2 a_clip;
layout(location = 1) in vec2 a_uv;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_clip, 0.0, 1.0);
}`;

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D u_page;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  fragColor = texture(u_page, v_uv);
}`;

const FLOATS_PER_VERTEX = 4;
const BYTES_PER_FLOAT = 4;

export function createWebglTexturePanel(canvas: HTMLCanvasElement, hooks: WebglPanelHooks): WebglPanelResult {
  const { log } = hooks;
  const createdContext = canvas.getContext('webgl2', CONTEXT_ATTRIBUTES);
  if (!createdContext) {
    return {
      ok: false,
      reason: 'WebGL2 컨텍스트 생성 실패(getContext("webgl2")가 null). 하네스라 대체 경로는 없다.',
    };
  }
  // 아래 함수 선언은 호이스팅되어 좁힌 타입을 못 본다. null이 아닌 타입으로 다시 묶는다.
  const gl: WebGL2RenderingContext = createdContext;

  let resources: GpuResources | null;
  try {
    resources = createGpuResources(gl);
  } catch (error) {
    return { ok: false, reason: `WebGL2 자원 준비 실패: ${String(error)}` };
  }

  const environment = readEnvironment(gl);
  let filter: TextureFilter = 'linear';
  let uploadedSize: Size | null = null;

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    resources = null;
    uploadedSize = null;
    log('webglcontextlost: 그리기 중지. 복구 이벤트를 기다린다.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      resources = createGpuResources(gl);
      applyFilter(resources);
      const source = hooks.currentSource();
      if (source) upload(source, false);
      draw();
      log(
        source
          ? `webglcontextrestored: 셰이더·텍스처를 다시 만들고 현재 래스터 ${source.width}×${source.height}를 다시 올렸다.`
          : 'webglcontextrestored: 셰이더를 다시 만들었다. 올릴 래스터가 아직 없다.'
      );
    } catch (error) {
      log(`webglcontextrestored 뒤 복구 실패: ${String(error)}`);
    }
    hooks.onRestored();
  });

  function applyFilter(current: GpuResources): void {
    const value = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
    gl.bindTexture(gl.TEXTURE_2D, current.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, value);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, value);
  }

  function upload(source: HTMLCanvasElement, finish: boolean): void {
    if (!resources) throw new Error('컨텍스트 손실 중이라 업로드하지 않는다');
    const limit = environment.maxTextureSize;
    if (source.width > limit || source.height > limit) {
      throw new Error(`텍스처 ${source.width}×${source.height}가 MAX_TEXTURE_SIZE ${limit}를 넘는다`);
    }
    gl.bindTexture(gl.TEXTURE_2D, resources.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, UNPACK_SETTINGS.UNPACK_FLIP_Y_WEBGL);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, UNPACK_SETTINGS.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    applyFilter(resources);
    if (finish) gl.finish();
    uploadedSize = { width: source.width, height: source.height };
  }

  function draw(): void {
    const buffer = drawingBufferSize();
    gl.viewport(0, 0, buffer.width, buffer.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!resources || !uploadedSize) return;
    // 이 캔버스 전체가 시험 쪽 한 장이다. 쪽 사각형(기기 px)을 clip 좌표로 바로 옮긴다.
    const quad = pixelRectToClipQuad({ x: 0, y: 0, width: buffer.width, height: buffer.height }, buffer);
    gl.useProgram(resources.program);
    gl.bindVertexArray(resources.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, quad);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, resources.texture);
    gl.uniform1i(resources.samplerLocation, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  function drawingBufferSize(): Size {
    return { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight };
  }

  const panel: WebglTexturePanel = {
    canvas,
    environment,
    setBackingSize(size) {
      if (canvas.width !== size.width) canvas.width = size.width;
      if (canvas.height !== size.height) canvas.height = size.height;
    },
    drawingBufferSize,
    textureSize: () => uploadedSize,
    isContextLost: () => gl.isContextLost(),
    upload,
    setFilter(next) {
      filter = next;
      if (resources) applyFilter(resources);
    },
    draw,
    readPixels() {
      draw();
      const size = drawingBufferSize();
      const pixels = new Uint8Array(size.width * size.height * 4);
      gl.readPixels(0, 0, size.width, size.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    },
  };
  return { ok: true, panel };
}

function createGpuResources(gl: WebGL2RenderingContext): GpuResources {
  const program = linkProgram(gl);
  const vertexArray = gl.createVertexArray();
  const vertexBuffer = gl.createBuffer();
  const texture = gl.createTexture();

  gl.bindVertexArray(vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, 4 * FLOATS_PER_VERTEX * BYTES_PER_FLOAT, gl.DYNAMIC_DRAW);
  const stride = FLOATS_PER_VERTEX * BYTES_PER_FLOAT;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 2 * BYTES_PER_FLOAT);
  gl.bindVertexArray(null);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return {
    program,
    vertexArray,
    vertexBuffer,
    texture,
    samplerLocation: gl.getUniformLocation(program, 'u_page'),
  };
}

function linkProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? '';
    gl.deleteProgram(program);
    throw new Error(`프로그램 링크 실패: ${info}`);
  }
  return program;
}

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('셰이더를 만들 수 없다');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? '';
    gl.deleteShader(shader);
    throw new Error(`셰이더 컴파일 실패: ${info}`);
  }
  return shader;
}

function readEnvironment(gl: WebGL2RenderingContext): WebglEnvironment {
  // Firefox는 이 확장을 deprecated로 경고하고 RENDERER에 같은 값을 준다. 없으면 null로 남긴다.
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const viewportDims: unknown = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  return {
    version: String(gl.getParameter(gl.VERSION)),
    shadingLanguageVersion: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
    vendor: String(gl.getParameter(gl.VENDOR)),
    renderer: String(gl.getParameter(gl.RENDERER)),
    unmaskedVendor: debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)) : null,
    unmaskedRenderer: debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : null,
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    maxRenderbufferSize: Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)),
    maxViewportDims: viewportDims instanceof Int32Array ? Array.from(viewportDims).join('×') : String(viewportDims),
    contextAttributes: gl.getContextAttributes(),
  };
}
