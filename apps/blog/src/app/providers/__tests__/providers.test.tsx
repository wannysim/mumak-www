import { render, screen } from '@testing-library/react';

import { IntlProvider } from '../intl-provider';

import '@testing-library/jest-dom';

// Mock next-intl
jest.mock('next-intl', () => ({
  NextIntlClientProvider: ({
    children,
    locale,
    timeZone,
  }: {
    children: React.ReactNode;
    locale: string;
    messages: Record<string, unknown>;
    timeZone: string;
  }) => (
    <div data-testid="intl-provider" data-locale={locale} data-timezone={timeZone}>
      {children}
    </div>
  ),
}));

describe('IntlProvider', () => {
  const mockMessages = {
    home: { title: 'Test Title' },
    common: { test: 'Test' },
  };

  it('should render children correctly', () => {
    render(
      <IntlProvider locale="ko" messages={mockMessages}>
        <div data-testid="child-content">Test Content</div>
      </IntlProvider>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should wrap children with NextIntlClientProvider', () => {
    render(
      <IntlProvider locale="ko" messages={mockMessages}>
        <div>Content</div>
      </IntlProvider>
    );

    expect(screen.getByTestId('intl-provider')).toBeInTheDocument();
  });

  it('should pass correct locale to NextIntlClientProvider', () => {
    render(
      <IntlProvider locale="en" messages={mockMessages}>
        <div>Content</div>
      </IntlProvider>
    );

    const intlProvider = screen.getByTestId('intl-provider');
    expect(intlProvider).toHaveAttribute('data-locale', 'en');
  });

  it('should use Asia/Seoul timezone for Korean locale', () => {
    render(
      <IntlProvider locale="ko" messages={mockMessages}>
        <div>Content</div>
      </IntlProvider>
    );

    const intlProvider = screen.getByTestId('intl-provider');
    expect(intlProvider).toHaveAttribute('data-timezone', 'Asia/Seoul');
  });

  it('should use UTC timezone for non-Korean locale', () => {
    render(
      <IntlProvider locale="en" messages={mockMessages}>
        <div>Content</div>
      </IntlProvider>
    );

    const intlProvider = screen.getByTestId('intl-provider');
    expect(intlProvider).toHaveAttribute('data-timezone', 'UTC');
  });

  it('should set html lang attribute on mount', () => {
    render(
      <IntlProvider locale="ko" messages={mockMessages}>
        <div>Content</div>
      </IntlProvider>
    );

    expect(document.documentElement.lang).toBe('ko');
  });

  it('should update html lang attribute when locale changes', () => {
    const { rerender } = render(
      <IntlProvider locale="ko" messages={mockMessages}>
        <div>Content</div>
      </IntlProvider>
    );

    expect(document.documentElement.lang).toBe('ko');

    rerender(
      <IntlProvider locale="en" messages={mockMessages}>
        <div>Content</div>
      </IntlProvider>
    );

    expect(document.documentElement.lang).toBe('en');
  });
});
