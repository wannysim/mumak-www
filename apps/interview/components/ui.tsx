import { ArrowUpRight, Route } from 'lucide-react';

import { Button } from '@mumak/ui/components/button';

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-2xl bg-primary text-white">
        <Route className="size-5" aria-hidden />
      </span>
      <div>
        <span className="block text-lg leading-6 font-bold tracking-tight">다음 정거장</span>
        <span className="text-[11px] font-medium text-muted-foreground">나만의 면접 연습실</span>
      </div>
    </div>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="mb-3 text-xs font-medium text-muted-foreground">{eyebrow}</p>
        <h1 tabIndex={-1} className="text-3xl leading-tight font-bold tracking-tight outline-none sm:text-4xl">
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}
export function EmptyState({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed p-8 text-center">
      <Route aria-hidden className="mx-auto mb-4 size-7 text-primary" />
      <h3 className="font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{text}</p>
      {action && (
        <Button variant="outline" onClick={onAction} className="mt-5 h-11">
          {action}
          <ArrowUpRight aria-hidden />
        </Button>
      )}
    </div>
  );
}
