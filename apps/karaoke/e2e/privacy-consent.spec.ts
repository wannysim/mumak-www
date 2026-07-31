import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('requires privacy consent before loading YouTube', async ({ page }) => {
  const youtubeRequests: string[] = [];
  page.on('request', request => {
    if (request.url().includes('youtube.com')) youtubeRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '재생 전 확인' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'YouTube 이용약관' })).toBeVisible();
  expect(youtubeRequests).toEqual([]);

  await page.getByRole('button', { name: '동의하고 시작' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => youtubeRequests.length).toBeGreaterThan(0);
});
