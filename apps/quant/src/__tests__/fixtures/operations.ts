import { parseOperations, type SessionOperations } from '../../lib/operations-schema';
// Synthetic fixtures shared by unit/E2E tests; never actual market records.
import month from './operations-month.json';
const absent = () => ({ availability: 'unsupported', value: null, evidenceIds: [] });
const fact = (value: unknown) => ({ availability: 'recorded', value, evidenceIds: ['policy'] });
const { strategies: _strategies, improvement: _improvement, ...envelope } = month;
const session = {
  ...envelope,
  recordType: 'session',
  session: '2026-09-18',
  strategyVersion: absent(),
  ledgerAsOf: absent(),
  counts: {
    universe: fact(2),
    collectorEligible: fact(1),
    collectorExcluded: fact(1),
    ranked: absent(),
    selected: absent(),
    watched: absent(),
  },
  stages: ['collection', 'screening', 'decision', 'risk', 'paper-action', 'report', 'publication'].map(id => ({
    id,
    status: 'not-recorded',
    evidenceAt: null,
    startedAt: null,
    finishedAt: null,
    leaseUntil: null,
    nextExpectedAt: null,
    expectedBy: null,
    reasonCode: null,
    evidenceIds: [],
    progress: absent(),
    quality: absent(),
    action: absent(),
    risk: absent(),
  })),
  candidates: fact([
    {
      symbol: 'TEST',
      kind: 'equity',
      collectorEligible: fact(true),
      reasonCodes: fact([]),
      signalQualified: absent(),
      score: absent(),
      volatility: absent(),
      rank: absent(),
      selected: absent(),
      targetWeight: absent(),
      watched: absent(),
    },
    {
      symbol: 'ETF',
      kind: 'etf',
      collectorEligible: fact(false),
      reasonCodes: fact(['unverified-identity']),
      signalQualified: absent(),
      score: absent(),
      volatility: absent(),
      rank: absent(),
      selected: absent(),
      targetWeight: absent(),
      watched: absent(),
    },
  ]),
};
const SYNTHETIC_SESSION = parseOperations(session) as SessionOperations;
const SYNTHETIC_MONTH = parseOperations(month);
const SYNTHETIC_SUMMARY = {
  session: SYNTHETIC_SESSION.session,
  counts: SYNTHETIC_SESSION.counts,
  stages: SYNTHETIC_SESSION.stages.map(({ id, status, evidenceAt, reasonCode }) => ({
    id,
    status,
    evidenceAt,
    reasonCode,
  })),
};
export { SYNTHETIC_SESSION, SYNTHETIC_MONTH, SYNTHETIC_SUMMARY };
