#!/usr/bin/env node
/**
 * 디자인시스템 단계 0 기준선 캡처.
 *
 * 대표 사용자 흐름(탐색 → 목록 → 읽기 → 다음 콘텐츠)의 화면을
 * light/dark × mobile/desktop으로 캡처해 docs/design-system/baselines/에 저장한다.
 *
 * 이건 회귀 테스트가 아니라 문서 산출물이다. 단정(assert)하지 않고, CI에서 돌지 않는다.
 * screenshot 단정은 단계 3에서 기존 blog Playwright 안에 toHaveScreenshot으로 들어간다.
 *
 * 사용법 (apps/blog 루트에서):
 *   pnpm --filter blog build
 *   pnpm --filter blog start:e2e &     # http://localhost:3002
 *   node scripts/capture-baselines.mjs
 *
 * 옵션:
 *   --base-url=<url>   기본 http://localhost:3002
 *   --out=<dir>        기본 ../../docs/design-system/baselines
 *   --only=<substr>    id에 substr이 포함된 캡처만 실행
 */
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const APP_DIR = path.resolve(import.meta.dirname, '..');
const REPO_ROOT = path.resolve(APP_DIR, '../..');

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value];
  })
);

const BASE_URL = args['base-url'] ?? 'http://localhost:3002';
const OUT_DIR = path.resolve(APP_DIR, args.out ?? path.join(REPO_ROOT, 'docs/design-system/baselines'));
const ONLY = args.only ?? null;

// 화면 폭 프로파일. 실제 디바이스 UA를 쓰면 터치/포인터 미디어쿼리까지 실기기를 따라간다.
// iPhone 13의 기본 DPR 3은 문서용 캡처에 과하다(풀페이지 한 장이 3MB를 넘어 저장소
// 최대 파일인 2MB 폰트를 앞선다). 레이아웃·위계·테마 비교가 목적이므로 2로 낮춘다.
const VIEWPORTS = [
  { key: 'desktop', label: '1280x800', context: { viewport: { width: 1280, height: 800 } } },
  {
    key: 'mobile',
    label: 'iPhone 13 viewport 390x664 / screen 390x844 (DPR 2)',
    context: { ...devices['iPhone 13'], deviceScaleFactor: 2 },
  },
];

const THEMES = ['light', 'dark'];

/**
 * 대표 화면. plan.md §6의 대표 흐름(탐색 → 목록 → 읽기 → 다음 콘텐츠) 4단계를 전부 덮는다.
 *
 * ready: 캡처 전에 반드시 보여야 하는 요소. 없으면 레이아웃이 덜 그려진 상태로 찍힌다.
 * fullPage: 목록처럼 몇 화면 안에 끝나고 전체 리듬이 판단 대상일 때만 켠다.
 *   긴 글 상세는 모바일에서 3만 px 띠가 되어 문서로 못 쓰므로 앵커 캡처로 나눈다.
 * prepare: 캡처 전 상호작용(메뉴 열기, 특정 지점으로 스크롤, 포커스 이동).
 * viewports: 이 캡처를 돌릴 프로파일 제한.
 */
