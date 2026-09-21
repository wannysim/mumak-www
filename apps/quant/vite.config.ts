import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

import { publicConfiguration } from './src/lib/public-configuration.ts';

const FORBIDDEN_PUBLIC_NAME = /(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD|ACCESS_TOKEN)/i;

export default defineConfig(({ mode }) => {
  const environment = { ...process.env, ...loadEnv(mode, import.meta.dirname, '') };
  const forbidden = Object.keys(environment).filter(key => key.startsWith('VITE_') && FORBIDDEN_PUBLIC_NAME.test(key));
  if (forbidden.length > 0) {
    throw new Error(`Refusing to expose secret-like Vite variables: ${forbidden.join(', ')}`);
  }
  publicConfiguration(environment);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  };
});
