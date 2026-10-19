'use client';

import * as React from 'react';

import { Button } from '@mumak/ui/components/button';
import { Input } from '@mumak/ui/components/input';
import { Label } from '@mumak/ui/components/label';
import { Spinner } from '@mumak/ui/components/spinner';

import { ImageLibrary } from '@/components/image-library';
import { ImageUploadForm } from '@/components/image-upload-form';

export function AdminSession({ initialAuthenticated }: { initialAuthenticated: boolean }) {
  const [uploading, setUploading] = React.useState(false);
  const [view, setView] = React.useState<'upload' | 'library'>('upload');
  const [authenticated, setAuthenticated] = React.useState(initialAuthenticated);
  const [token, setToken] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const loginPending = React.useRef(false);
  const focusAfterLogin = React.useRef(false);
  const logoutButton = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (authenticated && focusAfterLogin.current) {
      logoutButton.current?.focus();
      focusAfterLogin.current = false;
    }
  }, [authenticated]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || loginPending.current) return;
    loginPending.current = true;
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok)
        throw new Error(
          response.status === 401 ? '토큰이 올바르지 않습니다.' : '로그인하지 못했습니다. 다시 시도하세요.'
        );
      setToken('');
      focusAfterLogin.current = true;
      setAuthenticated(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '로그인하지 못했습니다. 다시 시도하세요.');
    } finally {
      loginPending.current = false;
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok) throw new Error('로그아웃하지 못했습니다. 다시 시도하세요.');
      setAuthenticated(false);
      setToken('');
    } catch {
      setMessage('로그아웃하지 못했습니다. 다시 시도하세요.');
    } finally {
      setPending(false);
    }
  }

  const sessionExpired = React.useCallback(() => {
    setAuthenticated(false);
    setToken('');
    setMessage('로그인이 만료되었습니다. 다시 로그인하세요.');
  }, []);

  return (
    <div className="space-y-4">
      {authenticated ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">로그인됨</p>
            <Button ref={logoutButton} type="button" variant="outline" disabled={pending || uploading} onClick={logout}>
              로그아웃
            </Button>
          </div>
          <div className="flex gap-2" role="group" aria-label="이미지 관리 메뉴">
            <Button
              type="button"
              variant={view === 'upload' ? 'default' : 'outline'}
              disabled={uploading}
              aria-pressed={view === 'upload'}
              onClick={() => setView('upload')}
            >
              이미지 업로드
            </Button>
            <Button
              type="button"
              variant={view === 'library' ? 'default' : 'outline'}
              disabled={uploading}
              aria-pressed={view === 'library'}
              onClick={() => setView('library')}
            >
              이미지 보관함
            </Button>
          </div>
          <div hidden={view !== 'upload'}>
            <ImageUploadForm onSessionExpired={sessionExpired} onUploadingChange={setUploading} />
          </div>
          {view === 'library' && <ImageLibrary onSessionExpired={sessionExpired} />}
        </>
      ) : (
        <form className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm" onSubmit={login}>
          <h2 className="text-lg font-semibold">관리자 로그인</h2>
          <p className="text-sm text-muted-foreground">한 번 로그인하면 이 브라우저에서 7일간 유지됩니다.</p>
          <div className="space-y-2">
            <Label htmlFor="login-token">업로드 토큰</Label>
            <Input
              id="login-token"
              type="password"
              autoComplete="off"
              required
              readOnly={pending}
              value={token}
              onChange={event => setToken(event.target.value)}
            />
          </div>
          <Button
            className="relative w-full aria-disabled:cursor-wait"
            type="submit"
            disabled={!token && !pending}
            aria-disabled={pending}
            aria-busy={pending}
          >
            <span className={pending ? 'invisible' : undefined} aria-hidden={pending || undefined}>
              로그인
            </span>
            {pending && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Spinner
                  aria-hidden="true"
                  role="presentation"
                  aria-label={undefined}
                  className="motion-reduce:animate-none"
                />
                <span className="sr-only">로그인 중…</span>
              </span>
            )}
          </Button>
        </form>
      )}
      <p role="status" aria-atomic="true" className="min-h-5 text-sm text-muted-foreground">
        {pending && !authenticated ? <span className="sr-only">로그인 중…</span> : message}
      </p>
    </div>
  );
}
