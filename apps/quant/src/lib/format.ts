const PERCENT_FORMAT = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 축 눈금은 좁은 폭에서 겹치지 않아야 하므로 시각·타임존을 뺀 짧은 형태를 쓴다.
// 정확한 시각은 선택 지점 판독값과 툴팁이 계속 전체 형식으로 보여준다.
const DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' });

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

// 축 눈금 전용 축약 표기. $101,250.50 대신 $101.3K로 적어 Y축 폭을 줄인다.
function formatMoneyCompact(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
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

function formatDate(value: string) {
  return DATE_FORMAT.format(new Date(value));
}

function valueTone(decimal: string | null) {
  const value = numeric(decimal);
  if (value === null || value === 0) return 'text-foreground';
  return value > 0 ? 'text-[var(--positive)]' : 'text-destructive';
}

export {
  formatDate,
  formatDateTime,
  formatDecimal,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  numeric,
  valueTone,
};
