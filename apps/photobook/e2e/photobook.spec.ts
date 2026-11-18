import { expect, test, type Locator, type Page } from '@playwright/test';

function folio(page: Page) {
  return page.locator('[data-folio]');
}

/** 페이지 오류를 모은다. 테스트 끝에서 비어 있어야 한다. */
function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('요소 위치를 찾지 못했다');
  }
  return box;
}

/**
 * 화면 밖으로 나간 요소가 없는지. 페이지는 스크롤하지 않고(html·body overflow: hidden) 책·러닝 헤드가 fixed라
 * scrollWidth로는 넘침을 잡을 수 없어, 보이는 요소의 상자가 뷰포트 안에 있는지 본다.
 */
async function expectInsideViewport(page: Page, locators: Locator[]) {
  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error('뷰포트 크기가 없다');
  }
  for (const locator of locators) {
    const box = await boxOf(locator);
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.y).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
  }
}

/** 러닝 헤드가 글자 한 줄이고 책 위를 덮지 않는지. */
async function expectOneLineHeadAboveBook(page: Page) {
  const lines = await page.getByRole('banner').evaluate(header =>
    Array.from(header.querySelectorAll('p, button'), line => ({
      height: line.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(line).lineHeight),
    }))
  );
  for (const line of lines) {
    expect(line.height).toBeLessThanOrEqual(line.lineHeight + 0.5);
  }
  const head = await boxOf(page.getByRole('banner'));
  const book = await boxOf(page.locator('.book'));
  expect(head.y + head.height).toBeLessThanOrEqual(book.y + 0.5);
}

async function openWithEnter(page: Page, firstPages = '01–02쪽') {
  const book = page.getByRole('button', { name: '책 펼치기' });
  await expect(book).toBeVisible();
  await book.focus();
  await page.keyboard.press('Enter');
  const region = page.getByRole('region', { name: '펼친 책' });
  await expect(region).toBeVisible();
  await expect(page.getByRole('status')).toHaveText(firstPages);
  return region;
}

function closedStage(page: Page) {
  return page.locator('.closed-stage');
}

function bookTransform(page: Page) {
  return page.locator('.closed-book').evaluate(element => (element as HTMLElement).style.transform);
}

/** 다음 두 애니메이션 프레임을 기다린다(임의 시간 대기 대신 프레임으로 잰다). */
async function nextFrames(page: Page) {
  await page.evaluate(
    () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  );
}

/** 덮기가 끝나 닫힌 책이 쉬고 포커스가 닫힌 책으로 옮겨졌는지. */
async function expectClosedOn(page: Page, face: '앞표지' | '뒤표지') {
  await expect(closedStage(page)).toHaveAttribute('data-phase', 'closed');
  await expect(page.getByRole('region', { name: '펼친 책' })).toHaveCount(0);
  // 잡지 표지에는 쪽 번호가 없다(닫힌 책에서는 쪽 번호 자리를 비운다).
  await expect(folio(page)).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText(`책을 덮었다, ${face}`);
  await expect(page.getByRole('button', { name: '책 펼치기' })).toBeFocused();
}

type Point = { x: number; y: number };

/**
 * 3D 책 상자의 8개 꼭짓점이 화면에 그려진 자리. 책 안에 크기 없는 점을 꼭짓점마다 넣어 브라우저가 계산한 위치를 읽는다
 * (모델의 투영 계산과 무관한 실제 렌더 결과).
 */
