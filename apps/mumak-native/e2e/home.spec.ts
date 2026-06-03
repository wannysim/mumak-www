import { expect, test } from '@playwright/test';

test.describe('mumak-native (web export)', () => {
  test('home tab renders the themed heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
  });

  test('explore route renders', async ({ page }) => {
    // 정적 export 라우트 직접 진입(탭바 셀렉터 결합 회피). 실 UI 구축 후 클릭 내비로 확장 가능.
    await page.goto('/explore');
    await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
  });
});
