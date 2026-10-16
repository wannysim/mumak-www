import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';

import { expectFocusIndicator } from '@/e2e/helpers/focus';

async function ratio(region: Locator) {
  return Number(await region.locator('[data-contrast-ratio]').getAttribute('data-contrast-ratio'));
}

test.describe('Touch hover regression', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  for (const theme of ['light', 'dark']) {
    test(`${theme}: touch does not leave a hover color or label after tapping`, async ({ page }) => {
      await page.goto(`/iframe.html?id=learning-button-contrast--hover&viewMode=story&globals=theme:${theme}`);
      expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
      for (const title of ['D · 밝기 조정', 'E · Hover 조정']) {
        const region = page.getByRole('region', { name: title, exact: true });
        const button = region.getByRole('button', { name: '저장하기', exact: true });
        await button.tap();
        await expect(button).toHaveCSS(
          'background-color',
          theme === 'light' ? 'oklch(0.58 0.18 45)' : 'oklch(0.75 0.18 50)'
        );
        await expect(region.getByRole('definition').first()).toHaveText('기본');
        await expect(region.getByRole('status')).toHaveText('실행 횟수: 1');
        await expect.poll(() => ratio(region)).toBeCloseTo(theme === 'light' ? 4.62 : 8.19, 1);
      }
    });
  }
});

