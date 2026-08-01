import { expect, test, type Browser, type Page } from '@playwright/test';

import type { LyricLine } from '@/lib/lyrics';
import type { StoredLyricsEntry } from '@/lib/lyrics-import';
import { profileHoldFrames, shareProfile, SHARE_PROFILES, type ShareProfile } from '@/lib/share/frames';
import { SONG_LIBRARY_SCHEMA_VERSION, type SongLibrary } from '@/lib/song-library';

/**
 * 광학 루프백. 카메라 없이 진짜 스캐너 경로를 통과시킨다.
 *
 * 보내는 페이지의 rAF를 손으로 돌려 풀 전체를 `toDataURL()`로 캡처하고, 받는 페이지의
 * `getUserMedia`를 오프스크린 캔버스 `captureStream()`으로 바꿔 그 그림을 되돌려 준다.
 * 디코드는 앱이 쓰는 엔진(BarcodeDetector 또는 jsQR 워커)이 진짜 `<video>` 픽셀에서 한다.
 *
 * 캔버스 루프백은 폰 카메라가 아니다. 초점·흔들림·기울기·조명·롤링셔터가 전부 빠져 있으므로
 * 여기 수치는 실제 광학 전송의 **상한**이다.
 */

declare global {
  interface Window {
    qrSenderHarness: {
      takeClock(): void;
      /** 반환값은 [스텝][레인] 2차원이다. 2레인 프로파일은 한 스텝에 두 장이 함께 바뀐다. */
      capture(stepsPerFrame: number, frameCount: number, stepMs: number): Promise<string[][]>;
    };
    qrLoopback: {
      load(steps: string[][], targetPx: number, landscape: boolean): Promise<LoopbackGeometry>;
      start(intervalMs: number): void;
      stop(): void;
      drawnFrames(): number;
    };
    qrReceiveMarks: {
      firstScanAt: number | null;
      doneAt: number | null;
      drawnAtFirstScan: number;
      drawnAtDone: number;
      samples: ReceiveSample[];
    };
  }
}

type LoopbackGeometry = { width: number; height: number; scale: number; laneCount: number; laneWidth: number };
type ReceiveSample = {
  at: number;
  drawn: number;
  rank: number;
  blockCount: number;
  kilobytesPerSecond: number;
  scansPerSecond: number;
  dropped: number;
};

/** 캡처한 QR 한 장을 이 픽셀 폭 근처의 정수 배율로 키운다. 큰 화면을 가까이서 찍은 상태를 흉내낸다. */
const TARGET_SYMBOL_PX = 1000;
const FRAME_STEP_MS = 1000 / 60;
/** `qr-blit.ts`의 QR_QUIET_MODULES. 화면에 실제로 찍히는 폭은 코드 + quiet zone이다. */
const QUIET_MODULES = 4;

/**
 * 프로파일마다 blockBytes가 달라 같은 페이로드로는 K가 몇 배씩 벌어진다. 측정 구간이 1초도 안 되면
 * 엔진 워밍업이 결과를 지배하므로, 측정 구간이 최소 1~2초는 되도록 곡당 가사 줄 수를 프로파일별로 잡는다.
 * (합성 가사 20곡 기준 압축 후 약 13 KB · 72 KB · 60 KB · 100 KB)
 */
const MEASUREMENT_LYRIC_LINES: Record<ShareProfile['id'], number> = { safe: 45, fast: 260, turbo: 220, max: 360 };

/**
 * 기하 테스트는 처리량이 아니라 "이 배치에서 완주하는가"를 본다. 캔버스가 커질수록 jsQR 한 장이
 * 비싸지므로 번들을 작게 잡는다(20곡 × 100줄 ≈ 압축 후 27 KB → V40에서 K가 두 자리 초반).
 */
const GEOMETRY_LYRIC_LINES = 90;
const ONE_LANE_LYRIC_LINES = 100;
/** 캡처 원본 한 장이 370px(185모듈 × 2)이므로 2배가 모듈당 4픽셀이다. 4K급 합성 캔버스를 피한다. */
const GEOMETRY_SYMBOL_PX = 740;

/**
 * `BarcodeDetector`는 플랫폼 의존이다(macOS·Android에는 있고 리눅스 CI에는 없다).
 * 이 값을 켜면 그것을 지워 CI와 같은 jsQR 워커 경로를 로컬에서 재현할 수 있다.
 */
