import contract from './observation-contract.json';
import { time, validate, validateReferences, type Fact } from './operations-schema';

type Health = {
  status: 'succeeded' | 'failed' | 'running' | 'unknown';
  assessedAt: string;
  validUntil: string;
  reason: string;
};
type AccountRisk = {
  assessedAt: string;
  validUntil: string;
  state: 'clear' | 'stopped' | 'unknown';
  reason: 'none' | 'daily-loss-stop' | 'monthly-loss-stop' | 'both-loss-stops' | 'unknown';
  dailyReturn: string | null;
  monthlyReturn: string | null;
  dailyStop: string;
  monthlyStop: string;
};
type SymbolRisk = {
  symbol: string;
  assessedAt: string;
  validUntil: string;
  state: 'monitor' | 'full-exit' | 'trim' | 'hold' | 'unknown';
  reason: 'none' | 'symbol-stop' | 'symbol-trim' | 'account-stop' | 'data-hold' | 'corporate-hold' | 'unknown';
  inputConfidence: 'validated' | 'unknown';
  entryPrice: string | null;
  sigmaEntry: string | null;
  highWater: string | null;
  mark: string | null;
  stopThreshold: string | null;
  exposureProxy: string | null;
  gamma: string | null;
  quantity: number;
  targetQuantity: number | null;
  reentry: 'same-session-blocked' | 'regular-entry-only' | 'hold-blocked' | 'unknown';
  evidenceIds: string[];
};
type Observation = {
  contract: 'paper-observability/v1';
  mode: 'paper';
  origin: 'paper-runtime' | 'synthetic';
  episodeId: string;
  month: string;
  session: string;
  sourceAsOf: string;
  exportedAt: string;
  effectiveFrom: string;
  effectiveThrough: string;
  evidence: { id: string; kind: string; evidenceAt: string; observedAt: string }[];
  ingest: Fact<{ snapshotAsOf: string; readbackAt: string; status: 'verified' }>;
  schedule: Fact<{ opensAt: string; closesAt: string; nextExpectedAt: string; expectedBy: string }>;
  collection: Fact<Health>;
  publication: Fact<Health>;
  decision: Fact<{ at: string; strategyVersion: string; action: 'buy' | 'sell' | 'hold' | 'blocked'; reason: string }>;
  account: Fact<AccountRisk>;
  symbols: Fact<SymbolRisk[]>;
};
const kinds = {
  ingest: 'ingest-readback',
  schedule: 'schedule-receipt',
  collection: 'collector-receipt',
  publication: 'publication-receipt',
  decision: 'decision-record',
  account: 'risk-record',
  symbols: 'risk-record',
} as const;
function requireValid(value: unknown): asserts value {
  if (!value) throw new Error('Invalid public observation');
}
// Contract checks use decimal integers, never binary floats (UI graphs are display-only).
function compareDecimal(a: string, b: string) {
  const scaled = (value: string) => {
    const [whole, fraction = ''] = value.split('.');
    return { n: BigInt(`${whole}${fraction}`), scale: 10n ** BigInt(fraction.length) };
  };
  const x = scaled(a),
    y = scaled(b);
  const delta = x.n * y.scale - y.n * x.scale;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}
