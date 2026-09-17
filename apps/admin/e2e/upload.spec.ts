import { expect, test } from '@playwright/test';

test('uploads directly to R2 and publishes a copyable React / MDX snippet', async ({ page }) => {
  const hash = 'a'.repeat(64);
  let authorization = '';
  let contentType = '';
  let transferAuthorization: string | undefined;
  await page.route('**/api/images/uploads', route =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ticketId: 'test-ticket',
        uploadUrl: 'https://test.r2.cloudflarestorage.com/test-upload',
        headers: { 'Content-Type': 'application/octet-stream', 'If-None-Match': '*' },
      }),
    })
  );
  await page.route('https://test.r2.cloudflarestorage.com/test-upload', route => {
    transferAuthorization = route.request().headers().authorization;
    return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
  });

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
  await page.getByLabel('업로드 토큰').fill('operator-e2e-only');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('로그인됨')).toBeVisible();
  await page.reload();
  await expect(page.getByText('로그인됨')).toBeVisible();
  await expect(page.getByLabel('업로드 토큰')).toHaveCount(0);
  await page.getByLabel('JPEG 이미지').setInputFiles({
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  });
  await page.getByLabel('대체 텍스트').fill('산 위로 떠오르는 해');
  await page.getByRole('button', { name: '이미지 발행' }).click();

  const snippet = page.getByRole('textbox', { name: 'React / MDX snippet' });
  await expect(snippet).toHaveValue(/https:\/\/img\.wannysim\.com\/blog\//);
  await expect(snippet).toHaveValue(/width="1600"/);
  await page.getByRole('radio', { name: 'Next.js', exact: true }).check();
  await expect(page.getByRole('textbox', { name: 'Next.js snippet' })).toHaveValue(/import Image from 'next\/image'/);
  await expect(page.getByRole('textbox', { name: 'Next.js snippet' })).toHaveValue(/width=\{1600\}/);
  await expect(page.getByRole('button', { name: '도메인 설정 복사' })).toBeVisible();
  await page.getByRole('radio', { name: 'HTML', exact: true }).check();
  await expect(page.getByRole('textbox', { name: 'HTML snippet' })).toHaveValue(/srcset=/);
  await page.getByRole('radio', { name: 'Markdown', exact: true }).check();
  await expect(page.getByRole('textbox', { name: 'Markdown snippet' })).toHaveValue(/^!\[/);
  expect(authorization).toBe('');
  expect(contentType).toBe('application/json');
  expect(transferAuthorization).toBeUndefined();
});

test('is excluded from indexing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('keeps a server-issued HttpOnly session across reload and clears it on logout', async ({ page, context }) => {
  await page.goto('/');
  await page.getByLabel('업로드 토큰').fill('wrong-token');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('토큰이 올바르지 않습니다.')).toBeVisible();
  await page.getByLabel('업로드 토큰').fill('operator-e2e-only');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('로그인됨')).toBeVisible();
  const cookie = (await context.cookies()).find(cookie => cookie.name === 'mumak-admin-session');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/' });
  expect(await page.evaluate(() => document.cookie)).not.toContain('mumak-admin-session');
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  await page.reload();
  await expect(page.getByLabel('JPEG 이미지')).toBeVisible();
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible();
  expect((await context.cookies()).some(cookie => cookie.name === 'mumak-admin-session')).toBe(false);
  const status = await page.evaluate(
    async () =>
      (
        await fetch('/api/images/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bytes: 10 }),
        })
      ).status
  );
  expect(status).toBe(401);
});

test('returns to login when an upload encounters a missing session', async ({ page, context }) => {
  await page.goto('/');
  await page.getByLabel('업로드 토큰').fill('operator-e2e-only');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await expect(page.getByText('로그인됨')).toBeVisible();
  await context.clearCookies();
  await page
    .getByLabel('JPEG 이미지')
    .setInputFiles({ name: 'test.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff]) });
  await page.getByLabel('대체 텍스트').fill('세션 만료 검증');
  await page.getByRole('button', { name: '이미지 발행' }).click();
  await expect(page.getByText('로그인이 만료되었습니다. 다시 로그인하세요.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible();
});
