import type { StorybookConfig } from '@storybook/nextjs-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y'],
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
