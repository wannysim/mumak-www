import { PGlite } from '@electric-sql/pglite';
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';

import { TEST_ONLY_PAPER_ROW } from '../src/__tests__/fixtures/test-snapshot';

// Entire chain uses explicitly synthetic saved files, the real Python producer and
// the shipped SQL/RPC. Only HTTP transport is local routing: no remote DB or broker.
let db: PGlite;
let writes = 0;
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
  ]) {
    await db.exec(await fs.readFile(`supabase/migrations/${name}`, 'utf8'));
  }
  await db.exec('SET ROLE service_role');
  for (const payload of Object.values(payloads)) {
    const p = payload as { recordType: string };
    const response = await db.query<{ revision: number }>(
      `SELECT public.publish_paper_operations_${p.recordType}($1::jsonb,0) AS revision`,
      [JSON.stringify(payload)]
    );
    expect(Number(response.rows[0]!.revision)).toBe(1);
  }
  await db.exec('RESET ROLE');
});
test.afterAll(async () => {
  await db?.close();
});

async function connect(page: Page) {
  const state = { failing: false, requests: 0 };
  await page.route('https://quant-e2e.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') {
      writes++;
      await route.abort();
      return;
    }
    if (url.pathname === '/rest/v1/paper_snapshots') {
      const financial = structuredClone(TEST_ONLY_PAPER_ROW);
      Object.assign(financial, { episode_id: 'synthetic-paper' });
      Object.assign(financial.payload, { episodeId: 'synthetic-paper' });
      const older = structuredClone(financial);
      Object.assign(older, { month: '2026-08', as_of: '2026-08-31T05:30:00.000Z' });
      Object.assign(older.payload, { month: '2026-08', asOf: '2026-08-31T05:30:00.000Z', label: '8월 합성 시험' });
      await route.fulfill({ json: [financial, older] });
      return;
    }
    const table = url.pathname.split('/').at(-1);
    if (!['paper_operation_months', 'paper_operation_sessions'].includes(table ?? '')) {
      await route.abort();
      return;
    }
    state.requests++;
    if (state.failing) {
      // A terminal transport/API error; 503 is retried inside supabase-js before our boundary sees it.
      await route.fulfill({ status: 400, json: { code: 'unavailable' } });
      return;
    }
    const episode = url.searchParams.get('episode_id')?.slice(3);
    const month = url.searchParams.get('month')?.slice(3);
    const session = url.searchParams.get('session')?.slice(3);
    const columns = url.searchParams.get('select')!;
    expect(columns).toMatch(/^[a-z_,]+$/);
    const rows = await db.query<Record<string, unknown>>(
      `SELECT ${columns} FROM public.${table} WHERE episode_id=$1 AND month=$2${session ? ' AND session=$3' : ''}`,
      session ? [episode, month, session] : [episode, month]
    );
    const normalized = rows.rows.map(row =>
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
    await route.fulfill({ json: normalized });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '전략과 일별 운영' })).toBeVisible();
  await expect(page.getByText('TEST000', { exact: true })).toBeVisible();
  return state;
}

type CspViolation = { directive: string; blockedURI: string };
type ObservedWindow = Window & { operationsCspViolations: CspViolation[] };

async function observeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(() => {
    const observed = window as ObservedWindow;
    observed.operationsCspViolations = [];
    document.addEventListener('securitypolicyviolation', event => {
      observed.operationsCspViolations.push({ directive: event.effectiveDirective, blockedURI: event.blockedURI });
    });
  });
  const violations = () => page.evaluate(() => (window as ObservedWindow).operationsCspViolations);
  return {
    errors,
    violations,
    async assertClean() {
      expect(await violations()).toEqual([]);
      expect(errors).toEqual([]);
    },
  };
}