function renderedBookCorners(page: Page): Promise<Point[]> {
  return page.locator('.closed-book').evaluate(book => {
    const element = book as HTMLElement;
    const depth = Number.parseFloat(element.style.getPropertyValue('--book-d'));
    const corners: Array<{ x: number; y: number }> = [];
    for (const x of [0, element.offsetWidth]) {
      for (const y of [0, element.offsetHeight]) {
        for (const z of [-depth / 2, depth / 2]) {
          const probe = document.createElement('div');
          probe.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0;transform:translateZ(${z}px)`;
          element.append(probe);
          const rect = probe.getBoundingClientRect();
          corners.push({ x: rect.x, y: rect.y });
          probe.remove();
        }
      }
    }
    return corners;
  });
}

/** 그려진 책 상자를 감싼 화면 폭·높이. 옆으로 돌면 폭이, 위아래로 돌면 높이가 표지보다 크게 준다. */
async function renderedBookSize(page: Page) {
  const corners = await renderedBookCorners(page);
  const xs = corners.map(corner => corner.x);
  const ys = corners.map(corner => corner.y);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function cross(origin: Point, a: Point, b: Point) {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

/** 볼록 껍질(반시계, 화면 좌표). */
function convexHull(points: Point[]): Point[] {
  const sorted = points.toSorted((a, b) => a.x - b.x || a.y - b.y);
  const half = (list: Point[]) => {
    const hull: Point[] = [];
    for (const point of list) {
      while (hull.length >= 2 && cross(hull[hull.length - 2]!, hull[hull.length - 1]!, point) <= 0) {
        hull.pop();
      }
      hull.push(point);
    }
    return hull.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.toReversed())];
}

/** 점에서 볼록 다각형 바깥까지의 거리(안이면 음수). */
function distanceOutside(point: Point, hull: Point[]): number {
  let outside = -Infinity;
  for (const [index, from] of hull.entries()) {
    const to = hull[(index + 1) % hull.length]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    outside = Math.max(outside, -cross(from, to, point) / length);
  }
  return outside;
}

/** 비교할 앞표지 자리: 책등 쪽 위 모서리. 거의 닫힌 판이라도 이 자리는 아래 쪽과 겹친다. */
const COVER_PROBE_WIDTH_RATIO = 0.3;
const COVER_PROBE_HEIGHT_RATIO = 0.25;

/**
 * 앞표지 책등 쪽 위 모서리를 두 번 찍어 비교한다: 그대로 한 번, 표지 아래 쪽(.closed-book__under)을 숨기고 한 번.
 * 표지 판이 아래 쪽 위에 그려진다면 둘이 같다. 아래 쪽이 판 위로 올라오면(DOM 순서로 칠하는 엔진, 판과 쪽이 1px 간격으로 붙는
 * 순간의 Chromium) 색 있는 표지 그림이 흰 쪽에 가려져 달라진다. Chromium은 clip 스크린샷을 따로 래스터해 띠가 사라지므로
 * 화면 전체를 찍고 페이지 안 canvas로 잘라 픽셀을 읽는다(새 의존성 없이).
 */
async function differingPixelsUnderCover(page: Page): Promise<{ differing: number; total: number }> {
  // 표지 그림이 늦게 오면 두 장 모두 바탕색만 찍혀 아래 쪽이 올라와도 차이를 놓칠 수 있다.
  await expect
    .poll(() =>
      page.locator('.closed-book__cover-front img').evaluate(image => (image as HTMLImageElement).naturalWidth)
    )
    .toBeGreaterThan(0);
  const area = await page.locator('.closed-book__cover-front').evaluate(
    (cover, [widthRatio, heightRatio]) => {
      const box = cover.getBoundingClientRect();
      return {
        x: Math.round(box.x + 2),
        y: Math.round(box.y + 2),
        width: Math.round(box.width * widthRatio),
        height: Math.round(box.height * heightRatio),
      };
    },
    [COVER_PROBE_WIDTH_RATIO, COVER_PROBE_HEIGHT_RATIO] as const
  );
  const shown = await page.screenshot({ scale: 'css' });
  const style = await page.addStyleTag({ content: '.closed-book__under { visibility: hidden !important; }' });
  const hidden = await page.screenshot({ scale: 'css' });
  await style.evaluate(element => element.parentNode?.removeChild(element));
  return page.evaluate(
    async ([first, second, crop]) => {
      async function pixels(base64: string) {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = crop.width;
        canvas.height = crop.height;
        const context = canvas.getContext('2d');
        if (context === null) {
          throw new Error('canvas 2d가 없다');
        }
        // 스크린샷은 scale 'css'로 찍어 CSS px 1:1이다.
        context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
        return context.getImageData(0, 0, crop.width, crop.height).data;
      }
      const [a, b] = await Promise.all([pixels(first), pixels(second)]);
      let differing = 0;
      for (let index = 0; index < a.length; index += 4) {
        const delta = Math.max(
          Math.abs(a[index]! - b[index]!),
          Math.abs(a[index + 1]! - b[index + 1]!),
          Math.abs(a[index + 2]! - b[index + 2]!)
        );
        if (delta > 32) {
          differing += 1;
        }
      }
      return { differing, total: a.length / 4 };
    },
    [shown.toString('base64'), hidden.toString('base64'), area] as const
  );
}

/** 앞표지 판 각도(deg, 0이면 닫힘). */
async function frontCoverAngle(page: Page): Promise<number> {
  const value = await page
    .locator('.closed-book')
    .evaluate(book => (book as HTMLElement).style.getPropertyValue('--cover-angle'));
  return Number.parseFloat(value);
}

/** 그 점을 눌렀을 때 브라우저가 쓸 touch-action(누른 요소와 조상 중 하나라도 none이면 none). */
function effectiveTouchActionAt(page: Page, point: Point): Promise<string> {
  return page.evaluate(({ x, y }) => {
    for (let element = document.elementFromPoint(x, y); element !== null; element = element.parentElement) {
      if (getComputedStyle(element).touchAction === 'none') {
        return 'none';
      }
    }
    return 'auto';
  }, point);
}

/** 버튼 상자 안 한 점에서 눌러 여러 단계로 끌고 뗀다. */
async function drag(page: Page, from: { x: number; y: number }, moves: Array<{ x: number; y: number }>) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const to of moves) {
    await page.mouse.move(to.x, to.y, { steps: 8 });
  }
  await page.mouse.up();
}

test.describe('Photobook', () => {
  test('shows the closed book first', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page).toHaveTitle('Photobook');
    await expect(page.getByRole('main', { name: 'Photobook' })).toBeVisible();
    const book = page.getByRole('button', { name: '책 펼치기' });
    await expect(book).toBeVisible();
    await expect(book).toHaveAccessibleDescription(/앞표지: Meoru 그림\. 뒤표지: Meoru Butler/);
    // 빌드 결과의 경로(BASE_URL)로 앞·뒤표지 그림이 실제로 받아져 디코드된다.
    for (const face of ['.closed-book__cover-front', '.closed-book__back']) {
      await expect
        .poll(() => page.locator(`${face} img`).evaluate(image => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    }
    // 잡지 표지에는 쪽 번호가 없다. 펼치면 나타난다.
    await expect(folio(page)).toHaveCount(0);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(['rgb(255, 255, 255)', 'oklch(1 0 0)']).toContain(background);
    await expectInsideViewport(page, [book, page.getByRole('banner')]);
    expect(errors).toEqual([]);
  });

  test('opens with Enter and turns with ArrowRight and the page buttons', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const region = await openWithEnter(page);
    await expect(region).toBeFocused();
    await expect(folio(page)).toContainText('01–02/08');

    const previous = region.getByRole('button', { name: '이전 쪽' });
    const next = region.getByRole('button', { name: '다음 쪽' });
    const closeFront = region.getByRole('button', { name: '앞표지 덮기' });
    // 첫 펼침의 이전 쪽 기둥은 앞표지 덮기 버튼이다(2026-11-16 결정).
    await expect(previous).toHaveCount(0);
    await expect(closeFront).not.toHaveAttribute('aria-disabled');
    for (const button of [closeFront, next]) {
      const box = await boxOf(button);
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }
    await expectInsideViewport(page, [page.locator('.book'), page.getByRole('banner'), closeFront, next]);
    await expectOneLineHeadAboveBook(page);

    await page.keyboard.press('ArrowRight');
    await expect(folio(page)).toContainText('03–04/08');
    await expect(page.getByRole('status')).toHaveText('03–04쪽');

    // 키보드로 누른 넘김 버튼에는 포커스가 남아 이어서 넘길 수 있다(macOS WebKit은 마우스 클릭으로 버튼에 포커스를 주지 않는다).
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(folio(page)).toContainText('05–06/08');
    await expect(next).toBeFocused();

    await next.click();
    await expect(folio(page)).toContainText('07–08/08');
    await expect(next).toHaveCount(0);
    await expect(region.getByRole('button', { name: '뒤표지 덮기' })).toBeVisible();
    await expect(region.getByText('판권면 · 임시')).toBeVisible();

    await previous.click();
    await expect(folio(page)).toContainText('05–06/08');
    expect(errors).toEqual([]);
  });

  test('turns one page per key press even while a leaf is landing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await openWithEnter(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(folio(page)).toContainText('07–08/08');
    await expect(page.getByRole('status')).toHaveText('07–08쪽');
  });

  test('turns pages by dragging forward and back, and returns a short drag without announcing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const region = await openWithEnter(page);
    const status = page.getByRole('status');
    const zone = await boxOf(region.getByRole('button', { name: '다음 쪽' }));
    // 기둥의 왼쪽 끝이 쪽 바깥 가장자리 띠의 안쪽이다. 그 근처 아래쪽을 잡는다.
    const start = { x: zone.x + 20, y: zone.y + zone.height * 0.8 };

    // 끌었다가 누른 자리 너머로 되돌려 놓으면 넘기기 전 화면으로 돌아오고 알리지 않는다.
    // (놓기 속도는 마지막 100ms를 보므로, 되돌린 끝점을 누른 점보다 바깥에 두어 이동 속도와 무관하게 복귀가 되게 한다.)
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 200, start.y - 10, { steps: 8 });
    await expect(region).toHaveAttribute('data-phase', 'turning');
    await expect(region.locator('[data-role="flap"]')).toHaveCount(1);
    await page.mouse.move(start.x + 60, start.y, { steps: 8 });
    await page.mouse.up();
    await expect(region).toHaveAttribute('data-phase', 'open');
    await expect(folio(page)).toContainText('01–02/08');
    await expect(status).toHaveText('01–02쪽');

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 60, start.y - 10, { steps: 6 });
    await expect(region).toHaveAttribute('data-phase', 'turning');
    await expect(folio(page)).toContainText('01–02/08');
    await page.mouse.move(start.x - 800, start.y - 20, { steps: 12 });
    await page.mouse.up();
    await expect(folio(page)).toContainText('03–04/08');
    await expect(region).toHaveAttribute('data-phase', 'open');
    await expect(status).toHaveText('03–04쪽');

    const back = await boxOf(region.getByRole('button', { name: '이전 쪽' }));
    const backStart = { x: back.x + back.width - 20, y: back.y + back.height * 0.8 };
    await drag(page, backStart, [{ x: backStart.x + 800, y: backStart.y - 20 }]);
    await expect(folio(page)).toContainText('01–02/08');
    await expect(status).toHaveText('01–02쪽');
  });

  test('crossfades instead of folding when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const region = await openWithEnter(page);
    await expect(region).toHaveAttribute('data-motion', 'reduced');
    await expect(page.locator('.closed-stage')).toHaveCount(0);
    const next = region.getByRole('button', { name: '다음 쪽' });
    await next.click();
    await expect(folio(page)).toContainText('03–04/08');
    await expect(region).toHaveAttribute('data-phase', 'open');

    // 끄는 동안에는 접지 않고 펼침면 전체를 투명도로 교차한다(임시, tech-research.md 7장 U7 (c)).
    const zone = await boxOf(next);
    const start = { x: zone.x + 20, y: zone.y + zone.height * 0.5 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 300, start.y, { steps: 6 });
    await expect(region).toHaveAttribute('data-phase', 'turning');
    await expect(region.locator('[data-role="flap"]')).toHaveCount(0);
    const current = region.locator('[data-role="upper"]');
    await expect(current).toHaveCount(2);
    // 들어올 때의 짧은 투명도 애니메이션이 끝난 뒤에도 인라인 투명도가 그대로 보여야 한다.
    await expect
      .poll(() =>
        current.first().evaluate(element => {
          const inline = (element as HTMLElement).style.opacity;
          return getComputedStyle(element).opacity === inline && Number(inline) < 1;
        })
      )
      .toBe(true);
    await page.mouse.move(start.x - 800, start.y, { steps: 6 });
    await page.mouse.up();
    await expect(folio(page)).toContainText('05–06/08');
    await expect(region).toHaveAttribute('data-phase', 'open');
  });

  test('shows one page at a time on a tall phone screen and turns it by swiping across the photo', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expectInsideViewport(page, [page.getByRole('button', { name: '책 펼치기' }), page.getByRole('banner')]);
    const region = await openWithEnter(page, '02쪽');
    await expect(region).toHaveAttribute('data-layout', 'single');
    await expect(folio(page)).toContainText('02/08');
    await expect(region.getByRole('img')).toHaveCount(1);
    const next = region.getByRole('button', { name: '다음 쪽' });
    const previous = region.getByRole('button', { name: '이전 쪽' });
    await expectInsideViewport(page, [page.locator('.book'), page.getByRole('banner'), previous, next]);
    await expectOneLineHeadAboveBook(page);

    await next.click();
    await expect(folio(page)).toContainText('03/08');
    await expect(region.getByRole('img')).toHaveCount(1);

    // 쪽 가운데에서 시작한 스와이프도 넘긴다(오른쪽 절반은 다음 쪽, 왼쪽 절반은 이전 쪽).
    const book = await boxOf(page.locator('.book'));
    const y = book.y + book.height * 0.5;
    await drag(page, { x: book.x + book.width * 0.6, y }, [{ x: book.x + book.width * 0.05, y }]);
    await expect(folio(page)).toContainText('04/08');
    await drag(page, { x: book.x + book.width * 0.4, y }, [{ x: book.x + book.width * 0.95, y }]);
    await expect(folio(page)).toContainText('03/08');
    await expect(page.getByRole('status')).toHaveText('03쪽');
    expect(errors).toEqual([]);
  });

  for (const size of [
    { width: 844, height: 390 },
    { width: 667, height: 375 },
  ]) {
    test(`keeps the running head on one line above the book at ${size.width}×${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/');
      await expectInsideViewport(page, [page.getByRole('button', { name: '책 펼치기' }), page.getByRole('banner')]);
      const region = await openWithEnter(page);
      await expect(region).toHaveAttribute('data-layout', 'spread');
      await expectOneLineHeadAboveBook(page);
      await expectInsideViewport(page, [
        page.locator('.book'),
        page.getByRole('banner'),
        region.getByRole('button', { name: '앞표지 덮기' }),
        region.getByRole('button', { name: '다음 쪽' }),
      ]);
    });
  }

  test('works with the keyboard from the page without putting focus on the book', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const book = page.getByRole('button', { name: '책 펼치기' });
    await expect(book).toBeVisible();
    // 첫 화면 그대로(포커스가 body) Enter로 펼친다. 책으로 포커스를 옮기지 않아 포커스 표시가 생기지 않는다.
    await page.keyboard.press('Enter');
    const region = page.getByRole('region', { name: '펼친 책' });
    await expect(page.getByRole('status')).toHaveText('01–02쪽');
    await expect(region).not.toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('status')).toHaveText('03–04쪽');
    await page.keyboard.press('ArrowLeft');
    await expect(folio(page)).toContainText('01–02/08');
    await page.keyboard.press('Escape');
    await expect(closedStage(page)).toHaveAttribute('data-phase', 'closed');
    await expect(page.getByRole('status')).toHaveText('책을 덮었다, 앞표지');
    await expect(book).not.toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    expect(errors).toEqual([]);
  });

  test.describe('closed book rotation', () => {
    test('turns the book by dragging empty space, any way, and opens only on a tap on the book', async ({ page }) => {
      const errors = collectPageErrors(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      const front = await renderedBookSize(page);

      // 책 밖 빈 곳에서 오른쪽으로 90°만큼 끌면 책이 옆으로 돌아 책등이 정면에 온다(끄는 동안 바로 따라온다).
      await page.mouse.move(150, 650);
      await page.mouse.down();
      await page.mouse.move(375, 650, { steps: 10 });
      await expect.poll(async () => (await renderedBookSize(page)).width).toBeLessThan(front.width * 0.6);
      const sideways = await bookTransform(page);
      // 이어서 위로 크게 끌면 위아래 제한 없이 넘어간다.
      await page.mouse.move(375, 200, { steps: 10 });
      await expect.poll(() => bookTransform(page)).not.toBe(sideways);
      await page.mouse.up();
      await expect(closedStage(page)).toHaveAttribute('data-motion', 'rest');

      // 빈 곳 탭은 아무 일도 하지 않는다.
      await page.mouse.click(150, 700);
      await expect(closedStage(page)).toHaveAttribute('data-phase', 'closed');
      await expect(page.getByRole('region', { name: '펼친 책' })).toHaveCount(0);

      // 책 위 탭은 (어느 자세든) 앞면으로 돌아온 뒤 펼친다.
      const book = await boxOf(page.getByRole('button', { name: '책 펼치기' }));
      await page.mouse.click(book.x + book.width / 2, book.y + book.height / 2);
      await expect(page.getByRole('region', { name: '펼친 책' })).toBeVisible();
      await expect(page.getByRole('status')).toHaveText('01–02쪽');
      expect(errors).toEqual([]);
    });

    test('turns the book from the very screen edge with a mouse', async ({ page }) => {
      // 마우스에는 가장자리 시스템 제스처가 없어 화면 끝까지 회전 영역이다. 터치만 가장자리를 비켜 간다(아래 touch-action 테스트).
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      const front = await renderedBookSize(page);
      await page.mouse.move(2, 650);
      await page.mouse.down();
      await page.mouse.move(227, 650, { steps: 10 });
      await expect.poll(async () => (await renderedBookSize(page)).width).toBeLessThan(front.width * 0.6);
      await page.mouse.up();
    });

    test('turns the book slowly while an arrow key is held anywhere and coasts to a stop after release', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      const front = await renderedBookSize(page);
      const height = async () => (await renderedBookSize(page)).height;
      // 책에 포커스를 두지 않아도(첫 화면 그대로) 받는다.
      await expect(page.getByRole('button', { name: '책 펼치기' })).not.toBeFocused();
      // 위 화살표를 누르고 있으면 책이 위로 천천히 넘어가 높이만 크게 준다(책밑이 정면). 누르는 동안은 서지 않는다.
      // 계속 돌아 다시 커지기 전에 잡도록 자주 잰다. 어느 쪽으로 도는지는 단위 테스트(rotation.test.ts)가 본다.
      await page.keyboard.down('ArrowUp');
      await expect(closedStage(page)).toHaveAttribute('data-motion', 'key');
      await expect.poll(height, { intervals: [50] }).toBeLessThan(front.height / 2);
      expect((await renderedBookSize(page)).width).toBeGreaterThan(front.width * 0.8);
      await expect(closedStage(page)).toHaveAttribute('data-motion', 'key');
      // 떼면 관성으로 조금 더 돌다 선다. 선 뒤로는 프레임이 지나도 자세가 그대로다.
      await page.keyboard.up('ArrowUp');
      await expect(closedStage(page)).toHaveAttribute('data-motion', 'rest', { timeout: 5000 });
      const rested = await bookTransform(page);
      await nextFrames(page);
      expect(await bookTransform(page)).toBe(rested);
    });

    test('keeps spinning for a moment after a flick and then stops', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      // 관성 속도는 놓기 직전 100ms(속도 창)의 움직임으로 잰다. 느린 CI에서 마지막 move와 up 사이가 창보다 벌어져
      // 관성 없이 섰다면 다시 던진다(던질 때마다 data-motion이 바로 spin이 되는지만 본다).
      await expect(async () => {
        await page.mouse.move(150, 650);
        await page.mouse.down();
        await page.mouse.move(450, 640, { steps: 4 });
        await page.mouse.up();
        await expect(closedStage(page)).toHaveAttribute('data-motion', 'spin', { timeout: 250 });
      }).toPass({ intervals: [0], timeout: 15_000 });
      const released = await bookTransform(page);
      // 손을 뗀 뒤에도 자세가 바뀐다(관성).
      await expect.poll(() => bookTransform(page)).not.toBe(released);
      await expect(closedStage(page)).toHaveAttribute('data-motion', 'spin');
      // 그러다 선다. 선 뒤로는 프레임이 지나도 자세가 그대로다.
      await expect(closedStage(page)).toHaveAttribute('data-motion', 'rest', { timeout: 5000 });
      const rested = await bookTransform(page);
      await nextFrames(page);
      expect(await bookTransform(page)).toBe(rested);
    });
  });

  test.describe('closed book hit area', () => {
    test('opens only on a tap inside the rendered book, not in an empty corner of a tilted book', async ({ page }) => {
      // 동작 줄이기면 놓은 자리에 선다(관성 없이 자세가 정해진다).
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      // 빈 곳을 대각선으로 끌어 책을 비스듬히 기울인다.
      await drag(page, { x: 150, y: 650 }, [{ x: 260, y: 560 }]);
      await expect(closedStage(page)).toHaveAttribute('data-motion', 'rest');
      const hull = convexHull(await renderedBookCorners(page));
      const box = await boxOf(page.getByRole('button', { name: '책 펼치기' }));
      const inset = 4;
      const corners = [
        { x: box.x + inset, y: box.y + inset },
        { x: box.x + box.width - inset, y: box.y + inset },
        { x: box.x + inset, y: box.y + box.height - inset },
        { x: box.x + box.width - inset, y: box.y + box.height - inset },
      ];
      const emptyCorner = corners.reduce((best, corner) =>
        distanceOutside(corner, hull) > distanceOutside(best, hull) ? corner : best
      );
      // 책 버튼(투영을 감싼 사각형) 안이지만 그려진 책에서 12px 넘게 떨어진 빈 모서리다.
      expect(distanceOutside(emptyCorner, hull)).toBeGreaterThan(12);
      await page.mouse.click(emptyCorner.x, emptyCorner.y);
      await nextFrames(page);
      await expect(closedStage(page)).toHaveAttribute('data-phase', 'closed');
      await expect(page.getByRole('region', { name: '펼친 책' })).toHaveCount(0);

      const middle = {
        x: hull.reduce((sum, point) => sum + point.x, 0) / hull.length,
        y: hull.reduce((sum, point) => sum + point.y, 0) / hull.length,
      };
      expect(distanceOutside(middle, hull)).toBeLessThan(-12);
      await page.mouse.click(middle.x, middle.y);
      await expect(page.getByRole('region', { name: '펼친 책' })).toBeVisible();
    });

    test('blocks browser touch gestures only on the closed rotation area and on the book', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      await expect(closedStage(page)).toHaveAttribute('data-phase', 'closed');
      // 닫힌 책: 책과 빈 곳은 터치 회전 영역, 좌우 가장자리 24px와 위아래 safe area(데스크톱은 0)는 브라우저·시스템 몫.
      expect(await effectiveTouchActionAt(page, { x: 640, y: 400 })).toBe('none');
      expect(await effectiveTouchActionAt(page, { x: 150, y: 650 })).toBe('none');
      expect(await effectiveTouchActionAt(page, { x: 8, y: 400 })).toBe('auto');
      expect(await effectiveTouchActionAt(page, { x: 1272, y: 400 })).toBe('auto');

      // 펼친 책: 책 위만 막고 책 바깥 여백은 핀치 확대가 된다.
      await openWithEnter(page);
      await expect(page.locator('.closed-surface')).toHaveCount(0);
      const book = await boxOf(page.locator('.book'));
      expect(await effectiveTouchActionAt(page, { x: book.x + book.width / 2, y: book.y + book.height / 2 })).toBe(
        'none'
      );
      expect(await effectiveTouchActionAt(page, { x: book.x + book.width / 2, y: book.y + book.height + 16 })).toBe(
        'auto'
      );
    });
  });

  test.describe('closing the book', () => {
    test('closes to the front cover with Esc and the running head name', async ({ page }) => {
      const errors = collectPageErrors(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      const region = await openWithEnter(page);
      await region.getByRole('button', { name: '다음 쪽' }).click();
      await expect(folio(page)).toContainText('03–04/08');
      await page.keyboard.press('Escape');
      await expectClosedOn(page, '앞표지');

      const reopened = await openWithEnter(page);
      const name = page.getByRole('banner').getByRole('button', { name: /^심완/ });
      // 이름 버튼은 글자 폭만 차지한다. 이름 오른쪽 빈 머리 공간을 눌러도 덮이지 않는다.
      const nameBox = await boxOf(name);
      const text = await name
        .locator('span')
        .first()
        .evaluate(span => {
          const range = document.createRange();
          range.selectNodeContents(span);
          const rect = range.getBoundingClientRect();
          return { right: rect.right, width: rect.width };
        });
      expect(nameBox.width).toBeLessThanOrEqual(text.width + 1);
      await page.mouse.click(text.right + 40, nameBox.y + nameBox.height / 2);
      await nextFrames(page);
      await expect(reopened).toHaveAttribute('data-phase', 'open');
      // 키보드로 이름 버튼에 와서 누르면 사라질 이름 버튼 대신 닫힌 책으로 포커스가 간다. 마우스 클릭은 브라우저마다
      // 버튼에 포커스를 주는지가 달라(WebKit은 주지 않는다) 포커스가 body면 옮기지 않는다(tech-research.md 7장 공통 규칙).
      await name.focus();
      await page.keyboard.press('Enter');
      await expectClosedOn(page, '앞표지');
      // 닫힌 책에서 이름은 버튼이 아니다.
      await expect(page.getByRole('banner').getByRole('button')).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test('closes the front cover with the previous button on the first spread', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      const region = await openWithEnter(page);
      await region.getByRole('button', { name: '앞표지 덮기' }).click();
      await expectClosedOn(page, '앞표지');
    });

    test('closes the back cover from the last spread and rests showing the back', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      const region = await openWithEnter(page);
      for (const pages of ['03–04/08', '05–06/08', '07–08/08']) {
        await page.keyboard.press('ArrowRight');
        await expect(folio(page)).toContainText(pages);
      }
      await region.getByRole('button', { name: '뒤표지 덮기' }).focus();
      await page.keyboard.press('Enter');
      await expectClosedOn(page, '뒤표지');

      // 뒷면을 보던 책도 펼치면 앞면으로 돌아와 연다.
      await openWithEnter(page);
    });

    test('closes the cover by dragging it over the spine on the first spread', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      const region = await openWithEnter(page);
      const zone = await boxOf(region.getByRole('button', { name: '앞표지 덮기' }));
      const start = { x: zone.x + zone.width - 20, y: zone.y + zone.height * 0.6 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 200, start.y, { steps: 8 });
      // 끄는 동안 표지는 딱딱한 판으로 책등을 축으로 돈다(3D 책). 쪽 번호는 그대로다.
      await expect(closedStage(page)).toHaveAttribute('data-phase', 'closing');
      await expect(folio(page)).toContainText('01–02/08');
      await page.mouse.move(start.x + 900, start.y, { steps: 8 });
      await page.mouse.up();
      await expectClosedOn(page, '앞표지');
    });

    test('closes the back cover going forward from the last page on a tall phone screen', async ({ page }) => {
      const errors = collectPageErrors(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      const region = await openWithEnter(page, '02쪽');
      const next = region.getByRole('button', { name: '다음 쪽' });
      for (let pageNumber = 3; pageNumber <= 8; pageNumber += 1) {
        await next.click();
        await expect(folio(page)).toContainText(`0${pageNumber}/08`);
      }
      await region.getByRole('button', { name: '뒤표지 덮기' }).click();
      await expectClosedOn(page, '뒤표지');
      await expectInsideViewport(page, [page.getByRole('button', { name: '책 펼치기' }), page.getByRole('banner')]);
      expect(errors).toEqual([]);
    });

    test('keeps the cover board drawn over the page under it while Esc closes the book', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.clock.install();
      await page.goto('/');
      const region = await openWithEnter(page);
      await region.getByRole('button', { name: '다음 쪽' }).click();
      await expect(folio(page)).toContainText('03–04/08');
      // 시계를 멈추고 덮기를 프레임 단위로 진행해, 표지 판이 거의 닫혀 아래 쪽과 붙는 순간에서 멈춘다.
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
      await page.keyboard.press('Escape');
      await expect(closedStage(page)).toHaveAttribute('data-phase', 'closing');
      let angle = await frontCoverAngle(page);
      for (let step = 0; step < 200 && !(angle > -25 && angle < -3); step += 1) {
        await page.clock.runFor(8);
        angle = await frontCoverAngle(page);
      }
      expect(angle).toBeGreaterThan(-25);
      expect(angle).toBeLessThan(-3);
      const { differing, total } = await differingPixelsUnderCover(page);
      expect(differing).toBeLessThanOrEqual(total * 0.001);
      await page.clock.resume();
      await expectClosedOn(page, '앞표지');
    });

    test('keeps the cover board drawn over the page under it while it is held nearly closed', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      const region = await openWithEnter(page);
      const zone = await boxOf(region.getByRole('button', { name: '앞표지 덮기' }));
      const book = await boxOf(page.locator('.book'));
      const start = { x: zone.x + zone.width - 20, y: zone.y + zone.height * 0.6 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      // 책등 너머 쪽 폭의 85%까지 끌어 판을 거의 덮은 채 들고 있는다.
      await page.mouse.move(book.x + book.width / 2 + (book.width / 2) * 0.85, start.y, { steps: 12 });
      await expect(closedStage(page)).toHaveAttribute('data-phase', 'closing');
      await expect.poll(() => frontCoverAngle(page)).toBeGreaterThan(-40);
      expect(await frontCoverAngle(page)).toBeLessThan(-3);
      const { differing, total } = await differingPixelsUnderCover(page);
      expect(differing).toBeLessThanOrEqual(total * 0.001);
      await page.mouse.up();
      await expectClosedOn(page, '앞표지');
    });

    test('crossfades instead of moving the cover when reduced motion is requested', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await openWithEnter(page);
      await page.keyboard.press('Escape');
      await expectClosedOn(page, '앞표지');
    });
  });
});
