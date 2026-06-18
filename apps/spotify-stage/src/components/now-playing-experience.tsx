import { LogOut } from 'lucide-react';
import { useEffect } from 'react';

import { AmbientBackground } from '@/components/ambient-background';
import { ControlPanel } from '@/components/control-panel';
import { NowPlayingStage } from '@/components/now-playing-stage';
import { IdleScreen, LoadingScreen } from '@/components/status-screen';
import { useAlbumPalette } from '@/hooks/use-album-palette';
import { useNowPlaying } from '@/hooks/use-now-playing';
import { useStageSettings } from '@/hooks/use-stage-settings';

/**
 * 인증된 사용자에게만 마운트되는 "재생 중" 경험.
 * 재생 데이터·팔레트·설정 훅을 여기서 소유하고(형제 컴포넌트들의 공통 부모),
 * App 은 인증 라우팅만 담당하도록 분리한다.
 */
export function NowPlayingExperience({ onSignOut }: { onSignOut: () => void }) {
  const { data, isLoading, needsReauth, fetchedAt } = useNowPlaying();
  const palette = useAlbumPalette(data?.albumImageUrl);
  const { settings, setAmbient, setThemeChoice, reset } = useStageSettings();

  // refresh token 이 폐기돼 재인증이 필요하면 상위에 알려 로그인 화면으로 되돌린다.
  useEffect(() => {
    if (needsReauth) {
      onSignOut();
    }
  }, [needsReauth, onSignOut]);

  if (isLoading && !data) {
    return <LoadingScreen />;
  }

  if (!data) {
    return <IdleScreen onSignOut={onSignOut} />;
  }

  return (
    <div className="relative min-h-svh w-full overflow-hidden">
      <AmbientBackground palette={palette} albumImageUrl={data.albumImageUrl} config={settings.ambient} />
      <NowPlayingStage nowPlaying={data} palette={palette} fetchedAt={fetchedAt} themeChoice={settings.themeChoice} />
      <ControlPanel
        settings={settings}
        realDeviceType={data.device?.type}
        onAmbientChange={setAmbient}
        onThemeChoiceChange={setThemeChoice}
        onReset={reset}
      />
      <button
        onClick={onSignOut}
        className="fixed right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full bg-black/30 text-white/70 backdrop-blur-md transition hover:bg-black/50 hover:text-white"
        aria-label="로그아웃"
        title="로그아웃"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
