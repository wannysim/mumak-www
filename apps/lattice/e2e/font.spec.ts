import { expect, test } from '@playwright/test';

test.describe('Font Check', () => {
  test('should display Pretendard font on the page', async ({ page }) => {
    await page.goto('/');

    // 앱이 fixed 전체화면이라 body의 bounding box가 0이므로 h1 기준으로 렌더 완료를 기다린다
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible();

    // Check the computed font-family style of the body element
    const fontFamily = await page.evaluate(() => {
      const body = document.querySelector('body');
      return body ? window.getComputedStyle(body).fontFamily : '';
    });

    // Assert that Pretendard is included in the font-family string
    expect(fontFamily.toLowerCase()).toContain('pretendard');
  });
});
