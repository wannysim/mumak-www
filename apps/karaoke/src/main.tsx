import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ThemeProvider } from '@/components/theme-provider';
import { migrateLegacyLocalStorage } from '@/lib/client-storage';

import App from './app';
import { registerServiceWorker } from './register-sw';

import '@mumak/ui/globals.css';
import 'driver.js/dist/driver.css';
import './index.css';

import '@fontsource-variable/noto-serif-jp';

migrateLegacyLocalStorage();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
