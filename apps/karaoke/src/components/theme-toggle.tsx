import { Moon, Sun } from 'lucide-react';

import { Button } from '@mumak/ui/components/button';

import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const Icon = isDark ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11"
      aria-label={isDark ? '라이트 테마로 전환' : '다크 테마로 전환'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <Icon className="size-5" />
    </Button>
  );
}
