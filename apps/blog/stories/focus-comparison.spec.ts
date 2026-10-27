import { expect, test } from '@playwright/test';

import { expectFocusIndicator } from '@/e2e/helpers/focus';
import en from '@/messages/en.json' with { type: 'json' };
import ko from '@/messages/ko.json' with { type: 'json' };

for (const [locale, messages] of Object.entries({ ko, en })) {
  for (const theme of ['light', 'dark']) {
    test(`${locale} / ${theme}: real Tab order and consistent candidate indicators`, async ({ page }) => {
      const t = messages.focusLab;
      await page.goto(
        `/iframe.html?id=learning-focus-comparison--compare&viewMode=story&globals=locale:${locale};theme:${theme}`
      );
      await expect(page.getByRole('heading', { name: t.title })).toBeVisible();

      for (const surface of ['background', 'muted']) {
        await page.getByLabel(t.surface, { exact: true }).selectOption(surface);
        await page.getByRole('button', { name: t.start }).click();
        const candidateIndicators = [];

        for (const heading of [t.current, t.candidate]) {
          const section = page.getByRole('region', { name: heading });
          for (const target of [
            section.getByRole('button', { name: t.save, exact: true }),
            section.getByRole('button', { name: t.cancel, exact: true }),
            section.getByRole('link', { name: t.cardTitle }),
            section.getByRole('link', { name: t.tag }),
          ]) {
            await page.keyboard.press('Tab');
            await expect(target).toBeFocused();
            await expect(target).toBeVisible();
            expect(await target.evaluate(element => element.matches(':focus-visible'))).toBe(true);

            if (heading === t.candidate) {
              const indicator = await expectFocusIndicator(target);
              candidateIndicators.push(indicator.color);
            }
          }
        }

        expect(new Set(candidateIndicators).size).toBe(1);
        // A text-emphasis change must not recolor the implemented focus indicator.
        const implemented = page.getByRole('region', { name: t.candidate });
        await implemented.evaluate(element => element.style.setProperty('--accent-foreground', 'rgb(0, 128, 0)'));
        expect((await expectFocusIndicator(implemented.getByRole('link', { name: t.tag }))).color).toBe(
          candidateIndicators[0]
        );
        await implemented.evaluate(element => element.style.removeProperty('--accent-foreground'));
        await page.keyboard.press('Shift+Tab');
        const candidate = page.getByRole('region', { name: t.candidate });
        await expect(candidate.getByRole('link', { name: t.cardTitle })).toBeFocused();
        const url = page.url();
        await page.keyboard.press('Enter');
        await expect(candidate.getByRole('status')).toHaveText(t.linkActivated);
        expect(page.url()).toBe(url);
      }

      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}
