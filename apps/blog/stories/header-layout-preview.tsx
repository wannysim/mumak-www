import { ArrowLeft, Globe, Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, type ComponentProps } from 'react';

import { Button } from '@mumak/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@mumak/ui/components/command';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@mumak/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@mumak/ui/components/dropdown-menu';
import { IconButton } from '@mumak/ui/components/icon-button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@mumak/ui/components/sheet';
import { cn } from '@mumak/ui/lib/utils';

export type HeaderCandidate = 'current' | 'targets' | 'home';
type Destination = 'home' | 'blog' | 'garden';
type PreviewProps = {
  candidate: HeaderCandidate;
  showTargets: boolean;
  theme: 'light' | 'dark';
  onGlobalsChange: (globals: { theme?: string; locale?: string }) => void;
};

// Preserve A as the historical baseline; B/C exercise the shared product primitive.
function LabIconButton({
  expanded,
  children,
  className,
  surfaceSize = 'small',
  ...props
}: Omit<ComponentProps<typeof Button>, 'asChild'> & {
  expanded: boolean;
  surfaceSize?: 'small' | 'back';
}) {
  if (expanded) {
    return (
      <IconButton
        {...props}
        aria-label={props['aria-label'] ?? ''}
        data-lab-target=""
        className={className}
        surfaceSize={surfaceSize === 'back' ? 'lg' : 'sm'}
        surfaceClassName={
          surfaceSize === 'back'
            ? 'bg-background/60 backdrop-blur-sm [@media(hover:hover)]:group-hover/button:bg-background/80'
            : undefined
        }
      >
        {children}
      </IconButton>
    );
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      {...props}
      data-lab-target=""
      className={cn(
        surfaceSize === 'back' && 'size-9 bg-background/60 backdrop-blur-sm hover:bg-background/80',
        className
      )}
    >
      {children}
    </Button>
  );
}

