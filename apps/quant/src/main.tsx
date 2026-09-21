import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app';
import { ThemeProvider } from '@/components/theme-provider';
import { createDashboardClient } from '@/lib/create-dashboard-client';

import '@mumak/ui/globals.css';
import './index.css';

const client = createDashboardClient(
  {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
  window.location.origin
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App client={client} />
    </ThemeProvider>
  </StrictMode>
);
