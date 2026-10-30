import { PGlite } from '@electric-sql/pglite';
import { expect, test, type Page, type Request, type TestInfo } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';

import { TEST_ONLY_PAPER_ROW } from '../src/__tests__/fixtures/test-snapshot';

type Kind = 'month' | 'list' | 'session';
type Attempt = { kind: Kind; month: string | null; retry: string | undefined; at: number; request: Request };
type FetchObservation = { url: string; aborted: boolean; settled: boolean; ignoreSignal: boolean };
type ObservedWindow = Window & {
  resilienceFetches: FetchObservation[];
  ignoreNextSessionSignal: boolean;
  resilienceCsp: { directive: string; sample: string; source: string; line: number; styles: string[] }[];
};

// Synthetic saved producer -> shipped SQL -> HTTP -> real createDashboardClient/SDK/App.
// No production endpoint, SDK stub, retry override or browser write is used.
let db: PGlite;
test.beforeAll(async () => {
  const payloads = JSON.parse(
    execFileSync('python3', ['-B', 'scripts/test_operations_adapter.py', '--synthetic-preview'], { encoding: 'utf8' })
  );
  db = new PGlite();
  await db.exec(
    'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;'
  );
  for (const name of [
    '001_dashboard.sql',
    '002_paper_publisher.sql',
    '003_fill_reason.sql',
    '004_paper_operations.sql',
  ])
    await db.exec(await fs.readFile(`supabase/migrations/${name}`, 'utf8'));
  for (const payload of Object.values(payloads)) {
    const p = payload as { recordType: string };
    await db.query(`SELECT public.publish_paper_operations_${p.recordType}($1::jsonb,0)`, [JSON.stringify(payload)]);
  }
});
test.afterAll(async () => db?.close());

async function connect(page: Page, fault: Kind | null = null) {
  const attempts: Attempt[] = [];
  const violations: ObservedWindow['resilienceCsp'] = [];
  const pageErrors: string[] = [];
  const consoleErrors: { text: string; url: string }[] = [];
  const unexpected: string[] = [];
  const pending: { attempt: Attempt; release: () => void; done: Promise<void> }[] = [];
  const state = { fault, hold: false, marker: 'TEST000', writes: 0 };
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push({ text: message.text(), url: message.location().url });
  });
  await page.addInitScript(() => {
    const observed = window as ObservedWindow;
    observed.resilienceFetches = [];
    observed.resilienceCsp = [];
    observed.ignoreNextSessionSignal = false;
    document.addEventListener('securitypolicyviolation', event => {
      observed.resilienceCsp.push({
        directive: event.effectiveDirective,
        sample: event.sample,
        source: event.sourceFile,
        line: event.lineNumber,
        styles: [...document.querySelectorAll('style')].map(style => style.textContent ?? ''),
      });
    });
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (!url.includes('/paper_operation_')) return original(input, init);
      const signal = init?.signal;
      const ignoreSignal = observed.ignoreNextSessionSignal && new URL(url).searchParams.has('session');
      if (ignoreSignal) observed.ignoreNextSessionSignal = false;
      const item = { url, aborted: signal?.aborted ?? false, settled: false, ignoreSignal };
      observed.resilienceFetches.push(item);
      signal?.addEventListener(
        'abort',
        () => {
          item.aborted = true;
        },
        { once: true }
      );
      try {
        // Only the explicitly named non-cooperative transport control withholds
        // propagation; native-abort tests below always forward the original signal.
        return await original(input, ignoreSignal ? { ...init, signal: undefined } : init);
      } finally {
        item.settled = true;
      }
    };
  });
  await page.route('https://quant-e2e.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') {
      state.writes++;
      await route.abort();
      return;
    }
    if (url.pathname === '/rest/v1/paper_snapshots') {
      const financial = structuredClone(TEST_ONLY_PAPER_ROW);
      financial.episode_id = 'synthetic-paper';
      financial.payload.episodeId = 'synthetic-paper';
      const older = structuredClone(financial);
      Object.assign(older, { month: '2026-08', as_of: '2026-08-31T05:30:00.000Z' });
      Object.assign(older.payload, { month: '2026-08', asOf: '2026-08-31T05:30:00.000Z', label: '8월 합성 시험' });
      await route.fulfill({ json: [financial, older] });
      return;
    }
    if (url.pathname === '/rest/v1/paper_observations') {
      await route.fulfill({ json: [] });
      return;
    }
    const table = url.pathname.split('/').at(-1);
    if (table !== 'paper_operation_months' && table !== 'paper_operation_sessions') {
      unexpected.push(url.pathname);
      await route.abort();
      return;
    }
    const kind: Kind =
      table === 'paper_operation_months' ? 'month' : url.searchParams.has('session') ? 'session' : 'list';
    const attempt: Attempt = {
      kind,
      month: url.searchParams.get('month'),
      retry: request.headers()['x-retry-count'],
      at: Date.now(),
      request,
    };
    attempts.push(attempt);
    if (state.fault === kind) {
      await route.fulfill({ status: 503, json: { code: 'unavailable', message: 'PRIVATE_SYNTHETIC_FAULT' } });
      return;
    }
    const columns = url.searchParams.get('select')!;
    expect(columns).toMatch(/^[a-z_,]+$/);
    const episode = url.searchParams.get('episode_id')?.slice(3);
    const month = url.searchParams.get('month')?.slice(3);
    const session = url.searchParams.get('session')?.slice(3);
    const result = await db.query<Record<string, unknown>>(
      `SELECT ${columns} FROM public.${table} WHERE episode_id=$1 AND month=$2${session ? ' AND session=$3' : ''}`,
      session ? [episode, month, session] : [episode, month]
    );
    const rows = result.rows.map(row =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          value instanceof Date
            ? key === 'session'
              ? value.toISOString().slice(0, 10)
              : value.toISOString().replace('Z', '+00:00')
            : key === 'revision'
              ? Number(value)
              : value,
        ])
      )
    );
    if (kind === 'session' && rows.length) {
      const row = rows[0] as { payload: { candidates: { value: { symbol: string }[] } } };
      row.payload.candidates.value.find(candidate => candidate.symbol === 'TEST000')!.symbol = state.marker;
    }
    if (state.hold && kind === 'session') {
      let release!: () => void;
      let done!: () => void;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const completed = new Promise<void>(resolve => {
        done = resolve;
      });
      pending.push({ attempt, release, done: completed });
      await gate;
      try {
        await route.fulfill({ json: rows });
      } finally {
        done();
      }
      return;
    }
    await route.fulfill({ json: rows });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '전략과 일별 운영' })).toBeVisible();
  return {
    state,
    attempts,
    pending,
    async diagnostics(info: TestInfo) {
      violations.push(...(await page.evaluate(() => (window as ObservedWindow).resilienceCsp)));
      // Keep raw diagnostics even when a security assertion fails.
      await expect(page.getByText('PRIVATE_SYNTHETIC_FAULT')).toHaveCount(0);
      // Keep the raw console diagnostics. Injected 503 network errors are not
      // CSP/page errors, and are never filtered from an existing clean observer.
      await info.attach('resilience-diagnostics', {
        contentType: 'application/json',
        body: JSON.stringify({
          attempts: attempts.map(({ request: _request, ...item }) => item),
          consoleErrors,
          pageErrors,
          violations,
          fetches: await page.evaluate(() => (window as ObservedWindow).resilienceFetches),
        }),
      });
      expect(violations).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(unexpected).toEqual([]);
      expect(state.writes).toBe(0);
      for (const error of consoleErrors) {
        expect(error.text).toMatch(/503/);
        expect(error.url).toContain('/rest/v1/paper_operation_');
      }
    },
  };
}

