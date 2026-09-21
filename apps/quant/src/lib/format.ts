const PERCENT_FORMAT = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short',
});

function numeric(decimal: string | null): number | null {
  if (decimal === null) return null;
  const value = Number(decimal);
  return Number.isFinite(value) ? value : null;
}

function formatMoney(decimal: string | null, currency = 'USD') {
  const value = numeric(decimal);
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDecimal(decimal: string | null, maximumFractionDigits = 4) {
  const value = numeric(decimal);
  if (value === null) return '—';
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits }).format(value);
}

function formatPercent(decimal: string | null) {
  const value = numeric(decimal);
  if (value === null) return '산출 불가';
  const sign = value > 0 ? '+' : '';
  return `${sign}${PERCENT_FORMAT.format(value)}%`;
}

function formatDateTime(value: string) {
  return DATE_TIME_FORMAT.format(new Date(value));
}

function valueTone(decimal: string | null) {
  const value = numeric(decimal);
  if (value === null || value === 0) return 'text-foreground';
  return value > 0 ? 'text-[var(--positive)]' : 'text-destructive';
}

export { formatDateTime, formatDecimal, formatMoney, formatPercent, numeric, valueTone };
