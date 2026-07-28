import { expect, test } from '@playwright/test';

test.describe('Karaoke Home', () => {
  test('should display the current song and display toggles', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('怪獣の花唄');
    await expect(page.getByRole('button', { name: '日本語' })).toBeVisible();
    await expect(page.getByRole('button', { name: '발음' })).toBeVisible();
    await expect(page.getByRole('button', { name: '번역' })).toBeVisible();
  });

  test('should switch songs from the drawer', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /곡 목록 열기/ }).click();
    await expect(page.getByText('곡 선택')).toBeVisible();

    await page.getByRole('button', { name: /踊り子/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('踊り子');
  });

  test('should step through songs with the prev and next buttons', async ({ page }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', { level: 1 });

    await page.getByRole('button', { name: '다음 곡' }).click();
    await expect(heading).toContainText('踊り子');

    await page.getByRole('button', { name: '이전 곡' }).click();
    await expect(heading).toContainText('怪獣の花唄');

    // 첫 곡에서 이전을 누르면 마지막 곡으로 순환한다.
    await page.getByRole('button', { name: '이전 곡' }).click();
    await expect(heading).toContainText('タイムパラドックス');
  });

  test('should keep the selected song after reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /곡 목록 열기/ }).click();
    await page.getByRole('button', { name: /napori/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('napori');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('napori');
  });

  test('should never scroll the document itself', async ({ page }) => {
    await page.goto('/');

    // 문서가 스크롤되면 가사 자동 스크롤이 헤더와 플레이어를 화면 밖으로 밀어낸다.
    const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('should shield the YouTube iframe behind a play toggle', async ({ page }) => {
    await page.goto('/');

    // iframe이 직접 탭되면 YouTube 앱으로 튕기므로 오버레이가 항상 위에 있어야 한다.
    await expect(page.getByRole('button', { name: '재생' })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCSS('pointer-events', 'none');
  });

  test('should toggle a lyric row off', async ({ page }) => {
    await page.goto('/');

    const koToggle = page.getByRole('button', { name: '번역' });
    await expect(koToggle).toHaveAttribute('aria-pressed', 'true');
    await koToggle.click();
    await expect(koToggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('should be usable on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /곡 목록 열기/ })).toBeVisible();

    // 모바일 터치 타깃은 44px 이상을 유지한다.
    for (const name of ['이전 곡', '다음 곡', '싱크 편집 모드']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
});
