// Dedicated, credential-free browser test build. Never replace production dist.
import { readFileSync } from 'node:fs';
import { build, preview } from 'vite';

// 프로덕션과 같은 응답 헤더를 E2E에도 적용한다. vercel.json이 단일 출처다.
// 이게 없으면 CSP가 걸러내는 결함(인라인 <style> 차단 등)이 E2E를 그대로 통과한다.
//
// upgrade-insecure-requests만 뺀다. 이 preview 서버는 http로 뜨는데, WebKit은
// Chromium과 달리 127.0.0.1을 이 지시어의 예외로 두지 않아 모든 자산 요청을
// https로 올려 버리고 앱이 아예 렌더되지 않는다. 스킴에만 걸리는 지시어라
// style-src·script-src 같은 실제 검증 대상은 그대로 남는다.
//
// 규칙마다 source 경로를 지킨다. /assets/(.*)의 immutable Cache-Control이 index.html에 붙으면
// 프로덕션과 다른 응답을 검증하게 된다. 여기서 쓰는 source(`/(.*)`, `/assets/(.*)`)는
// path-to-regexp 문법이지만 그대로 정규식으로 읽어도 같은 뜻이다. 겹치면 Vercel처럼 뒤 규칙이 이긴다.
const productionHeaderRules = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')).headers.map(
  ({ source, headers }) => ({
    pattern: new RegExp(`^${source}$`),
    headers: headers.map(({ key, value }) =>
      key.toLowerCase() === 'content-security-policy'
        ? {
            key,
            value: value
              .split(';')
              .filter(directive => directive.trim() !== 'upgrade-insecure-requests')
              .join(';'),
          }
        : { key, value }
    ),
  })
);

const productionHeadersPlugin = {
  name: 'e2e-production-headers',
  configurePreviewServer(server) {
    server.middlewares.use((request, response, next) => {
      const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1');
      for (const rule of productionHeaderRules) {
        if (!rule.pattern.test(pathname)) continue;
        for (const { key, value } of rule.headers) response.setHeader(key, value);
      }
      next();
    });
  },
};

await build({
  mode: 'e2e',
  build: { outDir: 'dist-e2e' },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://quant-e2e.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('sb_publishable_test_only'),
  },
});
await preview({
  mode: 'e2e',
  build: { outDir: 'dist-e2e' },
  plugins: [productionHeadersPlugin],
  preview: { port: 3007, strictPort: true, host: '127.0.0.1' },
});
