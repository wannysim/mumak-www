// Dedicated, credential-free browser test build. Never replace production dist.
import { readFileSync } from 'node:fs';
import { build, preview } from 'vite';

// 프로덕션과 같은 응답 헤더를 E2E에도 적용한다. vercel.json이 단일 출처다.
// 이게 없으면 CSP가 걸러내는 결함(인라인 <style> 차단 등)이 E2E를 그대로 통과한다.
const productionHeaders = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')).headers.flatMap(
  entry => entry.headers
);

const productionHeadersPlugin = {
  name: 'e2e-production-headers',
  configurePreviewServer(server) {
    server.middlewares.use((_request, response, next) => {
      for (const { key, value } of productionHeaders) response.setHeader(key, value);
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
