import { expect, test, type Page } from '@playwright/test';

/**
 * 가사 파일(public/lyrics)은 저작권 때문에 저장소에 없다.
 * 모바일 시나리오는 가사가 있어야 의미가 있으므로 fixture를 주입해 CI에서도 동일하게 돌린다.
 */
const LYRICS = Array.from({ length: 40 }, (_, index) => ({
  time: index * 5,
  jp: `日本語の歌詞 ${index}`,
  pron: `니혼고노 카시 ${index}`,
  ko: `일본어 가사 ${index}`,
}));

async function gotoWithLyrics(page: Page) {
  await page.route('**/lyrics/*.json', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LYRICS) })
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: /日本語の歌詞 0/ })).toBeVisible();
}

const lyricsBox = (page: Page) => page.locator('ul').first().locator('..');

/** 스크롤이 멈출 때까지 기다린다. smooth scroll은 여러 프레임에 걸쳐 진행된다. */
async function waitForScrollSettled(page: Page) {
  const readTop = () => lyricsBox(page).evaluate(el => el.scrollTop);
  let previous = await readTop();
  let stableRounds = 0;

  await expect
    .poll(
      async () => {
        const current = await readTop();
        stableRounds = current === previous ? stableRounds + 1 : 0;
        previous = current;
        return stableRounds;
      },
      { intervals: [50], timeout: 5000 }
    )
    .toBeGreaterThan(3);
}

/** 줄의 중심이 가사 뷰포트 중심에서 얼마나 벗어나 있는지(px). */
async function offsetFromCenter(page: Page, name: RegExp) {
  const line = await page.getByRole('button', { name }).boundingBox();
  const view = await lyricsBox(page).boundingBox();
  return Math.abs(line!.y + line!.height / 2 - (view!.y + view!.height / 2));
}

test.describe('Mobile karaoke', () => {
  test('scrolls lyrics without ever scrolling the document', async ({ page }) => {
    await gotoWithLyrics(page);

    const container = lyricsBox(page);
    expect(await container.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);

    await container.evaluate(el => el.scrollBy(0, 600));
    await expect.poll(() => container.evaluate(el => el.scrollTop)).toBeGreaterThan(0);

    // 가사가 아무리 스크롤돼도 헤더와 플레이어는 화면에 남아야 한다.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
    await expect(page.getByRole('button', { name: /재생|일시정지/ })).toBeInViewport();
  });

  test('centers a lyric line when tapped', async ({ page }) => {
    await gotoWithLyrics(page);

    await page.getByRole('button', { name: /日本語の歌詞 6/ }).tap();
    await waitForScrollSettled(page);

    expect(await offsetFromCenter(page, /日本語の歌詞 6/)).toBeLessThan(40);
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
    await waitForScrollSettled(page);

    expect(await offsetFromCenter(page, /日本語の歌詞 12/)).toBeLessThan(40);
  });

  test('re-centers when tapping the line that is already active', async ({ page }) => {
    await gotoWithLyrics(page);
    const container = lyricsBox(page);

    await page.getByRole('button', { name: /日本語の歌詞 9/ }).tap();
    await waitForScrollSettled(page);

    await container.evaluate(el => {
      el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true }));
      el.scrollBy(0, 500);
    });
    await page.getByRole('button', { name: /日本語の歌詞 9/ }).tap();
    await waitForScrollSettled(page);

    expect(await offsetFromCenter(page, /日本語の歌詞 9/)).toBeLessThan(40);
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

    for (const name of ['이전 곡', '다음 곡', '싱크 편집 모드', /테마로 전환/]) {
      const box = await page.getByRole('button', { name: name as string }).boundingBox();
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
    }
  });
});