const FORCE_JSQR = process.env.QR_LOOPBACK_FORCE_JSQR === '1';

test.describe('QR optical loopback', () => {
  // canvas.captureStream + getUserMedia 스텁은 chromium에서만 안정적이다.
  // CI 매트릭스는 chromium/firefox/webkit 3종이라 이 가드가 없으면 나머지 둘이 깨진다.
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'canvas.captureStream + getUserMedia 스텁은 chromium에서만 안정적이다 (CI는 firefox·webkit도 돈다).'
  );

  test('전송한 재생목록이 확인 화면까지 도달한다', async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const library = syntheticLibrary(9);
    const result = await runLoopback({
      browser,
      origin: new URL(baseURL!).origin,
      profile: shareProfile('fast'),
      seed: { library },
      scope: 'playlist',
    });

    await expect(result.confirm).toBeVisible();
    await expect(result.confirm.locator('strong')).toHaveText(['1', '9', '0']);
    await expect(result.confirm.getByRole('button', { name: '이 재생목록 가져오기' })).toBeVisible();
    await result.close();
  });

  for (const profile of SHARE_PROFILES) {
    test(`${profile.id} 프로파일이 가사를 포함한 보관함을 옮긴다`, async ({ browser, baseURL }, testInfo) => {
      test.setTimeout(240_000);
      const library = syntheticLibrary(20);
      const lyrics = syntheticLyrics(library, MEASUREMENT_LYRIC_LINES[profile.id]);
      const result = await runLoopback({
        browser,
        origin: new URL(baseURL!).origin,
        profile,
        seed: { library, lyrics },
        scope: 'library',
        includeLyrics: true,
      });

      await expect(result.confirm).toBeVisible();
      await expect(result.confirm.locator('strong')).toHaveText(['1', '20', '20']);
      await expect(result.confirm.getByRole('button', { name: '이 기기의 보관함 교체' })).toBeVisible();

      const { marks } = result;
      const first = marks.samples[0]!;
      const last = marks.samples.at(-1)!;
      expect(marks.firstScanAt).not.toBeNull();
      expect(last.blockCount).toBeGreaterThanOrEqual(24);
      // 완료 시점의 강제 flush는 확인 화면 전환과 같은 커밋에 묶여 렌더되지 않는다.
      // 그러므로 마지막 표시값이 K에 못 미치는 것이 정상이고, 검증할 것은 "숫자가 살아 움직였는가"다.
      expect(marks.samples.length).toBeGreaterThanOrEqual(2);
      expect(last.rank).toBeGreaterThan(first.rank);
      expect(marks.samples.some(sample => sample.kilobytesPerSecond > 0)).toBe(true);
      expect(marks.samples.some(sample => sample.scansPerSecond > 0)).toBe(true);

      const measurement = measure(profile, result);
      // 이 스펙의 산출물은 통과 여부가 아니라 수치다. 리포트에 남도록 로그와 첨부 양쪽에 적는다.
      console.log(`[qr-loopback] ${JSON.stringify(measurement)}`);
      await testInfo.attach('qr-loopback-measurement', {
        body: JSON.stringify(measurement, null, 2),
        contentType: 'application/json',
      });

      await result.close();
    });
  }

  test('최대 프로파일이 가로 카메라 프레임 안의 세로 2레인을 완주한다', async ({ browser, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    // 예전 설계는 카메라 프레임의 종횡비로 분할축을 골랐다. 가로 프레임 + 세로 2레인은 좌우로 잘려
    // 두 코드를 반씩 물었고 처리량이 영구히 0이었다. 세로 캔버스로만 합성하던 루프백은 그걸 못 봤다.
    const library = syntheticLibrary(20);
    const result = await runLoopback({
      browser,
      origin: new URL(baseURL!).origin,
      profile: shareProfile('max'),
      seed: { library, lyrics: syntheticLyrics(library, GEOMETRY_LYRIC_LINES) },
      scope: 'library',
      includeLyrics: true,
      targetPx: GEOMETRY_SYMBOL_PX,
      landscape: true,
    });

    await expect(result.confirm).toBeVisible();
    await expect(result.confirm.locator('strong')).toHaveText(['1', '20', '20']);
    expect(result.geometry.laneCount).toBe(2);
    expect(result.geometry.width).toBeGreaterThan(result.geometry.height);

    const measurement = measure(shareProfile('max'), result);
    console.log(`[qr-loopback] ${JSON.stringify(measurement)}`);
    await testInfo.attach('qr-loopback-measurement', {
      body: JSON.stringify(measurement, null, 2),
      contentType: 'application/json',
    });
    await result.close();
  });

  test('최대 프로파일이 한쪽 레인만 보이는 카메라에서도 랭크 K에 도달한다', async ({ browser, baseURL }) => {
    test.setTimeout(240_000);
    // 두 레인은 하나의 cursor를 나눠 쓴다. 레인 0만 보이면 짝수 cursor만 들어오므로, 풀 크기가
    // 짝수면 poolSize/2에서 영원히 정체한다. 홀수 풀이라야 한 바퀴마다 패리티가 뒤집혀 전부 돈다.
    const library = syntheticLibrary(20);
    const result = await runLoopback({
      browser,
      origin: new URL(baseURL!).origin,
      profile: shareProfile('max'),
      seed: { library, lyrics: syntheticLyrics(library, ONE_LANE_LYRIC_LINES) },
      scope: 'library',
      includeLyrics: true,
      targetPx: GEOMETRY_SYMBOL_PX,
      visibleLanes: [0],
    });

    await expect(result.confirm).toBeVisible();
    await expect(result.confirm.locator('strong')).toHaveText(['1', '20', '20']);
    expect(result.geometry.laneCount).toBe(1);
    // 이 두 가지가 깨지면 테스트가 "완주했다"고 말하면서 실제로는 아무것도 검증하지 않게 된다.
    expect(result.poolSize % 2).toBe(1);
    expect(result.marks.samples.at(-1)!.blockCount).toBeGreaterThanOrEqual(10);
    await result.close();
  });
});