const panelFor = (page: Page) => page.getByRole('region', { name: 'PAPER 전략과 일별 운영' });
async function financialIntact(page: Page) {
  await expect(page.getByText('현재 NAV', { exact: true }).locator('..').locator('dd')).toHaveText('$101,250.50');
  const holdings = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '보유 종목', exact: true }) });
  await expect(holdings).toContainText('TEST');
  await expect(holdings).toContainText('$80,000.00');
  const fills = page.locator('section').filter({ has: page.getByRole('heading', { name: '최근 체결', exact: true }) });
  await expect(fills.getByRole('button', { name: 'TEST 매수 체결 상세' })).toBeVisible();
  await expect(fills).toContainText('조회 월 전체 1건');
}
async function visible(page: Page, value: 'hidden' | 'visible') {
  await page.evaluate(value => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
    document.dispatchEvent(new Event('visibilitychange'));
  }, value);
}

for (const kind of ['month', 'list', 'session'] as const) {
  test(`real SDK exhausts repeated503 for ${kind}, financial isolation and explicit recovery`, async ({
    page,
  }, info) => {
    const controls = await connect(page, kind === 'session' ? null : kind);
    const panel = panelFor(page);
    if (kind === 'session') {
      await expect(page.getByText('TEST000', { exact: true })).toBeVisible();
      controls.state.fault = kind;
      await page.getByRole('button', { name: '선택일 다시 조회' }).click();
      await expect(panel).toContainText('재조회 중 · 이전 성공 기록');
    }
    await financialIntact(page);
    const alert = panel.getByRole('alert');
    await expect(alert).toContainText('운영 자료 연결에 실패했습니다.', { timeout: 10_000 });
    const failed = controls.attempts.filter(
      a => a.kind === kind && (kind !== 'session' || a !== controls.attempts.find(a => a.kind === kind))
    );
    expect(failed.map(a => a.retry)).toEqual([undefined, '1', '2', '3']);
    for (const [index, minimum] of [1000, 2000, 4000].entries())
      expect(failed[index + 1]!.at - failed[index]!.at).toBeGreaterThanOrEqual(minimum);
    await expect(panel).not.toContainText('PRIVATE_SYNTHETIC_FAULT');
    if (kind !== 'month') await expect(panel).toContainText('정책 조회 성공');
    if (kind === 'month') await expect(page.getByText('TEST000', { exact: true })).toBeVisible();
    else await expect(page.getByText('TEST000', { exact: true })).toHaveCount(0);
    await financialIntact(page);
    controls.state.fault = null;
    await alert.getByRole('button', { name: '이 영역 다시 조회' }).click();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('TEST000', { exact: true })).toBeVisible();
    expect(controls.attempts.filter(a => a.kind === kind).at(-1)!.retry).toBeUndefined();
    await financialIntact(page);
    await controls.diagnostics(info);
  });
}

