type DashboardMode = 'paper' | 'live';
type DashboardStatus = 'active' | 'stopped' | 'completed';
type DashboardSource = 'forward-paper-ledger' | 'live-ledger';
type BaselineKind = 'inception' | 'month-start';
type ReturnMethod = 'simple-no-flows' | 'unavailable';

type DashboardSummary = {
  startingNav: string;
  currentNav: string;
  cash: string;
  netContributions: string;
  profit: string;
  returnPct: string | null;
  returnMethod: ReturnMethod;
};

type DashboardHolding = {
  symbol: string;
  quantity: string;
  averageCost: string;
  markPrice: string | null;
  markAsOf: string | null;
  marketValue: string | null;
  unrealizedPnl: string | null;
  returnPct: string | null;
};

type DashboardHistoryPoint = {
  at: string;
  nav: string;
  profit: string;
  returnPct: string | null;
};

type DashboardFill = {
  id: string;
  at: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  commission: string;
};

type DashboardSnapshot = {
  schemaVersion: 1;
  mode: DashboardMode;
  episodeId: string;
  month: string;
  label: string;
  currency: 'USD';
  status: DashboardStatus;
  startedAt: string;
  asOf: string;
  exportedAt: string;
  source: DashboardSource;
  baselineKind: BaselineKind;
  summary: DashboardSummary;
  holdings: DashboardHolding[];
  history: DashboardHistoryPoint[];
  fills: DashboardFill[];
  notes: string[];
};

class SnapshotValidationError extends Error {
  constructor(path: string, detail: string) {
    super(`Invalid dashboard snapshot at ${path}: ${detail}`);
    this.name = 'SnapshotValidationError';
  }
}

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function fail(path: string, detail: string): never {
  throw new SnapshotValidationError(path, detail);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected object');
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, path: string, expected: readonly string[]) {
  const actual = Object.keys(value);
  const unexpected = actual.find(key => !expected.includes(key));
  const missing = expected.find(key => !(key in value));
  if (unexpected) fail(`${path}.${unexpected}`, 'unexpected field');
  if (missing) fail(`${path}.${missing}`, 'missing field');
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim())
    fail(path, 'expected non-empty string');
  return value;
}

function oneOf<const Values extends readonly string[]>(value: unknown, path: string, values: Values): Values[number] {
  if (typeof value !== 'string' || !values.includes(value)) fail(path, `expected one of ${values.join(', ')}`);
  return value as Values[number];
}

function decimal(value: unknown, path: string): string {
  if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value) || !Number.isFinite(Number(value))) {
    fail(path, 'expected finite decimal string');
  }
  return value;
}

function nullableDecimal(value: unknown, path: string): string | null {
  return value === null ? null : decimal(value, path);
}

function isoDate(value: unknown, path: string): string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
    fail(path, 'expected ISO-8601 timestamp with timezone');
  }
  return value;
}

function nullableIsoDate(value: unknown, path: string): string | null {
  return value === null ? null : isoDate(value, path);
}

function array<T>(value: unknown, path: string, parseItem: (item: unknown, itemPath: string) => T): T[] {
  if (!Array.isArray(value)) fail(path, 'expected array');
  return value.map((item, index) => parseItem(item, `${path}[${index}]`));
}

function parseSummary(value: unknown): DashboardSummary {
  const summary = record(value, 'payload.summary');
  exactKeys(summary, 'payload.summary', [
    'startingNav',
    'currentNav',
    'cash',
    'netContributions',
    'profit',
    'returnPct',
    'returnMethod',
  ]);
  return {
    startingNav: decimal(summary.startingNav, 'payload.summary.startingNav'),
    currentNav: decimal(summary.currentNav, 'payload.summary.currentNav'),
    cash: decimal(summary.cash, 'payload.summary.cash'),
    netContributions: decimal(summary.netContributions, 'payload.summary.netContributions'),
    profit: decimal(summary.profit, 'payload.summary.profit'),
    returnPct: nullableDecimal(summary.returnPct, 'payload.summary.returnPct'),
    returnMethod: oneOf(summary.returnMethod, 'payload.summary.returnMethod', ['simple-no-flows', 'unavailable']),
  };
}

function parseHolding(value: unknown, path: string): DashboardHolding {
  const holding = record(value, path);
  exactKeys(holding, path, [
    'symbol',
    'quantity',
    'averageCost',
    'markPrice',
    'markAsOf',
    'marketValue',
    'unrealizedPnl',
    'returnPct',
  ]);
  return {
    symbol: string(holding.symbol, `${path}.symbol`),
    quantity: decimal(holding.quantity, `${path}.quantity`),
    averageCost: decimal(holding.averageCost, `${path}.averageCost`),
    markPrice: nullableDecimal(holding.markPrice, `${path}.markPrice`),
    markAsOf: nullableIsoDate(holding.markAsOf, `${path}.markAsOf`),
    marketValue: nullableDecimal(holding.marketValue, `${path}.marketValue`),
    unrealizedPnl: nullableDecimal(holding.unrealizedPnl, `${path}.unrealizedPnl`),
    returnPct: nullableDecimal(holding.returnPct, `${path}.returnPct`),
  };
}

