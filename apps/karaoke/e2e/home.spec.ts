import { expect, test } from '@playwright/test';

test.describe('Karaoke Home', () => {
  test('should migrate versioned localStorage keys on startup', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('karaoke:privacy-consent');
      localStorage.removeItem('karaoke:first-guide');
      localStorage.removeItem('karaoke:active-playlist');
      localStorage.setItem('karaoke:privacy-consent-v1', 'true');
      localStorage.setItem('karaoke:first-guide-v1', 'true');
      localStorage.setItem('karaoke:active-playlist-v1', '"fujii-kaze"');
    });
    await page.reload();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('まつり');
    await expect
      .poll(() =>
        page.evaluate(() => ({
          activePlaylist: localStorage.getItem('karaoke:active-playlist'),
          legacyActivePlaylist: localStorage.getItem('karaoke:active-playlist-v1'),
          legacyConsent: localStorage.getItem('karaoke:privacy-consent-v1'),
          legacyGuide: localStorage.getItem('karaoke:first-guide-v1'),
        }))
      )
      .toEqual({
        activePlaylist: '"fujii-kaze"',
        legacyActivePlaylist: null,
        legacyConsent: null,
        legacyGuide: null,
      });
  });

  test('should display the current song and display toggles', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('怪獣の花唄');
    await expect(page.getByText('가사를 불러오세요')).toBeVisible();
    await expect(page.getByRole('button', { name: '이 곡의 JSON 불러오기' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'JP, 日本語' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PRON, 발음' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'KO, 번역' })).toBeVisible();
    const footer = page.getByRole('contentinfo');
    const infoButton = footer.getByRole('button', { name: '앱 정보' });
    const themeButton = footer.getByRole('button', { name: /화면 (밝게|어둡게)/ });
    await expect(infoButton).toHaveText('');
    await expect(themeButton).toHaveText('');
    await expect(page.getByRole('banner').getByRole('button', { name: /화면 (밝게|어둡게)/ })).toHaveCount(0);

    const header = page.getByRole('banner');
    const title = header.getByRole('button', { name: /곡 목록 열기/ });
    const [headerBox, titleBox] = await Promise.all([header.boundingBox(), title.boundingBox()]);
    expect(Math.abs(titleBox!.x + titleBox!.width / 2 - (headerBox!.x + headerBox!.width / 2))).toBeLessThanOrEqual(1);

    await expect(page.getByRole('button', { name: '가사 편집 열기' }).locator('svg')).toHaveClass(
      /lucide-file-pen-line/
    );

    // 제목 버튼을 감싼 h1이 블록 컨텍스트면 inline-flex 버튼 아래로 line box 공백이 붙어
    // 제목이 좌우 화살표보다 내려앉는다. 세 요소의 수직 중심이 같아야 한다.
    const prevBox = await header.getByRole('button', { name: '이전 곡' }).boundingBox();
    const centerOf = (box: { y: number; height: number }) => box.y + box.height / 2;
    expect(Math.abs(centerOf(titleBox!) - centerOf(prevBox!))).toBeLessThanOrEqual(0.5);
  });

  test('should show the lyrics-include switch changing state', async ({ page }) => {
    await page.route(/(youtube\.com|ytimg\.com|youtube-nocookie\.com)/, route => route.abort());
    await page.goto('/');

    await page.getByRole('button', { name: 'QR로 보내고 받기' }).click();
    await page
      .getByRole('dialog', { name: '기기 간 공유' })
      .getByRole('button', { name: /보내기/ })
      .click();
    const settings = page.getByRole('dialog', { name: '보낼 데이터' });
    const toggle = settings.getByRole('switch', { name: '저장된 가사도 포함' });
    await expect(toggle).toBeVisible();

    // 상태 변형을 data-checked로 쓰면 Radix의 data-state와 맞지 않아 트랙 색과 썸 이동이
    // 둘 다 죽는다. 눌러도 아무 변화가 없으므로 실제 픽셀로 확인한다.
    const readState = () =>
      toggle.evaluate(node => {
        const thumb = node.querySelector('[data-slot="switch-thumb"]')!;
        return {
          track: getComputedStyle(node).backgroundColor,
          thumbOffset: Math.round(thumb.getBoundingClientRect().x - node.getBoundingClientRect().x),
        };
      });

    const off = await readState();
    await toggle.click();
    await expect(toggle).toBeChecked();

    // transition-transform이 끝나야 최종 위치가 잡힌다. 임의 대기 대신 값 변화를 기다린다.
    await expect
      .poll(async () => Math.abs((await readState()).thumbOffset - off.thumbOffset))
      .toBeGreaterThanOrEqual(8);

    expect((await readState()).track).not.toBe(off.track);

    // 터치 타깃은 ::after 확장을 포함해 44px 이상이어야 한다 (PRODUCT.md 제약).
    const hit = await toggle.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const after = getComputedStyle(node, '::after');
      const px = (value: string) => Number.parseFloat(value) || 0;
      return {
        height: rect.height - px(after.top) - px(after.bottom),
        width: rect.width - px(after.left) - px(after.right),
      };
    });
    expect(hit.height).toBeGreaterThanOrEqual(44);
    expect(hit.width).toBeGreaterThanOrEqual(44);
  });

  test('should create a private device-transfer QR from the footer', async ({ page }) => {
    await page.route(/(youtube\.com|ytimg\.com|youtube-nocookie\.com)/, route => route.abort());
    await page.goto('/');

    await page.getByRole('button', { name: 'QR로 보내고 받기' }).click();
    const startDrawer = page.getByRole('dialog', { name: '기기 간 공유' });
    await expect(startDrawer.getByRole('button', { name: /보내기/ })).toBeVisible();
    await expect(startDrawer.getByText(/운영자 서버로 보내지 않습니다/)).toBeVisible();

    await startDrawer.getByRole('button', { name: /보내기/ }).click();
    const settingsDrawer = page.getByRole('dialog', { name: '보낼 데이터' });
    const selectedPlaylist = settingsDrawer.getByRole('radio', { name: /현재 재생목록/ });
    await expect(selectedPlaylist).toBeChecked();
    await expect(selectedPlaylist).toHaveCSS('background-color', 'rgb(38, 60, 255)');
    await settingsDrawer.getByRole('button', { name: 'QR 만들기' }).click();

    const qrDrawer = page.getByRole('dialog', { name: 'QR 보내기' });
    const qr = qrDrawer.getByRole('img', { name: '노래 데이터 공유 QR' });
    await expect(qr).toBeVisible();
    await expect(qrDrawer.getByText(/반복 표시/)).toBeVisible();
    const qrBox = await qr.boundingBox();
    expect(qrBox!.width).toBeLessThanOrEqual(320);
    expect(qrBox!.width).toBe(qrBox!.height);
  });

  test('should show the first-use guide once and allow replay from About', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('guide-test-reset')) return;
      localStorage.removeItem('karaoke:first-guide');
      sessionStorage.setItem('guide-test-reset', 'true');
    });
    await page.goto('/');

    const guide = page.getByRole('dialog', { name: '가사를 직접 만들 수 있어요' });
    await expect(guide).toBeVisible();
    await guide.getByRole('button', { name: '다음' }).click();
    await expect(page.getByRole('dialog', { name: '파일이 이미 있다면' })).toBeVisible();
    await page.getByRole('button', { name: '알겠어요' }).click();
    await expect(page.locator('.driver-popover')).toBeHidden();

    await page.getByRole('button', { name: '다음 곡' }).click();
    await expect(page.locator('.driver-popover')).toBeHidden();

    await page.reload();
    await expect(page.locator('.driver-popover')).toBeHidden();

    await page.getByRole('button', { name: '앱 정보' }).click();
    await page.getByRole('button', { name: '처음 사용 가이드 다시 보기' }).click();
    await expect(page.getByRole('dialog', { name: '가사를 직접 만들 수 있어요' })).toBeVisible();
    await page.getByRole('button', { name: '가이드 닫기' }).click();
    await page.getByRole('button', { name: '다음 곡' }).click();
    await expect(page.locator('.driver-popover')).toBeHidden();
  });

  test('should switch playlists and songs from the drawer', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /곡 목록 열기/ }).click();
    await expect(page.getByText('Vaundy')).toBeVisible();
    await page.getByRole('button', { name: '재생목록 보기' }).click();
    await page.getByRole('button', { name: 'Fujii Kaze 재생목록 열기' }).click();
    await page.getByRole('button', { name: 'きらり (키라리)' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('きらり');
  });

  test('should persist a dragged song order and use it for navigation', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('https://cross-origin.test/frame', route => route.abort());
    await page.goto('/');
    await page.evaluate(() => {
      const frame = document.createElement('iframe');
      frame.hidden = true;
      frame.src = 'https://cross-origin.test/frame';
      Object.defineProperty(frame, 'contentDocument', {
        get() {
          document.body.dataset.crossOriginFrameRead = 'true';
          return null;
        },
      });
      document.body.append(frame);
    });
    await page.getByRole('button', { name: /곡 목록 열기/ }).click();

    const list = page.getByRole('list', { name: 'Vaundy 곡 순서' });
    const source = page.getByRole('button', { name: '怪獣の花唄 순서 이동' });
    const target = page.getByRole('button', { name: '踊り子 순서 이동' });
    await source.hover();
    const targetBox = await target.boundingBox();
    expect(targetBox).not.toBeNull();

    await page.mouse.down();
    await expect(source).toHaveAttribute('aria-grabbed', 'true');
    await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 10 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(undefined))));
    await page.mouse.up();

    await expect(list.getByRole('listitem').nth(0)).toContainText('踊り子');
    await expect(list.getByRole('listitem').nth(1)).toContainText('怪獣の花唄');
    await expect(page.locator('body')).not.toHaveAttribute('data-cross-origin-frame-read', 'true');
    expect(pageErrors.join('\n')).not.toContain('Blocked a frame');

    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByText('02 / 09')).toBeVisible();

    await page.getByRole('button', { name: '다음 곡' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('東京フラッシュ');
  });

  test('should create a playlist, add and edit a song, then reset playlists', async ({ page }) => {
    await page.route(/(youtube\.com|ytimg\.com|youtube-nocookie\.com)/, route => route.abort());
    await page.goto('/');
    await page.getByRole('button', { name: /곡 목록 열기/ }).click();
    await page.getByRole('button', { name: '재생목록 보기' }).click();
    await page.getByRole('button', { name: '재생목록 추가' }).click();

    await page.getByLabel('재생목록 이름').fill('Fujii Kaze');
    await page.getByRole('button', { name: '재생목록 만들기' }).click();
    await expect(page.getByText('아직 곡이 없습니다')).toBeVisible();

    await page.getByRole('button', { name: 'Fujii Kaze에 곡 추가' }).click();
    await page.getByLabel('YouTube 영상 주소').fill('https://youtu.be/dQw4w9WgXcQ');
    await page.getByLabel('원어 제목').fill('きらり');
    await page.getByLabel('한국어 표기').fill('키라리');
    await page.getByRole('button', { name: '추가하고 열기' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('きらり');
    await page.getByRole('button', { name: /곡 목록 열기/ }).click();
    await page.getByRole('button', { name: 'きらり 곡 정보 수정' }).click();
    await page.getByLabel('원어 제목').fill('満ちてゆく');
    await page.getByLabel('한국어 표기').fill('미치테유쿠');
    await page.getByRole('button', { name: '곡 정보 저장' }).click();
    await page.getByRole('button', { name: '満ちてゆく (미치테유쿠)' }).click();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('満ちてゆく');

    await page.getByRole('button', { name: '앱 정보' }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '재생목록 초기화…' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('怪獣の花唄');
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
    await page.getByRole('button', { name: 'napori (나포리)' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('napori');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('napori');
  });

  test('should settle the theme before React mounts', async ({ page }) => {
    // 마운트 후에 테마를 붙이면 첫 페인트가 밝게 나갔다가 어두워지며 깜빡인다.
    await page.route(/\/assets\/index-.*\.js$/, route => route.abort());
    await page.goto('/');

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
    await page.getByRole('button', { name: /화면 (밝게|어둡게)/ }).click();
    const chosen = await page.evaluate(() => document.documentElement.className);

    await page.reload({ waitUntil: 'commit' });
    expect(await page.evaluate(() => document.documentElement.className)).toBe(chosen);
  });

  test('should reach the about sheet from the footer', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: '앱 정보' }).click();

    await expect(page.getByRole('heading', { name: '무엇을 위한 앱인가' })).toBeVisible();
    await expect(page.getByText(/저장 원리 · 가사는 브라우저가 제공하는 기기 내 저장 공간/)).toBeVisible();
    await expect(page.getByRole('heading', { name: '저작권과 이용 책임' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'YouTube 이용약관' })).toBeVisible();
    // 문의가 필요할 때 연락처를 눌러 바로 메일을 열 수 있어야 한다.
    await expect(page.getByRole('link', { name: /wannysim@gmail\.com/ })).toHaveAttribute(
      'href',
      /^mailto:wannysim@gmail\.com/
    );
  });

  test('should never request a shipped lyric file', async ({ page }) => {
    const lyricRequests: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/lyrics/')) lyricRequests.push(request.url());
    });

    await page.goto('/');
    await expect(page.getByRole('button', { name: '이 곡의 JSON 불러오기' })).toBeVisible();
    expect(lyricRequests).toEqual([]);
  });

  test('should refresh another open tab after a local import', async ({ page, context }) => {
    const otherPage = await context.newPage();
    await Promise.all([page.goto('/'), otherPage.goto('/')]);

    const lyrics = [{ time: 1, jp: '練習の歌', pron: '렌슈노 우타', ko: '연습 노래' }];
    await page.locator('input[type="file"]').setInputFiles({
      name: 'ai-result.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(lyrics)),
    });

    await expect(page.getByRole('button', { name: /練習の歌/ })).toBeVisible();
    await expect(otherPage.getByRole('button', { name: /練習の歌/ })).toBeVisible();
    await otherPage.close();
  });

  test('should edit and resave lyrics imported from JSON', async ({ page }) => {
    await page.route(/(youtube\.com|ytimg\.com|youtube-nocookie\.com)/, route => route.abort());
    await page.goto('/');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'kaiju-no-hanauta.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([{ time: 1.2, jp: '練習の歌', pron: '렌슈노 우타', ko: '연습 노래' }])),
    });

    await page.getByRole('button', { name: '가사 편집 열기' }).click();
    await expect(page.getByLabel('일본어', { exact: true })).toHaveValue('練習の歌');
    await expect(page.getByLabel('한글 발음')).toHaveValue('렌슈노 우타');
    await expect(page.getByLabel('한국어 번역')).toHaveValue('연습 노래');
    await expect(page.getByLabel('시작 시간 (초)')).toHaveValue('1.2');

    await page.getByLabel('한글 발음').fill('렌슈우노 우타');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '이 기기에 저장' }).click();
    await expect(page.getByRole('button', { name: '저장됨' })).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: '가사 편집 열기' }).click();
    await expect(page.getByLabel('한글 발음')).toHaveValue('렌슈우노 우타');
  });

  test('should explain and recover from a corrupt local lyric record', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('가사를 불러오세요')).toBeVisible();

    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('karaoke-local-library', 1);
          open.addEventListener('error', () => reject(open.error), { once: true });
          open.addEventListener(
            'success',
            () => {
              const database = open.result;
              const transaction = database.transaction('lyrics', 'readwrite');
              transaction.objectStore('lyrics').put({
                schemaVersion: 999,
                slug: 'kaiju-no-hanauta',
                lyrics: [],
                updatedAt: new Date().toISOString(),
              });
              transaction.addEventListener(
                'complete',
                () => {
                  database.close();
                  resolve();
                },
                { once: true }
              );
              transaction.addEventListener('error', () => reject(transaction.error), { once: true });
            },
            { once: true }
          );
        })
    );

    await page.reload();
    await expect(page.getByText(/가사 형식의 버전을 읽을 수 없습니다/)).toBeVisible();
    await expect(page.getByRole('button', { name: '이 곡의 JSON 불러오기' })).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.locator('input[type="file"]').setInputFiles({
      name: 'kaiju-no-hanauta.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([{ time: 1, jp: '練習曲', pron: '렌슈쿄쿠', ko: '연습곡' }])),
    });
    await expect(page.getByRole('button', { name: /練習曲/ })).toBeVisible();
  });

  test('should keep font shards out of the install precache', async ({ page }) => {
    const response = await page.request.get('/sw.js');
    const serviceWorker = await response.text();

    expect(serviceWorker).toContain('v3-local-first');
    expect(serviceWorker).toMatch(/\/assets\/index-[^"]+\.js/);
    expect(serviceWorker).not.toContain("BUILD_ID = 'dev'");
    expect(serviceWorker).not.toContain('.woff2');
    expect(serviceWorker).not.toContain('/lyrics/');
  });

  test('should replace old karaoke caches without touching another app cache', async ({ page }) => {
    await page.goto('/sw.js');
    await page.evaluate(async () => {
      await caches.open('karaoke-lyrics-v1');
      await caches.open('karaoke-shell-v2-local-only');
      await caches.open('another-app-cache');
    });

    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);

    await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(expect.arrayContaining(['another-app-cache']));
    await expect
      .poll(() => page.evaluate(() => caches.keys()))
      .not.toEqual(expect.arrayContaining(['karaoke-lyrics-v1', 'karaoke-shell-v2-local-only']));
  });

  test('should cache only the font shards used on the visited screen', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await navigator.serviceWorker.ready;
    });

    const cachedFontCount = () =>
      page.evaluate(async () => {
        const cacheName = (await caches.keys()).find(name => name.startsWith('karaoke-assets-v3-local-first-'));
        if (!cacheName) return 0;
        const requests = await (await caches.open(cacheName)).keys();
        return requests.filter(request => new URL(request.url).pathname.endsWith('.woff2')).length;
      });

    await expect.poll(cachedFontCount).toBeGreaterThan(0);
    expect(await cachedFontCount()).toBeLessThan(20);
  });

  test('should reload the app shell offline after the first visit', async ({ page, context, browserName }) => {
    // https://playwright.dev/docs/api/class-browsercontext#browser-context-service-workers
    test.skip(browserName !== 'chromium', 'Playwright supports service workers only in Chromium.');

    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toContainText('怪獣の花唄');
      await expect(page.getByText('가사를 불러오세요')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test('should never scroll the document itself', async ({ page }) => {
    await page.goto('/');

    // 문서가 스크롤되면 가사 자동 스크롤이 헤더와 플레이어를 화면 밖으로 밀어낸다.
    const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('should leave the YouTube player unobstructed and interactive', async ({ page }) => {
    await page.goto('/');

    // YouTube Required Minimum Functionality: 플레이어 앞에 시각 요소를 두면 안 되고
    // 뷰포트는 200x200 이상이어야 한다. 오버레이를 다시 얹으면 이 테스트가 잡는다.
    const frame = page.locator('iframe');
    await expect(frame).toHaveCSS('pointer-events', 'auto');

    const box = (await frame.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(200);
    expect(box.height).toBeGreaterThanOrEqual(200);

    const covered = await page.evaluate(() => {
      const rect = document.querySelector('iframe')!.getBoundingClientRect();
      const at = (x: number, y: number) => document.elementFromPoint(x, y)?.tagName ?? '';
      return [
        at(rect.left + rect.width / 2, rect.top + rect.height / 2),
        at(rect.left + 8, rect.top + 8),
        at(rect.right - 8, rect.bottom - 8),
      ];
    });
    expect(covered).toEqual(['IFRAME', 'IFRAME', 'IFRAME']);
  });

  test('should show elapsed and total time with a seek slider', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('slider', { name: '재생 위치' })).toBeVisible();
    await expect(page.getByRole('button', { name: '재생', exact: true })).toBeVisible();
    // 길이를 모르는 동안에도 자리를 잡아 두어 레이아웃이 흔들리지 않는다.
    await expect(page.locator('.karaoke-controls').getByText('0:00', { exact: true })).toBeVisible();
  });

  test('should toggle a lyric row off', async ({ page }) => {
    await page.goto('/');

    const koToggle = page.getByRole('button', { name: 'KO, 번역' });
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

  test('should center the sync editor on a wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: '가사 편집 열기' }).click();

    const editor = page.locator('[data-slot="drawer-content"]');
    await expect(editor).toBeVisible();
    const bounds = await editor.boundingBox();

    expect(bounds).not.toBeNull();
    expect(bounds?.width).toBe(512);
    expect(bounds?.x).toBe((1440 - 512) / 2);
  });

  test('should copy the AI prompt when direct clipboard access is denied', async ({ page }) => {
    await page.addInitScript(() => {
      const select = HTMLTextAreaElement.prototype.select;
      HTMLTextAreaElement.prototype.select = function () {
        sessionStorage.setItem('copied-text', this.value);
        select.call(this);
      };
    });
    await page.goto('/');
    await page.getByRole('button', { name: '가사 편집 열기' }).click();
    await page.getByLabel('일본어 원문').fill('一行目\n二行目');

    await page.getByRole('button', { name: '외부 AI 요청문 복사 (선택)' }).click();

    const aiResult = page.getByRole('textbox', { name: 'JSON · LRC 데이터', exact: true });
    await expect(aiResult).toBeVisible();
    await expect(page.getByRole('status')).toContainText('사용 중인 AI에 붙여 넣고');
    expect(await page.evaluate(() => sessionStorage.getItem('copied-text'))).toContain(
      '변환할 일본어 가사:\n一行目\n二行目'
    );

    await aiResult.fill(
      JSON.stringify([
        { time: 12.3, jp: '一行目', pron: '이치교메', ko: '첫 줄' },
        { time: null, jp: '二行目', pron: '니교메', ko: '둘째 줄' },
      ])
    );
    await page.getByRole('button', { name: '데이터 적용' }).click();
    await expect(page.getByText('현재 가사 · 2줄')).toBeVisible();
    await expect(page.getByText('1줄의 시간이 비어 있습니다.')).toBeVisible();
    await expect(page.getByRole('region', { name: '재생 위치 맞추기' }).getByText('二行目')).toBeVisible();
  });

  test('should be usable on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /곡 목록 열기/ })).toBeVisible();

    // 모바일 터치 타깃은 44px 이상을 유지한다.
    for (const name of ['이전 곡', '다음 곡', '앱 정보', '가사 편집 열기']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });
});
