import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'path';
import { defineConfig } from 'vite';

// MediaPipe wasm CDN URL을 설치된 JS 패키지 버전에 고정하기 위해 빌드 시점에 버전을 읽는다.
// 패키지 exports가 package.json을 노출하지 않아 경로로 직접 읽는다.
const mediapipeTasksVisionVersion: string = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, 'node_modules/@mediapipe/tasks-vision/package.json'), 'utf8')
).version;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __MEDIAPIPE_TASKS_VISION_VERSION__: JSON.stringify(mediapipeTasksVisionVersion),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
