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

  test('should settle the theme before React mounts', async ({ page }) => {
    // 마운트 후에 테마를 붙이면 첫 페인트가 밝게 나갔다가 어두워지며 깜빡인다.
    await page.goto('/', { waitUntil: 'commit' });

    const early = await page.evaluate(() => ({
      className: document.documentElement.className,
      colorScheme: document.documentElement.style.colorScheme,
      mounted: (document.getElementById('root')?.childElementCount ?? 0) > 0,
    }));

    expect(early.mounted).toBe(false);
    expect(early.className).toMatch(/\b(light|dark)\b/);
    expect(early.colorScheme).toMatch(/^(light|dark)$/);
  });

  test('should keep the stored theme across reloads', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /테마로 전환/ }).click();
    const chosen = await page.evaluate(() => document.documentElement.className);

    await page.reload({ waitUntil: 'commit' });
    expect(await page.evaluate(() => document.documentElement.className)).toBe(chosen);
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
    await expect(page.getByRole('button', { name: '재생', exact: true })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCSS('pointer-events', 'none');
  });

  test('should toggle a lyric row off', async ({ page }) => {
    await page.goto('/');

    const koToggle = page.getByRole('button', { name: '번역' });
    await expect(koToggle).toHaveAttribute('aria-pressed', 'true');
    await koToggle.click();
    await expect(koToggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('should cycle the playback mode', async ({ page }) => {
    await page.goto('/');

    const button = page.getByRole('button', { name: /재생 모드/ });
    await expect(button).toHaveAccessibleName(/반복 없음/);
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    await button.click();
    await expect(button).toHaveAccessibleName(/전체 반복/);
    await expect(button).toHaveAttribute('aria-pressed', 'true');

    await button.click();
    await expect(button).toHaveAccessibleName(/한 곡 반복/);

    await page.reload();
    await expect(page.getByRole('button', { name: /재생 모드/ })).toHaveAccessibleName(/한 곡 반복/);
  });

  test('should fit its controls on a 320px screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');

    const overflow = await page.evaluate(() => {
      const toggle = document.querySelector('[aria-label="가사 표시 설정"]')!;
      const row = toggle.parentElement!;
      return {
        row: row.scrollWidth - row.clientWidth,
        doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(overflow.row).toBeLessThanOrEqual(0);
    expect(overflow.doc).toBeLessThanOrEqual(0);
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
