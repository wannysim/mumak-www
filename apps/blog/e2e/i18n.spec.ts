import { expect, test } from '@playwright/test';

test.describe('i18n - Internationalization', () => {
  test('should redirect root to a locale path', async ({ page }) => {
    await page.goto('/');
    // Should redirect to either /ko or /en based on browser settings
    await page.waitForURL(/\/(ko|en)/);
    expect(page.url()).toMatch(/\/(ko|en)/);
  });

  test('should display Korean content on /ko', async ({ page }) => {
    await page.goto('/ko');

    // Check Korean UI elements
    await expect(page.getByRole('link', { name: 'Wan Sim' })).toBeVisible();
    await expect(page.getByText('글을 써보고 싶어서 만든 블로그입니다.')).toBeVisible();
    await expect(page.getByText('웹 기술과 사용자 경험에 관심이 많습니다.')).toBeVisible();
    await expect(page.getByText('사사로운 일상부터 개발자로서 고민한 흔적들을 기록하고자 합니다.')).toBeVisible();
    await expect(page.getByText('최신 글')).toBeVisible();
  });

  test('should display English content on /en', async ({ page }) => {
    await page.goto('/en');

    // Check English UI elements
    await expect(page.getByRole('link', { name: 'Wan Sim' })).toBeVisible();
    await expect(page.getByText('Created this blog to write anything I want.')).toBeVisible();
    await expect(page.getByText("I'm interested in web technologies and user experience.")).toBeVisible();
    await expect(page.getByText("Gonna write about anything from daily life to developer's thoughts.")).toBeVisible();
    await expect(page.getByText('Latest Post')).toBeVisible();
  });

  test('should switch language using locale switcher', async ({ page }) => {
    await page.goto('/ko');

    // Verify we're on Korean page
    await expect(page.getByText('최신 글')).toBeVisible();

    // Click English link (uses DropdownMenuRadioItem -> menuitemradio role)
    await page.getByRole('button', { name: '언어 변경' }).click();
    const englishOption = page.getByRole('menuitemradio', { name: 'English' });
    await expect(englishOption).toBeVisible();
    await englishOption.click();

    // Verify we're on English page
    await page.waitForURL(/\/en/);
    await expect(page.getByText('Latest Post')).toBeVisible();
  });

  test('should maintain page path when switching language', async ({ page }) => {
    // This test will be more meaningful when we have category pages
    await page.goto('/ko');

    // Click English
    await page.getByRole('button', { name: '언어 변경' }).click();
    const englishOption = page.getByRole('menuitemradio', { name: 'English' });
    await expect(englishOption).toBeVisible();
    await englishOption.click();
    await page.waitForURL(/\/en/);

    // Click Korean back
    await page.getByRole('button', { name: 'Change language' }).click();
    const koreanOption = page.getByRole('menuitemradio', { name: '한국어' });
    await expect(koreanOption).toBeVisible();
    await koreanOption.click();
    await page.waitForURL(/\/ko/);

    // Should be back on Korean home
    await expect(page.getByText('최신 글')).toBeVisible();
  });

  test('should have correct html lang attribute', async ({ page }) => {
    // Korean page
    await page.goto('/ko');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko');

    // English page
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
