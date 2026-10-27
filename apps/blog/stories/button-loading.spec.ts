import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const story = 'learning-button-loading--compare';

async function scanWithPausedClock(page: Page) {
  // axe resolves rules with its own timers. Advance them without completing the 1800ms request.
  // This direct story page has no child frames. Run in-page so axe's temporary-page
  // cleanup cannot race Playwright's context-wide clock advancement.
  const analysis = new AxeBuilder({ page })
    .setLegacyMode()
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  let finished = false;
  let elapsed = 0;
  void analysis.then(
    () => {
      finished = true;
    },
    () => {
      finished = true;
    }
  );
  await expect
    .poll(
      async () => {
        if (!finished && elapsed < 1000) {
          await page.clock.runFor(1);
          elapsed += 1;
        }
        return finished;
      },
      { intervals: [20], timeout: 10_000 }
    )
    .toBe(true);
  return analysis;
}

async function openLab(page: Page, locale = 'ko', theme = 'light', manager = false) {
  await page.clock.install({ time: new Date('2026-10-19T10:00:00Z') });
  await page.goto(
    manager
      ? `/?path=/story/${story}&globals=locale:${locale};theme:${theme}`
      : `/iframe.html?id=${story}&viewMode=story&globals=locale:${locale};theme:${theme}`
  );
  const content = manager ? page.frameLocator('#storybook-preview-iframe') : page;
  await expect(content.getByRole('heading', { level: 1 })).toBeVisible();
  await page.clock.pauseAt(new Date('2026-10-19T10:01:00Z'));
  return content;
}

for (const candidate of ['A · 문구만', 'B · 회전 표시와 문구', 'C · 회전 표시만']) {
  test(`${candidate}: guards repeated input, preserves focus, and allows retry`, async ({ page }) => {
    await openLab(page);
    const panel = page.getByRole('region', { name: candidate, exact: true });
    const button = panel.getByRole('button');
    await expect(panel.getByRole('status')).toBeEmpty();
    await page.getByLabel('실행 결과').selectOption('failure');
    await button.focus();
    await page.keyboard.down('Space');
    await expect(panel.getByText('시작한 요청: 0회')).toBeVisible();
    await page.keyboard.up('Space');
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).toHaveAccessibleName('저장 중…');
    await expect(button).toBeFocused();
    await expect(button).not.toHaveAttribute('disabled');
    await button.press('Enter');
    await button.press('Enter');
    await button.press('Space');
    // Playwright normally refuses aria-disabled elements; force delivers a real pointer click.
    await button.click({ force: true });
    await expect(panel.getByText('시작한 요청: 1회')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(button).not.toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(button).toBeFocused();
    await page.clock.runFor(1799);
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await page.clock.runFor(1);
    await expect(panel.getByRole('status')).toContainText('저장하지 못했습니다.');
    await expect(button).toBeFocused();
    await expect(button).toBeEnabled();
    await page.getByLabel('실행 결과').selectOption('success');
    await button.press('Enter');
    await expect(panel.getByText('시작한 요청: 2회')).toBeVisible();
    await page.clock.runFor(1800);
    await expect(panel.getByRole('status')).toContainText('저장했습니다.');
    await expect(button).toHaveAccessibleName('저장하기');
  });
}

for (const locale of ['ko', 'en']) {
  for (const theme of ['light', 'dark']) {
    test(`${locale}/${theme}: mobile pending and failure remain accessible; C retains width`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openLab(page, locale, theme);
      const ko = locale === 'ko';
      const panel = page.getByRole('region', { name: ko ? 'C · 회전 표시만' : 'C · Spinner only', exact: true });
      const button = panel.getByRole('button');
      const initial = await button.boundingBox();
      await page.getByLabel(ko ? '실행 결과' : 'Outcome').selectOption('failure');
      await page.getByRole('button', { name: ko ? '세 안 함께 실행' : 'Run all three' }).click();
      await expect(page.getByRole('button', { name: ko ? '저장 중…' : 'Saving…', exact: true })).toHaveCount(3);
      expect((await button.boundingBox())?.width).toBe(initial?.width);
      await expect(page.getByLabel(ko ? '대기 시간' : 'Wait time')).toBeDisabled();
      for (const phase of ['pending', 'failure']) {
        if (phase === 'failure') await page.clock.runFor(1800);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
        const results = await scanWithPausedClock(page);
        expect(results.violations).toEqual([]);
        if (phase === 'pending') {
          await expect(page.getByRole('button', { name: ko ? '저장 중…' : 'Saving…', exact: true })).toHaveCount(3);
        }
      }
      expect((await button.boundingBox())?.width).toBe(initial?.width);
      await expect(page.getByLabel(ko ? '대기 시간' : 'Wait time')).toBeEnabled();
      await expect(panel.getByRole('status')).toContainText(ko ? '저장하지 못했습니다.' : 'Could not save.');
    });
  }
}

test('short and long waits use the selected duration and keep independent request counts', async ({ page }) => {
  await openLab(page);
  const panel = page.getByRole('region', { name: 'A · 문구만', exact: true });
  for (const delay of [300, 5000]) {
    await page.getByLabel('대기 시간').selectOption(String(delay));
    await panel.getByRole('button').click();
    await page.clock.runFor(delay - 1);
    await expect(panel.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    await page.clock.runFor(1);
    await expect(panel.getByRole('status')).toContainText('저장했습니다.');
  }
  await expect(panel.getByText('시작한 요청: 2회')).toBeVisible();
  await expect(page.getByText('시작한 요청: 0회')).toHaveCount(2);
});

test('theme changes preserve pending requests; reduced motion stops spinner rotation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const preview = await openLab(page, 'ko', 'light', true);
  await preview.getByRole('button', { name: '세 안 함께 실행' }).click();
  const spinner = preview.getByRole('region', { name: 'C · 회전 표시만', exact: true }).locator('svg');
  await expect(spinner).not.toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: /^Component theme / }).click();
  await page.getByRole('option', { name: 'Dark', exact: true }).click();
  // Storybook also schedules the globals update. Let it commit while requests stay pending.
  await expect
    .poll(
      async () => {
        await page.clock.runFor(16);
        return preview.getByRole('main').evaluate(element => getComputedStyle(element).backgroundColor);
      },
      { intervals: [20], timeout: 1000 }
    )
    .toBe('oklch(0.145 0 0)');
  await expect(preview.getByText('시작한 요청: 1회')).toHaveCount(3);
  await expect(preview.getByRole('button', { name: '저장 중…', exact: true })).toHaveCount(3);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(spinner).toHaveCSS('animation-name', 'none');
  await page.clock.runFor(1800);
  await expect(preview.getByRole('status').filter({ hasText: '저장했습니다.' })).toHaveCount(3);
});

test('touch taps start one request while pending', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await openLab(page);
    const panel = page.getByRole('region', { name: 'B · 회전 표시와 문구', exact: true });
    const button = panel.getByRole('button');
    await button.tap();
    await button.tap({ force: true });
    await expect(panel.getByText('시작한 요청: 1회')).toBeVisible();
    await page.clock.runFor(1800);
    await expect(panel.getByRole('status')).toContainText('저장했습니다.');
  } finally {
    await context.close();
  }
});
