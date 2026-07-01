import { expect, test } from '@playwright/test';

// 상세 페이지의 "위로 가는" 경로(breadcrumb)와, 카드/상세의 태그 칩이 실제로
// 키보드로 도달 가능한 링크인지 검증한다. (UI/UX 개선 회귀 방지)

test.describe('Wayfinding - visible breadcrumbs on detail pages', () => {
  test('blog post shows a breadcrumb trail up the hierarchy', async ({ page }) => {
    await page.goto('/ko/blog/essay/retrospect-2025');

    const crumbs = page.getByRole('navigation', { name: 'breadcrumb' });
    await expect(crumbs).toBeVisible();
    await expect(crumbs.getByRole('link', { name: '홈', exact: true })).toHaveAttribute('href', '/ko');
    await expect(crumbs.getByRole('link', { name: '블로그', exact: true })).toHaveAttribute('href', '/ko/blog');
  });

  test('breadcrumb link navigates back up to the blog index', async ({ page }) => {
    await page.goto('/ko/blog/essay/retrospect-2025');

    const crumbs = page.getByRole('navigation', { name: 'breadcrumb' });
    await crumbs.getByRole('link', { name: '블로그', exact: true }).click();
    await expect(page).toHaveURL(/\/ko\/blog$/);
  });

  test('garden note shows a breadcrumb trail up the hierarchy', async ({ page }) => {
    await page.goto('/ko/garden/digital-garden-and-pkm');

    const crumbs = page.getByRole('navigation', { name: 'breadcrumb' });
    await expect(crumbs).toBeVisible();
    await expect(crumbs.getByRole('link', { name: '홈', exact: true })).toHaveAttribute('href', '/ko');
    await expect(crumbs.getByRole('link', { name: '가든', exact: true })).toHaveAttribute('href', '/ko/garden');
  });
});

test.describe('Accessibility - tag chips are keyboard-reachable links', () => {
  test('post-card tags are real links, focusable by keyboard', async ({ page }) => {
    await page.goto('/ko/blog');

    // 카드 안의 태그 칩(→ /blog/tags/<tag>) 하나를 잡는다. nav의 "태그" 링크(/blog/tags)는
    // 후행 슬래시가 없어 제외된다.
    const tagLink = page.getByRole('main').locator('[data-slot="content-card"] a[href*="/blog/tags/"]').first();
    await expect(tagLink).toBeVisible();

    // span+onClick이던 예전과 달리 실제 anchor라 포커스가 잡혀야 한다.
    await tagLink.focus();
    await expect(tagLink).toBeFocused();

    const href = await tagLink.getAttribute('href');
    await tagLink.click();
    await expect(page).toHaveURL(/\/ko\/blog\/tags\/.+/);
    if (href) {
      await expect(page).toHaveURL(new RegExp(href.replace(/\//g, '\\/') + '$'));
    }
  });
});
