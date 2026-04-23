import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GraphToolbar } from '../ui/graph-toolbar';

import '@testing-library/jest-dom';

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

jest.mock('@/src/features/switch-theme', () => ({
  ThemeSwitcher: () => <button data-testid="theme-switcher">Theme</button>,
}));

jest.mock('@/src/features/switch-locale', () => ({
  LocaleSwitcher: () => <button data-testid="locale-switcher">Locale</button>,
}));

describe('GraphToolbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('뒤로가기 버튼을 렌더링한다', () => {
    render(<GraphToolbar locale="ko" />);

    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('테마/언어 전환 버튼을 렌더링한다', () => {
    render(<GraphToolbar locale="ko" />);

    expect(screen.getByTestId('theme-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('히스토리가 있으면 router.back()을 호출한다', async () => {
    Object.defineProperty(window, 'history', { value: { length: 3 }, writable: true });
    Object.defineProperty(document, 'referrer', { value: 'http://localhost:3002/ko', configurable: true });

    const user = userEvent.setup();
    render(<GraphToolbar locale="ko" />);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(mockBack).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('히스토리가 없으면 홈으로 이동한다', async () => {
    Object.defineProperty(window, 'history', { value: { length: 1 }, writable: true });
    Object.defineProperty(document, 'referrer', { value: '', configurable: true });

    const user = userEvent.setup();
    render(<GraphToolbar locale="en" />);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(mockPush).toHaveBeenCalledWith('/en');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
