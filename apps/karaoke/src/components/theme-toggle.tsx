import { Moon, Sun } from 'lucide-react';

import { Button } from '@mumak/ui/components/button';

import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const Icon = isDark ? Moon : Sun;
  const action = isDark ? '화면 밝게' : '화면 어둡게';

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground size-11 rounded-none hover:bg-transparent"
      aria-label={action}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <Icon className="size-3.5 stroke-[1.5]" />
    </Button>
  );
}
