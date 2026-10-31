import contract from './operations-contract.json';

type Fact<T> =
  | { availability: 'recorded'; value: T; evidenceIds: string[] }
  | { availability: 'not-recorded' | 'unsupported' | 'redacted'; value: null; evidenceIds: string[] };
type StageId = 'collection' | 'screening' | 'decision' | 'risk' | 'paper-action' | 'report' | 'publication';
type Status = 'running' | 'succeeded' | 'failed' | 'skipped' | 'waiting' | 'blocked' | 'not-recorded';
type Evidence = { id: string; kind: string; evidenceAt: string | null; observedAt: string };
type Counts = Record<
  'universe' | 'collectorEligible' | 'collectorExcluded' | 'ranked' | 'selected' | 'watched',
  Fact<number>
>;
type Candidate = {
  symbol: string;
  kind: 'equity' | 'etf';
  collectorEligible: Fact<boolean>;
  reasonCodes: Fact<string[]>;
  signalQualified: Fact<boolean>;
  score: Fact<string>;
  volatility: Fact<string>;
  rank: Fact<number>;
  selected: Fact<boolean>;
  targetWeight: Fact<string>;
  watched: Fact<boolean>;
};
type StageSummary = { id: StageId; status: Status; evidenceAt: string | null; reasonCode: string | null };
type Stage = StageSummary & {
  startedAt: string | null;
  finishedAt: string | null;
  leaseUntil: string | null;
  nextExpectedAt: string | null;
  expectedBy: string | null;
  evidenceIds: string[];
  progress: Fact<{ processed: number; total: number; fetchErrors: number }>;
  quality: Fact<{
    historyValid: Fact<number>;
    historyCoverage: Fact<string>;
    historyGatePass: Fact<boolean>;
    decisionVerified: Fact<boolean>;
    closeVerified: Fact<boolean>;
    ledgerReconciled: Fact<boolean>;
    policyIntegrity: Fact<boolean>;
  }>;
  action: Fact<'buy' | 'sell' | 'buy-and-sell' | 'hold'>;
  risk: Fact<
    Record<
      'dailyBuyHalt' | 'monthlyBuyHalt' | 'dataHold' | 'corporateHold' | 'manualHold' | 'permissionHold',
      Fact<boolean>
    >
  >;
};
type Rules = {
  universeType: string;
  nominalUniverseEquities: number;
  nominalUniverseEtfs: number;
  minPriceUsd: string;
  minMeanDollarVolumeUsd: string;
  liquidityWindow: number;
  historyWindow: number;
  minUniverseCoverage: string;
  requiredHoldingsCoverage: string;
  returnWindows: [number, number];
  smaWindow: number;
  volatilityWindow: number;
  volatilityDof: number;
  priceBasis: string;
  positiveScoreRequired: boolean;
  maxPositions: number;
  stockCap: string;
  etfCap: string;
  sectorCap: string;
  underlyingCompanyCap: string;
  minCash: string;
  inverseVolBudget: string;
  budgetDivisor: string;
  sizingNavFactor: string;
  wholeSharesOnly: boolean;
  dailyLossStop: string;
  monthlyLossStop: string;
  commissionBps: string;
  slippageBps: string;
  selectionCadence: string;
  entryCadence: string;
  recoveryCadence: string;
  entryWindowOpenMinutes: number;
  entryWindowCloseMinutes: number;
  quoteSlotMinutes: number;
};
type Strategy = {
  version: string;
  labelCode: string;
  authority: string;
  sessionFrom: string;
  sessionThrough: string;
  effectiveFrom: Fact<string>;
  effectiveTo: Fact<string>;
  activationObservedAt: Fact<string>;
  variant: 'base' | 'C1';
  ruleSet: string;
  rules: Rules;
  evidenceIds: string[];
};
type Improvement = {
  cycleMonth: string;
  candidateVersion: Fact<string>;
  stages: { id: string; status: Status; evidenceAt: string | null; reasonCode: string | null; evidenceIds: string[] }[];
  outcome: Fact<string>;
  effectiveFrom: Fact<string>;
  activationObservedAt: Fact<string>;
};
type Envelope = {
  contract: 'paper-operations/v1';
  mode: 'paper';
  episodeId: string;
  month: string;
  sourceAsOf: string;
  exportedAt: string;
  evidence: Evidence[];
};
type MonthOperations = Envelope & { recordType: 'month'; strategies: Fact<Strategy[]>; improvement: Fact<Improvement> };
type SessionOperations = Envelope & {
  recordType: 'session';
  session: string;
  strategyVersion: Fact<string>;
  ledgerAsOf: Fact<string>;
  counts: Counts;
  stages: Stage[];
  candidates: Fact<Candidate[]>;
};
type Operations = MonthOperations | SessionOperations;
type SessionSummary = { session: string; counts: Counts; stages: StageSummary[] };
type Schema = string | (string | number)[] | { [key: string]: Schema };
const definitions: Record<string, Schema> = contract.definitions;
const enums: Record<string, string[]> = contract.enums;
function assert(valid: unknown): asserts valid {
  if (!valid) throw new Error('Invalid public operations');
}
function object(value: unknown): asserts value is Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value));
}
function time(value: unknown): bigint {
  assert(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?\+00:00$/.test(value));
  const result = Date.parse(value);
  assert(
    Number.isFinite(result) &&
      Number(value.slice(0, 4)) > 0 &&
      new Date(result).toISOString().slice(0, 19) === value.slice(0, 19)
  );
  const micros = (value.split('.')[1]?.split('+')[0] ?? '').padEnd(6, '0');
  return BigInt(Date.parse(`${value.slice(0, 19)}+00:00`)) * 1000n + BigInt(micros);
}
function validate(value: unknown, schema: Schema, vocabulary = { definitions, enums }): void {
  if (Array.isArray(schema)) {
    assert(Array.isArray(value) && value.length >= Number(schema[1]) && value.length <= Number(schema[2]));
    assert(typeof schema[0] === 'string');
    for (const child of value) validate(child, schema[0], vocabulary);
  } else if (typeof schema === 'object') {
    object(value);
    assert(
      Object.keys(value).length === Object.keys(schema).length &&
        Object.keys(schema).every(key => Object.hasOwn(value, key))
    );
    for (const [key, child] of Object.entries(schema)) validate(value[key], child, vocabulary);
  } else if (schema.endsWith('?')) {
    if (value !== null) validate(value, schema.slice(0, -1), vocabulary);
  } else if (schema.startsWith('fact:')) {
    validate(value, vocabulary.definitions.fact!, vocabulary);
    object(value);
    if (value.availability === 'recorded') {
      assert(Array.isArray(value.evidenceIds) && value.evidenceIds.length > 0);
      validate(value.value, schema.slice(5), vocabulary);
    } else assert(value.value === null);
  } else if (vocabulary.definitions[schema]) validate(value, vocabulary.definitions[schema]!, vocabulary);
  else if (vocabulary.enums[schema]) assert(typeof value === 'string' && vocabulary.enums[schema]!.includes(value));
  else if (schema === 'count' || schema === 'positive')
    assert(typeof value === 'number' && Number.isSafeInteger(value) && value >= (schema === 'positive' ? 1 : 0));
  else if (schema === 'bool') assert(typeof value === 'boolean');
  else if (schema === 'time') time(value);
  else if (schema === 'date') {
    assert(typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value));
    time(`${value}T00:00:00+00:00`);
  } else if (schema === 'decimal' || schema === 'ratio') {
    assert(typeof value === 'string' && value.length <= 80 && /^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value));
    if (schema === 'ratio') {
      const [whole, fraction = ''] = value.split('.');
      const integer = BigInt(`${whole}${fraction}`);
      assert(integer >= 0n && integer <= 10n ** BigInt(fraction.length));
    }
  } else if (schema === 'id' || schema === 'symbol' || schema === 'month')
    assert(
      typeof value === 'string' &&
        { id: /^[A-Za-z0-9_-]{1,80}$/, symbol: /^[A-Z0-9][A-Z0-9.-]{0,15}$/, month: /^[0-9]{4}-(0[1-9]|1[0-2])$/ }[
          schema
        ].test(value)
    );
  else assert(schema === 'any');
}
function validateReferences(value: unknown, ids: Set<string>): void {
  if (Array.isArray(value)) value.forEach(child => validateReferences(child, ids));
  else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.evidenceIds))
      assert(
        new Set(record.evidenceIds).size === record.evidenceIds.length &&
          record.evidenceIds.every(id => typeof id === 'string' && ids.has(id))
      );
    Object.values(record).forEach(child => validateReferences(child, ids));
  }
}
function parseOperations(value: unknown): Operations {
  object(value);
  assert(value.recordType === 'month' || value.recordType === 'session');
  validate(value, { ...contract.envelope, ...contract[value.recordType] });
  assert(new TextEncoder().encode(JSON.stringify(value)).length <= 2 * 1024 * 1024);
  const payload = value as unknown as Operations;
  const evidenceIds = new Set(payload.evidence.map(e => e.id));
  assert(evidenceIds.size === payload.evidence.length);
  validateReferences(payload, evidenceIds);
  const evidenceTimes: bigint[] = [];
  for (const evidence of payload.evidence) {
    if (evidence.evidenceAt === null) assert(['policy-declaration', 'preserved-policy'].includes(evidence.kind));
    else {
      evidenceTimes.push(time(evidence.evidenceAt));
      assert(time(evidence.evidenceAt) <= time(evidence.observedAt));
    }
  }
  assert(
    evidenceTimes.length > 0 &&
      evidenceTimes.reduce((a, b) => (a > b ? a : b)) === time(payload.sourceAsOf) &&
      time(payload.sourceAsOf) <= time(payload.exportedAt)
  );
  if (payload.recordType === 'month') {
    for (const strategy of payload.strategies.value ?? []) {
      if (strategy.authority === 'runtime-receipt')
        assert(
          payload.evidence.some(
            e => strategy.evidenceIds.includes(e.id) && e.kind === 'runtime-receipt' && e.evidenceAt !== null
          )
        );
      const activation = strategy.activationObservedAt;
      if (activation.value !== null)
        assert(
          payload.evidence.some(
            e =>
              activation.evidenceIds.includes(e.id) &&
              e.kind === 'runtime-receipt' &&
              e.evidenceAt !== null &&
              time(e.evidenceAt) === time(activation.value!)
          )
        );
      assert(
        strategy.sessionFrom <= strategy.sessionThrough &&
          strategy.sessionFrom.startsWith(payload.month) &&
          strategy.sessionThrough.startsWith(payload.month)
      );
      assert(
        strategy.variant === 'base'
          ? strategy.rules.recoveryCadence === 'none'
          : strategy.effectiveFrom.value !== null && strategy.rules.recoveryCadence !== 'none'
      );
    }
    const improvement = payload.improvement.value;
    if (improvement)
      assert(improvement.cycleMonth === payload.month && new Set(improvement.stages.map(s => s.id)).size === 4);
  } else {
    assert(payload.session.startsWith(`${payload.month}-`) && new Set(payload.stages.map(s => s.id)).size === 7);
    for (const stage of payload.stages) {
      if (stage.evidenceAt !== null)
        assert(
          payload.evidence.some(
            e =>
              stage.evidenceIds.includes(e.id) &&
              e.evidenceAt !== null &&
              time(e.evidenceAt) === time(stage.evidenceAt!)
          )
        );
      if (stage.status === 'running')
        assert(
          stage.startedAt && stage.leaseUntil && stage.evidenceAt && time(stage.leaseUntil) > time(stage.evidenceAt)
        );
      if (stage.status !== 'not-recorded') assert(stage.evidenceAt && stage.evidenceIds.length > 0);
      if (['skipped', 'blocked', 'failed'].includes(stage.status)) assert(stage.reasonCode);
      for (const [field, sid] of [
        ['progress', 'collection'],
        ['quality', 'report'],
        ['action', 'paper-action'],
        ['risk', 'risk'],
      ] as const)
        if (stage.id !== sid) assert(stage[field].availability === 'unsupported');
      if (stage.startedAt && stage.finishedAt) assert(time(stage.startedAt) <= time(stage.finishedAt));
      const historyValid = stage.quality.value?.historyValid.value;
      if (historyValid !== undefined && historyValid !== null)
        assert(payload.counts.universe.value !== null && historyValid <= payload.counts.universe.value);
      if (stage.progress.value)
        assert(
          stage.progress.value.processed <= stage.progress.value.total &&
            stage.progress.value.fetchErrors <= stage.progress.value.processed
        );
    }
    const candidates = payload.candidates.value;
    if (candidates) {
      assert(
        new Set(candidates.map(c => c.symbol)).size === candidates.length &&
          candidates.length === payload.counts.universe.value
      );
      assert(
        candidates.filter(c => c.collectorEligible.value === true).length === payload.counts.collectorEligible.value &&
          candidates.filter(c => c.collectorEligible.value === false).length === payload.counts.collectorExcluded.value
      );
      const ranks = candidates.flatMap(c => (c.rank.value === null ? [] : [c.rank.value]));
      assert(new Set(ranks).size === ranks.length);
      for (const [count, flag] of [
        ['ranked', 'signalQualified'],
        ['selected', 'selected'],
        ['watched', 'watched'],
      ] as const)
        if (payload.counts[count].availability === 'recorded')
          assert(
            candidates.every(c => c[flag].availability === 'recorded') &&
              payload.counts[count].value === candidates.filter(c => c[flag].value === true).length
          );
    }
  }
  return payload;
}
function parseSummary(value: unknown): SessionSummary {
  validate(value, definitions.summary!);
  const summary = value as SessionSummary;
  assert(new Set(summary.stages.map(s => s.id)).size === 7);
  return summary;
}
export {
  validate,
  validateReferences,
  parseOperations,
  parseSummary,
  time,
  type Operations,
  type MonthOperations,
  type SessionOperations,
  type SessionSummary,
  type Candidate,
  type Stage,
  type StageId,
  type Status,
  type Strategy,
  type Rules,
  type Fact,
};
