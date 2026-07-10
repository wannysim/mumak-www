import { expect, test } from '@playwright/test';

test.describe('Graph Page', () => {
  test('should load the graph page', async ({ page }) => {
    await page.goto('/en/graph');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/en\/graph/);
  });

  test('should display Garden and Blog tabs', async ({ page }) => {
    await page.goto('/en/graph');

    await expect(page.getByRole('tab', { name: 'Garden' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Blog' })).toBeVisible();
  });

  test('should default to Garden tab', async ({ page }) => {
    await page.goto('/en/graph');

    const gardenTab = page.getByRole('tab', { name: 'Garden' });
    await expect(gardenTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should switch to Blog tab and update URL', async ({ page }) => {
    await page.goto('/en/graph');

    const blogTab = page.getByRole('tab', { name: 'Blog' });
    await blogTab.click();

    await expect(page).toHaveURL(/tab=blog/);
    await expect(blogTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should display back button', async ({ page }) => {
    await page.goto('/en/graph');

    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  });

  test('should not display header and footer', async ({ page }) => {
    await page.goto('/en/graph');

    await expect(page.getByRole('link', { name: 'Wan Sim' })).not.toBeVisible();
    await expect(page.locator('footer')).not.toBeVisible();
  });

  test('should display theme and locale switchers', async ({ page }) => {
    await page.goto('/en/graph');

    await expect(page.getByRole('button', { name: /theme/i })).toBeVisible();
  });

  test('should render graph canvas or unsupported fallback', async ({ page }) => {
    await page.goto('/en/graph');
    await page.waitForLoadState('networkidle');

    const canvas = page.locator('canvas');
    const unsupported = page.getByText('3D graph is not available on this device');

    await expect(canvas.or(unsupported)).toBeVisible({ timeout: 10000 });
  });

  test('should work in Korean locale', async ({ page }) => {
    await page.goto('/ko/graph');

    await expect(page.getByRole('tab', { name: '가든' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '블로그' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  });

  test('back button leaves the immersive graph for the locale home when there is no in-site history', async ({
    page,
  }) => {
    // 그래프 Back은 in-site referrer가 있으면 router.back(), 없으면 locale 홈으로 폴백한다.
    // 직접 진입(referrer 없음)에서는 폴백 경로가 결정적으로 동작한다.
    await page.goto('/en/graph');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test('is reachable from the blog and garden section headers, deep-linked to the matching tab', async ({ page }) => {
    // 전역 nav의 형제 항목이 아니라 각 섹션 인덱스의 PageHeader 아래 진입점에서 연다.
    await page.goto('/en/garden');
    const gardenGraphLink = page.getByRole('link', { name: /Explore the graph/i });
    await expect(gardenGraphLink).toBeVisible();
    await gardenGraphLink.click();
    await expect(page).toHaveURL(/\/en\/graph\?tab=garden/);
    await expect(page.getByRole('tab', { name: 'Garden' })).toHaveAttribute('aria-selected', 'true');

    await page.goto('/en/blog');
    const blogGraphLink = page.getByRole('link', { name: /Explore the graph/i });
    await expect(blogGraphLink).toBeVisible();
    await blogGraphLink.click();
    await expect(page).toHaveURL(/\/en\/graph\?tab=blog/);
    await expect(page.getByRole('tab', { name: 'Blog' })).toHaveAttribute('aria-selected', 'true');
  });
});
