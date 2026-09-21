import { expect, test } from '@playwright/test';

test('shows the public dashboard boundary and protected tab on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: '퀀트 대시보드' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '모의 운용' })).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('tab', { name: '실운용' }).click();

  await expect(page.getByRole('tab', { name: '실운용' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: '실운용 로그인을 사용할 수 없습니다.' })).toBeVisible();
});
