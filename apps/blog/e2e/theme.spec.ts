import { expect, Locator, Page, test } from '@playwright/test';

/**
 * 테마 트리거의 접근 가능한 이름은 로케일마다 다르다(ko: 테마 변경 / en: Change theme).
 * 이 스펙은 한 테스트 안에서 로케일을 바꾸기도 하므로 두 이름을 모두 받는 locator를 쓴다.
 */
function themeTriggerButton(page: Page) {
  return page.getByRole('button', { name: /테마 변경|Change theme/ });
}

/**
 * 버튼 클릭 후 드롭다운 메뉴가 열릴 때까지 대기
 * webkit에서 hydration이 느려서 클릭이 무시될 수 있음
 */
async function clickAndWaitForMenu(trigger: Locator, page: Page) {
  // hydration 완료 대기 - 버튼이 interactive 상태가 될 때까지
  await expect(trigger).toBeEnabled({ timeout: 10_000 });

  // 클릭 후 메뉴가 열릴 때까지 재시도
  await expect(async () => {
    await trigger.click();
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * 드롭다운 메뉴에서 옵션 선택
 */
async function selectThemeOption(page: Page, optionName: string) {
  const option = page.getByRole('menuitemradio', { name: optionName });
  await expect(option).toBeVisible({ timeout: 5_000 });
  await option.click();
}

test.describe('Theme switcher', () => {
  test('changes theme via dropdown', async ({ page }) => {
    await page.goto('/ko');

    const trigger = themeTriggerButton(page);

    await clickAndWaitForMenu(trigger, page);
    await selectThemeOption(page, 'Dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    await clickAndWaitForMenu(trigger, page);
    await selectThemeOption(page, 'Light');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect(page.locator('html')).toHaveClass(/light/);
  });
});

test.describe('Theme persistence across locale changes', () => {
  test('theme should persist when changing language', async ({ page }) => {
    await page.goto('/ko');

    // 1. 테마를 Light로 변경
    const themeTrigger = themeTriggerButton(page);
    await clickAndWaitForMenu(themeTrigger, page);
    await selectThemeOption(page, 'Light');
    await expect(page.locator('html')).toHaveClass(/light/);

    // 2. 언어를 English로 변경
    const localeTrigger = page.getByRole('button', { name: /언어 변경|Change language/ });
    await localeTrigger.click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await page.waitForURL(/\/en/);

    // 3. 테마가 Light로 유지되는지 확인
    await expect(page.locator('html')).toHaveClass(/light/);
    await expect(page.locator('html')).not.toHaveClass(/dark/);

    // 4. 다시 Korean으로 변경
    await localeTrigger.click();
    await page.getByRole('menuitemradio', { name: '한국어' }).click();
    await page.waitForURL(/\/ko/);

    // 5. 테마가 여전히 Light로 유지되는지 확인
    await expect(page.locator('html')).toHaveClass(/light/);
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('dark theme should persist when switching locales', async ({ page }) => {
    await page.goto('/en');

    // Dark 테마로 설정
    const themeTrigger = themeTriggerButton(page);
    await clickAndWaitForMenu(themeTrigger, page);
    await selectThemeOption(page, 'Dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Korean으로 변경
    const localeTrigger = page.getByRole('button', { name: /언어 변경|Change language/ });
    await localeTrigger.click();
    await page.getByRole('menuitemradio', { name: '한국어' }).click();
    await page.waitForURL(/\/ko/);

    // Dark 테마 유지 확인
    await expect(page.locator('html')).toHaveClass(/dark/);

    // 다시 English로 변경
    await localeTrigger.click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await page.waitForURL(/\/en/);

    // 여전히 Dark 유지
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('system theme should persist when changing language', async ({ page }) => {
    await page.goto('/ko');

    // System 테마로 설정 (기본값이지만 명시적으로 설정)
    const themeTrigger = themeTriggerButton(page);
    await clickAndWaitForMenu(themeTrigger, page);
    await selectThemeOption(page, 'System');

    // 언어 변경
    const localeTrigger = page.getByRole('button', { name: /언어 변경|Change language/ });
    await localeTrigger.click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await page.waitForURL(/\/en/);

    // 드롭다운에서 System이 선택되어 있는지 확인
    await clickAndWaitForMenu(themeTrigger, page);
    const systemOption = page.getByRole('menuitemradio', { name: 'System' });
    await expect(systemOption).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Theme color meta tag sync', () => {
  test('theme-color meta tag syncs with dark theme', async ({ page }) => {
    await page.goto('/ko');

    // Switch to dark theme
    const trigger = themeTriggerButton(page);
    await clickAndWaitForMenu(trigger, page);
    await selectThemeOption(page, 'Dark');

    // Wait for theme to be applied
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Check theme-color meta tag - should have dark color
    const themeColorMeta = page.locator('meta[name="theme-color"]').first();
    await expect(themeColorMeta).toHaveAttribute('content', '#0a0a0a');

    // media 속성이 제거돼야 macOS Safari가 수동 토글을 따른다
    await expect(themeColorMeta).not.toHaveAttribute('media', /.+/);
  });

  test('theme-color meta tag syncs with light theme', async ({ page }) => {
    await page.goto('/ko');

    // Switch to dark first, then to light to ensure we're testing the sync
    const trigger = themeTriggerButton(page);
    await clickAndWaitForMenu(trigger, page);
    await selectThemeOption(page, 'Dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Switch to light
    await clickAndWaitForMenu(trigger, page);
    await selectThemeOption(page, 'Light');
    await expect(page.locator('html')).toHaveClass(/light/);

    // Check theme-color meta tag - should have light color
    const themeColorMeta = page.locator('meta[name="theme-color"]').first();
    await expect(themeColorMeta).toHaveAttribute('content', '#ffffff');
  });

  test('theme-color meta tag exists after theme sync', async ({ page }) => {
    await page.goto('/ko');

    // After initial load, the sync script should ensure at least one theme-color meta exists
    const themeColorMeta = page.locator('meta[name="theme-color"]');
    await expect(themeColorMeta.first()).toBeAttached();
  });
});
