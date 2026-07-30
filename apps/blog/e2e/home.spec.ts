import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display intro section', async ({ page }) => {
    await page.goto('/ko');

    // 랜딩 페이지에도 단일 h1이 있어야 한다 (문서 개요 / SEO / 히어로 계층).
    await expect(page.getByRole('heading', { level: 1, name: 'Wan Sim' })).toBeVisible();

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

    const postsSection = page.locator('section').filter({ hasText: '최신 글' });
    const postCards = postsSection.locator('[data-slot="content-card"]');
    expect(await postCards.count()).toBeGreaterThan(0);

    const browseAll = postsSection.getByRole('link', { name: /글 \d+개 전체 보기/ });
    await expect(browseAll).toBeVisible();

    await browseAll.click();
    await page.waitForURL(/\/ko\/blog$/);
  });

  // 블로그와 가든은 홈에서 대등한 두 블록이다. 헤딩 위계·카드 shell·개수·CTA가 갈라지면
  // 어느 쪽이 더 중요한지에 대한 신호를 주게 된다.
  test('should present the blog and garden blocks symmetrically', async ({ page }) => {
    await page.goto('/ko');

    const postsSection = page.locator('section').filter({ hasText: '최신 글' });
    const gardenSection = page.locator('section[data-slot="garden-highlights"]');

    // 같은 h2 위계
    await expect(postsSection.getByRole('heading', { level: 2 })).toBeVisible();
    await expect(gardenSection.getByRole('heading', { level: 2 })).toBeVisible();

    // 같은 카드 shell, 같은 개수
    const postCount = await postsSection.locator('[data-slot="content-card"]').count();
    const noteCount = await gardenSection.locator('[data-slot="content-card"]').count();
    expect(postCount).toBe(noteCount);

    // 양쪽 다 "전체 보기"로 마무리
    await expect(postsSection.getByRole('link', { name: /전체 보기/ })).toBeVisible();
    await expect(gardenSection.getByRole('link', { name: /전체 보기/ })).toBeVisible();

    // 예전에 블로그를 "최신 글"과 "이전 글"로 갈라놨던 두 번째 헤딩은 사라졌다.
    await expect(page.getByRole('heading', { level: 2, name: '이전 글' })).toHaveCount(0);
  });

  // 홈이 블로그만 보여주면 첫 방문자는 노트 100여 개를 못 보고 "작은 블로그"로 판단한다.
  test('should surface the garden alongside the blog', async ({ page }) => {
    await page.goto('/ko');

    await expect(page.getByRole('heading', { level: 2, name: '최신 노트' })).toBeVisible();

    const gardenSection = page.locator('section[data-slot="garden-highlights"]');
    const noteLinks = gardenSection.locator('a[href^="/ko/garden/"]');
    expect(await noteLinks.count()).toBeGreaterThan(0);

    const browseAll = gardenSection.getByRole('link', { name: /노트 \d+개 전체 보기/ });
    await expect(browseAll).toBeVisible();

    await browseAll.click();
    await page.waitForURL(/\/ko\/garden$/);
  });

  // footer 링크와 별개로, 본문에서도 now에 닿을 수 있어야 한다(footer 전용이던 게 원래 문제).
  test('should link to the now page from the home surface', async ({ page }) => {
    await page.goto('/ko');

    const nowLink = page.getByRole('main').getByRole('link', { name: '요즘 하는 일' });
    await expect(nowLink).toBeVisible();

    await nowLink.click();
    await page.waitForURL(/\/ko\/now$/);
  });

  // 헤더 전역 검색은 섹션 밖에서도 열려야 한다. 홈에서 Cmd+K가 죽어 있던 게 원래 문제였다.
  test('should search posts and notes together from the home surface', async ({ page }) => {
    await page.goto('/ko');

    await page.getByRole('button', { name: '사이트 검색' }).click();

    const dialog = page.getByRole('dialog', { name: '검색' });
    await expect(dialog).toBeVisible();

    await dialog.getByPlaceholder('검색…').fill('디지털 가든');
    await expect(dialog.getByRole('option', { name: /디지털 가든과 Second Brain/ })).toBeVisible();
  });

  test('should work in English', async ({ page }) => {
    await page.goto('/en');

    await expect(page.getByRole('heading', { level: 1, name: 'Wan Sim' })).toBeVisible();
    // 로고 링크 확인 (Navigation에 있는 "Wan Sim" 텍스트)
    await expect(page.getByRole('link', { name: 'Wan Sim' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Latest posts' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Latest notes' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse all \d+ posts/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse all \d+ notes/ })).toBeVisible();

    const introText = await page.locator('p.text-lg').first().textContent();
    expect(introText).toContain('Created this blog to write anything I want.');
    expect(introText).toContain("I'm interested in web technologies and user experience.");
    expect(introText).toContain("Gonna write about anything from daily life to developer's thoughts.");
  });

  test('should navigate to the newest post from the home surface', async ({ page }) => {
    await page.goto('/ko');

    const postsSection = page.locator('section').filter({ hasText: '최신 글' });
    const firstPostLink = postsSection.locator('[data-slot="content-card-link"]').first();
    await expect(firstPostLink).toBeVisible();

    const href = await firstPostLink.getAttribute('href');
    expect(href).toMatch(/^\/ko\/blog\//);

    await firstPostLink.click();
    await page.waitForURL(new RegExp(href!.replace(/\//g, '\\/')));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
