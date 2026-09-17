import { expect, test } from '@playwright/test';

const asset = 'a'.repeat(64);
const file = (extension: string) => ({
  key: `blog/${asset}/content-v1/image.${extension}`,
  bytes: 1024,
  modifiedAt: '2026-09-18T00:00:00Z',
  url: `https://img.wannysim.com/blog/${asset}/content-v1/image.${extension}`,
});

test('browses stored images with pagination, paths, public URLs and refresh', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/images/library*', route => {
    requests++;
    const more = new URL(route.request().url()).searchParams.has('cursor');
    return route.fulfill({ json: { files: more ? [file('webp')] : [file('jpg')], cursor: more ? null : 'next' } });
  });
  await page.route('https://img.wannysim.com/**', route =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#ddd"/></svg>',
    })
  );
  await page.goto('/');
  await page.getByLabel('업로드 토큰').fill('operator-e2e-only');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByLabel('대체 텍스트').fill('입력 중인 설명');
  await page.getByRole('button', { name: '이미지 보관함', exact: true }).click();
  await expect(page.getByText('1장 · 1개 파일 · 1.0 KiB (불러온 기준)')).toBeVisible();
  await page.getByRole('button', { name: '더 불러오기' }).click();
  await expect(page.getByRole('button', { name: '더 불러오기' })).toHaveCount(0);
  await page.getByRole('button', { name: `${asset} 폴더 열기` }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'content-v1 폴더 열기' }).click();
  await expect(page.getByRole('textbox', { name: 'image.jpg 공개 주소' })).toHaveValue(file('jpg').url);
  await expect(page.getByRole('img', { name: 'image.jpg', exact: true })).toHaveJSProperty('naturalWidth', 320);
  await expect(page.getByRole('link', { name: 'image.webp 새 창에서 보기' })).toHaveAttribute('href', file('webp').url);
  await expect(page.getByText('1장 · 2개 파일 · 2.0 KiB')).toBeVisible();
  await page.getByRole('button', { name: 'blog', exact: true }).click();
  await expect(page.getByRole('button', { name: `${asset} 폴더 열기` })).toBeVisible();
  await page.getByRole('button', { name: '새로고침' }).click();
  await expect(page.getByText('1장 · 1개 파일 · 1.0 KiB (불러온 기준)')).toBeVisible();
  expect(requests).toBe(3);
  await page.getByRole('button', { name: '이미지 업로드', exact: true }).click();
  await expect(page.getByLabel('대체 텍스트')).toHaveValue('입력 중인 설명');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('shows empty/error states and returns to login when browsing with an expired session', async ({
  page,
  context,
}) => {
  await page.route('**/api/images/library', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.goto('/');
  await page.getByLabel('업로드 토큰').fill('operator-e2e-only');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('button', { name: '이미지 보관함', exact: true }).click();
  await expect(page.getByRole('region', { name: '이미지 보관함' }).getByRole('alert')).toBeVisible();
  await page.route('**/api/images/library', route => route.fulfill({ json: { files: [], cursor: null } }));
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByText('이 폴더에 저장된 이미지가 없습니다.')).toBeVisible();
  await page.unroute('**/api/images/library');
  await context.clearCookies();
  await page.getByRole('button', { name: '새로고침' }).click();
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible();
});
