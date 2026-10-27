import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator } from '@playwright/test';

const story = '/iframe.html?id=learning-button-target-size--compare&viewMode=story';
const names = ['A · 현재 크기', 'B · 함께 확대', 'C · 영역만 확대'];

async function box(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

for (const locale of ['ko', 'en']) {
  for (const theme of ['light', 'dark']) {
    test(`${locale}/${theme}: target lab fits mobile and has accessible controls`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.goto(`${story}&globals=locale:${locale};theme:${theme}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('region').filter({ has: page.getByRole('group') })).toHaveCount(3);
      await expect(page.getByRole('checkbox')).not.toBeChecked();
      await page.getByRole('checkbox').check();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
      const results = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
}

test('actual targets, icons and center spacing match the comparison without overlaps', async ({ page }) => {
  await page.goto(`${story}&globals=locale:ko`);
  let rowCenter: number | undefined;
  for (const [index, name] of names.entries()) {
    const region = page.getByRole('region', { name, exact: true });
    const buttons = region.getByRole('button');
    const expected = index === 0 ? 32 : 44;
    let previousRight = 0;
    let previousCenter: number | undefined;
    for (const button of await buttons.all()) {
      const bounds = await box(button);
      expect(bounds.width).toBe(expected);
      expect(bounds.height).toBe(expected);
      if (rowCenter !== undefined) expect(bounds.y + bounds.height / 2).toBe(rowCenter);
      rowCenter = bounds.y + bounds.height / 2;
      expect(bounds.x).toBeGreaterThanOrEqual(previousRight);
      const center = bounds.x + bounds.width / 2;
      if (previousCenter !== undefined) expect(center - previousCenter).toBe(52);
      previousCenter = center;
      previousRight = bounds.x + bounds.width;
      const icon = await box(button.locator('svg'));
      expect(icon.width).toBe(16);
      expect(icon.height).toBe(16);
    }
  }
});

test('the same edge offset misses A but activates B/C, and target outlines do not intercept input', async ({
  page,
}) => {
  await page.goto(`${story}&globals=locale:ko`);
  for (const [index, name] of names.entries()) {
    const region = page.getByRole('region', { name, exact: true });
    const save = region.getByRole('button', { name: '저장', exact: true });
    const bounds = await box(save);
    await page.mouse.click(bounds.x + bounds.width / 2 + 19, bounds.y + bounds.height / 2);
    await expect(region.getByRole('status')).toHaveText(
      index === 0 ? '누른 버튼이 여기에 표시됩니다.' : '저장 실행 · 총 1회'
    );
  }
  await page.getByRole('checkbox').check();
  const region = page.getByRole('region', { name: names[2], exact: true });
  const save = region.getByRole('button', { name: '저장', exact: true });
  const bounds = await box(save);
  // Inside the transparent target, outside its 32px visible surface.
  await page.mouse.click(bounds.x + 2, bounds.y + bounds.height / 2);
  await expect(region.getByRole('status')).toHaveText('저장 실행 · 총 2회');
  // The gap between reserved targets is not assigned to either neighbor.
  await page.mouse.click(bounds.x + bounds.width + 4, bounds.y + bounds.height / 2);
  await expect(region.getByRole('status')).toHaveText('저장 실행 · 총 2회');
  await region.getByRole('button', { name: '다음', exact: true }).click();
  await expect(region.getByRole('status')).toHaveText('다음 실행 · 총 3회');
});

test('keyboard focus and activations survive theme changes', async ({ page }) => {
  await page.goto('/?path=/story/learning-button-target-size--compare&globals=locale:ko;theme:light');
  const preview = page.frameLocator('#storybook-preview-iframe');
  const region = preview.getByRole('region', { name: names[2], exact: true });
  const previous = region.getByRole('button', { name: '이전', exact: true });
  const save = region.getByRole('button', { name: '저장', exact: true });
  await previous.focus();
  await page.keyboard.press('Tab');
  await expect(save).toBeFocused();
  await expect(save).toHaveCSS('outline-style', 'solid');
  await expect(save).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await expect(region.getByRole('status')).toHaveText('저장 실행 · 총 2회');
  await page.keyboard.press('Shift+Tab');
  await expect(previous).toBeFocused();
  await preview.getByRole('checkbox').check();
  await page.getByRole('button', { name: /^Component theme / }).click();
  await page.getByRole('option', { name: 'Dark', exact: true }).click();
  await expect(preview.getByRole('main')).toHaveCSS('background-color', 'oklch(0.145 0 0)');
  await expect(region.getByRole('status')).toHaveText('저장 실행 · 총 2회');
  await expect(preview.getByRole('checkbox')).toBeChecked();
});

test('touch activates the invisible padding once without activating a neighbor', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:6007${story}&globals=locale:ko`);
  const region = page.getByRole('region', { name: names[2], exact: true });
  const save = region.getByRole('button', { name: '저장', exact: true });
  const bounds = await box(save);
  await page.touchscreen.tap(bounds.x + 2, bounds.y + bounds.height / 2);
  await expect(region.getByRole('status')).toHaveText('저장 실행 · 총 1회');
  await context.close();
});

for (const theme of ['light', 'dark']) {
  test(`${theme}: C keeps a 32px surface matching A, with transparent padding even on hover`, async ({ page }) => {
    await page.goto(`${story}&globals=locale:ko;theme:${theme}`);
    const a = page
      .getByRole('region', { name: names[0], exact: true })
      .getByRole('button', { name: '저장', exact: true });
    const c = page
      .getByRole('region', { name: names[2], exact: true })
      .getByRole('button', { name: '저장', exact: true });
    const surface = c.locator('[data-slot="target-surface"]');
    const colors = (element: HTMLElement | SVGElement) => {
      const style = getComputedStyle(element);
      return [style.backgroundColor, style.borderColor, style.color];
    };
    const idleColors = await a.evaluate(colors);
    expect(await surface.evaluate(colors)).toEqual(idleColors);
    expect(await box(surface)).toMatchObject({ width: 32, height: 32 });
    await expect(c).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await a.hover();
    const hoverColors = await a.evaluate(colors);
    const bounds = await box(c);
    // Hover over C's transparent padding, not its painted surface.
    await page.mouse.move(bounds.x + 2, bounds.y + bounds.height / 2);
    await expect.poll(() => surface.evaluate(colors)).toEqual(hoverColors);
    await expect(c).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });
}
