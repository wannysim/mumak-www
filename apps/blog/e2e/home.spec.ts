import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display intro section', async ({ page }) => {
    await page.goto('/ko');

    // 로고 링크 확인 (Navigation에 있는 "Wan Sim" 텍스트)
    await expect(page.getByRole('link', { name: 'Wan Sim' })).toBeVisible();

    const introText = await page.locator('p.text-lg').first().textContent();
    expect(introText).toContain('글을 써보고 싶어서 만든 블로그입니다.');
    expect(introText).toContain('웹 기술과 사용자 경험에 관심이 많습니다.');
    expect(introText).toContain('사사로운 일상부터 개발자로서 고민한 흔적들을 기록하고자 합니다.');
  });

  test('should link to the about page from the intro', async ({ page }) => {
    await page.goto('/ko');

    const aboutLink = page.locator('a[href="/ko/about"]').first();
    await expect(aboutLink).toBeVisible();

    await aboutLink.click();
    await page.waitForURL(/\/ko\/about$/);
  });

  test('should display featured post section', async ({ page }) => {
    await page.goto('/ko');

    await expect(page.getByRole('heading', { level: 2, name: '최신 글' })).toBeVisible();

    const featuredSection = page.locator('section').filter({ hasText: '최신 글' });
    const featuredArticle = featuredSection.locator('article').first();
    await expect(featuredArticle).toBeVisible();

    const featuredLink = featuredSection.locator('a').first();
    await expect(featuredLink).toBeVisible();
  });

  test('should display recent posts section', async ({ page }) => {
    await page.goto('/ko');

    await expect(page.getByRole('heading', { level: 2, name: '이전 글' })).toBeVisible();

    const recentPosts = page.locator('section').nth(1).locator('article');
    const count = await recentPosts.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should work in English', async ({ page }) => {
    await page.goto('/en');

    // 로고 링크 확인 (Navigation에 있는 "Wan Sim" 텍스트)
    await expect(page.getByRole('link', { name: 'Wan Sim' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Latest Post' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Recent Posts' })).toBeVisible();

    const introText = await page.locator('p.text-lg').first().textContent();
    expect(introText).toContain('Created this blog to write anything I want.');
    expect(introText).toContain("I'm interested in web technologies and user experience.");
    expect(introText).toContain("Gonna write about anything from daily life to developer's thoughts.");
  });

  test('should navigate to featured post', async ({ page }) => {
    await page.goto('/ko');

    const featuredSection = page.locator('section').filter({ hasText: '최신 글' });
    const featuredLink = featuredSection.locator('a').first();
    await expect(featuredLink).toBeVisible();

    const href = await featuredLink.getAttribute('href');
    if (href) {
      await featuredLink.click();
      await page.waitForURL(new RegExp(href.replace('/', '\\/')));
    }
  });
});