/** 통과 여부가 아니라 수치가 이 스펙의 산출물이다. 세 테스트가 같은 모양으로 남긴다. */
function measure(profile: ShareProfile, result: Awaited<ReturnType<typeof runLoopback>>) {
  const { marks, geometry } = result;
  const first = marks.samples[0]!;
  const last = marks.samples.at(-1)!;
  const elapsedMs = marks.doneAt! - marks.firstScanAt!;
  const totalModules = profile.typeNumber * 4 + 17 + QUIET_MODULES * 2;
  // scan-loop은 짧은 축이 MAX_SCAN_SIDE를 넘을 때만 줄인다.
  const scanSide = Math.min(1200, Math.min(geometry.width, geometry.height));
  const objectBytes = last.blockCount * profile.blockBytes;
  return {
    profile: profile.id,
    engine: result.engine,
    barcodeDetector: result.barcodeDetector,
    typeNumber: profile.typeNumber,
    level: profile.level,
    lanes: geometry.laneCount,
    blockCount: last.blockCount,
    theoreticalBytesPerSecond: profile.targetSymbolsPerSecond * profile.blockBytes,
    preEncodeMs: Math.round(result.preEncodeMs),
    poolSize: result.poolSize,
    captureMs: Math.round(result.captureMs),
    firstScanToDoneMs: Math.round(elapsedMs),
    effectiveBytesPerSecond: Math.round((objectBytes * 1000) / elapsedMs),
    // 첫 표시부터 마지막 표시까지만 본 정상 상태값. 엔진 워밍업과 마지막 decode()가 빠진다.
    steadyBytesPerSecond: Math.round(((last.rank - first.rank) * profile.blockBytes * 1000) / (last.at - first.at)),
    decodedSymbolsPerSecond: last.scansPerSecond,
    displayedSymbolsPerSecond: Number(
      (((marks.drawnAtDone - marks.drawnAtFirstScan) * geometry.laneCount * 1000) / elapsedMs).toFixed(1)
    ),
    droppedSymbols: last.dropped,
    statsRenders: marks.samples.length,
    lastRenderedRank: last.rank,
    videoWidth: geometry.width,
    videoHeight: geometry.height,
    laneWidth: geometry.laneWidth,
    screenPixelsPerModule: Number((geometry.laneWidth / totalModules).toFixed(2)),
    scanSide,
  };
}

// ---------------------------------------------------------------------------
// 합성 데이터. PRODUCT.md가 실제 가사 반입을 금지하므로 전부 만들어 낸 문자열이다.
// ---------------------------------------------------------------------------

