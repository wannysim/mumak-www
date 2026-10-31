'use client';

import { ArrowUpRight, KeyRound, Route } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@mumak/ui/components/button';

export function AccessGate({ configured }: { configured: boolean }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const token = String(new FormData(event.currentTarget).get('token') ?? '').trim();
    try {
      const response = await fetch('/api/session', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        window.location.reload();
        return;
      }
      setError(response.status === 503 ? '접속 설정이 아직 준비되지 않았어요.' : '접속 키를 다시 확인해 주세요.');
    } catch {
      setError('연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.');
    }
    setBusy(false);
  }
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative flex flex-col justify-between overflow-hidden bg-[#172b4d] p-8 text-white lg:p-16">
        <div className="flex items-center gap-3 text-lg font-bold">
          <Route aria-hidden className="text-[#f3b760]" /> 다음 정거장
        </div>
        <div className="relative z-10 my-16 max-w-lg">
          <p className="mb-6 text-sm tracking-[0.18em] text-[#b9c9ee]">나만의 면접 연습실</p>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight lg:text-6xl">
            이동 중에도,
            <br />한 문제만 더.
          </h1>
          <p className="mt-6 max-w-sm leading-7 text-[#c3cee1]">
            익숙한 출퇴근길이 다음 기회의 출발점이 되도록.
            <br />
            나만의 속도로 준비하는 면접 연습실.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-[#b9c9ee]">
          <span className="h-3 w-3 rounded-full bg-[#f3b760]" />
          <span className="h-px flex-1 bg-white/25" />
          오늘의 나<span className="h-px flex-1 bg-white/25" />
          <span className="h-3 w-3 rounded-full border-2 border-[#f3b760]" />
          다음의 나
        </div>
      </section>
      <section className="flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-sm">
          <KeyRound className="mb-8 size-8 text-primary" aria-hidden />
          <h2 className="text-2xl font-bold tracking-tight">다시, 나의 페이스로</h2>
          <p className="mt-3 mb-8 leading-7 text-muted-foreground">나만의 접속 키로 연습실을 열어 주세요.</p>
          {configured ? (
            <form onSubmit={login} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold" htmlFor="token">
                  접속 키
                </label>
                <input
                  id="token"
                  name="token"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="h-13 w-full rounded-xl border bg-white px-4"
                  placeholder="개인 접속 키 입력"
                />
              </div>
              <Button type="submit" disabled={busy} className="h-13 w-full rounded-xl text-base">
                {busy ? '문을 여는 중…' : '연습실 들어가기'}
                <ArrowUpRight aria-hidden />
              </Button>
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <p role="status" className="rounded-xl border bg-white p-5 text-sm leading-6">
              아직 접속 설정이 준비되지 않았어요. 서버의 개인 접속 키 설정을 마치면 연습실을 열 수 있어요.
            </p>
          )}
          <p className="mt-8 text-xs leading-5 text-muted-foreground">
            공개되지 않는 개인 공간입니다.
            <br />
            연습 기록과 메모는 현재 기기의 브라우저에 저장돼요.
          </p>
        </div>
      </section>
    </main>
  );
}
