import { PGlite } from '@electric-sql/pglite';
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';

import { TEST_ONLY_PAPER_ROW } from '../src/__tests__/fixtures/test-snapshot';

let db: PGlite;
test.beforeAll(async () => {
  const { payload } = JSON.parse(
    execFileSync('python3', ['-B', 'scripts/test_observation.py', '--synthetic-preview'], { encoding: 'utf8' })
  );
  db = new PGlite();
  await db.exec(
    'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;'
  );
  for (const f of [
    '001_dashboard.sql',
    '002_paper_publisher.sql',
    '003_fill_reason.sql',
    '004_paper_operations.sql',
    '005_paper_observations.sql',
  ])
    await db.exec(await fs.readFile(`supabase/migrations/${f}`, 'utf8'));
  await db.exec('SET ROLE service_role');
  await db.query('SELECT public.publish_paper_observation($1::jsonb,0)', [JSON.stringify(payload)]);
  await db.exec('RESET ROLE');
});
test.afterAll(async () => db?.close());
for (const width of [320, 390, 1440])
  test(`observation producer SQL UI and keyboard ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: width === 390 ? 'dark' : 'light', reducedMotion: 'reduce' });
    const errors: string[] = [];
    let writes = 0;
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', e => {
        document.documentElement.setAttribute('data-csp-error', e.effectiveDirective);
      });
    });
    let empty = false;
    await page.route('https://quant-e2e.supabase.co/**', async route => {
      const req = route.request();
      const u = new URL(req.url());
      if (req.method() !== 'GET') {
        writes++;
        await route.abort();
        return;
      }
      if (u.pathname === '/rest/v1/paper_snapshots') {
        const row = structuredClone(TEST_ONLY_PAPER_ROW);
        Object.assign(row, { episode_id: 'synthetic-paper' });
        Object.assign(row.payload, { episodeId: 'synthetic-paper' });
        await route.fulfill({ json: [row] });
        return;
      }
      if (u.pathname === '/rest/v1/paper_observations') {
        const rows = await db.query<Record<string, unknown>>('SELECT * FROM public.paper_observations');
        const normalized = rows.rows.map(row =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [
              k,
              v instanceof Date
                ? k === 'session'
                  ? v.toISOString().slice(0, 10)
                  : v.toISOString().replace('Z', '+00:00')
                : k === 'revision'
                  ? Number(v)
                  : v,
            ])
          )
        );
        await route.fulfill({ json: empty ? [] : normalized });
        return;
      }
      await route.fulfill({ json: [] });
    });
    await page.goto('/');
    await expect(page.getByText('TESTA', { exact: true })).toBeVisible();
    await expect(page.getByText('검토 완료 후보 / 적용 대기')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'DB 적재 확인' })).toBeVisible();
    await expect(page.getByText(/유효기간 경과/).first()).toBeVisible();
    await expect(page.getByRole('img', { name: /TESTA 가격 기준/ })).toBeVisible();
    const summary = page.getByText('후보 공식과 승인 범위', { exact: true });
    await summary.focus();
    await summary.press('Enter');
    await expect(page.getByText(/거리 d =/)).toBeVisible();
    await summary.press('Escape');
    await expect(summary).toBeFocused();
    await page.mouse.move(0, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('html').getAttribute('data-csp-error')).toBeNull();
    expect(errors).toEqual([]);
    expect(writes).toBe(0);
    await info.attach(`observation-${width}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
    empty = true;
    await page.getByRole('button', { name: '연결·위험 다시 조회' }).click();
    await expect(page.getByText('TESTA', { exact: true })).toHaveCount(0);
    await expect(page.getByText('해당 월 source-native receipt 미등록')).toBeVisible();
    await expect(page.getByRole('heading', { name: '보유 종목', exact: true })).toBeVisible();
    await page.getByRole('tab', { name: '실운용', exact: true }).click();
    await expect(page.getByText('TESTB', { exact: true })).toHaveCount(0);
    expect(writes).toBe(0);
  });
