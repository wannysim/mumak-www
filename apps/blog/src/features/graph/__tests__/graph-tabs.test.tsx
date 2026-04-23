import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GraphTabs } from '../ui/graph-tabs';

import '@testing-library/jest-dom';

const mockReplace = jest.fn();
const mockSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

const labels = { garden: 'Garden', blog: 'Blog' };

describe('GraphTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Garden과 Blog 탭을 렌더링한다', () => {
    render(<GraphTabs activeTab="garden" labels={labels} />);

    expect(screen.getByRole('tab', { name: 'Garden' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Blog' })).toBeInTheDocument();
  });

  it('활성 탭에 aria-selected 속성이 적용된다', () => {
    render(<GraphTabs activeTab="garden" labels={labels} />);

    expect(screen.getByRole('tab', { name: 'Garden' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Blog' })).toHaveAttribute('aria-selected', 'false');
  });

  it('탭 클릭 시 URL searchParams를 업데이트한다', async () => {
    const user = userEvent.setup();
    render(<GraphTabs activeTab="garden" labels={labels} />);

    await user.click(screen.getByRole('tab', { name: 'Blog' }));

    expect(mockReplace).toHaveBeenCalledWith('?tab=blog', { scroll: false });
  });
});