function parseObservation(value: unknown): Observation {
  validate(value, contract.payload, contract);
  const p = value as Observation;
  requireValid(
    new TextEncoder().encode(JSON.stringify(p)).length <= 2 * 1024 * 1024 && p.session.startsWith(`${p.month}-`)
  );
  const ev = new Map(p.evidence.map(e => [e.id, e]));
  requireValid(ev.size === p.evidence.length);
  validateReferences(p, new Set(ev.keys()));
  for (const e of ev.values())
    requireValid(time(e.evidenceAt) <= time(e.observedAt) && time(e.observedAt) <= time(p.exportedAt));
  const latest = p.evidence.reduce(
    (a, e) => (time(a) > time(e.evidenceAt) ? a : e.evidenceAt),
    p.evidence[0]!.evidenceAt
  );
  requireValid(time(latest) === time(p.sourceAsOf));
  requireValid(time(p.sourceAsOf) <= time(p.exportedAt) && time(p.effectiveFrom) < time(p.effectiveThrough));
  const session = (at: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(at));
    const part = (name: string) => parts.find(p => p.type === name)!.value;
    requireValid(`${part('year')}-${part('month')}-${part('day')}` === p.session);
  };
  const bound = (field: keyof typeof kinds, at: string) =>
    requireValid(
      p[field].evidenceIds.some(id => ev.get(id)!.kind === kinds[field] && time(ev.get(id)!.evidenceAt) === time(at))
    );
  const assessment = (v: { assessedAt: string; validUntil: string }) => {
    requireValid(
      time(p.effectiveFrom) <= time(v.assessedAt) &&
        time(v.assessedAt) < time(v.validUntil) &&
        time(v.validUntil) <= time(p.effectiveThrough)
    );
    session(v.assessedAt);
  };
  for (const field of Object.keys(kinds) as (keyof typeof kinds)[]) {
    const fact = p[field];
    if (fact.value !== null) requireValid(fact.evidenceIds.some(id => ev.get(id)!.kind === kinds[field]));
  }
  for (const field of ['collection', 'publication', 'account'] as const) {
    const v = p[field].value;
    if (v) {
      assessment(v);
      bound(field, v.assessedAt);
    }
  }
  if (p.ingest.value) {
    bound('ingest', p.ingest.value.readbackAt);
    requireValid(time(p.ingest.value.snapshotAsOf) <= time(p.ingest.value.readbackAt));
  }
  if (p.decision.value) {
    bound('decision', p.decision.value.at);
    session(p.decision.value.at);
  }
  if (p.schedule.value) {
    const v = p.schedule.value;
    requireValid(time(v.opensAt) < time(v.closesAt) && time(v.nextExpectedAt) <= time(v.expectedBy));
    session(v.opensAt);
    session(v.closesAt);
  }
  const symbols = p.symbols.value ?? [];
  requireValid(new Set(symbols.map(s => s.symbol)).size === symbols.length);
  for (const s of symbols) {
    assessment(s);
    requireValid(
      s.evidenceIds.some(
        id => ev.get(id)!.kind === 'risk-record' && time(ev.get(id)!.evidenceAt) === time(s.assessedAt)
      )
    );
    requireValid(s.inputConfidence !== 'unknown' || s.state === 'unknown' || s.state === 'hold');
    for (const key of ['entryPrice', 'sigmaEntry', 'highWater', 'mark', 'stopThreshold'] as const) {
      requireValid(s.inputConfidence !== 'validated' || s[key] !== null);
      requireValid(s[key] === null || Number(s[key]) > 0);
    }
    requireValid(s.targetQuantity === null || s.targetQuantity <= s.quantity);
    requireValid(s.exposureProxy === null || compareDecimal(s.exposureProxy, '0') >= 0);
    requireValid(s.gamma === null || compareDecimal(s.gamma, '0') > 0);
    requireValid(
      s.state !== 'full-exit' ||
        (s.targetQuantity === 0 && ['symbol-stop', 'symbol-trim', 'account-stop'].includes(s.reason))
    );
    requireValid(
      s.state !== 'trim' || (s.targetQuantity !== null && s.targetQuantity < s.quantity && s.reason === 'symbol-trim')
    );
  }
  const a = p.account.value;
  if (a) {
    requireValid(compareDecimal(a.dailyStop, '0.01') === 0 && compareDecimal(a.monthlyStop, '0.30') === 0);
    requireValid(
      a.state !== 'clear' ||
        (a.reason === 'none' &&
          a.dailyReturn !== null &&
          a.monthlyReturn !== null &&
          compareDecimal(a.dailyReturn, `-${a.dailyStop}`) > 0 &&
          compareDecimal(a.monthlyReturn, `-${a.monthlyStop}`) > 0)
    );
    requireValid(
      a.state !== 'stopped' || ['daily-loss-stop', 'monthly-loss-stop', 'both-loss-stops'].includes(a.reason)
    );
    requireValid(a.state !== 'unknown' || a.reason === 'unknown');
  }
  return p;
}
export { parseObservation, type Observation, type SymbolRisk, type AccountRisk, type Health };
