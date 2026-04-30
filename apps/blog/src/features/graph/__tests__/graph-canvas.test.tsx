import { render, screen, waitFor } from '@testing-library/react';

import type { GraphData } from '../model/types';
import { GraphCanvas } from '../ui/graph-canvas';

import '@testing-library/jest-dom';

jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

jest.mock('lucide-react', () => ({
  MonitorIcon: (props: Record<string, unknown>) => <svg data-testid="monitor-icon" {...props} />,
}));

const mockData: GraphData = {
  nodes: [
    { id: 'note:a', name: 'Note A', type: 'note', status: 'seedling', linkCount: 1, url: '/garden/a' },
    { id: 'tag:react', name: 'react', type: 'tag', linkCount: 1, url: '' },
  ],
  links: [{ source: 'note:a', target: 'tag:react', type: 'tag' }],
};

const unsupportedLabels = {
  title: '이 기기에서 3D 그래프를 볼 수 없습니다',
  description: 'WebGPU를 지원하는 데스크톱 브라우저에서 확인해 주세요.',
};

describe('GraphCanvas', () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'GPUShaderStage');

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'GPUShaderStage', originalDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'GPUShaderStage');
    }
  });

  it('WebGPU 미지원 환경에서 fallback 메시지를 표시한다', async () => {
    Reflect.deleteProperty(globalThis, 'GPUShaderStage');

    render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} />);

    await waitFor(() => {
      expect(screen.getByText(unsupportedLabels.title)).toBeInTheDocument();
    });
    expect(screen.getByText(unsupportedLabels.description)).toBeInTheDocument();
  });

  it('WebGPU 미지원 환경에서 MonitorIcon을 렌더링한다', async () => {
    Reflect.deleteProperty(globalThis, 'GPUShaderStage');

    render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} />);

    await waitFor(() => {
      expect(screen.getByTestId('monitor-icon')).toBeInTheDocument();
    });
  });

  it('dynamic import 실패 시 fallback 메시지를 표시한다', async () => {
    Object.defineProperty(globalThis, 'GPUShaderStage', {
      value: { VERTEX: 0x1, FRAGMENT: 0x2, COMPUTE: 0x4 },
      writable: true,
      configurable: true,
    });

    jest.mock('react-force-graph-3d', () => {
      throw new Error('Module load failed');
    });

    render(<GraphCanvas data={mockData} unsupportedLabels={unsupportedLabels} />);

    await waitFor(() => {
      expect(screen.getByText(unsupportedLabels.title)).toBeInTheDocument();
    });
  });
});
