import { render, screen } from '@testing-library/react';

import type { GraphNode } from '../model/types';
import { GraphDetailPanel } from '../ui/graph-detail-panel';

import '@testing-library/jest-dom';

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
    })),
  });
};

const mockNode: GraphNode = {
  id: 'note:test',
  name: 'Test Note',
  type: 'note',
  status: 'seedling',
  linkCount: 3,
  url: '/garden/test',
  description: 'A test note description',
};

const defaultLabels = {
  viewDetail: 'View detail',
  connections: 'connections',
  type: { note: 'Note', post: 'Post', tag: 'Tag', category: 'Category' },
  status: { seedling: 'Seedling', budding: 'Budding', evergreen: 'Evergreen' },
};

describe('GraphDetailPanel', () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  it('open이 false이면 내용을 표시하지 않는다', () => {
    render(<GraphDetailPanel node={mockNode} open={false} onClose={jest.fn()} locale="en" labels={defaultLabels} />);

    expect(screen.queryByText('Test Note')).not.toBeInTheDocument();
  });

  it('open이 true이면 노드 정보를 표시한다', () => {
    render(<GraphDetailPanel node={mockNode} open={true} onClose={jest.fn()} locale="en" labels={defaultLabels} />);

    expect(screen.getByText('Test Note')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
    expect(screen.getByText('Seedling')).toBeInTheDocument();
    expect(screen.getByText('A test note description')).toBeInTheDocument();
  });

  it('연결 수를 표시한다', () => {
    render(<GraphDetailPanel node={mockNode} open={true} onClose={jest.fn()} locale="en" labels={defaultLabels} />);

    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/connections/)).toBeInTheDocument();
  });

  it('자세히 보기 링크에 locale이 포함된다', () => {
    render(<GraphDetailPanel node={mockNode} open={true} onClose={jest.fn()} locale="en" labels={defaultLabels} />);

    const link = screen.getByRole('link', { name: /View detail/i });
    expect(link).toHaveAttribute('href', '/en/garden/test');
  });

  it('url이 없는 노드는 자세히 보기 링크를 표시하지 않는다', () => {
    const tagNode: GraphNode = { ...mockNode, type: 'tag', url: '', status: undefined };

    render(<GraphDetailPanel node={tagNode} open={true} onClose={jest.fn()} locale="en" labels={defaultLabels} />);

    expect(screen.queryByRole('link', { name: /View detail/i })).not.toBeInTheDocument();
  });
});
