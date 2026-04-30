import localFont from 'next/font/local';

import { ThemeMetaSyncScript, ThemeProvider } from '@/src/shared/lib/theme';

import '@mumak/ui/globals.css';
import './prism.css';

const pretendard = localFont({
  src: '../public/assets/fonts/PretendardVariable.woff2',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
  display: 'swap',
  weight: '45 920',
  variable: '--font-pretendard',
});

export { themeViewport as viewport } from '@/src/shared/lib/theme';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning className={pretendard.variable}>
      <head>
        <ThemeMetaSyncScript />
      </head>
      <body className="antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
