import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { GraphData } from '../model/types';
import { GraphControls } from '../ui/graph-controls';

import '@testing-library/jest-dom';

const mockData: GraphData = {
  nodes: [
    { id: 'note:a', name: 'Note A', type: 'note', status: 'seedling', linkCount: 1, url: '/garden/a' },
    { id: 'note:b', name: 'Note B', type: 'note', status: 'evergreen', linkCount: 2, url: '/garden/b' },
    { id: 'tag:react', name: 'react', type: 'tag', linkCount: 2, url: '' },
  ],
  links: [
    { source: 'note:a', target: 'tag:react', type: 'tag' },
    { source: 'note:b', target: 'tag:react', type: 'tag' },
  ],
};

const defaultLabels = {
  search: 'Search nodes...',
  filter: 'Filter',
  clearFilters: 'Clear',
  noResults: 'No results',
  status: 'Status',
  tags: 'Tags',
  categories: 'Categories',
};

describe('GraphControls', () => {
  it('검색 입력 필드를 렌더링한다', () => {
    render(
      <GraphControls
        data={mockData}
        activeTab="garden"
        searchQuery=""
        onSearchChange={jest.fn()}
        activeFilters={[]}
        onFilterToggle={jest.fn()}
        onClearFilters={jest.fn()}
        labels={defaultLabels}
      />
    );

    expect(screen.getByPlaceholderText('Search nodes...')).toBeInTheDocument();
  });

  it('검색 입력 시 onSearchChange 콜백을 호출한다', async () => {
    const handleSearch = jest.fn();
    const user = userEvent.setup();

    render(
      <GraphControls
        data={mockData}
        activeTab="garden"
        searchQuery=""
        onSearchChange={handleSearch}
        activeFilters={[]}
        onFilterToggle={jest.fn()}
        onClearFilters={jest.fn()}
        labels={defaultLabels}
      />
    );

    const input = screen.getByPlaceholderText('Search nodes...');
    await user.type(input, 'react');

    expect(handleSearch).toHaveBeenCalled();
  });

  it('필터 버튼을 렌더링한다', () => {
    render(
      <GraphControls
        data={mockData}
        activeTab="garden"
        searchQuery=""
        onSearchChange={jest.fn()}
        activeFilters={[]}
        onFilterToggle={jest.fn()}
        onClearFilters={jest.fn()}
        labels={defaultLabels}
      />
    );

    const filterButton = screen.getByRole('button', { expanded: false });
    expect(filterButton).toBeInTheDocument();
  });

  it('활성 필터가 있으면 뱃지를 표시한다', () => {
    render(
      <GraphControls
        data={mockData}
        activeTab="garden"
        searchQuery=""
        onSearchChange={jest.fn()}
        activeFilters={['status:seedling', 'tag:react']}
        onFilterToggle={jest.fn()}
        onClearFilters={jest.fn()}
        labels={defaultLabels}
      />
    );

    expect(screen.getByText('seedling')).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
  });

  it('활성 필터 뱃지 클릭 시 onFilterToggle을 호출한다', async () => {
    const handleToggle = jest.fn();
    const user = userEvent.setup();

    render(
      <GraphControls
        data={mockData}
        activeTab="garden"
        searchQuery=""
        onSearchChange={jest.fn()}
        activeFilters={['status:seedling']}
        onFilterToggle={handleToggle}
        onClearFilters={jest.fn()}
        labels={defaultLabels}
      />
    );

    await user.click(screen.getByText('seedling'));
    expect(handleToggle).toHaveBeenCalledWith('status:seedling');
  });

  it('clear 버튼 클릭 시 onClearFilters를 호출한다 (활성 필터가 있을 때만)', async () => {
    const handleClear = jest.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <GraphControls
        data={mockData}
        activeTab="garden"
        searchQuery=""
        onSearchChange={jest.fn()}
        activeFilters={[]}
        onFilterToggle={jest.fn()}
        onClearFilters={handleClear}
        labels={defaultLabels}
      />
    );

    const buttonsWithoutFilters = screen.getAllByRole('button');

    rerender(
      <GraphControls
        data={mockData}
        activeTab="garden"
        searchQuery=""
        onSearchChange={jest.fn()}
        activeFilters={['status:seedling']}
        onFilterToggle={jest.fn()}
        onClearFilters={handleClear}
        labels={defaultLabels}
      />
    );

    const buttonsWithFilters = screen.getAllByRole('button');
    // 활성 필터가 생기면 clear (X) 버튼이 추가로 노출된다.
    expect(buttonsWithFilters.length).toBeGreaterThan(buttonsWithoutFilters.length);

    await user.click(buttonsWithFilters[buttonsWithFilters.length - 1]!);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('blog 탭에서는 categories 필터 그룹이 노출된다', async () => {
    const blogData: GraphData = {
      nodes: [
        { id: 'cat:essay', name: 'essay', type: 'category', linkCount: 0, url: '' },
        { id: 'cat:articles', name: 'articles', type: 'category', linkCount: 0, url: '' },
      ],
      links: [],
    };
    const user = userEvent.setup();

    render(
      <GraphControls
        data={blogData}
        activeTab="blog"
        searchQuery=""
        onSearchChange={jest.fn()}
        activeFilters={[]}
        onFilterToggle={jest.fn()}
        onClearFilters={jest.fn()}
        labels={defaultLabels}
      />
    );

    await user.click(screen.getByRole('button', { expanded: false }));

    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'essay' })).toBeInTheDocument();
  });

  it('필터 옵션 선택 시 onFilterToggle을 호출한다', async () => {
    const handleToggle = jest.fn();
    const user = userEvent.setup();

    render(
      <GraphControls
        data={mockData}
        activeTab="garden"
        searchQuery=""
        onSearchChange={jest.fn()}
        activeFilters={[]}
        onFilterToggle={handleToggle}
        onClearFilters={jest.fn()}
        labels={defaultLabels}
      />
    );

    await user.click(screen.getByRole('button', { expanded: false }));
    await user.click(screen.getByRole('option', { name: 'react' }));

    expect(handleToggle).toHaveBeenCalledWith('tag:react');
  });

  it('활성 필터 옵션은 강조 스타일(font-semibold)이 적용된다', async () => {
    const user = userEvent.setup();

    render(
      <GraphControls
        data={mockData}
        activeTab="garden"
        searchQuery=""
        onSearchChange={jest.fn()}
        activeFilters={['tag:react']}
        onFilterToggle={jest.fn()}
        onClearFilters={jest.fn()}
        labels={defaultLabels}
      />
    );

    await user.click(screen.getByRole('button', { expanded: false }));
    const reactOption = screen.getByRole('option', { name: 'react' });
    expect(reactOption.querySelector('span')).toHaveClass('font-semibold');
  });
});
