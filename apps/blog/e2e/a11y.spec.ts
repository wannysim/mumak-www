import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// 자동 접근성 회귀 방지. 기존 blog E2E job 안에서 함께 실행되므로 새 CI check를 늘리지 않는다.
// WCAG 2.1 A/AA 규칙으로 주요 화면을 스캔하고, 위반이 0인지 확인한다.
//
// 상세 페이지는 `.prose`(MDX 렌더 결과)를 스캔에서 제외한다. markdown task-list
// 체크박스 label, 코드블록 스크롤 영역 포커스, 구문 강조 테마 색 대비 등은 콘텐츠와
// rehype 설정에서 비롯되는 별도 영역이라, 이 하네스는 우선 레이아웃/컴포넌트(chrome)의
// 접근성 회귀를 지킨다. MDX 콘텐츠 a11y는 별도 follow-up으로 둔다.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page, options?: { exclude?: string }) {
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (options?.exclude) {
    builder.exclude(options.exclude);
  }
  return builder.analyze();
}

function expectNoViolations(results: Awaited<ReturnType<typeof scan>>) {
  const summary = results.violations.map(
    v => `${v.id} (${v.nodes.length}) — ${v.help}\n    ${v.nodes.map(n => n.target.join(' ')).join('\n    ')}`
  );
  expect(summary, summary.join('\n')).toEqual([]);
}

test.describe('Accessibility (axe)', () => {
  test('blog index has no WCAG A/AA violations', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/blog');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    expectNoViolations(await scan(page));
  });

  test('garden index has no WCAG A/AA violations', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    expectNoViolations(await scan(page));
  });

  test('blog tag index has no WCAG A/AA violations', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/blog/tags');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    expectNoViolations(await scan(page));
  });

  test('blog post detail has no WCAG A/AA violations', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/blog');

    const firstPost = page.getByRole('main').locator('[data-slot="content-card"]').first();
    await expect(firstPost).toBeVisible();
    await Promise.all([page.waitForURL(/\/ko\/blog\/.+\/.+/), firstPost.click()]);
    await expect(page.getByRole('article')).toBeVisible();

    expectNoViolations(await scan(page, { exclude: '.prose' }));
  });

  test('garden note detail has no WCAG A/AA violations', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden/digital-garden-and-pkm');
    await expect(page.getByRole('article')).toBeVisible();

    expectNoViolations(await scan(page, { exclude: '.prose' }));
  });

  test('site search palette (dialog) has no WCAG A/AA violations', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    await page.getByRole('button', { name: '사이트 검색' }).click();
    await expect(page.getByRole('dialog', { name: '검색' })).toBeVisible();

    expectNoViolations(await scan(page));
  });

  test('garden index on mobile has no WCAG A/AA violations', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ko/garden');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    expectNoViolations(await scan(page));
  });
});
