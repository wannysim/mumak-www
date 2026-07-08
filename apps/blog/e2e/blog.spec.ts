import { expect, test } from '@playwright/test';

test.describe('Blog - Category and Post Pages', () => {
  test.describe('Blog Main Page', () => {
    test('should display blog page with all posts', async ({ page }) => {
      await page.goto('/ko/blog');

      await expect(page.getByRole('heading', { level: 1, name: '블로그' })).toBeVisible();
      await expect(page.getByText('생각과 기록을 담는 공간')).toBeVisible();
    });

    test('should display category navigation tabs', async ({ page }) => {
      await page.goto('/ko/blog');

      await expect(page.getByRole('link', { name: '전체' })).toBeVisible();
      await expect(page.getByRole('link', { name: '에세이' })).toBeVisible();
      await expect(page.getByRole('link', { name: '아티클' })).toBeVisible();
      await expect(page.getByRole('link', { name: '노트' })).toBeVisible();
    });
  });

  test.describe('Category Pages', () => {
    test('should display essay category page', async ({ page }) => {
      await page.goto('/ko/blog/essay');

      await expect(page.getByRole('heading', { level: 1, name: '에세이' })).toBeVisible();
      await expect(page.getByText('생각 정리')).toBeVisible();
    });

    test('should display articles category page', async ({ page }) => {
      await page.goto('/ko/blog/articles');

      await expect(page.getByRole('heading', { level: 1, name: '아티클' })).toBeVisible();
      await expect(page.getByText('깊은 탐구')).toBeVisible();
    });

    test('should display notes category page', async ({ page }) => {
      await page.goto('/ko/blog/notes');

      await expect(page.getByRole('heading', { level: 1, name: '노트' })).toBeVisible();
      await expect(page.getByText('짧은 메모')).toBeVisible();
    });

    test('should display posts list on category page', async ({ page }) => {
      await page.goto('/ko/blog/essay');

      // Should have at least one post
      const articles = page.locator('article');
      await expect(articles.first()).toBeVisible();
    });

    test('should work in English', async ({ page }) => {
      await page.goto('/en/blog/essay');

      await expect(page.getByRole('heading', { level: 1, name: 'Essay' })).toBeVisible();
      await expect(page.getByText('Writing thoughts')).toBeVisible();

      await page.goto('/en/blog/articles');
      await expect(page.getByRole('heading', { level: 1, name: 'Articles' })).toBeVisible();
      await expect(page.getByText('Deep research')).toBeVisible();

      await page.goto('/en/blog/notes');
      await expect(page.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible();
      await expect(page.getByText('Short memos')).toBeVisible();
    });
  });

  test.describe('Post Detail Pages', () => {
    test('should display post content', async ({ page }) => {
      await page.goto('/ko/blog/essay/first');

      // Should display the post title
      await expect(page.getByRole('heading', { level: 1, name: '나는 글 쓰는 걸 좋아한다' })).toBeVisible();
    });

    test('should render MDX content', async ({ page }) => {
      await page.goto('/ko/blog/essay/first');

      // Should have prose styling
      const proseDiv = page.locator('div.prose');
      await expect(proseDiv).toBeVisible();

      // Should render headings from MDX
      await expect(page.getByRole('heading', { name: '나는 글 쓰는 걸 좋아한다' })).toBeVisible();
    });

    test('should display back to list link', async ({ page }) => {
      await page.goto('/ko/blog/essay/first');

      const backLink = page.getByRole('link', { name: '목록으로 돌아가기' });
      await expect(backLink).toBeVisible();

      await backLink.click();
      await page.waitForURL(/\/ko\/blog\/essay$/);
    });

    test('should work in English', async ({ page }) => {
      await page.goto('/en/blog/essay/first');

      await expect(page.getByRole('heading', { level: 1, name: 'I like writing' })).toBeVisible();
    });

    // status 404 단언은 soft-404 회귀 방지: 레이아웃에서 children을 Suspense로 감싸면
    // 동적 렌더에서 셸이 먼저 flush돼 notFound()가 200 + noindex로 굳는다.
    test('should show 404 for non-existent post', async ({ page }) => {
      const response = await page.goto('/ko/blog/essay/non-existent-essay');

      expect(response?.status()).toBe(404);
      await expect(page.getByText('페이지를 찾을 수 없습니다')).toBeVisible();
    });

    test('should show 404 for non-existent post in English', async ({ page }) => {
      const response = await page.goto('/en/blog/essay/non-existent-essay');

      expect(response?.status()).toBe(404);
      await expect(page.getByText('Page not found')).toBeVisible();
    });

    test('should show localized 404 for unmatched path under a locale', async ({ page }) => {
      const response = await page.goto('/ko/no-such-route-anywhere');

      expect(response?.status()).toBe(404);
      await expect(page.getByText('페이지를 찾을 수 없습니다')).toBeVisible();
      // catch-all은 (main) 그룹이라 사이트 chrome(헤더 nav)이 함께 렌더된다
      await expect(page.getByRole('navigation').first()).toBeVisible();
    });
  });

  test.describe('Blog Search Palette', () => {
    test('should open the palette by clicking the search trigger and navigate', async ({ page }) => {
      await page.goto('/ko/blog');

      const trigger = page.getByRole('button', { name: '글 검색', exact: true });
      await expect(trigger).toBeVisible();

      await trigger.click();

      const dialog = page.getByRole('dialog', { name: '글 검색' });
      await expect(dialog).toBeVisible();

      const input = dialog.getByPlaceholder('글 검색…');
      await input.fill('나는 글 쓰는');

      const result = dialog.getByRole('option', { name: /나는 글 쓰는 걸 좋아한다/ });
      await expect(result).toBeVisible();

      await Promise.all([page.waitForURL(/\/ko\/blog\/essay\/first/), result.click()]);

      await expect(dialog).not.toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: '나는 글 쓰는 걸 좋아한다' })).toBeVisible();
    });

    test('should open the palette via Cmd/Ctrl+K shortcut', async ({ page }) => {
      await page.goto('/en/blog');

      // Prime the client-side search before dispatching the shortcut.
      const trigger = page.getByRole('button', { name: 'Search posts', exact: true });
      await expect(trigger).toBeVisible();

      const dialog = page.getByRole('dialog', { name: 'Search posts' });

      await trigger.click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();

      await page.evaluate(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
      });

      await expect(dialog).toBeVisible();
    });

    test('should also be available on a category page', async ({ page }) => {
      await page.goto('/ko/blog/essay');

      const trigger = page.getByRole('button', { name: '글 검색', exact: true });
      await expect(trigger).toBeVisible();

      await trigger.click();

      await expect(page.getByRole('dialog', { name: '글 검색' })).toBeVisible();
    });
  });

  test.describe('Legacy URL Redirects', () => {
    test('should redirect old category URL to new blog URL', async ({ page }) => {
      await page.goto('/ko/essay');
      await expect(page).toHaveURL(/\/ko\/blog\/essay$/);
    });

    test('should redirect old post URL to new blog URL', async ({ page }) => {
      await page.goto('/ko/essay/first');
      await expect(page).toHaveURL(/\/ko\/blog\/essay\/first$/);
    });
  });
});