for (const width of [320, 390, 1440]) {
  test(`producer SQL API UI, keyboard and responsive ${width}px`, async ({ page, browser }, info) => {
    const observed = await observeErrors(page);
    const { errors } = observed;
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: width === 390 ? 'dark' : 'light' });
    await connect(page);
    await observed.assertClean();
    const panel = page.getByRole('region', { name: 'PAPER 전략과 일별 운영' });
    await expect(panel.getByRole('option', { name: '선정 · 미제공' })).toHaveJSProperty('disabled', true);
    await expect(panel.getByRole('list', { name: '일별 자동화 단계' }).getByRole('listitem')).toHaveCount(7);
    await expect(panel).toContainText('데이터 수집 · 완료');
    await expect(panel).toContainText('PAPER 실행 · 기록 없음');
    await expect(page.getByText('DB 적재 확인')).toHaveCount(0);
    const formula = panel.locator('summary').filter({ hasText: '공식·배분·위험 규칙' });
    await formula.focus();
    await formula.press('Enter');
    await expect(panel.getByText(/S =/)).toBeVisible();
    await formula.press('Escape');
    await expect(panel.getByText(/S =/)).not.toBeVisible();
    await expect(formula).toBeFocused();
    await panel.getByRole('button', { name: '후보 다음' }).click();
    await expect(panel.getByRole('status')).toContainText('26–50 표시');
    await panel.getByRole('searchbox').fill('ETF');
    await expect(panel.getByRole('list', { name: '후보 목록' }).getByRole('listitem')).toHaveCount(1);
    await expect(panel).toContainText('상품·신원 미검증');
    await panel.getByRole('searchbox').fill('');
    await formula.click();
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter(el => el.getBoundingClientRect().right > innerWidth)
        .map(el => ({
          tag: el.tagName,
          text: el.textContent?.slice(0, 80),
          class: el.className,
          right: el.getBoundingClientRect().right,
        }))
    );
    if (overflow.length) console.log('overflow elements', JSON.stringify(overflow));
    await observed.assertClean();
    await test.step('auxiliary visual evidence in an independent context', async () => {
      // Screenshot preparation may inject a style blocked by WebKit's CSP. Never
      // capture on the acceptance page or clear/filter either observer's errors.
      const captureContext = await browser.newContext({
        baseURL: new URL(page.url()).origin,
        bypassCSP: false,
        viewport: { width, height: 1000 },
        reducedMotion: 'reduce',
        colorScheme: width === 390 ? 'dark' : 'light',
      });
      try {
        const capturePage = await captureContext.newPage();
        const capture = await observeErrors(capturePage);
        await connect(capturePage);
        const capturePanel = capturePage.getByRole('region', { name: 'PAPER 전략과 일별 운영' });
        await capturePanel.locator('summary').filter({ hasText: '공식·배분·위험 규칙' }).click();
        await capture.assertClean();
        try {
          await capturePanel.screenshot({ path: info.outputPath(`operations-${width}.png`) });
        } finally {
          // Flush queued CSP events before recording unfiltered tool diagnostics.
          await capturePage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))));
          await info.attach(`operations-${width}-capture-diagnostics`, {
            contentType: 'application/json',
            body: JSON.stringify({
              scope: 'auxiliary screenshot only; not product CSP acceptance',
              errors: capture.errors,
              violations: await capture.violations(),
            }),
          });
        }
      } finally {
        await captureContext.close();
      }
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await observed.assertClean();
    expect(writes).toBe(0);
  });
}

test('operation failure is isolated, retry clears error, month switch and LIVE clear candidates', async ({ page }) => {
  const state = await connect(page);
  state.failing = true;
  await page.getByRole('button', { name: '선택일 다시 조회' }).click();
  const panel = page.getByRole('region', { name: 'PAPER 전략과 일별 운영' });
  await expect(panel.getByRole('alert')).toContainText('연결에 실패');
  await expect(page.getByRole('heading', { name: '보유 종목' })).toBeVisible();
  await expect(page.getByText('TEST000', { exact: true })).toHaveCount(0);
  state.failing = false;
  await panel.getByRole('button', { name: '이 영역 다시 조회' }).click();
  await expect(page.getByText('TEST000', { exact: true })).toBeVisible();
  const picker = page.getByRole('combobox', { name: '에피소드', exact: true });
  await picker.selectOption({ label: '2026-08 · 8월 합성 시험' });
  await expect(panel).toContainText('이 월의 일별 운영 기록이 없습니다.');
  await expect(page.getByText('TEST000', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: '실운용' }).click();
  const calls = state.requests;
  await expect(page.getByRole('heading', { name: '실운용 내역 로그인' })).toBeVisible();
  await expect(panel).toHaveCount(0);
  expect(state.requests).toBe(calls);
  expect(writes).toBe(0);
});

test('product CSP observer rejects an inline style injected during a user action', async ({ page }) => {
  const observed = await observeErrors(page);
  await connect(page);
  await observed.assertClean();
  const search = page.getByRole('region', { name: 'PAPER 전략과 일별 운영' }).getByRole('searchbox');
  // A deliberately faulty application handler, not screenshot tooling. Exercise
  // the same observer/assertion as the acceptance cases after a real UI action.
  await search.evaluate(element => {
    element.addEventListener(
      'input',
      () => {
        const style = document.createElement('style');
        style.textContent = ':root { --operations-csp-probe: blocked; }';
        document.head.append(style);
      },
      { once: true }
    );
  });
  await search.fill('ETF');
  await expect(page.getByRole('list', { name: '후보 목록' }).getByRole('listitem')).toHaveCount(1);
  await expect.poll(observed.violations).toEqual([{ directive: 'style-src-elem', blockedURI: 'inline' }]);
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--operations-csp-probe'))
  ).toBe('');
  await expect(observed.assertClean()).rejects.toThrow();
  expect(writes).toBe(0);
});
