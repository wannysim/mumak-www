import { expect, test } from '@playwright/test';

import { expectFocusIndicator } from '@/e2e/helpers/focus';

for (const theme of ['light', 'dark']) {
  test(`${theme}: product default button uses the selected colors and native keyboard behavior`, async ({ page }) => {
    await page.goto(`/iframe.html?id=components-button--playground&args=variant:default&globals=theme:${theme}`);
    const button = page.getByRole('button');
    const background = theme === 'light' ? 'oklch(0.58 0.18 45)' : 'oklch(0.75 0.18 50)';
    await expect(button).toHaveCSS('background-color', background);
    await expect(button).toHaveCSS('color', theme === 'light' ? 'oklch(1 0 0)' : 'oklch(0.15 0.02 45)');
    await button.hover();
    if (theme === 'light') await expect(button).toHaveCSS('background-color', 'oklch(0.52 0.18 45)');
    else await expect(button).not.toHaveCSS('background-color', background);
    await page.mouse.down();
    await expect(button).toHaveCSS('translate', '0px 1px');
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await button.focus();
    await page.keyboard.down('Space');
    await expectFocusIndicator(button);
    await expect(button).toHaveCSS('translate', '0px 1px');
    await expect(button).toHaveCSS('background-color', background);
    await expect(page.getByRole('status')).toHaveText('버튼 실행 1회');
    await page.keyboard.up('Space');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toHaveText('버튼 실행 3회');
    await page.goto(`/iframe.html?id=components-button--playground&args=variant:link&globals=theme:${theme}`);
    await expect(page.getByRole('button')).toHaveCSS(
      'color',
      theme === 'light' ? 'oklch(0.65 0.2 45)' : 'oklch(0.75 0.18 50)'
    );
  });
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`${reducedMotion}: button transition respects motion preference`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/iframe.html?id=components-button--playground&args=variant:default');
    const button = page.getByRole('button');
    await expect(button).toHaveCSS('transition-property', reducedMotion === 'reduce' ? 'none' : 'all');
    await button.hover();
    await expect(button).toHaveCSS('background-color', 'oklch(0.52 0.18 45)');
    if (reducedMotion === 'reduce') expect(await button.evaluate(element => element.getAnimations().length)).toBe(0);
  });
}

test.describe('Product touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('a tap activates once and returns to resting color', async ({ page }) => {
    await page.goto('/iframe.html?id=components-button--playground&args=variant:default');
    await page.getByRole('button').tap();
    await expect(page.getByRole('button')).toHaveCSS('background-color', 'oklch(0.58 0.18 45)');
    await expect(page.getByRole('status')).toHaveText('버튼 실행 1회');
  });
});
