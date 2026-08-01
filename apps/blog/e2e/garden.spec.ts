import { expect, test } from '@playwright/test';

test.describe('Garden Page (PARA Sidebar Navigation)', () => {
  // 가든·PARA·성장 단계는 처음 온 사람이 추측으로 알 수 없는 어휘다. 이 안내는 한동안
  // messages에만 있고 화면에는 없었다. 다시 죽으면 콘텐츠 대부분이 설명 없이 남는다.
  test('explains what the garden and PARA are on the index', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    const main = page.getByRole('main');
    await expect(main.getByText('이곳은 제 디지털 가든입니다', { exact: false })).toBeVisible();
    await expect(main.getByText('PARA(Projects, Areas, Resources, Archives)', { exact: false })).toBeVisible();
  });

  test('explains the garden in English too', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/en/garden');

    const main = page.getByRole('main');
    await expect(main.getByText('This is my digital garden', { exact: false })).toBeVisible();
    await expect(main.getByText('PARA (Projects, Areas, Resources, Archives)', { exact: false })).toBeVisible();
  });

  // 안내가 모바일에서도 보여야 한다. 예전 문구는 "좌측 사이드바"를 가리켰는데 모바일에는
  // 좌측 사이드바가 없어서 틀린 안내였다.
  test('shows the garden explainer on mobile without pointing at a sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ko/garden');

    const main = page.getByRole('main');
    await expect(main.getByText('이곳은 제 디지털 가든입니다', { exact: false })).toBeVisible();
    await expect(main.getByText('좌측 사이드바', { exact: false })).toHaveCount(0);
  });

  test('should display PARA sidebar with category sections on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    const sidebar = page.locator('aside').filter({ hasText: 'PARA 가든' });
    await expect(sidebar).toBeVisible();

    const tree = sidebar.locator('nav[data-slot="garden-note-tree"]');
    await expect(tree).toBeVisible();

    // Categories with content render as section headers (no expand toggle).
    await expect(tree.getByText('Resources', { exact: true })).toBeVisible();
    await expect(tree.getByText('Areas', { exact: true })).toBeVisible();
  });

  test('should navigate to a note via the sidebar tree and mark it active', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    const sidebar = page.locator('aside').filter({ hasText: 'PARA 가든' });
    const tree = sidebar.locator('nav[data-slot="garden-note-tree"]');

    // The note lives under the "디지털 가든" parent node, collapsed by default; expand it first.
    // The toggle's accessible name is localized, so select it by its collapsed state instead.
    const parentRow = tree.getByRole('link', { name: '디지털 가든', exact: true }).locator('xpath=..');
    await parentRow.getByRole('button', { expanded: false }).click();

    const noteLink = tree.getByRole('link', { name: '디지털 가든과 Second Brain' });

    await expect(noteLink).toBeVisible();

    await Promise.all([page.waitForURL(/\/ko\/garden\/digital-garden-and-pkm/), noteLink.click()]);

    await expect(page).toHaveURL(/\/ko\/garden\/digital-garden-and-pkm/);
    await expect(page.getByRole('heading', { level: 1, name: '디지털 가든과 Second Brain' })).toBeVisible();

    // Sidebar persists across navigation and the active note is marked.
    await expect(sidebar).toBeVisible();
    const activeLink = tree.getByRole('link', { name: '디지털 가든과 Second Brain' });
    await expect(activeLink).toHaveAttribute('aria-current', 'page');
  });

  test('should open the search palette via Cmd/Ctrl+K and navigate to a result', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    // Wait for the header search to mount so the keydown listener is installed.
    await expect(page.getByRole('button', { name: '사이트 검색' })).toBeVisible();

    await page.locator('body').click();
    // Dispatch the keydown directly so the test stays deterministic across platforms
    // (Playwright modifier behavior varies between OS chord handling).
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    });

    const dialog = page.getByRole('dialog', { name: '검색' });
    await expect(dialog).toBeVisible();

    const input = dialog.getByPlaceholder('검색…');
    await expect(input).toBeVisible();

    await input.fill('디지털 가든');

    const result = dialog.getByRole('option', { name: /디지털 가든과 Second Brain/ });
    await expect(result).toBeVisible();

    await Promise.all([page.waitForURL(/\/ko\/garden\/digital-garden-and-pkm/), result.click()]);

    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: '디지털 가든과 Second Brain' })).toBeVisible();
  });

  test('should open the search palette by clicking the header trigger on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    const trigger = page.getByRole('button', { name: '사이트 검색' });
    await expect(trigger).toBeVisible();

    await trigger.click();

    await expect(page.getByRole('dialog', { name: '검색' })).toBeVisible();
  });

  // 가든 안에서 검색을 열면 가든으로 스코프되고, 푸터 전환으로 사이트 전체까지 넓어진다.
  test('scopes search to the garden and widens to the whole site on request', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    await page.getByRole('button', { name: '사이트 검색' }).click();
    const dialog = page.getByRole('dialog', { name: '검색' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('가든에서 검색 중')).toBeVisible();

    await dialog.getByPlaceholder('검색…').fill('나는 글 쓰는');
    await expect(dialog.getByRole('option', { name: /나는 글 쓰는 걸 좋아한다/ })).toBeHidden();

    await dialog.getByRole('button', { name: '전체에서 검색' }).click();

    await expect(dialog.getByRole('option', { name: /나는 글 쓰는 걸 좋아한다/ })).toBeVisible();
  });

  test('desktop: collapses the sidebar to reclaim width and expands it again', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    const tree = page.locator('nav[data-slot="garden-note-tree"]');
    await expect(tree).toBeVisible();

    await page.getByRole('button', { name: '사이드바 접기' }).click();
    await expect(tree).toBeHidden();

    await page.getByRole('button', { name: '사이드바 펼치기' }).click();
    await expect(tree).toBeVisible();
  });

  test('mobile: should open tree drawer via Browse button and navigate', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ko/garden');

    // Mobile inline header shows a Browse button (sidebar tree is in a Sheet).
    const browseButton = page.getByRole('button', { name: '둘러보기' });
    await expect(browseButton).toBeVisible();

    await browseButton.click();

    const drawer = page.getByRole('dialog').filter({ hasText: 'PARA 가든' });
    await expect(drawer).toBeVisible();

    // The note lives under the "디지털 가든" parent node, collapsed by default; expand it first.
    // The toggle's accessible name is localized, so select it by its collapsed state instead.
    const parentRow = drawer.getByRole('link', { name: '디지털 가든', exact: true }).locator('xpath=..');
    await parentRow.getByRole('button', { expanded: false }).click();

    const noteLink = drawer.getByRole('link', { name: '디지털 가든과 Second Brain' });
    await expect(noteLink).toBeVisible();

    await Promise.all([page.waitForURL(/\/ko\/garden\/digital-garden-and-pkm/), noteLink.click()]);

    await expect(drawer).not.toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: '디지털 가든과 Second Brain' })).toBeVisible();
  });

  test('mobile: should open the search palette via the header search button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ko/garden');

    const searchButton = page.getByRole('button', { name: '사이트 검색' });
    await expect(searchButton).toBeVisible();

    await searchButton.click();

    await expect(page.getByRole('dialog', { name: '검색' })).toBeVisible();
  });

  test('should show linked notes expanded by default and collapse on toggle', async ({ page }) => {
    await page.goto('/ko/garden/movie');

    const section = page.locator('[data-linked-notes-section]');
    await expect(section).toBeVisible();

    const trigger = section.getByRole('button', { name: /연결된 노트\s*\(\d+\)/ });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const linkedNote = section.getByRole('link', { name: '시라트 (Sirât, 2025)' });
    await expect(linkedNote).toBeVisible();

    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(linkedNote).not.toBeVisible();
  });

  test('index: shows the PARA overview and navigates to a category page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    const main = page.getByRole('main');
    const overview = main.locator('[data-slot="garden-overview"]');
    await expect(overview).toBeVisible();

    const firstCategory = overview.getByRole('link').first();
    await expect(firstCategory).toBeVisible();

    await Promise.all([page.waitForURL(/\/ko\/garden\/category\//), firstCategory.click()]);

    await expect(page).toHaveURL(/\/ko\/garden\/category\//);
    // The category page reuses the shared NoteCard list.
    await expect(main.locator('[data-slot="content-card"]').first()).toBeVisible();
  });

  test('index: lists latest notes as content cards', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    const main = page.getByRole('main');
    await expect(main.locator('[data-slot="content-card"]').first()).toBeVisible();
  });
});
