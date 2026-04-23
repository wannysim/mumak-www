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
});
