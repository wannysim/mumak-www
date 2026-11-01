import { formatDecimal, formatMoney, formatMoneyCompact, formatPercent, numeric, valueTone } from '@/lib/format';

describe('dashboard presentation formatting', () => {
  it('reuses currency formatters across values without mixing currencies', () => {
    const formatter = vi.spyOn(Intl, 'NumberFormat');
    try {
      expect(formatMoney('1000.25', 'USD')).toBe('$1,000.25');
      expect(formatMoney('1000.25', 'EUR')).toBe('€1,000.25');
      const constructions = formatter.mock.calls.length;
      expect(formatMoney('2.5', 'USD')).toBe('$2.50');
      expect(formatMoney('-2.5', 'EUR')).toBe('-€2.50');
      expect(formatMoney(null, 'USD')).toBe('—');
      expect(formatter.mock.calls).toHaveLength(constructions);
    } finally {
      formatter.mockRestore();
    }
  });

  it('reuses decimal formatters without mixing precision', () => {
    const formatter = vi.spyOn(Intl, 'NumberFormat');
    try {
      expect(formatDecimal('1234.56789', 4)).toBe('1,234.5679');
      expect(formatDecimal('1234.56789', 2)).toBe('1,234.57');
      const constructions = formatter.mock.calls.length;
      expect(formatDecimal('2.56789', 4)).toBe('2.5679');
      expect(formatDecimal('-2.56789', 2)).toBe('-2.57');
      expect(formatDecimal(null, 2)).toBe('—');
      expect(formatter.mock.calls).toHaveLength(constructions);
    } finally {
      formatter.mockRestore();
    }
  });

  it('reuses compact currency formatters without mixing full-money options or currencies', () => {
    const formatter = vi.spyOn(Intl, 'NumberFormat');
    try {
      expect(formatMoneyCompact(1250, 'USD')).toBe('$1.3K');
      expect(formatMoneyCompact(1250, 'EUR')).toBe('€1.3K');
      expect(formatMoney('1250', 'USD')).toBe('$1,250.00');
      const constructions = formatter.mock.calls.length;
      expect(formatMoneyCompact(2500, 'USD')).toBe('$2.5K');
      expect(formatMoneyCompact(-2500, 'EUR')).toBe('-€2.5K');
      expect(formatter.mock.calls).toHaveLength(constructions);
    } finally {
      formatter.mockRestore();
    }
  });

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
