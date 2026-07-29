import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ThemeProvider } from '@/components/theme-provider';

import App from './app';
import { registerServiceWorker } from './register-sw';

import '@mumak/ui/globals.css';
import './index.css';

import '@fontsource-variable/noto-serif-jp';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider storageKey="karaoke:theme">
      <App />
    </ThemeProvider>
  </StrictMode>
);
