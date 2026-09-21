export const TEST_ONLY_PAPER_PAYLOAD = {
  schemaVersion: 1,
  mode: 'paper',
  episodeId: 'paper-2026',
  month: '2026-09',
  label: '테스트 운용 1기',
  currency: 'USD',
  status: 'active',
  startedAt: '2026-09-15T00:00:00.000Z',
  asOf: '2026-09-21T05:30:00.000Z',
  exportedAt: '2026-09-21T05:31:00.000Z',
  source: 'forward-paper-ledger',
  baselineKind: 'inception',
  summary: {
    startingNav: '100000.00',
    currentNav: '101250.50',
    cash: '21250.50',
    netContributions: '0',
    profit: '1250.50',
    returnPct: '1.2505',
    returnMethod: 'simple-no-flows',
  },
  holdings: [
    {
      symbol: 'TEST',
      quantity: '100',
      averageCost: '790.00',
      markPrice: '800.00',
      markAsOf: '2026-09-21T05:29:00.000Z',
      marketValue: '80000.00',
      unrealizedPnl: '1000.00',
      returnPct: '1.2658',
    },
  ],
  history: [
    { at: '2026-09-15T00:00:00.000Z', nav: '100000.00', profit: '0', returnPct: '0' },
    { at: '2026-09-21T05:30:00.000Z', nav: '101250.50', profit: '1250.50', returnPct: '1.2505' },
  ],
  fills: [
    {
      id: 'test-fill-1',
      at: '2026-09-15T01:00:00.000Z',
      symbol: 'TEST',
      side: 'buy',
      quantity: '100',
      price: '790.00',
      commission: '0.50',
    },
  ],
  notes: ['테스트 전용 픽스처이며 프로덕션 번들에 포함하지 않습니다.'],
} as const;

export const TEST_ONLY_PAPER_ROW = {
  episode_id: 'paper-2026',
  month: '2026-09',
  as_of: '2026-09-21T05:30:00.000Z',
  payload: TEST_ONLY_PAPER_PAYLOAD,
} as const;
