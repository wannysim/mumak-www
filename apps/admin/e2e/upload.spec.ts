import { expect, test } from '@playwright/test';

test('publishes a raw JPEG and returns a copyable MDX snippet', async ({ page }) => {
  const hash = 'a'.repeat(64);
  let authorization = '';
  let contentType = '';

  await page.route('**/api/images', async route => {
    authorization = route.request().headers().authorization ?? '';
    contentType = route.request().headers()['content-type'] ?? '';
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        assetId: hash,
        width: 1600,
        height: 1067,
        urls: {
          jpeg: `https://img.wannysim.com/blog/${hash}/content-v1/image.jpg`,
          webp: `https://img.wannysim.com/blog/${hash}/content-v1/image.webp`,
        },
      }),
    });
  });

  await page.goto('/');
  await page.getByLabel('JPEG 이미지').setInputFiles({
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await page.getByLabel('업로드 토큰').fill('operator-secret');
  await page.getByLabel('대체 텍스트').fill('산 위로 떠오르는 해');
  await page.getByRole('button', { name: '이미지 발행' }).click();

  const snippet = page.getByRole('textbox', { name: 'MDX snippet' });
  await expect(snippet).toHaveValue(/https:\/\/img\.wannysim\.com\/blog\//);
  await expect(snippet).toHaveValue(/width="1600"/);
  expect(authorization).toBe('Bearer operator-secret');
  expect(contentType).toBe('application/octet-stream');
});

test('is excluded from indexing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
