import type { Preview } from '@storybook/nextjs-vite';
import { NextIntlClientProvider } from 'next-intl';

import en from '@/messages/en.json';
import ko from '@/messages/ko.json';
import { LabThemeContext } from '@/stories/lab-theme';

import '@mumak/ui/globals.css';
import './preview.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Component theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      toolbar: {
        title: 'Language',
        items: [
          { value: 'ko', title: '한국어' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: 'ko', theme: 'light' },
  parameters: {
    layout: 'fullscreen',
    options: { storySort: { order: ['Start', 'Foundations', 'Components', 'Learning'] } },
    nextjs: { appDirectory: true, navigation: { pathname: '/ko/blog' } },
    a11y: { test: 'todo' },
  },
  decorators: [
    (Story, context) => {
      const locale = context.globals.locale === 'en' ? 'en' : 'ko';
      const theme = context.globals.theme === 'dark' ? 'dark' : 'light';
      return (
        <NextIntlClientProvider locale={locale} messages={locale === 'ko' ? ko : en} timeZone="Asia/Seoul">
          <LabThemeContext value={theme}>
            <div lang={locale} className={theme === 'dark' ? 'dark' : undefined} style={{ colorScheme: theme }}>
              <Story />
            </div>
          </LabThemeContext>
        </NextIntlClientProvider>
      );
    },
  ],
};

export default preview;
