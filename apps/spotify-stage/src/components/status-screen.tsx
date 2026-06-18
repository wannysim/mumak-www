import { Loader2, Music } from 'lucide-react';

/** 부팅/로딩 중 화면. */
export function LoadingScreen() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-zinc-950 text-zinc-400">
      <Loader2 className="size-8 animate-spin" aria-label="불러오는 중" />
    </main>
  );
}

/** 인증됐지만 재생 중인 곡이 없을 때. */
export function IdleScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-5 bg-zinc-950 p-6 text-center text-zinc-300">
      <Music className="size-10 opacity-50" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium">지금 재생 중인 곡이 없어요</p>
        <p className="text-sm text-zinc-500">Spotify에서 아무 곡이나 재생하면 이 화면이 무대로 바뀝니다.</p>
      </div>
      <button onClick={onSignOut} className="text-xs text-zinc-500 underline-offset-4 hover:underline">
        로그아웃
      </button>
    </main>
  );
}
