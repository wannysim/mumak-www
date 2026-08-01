import { ArrowLeft, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import { DrawerClose, DrawerDescription, DrawerTitle } from '@mumak/ui/components/drawer';

export function ShareHeader({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack?: () => void;
}) {
  const firstControlRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const control = firstControlRef.current;
    if (control?.closest('[role="dialog"]')) control.focus();
  }, [title]);

  return (
    <header className="border-border grid min-h-16 shrink-0 grid-cols-[3rem_1fr_3rem] items-center border-b px-1">
      {onBack ? (
        <Button
          ref={firstControlRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label="이전 화면"
          onClick={onBack}
          className="size-12"
        >
          <ArrowLeft className="size-4 stroke-[1.5]" />
        </Button>
      ) : (
        <DrawerClose asChild>
          <Button
            ref={firstControlRef}
            type="button"
            variant="ghost"
            size="icon"
            aria-label="공유 닫기"
            className="size-12"
          >
            <X className="size-4 stroke-[1.5]" />
          </Button>
        </DrawerClose>
      )}
      <div className="min-w-0 text-center">
        <DrawerTitle className="truncate">{title}</DrawerTitle>
        <DrawerDescription className="truncate text-xs">{description}</DrawerDescription>
      </div>
      <span aria-hidden="true" />
    </header>
  );
}
