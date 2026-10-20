import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { expectFocusIndicator } from '@/e2e/helpers/focus';

for (const locale of ['ko', 'en']) {
  for (const theme of ['light', 'dark']) {
    test(`${locale}/${theme}: shared controls retain an opaque outline and independent errors`, async ({ page }) => {
      await page.goto(
        `/iframe.html?id=components-focus-contract--controls&viewMode=story&globals=locale:${locale};theme:${theme}`
      );
      const button = page.getByRole('button', { name: 'Button', exact: true });
      await expect(button).toBeVisible();
      await page.keyboard.press('Tab');
      const controls = [
        button,
        page.getByRole('textbox', { name: 'Input', exact: true }),
        page.getByRole('textbox', { name: /Input · (오류 상태|Invalid)/ }),
        page.getByRole('textbox', { name: 'Textarea', exact: true }),
        page.getByRole('checkbox'),
        page.getByRole('switch'),
        page.getByRole('button', { name: 'Toggle', exact: true }),
        page.getByRole('radio', { name: 'Radio 1' }),
        page.getByRole('tab', { name: 'Tab 1' }),
        page.getByRole('tabpanel'),
        page.getByRole('combobox', { name: 'Select', exact: true }),
        page.getByRole('combobox', { name: 'NativeSelect', exact: true }),
        page.getByRole('button', { name: 'Accordion', exact: true }),
        page.getByRole('link', { name: 'Badge link' }),
        page.getByRole('menuitem', { name: 'Menu', exact: true }),
      ];
      for (const control of controls) {
        await control.focus();
        await expectFocusIndicator(control);
      }
      const invalid = page.getByRole('textbox', { name: /Input · (오류 상태|Invalid)/ });
      const normal = page.getByRole('textbox', { name: 'Input', exact: true });
      expect(await invalid.evaluate(el => getComputedStyle(el).borderColor)).not.toBe(
        await normal.evaluate(el => getComputedStyle(el).borderColor)
      );
      await normal.focus();
      await page.keyboard.press('Tab');
      await expect(invalid).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('textbox', { name: 'Textarea', exact: true })).toBeFocused();
      await page.setViewportSize({ width: 320, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const results = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
}

for (const theme of ['light', 'dark']) {
  test(`${theme}: composite surfaces share geometry without double focus indicators`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=components-focus-contract--controls&viewMode=story&globals=locale:en;theme:${theme}`
    );
    await page.keyboard.press('Tab');
    const reference = page.getByRole('button', { name: 'Button', exact: true });
    await reference.focus();
    const { color } = await expectFocusIndicator(reference);
    const input = page.getByRole('textbox', { name: 'InputGroup', exact: true });
    await input.focus();
    const group = page.locator('[data-slot=input-group]').filter({ has: input });
    await expect(group).toHaveCSS('outline-width', '2px');
    await expect(group).toHaveCSS('outline-offset', '2px');
    await expect(group).toHaveCSS('outline-color', color);
    await expect(input).toHaveCSS('outline-style', 'none');
    await page.keyboard.press('Tab');
    await expectFocusIndicator(page.getByRole('button', { name: 'InputGroup action' }));
    await expect(group).toHaveCSS('outline-style', 'none');

    const chips = page.getByRole('combobox', { name: 'Combobox chips' });
    await chips.focus();
    const chipsSurface = page.locator('[data-slot=combobox-chips]');
    await expect(chipsSurface).toHaveCSS('outline-width', '2px');
    await expect(chipsSurface).toHaveCSS('outline-color', color);
    await expect(chips).toHaveCSS('outline-style', 'none');

    const command = page.getByRole('combobox', { name: 'Command search' });
    await command.focus();
    const commandSurface = page.locator('[data-slot=input-group]').filter({ has: command });
    await expect(commandSurface).toHaveCSS('outline-width', '2px');
    await expect(commandSurface).toHaveCSS('outline-offset', '2px');
    await expect(commandSurface).toHaveCSS('outline-color', color);
    await expect(command).toHaveCSS('outline-style', 'none');
    await command.fill('Command');
    await expect(page.getByRole('option', { name: 'Command action' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('textbox', { name: 'OTP', exact: true }).focus();
    const activeSlot = page.locator('[data-slot=input-otp-slot][data-active=true]');
    await expect(activeSlot).toHaveCSS('outline-width', '2px');
    await expect(activeSlot).toHaveCSS('outline-offset', '2px');
    await expect(activeSlot).toHaveCSS('outline-color', color);
    await page.keyboard.type('1');
    await expect(page.locator('[data-slot=input-otp-slot]').nth(1)).toHaveAttribute('data-active', 'true');
  });

  test(`${theme}: selection and popup keyboard behavior survive focus migration`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=components-focus-contract--controls&viewMode=story&globals=locale:en;theme:${theme}`
    );
    const checkbox = page.getByRole('checkbox');
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await expectFocusIndicator(checkbox);
    const radio = page.getByRole('radio', { name: 'Radio 1' });
    await radio.focus();
    // Radix moves focus in a timer and selects while the arrow key remains down.
    await page.keyboard.down('ArrowDown');
    try {
      await expect(page.getByRole('radio', { name: 'Radio 2' })).toBeChecked();
    } finally {
      await page.keyboard.up('ArrowDown');
    }
    await expectFocusIndicator(page.getByRole('radio', { name: 'Radio 2' }));
    await page.getByRole('tab', { name: 'Tab 1' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('aria-selected', 'true');
    await expectFocusIndicator(page.getByRole('tab', { name: 'Tab 2' }));
    const select = page.getByRole('combobox', { name: 'Select', exact: true });
    await select.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(page.getByRole('option', { name: 'Option 1', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option', { name: 'Option 2', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(select).toHaveText('Option 2');
    await expectFocusIndicator(select);
    const menu = page.getByRole('menuitem', { name: 'Menu', exact: true });
    await menu.focus();
    await expectFocusIndicator(menu);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Menu action', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expectFocusIndicator(menu);
  });
}
