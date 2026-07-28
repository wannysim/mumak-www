import { expect, test } from '@playwright/test';

test.describe('Font Check', () => {
  test('should display the licensed Korean font derivative on the page', async ({ page }) => {
    await page.goto('/');

    // Wait for the body element to be visible
    await expect(page.locator('body')).toBeVisible();

    // Check the computed font-family style of the body element
    const fontFamily = await page.evaluate(() => {
      const body = document.querySelector('body');
      return body ? window.getComputedStyle(body).fontFamily : '';
    });

    expect(fontFamily.toLowerCase()).toContain('mumak sans variable');

    const loadedFonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.load('16px "Mumak Sans Variable"', '한글');
    });
    expect(loadedFonts).toHaveLength(1);
  });

  test('should display Japanese titles in Noto Serif JP', async ({ page }) => {
    await page.goto('/');

    const japaneseTitle = page.getByRole('heading', { level: 1 }).locator('[lang="ja"]');

    await expect(japaneseTitle).toBeVisible();
    await expect(japaneseTitle).toHaveCSS('font-family', /Noto Serif JP Variable/);
  });

  test('should ship the upstream OFL notices with both bundled font families', async ({ request }) => {
    const [pretendardResponse, notoResponse] = await Promise.all([
      request.get('/licenses/pretendard-ofl.txt'),
      request.get('/licenses/noto-serif-jp-ofl.txt'),
    ]);

    expect(pretendardResponse.ok()).toBe(true);
    expect(await pretendardResponse.text()).toContain("Reserved Font Name 'Pretendard'");
    expect(notoResponse.ok()).toBe(true);
    expect(await notoResponse.text()).toContain('Google Inc.');
  });
});
