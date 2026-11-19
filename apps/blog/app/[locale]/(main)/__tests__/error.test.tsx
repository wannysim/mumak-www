import { fireEvent, render, screen } from '@testing-library/react';

import { captureException } from '@/src/shared/lib/error-tracking';

import RouteError from '../error';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/src/shared/lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

vi.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a>,
}));

describe('Error boundary (main)', () => {
  const makeError = () => Object.assign(new Error('boom'), { digest: 'abc123' });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the error message and recovery actions', () => {
    render(<RouteError error={makeError()} reset={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'title' })).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'backHome' })).toHaveAttribute('href', '/');
  });

  it('calls reset when the retry button is clicked', () => {
    const reset = vi.fn();
    render(<RouteError error={makeError()} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: 'retry' }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('logs the error so it is observable', () => {
    const error = makeError();
    render(<RouteError error={error} reset={vi.fn()} />);

    expect(console.error).toHaveBeenCalledWith(error);
  });

  it('reports the error to the error tracker', () => {
    const error = makeError();
    render(<RouteError error={error} reset={vi.fn()} />);

    expect(captureException).toHaveBeenCalledWith(error);
  });
});
