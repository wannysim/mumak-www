import { formatDecimal, formatMoney, formatPercent, numeric, valueTone } from '@/lib/format';

describe('dashboard presentation formatting', () => {
  it('uses Number only at the presentation boundary', () => {
    expect(numeric('1000.25')).toBe(1000.25);
    expect(numeric(null)).toBeNull();
    expect(formatMoney('1000.25')).toBe('$1,000.25');
    expect(formatDecimal('1000.2500')).toBe('1,000.25');
  });

  it('renders missing and signed percentages explicitly', () => {
    expect(formatPercent(null)).toBe('산출 불가');
    expect(formatPercent('1.5')).toBe('+1.50%');
    expect(formatPercent('-1.5')).toBe('-1.50%');
  });

  it('selects semantic value tones', () => {
    expect(valueTone('1')).toContain('--positive');
    expect(valueTone('-1')).toBe('text-destructive');
    expect(valueTone('0')).toBe('text-foreground');
    expect(valueTone(null)).toBe('text-foreground');
  });
});