for (const transition of ['hidden', 'month', 'live', 'explicit-retry', 'poll'] as const) {
  test(`real SDK pending request aborts on ${transition} and fresh generation recovers`, async ({ page }, info) => {
    await page.clock.install({ time: new Date('2026-09-19T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-09-19T00:00:00Z'));
    const controls = await connect(page);
    await expect(page.getByText('TEST000', { exact: true })).toBeVisible();
    await financialIntact(page);
    controls.state.hold = true;
    controls.state.marker = 'OLDMARKER';
    await page.getByRole('button', { name: '선택일 다시 조회' }).click();
    await expect.poll(() => controls.pending.length).toBe(1);
    const heldFetchIndex = await page.evaluate(() =>
      (window as ObservedWindow).resilienceFetches.findLastIndex(f => !f.settled)
    );
    expect(heldFetchIndex).toBeGreaterThanOrEqual(0);
    await expect(panelFor(page)).toContainText('재조회 중 · 이전 성공 기록');
    controls.state.hold = false;
    controls.state.marker = 'NEWMARKER';
    if (transition === 'hidden') {
      await visible(page, 'hidden');
      await expect(panelFor(page)).toContainText('조회 일시정지 · 이전 성공 기록');
      const count = controls.attempts.length;
      await page.clock.runFor(60_000);
      expect(controls.attempts).toHaveLength(count);
    } else if (transition === 'month') {
      await page
        .getByRole('combobox', { name: '에피소드', exact: true })
        .selectOption({ label: '2026-08 · 8월 합성 시험' });
      await expect(panelFor(page)).toContainText('PAPER ONLY · 2026-08');
      await expect(panelFor(page)).toContainText('이 월의 일별 운영 기록이 없습니다.');
    } else if (transition === 'live') {
      await page.getByRole('tab', { name: '실운용' }).click();
      await expect(page.getByRole('heading', { name: '실운용 내역 로그인' })).toBeVisible();
      await expect(panelFor(page)).toHaveCount(0);
      const count = controls.attempts.length;
      await page.clock.runFor(60_000);
      expect(controls.attempts).toHaveLength(count);
    } else if (transition === 'poll') await page.clock.runFor(60_000);
    else await page.getByRole('button', { name: '선택일 다시 조회' }).click();
    await expect
      .poll(() =>
        page.evaluate(index => {
          const held = (window as ObservedWindow).resilienceFetches[index]!;
          return { aborted: held.aborted, settled: held.settled, ignoreSignal: held.ignoreSignal };
        }, heldFetchIndex)
      )
      .toEqual({ aborted: true, settled: true, ignoreSignal: false });
    controls.pending[0]!.release();
    await controls.pending[0]!.done;
    await expect(page.getByText('OLDMARKER', { exact: true })).toHaveCount(0);
    if (transition === 'hidden') await visible(page, 'visible');
    if (transition === 'month') {
      await page
        .getByRole('combobox', { name: '에피소드', exact: true })
        .selectOption({ label: '2026-09 · 테스트 운용 1기' });
    }
    if (transition === 'live') await page.getByRole('tab', { name: '모의 운용' }).click();
    await expect(page.getByText('NEWMARKER', { exact: true })).toBeVisible();
    await expect(panelFor(page)).not.toContainText('재조회 중 · 이전 성공 기록');
    await financialIntact(page);
    await controls.diagnostics(info);
  });
}

test('non-cooperative late HTTP response cannot replace a newer successful SDK generation', async ({ page }, info) => {
  const controls = await connect(page);
  await expect(page.getByText('TEST000', { exact: true })).toBeVisible();
  controls.state.hold = true;
  controls.state.marker = 'OLDMARKER';
  await page.evaluate(() => {
    (window as ObservedWindow).ignoreNextSessionSignal = true;
  });
  await page.getByRole('button', { name: '선택일 다시 조회' }).click();
  await expect.poll(() => controls.pending.length).toBe(1);
  controls.state.hold = false;
  controls.state.marker = 'NEWMARKER';
  await page.getByRole('button', { name: '선택일 다시 조회' }).click();
  await expect(page.getByText('NEWMARKER', { exact: true })).toBeVisible();
  controls.pending[0]!.release();
  await controls.pending[0]!.done;
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as ObservedWindow).resilienceFetches.filter(f => f.ignoreSignal && f.aborted && f.settled).length
      )
    )
    .toBe(1);
  await expect(page.getByText('OLDMARKER', { exact: true })).toHaveCount(0);
  await expect(page.getByText('NEWMARKER', { exact: true })).toBeVisible();
  await financialIntact(page);
  await controls.diagnostics(info);
});
