import { expect, test, type Locator } from '@playwright/test';

async function checkTargets(scope: Locator, count: number, surfaceSize = 28) {
  const targets = scope.locator('[data-slot="icon-button"]:visible');
  await expect(targets).toHaveCount(count);
  const boxes = [];
  for (const target of await targets.all()) {
    const box = await target.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBe(44);
    expect(box!.height).toBe(44);
    const surface = await target.locator('[data-slot="icon-button-surface"]').boundingBox();
    expect(surface!.width).toBe(surfaceSize);
    boxes.push(box!);
  }
  boxes.sort((a, b) => a.x - b.x);
  for (let i = 1; i < boxes.length; i++)
    expect(boxes[i]!.x).toBeGreaterThanOrEqual(boxes[i - 1]!.x + boxes[i - 1]!.width);
}

for (const locale of ['ko', 'en'])
  for (const theme of ['light', 'dark']) {
    test(`${locale}/${theme}: C header fits, Home routes and menu/search return focus`, async ({ page }) => {
      await page.addInitScript(value => localStorage.setItem('theme', value), theme);
      await page.goto(`/${locale}/blog`);
      const header = page.locator('header[data-visible]');
      const menuName = locale === 'ko' ? '내비게이션 열기' : 'Open navigation';
      const searchName = locale === 'ko' ? '사이트 검색' : 'Search the site';
      await expect(header.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
      await expect(header.getByRole('link', { name: 'Home', exact: true })).not.toHaveAttribute('aria-current');
      await expect(header.getByRole('link', { name: 'Wan Sim' })).toHaveCount(0);
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /light/);
      for (const width of [320, 390, 640, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await checkTargets(header, width < 640 ? 4 : width < 768 ? 3 : 2);
        const nav = header.getByRole('navigation');
        expect((await nav.boundingBox())!.height).toBe(65); // 64px content + border
        const buttons = await header.locator('button:visible').all();
        for (const button of buttons) {
          const b = (await button.boundingBox())!;
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x + b.width).toBeLessThanOrEqual(width);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      const trigger = header.getByRole('button', { name: menuName, exact: true });
      await trigger.focus();
      await expect(trigger).toHaveCSS('outline-width', '2px');
      await expect(trigger).toHaveCSS('outline-offset', '2px');
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('link', { name: 'Home', exact: true })).not.toHaveAttribute('aria-current');
      await dialog.getByRole('link', { name: 'Home', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(dialog.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');
      const close = dialog.getByRole('button', { name: locale === 'ko' ? '닫기' : 'Close', exact: true });
      const closeBox = (await close.boundingBox())!;
      expect(closeBox.width).toBe(44);
      const homeBox = (await dialog.getByRole('link', { name: 'Home', exact: true }).boundingBox())!;
      expect(homeBox.y).toBeGreaterThanOrEqual(closeBox.y + closeBox.height);
      await close.click();
      await expect(trigger).toBeFocused();
      const search = header.getByRole('button', { name: searchName, exact: true });
      await search.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('combobox')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(search).toBeFocused();
      await trigger.focus();
      await search.click();
      await expect(page.getByRole('combobox')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(search).toBeFocused();
      // A keyboard shortcut returns to its original control, not always the search trigger.
      await trigger.focus();
      await page.keyboard.press('Control+k');
      await expect(page.getByRole('combobox')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      // If the opener disappears at a breakpoint, restore the visible search trigger.
      for (const width of [1280, 390]) {
        await search.focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('combobox')).toBeFocused();
        await page.setViewportSize({ width, height: 900 });
        await page.keyboard.press('Escape');
        await expect(search).toBeFocused();
      }
      const themeButton = header.getByRole('button', { name: locale === 'ko' ? '테마 변경' : 'Change theme' });
      await themeButton.click();
      await page.getByRole('menuitemradio', { name: 'System', exact: true }).click();
      await expect(themeButton).toBeFocused();
      await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('system');
      await header.getByRole('button', { name: locale === 'ko' ? '언어 변경' : 'Change language' }).click();
      await page.getByRole('menuitemradio', { name: locale === 'ko' ? /English/ : /한국어/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale === 'ko' ? 'en' : 'ko'}$`));
    });

    test(`${locale}/${theme}: graph toolbar shares targets and keeps its separate back action`, async ({ page }) => {
      await page.addInitScript(value => localStorage.setItem('theme', value), theme);
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto(`/${locale}/graph`);
      const back = page.getByRole('button', { name: locale === 'ko' ? '뒤로 가기' : 'Back', exact: true });
      await expect(back).toBeVisible();
      const toolbar = back.locator('..');
      const targets = toolbar.locator('[data-slot="icon-button"]');
      await expect(targets).toHaveCount(3);
      for (const target of await targets.all()) {
        expect((await target.boundingBox())!.width).toBe(44);
      }
      expect((await back.locator('[data-slot="icon-button-surface"]').boundingBox())!.width).toBe(36);
      await expect(page.locator('header[data-visible]')).toHaveCount(0);
      const searchControl = page.getByRole('button', {
        name: locale === 'ko' ? '노드 검색...' : 'Search nodes...',
        exact: true,
      });
      const backBox = (await back.boundingBox())!;
      const searchBox = (await searchControl.boundingBox())!;
      expect(searchBox.y - (backBox.y + backBox.height)).toBeGreaterThanOrEqual(8);
      await back.focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`/${locale}$`));
    });
  }
