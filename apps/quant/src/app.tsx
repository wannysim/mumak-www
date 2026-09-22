import { LogOut, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@mumak/ui/components/button';
import { Input } from '@mumak/ui/components/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@mumak/ui/components/select';

import { Panel, SnapshotDashboard } from '@/components/dashboard-sections';
import { ThemeToggle } from '@/components/theme-toggle';
import { TimeZoneProvider } from '@/components/time-zone-provider';
import { TimeZoneSelect } from '@/components/time-zone-select';
import { useDashboardController } from '@/hooks/use-dashboard-controller';
import type { DashboardClient } from '@/lib/dashboard-client';
import type { DashboardMode } from '@/lib/dashboard-schema';

function AppHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span
            className="hidden size-8 place-items-center sm:grid border border-primary bg-primary font-mono text-sm font-bold text-primary-foreground"
            aria-hidden="true"
          >
            Q
          </span>
          <div>
            <h1 className="text-sm font-semibold tracking-tight sm:text-base">퀀트 대시보드</h1>
            <p className="hidden text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground sm:block">
              Portfolio overview
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TimeZoneSelect />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function ModeTabs({ mode, onChange }: { mode: DashboardMode; onChange: (mode: DashboardMode) => void }) {
  return (
    <div role="tablist" aria-label="포트폴리오 모드" className="grid grid-cols-2 border border-border bg-card p-1">
      {(
        [
          ['paper', '모의 운용'],
          ['live', '실운용'],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          className="min-h-10 px-4 text-sm font-medium text-muted-foreground transition-[color,background-color,transform] duration-150 ease-out aria-selected:bg-primary aria-selected:text-primary-foreground active:scale-[0.97]"
          onClick={() => onChange(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StatePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Panel className="grid min-h-64 place-items-center p-6 text-center">
      <div className="max-w-md">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-3 text-sm leading-6 text-muted-foreground">{children}</div>
      </div>
    </Panel>
  );
}

function LoginPanel({ requestMagicLink }: { requestMagicLink: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await requestMagicLink(email);
    } catch {
      // The response stays deliberately identical so the UI cannot enumerate owner accounts.
    } finally {
      setMessage('로그인 요청을 처리했습니다. 등록된 계정이라면 이메일을 확인해 주세요.');
      setSubmitting(false);
    }
  }

  return (
    <Panel className="mx-auto max-w-lg p-5 sm:p-8">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-primary">Owner access</p>
      <h2 className="mt-3 text-xl font-semibold">실운용 내역 로그인</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        등록된 소유자 이메일로 일회용 로그인 링크를 보냅니다. 접근 권한은 화면이 아니라 데이터베이스 RLS에서 확인됩니다.
      </p>
      <form className="mt-6 space-y-3" onSubmit={submit}>
        <label className="block text-xs font-medium" htmlFor="owner-email">
          이메일
        </label>
        <Input
          id="owner-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={event => setEmail(event.target.value)}
          className="h-11 rounded-none"
        />
        <Button type="submit" className="h-11 w-full rounded-none" disabled={submitting}>
          {submitting ? '요청 중…' : '로그인 링크 받기'}
        </Button>
      </form>
      {message && (
        <p role="status" className="mt-4 border-l-2 border-primary pl-3 text-sm leading-6 text-foreground">
          {message}
        </p>
      )}
    </Panel>
  );
}

function DashboardToolbar({ controller }: { controller: ReturnType<typeof useDashboardController> }) {
  const snapshot = controller.selectedSnapshot;
  return (
    <div className="grid gap-4 border border-border bg-card p-4 xl:grid-cols-[minmax(0,1fr)_minmax(28rem,auto)] xl:items-end sm:p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{snapshot?.label}</h2>
          {snapshot && (
            <span className="border border-border bg-muted px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted-foreground">
              {snapshot.status === 'active' ? '운용 중' : snapshot.status === 'stopped' ? '중단' : '완료'}
            </span>
          )}
        </div>
        {snapshot && (
          <p className="mt-2 text-sm text-muted-foreground">
            {snapshot.baselineKind === 'inception' ? '운용 시작월 · 부분 월' : '월초 기준 · 전체 월'} ·{' '}
            {snapshot.episodeId}
          </p>
        )}
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
        <div className="col-span-2 grid min-w-0 gap-1.5 text-xs text-muted-foreground sm:col-span-1">
          <label htmlFor="episode-select">에피소드</label>
          <Select value={controller.selectedEpisodeId ?? ''} onValueChange={controller.selectEpisode}>
            <SelectTrigger
              id="episode-select"
              aria-label="에피소드"
              className="min-h-11 w-full rounded-none text-left whitespace-normal data-[size=default]:h-auto [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:break-words"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">
              <SelectGroup>
                {controller.episodes.map(episode => (
                  <SelectItem key={episode.id} value={episode.id} className="whitespace-normal break-words">
                    {episode.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-0 gap-1.5 text-xs text-muted-foreground">
          <label htmlFor="month-select">조회 월</label>
          <Select value={controller.selectedMonth ?? ''} onValueChange={controller.selectMonth}>
            <SelectTrigger
              id="month-select"
              aria-label="조회 월"
              className="min-h-11 w-full rounded-none text-left data-[size=default]:h-auto"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-w-[calc(100vw-2rem)]">
              <SelectGroup>
                {controller.months.map(month => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 rounded-none"
          aria-label="새로고침"
          onClick={() => void controller.refresh()}
        >
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function ConfiguredApp({ client }: { client: DashboardClient }) {
  const controller = useDashboardController(client);
  const [signOutError, setSignOutError] = useState('');
  let content: React.ReactNode;

  if (controller.mode === 'live' && controller.authStatus === 'loading') {
    content = <StatePanel title="세션을 확인하고 있습니다.">잠시만 기다려 주세요.</StatePanel>;
  } else if (controller.mode === 'live' && controller.authStatus === 'anonymous') {
    content = <LoginPanel requestMagicLink={controller.requestMagicLink} />;
  } else if (controller.data.status === 'loading' && !controller.selectedSnapshot) {
    content = (
      <StatePanel title="운용 내역을 불러오고 있습니다.">페이지가 보이는 동안에만 안전하게 갱신합니다.</StatePanel>
    );
  } else if (controller.data.status === 'error') {
    content = (
      <StatePanel title="운용 내역을 불러오지 못했습니다.">
        연결 상태를 확인한 뒤 다시 시도해 주세요. 기존 실운용 데이터는 표시하지 않습니다.
      </StatePanel>
    );
  } else if (controller.data.status === 'empty') {
    content = (
      <StatePanel
        title={controller.mode === 'live' ? '실운용 내역이 아직 없습니다.' : '모의 운용 내역이 아직 없습니다.'}
      >
        첫 월간 운용 내역이 저장되면 여기에 표시됩니다.
      </StatePanel>
    );
  } else if (controller.selectedSnapshot) {
    content = (
      <>
        <DashboardToolbar controller={controller} />
        <SnapshotDashboard snapshot={controller.selectedSnapshot} />
      </>
    );
  } else {
    content = <StatePanel title="표시할 데이터가 없습니다.">선택한 모드에 저장된 운용 내역이 없습니다.</StatePanel>;
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-[90rem] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(18rem,28rem)_1fr] sm:items-center">
          <ModeTabs mode={controller.mode} onChange={controller.selectMode} />
          <p className="text-xs leading-5 text-muted-foreground sm:text-right">
            페이지가 보일 때 60초마다 운용 내역 갱신 · 실시간 체결 화면 아님
          </p>
        </div>
        {controller.authStatus === 'authenticated' && (
          <div className="mb-4 flex justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              onClick={() => {
                setSignOutError('');
                void controller
                  .signOut()
                  .catch(() =>
                    setSignOutError(
                      '로그아웃 요청을 완료하지 못했습니다. 공유 기기에서는 브라우저의 사이트 데이터를 지워 주세요.'
                    )
                  );
              }}
            >
              <LogOut aria-hidden="true" />
              로그아웃
            </Button>
          </div>
        )}
        {signOutError && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {signOutError}
          </p>
        )}
        <div className="space-y-5 sm:space-y-6">{content}</div>
      </main>
    </>
  );
}

function UnconfiguredApp() {
  const [mode, setMode] = useState<DashboardMode>('paper');
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <ModeTabs mode={mode} onChange={setMode} />
        <div className="mt-5">
          {mode === 'paper' ? (
            <StatePanel title="대시보드가 아직 연결되지 않았습니다.">
              <code>VITE_SUPABASE_URL</code>과 <code>VITE_SUPABASE_ANON_KEY</code>를 배포 환경에 설정해 주세요. 비밀
              키나 실운용 데이터는 빌드에 넣지 않습니다.
            </StatePanel>
          ) : (
            <StatePanel title="실운용 로그인을 사용할 수 없습니다.">
              Supabase 공개 환경 설정이 완료되어야 소유자 magic-link 로그인을 시작할 수 있습니다.
            </StatePanel>
          )}
        </div>
      </main>
    </>
  );
}

function App({ client }: { client: DashboardClient | null }) {
  return <TimeZoneProvider>{client ? <ConfiguredApp client={client} /> : <UnconfiguredApp />}</TimeZoneProvider>;
}

export { App };
