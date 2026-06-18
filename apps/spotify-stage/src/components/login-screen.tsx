import { Music4 } from 'lucide-react';

import { Button } from '@mumak/ui/components/button';

/**
 * 비로그인 화면. client_id 미설정 시 셋업 안내를 보여준다.
 */
export function LoginScreen({ isConfigured, onSignIn }: { isConfigured: boolean; onSignIn: () => void }) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-8 bg-zinc-950 p-6 text-center text-zinc-100">
      <div className="flex flex-col items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <Music4 className="size-8" aria-hidden="true" />
        </span>
        <h1 className="text-3xl font-bold">Spotify Stage</h1>
        <p className="max-w-sm text-balance text-zinc-400">
          지금 듣고 있는 곡을 재생 중인 기기에 맞는 무대로 보여줍니다. 앨범 아트 색이 화면 전체로 번집니다.
        </p>
      </div>

      {isConfigured ? (
        <Button
          size="lg"
          onClick={onSignIn}
          className="rounded-full bg-emerald-500 px-8 text-base font-semibold text-black hover:bg-emerald-400"
        >
          Spotify로 로그인
        </Button>
      ) : (
        <div className="max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left text-sm text-amber-200">
          <p className="font-semibold">설정이 필요합니다</p>
          <p className="mt-2 text-amber-200/80">
            <code className="rounded bg-black/30 px-1">.env.local</code>에{' '}
            <code className="rounded bg-black/30 px-1">VITE_SPOTIFY_CLIENT_ID</code>를 넣고, Spotify 대시보드의 Redirect
            URI에 현재 주소를 등록하세요. 자세한 절차는 README를 참고하세요.
          </p>
        </div>
      )}
    </main>
  );
}
