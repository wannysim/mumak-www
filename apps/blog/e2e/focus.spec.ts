import { expect, test, type Locator, type Page } from '@playwright/test';

import { expectFocusIndicator } from '@/e2e/helpers/focus';

async function tabTo(page: Page, target: Locator, key: string) {
  for (let step = 0; step < 60; step++) {
    await page.keyboard.press(key);
    if (await target.evaluate(element => element === document.activeElement)) return;
  }
  throw new Error('Could not reach target through the page Tab order');
}

for (const section of ['blog', 'garden']) {
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 1280]) {
      test(`${section} / ${theme} / ${width}: header, card and tag focus`, async ({ page, browserName }) => {
        // macOS WebKit uses Option+Tab for all interactive items under the default
        // keyboard setting. Keep real keyboard navigation rather than calling focus().
        // https://support.apple.com/guide/safari/cpsh003/mac
        const tabKey = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
        await page.setViewportSize({ width, height: 900 });
        await page.addInitScript(value => localStorage.setItem('theme', value), theme);
        await page.goto(`/ko/${section}`);
        await expect(page.locator('html')).toHaveClass(new RegExp(theme));
        const search = page.getByRole('button', { name: '사이트 검색', exact: true });
        await tabTo(page, search, tabKey);
        const buttonIndicator = await expectFocusIndicator(search);

        const card = page.getByRole('main').locator('[data-slot="content-card"]').first();
        const title = card.locator('[data-slot="content-card-link"]');
        await tabTo(page, title, tabKey);
        const cardIndicator = await expectFocusIndicator(title);
        expect(cardIndicator.color).toBe(buttonIndicator.color);
        const bounds = await card.boundingBox();
        expect(bounds).not.toBeNull();
        if (bounds) {
          expect(bounds.x).toBeGreaterThanOrEqual(4);
          expect(bounds.x + bounds.width + 4).toBeLessThanOrEqual(width);
        }

        const tag = card.getByRole('link', { name: /^#/ }).first();
        await page.keyboard.press(tabKey);
        expect((await expectFocusIndicator(tag)).color).toBe(cardIndicator.color);
        await expect(card).not.toHaveCSS('outline-style', 'solid');
      });
    }
  }
}
