import { expect, test } from '@playwright/test';

test.describe('Tags Feature', () => {
  test.describe('Tags Page', () => {
    test('should display tags page with all tags', async ({ page }) => {
      await page.goto('/ko/blog/tags');

      await expect(page.getByRole('heading', { level: 1, name: '태그' })).toBeVisible();
      await expect(page.getByText(/총 \d+개의 태그가 있습니다/)).toBeVisible();
    });

    test('should display tag navigation link in BlogNav', async ({ page }) => {
      await page.goto('/ko/blog');

      const tagLink = page.getByRole('link', { name: '태그' });
      await expect(tagLink).toBeVisible();
    });

    test('should navigate to tags page when clicking tag link', async ({ page }) => {
      await page.goto('/ko/blog');

      await page.getByRole('link', { name: '태그' }).click();

      await expect(page).toHaveURL(/\/ko\/blog\/tags$/);
      await expect(page.getByRole('heading', { level: 1, name: '태그' })).toBeVisible();
    });

    test('should display tags as clickable badges with count', async ({ page }) => {
      await page.goto('/ko/blog/tags');

      // Should have at least one tag link
      const tagLinks = page.locator('a[href*="/blog/tags/"]').filter({
        hasNot: page.locator('nav'),
      });
      await expect(tagLinks.first()).toBeVisible();
    });

    test('should work in English', async ({ page }) => {
      await page.goto('/en/blog/tags');

      await expect(page.getByRole('heading', { level: 1, name: 'Tags' })).toBeVisible();
      await expect(page.getByText(/\d+ tags available/)).toBeVisible();
    });
  });

  test.describe('Tag Detail Page', () => {
    test('should display posts filtered by tag', async ({ page }) => {
      await page.goto('/ko/blog/tags');

      // Click the first tag
      const firstTagLink = page.locator('section a[href*="/blog/tags/"]').first();
      await firstTagLink.click();

      // Should navigate to tag detail page
      await expect(page).toHaveURL(/\/ko\/blog\/tags\/.+/);

      // Should display tag name as heading
      await expect(page.getByRole('heading', { level: 1 })).toContainText('#');
    });

    test('should display post count for tag', async ({ page }) => {
      await page.goto('/ko/blog/tags/thought');

      await expect(page.getByText(/\d+개의 글/)).toBeVisible();
    });

    test('should display other tags for navigation', async ({ page }) => {
      await page.goto('/ko/blog/tags/thought');

      // Should show other tag badges
      const otherTagLinks = page.locator('a[href*="/blog/tags/"]').filter({
        hasNot: page.locator('nav'),
      });
      const count = await otherTagLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should show the full tag list (parity with /blog/tags index)', async ({ page }) => {
      const tagLinkLocator = (p: typeof page) =>
        p.locator('a[href*="/blog/tags/"]').filter({ hasNot: p.locator('nav') });

      await page.goto('/ko/blog/tags');
      const indexCount = await tagLinkLocator(page).count();
      expect(indexCount).toBeGreaterThan(0);

      await page.goto('/ko/blog/tags/thought');
      const detailCount = await tagLinkLocator(page).count();

      expect(detailCount).toBe(indexCount);
    });

    test('should display posts with the selected tag', async ({ page }) => {
      await page.goto('/ko/blog/tags/thought');

      // Should have at least one post article
      const articles = page.locator('article');
      await expect(articles.first()).toBeVisible();
    });

    test('should show 404 for non-existent tag', async ({ page }) => {
      await page.goto('/ko/blog/tags/non-existent-tag-12345');

      await expect(page.getByText('페이지를 찾을 수 없습니다')).toBeVisible();
    });

    test('should work in English', async ({ page }) => {
      await page.goto('/en/blog/tags/thought');

      await expect(page.getByRole('heading', { level: 1, name: '#thought' })).toBeVisible();
      await expect(page.getByText(/\d+ posts/)).toBeVisible();
    });
  });

  test.describe('PostCard Tag Interaction', () => {
    test('should display tags on post cards', async ({ page }) => {
      await page.goto('/ko/blog');

      // Find a post with tags (text starting with #)
      const tagBadge = page
        .locator('article')
        .first()
        .getByText(/^#\w+$/);
      await expect(tagBadge.first()).toBeVisible();
    });

    test('should navigate to tag page when clicking tag on post card', async ({ page }) => {
      await page.goto('/ko/blog');

      // Find and click a tag badge on a post card
      const tagBadge = page.locator('article').first().locator('[class*="badge"]', { hasText: '#' }).first();

      if (await tagBadge.isVisible()) {
        await tagBadge.click();

        // Should navigate to tag page
        await expect(page).toHaveURL(/\/ko\/blog\/tags\/.+/);
      }
    });

    test('should not navigate to post detail when clicking tag', async ({ page }) => {
      await page.goto('/ko/blog');

      // Find a tag badge on a post card
      const tagBadge = page.locator('article').first().locator('[class*="badge"]', { hasText: '#' }).first();

      if (await tagBadge.isVisible()) {
        await tagBadge.click();

        // Should be on tag page, not post detail
        await expect(page).toHaveURL(/\/ko\/blog\/tags\/.+/);
        await expect(page).not.toHaveURL(/\/ko\/blog\/(essay|articles|notes)\/.+/);
      }
    });
  });

  test.describe('Tag Navigation Flow', () => {
    test('should navigate between tags', async ({ page }) => {
      // Start at tag list
      await page.goto('/ko/blog/tags');

      // Click first tag
      const firstTag = page.locator('section a[href*="/blog/tags/"]').first();
      await firstTag.click();

      // Should be on tag detail page
      await expect(page).toHaveURL(/\/ko\/blog\/tags\/.+/);

      // Click another tag from the tag cloud
      const anotherTag = page.locator('a[href*="/blog/tags/"]').nth(1);
      if (await anotherTag.isVisible()) {
        await anotherTag.click();
        await expect(page).toHaveURL(/\/ko\/blog\/tags\/.+/);
      }
    });

    test('should navigate from tag page to post and back', async ({ page }) => {
      await page.goto('/ko/blog/tags/thought');

      // Click on a post
      const postLink = page.locator('article').first().locator('xpath=ancestor::a');
      await postLink.click();

      // Should be on post detail page
      await expect(page).toHaveURL(/\/ko\/blog\/(essay|articles|notes)\/.+/);

      // Go back
      await page.goBack();

      // Should be back on tag page
      await expect(page).toHaveURL(/\/ko\/blog\/tags\/thought/);
    });

    test('should maintain category navigation from tag pages', async ({ page }) => {
      await page.goto('/ko/blog/tags/thought');

      // Click on category link
      await page.getByRole('link', { name: '에세이' }).click();

      // Should navigate to category page
      await expect(page).toHaveURL(/\/ko\/blog\/essay$/);
    });
  });
});
