import { useCallback, useEffect, useState } from 'react';

import { clearSession, handleRedirectCallback, hasClientId, isAuthenticated, login } from '@/lib/spotify/auth';

type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated';

interface UseAuthReturn {
  status: AuthStatus;
  /** VITE_SPOTIFY_CLIENT_ID 미설정 여부 (설정 안내용). */
  isConfigured: boolean;
  /** authorize 리다이렉트 시작. */
  signIn: () => void;
  /** 토큰 폐기 후 로그아웃 상태로. */
  signOut: () => void;
}

/**
 * 앱 진입 시 리다이렉트 콜백(?code=)을 처리하고 인증 상태를 노출한다.
 */
export function useAuth(): UseAuthReturn {
  const [status, setStatus] = useState<AuthStatus>('initializing');

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const result = await handleRedirectCallback();
      if (cancelled) {
        return;
      }
      const authed = result === 'authenticated' || isAuthenticated();
      setStatus(authed ? 'authenticated' : 'unauthenticated');
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(() => {
    login().catch(() => setStatus('unauthenticated'));
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setStatus('unauthenticated');
  }, []);

  return { status, isConfigured: hasClientId(), signIn, signOut };
}
