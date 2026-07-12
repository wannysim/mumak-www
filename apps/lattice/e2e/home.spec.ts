import { expect, test } from '@playwright/test';

test.describe('Lattice Page', () => {
  test('should display the lattice stage', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(7);
    await expect(page.locator('[data-video-id]')).toHaveCount(4);
  });

  test('should render an ascii overlay canvas when the ascii filter is applied', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /ascii/ }).click();
    await page.locator('[data-video-id="bunny"] video').click();

    await expect(page.locator('[data-video-id="bunny"] canvas')).toBeVisible();
  });

  test('should apply a filter to a video via click fallback', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /mono/ }).click();
    await page.locator('[data-video-id="bunny"]').click();

    await expect(page.locator('[data-video-id="bunny"] video')).toHaveCSS('filter', /grayscale/);
  });

  test('should have responsive design', async ({ page }) => {
    await page.goto('/');

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible();

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible();
  });
});
