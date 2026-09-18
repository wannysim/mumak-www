import { headers } from 'next/headers';

import { AdminSession } from '@/components/admin-session';
import { readAdminAuthConfig } from '@/src/shared/lib/admin-auth-config';
import { hasValidSession } from '@/src/shared/lib/admin-session';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let authenticated = false;
  try {
    authenticated = hasValidSession(await headers(), readAdminAuthConfig());
  } catch {
    authenticated = false;
  }
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-8 px-5 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Private operator tool</p>
        <h1 className="text-3xl font-semibold tracking-tight">블로그 이미지 관리</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          저장된 이미지를 폴더별로 살펴보고, 새 이미지를 발행해 주소와 스니펫을 만듭니다.
        </p>
      </header>
      <AdminSession initialAuthenticated={authenticated} />
    </main>
  );
}
