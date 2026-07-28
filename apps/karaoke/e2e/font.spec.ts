import { expect, test } from '@playwright/test';

test.describe('Font Check', () => {
  test('should display Pretendard font on the page', async ({ page }) => {
    await page.goto('/');

    // Wait for the body element to be visible
    await expect(page.locator('body')).toBeVisible();

    // Check the computed font-family style of the body element
    const fontFamily = await page.evaluate(() => {
      const body = document.querySelector('body');
      return body ? window.getComputedStyle(body).fontFamily : '';
    });

    // Assert that Pretendard is included in the font-family string
    expect(fontFamily.toLowerCase()).toContain('pretendard');
  });
});
