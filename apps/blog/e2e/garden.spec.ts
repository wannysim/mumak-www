import { expect, test } from '@playwright/test';

test.describe('Garden Page (PARA Sidebar Navigation)', () => {
  test('should display PARA sidebar with category sections on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    const sidebar = page.locator('aside').filter({ hasText: 'PARA 가든' });
    await expect(sidebar).toBeVisible();

    const tree = sidebar.getByRole('navigation', { name: 'Garden notes' });
    await expect(tree).toBeVisible();

    // Categories with content render as section headers (no expand toggle).
    await expect(tree.getByText('Projects', { exact: true })).toBeVisible();
    await expect(tree.getByText('Areas', { exact: true })).toBeVisible();
  });

  test('should navigate to a note via the sidebar tree and mark it active', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    const sidebar = page.locator('aside').filter({ hasText: 'PARA 가든' });
    const tree = sidebar.getByRole('navigation', { name: 'Garden notes' });
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

    // Wait for the sidebar to mount so the keydown listener is installed.
    const sidebar = page.locator('aside').filter({ hasText: 'PARA 가든' });
    await expect(sidebar.getByRole('button', { name: /노트 검색…/ })).toBeVisible();

    await page.locator('body').click();
    // Dispatch the keydown directly so the test stays deterministic across platforms
    // (Playwright modifier behavior varies between OS chord handling).
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    });

    const dialog = page.getByRole('dialog', { name: '노트 검색' });
    await expect(dialog).toBeVisible();

    const input = dialog.getByPlaceholder('노트 검색…');
    await expect(input).toBeVisible();

    await input.fill('디지털 가든');

    const result = dialog.getByRole('option', { name: /디지털 가든과 Second Brain/ });
    await expect(result).toBeVisible();

    await Promise.all([page.waitForURL(/\/ko\/garden\/digital-garden-and-pkm/), result.click()]);

    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: '디지털 가든과 Second Brain' })).toBeVisible();
  });

  test('should open the search palette by clicking the trigger on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/ko/garden');

    const sidebar = page.locator('aside').filter({ hasText: 'PARA 가든' });
    const trigger = sidebar.getByRole('button', { name: /노트 검색…/ });
    await expect(trigger).toBeVisible();

    await trigger.click();

    await expect(page.getByRole('dialog', { name: '노트 검색' })).toBeVisible();
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

    const noteLink = drawer.getByRole('link', { name: '디지털 가든과 Second Brain' });
    await expect(noteLink).toBeVisible();

    await Promise.all([page.waitForURL(/\/ko\/garden\/digital-garden-and-pkm/), noteLink.click()]);

    await expect(drawer).not.toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: '디지털 가든과 Second Brain' })).toBeVisible();
  });

  test('mobile: should open the search palette via the search button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ko/garden');

    const searchButton = page.getByRole('button', { name: '노트 검색' });
    await expect(searchButton).toBeVisible();

    await searchButton.click();

    await expect(page.getByRole('dialog', { name: '노트 검색' })).toBeVisible();
  });

  test('should keep linked notes collapsed by default and expand on toggle', async ({ page }) => {
    await page.goto('/ko/garden/movie');

    const section = page.locator('[data-linked-notes-section]');
    await expect(section).toBeVisible();

    const trigger = section.getByRole('button', { name: /연결된 노트\s*\(\d+\)/ });
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    const linkedList = section.locator('ul.space-y-2');
    await expect(linkedList).not.toBeVisible();

    await trigger.click();

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(linkedList).toBeVisible();
    await expect(section.getByRole('link', { name: '시라트 (Sirât, 2025)' })).toBeVisible();
  });
});
