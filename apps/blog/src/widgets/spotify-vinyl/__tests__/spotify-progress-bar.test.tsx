import { render, screen } from '@testing-library/react';

import { formatTime, SpotifyProgressBar } from '../ui/spotify-progress-bar';

import '@testing-library/jest-dom';

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

  it('clamps the bar width to 0 when durationMs is 0', () => {
    const { container } = render(<SpotifyProgressBar progressMs={1_000} durationMs={0} isPlaying />);

    const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
    expect(fill).toBeInTheDocument();
    expect(fill.style.width).toBe('0%');
  });

  it('clamps the bar width to 100% when progressMs exceeds durationMs', () => {
    const { container } = render(<SpotifyProgressBar progressMs={500_000} durationMs={100_000} isPlaying />);

    const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('clamps negative progressMs to 0% width', () => {
    const { container } = render(<SpotifyProgressBar progressMs={-1_000} durationMs={100_000} isPlaying />);

    const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('applies a faded class when paused', () => {
    const { container } = render(<SpotifyProgressBar {...baseProps} isPlaying={false} />);

    const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
    expect(fill.className).toContain('opacity-60');
  });

  it('does not apply a faded class when playing', () => {
    const { container } = render(<SpotifyProgressBar {...baseProps} isPlaying />);

    const fill = container.querySelector('div[role="progressbar"] > div') as HTMLElement;
    expect(fill.className).not.toContain('opacity-60');
  });

  it('merges a custom className onto the wrapper', () => {
    const { container } = render(<SpotifyProgressBar {...baseProps} className="custom-class" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('custom-class');
  });
});
