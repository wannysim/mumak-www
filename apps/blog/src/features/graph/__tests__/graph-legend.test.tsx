import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getNoteColor, getTagColor } from '../lib/graph-config';
import type { GraphNode } from '../model/types';
import { GraphLegend } from '../ui/graph-legend';

import '@testing-library/jest-dom';

const mockUseTheme = jest.fn(() => ({ resolvedTheme: 'light' }) as { resolvedTheme: 'light' | 'dark' });

jest.mock('next-themes', () => ({
  useTheme: () => mockUseTheme(),
}));

const node = (partial: Partial<GraphNode> & Pick<GraphNode, 'type'>): GraphNode => ({
  id: 'x',
  name: 'x',
  linkCount: 0,
  url: '',
  ...partial,
});

const nodes = [node({ type: 'note', status: 'seedling' }), node({ type: 'tag' })];

const labels = {
  title: 'Legend',
  hint: 'Click a node to see its details',
  dismissHint: 'Dismiss hint',
  sizeNote: 'Node size scales with connections',
  items: { 'status:seedling': 'Seedling', 'type:tag': 'Tag' },
};

const renderLegend = (overrides: Partial<React.ComponentProps<typeof GraphLegend>> = {}) =>
  render(<GraphLegend nodes={nodes} showHint={false} onDismissHint={jest.fn()} labels={labels} {...overrides} />);

describe('GraphLegend', () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({ resolvedTheme: 'light' });
  });

  it('접근 가능한 이름을 가진 complementary landmark로 렌더된다', () => {
    renderLegend();

    expect(screen.getByRole('complementary', { name: 'Legend' })).toBeInTheDocument();
  });

  it('렌더된 노드에서 파생한 행을 지역화 라벨로 보여준다', () => {
    renderLegend();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Seedling');
    expect(items[1]).toHaveTextContent('Tag');
  });

  it('라벨이 없는 키는 raw 키로 폴백하고 크래시하지 않는다', () => {
    renderLegend({ nodes: [node({ type: 'post', category: 'zines' })] });

    expect(screen.getByRole('listitem')).toHaveTextContent('category:zines');
  });

  it('스와치 색이 캔버스 팔레트와 일치하고 테마에 따라 바뀐다', () => {
    const { container, rerender } = renderLegend();

    const swatches = () => container.querySelectorAll<HTMLElement>('li > span');
    expect(swatches()[0]).toHaveStyle({ backgroundColor: getNoteColor('seedling', false) });
    expect(swatches()[1]).toHaveStyle({ backgroundColor: getTagColor(false) });

    mockUseTheme.mockReturnValue({ resolvedTheme: 'dark' });
    rerender(<GraphLegend nodes={nodes} showHint={false} onDismissHint={jest.fn()} labels={labels} />);

    expect(swatches()[0]).toHaveStyle({ backgroundColor: getNoteColor('seedling', true) });
    expect(swatches()[1]).toHaveStyle({ backgroundColor: getTagColor(true) });
  });

  it('showHint일 때 힌트를 보여주고 닫기 버튼이 콜백을 부른다', async () => {
    const user = userEvent.setup();
    const onDismissHint = jest.fn();

    renderLegend({ showHint: true, onDismissHint });

    expect(screen.getByText(labels.hint)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss hint' }));

    expect(onDismissHint).toHaveBeenCalledTimes(1);
  });

  it('힌트를 닫아도 포커스가 body로 떨어지지 않는다', async () => {
    const user = userEvent.setup();

    renderLegend({ showHint: true });

    await user.click(screen.getByRole('button', { name: 'Dismiss hint' }));

    // 실제 사용에서는 이 시점에 버튼이 언마운트된다. 포커스를 컨테이너로 되돌리지 않으면
    // body로 떨어져 다음 Tab이 문서 최상단으로 되돌아간다(WCAG 2.4.3).
    expect(screen.getByRole('complementary', { name: 'Legend' })).toHaveFocus();
  });

  it('설명할 행이 없으면 빈 껍데기 카드 대신 아무것도 렌더하지 않는다', () => {
    const { container } = renderLegend({ nodes: [], showHint: true });

    expect(container).toBeEmptyDOMElement();
  });

  it('힌트가 꺼져도 범례 행과 크기 설명은 남는다 (상시 범례)', () => {
    renderLegend({ showHint: false });

    expect(screen.queryByText(labels.hint)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss hint' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(labels.sizeNote)).toBeInTheDocument();
  });
});
