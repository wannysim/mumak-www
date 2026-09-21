import { expect, test, type Page } from '@playwright/test';

import { TEST_ONLY_PAPER_ROW } from '../src/__tests__/fixtures/test-snapshot';

const REASON = '정기 리밸런싱';

async function mockSnapshots(page: Page, withReason = true) {
  const row = {
    ...structuredClone(TEST_ONLY_PAPER_ROW),
    payload: {
      ...structuredClone(TEST_ONLY_PAPER_ROW.payload),
      holdings: TEST_ONLY_PAPER_ROW.payload.holdings.map(holding => ({ ...holding, symbol: 'AMD' })),
      fills: TEST_ONLY_PAPER_ROW.payload.fills.map(fill => ({
        ...fill,
        symbol: 'AMD',
        ...(withReason ? { reason: REASON } : {}),
      })),
    },
  };
  // All data is test-only and fulfilled locally. No real project or account is contacted.
  await page.route('https://quant-e2e.supabase.co/**', async route => {
    if (new URL(route.request().url()).pathname === '/rest/v1/paper_snapshots') {
      await route.fulfill({ json: [row] });
    } else {
      await route.abort();
    }
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '테스트 운용 1기' })).toBeVisible();
}

async function chartBounds(page: Page) {
  const grid = page.locator('.recharts-cartesian-grid');
  await expect(grid).toBeVisible();
  // Scroll the HTML container: Firefox does not reliably scroll SVG groups.
  await page.getByRole('slider', { name: /^성과 시계열 탐색/ }).scrollIntoViewIfNeeded();
  const bounds = await grid.boundingBox();
  if (!bounds) throw new Error('Chart plot bounds unavailable');
  return bounds;
}

test('desktop chart values, metric switch, decision reason, and safe ticker navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await mockSnapshots(page);
  const bounds = await chartBounds(page);
  await page.mouse.move(bounds.x + 4, bounds.y + bounds.height / 2);
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('$100,000.00');
  await expect(tooltip).toContainText('0.00%');
  await page.mouse.move(bounds.x + bounds.width - 4, bounds.y + bounds.height / 2);
  await expect(tooltip).toContainText('$101,250.50');
  await expect(tooltip).toContainText('+1.25%');
  await page.getByRole('radio', { name: '수익률', exact: true }).click();
  await expect(page.getByRole('radio', { name: '수익률', exact: true })).toBeChecked();

  const reason = page.getByRole('button', { name: 'AMD 매수 결정 근거' });
  await reason.hover();
  await expect(page.getByRole('tooltip')).toContainText(REASON);
  await reason.click();
  await expect(page.getByRole('dialog', { name: 'AMD 매수 결정 근거' })).toContainText(REASON);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(reason).toBeFocused();
  await reason.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  const link = page.getByRole('link', { name: 'AMD 토스증권에서 보기 (새 탭)' }).first();
  await expect(link).toHaveAttribute('href', 'https://www.tossinvest.com/stocks/AMD');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('target', '_blank');
});

test('historical fills without reasons remain blank and the live tab requires login', async ({ page }) => {
  await mockSnapshots(page, false);
  await expect(page.getByRole('button', { name: /결정 근거/ })).toHaveCount(0);
  await page.getByRole('tab', { name: '실운용' }).click();
  await expect(page.getByRole('heading', { name: '실운용 원장 로그인' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '최근 체결' })).toHaveCount(0);
});

test.describe('touch dashboard', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('touch exposes values and decision details without overflow', async ({ page }) => {
    await mockSnapshots(page);
    const bounds = await chartBounds(page);
    await page.touchscreen.tap(bounds.x + 4, bounds.y + bounds.height / 2);
    await expect(page.getByRole('tooltip')).toContainText('$100,000.00');
    const reason = page.getByRole('button', { name: 'AMD 매수 결정 근거' });
    await reason.tap();
    const dialog = page.getByRole('dialog', { name: 'AMD 매수 결정 근거' });
    await expect(dialog).toContainText(REASON);
    const popup = await dialog.boundingBox();
    expect(popup!.x).toBeGreaterThanOrEqual(0);
    expect(popup!.x + popup!.width).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('heading', { name: '최근 체결' }).tap();
    await expect(dialog).toHaveCount(0);
  });
});
