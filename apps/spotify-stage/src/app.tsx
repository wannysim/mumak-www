import { LogOut } from 'lucide-react';
import { useEffect } from 'react';

import { AmbientBackground } from '@/components/ambient-background';
import { ControlPanel } from '@/components/control-panel';
import { LoginScreen } from '@/components/login-screen';
import { NowPlayingStage } from '@/components/now-playing-stage';
import { IdleScreen, LoadingScreen } from '@/components/status-screen';
import { useAlbumPalette } from '@/hooks/use-album-palette';
import { useAuth } from '@/hooks/use-auth';
import { useNowPlaying } from '@/hooks/use-now-playing';
import { useStageSettings } from '@/hooks/use-stage-settings';

export default function App() {
  const { status, isConfigured, signIn, signOut } = useAuth();
  const isAuthed = status === 'authenticated';

  const { data, isLoading, needsReauth, fetchedAt } = useNowPlaying({ enabled: isAuthed });
  const palette = useAlbumPalette(data?.albumImageUrl);
  const { settings, setAmbient, setThemeChoice, reset } = useStageSettings();

  // refresh token 이 폐기돼 재인증이 필요하면 세션을 비우고 로그인 화면으로.
  useEffect(() => {
    if (needsReauth) {
      signOut();
    }
  }, [needsReauth, signOut]);

  if (status === 'initializing') {
    return <LoadingScreen />;
  }

  if (!isAuthed) {
    return <LoginScreen isConfigured={isConfigured} onSignIn={signIn} />;
  }

  if (isLoading && !data) {
    return <LoadingScreen />;
  }

  if (!data) {
    return <IdleScreen onSignOut={signOut} />;
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
        onClick={signOut}
        className="fixed right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full bg-black/30 text-white/70 backdrop-blur-md transition hover:bg-black/50 hover:text-white"
        aria-label="로그아웃"
        title="로그아웃"
      >
        <LogOut className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
