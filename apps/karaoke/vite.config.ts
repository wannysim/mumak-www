import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

import { assertNoShippedLyrics, filesRecursively } from './scripts/no-shipped-lyrics.mjs';

function localOnlyBuildGuard(): Plugin {
  const appRoot = __dirname;
  const outputDirectory = path.join(appRoot, 'dist');

  return {
    name: 'karaoke-local-only-build-guard',
    buildStart() {
      assertNoShippedLyrics(path.join(appRoot, 'public'), 'public');
    },
    closeBundle() {
      assertNoShippedLyrics(outputDirectory, 'dist');

      const serviceWorkerPath = path.join(outputDirectory, 'sw.js');
      const outputFiles = filesRecursively(outputDirectory);
      const precacheFiles = outputFiles
        .filter(filePath => !filePath.endsWith('index.html') && !filePath.endsWith('sw.js'))
        // Noto Serif JP는 unicode-range 파일이 100개가 넘는다. 전부 설치 시점에 받지 않고,
        // 첫 화면에서 브라우저가 실제로 선택한 조각만 register-sw가 서비스워커에 넘긴다.
        .filter(filePath => !/\.woff2$/i.test(filePath))
        .toSorted();
      const precacheUrls = [
        '/',
        ...precacheFiles.map(filePath => `/${path.relative(outputDirectory, filePath).split(path.sep).join('/')}`),
      ];
      const buildHash = createHash('sha256');
      for (const filePath of [path.join(outputDirectory, 'index.html'), ...precacheFiles]) {
        buildHash.update(path.relative(outputDirectory, filePath));
        buildHash.update(readFileSync(filePath));
      }
      const buildId = buildHash.digest('hex').slice(0, 12);
      const serviceWorker = readFileSync(serviceWorkerPath, 'utf8');
      const precacheMarker = "const PRECACHE_URLS = ['/', '/manifest.webmanifest'];";
      const buildMarker = "const BUILD_ID = 'dev';";
      if (!serviceWorker.includes(precacheMarker) || !serviceWorker.includes(buildMarker)) {
        throw new Error('서비스워커 build marker를 찾지 못했습니다.');
      }
      writeFileSync(
        serviceWorkerPath,
        serviceWorker
          .replace(buildMarker, `const BUILD_ID = '${buildId}';`)
          .replace(precacheMarker, `const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};`)
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), localOnlyBuildGuard()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
