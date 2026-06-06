import { expect, test, type Page } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 320, height: 740 };

async function expectNoPageHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);

        return scrollWidth - viewportWidth;
      })
    )
    .toBeLessThanOrEqual(1);
}

test.describe('Content segment nav', () => {
  test('does not create page horizontal overflow on the mobile blog index', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/ko/blog');

    await expect(page.locator('[data-slot="content-segment-nav"]')).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });

  test('does not create page horizontal overflow on the mobile garden index', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/ko/garden');

    await expect(page.locator('[data-slot="content-segment-nav"]')).toBeVisible();
    await expectNoPageHorizontalOverflow(page);
  });
});