function PreviewSwitchers({
  expanded,
  theme,
  onGlobalsChange,
}: Pick<PreviewProps, 'theme' | 'onGlobalsChange'> & { expanded: boolean }) {
  const t = useTranslations('common');
  const locale = useLocale();
  return (
    <>
      {(['theme', 'locale'] as const).map(kind => (
        <DropdownMenu key={kind}>
          <DropdownMenuTrigger asChild>
            <LabIconButton expanded={expanded} aria-label={t(kind === 'theme' ? 'changeTheme' : 'changeLanguage')}>
              {kind === 'locale' ? <Globe /> : theme === 'dark' ? <Moon /> : <Sun />}
            </LabIconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className={theme === 'dark' ? 'dark' : undefined}>
            <DropdownMenuRadioGroup
              value={kind === 'theme' ? theme : locale}
              onValueChange={value => onGlobalsChange({ [kind]: value })}
            >
              {(kind === 'theme'
                ? [
                    ['light', 'Light'],
                    ['dark', 'Dark'],
                  ]
                : [
                    ['ko', '한국어'],
                    ['en', 'English'],
                  ]
              ).map(([value, label]) => (
                <DropdownMenuRadioItem key={value} value={value!}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </>
  );
}

function PreviewMenu({
  candidate,
  theme,
  route,
  onNavigate,
}: Pick<PreviewProps, 'candidate' | 'theme'> & { route: Destination; onNavigate: (route: Destination) => void }) {
  const t = useTranslations('common');
  const lab = useTranslations('headerLayoutLab');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const expanded = candidate !== 'current';
  const items: Destination[] = candidate === 'home' ? ['home', 'blog', 'garden'] : ['blog', 'garden'];
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <LabIconButton expanded={expanded} aria-label={t('openNavigation')}>
          <Menu className="size-5" />
        </LabIconButton>
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className={cn('w-56 border-r p-6 motion-reduce:animate-none', theme === 'dark' && 'dark')}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t('navigation')}</SheetTitle>
          <SheetDescription>{lab('menuHint')}</SheetDescription>
        </SheetHeader>
        <LabIconButton
          expanded={expanded}
          className="absolute top-3 right-3"
          aria-label={t('close')}
          onClick={() => setOpen(false)}
        >
          <X />
        </LabIconButton>
        <nav aria-label={t('navigation')} className="mt-10 flex flex-col gap-4">
          {items.map(item => (
            <a
              key={item}
              href={`/${locale}${item === 'home' ? '' : `/${item}`}`}
              aria-current={route === item ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center rounded text-2xl font-semibold transition-colors',
                route === item ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={event => {
                event.preventDefault();
                onNavigate(item);
                setOpen(false);
              }}
            >
              {item === 'home' ? lab('homeLabel') : t(item)}
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function PreviewSearch({
  expanded,
  theme,
  onNavigate,
}: Pick<PreviewProps, 'theme'> & { expanded: boolean; onNavigate: (route: Destination) => void }) {
  const t = useTranslations('search');
  const common = useTranslations('common');
  const lab = useTranslations('headerLayoutLab');
  const [open, setOpen] = useState(false);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const desktopTrigger = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <LabIconButton ref={mobileTrigger} expanded={expanded} className="sm:hidden" aria-label={t('aria')}>
          <Search />
        </LabIconButton>
      </DialogTrigger>
      <DialogTrigger asChild>
        <Button
          ref={desktopTrigger}
          type="button"
          variant="outline"
          size="lg"
          className="hidden justify-start sm:flex sm:w-44 lg:w-56"
          aria-label={t('aria')}
        >
          <Search data-icon="inline-start" />
          {t('placeholder')}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className={cn('motion-reduce:animate-none', theme === 'dark' && 'dark')}
        onCloseAutoFocus={event => {
          event.preventDefault();
          // Both responsive triggers exist; Radix's shared ref otherwise ends on the hidden one.
          const trigger = mobileTrigger.current?.getClientRects().length
            ? mobileTrigger.current
            : desktopTrigger.current;
          trigger?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{lab('searchHint')}</DialogDescription>
        </DialogHeader>
        <DialogClose asChild>
          <LabIconButton expanded={expanded} className="absolute top-1 right-1" aria-label={common('close')}>
            <X />
          </LabIconButton>
        </DialogClose>
        <Command>
          <CommandInput placeholder={t('placeholder')} aria-label={t('aria')} />
          <CommandList>
            <CommandEmpty>
              <span role="option" aria-selected={false} aria-disabled="true">
                {t('empty')}
              </span>
            </CommandEmpty>
            <CommandGroup heading={lab('samplePages')}>
              {(['home', 'blog', 'garden'] as const).map(item => (
                <CommandItem
                  key={item}
                  onSelect={() => {
                    onNavigate(item);
                    setOpen(false);
                  }}
                >
                  {item === 'home' ? lab('homeLabel') : common(item)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

export function HeaderLayoutPreview({ candidate, showTargets, theme, onGlobalsChange }: PreviewProps) {
  const common = useTranslations('common');
  const t = useTranslations('headerLayoutLab');
  const locale = useLocale();
  const [route, setRoute] = useState<Destination>('blog');
  const [lastAction, setLastAction] = useState<Destination>();
  const expanded = candidate !== 'current';
  const items: Destination[] = candidate === 'home' ? ['home', 'blog', 'garden'] : ['blog', 'garden'];
  function navigate(destination: Destination) {
    setRoute(destination);
    setLastAction(destination);
  }
  return (
    <section aria-label={t(`${candidate}Title`)} className="flex flex-col gap-4">
      <div className="px-4 sm:px-6">
        <h2 className="text-xl font-semibold">{t(`${candidate}Title`)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t(`${candidate}Description`)}</p>
      </div>
      <div data-slot="layout-preview" data-targets={showTargets} className="border-y border-border">
        <nav aria-label={t('header')} className="border-b border-border">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div data-slot="preview-header" className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="md:hidden">
                  <PreviewMenu candidate={candidate} theme={theme} route={route} onNavigate={navigate} />
                </div>
                {candidate !== 'home' && (
                  <a
                    href={`/${locale}`}
                    className="whitespace-nowrap text-xl font-bold"
                    onClick={event => {
                      event.preventDefault();
                      navigate('home');
                    }}
                  >
                    Wan Sim
                  </a>
                )}
                <div className="hidden items-center gap-4 md:flex">
                  {items.map(item => (
                    <a
                      key={item}
                      href={`/${locale}${item === 'home' ? '' : `/${item}`}`}
                      aria-current={route === item ? 'page' : undefined}
                      className={cn(
                        'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                        expanded && 'min-h-11',
                        route === item ? 'bg-muted font-medium' : 'hover:bg-muted/50'
                      )}
                      onClick={event => {
                        event.preventDefault();
                        navigate(item);
                      }}
                    >
                      {item === 'home' ? t('homeLabel') : common(item)}
                    </a>
                  ))}
                </div>
              </div>
              <div className={cn('flex items-center', expanded ? 'gap-1' : 'gap-2')}>
                <PreviewSearch expanded={expanded} theme={theme} onNavigate={navigate} />
                <PreviewSwitchers expanded={expanded} theme={theme} onGlobalsChange={onGlobalsChange} />
              </div>
            </div>
          </div>
        </nav>
        <div className="flex min-h-36 flex-col justify-center gap-2 px-4 py-6 sm:px-6">
          <p className="text-xs text-muted-foreground">{t('sampleContent')}</p>
          <h3 className="text-2xl font-semibold">{route === 'home' ? 'Wan Sim' : common(route)}</h3>
          <p className="text-sm text-muted-foreground">{t(`${route}Body`)}</p>
        </div>
        <div aria-label={t('graphToolbar')} role="group" className="relative h-24 border-t border-border bg-muted/30">
          <div className="absolute inset-x-3 top-3 flex items-center justify-between">
            <LabIconButton
              expanded={expanded}
              surfaceSize="back"
              aria-label={t('back')}
              onClick={() => navigate('blog')}
            >
              <ArrowLeft />
            </LabIconButton>
            <div className="flex items-center gap-1">
              <PreviewSwitchers expanded={expanded} theme={theme} onGlobalsChange={onGlobalsChange} />
            </div>
          </div>
          <p className="absolute bottom-2 left-4 text-xs text-muted-foreground">{t('graphToolbar')}</p>
        </div>
      </div>
      <p role="status" aria-atomic="true" className="min-h-6 px-4 text-sm text-muted-foreground sm:px-6">
        {lastAction
          ? t('navigated', { destination: lastAction === 'home' ? t('homeLabel') : common(lastAction) })
          : t('tryNavigation')}
      </p>
    </section>
  );
}
