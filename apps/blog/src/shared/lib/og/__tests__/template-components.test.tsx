import { render, screen } from '@testing-library/react';

import { OgClampText, OgEyebrow, OgFooter, OgNotFound, OgShell } from '../template';

import '@testing-library/jest-dom';

describe('OgShell', () => {
  it('renders children', () => {
    render(
      <OgShell>
        <span>inner</span>
      </OgShell>
    );

    expect(screen.getByText('inner')).toBeInTheDocument();
  });

  it('defaults justifyContent to space-between', () => {
    const { container } = render(<OgShell>x</OgShell>);

    expect((container.firstChild as HTMLElement).style.justifyContent).toBe('space-between');
  });

  it('applies the justify prop when provided', () => {
    const { container } = render(<OgShell justify="center">x</OgShell>);

    expect((container.firstChild as HTMLElement).style.justifyContent).toBe('center');
  });
});

describe('OgClampText', () => {
  const baseProps = { text: 'clamp me', fontSize: 64, lines: 3, maxWidth: '900px' };

  it('renders the text with the given fontSize', () => {
    render(<OgClampText {...baseProps} />);

    expect(screen.getByText('clamp me').style.fontSize).toBe('64px');
  });

  it('omits fontWeight/lineHeight when not provided (Satori undefined .trim() crash guard)', () => {
    render(<OgClampText {...baseProps} />);
    const el = screen.getByText('clamp me');

    expect(el.style.fontWeight).toBe('');
    expect(el.style.lineHeight).toBe('');
  });

  it('includes fontWeight/lineHeight only when explicitly provided', () => {
    render(<OgClampText {...baseProps} text="weighted" weight={600} lineHeight={1.2} />);
    const el = screen.getByText('weighted');

    expect(el.style.fontWeight).toBe('600');
    expect(el.style.lineHeight).toBe('1.2');
  });
});

describe('OgEyebrow', () => {
  it('renders its children', () => {
    render(<OgEyebrow>BLOG</OgEyebrow>);

    expect(screen.getByText('BLOG')).toBeInTheDocument();
  });
});

describe('OgFooter', () => {
  it('renders the brand name and domain', () => {
    render(<OgFooter />);

    expect(screen.getByText('Wan Sim')).toBeInTheDocument();
    expect(screen.getByText('wannysim.com')).toBeInTheDocument();
  });
});

describe('OgNotFound', () => {
  it('renders the fallback label', () => {
    render(<OgNotFound />);

    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });
});
