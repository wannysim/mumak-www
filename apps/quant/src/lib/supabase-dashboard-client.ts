import type { AuthEvent, AuthSession, DashboardClient } from '@/lib/dashboard-client';
import { mapSnapshotRow, type DashboardMode } from '@/lib/dashboard-schema';

type SupabaseError = { message: string };
type SupabaseSession = { user: { id: string; email?: string }; [key: string]: unknown };
type SupabaseResult<T> = { data: T; error: SupabaseError | null };

type SupabaseQuery = {
  select: (columns: string) => SupabaseQuery;
  order: (column: string, options: { ascending: boolean }) => SupabaseQuery;
  abortSignal: (signal: AbortSignal) => PromiseLike<SupabaseResult<unknown[] | null>>;
};

type SupabaseLike = {
  auth: {
    getSession: () => Promise<SupabaseResult<{ session: SupabaseSession | null }>>;
    onAuthStateChange: (listener: (event: string, session: SupabaseSession | null) => void) => {
      data: { subscription: { unsubscribe: () => void } };
    };
    signInWithOtp: (options: {
      email: string;
      options: { shouldCreateUser: false; emailRedirectTo: string };
    }) => Promise<{ error: SupabaseError | null }>;
    signOut: () => Promise<{ error: SupabaseError | null }>;
  };
  from: (table: string) => SupabaseQuery;
};

function mapSession(session: SupabaseSession | null): AuthSession | null {
  if (!session) return null;
  return { userId: session.user.id, ...(session.user.email ? { email: session.user.email } : {}) };
}

function mapAuthEvent(event: string): AuthEvent {
  if (
    event === 'INITIAL_SESSION' ||
    event === 'SIGNED_IN' ||
    event === 'SIGNED_OUT' ||
    event === 'TOKEN_REFRESHED' ||
    event === 'USER_UPDATED'
  ) {
    return event;
  }
  return 'USER_UPDATED';
}

class SupabaseDashboardClient implements DashboardClient {
  constructor(
    private readonly supabase: SupabaseLike,
    private readonly redirectOrigin: string
  ) {}

  async getSession() {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) throw new Error('세션을 확인하지 못했습니다.');
    return mapSession(data.session);
  }

  onAuthStateChange(listener: (event: AuthEvent, session: AuthSession | null) => void) {
    const { data } = this.supabase.auth.onAuthStateChange((event, session) => {
      listener(mapAuthEvent(event), mapSession(session));
    });
    return () => data.subscription.unsubscribe();
  }

  async fetchSnapshots(mode: DashboardMode, signal: AbortSignal) {
    const table = mode === 'paper' ? 'paper_snapshots' : 'live_snapshots';
    const { data, error } = await this.supabase
      .from(table)
      .select('episode_id,month,as_of,payload')
      .order('month', { ascending: false })
      .order('as_of', { ascending: false })
      .abortSignal(signal);
    if (error) throw new Error('운용 내역을 불러오지 못했습니다.');
    return (data ?? []).map(row => mapSnapshotRow(row, mode));
  }

  async requestMagicLink(email: string) {
    const { error } = await this.supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: this.redirectOrigin },
    });
    if (error) throw new Error('로그인 요청을 처리하지 못했습니다.');
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw new Error('로그아웃을 완료하지 못했습니다.');
  }
}

export { SupabaseDashboardClient, type SupabaseLike };
