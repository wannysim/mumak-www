import { LoginScreen } from '@/components/login-screen';
import { NowPlayingExperience } from '@/components/now-playing-experience';
import { LoadingScreen } from '@/components/status-screen';
import { useAuth } from '@/hooks/use-auth';

/** 인증 상태에 따라 최상위 화면(로딩/로그인/재생 경험)만 가른다. */
export default function App() {
  const { status, isConfigured, signIn, signOut } = useAuth();

  if (status === 'initializing') {
    return <LoadingScreen />;
  }

  if (status !== 'authenticated') {
    return <LoginScreen isConfigured={isConfigured} onSignIn={signIn} />;
  }

  return <NowPlayingExperience onSignOut={signOut} />;
}
