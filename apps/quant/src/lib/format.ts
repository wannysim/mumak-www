import type { DashboardFill } from '@/lib/dashboard-schema';

const PERCENT_FORMAT = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WEIGHT_FORMAT = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function createDateFormatters(timeZone: string) {
  const date = new Intl.DateTimeFormat('ko-KR', { timeZone, month: 'short', day: 'numeric' });
  const dateTime = new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return {
    formatDate: (value: string) => date.format(new Date(value)),
    formatDateTime: (value: string) => dateTime.format(new Date(value)),
  };
}

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

// 구성 비중 전용. 손익률과 달리 부호를 붙이지 않고, 0.1% 미만은 0.0%가 아니라 그렇게 적는다.
function formatWeight(ratio: number) {
  if (!Number.isFinite(ratio) || ratio < 0) return '—';
  if (ratio > 0 && ratio < 0.001) return '<0.1%';
  return WEIGHT_FORMAT.format(ratio);
}

export function fillAmount(fill: Pick<DashboardFill, 'quantity' | 'price'>) {
  return String(Number(fill.quantity) * Number(fill.price));
}

export function fillTotal(fill: Pick<DashboardFill, 'quantity' | 'price' | 'side' | 'commission'>) {
  return String(Number(fillAmount(fill)) + (fill.side === 'buy' ? 1 : -1) * Number(fill.commission));
}

function valueTone(decimal: string | null) {
  const value = numeric(decimal);
  if (value === null || value === 0) return 'text-foreground';
  return value > 0 ? 'text-[var(--positive)]' : 'text-destructive';
}

export {
  createDateFormatters,
  formatDecimal,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatWeight,
  numeric,
  valueTone,
};
