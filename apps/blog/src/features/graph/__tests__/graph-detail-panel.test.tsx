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
  description: 'Node detail panel',
  close: 'Close',
  viewDetail: 'View detail',
  connections: 'connections',
  type: { note: 'Note', post: 'Post', tag: 'Tag', category: 'Category' },
  status: { seedling: 'Seedling', budding: 'Budding', evergreen: 'Evergreen' },
  category: { essay: 'Essay' },
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

  it('패널 설명과 닫기 문구를 labels에서 가져온다', () => {
    const koLabels = { ...defaultLabels, description: '노드 상세 패널', close: '닫기' };

    render(<GraphDetailPanel node={mockNode} open={true} onClose={jest.fn()} locale="ko" labels={koLabels} />);

    expect(screen.getByText('노드 상세 패널')).toBeInTheDocument();
    expect(screen.getByText('닫기')).toBeInTheDocument();
    expect(screen.queryByText('Node detail panel')).not.toBeInTheDocument();
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

  it('node가 null이면 빈 상태로 렌더된다', () => {
    render(<GraphDetailPanel node={null} open={true} onClose={jest.fn()} locale="en" labels={defaultLabels} />);

    expect(screen.queryByText('Test Note')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /View detail/i })).not.toBeInTheDocument();
  });

  it('category badge는 슬러그가 아니라 지역화된 분류 문구를 쓴다', () => {
    const nodeWithCategory: GraphNode = { ...mockNode, category: 'essay' };
    const koLabels = { ...defaultLabels, category: { essay: '에세이' } };

    render(<GraphDetailPanel node={nodeWithCategory} open={true} onClose={jest.fn()} locale="ko" labels={koLabels} />);

    expect(screen.getByText('에세이')).toBeInTheDocument();
    expect(screen.queryByText('essay')).not.toBeInTheDocument();
  });

  it('labels에 없는 category는 슬러그를 그대로 노출한다', () => {
    const nodeWithCategory: GraphNode = { ...mockNode, category: 'projects' };

    render(
      <GraphDetailPanel node={nodeWithCategory} open={true} onClose={jest.fn()} locale="en" labels={defaultLabels} />
    );

    expect(screen.getByText('projects')).toBeInTheDocument();
  });

  it('description이 없으면 description 영역이 없다', () => {
    const nodeWithoutDesc: GraphNode = { ...mockNode, description: undefined };

    render(
      <GraphDetailPanel node={nodeWithoutDesc} open={true} onClose={jest.fn()} locale="en" labels={defaultLabels} />
    );

    expect(screen.queryByText('A test note description')).not.toBeInTheDocument();
  });

  it('budding 노드는 secondary variant 배지를 사용한다', () => {
    const budding: GraphNode = { ...mockNode, status: 'budding' };

    render(<GraphDetailPanel node={budding} open={true} onClose={jest.fn()} locale="en" labels={defaultLabels} />);

    expect(screen.getByText('Budding')).toBeInTheDocument();
  });

  it('evergreen 노드는 default variant 배지를 사용한다', () => {
    const evergreen: GraphNode = { ...mockNode, status: 'evergreen' };

    render(<GraphDetailPanel node={evergreen} open={true} onClose={jest.fn()} locale="en" labels={defaultLabels} />);

    expect(screen.getByText('Evergreen')).toBeInTheDocument();
  });

  describe('mobile viewport (Drawer)', () => {
    beforeEach(() => {
      mockMatchMedia(false);
    });

    it('open이 true이면 노드 정보를 Drawer에 렌더한다', () => {
      render(<GraphDetailPanel node={mockNode} open={true} onClose={jest.fn()} locale="en" labels={defaultLabels} />);

      expect(screen.getByText('Test Note')).toBeInTheDocument();
      expect(screen.getByText('Note')).toBeInTheDocument();
    });

    it('Drawer도 설명·닫기 문구를 labels에서 가져온다', () => {
      const koLabels = { ...defaultLabels, description: '노드 상세 패널', close: '닫기' };

      render(<GraphDetailPanel node={mockNode} open={true} onClose={jest.fn()} locale="ko" labels={koLabels} />);

      expect(screen.getByText('노드 상세 패널')).toBeInTheDocument();
      expect(screen.getByText('닫기')).toBeInTheDocument();
    });

    it('open이 false이면 Drawer는 렌더되지 않는다', () => {
      render(<GraphDetailPanel node={mockNode} open={false} onClose={jest.fn()} locale="en" labels={defaultLabels} />);

      expect(screen.queryByText('Test Note')).not.toBeInTheDocument();
    });
  });
});
