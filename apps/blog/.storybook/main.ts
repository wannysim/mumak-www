import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  // Playwright owns axe scans in browser tests; the addon would start a competing run.
  // This flag is supplied by Playwright, outside cached Turbo tasks.
  // oxlint-disable-next-line turbo/no-undeclared-env-vars
  addons: process.env.STORYBOOK_BROWSER_TEST === '1' ? [] : ['@storybook/addon-a11y'],
  framework: '@storybook/nextjs-vite',
  core: { disableTelemetry: true },
  viteFinal: config =>
    mergeConfig(config, {
      server: {
        watch: {
          // Builds and test artifacts must not reset an in-progress keyboard comparison.
          ignored: [
            '**/.next/**',
            '**/storybook-static/**',
            '**/coverage/**',
            '**/test-results/**',
            '**/playwright-report/**',
          ],
        },
      },
    }),
};

export default config;
