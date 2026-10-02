// next.config.mjs의 turbopack.resolveAlias가 `three/webgpu`를 이 모듈로 바꿔 끼운다.
// three-render-objects(react-force-graph-3d 내부)가 WebGPURenderer를 정적 import하지만
// 이 블로그는 useWebGPU를 켜지 않아(기본 false) 실제로는 WebGLRenderer만 쓴다.
// 진짜 three/webgpu(~600KB)를 그래프 lazy 번들에서 빼기 위한 자리표시자다.
// WebGPU를 켜려면 alias부터 지워야 한다 — 조용히 깨지지 않게 생성 시점에 명시적으로 던진다.
// three-render-objects는 `new WebGPURenderer(...)`로 쓰므로 생성자로 호출돼도 같은 에러를 던진다.
export function WebGPURenderer(): never {
  throw new Error(
    '[blog] three/webgpu is stubbed out (next.config.mjs turbopack.resolveAlias). Remove the alias to use WebGPURenderer.'
  );
}
