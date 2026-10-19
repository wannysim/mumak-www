import { expect, test } from '@playwright/test';

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`login preserves its size and focus through pending, failure and retry (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({ width: reducedMotion === 'reduce' ? 390 : 1280, height: 800 });
    let release!: () => void;
    const pending = new Promise<void>(resolve => {
      release = resolve;
    });
    let requests = 0;
    await page.route('**/api/session', async route => {
      requests++;
      if (requests === 1) {
        await pending;
        await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
      } else {
        await route.continue();
      }
    });
    await page.goto('/');
    const input = page.getByLabel('업로드 토큰');
    await input.fill('operator-e2e-only');
    const idle = page.getByRole('button', { name: '로그인', exact: true });
    await idle.focus();
    const before = await idle.boundingBox();
    await page.keyboard.press('Enter');
    const busy = page.getByRole('button', { name: '로그인 중…', exact: true });
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await expect(busy).toBeFocused();
    await expect(page.getByRole('status')).toHaveText('로그인 중…');
    // Measure after the existing pressed transition settles, without a fixed sleep.
    await expect.poll(() => busy.boundingBox()).toEqual(before);
    const spinner = busy.locator('svg');
    await expect(spinner).toBeVisible();
    await expect(spinner).toHaveCSS('animation-name', reducedMotion === 'reduce' ? 'none' : 'spin');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    // aria-disabled deliberately retains focus; send a real pointer click to test the submit guard.
    const box = (await busy.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await input.focus();
    await page.keyboard.press('Enter');
    await expect(input).toHaveAttribute('readonly', '');
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(requests).toBe(1);
    await busy.focus();
    release();
    await expect(page.getByRole('status')).toHaveText('토큰이 올바르지 않습니다.');
    await expect(idle).toBeFocused();
    await expect.poll(() => idle.boundingBox()).toEqual(before);
    await page.keyboard.press('Space');
    await expect(page.getByText('로그인됨', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '로그아웃', exact: true })).toBeFocused();
    expect(requests).toBe(2);
  });
}
