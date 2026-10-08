import { WebGPURenderer } from '../lib/three-webgpu-stub';

describe('three/webgpu stub', () => {
  it('fails loudly instead of rendering silently when WebGPU is requested', () => {
    expect(() => Reflect.construct(WebGPURenderer, [])).toThrow(/three\/webgpu is stubbed out/);
  });
});
