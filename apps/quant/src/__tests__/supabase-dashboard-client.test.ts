import { TEST_ONLY_PAPER_ROW } from '@/__tests__/fixtures/test-snapshot';
import { SupabaseDashboardClient, type SupabaseLike } from '@/lib/supabase-dashboard-client';

function createSupabaseFake(rows: unknown[] = [TEST_ONLY_PAPER_ROW]) {
  const calls = {
    table: '',
    select: '',
    orders: [] as Array<{ column: string; ascending: boolean }>,
    signal: undefined as AbortSignal | undefined,
    otp: undefined as unknown,
    signedOut: false,
  };
  const query = {
    select(columns: string) {
      calls.select = columns;
      return this;
    },
    order(column: string, options: { ascending: boolean }) {
      calls.orders.push({ column, ...options });
      return this;
    },
    async abortSignal(signal: AbortSignal) {
      calls.signal = signal;
      return { data: rows, error: null };
    },
  };
  const supabase: SupabaseLike = {
    auth: {
      async getSession() {
        return {
          data: { session: { access_token: 'must-not-leak', user: { id: 'owner-1', email: 'owner@example.test' } } },
          error: null,
        };
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async signInWithOtp(options) {
        calls.otp = options;
        return { error: null };
      },
      async signOut() {
        calls.signedOut = true;
        return { error: null };
      },
    },
    from(table: string) {
      calls.table = table;
      return query;
    },
  };
  return { supabase, calls };
}

describe('SupabaseDashboardClient', () => {
  it('queries paper rows with the agreed newest-first order and validates them', async () => {
    const { supabase, calls } = createSupabaseFake();
    const client = new SupabaseDashboardClient(supabase, 'https://quant.example.test');
    const controller = new AbortController();

    const snapshots = await client.fetchSnapshots('paper', controller.signal);

    expect(calls.table).toBe('paper_snapshots');
    expect(calls.select).toBe('episode_id,month,as_of,payload');
    expect(calls.orders).toEqual([
      { column: 'month', ascending: false },
      { column: 'as_of', ascending: false },
    ]);
    expect(calls.signal).toBe(controller.signal);
    expect(snapshots[0]?.episodeId).toBe('paper-2026');
  });

  it('uses the isolated live table', async () => {
    const livePayload = { ...TEST_ONLY_PAPER_ROW.payload, mode: 'live', source: 'live-ledger' };
    const { supabase, calls } = createSupabaseFake([
      { ...TEST_ONLY_PAPER_ROW, episode_id: 'live-2026', payload: { ...livePayload, episodeId: 'live-2026' } },
    ]);
    const client = new SupabaseDashboardClient(supabase, 'https://quant.example.test');

    await client.fetchSnapshots('live', new AbortController().signal);

    expect(calls.table).toBe('live_snapshots');
  });

  it('requests OTP without creating unknown users', async () => {
    const { supabase, calls } = createSupabaseFake();
    const client = new SupabaseDashboardClient(supabase, 'https://quant.example.test');

    await client.requestMagicLink('owner@example.test');

    expect(calls.otp).toEqual({
      email: 'owner@example.test',
      options: { shouldCreateUser: false, emailRedirectTo: 'https://quant.example.test' },
    });
  });

  it('maps SDK sessions to user identity without exposing tokens', async () => {
    const { supabase } = createSupabaseFake();
    const client = new SupabaseDashboardClient(supabase, 'https://quant.example.test');

    const session = await client.getSession();

    expect(session).toEqual({ userId: 'owner-1', email: 'owner@example.test' });
    expect(session).not.toHaveProperty('access_token');
  });

  it('maps auth refresh events and unsubscribes cleanly', () => {
    const { supabase } = createSupabaseFake();
    let sdkListener: ((event: string, session: { user: { id: string; email?: string } } | null) => void) | undefined;
    const unsubscribe = vi.fn();
    supabase.auth.onAuthStateChange = listener => {
      sdkListener = listener;
      return { data: { subscription: { unsubscribe } } };
    };
    const client = new SupabaseDashboardClient(supabase, 'https://quant.example.test');
    const listener = vi.fn();

    const dispose = client.onAuthStateChange(listener);
    sdkListener?.('TOKEN_REFRESHED', { user: { id: 'owner-1' } });
    sdkListener?.('PASSWORD_RECOVERY', null);
    dispose();

    expect(listener).toHaveBeenNthCalledWith(1, 'TOKEN_REFRESHED', { userId: 'owner-1' });
    expect(listener).toHaveBeenNthCalledWith(2, 'USER_UPDATED', null);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('returns an anonymous session when the SDK has no session', async () => {
    const { supabase } = createSupabaseFake();
    supabase.auth.getSession = async () => ({ data: { session: null }, error: null });

    await expect(new SupabaseDashboardClient(supabase, 'https://quant.example.test').getSession()).resolves.toBeNull();
  });

  it('uses generic errors for failed SDK operations', async () => {
    const { supabase } = createSupabaseFake();
    supabase.auth.getSession = async () => ({
      data: { session: null },
      error: { message: 'sensitive provider detail' },
    });
    supabase.auth.signInWithOtp = async () => ({ error: { message: 'unknown email' } });
    supabase.auth.signOut = async () => ({ error: { message: 'provider detail' } });
    const client = new SupabaseDashboardClient(supabase, 'https://quant.example.test');

    await expect(client.getSession()).rejects.toThrow('세션을 확인하지 못했습니다.');
    await expect(client.requestMagicLink('unknown@example.test')).rejects.toThrow('로그인 요청을 처리하지 못했습니다.');
    await expect(client.signOut()).rejects.toThrow('로그아웃을 완료하지 못했습니다.');
  });
});
