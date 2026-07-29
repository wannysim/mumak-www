import { expect, test } from '@playwright/test';

test.describe('Karaoke Home', () => {
  test('should display the current song and display toggles', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('怪獣の花唄');
    await expect(page.getByText('歌詞をひらく。')).toBeVisible();
    await expect(page.getByRole('button', { name: '가사 파일 불러오기' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'JP, 日本語' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PRON, 발음' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'KO, 번역' })).toBeVisible();
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

  test('should reach the about sheet from the song list', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /곡 목록 열기/ }).click();
    await page.getByRole('button', { name: /이 앱에 대해/ }).click();

    await expect(page.getByRole('heading', { name: '왜 만들었나' })).toBeVisible();
    await expect(page.getByText(/별도 서버에 업로드하지 않고 이 브라우저의 IndexedDB에 저장/)).toBeVisible();
    // 문의가 필요할 때 연락처를 눌러 바로 메일을 열 수 있어야 한다.
    await expect(page.getByRole('link', { name: /wannysim@gmail\.com/ })).toHaveAttribute(
      'href',
      /^mailto:wannysim@gmail\.com/
    );
    // 목록 위에 겹쳐 뜨면 안 된다. 목록은 닫히고 About만 남아야 한다.
    await expect(page.getByText('곡 선택')).toBeHidden();
  });

  test('should never request a shipped lyric file', async ({ page }) => {
    const lyricRequests: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/lyrics/')) lyricRequests.push(request.url());
    });

    await page.goto('/');
    await expect(page.getByRole('button', { name: '가사 파일 불러오기' })).toBeVisible();
    expect(lyricRequests).toEqual([]);
  });

  test('should refresh another open tab after a local import', async ({ page, context }) => {
    const otherPage = await context.newPage();
    await Promise.all([page.goto('/'), otherPage.goto('/')]);

    const lyrics = [{ time: 1, jp: '練習の歌', pron: '렌슈노 우타', ko: '연습 노래' }];
    await page.locator('input[type="file"]').setInputFiles({
      name: 'kaiju-no-hanauta.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(lyrics)),
    });

    await expect(page.getByRole('button', { name: /練習の歌/ })).toBeVisible();
    await expect(otherPage.getByRole('button', { name: /練習の歌/ })).toBeVisible();
    await otherPage.close();
  });

  test('should explain and recover from a corrupt local lyric record', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('歌詞をひらく。')).toBeVisible();

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
    await expect(page.getByRole('button', { name: '가사 파일 불러오기' })).toBeVisible();

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
      await expect(page.getByText('歌詞をひらく。')).toBeVisible();
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