const SCREENS = [
  {
    id: 'home',
    note: '콘텐츠 진입 — 최신 글 + 최신 노트 대응 블록',
    url: '/ko',
    fullPage: true,
    ready: page => page.getByRole('heading', { level: 1 }),
  },
  {
    id: 'blog-index',
    note: 'blog 목록 — PageHeader + ContentSegmentNav + ContentCard',
    url: '/ko/blog',
    fullPage: true,
    ready: page => page.getByRole('heading', { level: 1 }),
  },
  {
    id: 'garden-index',
    note: 'garden 목록 — PARA overview 우선, GardenNav는 목록 필터',
    url: '/ko/garden',
    fullPage: true,
    ready: page => page.getByRole('heading', { level: 1 }),
  },
  {
    id: 'blog-detail-head',
    note: '글 상세 진입부 — 60자 한국어 제목 (줄바꿈/word-break 압박 fixture)',
    url: '/ko/blog/articles/expo-social-login-backend',
    ready: page => page.getByRole('article'),
  },
  {
    id: 'blog-detail-tail',
    note: '글 상세 착지점 — NextReading (다음 콘텐츠로 이동하는 지점)',
    url: '/ko/blog/articles/expo-social-login-backend',
    ready: page => page.getByRole('article'),
    prepare: page => scrollTo(page, '#next-reading-heading'),
  },
  {
    id: 'garden-detail-head',
    note: '노트 상세 진입부 — 71자 영어 제목 (긴 라틴 제목 fixture)',
    url: '/en/garden/digital-garden-expansion-plan',
    ready: page => page.getByRole('article'),
  },
  {
    id: 'garden-detail-tail',
    note: '노트 상세 착지점 — LinkedNotesSection (백링크 재방문 경로)',
    url: '/en/garden/digital-garden-expansion-plan',
    ready: page => page.getByRole('article'),
    prepare: page => scrollTo(page, '[data-linked-notes-section]'),
  },
  {
    id: 'mobile-navigation-open',
    note: '모바일 navigation — Sheet 열림 상태',
    url: '/ko/blog',
    viewports: ['mobile'],
    ready: page => page.getByRole('heading', { level: 1 }),
    prepare: async page => {
      await page.getByRole('button', { name: '내비게이션 열기' }).click();
      await page.getByRole('dialog').waitFor({ state: 'visible' });
    },
  },
  {
    id: 'search-palette-open',
    note: '검색 팔레트 — 전역 dialog',
    url: '/ko/garden',
    ready: page => page.getByRole('heading', { level: 1 }),
    prepare: async page => {
      await page.getByRole('button', { name: '사이트 검색' }).click();
      await page.getByRole('dialog', { name: '검색' }).waitFor({ state: 'visible' });
    },
  },
  {
    id: 'blog-index-keyboard-focus',
    note: 'focus-visible 상태 — Tab만으로 첫 카드 링크까지 이동',
    url: '/ko/blog',
    viewports: ['desktop'],
    ready: page => page.getByRole('heading', { level: 1 }),
    prepare: page => tabTo(page, '[data-slot="content-card-link"]'),
  },
];

/**
 * element.focus()는 :focus-visible을 보장하지 않는다(브라우저가 "키보드로 온 포커스"로
 * 취급하지 않을 수 있다). 실제 Tab으로 이동해야 사용자가 보는 것과 같은 링이 찍힌다.
 * 도달까지의 Tab 횟수 자체가 "본문 첫 항목까지 몇 번인가"라는 접근성 근거라 함께 남긴다.
 */
async function tabTo(page, selector, maxTabs = 40) {
  for (let pressed = 1; pressed <= maxTabs; pressed += 1) {
    await page.keyboard.press('Tab');

    const reached = await page.evaluate(sel => document.activeElement?.matches(sel) ?? false, selector);
    if (reached) return pressed;
  }

  throw new Error(`Tab ${maxTabs}회 안에 ${selector}에 도달하지 못했다`);
}

/**
 * 헤더가 fixed라서 scrollIntoView만 하면 대상이 헤더 뒤에 깔린다.
 * 블록 중앙에 두면 그 섹션의 위아래 여백까지 한 프레임에 들어온다.
 */
async function scrollTo(page, selector) {
  const target = page.locator(selector).first();
  await target.waitFor({ state: 'visible' });
  await target.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
}

/**
 * 카드 ring, sheet slide-in 같은 상태 전이는 CSS transition이라 조작 직후에 찍으면
 * 중간 프레임이 남는다(첫 시도에서 focus ring이 2px 대신 0.06px로 찍혔다).
 * reducedMotion 컨텍스트로도 안 막힌다 - 이 앱의 transition은 prefers-reduced-motion을
 * 보지 않기 때문이다. 그래서 끝이 있는 애니메이션이 전부 끝날 때까지 기다린다.
 * 무한 반복(spotify 이퀄라이저, animate-pulse)은 끝나지 않으므로 제외한다.
 */
async function settle(page) {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter(animation => Number.isFinite(animation.effect?.getComputedTiming()?.endTime ?? Infinity))
        .every(animation => animation.playState === 'finished'),
    null,
    { timeout: 5_000 }
  );
}

function gitRevision() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}

/**
 * next-themes는 localStorage의 값을 읽어 html.dark를 붙인다. addInitScript로
 * 첫 페인트 전에 심어야 하이드레이션 이후 테마가 튀지 않는다.
 * colorScheme도 함께 맞춰 스크롤바/폼 컨트롤까지 테마를 따르게 한다.
 */