function parseHistoryPoint(value: unknown, path: string): DashboardHistoryPoint {
  const point = record(value, path);
  exactKeys(point, path, ['at', 'nav', 'profit', 'returnPct']);
  return {
    at: isoDate(point.at, `${path}.at`),
    nav: decimal(point.nav, `${path}.nav`),
    profit: decimal(point.profit, `${path}.profit`),
    returnPct: nullableDecimal(point.returnPct, `${path}.returnPct`),
  };
}

function parseFill(value: unknown, path: string): DashboardFill {
  const fill = record(value, path);
  exactKeys(fill, path, ['id', 'at', 'symbol', 'side', 'quantity', 'price', 'commission']);
  return {
    id: string(fill.id, `${path}.id`),
    at: isoDate(fill.at, `${path}.at`),
    symbol: string(fill.symbol, `${path}.symbol`),
    side: oneOf(fill.side, `${path}.side`, ['buy', 'sell']),
    quantity: decimal(fill.quantity, `${path}.quantity`),
    price: decimal(fill.price, `${path}.price`),
    commission: decimal(fill.commission, `${path}.commission`),
  };
}

function parseSnapshotPayload(value: unknown, expectedMode?: DashboardMode): DashboardSnapshot {
  const payload = record(value, 'payload');
  exactKeys(payload, 'payload', [
    'schemaVersion',
    'mode',
    'episodeId',
    'month',
    'label',
    'currency',
    'status',
    'startedAt',
    'asOf',
    'exportedAt',
    'source',
    'baselineKind',
    'summary',
    'holdings',
    'history',
    'fills',
    'notes',
  ]);
  if (payload.schemaVersion !== 1) fail('payload.schemaVersion', 'expected 1');
  const mode = oneOf(payload.mode, 'payload.mode', ['paper', 'live']);
  if (expectedMode && mode !== expectedMode) fail('payload.mode', `expected ${expectedMode}`);
  const source = oneOf(payload.source, 'payload.source', ['forward-paper-ledger', 'live-ledger']);
  if ((mode === 'paper' && source !== 'forward-paper-ledger') || (mode === 'live' && source !== 'live-ledger')) {
    fail('payload.source', `does not match ${mode} mode`);
  }
  const month = string(payload.month, 'payload.month');
  if (!MONTH_PATTERN.test(month)) fail('payload.month', 'expected YYYY-MM');

  return {
    schemaVersion: 1,
    mode,
    episodeId: string(payload.episodeId, 'payload.episodeId'),
    month,
    label: string(payload.label, 'payload.label'),
    currency: oneOf(payload.currency, 'payload.currency', ['USD']),
    status: oneOf(payload.status, 'payload.status', ['active', 'stopped', 'completed']),
    startedAt: isoDate(payload.startedAt, 'payload.startedAt'),
    asOf: isoDate(payload.asOf, 'payload.asOf'),
    exportedAt: isoDate(payload.exportedAt, 'payload.exportedAt'),
    source,
    baselineKind: oneOf(payload.baselineKind, 'payload.baselineKind', ['inception', 'month-start']),
    summary: parseSummary(payload.summary),
    holdings: array(payload.holdings, 'payload.holdings', parseHolding),
    history: array(payload.history, 'payload.history', parseHistoryPoint),
    fills: array(payload.fills, 'payload.fills', parseFill),
    notes: array(payload.notes, 'payload.notes', (note, path) => string(note, path)),
  };
}

function mapSnapshotRow(value: unknown, expectedMode: DashboardMode): DashboardSnapshot {
  const row = record(value, 'row');
  exactKeys(row, 'row', ['episode_id', 'month', 'as_of', 'payload']);
  const episodeId = string(row.episode_id, 'row.episode_id');
  const month = string(row.month, 'row.month');
  const asOf = isoDate(row.as_of, 'row.as_of');
  const payload = parseSnapshotPayload(row.payload, expectedMode);

  if (payload.episodeId !== episodeId) fail('row.episode_id', 'does not match payload.episodeId');
  if (payload.month !== month) fail('row.month', 'does not match payload.month');
  if (Date.parse(payload.asOf) !== Date.parse(asOf)) fail('row.as_of', 'does not match payload.asOf');

  return payload;
}

export {
  mapSnapshotRow,
  parseSnapshotPayload,
  SnapshotValidationError,
  type DashboardFill,
  type DashboardHistoryPoint,
  type DashboardHolding,
  type DashboardMode,
  type DashboardSnapshot,
  type DashboardStatus,
};