for (const theme of ['light', 'dark']) {
  for (const surface of ['background', 'muted']) {
    test(`Hover / ${theme} / ${surface}: E changes only hover, with readable keyboard and pressed states`, async ({
      page,
    }) => {
      await page.goto(`/iframe.html?id=learning-button-contrast--hover&viewMode=story&globals=theme:${theme}`);
      await page.getByRole('combobox').selectOption(surface);
      for (const [index, title] of ['D · 밝기 조정', 'E · Hover 조정'].entries()) {
        const region = page.getByRole('region', { name: title, exact: true });
        const button = region.getByRole('button', { name: '저장하기', exact: true });
        const rest = theme === 'light' ? 4.62 : 8.19;
        await expect.poll(() => ratio(region)).toBeCloseTo(rest, 1);
        await button.hover();
        const hovered = theme === 'light' ? (index === 0 ? 5.0 : 5.9) : surface === 'background' ? 5.63 : 6.06;
        await expect.poll(() => ratio(region)).toBeCloseTo(hovered, 1);
        await page.mouse.down();
        await expect(button).toHaveCSS('translate', '0px 1px');
        await expect(region.getByRole('definition').first()).toHaveText('Pressed · 누르는 중');
        await expect.poll(() => ratio(region)).toBeCloseTo(hovered, 1);
        await page.mouse.up();
        await page.mouse.move(0, 0);
        await page.getByRole('combobox').focus();
        for (let step = 0; step <= index * 2; step += 1) await page.keyboard.press('Tab');
        await expectFocusIndicator(button);
        await expect.poll(() => ratio(region)).toBeCloseTo(rest, 1);
        await page.keyboard.down('Space');
        await expect(region.getByRole('definition').first()).toHaveText('Pressed · 누르는 중');
        await expect.poll(() => ratio(region)).toBeCloseTo(rest, 1);
        await page.keyboard.up('Space');
        await page.keyboard.press('Enter');
        await expect(region.getByRole('status')).toHaveText('실행 횟수: 3');
        await expect(region.getByRole('button', { name: '사용 불가' })).toBeDisabled();
      }
    });
  }
  for (const locale of ['ko', 'en']) {
    test(`Hover / ${theme} / ${locale}: both candidates fit mobile and pass axe`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(
        `/iframe.html?id=learning-button-contrast--hover&viewMode=story&globals=theme:${theme};locale:${locale}`
      );
      await expect(page.getByRole('region')).toHaveCount(2);
      await expect(page.locator('[data-contrast-ratio]')).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      const results = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
}

for (const refined of [false, true]) {
  test.describe(refined ? 'Refine' : 'Compare', () => {
    const story = `learning-button-contrast--${refined ? 'refine' : 'compare'}`;
    const titles = ['A · 적용 전', 'B · 배경 조정', refined ? 'D · 밝기 조정' : 'C · 글자 조정'];
    for (const theme of ['light', 'dark']) {
      for (const surface of ['background', 'muted']) {
        test(`${theme} / ${surface}: contrast follows real pointer and keyboard states`, async ({ page }) => {
          await page.goto(`/iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`);
          await page.getByRole('combobox').selectOption(surface);
          const readings = [];
          for (const [index, title] of titles.entries()) {
            const region = page.getByRole('region', { name: title, exact: true });
            const button = region.getByRole('button', { name: '저장하기', exact: true });
            const inactive = region.getByRole('button', { name: '사용 불가' });
            await expect(region.locator('[data-contrast-ratio]')).toBeVisible();
            await expect(region.getByRole('definition').first()).toHaveText('기본');
            const rest = await ratio(region);
            if (theme === 'light') {
              expect(rest).toBeCloseTo([3.34, 4.79, refined ? 4.62 : 5.67][index]!, 1);
            } else {
              expect(rest).toBeGreaterThan(7);
            }
            // Reference values include the disabled element's opacity, not just its CSS colors.
            const expectedDisabled =
              theme === 'dark'
                ? surface === 'background'
                  ? 2.78
                  : 3.08
                : (surface === 'background'
                    ? [1.86, 2.13, refined ? 2.12 : 1.99]
                    : [1.88, 2.16, refined ? 2.15 : 2.02])[index]!;
            await expect
              .poll(async () =>
                Number(await region.locator('[data-disabled-contrast]').getAttribute('data-disabled-contrast'))
              )
              .toBeCloseTo(expectedDisabled, 1);
            await button.hover();
            await expect(region.getByText('Hover · 마우스 올림', { exact: true })).toBeVisible();
            await expect.poll(() => button.evaluate(element => element.getAnimations().length)).toBe(0);
            const hover = await ratio(region);
            if (theme === 'light' && index === 0) expect(hover).toBeLessThan(rest);
            else expect(hover).toBeGreaterThanOrEqual(4.5);

            await page.mouse.down();
            await expect(region.getByText('Pressed · 누르는 중', { exact: true })).toBeVisible();
            await expect(button).toHaveCSS('translate', '0px 1px');
            expect(await ratio(region)).toBeCloseTo(hover, 1);
            await page.mouse.up();
            await expect(region.getByRole('status')).toHaveText('실행 횟수: 1');
            await page.mouse.move(0, 0);
            // Focus from the preceding selector establishes keyboard modality for every candidate.
            await page.getByRole('combobox').focus();
            // Each preceding candidate has a Save button and a details summary. Disabled is skipped.
            for (let step = 0; step <= index * 2; step += 1) await page.keyboard.press('Tab');
            await expectFocusIndicator(button);
            await expect(region.getByText('Focus · 키보드 포커스', { exact: true })).toBeVisible();
            expect(await ratio(region)).toBeCloseTo(rest, 1);
            await page.keyboard.down('Space');
            await expect(region.getByText('Pressed · 누르는 중', { exact: true })).toBeVisible();
            expect(await ratio(region)).toBeCloseTo(rest, 1);
            await page.keyboard.up('Space');
            await page.keyboard.press('Enter');
            await expect(region.getByRole('status')).toHaveText('실행 횟수: 3');
            await expect(inactive).toBeDisabled();
            await page.keyboard.press('Tab');
            await expect(inactive).not.toBeFocused();
            readings.push({ title, rest, hover });
          }
          if (theme === 'dark') {
            expect(readings[1]?.rest).toEqual(readings[0]?.rest);
            expect(readings[2]?.rest).toEqual(readings[0]?.rest);
            expect(readings[1]?.hover).toBeCloseTo(readings[0]!.hover, 1);
            expect(readings[2]?.hover).toBeCloseTo(readings[0]!.hover, 1);
          }
          await test
            .info()
            .attach('contrast-readings', { body: JSON.stringify(readings, null, 2), contentType: 'application/json' });
        });
      }
    }

    for (const locale of ['ko', 'en']) {
      for (const theme of ['light', 'dark']) {
        test(`${locale} / ${theme}: comparison is readable at mobile width`, async ({ page }) => {
          await page.setViewportSize({ width: 390, height: 844 });
          await page.goto(`/iframe.html?id=${story}&viewMode=story&globals=locale:${locale};theme:${theme}`);
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await expect(page.getByRole('region')).toHaveCount(3);
          await expect(page.locator('[data-contrast-ratio]')).toHaveCount(3);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
          // A intentionally demonstrates the known light text contrast failure.
          const results = await new AxeBuilder({ page })
            .include('main')
            .exclude('[data-button-contrast="current"] button:enabled')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          expect(results.violations).toEqual([]);
        });
      }
    }

    test('theme changes retain comparison state and candidate colors stay in the lab', async ({ page }) => {
      await page.goto(`/?path=/story/${story}&globals=locale:ko;theme:light`);
      const preview = page.frameLocator('#storybook-preview-iframe');
      const candidate = preview.getByRole('region', { name: refined ? 'D · 밝기 조정' : 'B · 배경 조정', exact: true });
      await candidate.getByRole('button', { name: '저장하기' }).click();
      await preview.getByRole('combobox').selectOption('muted');
      await page.getByRole('button', { name: /^Component theme / }).click();
      await page.getByRole('option', { name: 'Dark', exact: true }).click();
      await expect(candidate.getByRole('status')).toHaveText('실행 횟수: 1');
      await expect(preview.getByRole('combobox')).toHaveValue('muted');
      await expect.poll(() => ratio(candidate)).toBeGreaterThan(7);
      await page.getByRole('button', { name: /^Component theme / }).click();
      await page.getByRole('option', { name: 'Light', exact: true }).click();
      await expect.poll(() => ratio(candidate)).toBeCloseTo(refined ? 4.62 : 4.79, 1);
      await page.getByRole('link', { name: 'Welcome', exact: true }).click();
      await preview.getByRole('link', { name: /02 버튼/ }).click();
      await page.getByRole('combobox', { name: 'variant', exact: true }).selectOption('default');
      await expect(preview.getByRole('button')).toHaveCSS('background-color', 'oklch(0.58 0.18 45)');
      await expect(preview.getByRole('button')).toHaveCSS('color', 'oklch(1 0 0)');
    });
  });
}
