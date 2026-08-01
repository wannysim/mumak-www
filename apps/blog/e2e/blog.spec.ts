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
      await expect(page.getByRole('link', { name: '단상' })).toBeVisible();
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

      await expect(page.getByRole('heading', { level: 1, name: '단상' })).toBeVisible();
      await expect(page.getByText('짧은 생각')).toBeVisible();
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
      await expect(page.getByRole('heading', { level: 1, name: 'Thoughts' })).toBeVisible();
      await expect(page.getByText('Short thoughts')).toBeVisible();
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

    test.describe('Series', () => {
      const PART_2 = '/ko/blog/articles/expo-social-login-build';

      test('shows every part of the series, with the current one marked', async ({ page }) => {
        await page.goto(PART_2);

        const seriesNav = page.getByRole('navigation', { name: 'Expo 소셜 로그인' });
        await expect(seriesNav).toBeVisible();
        await expect(seriesNav.getByText('3편 중 2편')).toBeVisible();

        // 다른 편은 링크, 현재 편은 aria-current.
        await expect(seriesNav.getByRole('link')).toHaveCount(2);
        await expect(seriesNav.locator('[aria-current="page"]')).toHaveCount(1);
      });

      test('navigates to the previous part from the series nav', async ({ page }) => {
        await page.goto(PART_2);

        await page.getByRole('navigation', { name: 'Expo 소셜 로그인' }).getByRole('link').first().click();
        await page.waitForURL(/\/ko\/blog\/articles\/expo-social-login$/);
      });

      test('offers the next part first in the next-reading block', async ({ page }) => {
        await page.goto(PART_2);

        const firstSuggestion = page.locator('[data-slot="next-reading"] li').first();
        await expect(firstSuggestion.getByText('다음 편')).toBeVisible();
        await expect(firstSuggestion.getByRole('link')).toHaveAttribute(
          'href',
          '/ko/blog/articles/expo-social-login-backend'
        );
      });

      test('does not repeat series siblings among the tag-based suggestions', async ({ page }) => {
        await page.goto(PART_2);

        // 다음 편(3부) 한 줄만 시리즈 링크여야 한다. 1부는 상단 시리즈 목차가 담당한다.
        const suggestions = page.locator('[data-slot="next-reading"] a[href*="expo-social-login"]');
        await expect(suggestions).toHaveCount(1);
      });

      test('marks the series on list cards so the newest-first order is readable', async ({ page }) => {
        await page.goto('/ko/blog/articles');

        const card = page.locator('[data-slot="content-card"]').filter({ hasText: 'Expo 소셜 로그인 (1/3)' });
        await expect(card.getByText('Expo 소셜 로그인 1편')).toBeVisible();
      });
    });

    // 가든 노트는 백링크가 있는데 블로그 글은 없어서 두 섹션이 비대칭이었다.
    // 저자가 본문에 손으로 써둔 인용 관계를 양쪽에서 되짚는다.
    test.describe('Linked garden notes', () => {
      test('shows the notes a post cites', async ({ page }) => {
        await page.goto('/ko/blog/articles/silent-502-keepalive-race');

        const linked = page.locator('[data-linked-notes-section]');
        await expect(linked.locator('a[href="/ko/garden/keep-alive-timeout-ordering"]')).toBeVisible();
        await expect(linked.locator('a[href="/ko/garden/tcp-retransmission-timeout"]')).toBeVisible();
      });

      test('shows the citing post back on the garden note', async ({ page }) => {
        await page.goto('/ko/garden/keep-alive-timeout-ordering');

        const linked = page.locator('[data-linked-notes-section]');
        await expect(linked.locator('a[href="/ko/blog/articles/silent-502-keepalive-race"]')).toBeVisible();
      });

      test('normalizes file-path style links written by the author', async ({ page }) => {
        // 본문에는 `/ko/garden/resources/frontend/browser/….mdx`로 적혀 있다.
        await page.goto('/ko/blog/articles/css-animation-performance');

        const linked = page.locator('[data-linked-notes-section]');
        await expect(linked.locator('a[href="/ko/garden/browser-rendering-pipeline"]')).toBeVisible();
      });
    });

    test.describe('Table of contents', () => {
      // rt=9분 / 헤딩 14개. 임계값(8분 · 헤딩 3개)을 넉넉히 넘는다.
      const LONG_POST = '/ko/blog/articles/react-native-os-native-viewer';

      test('shows a right rail on xl for long posts', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(LONG_POST);

        await expect(page.getByRole('navigation', { name: '목차' })).toBeVisible();
      });

      test('jumps to the section and keeps it in view', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto(LONG_POST);

        const toc = page.getByRole('navigation', { name: '목차' });
        const first = toc.getByRole('link').first();
        const href = await first.getAttribute('href');
        await first.click();

        expect(page.url()).toContain(href ?? '#');
        await expect(page.locator(`[id="${decodeURIComponent((href ?? '#').slice(1))}"]`)).toBeInViewport();
      });

      test('is hidden below xl', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 900 });
        await page.goto(LONG_POST);

        await expect(page.locator('[data-slot="post-toc"]')).toBeHidden();
      });

      test('is absent on short posts even on a wide screen', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto('/ko/blog/essay/first');

        await expect(page.locator('[data-slot="post-toc"]')).toHaveCount(0);
      });
    });

    test('should end with a next-reading block instead of a bare back link', async ({ page }) => {
      await page.goto('/ko/blog/essay/first');

      const nextReading = page.locator('[data-slot="next-reading"]');
      await expect(nextReading.getByRole('heading', { level: 2, name: '다음 읽을거리' })).toBeVisible();

      // 이어 읽을 글이 실제 포스트 링크로 제안된다.
      await expect(nextReading.locator('a[href^="/ko/blog/"]').first()).toBeVisible();
    });

    test('should keep a secondary link back to the category list', async ({ page }) => {
      await page.goto('/ko/blog/essay/first');

      const backLink = page.getByRole('link', { name: /에세이 더 보기/ });
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

    // prefix 없는 경로는 proxy가 locale을 붙여 리다이렉트한 뒤 catch-all로 잡혀야 한다.
    // matcher가 이미-prefix된 경로만 매칭하면 여기서 Next 기본 404로 떨어진다.
    // (붙는 locale은 Accept-Language 협상 결과라 ko/en 어느 쪽이든 허용한다.)
    test('should redirect an unprefixed unmatched path to the localized 404', async ({ page }) => {
      const response = await page.goto('/no-such-unprefixed-path');

      expect(response?.status()).toBe(404);
      expect(new URL(page.url()).pathname).toMatch(/^\/(ko|en)\/no-such-unprefixed-path$/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('navigation').first()).toBeVisible();
    });
  });

  test.describe('Site Search Palette', () => {
    test('should open the palette from the header and navigate', async ({ page }) => {
      await page.goto('/ko/blog');

      const trigger = page.getByRole('button', { name: '사이트 검색' });
      await expect(trigger).toBeVisible();

      await trigger.click();

      const dialog = page.getByRole('dialog', { name: '검색' });
      await expect(dialog).toBeVisible();

      const input = dialog.getByPlaceholder('검색…');
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
      const trigger = page.getByRole('button', { name: 'Search the site' });
      await expect(trigger).toBeVisible();

      const dialog = page.getByRole('dialog', { name: 'Search' });

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

      const trigger = page.getByRole('button', { name: '사이트 검색' });
      await expect(trigger).toBeVisible();

      await trigger.click();

      await expect(page.getByRole('dialog', { name: '검색' })).toBeVisible();
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
