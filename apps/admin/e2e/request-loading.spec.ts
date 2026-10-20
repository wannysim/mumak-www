import { expect, test, type Locator } from '@playwright/test';

async function size(button: Locator) {
  const box = await button.boundingBox();
  return box && { width: box.width, height: box.height };
}

test('publishing preserves size and focus, rejects duplicate submission and retries with native validation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let requests = 0;
  let release!: () => void;
  await page.route('**/api/images/uploads', async route => {
    requests++;
    await new Promise<void>(resolve => {
      release = resolve;
    });
    await route.fulfill({ status: 503, json: { error: '재시도할 수 있습니다.' } });
  });
  await page.goto('/');
  await page.getByLabel('업로드 토큰').fill('operator-e2e-only');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByLabel('업로드 이미지').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await page.getByLabel('대체 텍스트').fill('설명');
  const button = page.getByRole('button', { name: '이미지 발행', exact: true });
  const before = await size(button);
  await button.focus();
  await page.keyboard.press('Enter');
  const busy = page.getByRole('button', { name: '발행 중…' });
  await expect(busy).toBeFocused();
  await expect.poll(() => requests).toBe(1);
  await expect.poll(() => size(busy)).toEqual(before);
  await expect(page.getByLabel('업로드 이미지')).toBeDisabled();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  expect(requests).toBe(1);
  release();
  await expect(button).toBeFocused();
  await expect(page.getByText('재시도할 수 있습니다.')).toBeVisible();
  await button.click();
  await expect.poll(() => requests).toBe(2);
  release();
  await expect(button).toHaveAttribute('aria-busy', 'false');
});

test('library only animates the initiating action and restores focus after successful retry', async ({ page }) => {
  let requests = 0;
  let release!: (success: boolean) => void;
  await page.route('**/api/images/library*', async route => {
    requests++;
    if (requests === 1) {
      await route.fulfill({ json: { files: [], cursor: 'next' } });
      return;
    }
    const success = await new Promise<boolean>(resolve => {
      release = resolve;
    });
    await route.fulfill(
      success ? { json: { files: [], cursor: null } } : { status: 503, json: { error: 'unavailable' } }
    );
  });
  await page.goto('/');
  await page.getByLabel('업로드 토큰').fill('operator-e2e-only');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByRole('button', { name: '이미지 보관함', exact: true }).click();
  const more = page.getByRole('button', { name: '더 불러오기' });
  await expect(more).toBeVisible();
  const before = await size(more);
  await more.focus();
  await page.keyboard.press('Enter');
  const busyMore = page.getByRole('button', { name: '더 불러오는 중…' });
  await expect(busyMore).toBeFocused();
  await expect.poll(() => requests).toBe(2);
  await expect.poll(() => size(busyMore)).toEqual(before);
  const refresh = page.getByRole('button', { name: '새로고침', exact: true });
  await expect(refresh).toBeDisabled();
  await expect(refresh).toHaveAttribute('aria-busy', 'false');
  await page.keyboard.press('Space');
  expect(requests).toBe(2);
  release(false);
  const retry = page.getByRole('button', { name: '다시 시도' });
  await expect(retry).toBeVisible();
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '재시도 중…' })).toBeFocused();
  await expect.poll(() => requests).toBe(3);
  release(true);
  await expect(retry).toHaveCount(0);
  await expect(refresh).toBeFocused();
  const refreshSize = await size(refresh);
  await page.keyboard.press('Enter');
  const busyRefresh = page.getByRole('button', { name: '새로고침 중…' });
  await expect(busyRefresh).toBeFocused();
  await expect.poll(() => requests).toBe(4);
  await expect.poll(() => size(busyRefresh)).toEqual(refreshSize);
  release(true);
  await expect(refresh).toBeFocused();
});

test('logout preserves focus through failure and returns it to the login input after success', async ({ page }) => {
  let deletes = 0;
  let release!: () => void;
  await page.route('**/api/session', async route => {
    if (route.request().method() !== 'DELETE' || ++deletes > 1) {
      await route.continue();
      return;
    }
    await new Promise<void>(resolve => {
      release = resolve;
    });
    await route.fulfill({ status: 503, json: {} });
  });
  await page.goto('/');
  await page.getByLabel('업로드 토큰').fill('operator-e2e-only');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  const logout = page.getByRole('button', { name: '로그아웃', exact: true });
  await expect(logout).toBeFocused();
  const before = await size(logout);
  await page.keyboard.press('Enter');
  const busy = page.getByRole('button', { name: '로그아웃 중…' });
  await expect(busy).toBeFocused();
  await expect.poll(() => deletes).toBe(1);
  await expect.poll(() => size(busy)).toEqual(before);
  await page.keyboard.press('Space');
  expect(deletes).toBe(1);
  release();
  await expect(logout).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('업로드 토큰')).toBeFocused();
  expect(deletes).toBe(2);
});
