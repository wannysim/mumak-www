import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function selectTheme(page: Page, theme: 'Light' | 'Dark') {
  await page.getByRole('button', { name: /^Component theme / }).click();
  await page.getByRole('option', { name: theme, exact: true }).click();
}

for (const locale of ['ko', 'en'] as const) {
  const ko = locale === 'ko';
  const home = `/?path=/story/start-welcome--welcome&globals=locale:${locale}`;

  for (const theme of ['light', 'dark']) {
    test(`${locale} / ${theme}: start page stays readable and fits a mobile viewport`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/iframe.html?id=start-welcome--welcome&viewMode=story&globals=locale:${locale};theme:${theme}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      const results = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test(`${locale}: start links open the lab and token values follow the theme`, async ({ page }) => {
    await page.goto(home);
    const preview = page.frameLocator('#storybook-preview-iframe');
    await expect(preview.getByRole('heading', { level: 1 })).toHaveText(
      ko ? '직접 만져보는 디자인 시스템' : 'A design system you can try'
    );
    const links = preview.getByRole('list').getByRole('link');
    await expect(links).toHaveCount(5);
    await expect(
      preview.getByRole('link', { name: ko ? /04 포커스 A\/B 비교/ : /04 Focus A\/B comparison/ })
    ).toHaveAttribute('href', `./?path=/story/learning-focus-comparison--compare&globals=locale:${locale};theme:light`);
    await preview.getByRole('link', { name: ko ? /01 포커스 규칙/ : /01 Focus rules/ }).click();
    await expect(preview.getByRole('heading', { level: 1 })).toHaveText(ko ? '포커스 규칙' : 'Focus rules');
    const values = preview.getByRole('definition');
    await expect(values.first()).toHaveText('oklch(0.45 0.15 45)');
    await selectTheme(page, 'Dark');
    await expect(values.first()).toHaveText('oklch(0.85 0.12 50)');
    await expect(values.nth(1)).toHaveText('oklch(0.85 0.12 50)');
    await page.getByRole('link', { name: 'Welcome', exact: true }).click();
    await expect(preview.getByRole('main')).toHaveCSS('background-color', 'oklch(0.145 0 0)');
    await preview.getByRole('link', { name: ko ? /02 버튼/ : /02 Button/ }).click();
    await expect(page.getByRole('button', { name: 'Component theme Dark', exact: true })).toBeVisible();
    await expect(preview.getByRole('main')).toHaveCSS('background-color', 'oklch(0.145 0 0)');
    await selectTheme(page, 'Light');
    await expect(preview.getByRole('main')).toHaveCSS('background-color', 'oklch(1 0 0)');
  });

  test(`${locale}: button Controls change the real component and restore activation after disabled`, async ({
    page,
  }) => {
    await page.goto(home);
    const preview = page.frameLocator('#storybook-preview-iframe');
    await preview.getByRole('link', { name: ko ? /02 버튼/ : /02 Button/ }).click();
    const button = preview.getByRole('button');
    await expect(button).toHaveText(ko ? '저장하기' : 'Save changes');
    await page.getByRole('row', { name: 'label', exact: true }).getByRole('textbox').fill('Try me');
    await expect(button).toHaveText('Try me');
    await page.getByRole('combobox', { name: 'variant', exact: true }).selectOption('secondary');
    await expect(button).toHaveAttribute('data-variant', 'secondary');
    await page.getByRole('combobox', { name: 'size', exact: true }).selectOption('lg');
    await expect(button).toHaveAttribute('data-size', 'lg');
    await button.click();
    await button.press('Space');
    await expect(preview.getByRole('status')).toContainText('2');
    await selectTheme(page, 'Dark');
    await expect(preview.getByRole('main')).toHaveCSS('background-color', 'oklch(0.145 0 0)');
    await expect(button).toHaveText('Try me');
    await expect(button).toHaveAttribute('data-variant', 'secondary');
    await expect(preview.getByRole('status')).toContainText('2');
    await page.getByRole('switch', { name: 'invalid', exact: true }).press('Space');
    await expect(button).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('switch', { name: 'disabled', exact: true }).press('Space');
    await expect(button).toBeDisabled();
    await page.getByRole('switch', { name: 'disabled', exact: true }).press('Space');
    await button.click();
    await expect(preview.getByRole('status')).toContainText('3');
  });

  test(`${locale}: card Controls change slots and links keep the exercise open`, async ({ page }) => {
    await page.goto(home);
    const preview = page.frameLocator('#storybook-preview-iframe');
    await preview.getByRole('link', { name: ko ? /03 콘텐츠 카드/ : /03 Content card/ }).click();
    const card = preview.getByRole('article');
    await expect(card.getByRole('link')).toHaveCount(2);
    const title = ko
      ? '긴 제목으로 카드의 줄바꿈과 간격을 직접 확인하는 실습'
      : 'A longer title to explore wrapping and spacing in a real content card';
    await page.getByRole('row', { name: 'title', exact: true }).getByRole('textbox').fill(title);
    await expect(card.getByRole('heading')).toHaveText(title);
    await page.getByRole('switch', { name: 'showTag', exact: true }).press('Space');
    await expect(card.getByRole('link')).toHaveCount(1);
    await page.getByRole('switch', { name: 'showDescription', exact: true }).press('Space');
    await expect(card.getByRole('paragraph')).toHaveCount(0);
    await card.getByRole('link').press('Enter');
    await expect(preview.getByRole('status')).not.toBeEmpty();
    await expect(page).toHaveURL(/components-content-card--playground/);
    await page.goto(
      `/iframe.html?id=components-content-card--playground&viewMode=story&globals=locale:${locale};theme:dark`
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('article')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
}
