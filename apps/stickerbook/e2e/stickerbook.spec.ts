import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`boots the design-free app at ${viewport.width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page).toHaveTitle('Stickerbook');
    const main = page.getByRole('main', { name: 'Stickerbook' });
    await expect(main).toBeVisible();
    await expect(main).toBeEmpty();
    await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    const bounds = (await main.boundingBox())!;
    expect(bounds.width).toBe(viewport.width);
    expect(bounds.height).toBeGreaterThanOrEqual(viewport.height);
    expect(errors).toEqual([]);
  });
}
