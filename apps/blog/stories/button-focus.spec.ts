import { expect, test } from '@playwright/test';

import { expectFocusIndicator } from '@/e2e/helpers/focus';

for (const theme of ['light', 'dark']) {
  test(`${theme}: all Button variants and asChild share the foundation focus`, async ({ page }) => {
    await page.goto(`/iframe.html?id=learning-button-focus--states&viewMode=story&globals=theme:${theme}`);
    await expect(page.getByRole('button', { name: 'default', exact: true })).toBeVisible();
    const colors = [];
    for (const name of ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link', 'aria-invalid', 'asChild']) {
      await page.keyboard.press('Tab');
      const target = page.getByRole(name === 'asChild' ? 'link' : 'button', { name, exact: true });
      colors.push((await expectFocusIndicator(target)).color);
    }
    expect(new Set(colors).size).toBe(1);
  });
}
