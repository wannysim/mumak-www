import { CircleHelp } from 'lucide-react';

import { Button } from '@mumak/ui/components/button';

export function UnsureButton({
  onClick,
  disabled,
  showSolution,
}: {
  onClick: () => void;
  disabled?: boolean;
  showSolution?: boolean;
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="h-12 rounded-xl border-primary/50 bg-accent px-3 font-semibold text-primary hover:bg-secondary hover:text-primary"
    >
      <CircleHelp aria-hidden className="size-4" />
      {showSolution ? '잘 모르겠어요 · 풀이 보기' : '잘 모르겠어요'}
    </Button>
  );
}
