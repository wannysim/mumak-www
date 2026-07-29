import { expect, test, type Page } from '@playwright/test';

/**
 * 앱은 가사를 네트워크에서 받지 않는다.
 * 모바일 시나리오는 실제 파일 import → IndexedDB 경로로 synthetic fixture를 넣는다.
 */
const LYRICS = Array.from({ length: 40 }, (_, index) => ({
  time: index * 5,
  jp: `日本語の歌詞 ${index}`,
  pron: `니혼고노 카시 ${index}`,
  ko: `일본어 가사 ${index}`,
}));

async function gotoWithLyrics(page: Page) {
  // YouTube를 막아 플레이어가 뜨지 않게 한다. 재생이 시작되면 활성 줄이 계속 넘어가면서
  // 자동 스크롤이 따라가 "탭한 줄이 가운데" 단언이 깨진다. 네트워크 의존도 함께 사라진다.
  await page.route(/(youtube\.com|ytimg\.com|youtube-nocookie\.com)/, route => route.abort());

  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'kaiju-no-hanauta.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(LYRICS)),
  });
  await expect(page.getByRole('button', { name: /日本語の歌詞 0/ })).toBeVisible();
}

const lyricsBox = (page: Page) => page.locator('ul').first().locator('..');

/** 줄의 중심이 가사 뷰포트 중심에서 얼마나 벗어나 있는지(px). */
async function offsetFromCenter(page: Page, name: RegExp) {
  const line = await page.getByRole('button', { name }).boundingBox();
  const view = await lyricsBox(page).boundingBox();
  return Math.abs(line!.y + line!.height / 2 - (view!.y + view!.height / 2));
}

/**
 * 줄이 가운데로 올 때까지 기다린다.
 *
 * "스크롤이 멈췄는지"를 보면 안 된다. smooth scroll이 시작되기 전에도 scrollTop은
 * 잠시 그대로라 멈춘 것으로 오판하고, 그대로 단언하면 간헐적으로 실패한다.
 * 원하는 최종 상태를 직접 기다리는 편이 짧고 확실하다.
 */
async function expectCentered(page: Page, name: RegExp) {
  await expect.poll(() => offsetFromCenter(page, name), { timeout: 5000 }).toBeLessThan(40);
}