const SYNTHETIC_JA = [
  'あさひ',
  'ゆうぐれ',
  'まちかど',
  'こもりうた',
  'なつかしい',
  'ひかり',
  'かぜ',
  'みずうみ',
  'ほしぞら',
  'ゆめ',
  'あしおと',
  'ことば',
  'てのひら',
  'とおく',
  'まばたき',
  'しずか',
];
const SYNTHETIC_KO = [
  '아침해',
  '저물녘',
  '길모퉁이',
  '자장노래',
  '그리운',
  '빛',
  '바람',
  '호수',
  '별하늘',
  '꿈',
  '발소리',
  '말',
  '손바닥',
  '멀리',
  '깜빡임',
  '고요',
];

/** 시드 고정 LCG. 같은 입력이면 같은 번들이 나와야 프로파일 간 비교가 성립한다. */
function pseudoRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function syntheticLibrary(songCount: number): SongLibrary {
  const songs = Array.from({ length: songCount }, (_, index) => ({
    slug: `loopback-song-${String(index).padStart(2, '0')}`,
    titleJa: `テスト${index}`,
    titleKo: `테스트${index}`,
    videoId: `lb${String(index).padStart(9, '0')}`,
  }));
  return {
    schemaVersion: SONG_LIBRARY_SCHEMA_VERSION,
    songs,
    playlists: [{ id: 'loopback', name: '루프백', songSlugs: songs.map(song => song.slug) }],
  };
}

function syntheticLyrics(library: SongLibrary, linesPerSong: number): StoredLyricsEntry[] {
  const random = pseudoRandom(7);
  const pick = (list: readonly string[]) => list[Math.floor(random() * list.length)]!;
  return library.songs.map(song => ({
    slug: song.slug,
    lyrics: Array.from(
      { length: linesPerSong },
      (_, index): LyricLine => ({
        time: index * 2.5 + 1,
        jp: `${pick(SYNTHETIC_JA)}${pick(SYNTHETIC_JA)} ${pick(SYNTHETIC_JA)}`,
        pron: `${pick(SYNTHETIC_KO)} ${pick(SYNTHETIC_KO)}`,
        ko: `${pick(SYNTHETIC_KO)} ${pick(SYNTHETIC_KO)}${pick(SYNTHETIC_KO)}`,
      })
    ),
  }));
}

// ---------------------------------------------------------------------------
// 페이지 준비
// ---------------------------------------------------------------------------

type Seed = { library?: SongLibrary; lyrics?: StoredLyricsEntry[] };

async function openApp(
  browser: Browser,
  origin: string,
  seed: Seed,
  install: (page: Page) => Promise<void>
): Promise<Page> {
  const localStorageSeed = [
    { name: 'karaoke:privacy-consent', value: 'true' },
    { name: 'karaoke:first-guide', value: 'true' },
  ];
  if (seed.library) {
    localStorageSeed.push(
      { name: 'karaoke:song-library', value: JSON.stringify(seed.library) },
      { name: 'karaoke:active-playlist', value: JSON.stringify(seed.library.playlists[0]!.id) }
    );
  }

  // 보내는 기기와 받는 기기는 저장소가 달라야 한다. 같은 컨텍스트면 localStorage를 공유해
  // 받는 쪽이 이미 같은 보관함을 갖게 되고, 가져오기 요약이 전부 0이 된다.
  const context = await browser.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [{ origin, localStorage: localStorageSeed }] },
  });
  const page = await context.newPage();
  await page.route(/(youtube\.com|ytimg\.com|youtube-nocookie\.com)/, route => route.abort());
  await install(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'QR로 보내고 받기' })).toBeVisible();

  if (seed.lyrics?.length) await writeStoredLyrics(page, seed.lyrics);
  return page;
}

/** 가사는 storageState로 못 넣는다(IndexedDB). 앱이 쓰는 레코드 모양 그대로 직접 쓴다. */
async function writeStoredLyrics(page: Page, entries: StoredLyricsEntry[]): Promise<void> {
  await page.evaluate(
    records =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('karaoke-local-library', 1);
        open.addEventListener('upgradeneeded', () => {
          if (!open.result.objectStoreNames.contains('lyrics')) {
            open.result.createObjectStore('lyrics', { keyPath: 'slug' });
          }
        });
        open.addEventListener('error', () => reject(open.error), { once: true });
        open.addEventListener(
          'success',
          () => {
            const database = open.result;
            const transaction = database.transaction('lyrics', 'readwrite');
            const store = transaction.objectStore('lyrics');
            const updatedAt = new Date().toISOString();
            for (const record of records) store.put({ schemaVersion: 1, ...record, updatedAt });
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
      }),
    entries
  );
}