async function createContext(browser, viewport, theme) {
  const context = await browser.newContext({
    ...viewport.context,
    colorScheme: theme,
    locale: 'ko-KR',
    // 캡처는 정지 화면이어야 한다. 진행 중인 전이가 프레임마다 다르게 찍히면 기준선이 안 된다.
    reducedMotion: 'reduce',
  });

  await context.addInitScript(value => {
    try {
      window.localStorage.setItem('theme', value);
    } catch {
      // private mode 등에서 storage 접근이 막히면 prefers-color-scheme 폴백에 맡긴다.
    }
  }, theme);

  return context;
}

async function capture(page, screen, viewport, theme) {
  const id = `${screen.id}--${viewport.key}--${theme}`;
  await page.goto(`${BASE_URL}${screen.url}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await screen.ready(page).first().waitFor({ state: 'visible' });

  // prepare가 값을 돌려주면(예: Tab 횟수) manifest에 근거로 남긴다.
  const detail = screen.prepare ? await screen.prepare(page) : undefined;
  await settle(page);

  // 풀페이지 목록은 리듬을 읽기 위한 문서이고 무손실일 이유가 없다. 그대로 PNG로 넣으면
  // 한 장이 저장소 최대 파일(2MB 폰트)을 넘긴다. 반대로 focus ring과 오버레이 경계는
  // 1px 대비가 판단 근거라서 뷰포트 캡처는 PNG로 남긴다.
  // 픽셀 단정은 단계 3의 toHaveScreenshot이 자기 스냅샷으로 따로 관리한다.
  const options = screen.fullPage ? { fullPage: true, type: 'jpeg', quality: 85 } : { type: 'png' };
  const file = path.join(OUT_DIR, `${id}.${screen.fullPage ? 'jpg' : 'png'}`);

  await page.screenshot({ path: file, ...options });

  return { id, file: path.relative(REPO_ROOT, file), screen, viewport, theme, detail };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const captured = [];
  const failed = [];

  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await createContext(browser, viewport, theme);
      const page = await context.newPage();

      for (const screen of SCREENS) {
        if (ONLY && !screen.id.includes(ONLY)) continue;
        if (screen.viewports && !screen.viewports.includes(viewport.key)) continue;

        try {
          const result = await capture(page, screen, viewport, theme);
          captured.push(result);
          console.log(`✓ ${result.id}`);
        } catch (error) {
          failed.push({ id: `${screen.id}--${viewport.key}--${theme}`, message: error.message.split('\n')[0] });
          console.error(`✗ ${screen.id}--${viewport.key}--${theme}\n    ${error.message.split('\n')[0]}`);
        }
      }

      await context.close();
    }
  }

  await browser.close();
  writeManifest(captured, failed);

  console.log(`\n${captured.length} captured, ${failed.length} failed → ${path.relative(REPO_ROOT, OUT_DIR)}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

function writeManifest(captured, failed) {
  const rows = captured.map(({ id, screen, viewport, theme, file, detail }) => {
    const note = detail === undefined ? screen.note : `${screen.note} (Tab ${detail}회)`;
    return `| \`${id}\` | ${note} | \`${screen.url}\` | ${viewport.label} | ${theme} | [파일](${path.basename(file)}) |`;
  });

  const lines = [
    '# 기준선 캡처 manifest',
    '',
    '> 이 파일은 `apps/blog/scripts/capture-baselines.mjs`가 생성한다. 직접 수정하지 않는다.',
    '',
    '| 항목 | 값 |',
    '| --- | --- |',
    `| commit | \`${gitRevision()}\` |`,
    `| base URL | ${BASE_URL} |`,
    `| 캡처 수 | ${captured.length} |`,
    '| locale | ko-KR (garden 상세만 en) |',
    '| reduced motion | reduce (정지 프레임 고정) |',
    '',
    '## 캡처 목록',
    '',
    '| id | 화면 | route | viewport | theme | 파일 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
  ];

  if (failed.length > 0) {
    lines.push(
      '',
      '## 실패',
      '',
      '| id | 원인 |',
      '| --- | --- |',
      ...failed.map(f => `| \`${f.id}\` | ${f.message} |`)
    );
  }

  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), `${lines.join('\n')}\n`);
}

await main();