test.describe('Mobile karaoke', () => {
  test('keeps empty-state import help and errors reachable in short landscape', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 320 });
    await page.route(/(youtube\.com|ytimg\.com|youtube-nocookie\.com)/, route => route.abort());
    await page.goto('/');

    const emptyState = page.locator('.karaoke-lyrics');
    expect(await emptyState.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await emptyState.evaluate(element => element.scrollTo(0, element.scrollHeight));

    await expect(page.getByRole('button', { name: '가사 파일 불러오기' })).toBeInViewport();
    await expect(page.getByText('JSON · 여러 곡 동시 선택 가능')).toBeInViewport();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'kaiju-no-hanauta.json',
      mimeType: 'application/json',
      buffer: Buffer.from('not-json'),
    });
    await expect(page.getByRole('alert')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(
      0
    );
  });

  test('scrolls lyrics without ever scrolling the document', async ({ page }) => {
    await gotoWithLyrics(page);

    const container = lyricsBox(page);
    expect(await container.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);

    await container.evaluate(el => el.scrollBy(0, 600));
    await expect.poll(() => container.evaluate(el => el.scrollTop)).toBeGreaterThan(0);

    // 가사가 아무리 스크롤돼도 헤더와 플레이어는 화면에 남아야 한다.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
    // "재생 모드" 버튼과 겹치지 않도록 접근명 전체를 고정한다.
    await expect(page.getByRole('button', { name: /^(재생|일시정지)$/ })).toBeInViewport();
  });

  test('centers a lyric line when tapped', async ({ page }) => {
    await gotoWithLyrics(page);

    await page.getByRole('button', { name: /日本語の歌詞 6/ }).tap();
    await expectCentered(page, /日本語の歌詞 6/);
  });

  test('still centers on tap right after the user scrolled by hand', async ({ page }) => {
    await gotoWithLyrics(page);
    const container = lyricsBox(page);

    // 손으로 스크롤하면 자동 스크롤이 3초간 양보한다. 그 사이의 명시적 탭은 예외여야 한다.
    await container.evaluate(el => {
      el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true }));
      el.scrollBy(0, 900);
    });
    await page.getByRole('button', { name: /日本語の歌詞 12/ }).tap();
    await expectCentered(page, /日本語の歌詞 12/);
  });

  test('re-centers when tapping the line that is already active', async ({ page }) => {
    await gotoWithLyrics(page);
    const container = lyricsBox(page);

    await page.getByRole('button', { name: /日本語の歌詞 9/ }).tap();
    // 첫 탭의 스크롤이 끝난 뒤에 손 스크롤을 넣어야 두 동작이 겹치지 않는다.
    await expectCentered(page, /日本語の歌詞 9/);

    await container.evaluate(el => {
      el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true }));
      el.scrollBy(0, 500);
    });
    await page.getByRole('button', { name: /日本語の歌詞 9/ }).tap();
    await expectCentered(page, /日本語の歌詞 9/);
  });

  test('switches songs by tapping the header controls', async ({ page }) => {
    await gotoWithLyrics(page);

    await page.getByRole('button', { name: '다음 곡' }).tap();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('踊り子');
  });

  test('never overflows horizontally', async ({ page }) => {
    await gotoWithLyrics(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('keeps every control at a comfortable touch size', async ({ page }) => {
    await gotoWithLyrics(page);

    for (const name of ['이전 곡', '다음 곡', '싱크 편집 모드', /테마로 전환/, /READ/]) {
      const box = await page.getByRole('button', { name: name as string }).boundingBox();
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
    }
  });

  test('offers a persistent reading mode for pronunciation and translation', async ({ page }) => {
    await gotoWithLyrics(page);

    const activeLine = page.getByRole('button', { name: /日本語の歌詞 12/ });
    await activeLine.tap();
    await expect(activeLine).toHaveAttribute('aria-current', 'true');
    await expectCentered(page, /日本語の歌詞 12/);

    const japanese = activeLine.locator('.lyric-jp');
    const pronunciation = activeLine.locator('.lyric-pron');
    const translation = activeLine.locator('.lyric-ko');
    const fontSize = (locator: typeof japanese) =>
      locator.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));

    const before = {
      japanese: await fontSize(japanese),
      pronunciation: await fontSize(pronunciation),
      translation: await fontSize(translation),
    };

    const toggle = page.getByRole('button', { name: /READ/ });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.tap();

    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(lyricsBox(page)).toHaveAttribute('data-reading-mode', 'true');
    await expectCentered(page, /日本語の歌詞 12/);

    const after = {
      japanese: await fontSize(japanese),
      pronunciation: await fontSize(pronunciation),
      translation: await fontSize(translation),
    };
    expect(after.japanese).toBeLessThan(before.japanese);
    expect(after.pronunciation).toBeGreaterThan(before.pronunciation);
    expect(after.translation).toBeGreaterThan(before.translation);

    await page.reload();
    await expect(lyricsBox(page)).toHaveAttribute('data-reading-mode', 'true');
  });

  test('keeps both the player and lyrics usable in a short landscape viewport', async ({ page }) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await gotoWithLyrics(page);

    const player = await page.locator('.karaoke-player').boundingBox();
    const lyrics = await lyricsBox(page).boundingBox();
    const slider = await page.getByRole('slider', { name: '재생 위치' }).boundingBox();

    expect(player!.width).toBeGreaterThanOrEqual(200);
    expect(player!.height).toBeGreaterThanOrEqual(200);
    expect(slider!.width).toBeGreaterThanOrEqual(44);
    expect(lyrics!.width).toBeGreaterThan(0);
    expect(lyrics!.height).toBeGreaterThan(100);
    await expect(page.getByRole('button', { name: /日本語の歌詞 0/ })).toBeInViewport();

    for (const name of [/^JP,/, /^PRON,/, /^KO,/, /READ/]) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
    }

    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    expect(overflow).toEqual({ x: 0, y: 0 });
  });

  test('keeps the complete toolbar visible at the narrow landscape boundary', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 320 });
    await gotoWithLyrics(page);

    const player = await page.locator('.karaoke-player').boundingBox();
    expect(player!.width).toBeGreaterThanOrEqual(200);
    expect(player!.height).toBeGreaterThanOrEqual(200);

    const toolbar = page.locator('.karaoke-toolbar');
    expect(await toolbar.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);

    for (const name of [/^JP,/, /^PRON,/, /^KO,/, /READ/, /테마로 전환/, '싱크 편집 모드']) {
      const button = page.getByRole('button', { name: name as string });
      const box = await button.boundingBox();
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      await expect(button).toBeInViewport();
    }
  });

  test('avoids a one-column layout cliff near 600px landscape height', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 561 });
    await gotoWithLyrics(page);

    const activeLine = await page.getByRole('button', { name: /日本語の歌詞 0/ }).boundingBox();
    const lyrics = await lyricsBox(page).boundingBox();

    expect(lyrics!.height).toBeGreaterThan(activeLine!.height);
  });
});
