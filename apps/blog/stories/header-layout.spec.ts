import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';

import { expectFocusIndicator } from '@/e2e/helpers/focus';

const url = (locale = 'en', theme = 'light') =>
  `/iframe.html?id=learning-header-layout--compare&viewMode=story&globals=locale:${locale};theme:${theme}`;

async function expectTargetsFit(container: Locator, size: number) {
  const rects = await container.locator('[data-lab-target]:visible').evaluateAll(elements =>
    elements.map(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    })
  );
  expect(rects.length).toBeGreaterThan(0);
  const bounds = await container.boundingBox();
  for (const [index, rect] of rects.entries()) {
    expect(rect.width).toBe(size);
    expect(rect.height).toBe(size);
    expect(rect.x).toBeGreaterThanOrEqual(bounds!.x);
    expect(rect.x + rect.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    for (const other of rects.slice(index + 1)) {
      const overlaps =
        rect.x < other.x + other.width &&
        other.x < rect.x + rect.width &&
        rect.y < other.y + other.height &&
        other.y < rect.y + rect.height;
      expect(overlaps).toBe(false);
    }
  }
}

for (const locale of ['ko', 'en']) {
  for (const theme of ['light', 'dark']) {
    test(`${locale}/${theme}: candidates fit real viewport widths with separate visual and touch sizes`, async ({
      page,
    }) => {
      await page.goto(url(locale, theme));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      for (const width of [320, 390, 640, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const name of [/^B ·/, /^C ·/]) {
          const candidate = page.getByRole('region', { name });
          const header = candidate.getByRole('navigation');
          await expectTargetsFit(header, 44);
          await expectTargetsFit(candidate.getByRole('group', { name: /GraphToolbar/ }), 44);
          await expect(header.locator('[data-slot=preview-header]')).toHaveCSS('height', '64px');
          for (const surface of await header.locator('[data-slot=icon-button-surface]:visible').all()) {
            await expect(surface).toHaveCSS('width', '28px');
          }
          const geometry = await header.evaluate(el => {
            const row = el.querySelector('[data-slot=preview-header]')!;
            const [left, right] = [...row.children].map(child => child.getBoundingClientRect());
            return { overlap: left!.right > right!.left, overflow: el.scrollWidth > el.clientWidth };
          });
          expect(geometry).toEqual({ overlap: false, overflow: false });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      const current = page.getByRole('region', { name: /^A ·/ });
      await expectTargetsFit(current.getByRole('navigation'), 28);
      await page.getByRole('checkbox').check();
      await expect(page.locator('[data-slot=layout-preview][data-targets=true]')).toHaveCount(3);
      const result = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(result.violations).toEqual([]);
    });
  }
}

for (const theme of ['light', 'dark']) {
  test(`${theme}: Home moves into the mobile menu and returns focus after navigation`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url('en', theme));
    const candidate = page.getByRole('region', { name: /^C ·/ });
    const header = candidate.getByRole('navigation');
    await expect(header.getByRole('link', { name: 'Wan Sim' })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'Home', exact: true })).toBeHidden();
    const menu = header.getByRole('button', { name: 'Open navigation' });
    await menu.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Navigation' });
    const home = dialog.getByRole('link', { name: 'Home', exact: true });
    await expect(home).toHaveAttribute('href', '/en');
    await expect(home).not.toHaveAttribute('aria-current');
    await expect(dialog.getByRole('link', { name: 'Blog', exact: true })).toHaveAttribute('aria-current', 'page');
    await home.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(candidate.getByRole('heading', { level: 3 })).toHaveText('Wan Sim');
    await expect(candidate.getByRole('status')).toHaveText('Moved to the Home preview.');
    await expectFocusIndicator(menu);
    await menu.press('Enter');
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await page.keyboard.press('Escape');
    await expectFocusIndicator(menu);
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(menu).toBeHidden();
    await expect(header.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
    await header.getByRole('link', { name: 'Garden', exact: true }).click();
    await header.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(candidate.getByRole('heading', { level: 3 })).toHaveText('Wan Sim');
  });
}

test('expanded edge taps activate controls; pointer gaps do not activate neighbours', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:6007${url()}`);
  for (const name of [/^B ·/, /^C ·/]) {
    const header = page.getByRole('region', { name }).getByRole('navigation');
    const menu = header.getByRole('button', { name: 'Open navigation' });
    await menu.scrollIntoViewIfNeeded();
    const box = (await menu.boundingBox())!;
    await page.touchscreen.tap(box.x + 2, box.y + 22);
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).tap();
    await expect(page.getByRole('dialog')).toBeHidden();
    const theme = header.getByRole('button', { name: 'Change theme' });
    await theme.scrollIntoViewIfNeeded();
    const target = (await theme.boundingBox())!;
    await page.touchscreen.tap(target.x + 2, target.y + 22);
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    // Touch browsers may adjust a finger contact to a nearby target even in a real gap.
    // Verify the DOM hit boundary independently of that browser heuristic.
    expect(
      await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[data-lab-target]')), {
        x: target.x + 46,
        y: target.y + 22,
      })
    ).toBe(false);
    await page.mouse.click(target.x + 46, target.y + 22);
    await expect(page.getByRole('menu')).toBeHidden();
  }
  await context.close();
});

test('search, graph back and global theme/language selection work inside the exercise', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url());
  const candidate = page.getByRole('region', { name: /^C ·/ });
  const header = candidate.getByRole('navigation');
  const search = header.getByRole('button', { name: 'Search the site' });
  await search.click();
  const dialog = page.getByRole('dialog', { name: 'Search', exact: true });
  await dialog.getByRole('combobox').fill('Home');
  await dialog.getByRole('option', { name: 'Home', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(candidate.getByRole('status')).toHaveText('Moved to the Home preview.');
  await expect(search).toBeFocused();
  const graph = candidate.getByRole('group', { name: /GraphToolbar/ });
  await graph.getByRole('button', { name: 'Back to Blog' }).click();
  await expect(candidate.getByRole('heading', { level: 3 })).toHaveText('Blog');
  await graph.getByRole('button', { name: 'Change theme' }).click();
  await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click();
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'oklch(0.145 0 0)');
  await header.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('menuitemradio', { name: '한국어', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('헤더 배치 비교');
  await expect(page.getByRole('main')).toHaveCSS('background-color', 'oklch(0.145 0 0)');
});