// ---------------------------------------------------------------------------
// 보내는 쪽: rAF를 손으로 돌려 풀 전체를 캡처한다
// ---------------------------------------------------------------------------

function installSenderClock(): void {
  const nativeRequest = globalThis.requestAnimationFrame.bind(globalThis);
  const nativeCancel = globalThis.cancelAnimationFrame.bind(globalThis);
  const queued = new Map<number, FrameRequestCallback>();
  let manual = false;
  let handle = 1_000_000;
  let now = 0;

  globalThis.requestAnimationFrame = callback => {
    if (!manual) return nativeRequest(callback);
    handle += 1;
    queued.set(handle, callback);
    return handle;
  };
  globalThis.cancelAnimationFrame = id => {
    if (!queued.delete(id)) nativeCancel(id);
  };

  const step = (delta: number) => {
    now += delta;
    const pending = [...queued.values()];
    queued.clear();
    for (const callback of pending) callback(now);
  };
  /** 레인 canvas 전부. 2레인 프로파일은 두 장이 한 화면에 함께 떠 있다. */
  const laneShots = () =>
    [...document.querySelectorAll<HTMLCanvasElement>('canvas[role="img"]')].map(canvas =>
      canvas.toDataURL('image/png')
    );

  window.qrSenderHarness = {
    takeClock() {
      manual = true;
      now = performance.now();
    },
    async capture(stepsPerFrame, frameCount, stepMs) {
      const steps: string[][] = [];
      for (let index = 0; index < frameCount; index += 1) {
        const before = laneShots();
        for (let tick = 0; tick < stepsPerFrame; tick += 1) step(stepMs);
        // React는 심볼 교체를 다음 태스크에 커밋한다. 고정 대기 대신 픽셀이 바뀔 때까지 기다린다.
        // 2레인은 hold refresh 안에서 엇갈려 갱신되므로 **모든** 레인이 바뀔 때까지 기다려야 한다.
        let shots = laneShots();
        for (let attempt = 0; attempt < 200 && shots.some((shot, lane) => shot === before[lane]); attempt += 1) {
          await new Promise(resolve => setTimeout(resolve, 0));
          shots = laneShots();
        }
        steps.push(shots);
      }
      return steps;
    },
  };
}

const SCOPE_RADIO_NAMES = { playlist: /^현재 재생목록/, library: /^전체 보관함/ } as const;

async function captureShareFrames(
  page: Page,
  profile: ShareProfile,
  scope: 'playlist' | 'library',
  includeLyrics: boolean
): Promise<{ steps: string[][]; poolSize: number; preEncodeMs: number; captureMs: number }> {
  await page.getByRole('button', { name: 'QR로 보내고 받기' }).click();
  await page
    .getByRole('dialog', { name: '기기 간 공유' })
    .getByRole('button', { name: /보내기/ })
    .click();

  const settings = page.getByRole('dialog', { name: '보낼 데이터' });
  await settings.getByRole('radio', { name: SCOPE_RADIO_NAMES[scope] }).click();
  if (includeLyrics) {
    const toggle = settings.getByRole('switch', { name: '저장된 가사도 포함' });
    // 큰 가사 보관함은 드로어를 열 때 읽는다. 다 읽기 전에는 스위치가 disabled다.
    await expect(toggle).toBeEnabled({ timeout: 60_000 });
    await toggle.click();
    await expect(toggle).toBeChecked();
  }
  await settings.getByRole('radio', { name: new RegExp(`^${profile.label}`) }).click();

  // 표시 루프가 시작되기 전에 시계를 뺏어야 캡처가 결정적이다. 사전 인코딩은 워커라 rAF를 쓰지 않는다.
  await page.evaluate(() => window.qrSenderHarness.takeClock());
  const preEncodeStart = Date.now();
  await settings.getByRole('button', { name: 'QR 만들기' }).click();

  const sending = page.getByRole('dialog', { name: 'QR 보내기' });
  // 2레인은 접근 이름이 '노래 데이터 공유 QR 1'·'... 2'로 갈라진다.
  const symbols = sending.getByRole('img', { name: /^노래 데이터 공유 QR/ });
  await expect(symbols.first()).toBeVisible({ timeout: 120_000 });
  await expect(symbols).toHaveCount(profile.lanes);
  const preEncodeMs = Date.now() - preEncodeStart;

  const poolText = await sending.getByText(/반복 표시/).innerText();
  const poolSize = Number(/\/\s*(\d+)\s*반복 표시/.exec(poolText)![1]);
  expect(poolSize).toBeGreaterThan(0);

  // 실측 60Hz에서 레인 하나가 몇 refresh를 버티는지. 그만큼 돌리면 모든 레인이 정확히 한 칸씩 넘어간다.
  const hold = profileHoldFrames(profile, 1000 / FRAME_STEP_MS);
  const captureStart = Date.now();
  const steps = await page.evaluate(
    ({ hold: perStep, count, stepMs }) => window.qrSenderHarness.capture(perStep, count, stepMs),
    { hold, count: poolSize, stepMs: FRAME_STEP_MS }
  );
  return { steps, poolSize, preEncodeMs, captureMs: Date.now() - captureStart };
}

