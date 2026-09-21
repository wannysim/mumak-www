// Dedicated, credential-free browser test build. Never replace production dist.
import { build, preview } from 'vite';

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
  preview: { port: 3007, strictPort: true, host: '127.0.0.1' },
});
