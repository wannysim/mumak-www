import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ThemeProvider } from '@/components/theme-provider';
import { migrateLegacyLocalStorage } from '@/lib/client-storage';

import App from './app';
import { registerServiceWorker } from './register-sw';

import '@mumak/ui/globals.css';
import 'driver.js/dist/driver.css';
import './index.css';

migrateLegacyLocalStorage();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);

// Noto Serif JP @font-face(unicode-range 조각 120여 개)는 전체 CSS의 절반이 넘는다.
// 정적 import면 첫 렌더를 막는 CSS에 합쳐지므로, 동적 import로 별도 CSS를 비동기로 붙인다.
// 스크립트가 삽입한 stylesheet는 렌더를 막지 않고, font-display: swap이라 그 전까지는
// --font-japanese의 대체 서체로 그린다. load 이벤트 전에 삽입되므로 register-sw의 방문 폰트 캐시에도 잡힌다.
import('@fontsource-variable/noto-serif-jp').catch(() => {
  // 폰트 CSS를 못 받아도 대체 서체로 그려질 뿐 앱 동작에는 영향이 없다.
});
