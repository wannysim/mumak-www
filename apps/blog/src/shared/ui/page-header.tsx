import * as React from 'react';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header data-slot="page-header" className="space-y-1.5">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {description && <p className="text-base text-muted-foreground">{description}</p>}
    </header>
  );
}
