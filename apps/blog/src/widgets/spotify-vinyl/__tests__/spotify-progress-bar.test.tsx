import { render, screen } from '@testing-library/react';

import { formatTime } from '../lib/format-time';
import { SpotifyProgressBar } from '../ui/spotify-progress-bar';

import '@testing-library/jest-dom';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('formatTime', () => {
  it('returns "0:00" for negative input', () => {
    expect(formatTime(-1)).toBe('0:00');
    expect(formatTime(-100_000)).toBe('0:00');
  });

  it('returns "0:00" for non-finite input', () => {
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
    expect(formatTime(Number.NEGATIVE_INFINITY)).toBe('0:00');
  });

  it('zero-pads seconds under 10', () => {
    expect(formatTime(5_000)).toBe('0:05');
    expect(formatTime(9_999)).toBe('0:09');
  });

  it('formats values under one minute', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(45_000)).toBe('0:45');
  });

  it('formats exactly one minute', () => {
    expect(formatTime(60_000)).toBe('1:00');
  });

  it('formats values over one minute', () => {
    expect(formatTime(61_000)).toBe('1:01');
    expect(formatTime(180_000)).toBe('3:00');
    expect(formatTime(125_500)).toBe('2:05');
  });
});

describe('SpotifyProgressBar', () => {
  const baseProps = {
    progressMs: 30_000,
    durationMs: 180_000,
    isPlaying: true,
  };

  it('names the progressbar from a message key (label sits on the progress element, not the wrapper div)', () => {
    render(<SpotifyProgressBar {...baseProps} />);

    // mock 번역은 key를 그대로 반환한다.
    expect(screen.getByRole('progressbar', { name: 'trackProgress' })).toBeInTheDocument();
  });

  it('renders the progressbar role with rounded second-level aria values', () => {
    render(<SpotifyProgressBar {...baseProps} />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '30');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '180');
  });

  it('renders both current and total time labels', () => {
    render(<SpotifyProgressBar {...baseProps} />);

    expect(screen.getByText('0:30')).toBeInTheDocument();
    expect(screen.getByText('3:00')).toBeInTheDocument();
  });

  it('clamps the bar value to 0 when durationMs is 0', () => {
    render(<SpotifyProgressBar progressMs={1_000} durationMs={0} isPlaying />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0');
  });

  it('fills the bar when progressMs exceeds durationMs', () => {
    render(<SpotifyProgressBar progressMs={500_000} durationMs={100_000} isPlaying />);

    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('value')).toBe(bar.getAttribute('max'));
  });

  it('clamps negative progressMs to value 0', () => {
    render(<SpotifyProgressBar progressMs={-1_000} durationMs={100_000} isPlaying />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0');
  });

  it('applies a faded class when paused', () => {
    render(<SpotifyProgressBar {...baseProps} isPlaying={false} />);

    expect(screen.getByRole('progressbar').className).toContain('opacity-60');
  });

  it('does not apply a faded class when playing', () => {
    render(<SpotifyProgressBar {...baseProps} isPlaying />);

    expect(screen.getByRole('progressbar').className).not.toContain('opacity-60');
  });

  it('renders the time row at the 11px legibility floor', () => {
    render(<SpotifyProgressBar {...baseProps} />);

    expect(screen.getByText('0:30').parentElement).toHaveClass('text-[11px]');
  });

  it('merges a custom className onto the wrapper', () => {
    const { container } = render(<SpotifyProgressBar {...baseProps} className="custom-class" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-class');
  });
});