// ---------------------------------------------------------------------------
// 받는 쪽: getUserMedia를 오프스크린 캔버스로 바꾼다
// ---------------------------------------------------------------------------

function installReceiverLoopback(): void {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  let steps: HTMLImageElement[][] = [];
  let scale = 1;
  let laneWidth = 0;
  let laneHeight = 0;
  let offsetX = 0;
  let offsetY = 0;
  let cursor = 0;
  let drawn = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const draw = () => {
    const lanes = steps[cursor % steps.length]!;
    cursor += 1;
    drawn += 1;
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    // 화면과 같은 배치로 위아래에 쌓는다. 카메라 프레임이 가로여도 레인은 세로로 쌓인 채다.
    lanes.forEach((image, lane) => {
      context.drawImage(image, offsetX, offsetY + lane * laneHeight, laneWidth, laneHeight);
    });
  };

  const decode = (source: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image), { once: true });
      image.addEventListener('error', () => reject(new Error('캡처한 QR 프레임을 디코드하지 못했습니다.')), {
        once: true,
      });
      image.src = source;
    });

  window.qrLoopback = {
    async load(sources, targetPx, landscape) {
      steps = await Promise.all(sources.map(lanes => Promise.all(lanes.map(decode))));
      const first = steps[0]![0]!;
      // 모듈 격자가 깨지지 않게 정수 배율로만 키운다. 캡처 원본이 이미 모듈 정수배라 정보 손실이 없다.
      scale = Math.max(1, Math.round(targetPx / first.naturalWidth));
      laneWidth = first.naturalWidth * scale;
      laneHeight = first.naturalHeight * scale;
      const laneCount = steps[0]!.length;
      const contentHeight = laneHeight * laneCount;
      // 가로 카메라 프레임: 세로로 쌓인 레인을 16:9 프레임 가운데에 레터박스로 넣는다.
      canvas.width = landscape ? Math.max(Math.round((contentHeight * 16) / 9), laneWidth) : laneWidth;
      canvas.height = contentHeight;
      offsetX = Math.round((canvas.width - laneWidth) / 2);
      offsetY = 0;
      draw();
      return { width: canvas.width, height: canvas.height, scale, laneCount, laneWidth };
    },
    start(intervalMs) {
      timer ??= setInterval(draw, intervalMs);
    },
    stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    },
    drawnFrames: () => drawn,
  };

  const media = navigator.mediaDevices;
  media.getUserMedia = async () => canvas.captureStream(30);
  media.enumerateDevices = async () => [
    { deviceId: 'loopback', groupId: 'loopback', kind: 'videoinput', label: '루프백 카메라', toJSON: () => ({}) },
  ];
}

