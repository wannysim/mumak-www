/**
 * @jest-environment node
 *
 * 정적 렌더링(static prerender) 회귀 가드.
 *
 * 블로그 콘텐츠 페이지는 next.config의 "static-by-default" 의도에 따라 빌드 타임에
 * 정적 prerender(SSG)되어야 한다. 과거 콘텐츠 페이지가 조용히 동적(ƒ server-rendered)으로
 * 새는 회귀가 있었고(`progress-bar-didnt-lie` 포스트모템 / "콘텐츠 정적 prerender 복구"),
 * 이 테스트는 그 회귀 클래스를 빌드 산출물 수준에서 고정한다.
 *
 * 검증 근거: Next.js가 정적/ISR 분류 결과를 직접 기록하는 `.next/prerender-manifest.json`.
 *  - generateStaticParams 기반 SSG 라우트 패턴은 `dynamicRoutes`에 등장한다.
 *  - 구체 경로는 `routes`에 등장하며, 순수 정적이면 `initialRevalidateSeconds === false`.
 *  - 콘텐츠 페이지가 동적으로 새면 manifest에서 통째로 사라지므로, presence 검사만으로
 *    회귀가 잡힌다(헤더 추론이 아니라 빌드가 내린 결정을 그대로 단언).
 *
 * 실행 전제: CI는 turbo `test:ci`의 `dependsOn: ["build"]`에 따라 build를 선행하므로
 * manifest가 항상 존재한다. 로컬에서 빌드 없이 raw jest를 돌리면 manifest가 없어 skip된다
 * (경고 출력). CI(`CI=true`)에서 manifest가 없으면 빌드 파이프라인 문제이므로 hard fail.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type PrerenderManifest = {
  routes: Record<string, { initialRevalidateSeconds: number | false }>;
  dynamicRoutes: Record<string, unknown>;
};

const manifestPath = path.join(__dirname, '..', '..', '.next', 'prerender-manifest.json');
const manifestExists = existsSync(manifestPath);

if (!manifestExists && process.env.CI === 'true') {
  throw new Error(`[static-rendering] ${manifestPath} 가 없습니다. CI는 test:ci 이전에 build를 실행해야 합니다.`);
}

if (!manifestExists) {
  // eslint-disable-next-line no-console
  console.warn(
    '[static-rendering] .next/prerender-manifest.json 없음 — 빌드 산출물이 있어야 검증됩니다.\n' +
      '  `pnpm --filter blog build` 후 재실행하세요. (CI는 build를 선행하므로 항상 검증됩니다)'
  );
}

const manifest: PrerenderManifest = manifestExists
  ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as PrerenderManifest)
  : { routes: {}, dynamicRoutes: {} };

const routeKeys = Object.keys(manifest.routes);
const dynamicKeys = Object.keys(manifest.dynamicRoutes);

// generateStaticParams로 정적 생성되는 콘텐츠 라우트 패턴.
// 하나라도 누락되면 그 페이지가 동적으로 샜다는 뜻이다.
const EXPECTED_SSG_PATTERNS = [
  '/[locale]',
  '/[locale]/about',
  '/[locale]/blog',
  '/[locale]/blog/tags',
  '/[locale]/blog/tags/[tag]',
  '/[locale]/blog/[category]',
  '/[locale]/blog/[category]/[slug]',
  '/[locale]/garden',
  '/[locale]/garden/status/[status]',
  '/[locale]/garden/tags',
  '/[locale]/garden/tags/[tag]',
  '/[locale]/garden/[slug]',
  '/[locale]/graph',
  '/[locale]/now',
];

// 빌드마다 해시 suffix가 바뀌므로 패턴으로 매칭한다.
const OG_PATTERNS = [
  /^\/\[locale\]\/blog\/\[category\]\/\[slug\]\/opengraph-image-[a-z0-9]+$/,
  /^\/\[locale\]\/garden\/\[slug\]\/opengraph-image-[a-z0-9]+$/,
];

// 단일 정적 라우트(○ Static)로 prerender되어야 하는 항목.
const EXPECTED_STATIC_ROUTES = ['/', '/en', '/ko', '/sitemap.xml', '/robots.txt', '/manifest.webmanifest', '/icon'];

const describeOrSkip = manifestExists ? describe : describe.skip;

describeOrSkip('static rendering (prerender-manifest)', () => {
  it('manifest가 비정상적으로 비어있지 않다 (빌드 정상 산출)', () => {
    expect(routeKeys.length).toBeGreaterThan(100);
  });

  it.each(EXPECTED_SSG_PATTERNS)('SSG 콘텐츠 라우트 %s 가 동적으로 새지 않고 prerender된다', pattern => {
    expect(dynamicKeys).toContain(pattern);
  });

  it.each(OG_PATTERNS)('OG 이미지 라우트(%s)가 SSG로 prerender된다', pattern => {
    expect(dynamicKeys.some(key => pattern.test(key))).toBe(true);
  });

  it.each(EXPECTED_STATIC_ROUTES)('정적 라우트 %s 가 prerender된다', route => {
    expect(routeKeys).toContain(route);
  });

  it('블로그 포스트 구체 경로가 양 locale에서 정적 생성된다', () => {
    const koPosts = routeKeys.filter(k => /^\/ko\/blog\/[^/]+\/[^/]+$/.test(k) && !k.startsWith('/ko/blog/tags/'));
    const enPosts = routeKeys.filter(k => /^\/en\/blog\/[^/]+\/[^/]+$/.test(k) && !k.startsWith('/en/blog/tags/'));
    expect(koPosts.length).toBeGreaterThan(0);
    expect(enPosts.length).toBeGreaterThan(0);
  });

  it('가든 노트 구체 경로가 양 locale에서 정적 생성된다', () => {
    const koNotes = routeKeys.filter(
      k => /^\/ko\/garden\/[^/]+$/.test(k) && k !== '/ko/garden/tags' && k !== '/ko/garden/status'
    );
    const enNotes = routeKeys.filter(
      k => /^\/en\/garden\/[^/]+$/.test(k) && k !== '/en/garden/tags' && k !== '/en/garden/status'
    );
    expect(koNotes.length).toBeGreaterThan(0);
    expect(enNotes.length).toBeGreaterThan(0);
  });

  // static-by-default 의도 가드: prerender된 라우트는 전부 순수 정적이어야 한다.
  // 특정 페이지에 의도적으로 ISR(revalidate 시간)을 도입한다면, 이 단언이 가장 먼저
  // 깨지므로 의식적으로 기대값을 갱신하게 된다(조용한 ISR/동적 creep 방지).
  it('모든 prerender 라우트는 순수 정적(initialRevalidateSeconds === false)이다', () => {
    const withRevalidate = Object.entries(manifest.routes)
      .filter(([, entry]) => entry.initialRevalidateSeconds !== false)
      .map(([route]) => route);
    expect(withRevalidate).toEqual([]);
  });
});
