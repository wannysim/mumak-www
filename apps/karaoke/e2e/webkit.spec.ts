import { expect, test } from '@playwright/test';

const LYRICS = [{ time: 1, jp: '練習の歌', pron: '렌슈노 우타', ko: '연습 노래' }];

test.describe('Mobile WebKit local library', () => {
  test('imports, restores after reload, and downloads a backup', async ({ page }) => {
    await page.route(/(youtube\.com|ytimg\.com|youtube-nocookie\.com)/, route => route.abort());
    await page.goto('/');

    await page.locator('input[type="file"]').setInputFiles({
      name: 'kaiju-no-hanauta.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(LYRICS)),
    });
    await expect(page.getByRole('button', { name: /練習の歌/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /練習の歌/ })).toBeVisible();

    await page.getByRole('button', { name: '앱 정보' }).click();
    const downloadStarted = page.waitForEvent('download');
    await page.getByRole('button', { name: '백업 내보내기' }).click();
    const download = await downloadStarted;

    expect(download.suggestedFilename()).toMatch(/^karaoke-lyrics-backup-\d{4}-\d{2}-\d{2}\.json$/);
    await expect(page.getByText('1곡의 백업을 저장했습니다.')).toBeVisible();
  });
});