/** 수신 통계는 DOM에만 있다. 폴링으로는 250ms 갱신을 놓치므로 페이지 안에서 전부 기록한다. */
function installReceiveMarks(): void {
  const marks: Window['qrReceiveMarks'] = {
    firstScanAt: null,
    doneAt: null,
    drawnAtFirstScan: 0,
    drawnAtDone: 0,
    samples: [],
  };
  window.qrReceiveMarks = marks;
  const observer = new MutationObserver(() => {
    const text = document.body?.textContent ?? '';
    const now = performance.now();
    const drawn = window.qrLoopback.drawnFrames();
    if (marks.doneAt === null && text.includes('가져오기 확인')) {
      marks.doneAt = now;
      marks.drawnAtDone = drawn;
    }
    if (!text.includes('조각 모으는 중')) return;
    const progress = /(\d+) \/ (\d+) 조각 모으는 중/.exec(text);
    if (!progress) return;
    if (marks.firstScanAt === null) {
      marks.firstScanAt = now;
      marks.drawnAtFirstScan = drawn;
    }
    const measured = /실측 ([\d.]+) KB\/s · 초당 ([\d.]+)장 · 버린 조각 (\d+)/.exec(text);
    marks.samples.push({
      at: now,
      drawn,
      rank: Number(progress[1]),
      blockCount: Number(progress[2]),
      kilobytesPerSecond: measured ? Number(measured[1]) : 0,
      scansPerSecond: measured ? Number(measured[2]) : 0,
      dropped: measured ? Number(measured[3]) : 0,
    });
  });
  // init script는 documentElement가 생기기 전에 돈다. Document 노드를 관찰해야 attach가 실패하지 않는다.
  observer.observe(document, { subtree: true, childList: true, characterData: true });
}

// ---------------------------------------------------------------------------
// 루프백 실행
// ---------------------------------------------------------------------------

async function runLoopback({
  browser,
  origin,
  profile,
  seed,
  scope,
  includeLyrics = false,
  targetPx = TARGET_SYMBOL_PX,
  landscape = false,
  visibleLanes,
}: {
  browser: Browser;
  origin: string;
  profile: ShareProfile;
  seed: Seed;
  scope: 'playlist' | 'library';
  includeLyrics?: boolean;
  targetPx?: number;
  /** 카메라 프레임을 가로로 만든다. 세로로 쌓인 레인이 가로 프레임 안에 들어간 배치다. */
  landscape?: boolean;
  /** 합성 캔버스에 그릴 레인. 생략하면 전부. 한쪽만 주면 "카메라가 레인 하나만 담은" 상태가 된다. */
  visibleLanes?: number[];
}) {
  const sender = await openApp(browser, origin, seed, page => page.addInitScript(installSenderClock));
  const captured = await captureShareFrames(sender, profile, scope, includeLyrics);
  const { poolSize, preEncodeMs, captureMs } = captured;
  const steps = visibleLanes ? captured.steps.map(lanes => visibleLanes.map(lane => lanes[lane]!)) : captured.steps;
  await sender.context().close();

  const receiver = await openApp(browser, origin, {}, async page => {
    if (FORCE_JSQR) {
      await page.addInitScript(() => {
        Reflect.deleteProperty(globalThis, 'BarcodeDetector');
      });
    }
    await page.addInitScript(installReceiverLoopback);
    await page.addInitScript(installReceiveMarks);
  });
  // qr-scanner의 엔진 선택은 내부 휴리스틱이다(arm macOS 13+에서는 BarcodeDetector가 있어도 피한다).
  // 그 규칙을 여기서 다시 구현하면 라이브러리가 바뀔 때 라벨만 조용히 거짓말한다. 통제하는 값만 적는다.
  const barcodeDetector = await receiver.evaluate(() => 'BarcodeDetector' in window);
  const engine = FORCE_JSQR ? 'jsqr-worker (forced)' : 'platform default';
  const geometry = await receiver.evaluate(
    options => window.qrLoopback.load(options.sources, options.targetPx, options.landscape),
    { sources: steps, targetPx, landscape }
  );

  await receiver.getByRole('button', { name: 'QR로 보내고 받기' }).click();
  await receiver
    .getByRole('dialog', { name: '기기 간 공유' })
    .getByRole('button', { name: /받기/ })
    .click();

  // 프로파일이 노린 표시 속도 그대로 되돌려 준다. 한 스텝이 레인 수만큼의 심볼을 함께 보여 준다.
  const intervalMs = Math.round(1000 / (profile.targetSymbolsPerSecond / profile.lanes));
  await receiver.evaluate(interval => window.qrLoopback.start(interval), intervalMs);
  await receiver.getByRole('dialog', { name: 'QR 받기' }).getByRole('button', { name: '카메라 켜기' }).click();

  const confirm = receiver.getByRole('dialog', { name: '가져오기 확인' });
  await expect(confirm).toBeVisible({ timeout: 180_000 });
  await receiver.evaluate(() => window.qrLoopback.stop());

  const marks = await receiver.evaluate(() => window.qrReceiveMarks);

  return {
    confirm,
    engine,
    barcodeDetector,
    geometry,
    marks,
    poolSize,
    preEncodeMs,
    captureMs,
    close: () => receiver.context().close(),
  };
}
