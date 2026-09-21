import { createClient } from '@supabase/supabase-js';

import { createDashboardClient } from '@/lib/create-dashboard-client';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));

const anon = `header.${btoa(JSON.stringify({ role: 'anon' }))}.signature`;

describe('public client configuration', () => {
  it('rejects a privileged key even when the URL is missing', () => {
    expect(() =>
      createDashboardClient({ VITE_SUPABASE_ANON_KEY: 'sb_secret_TEST_ONLY' }, 'https://quant.example.test')
    ).toThrow(/anon\/publishable/);
  });

  it('returns an honest unconfigured state without a complete public configuration', () => {
    expect(createDashboardClient({}, 'https://quant.example.test')).toBeNull();
  });

  it.each(['sb_secret_TEST_ONLY', `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`])(
    'refuses a privileged credential even in the anon-named variable',
    key => {
      expect(() =>
        createDashboardClient(
          { VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_ANON_KEY: key },
          'https://quant.example.test'
        )
      ).toThrow(/anon\/publishable/);
    }
  );

  it('disables browser HTTP caching for all Supabase requests', async () => {
    createDashboardClient(
      { VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_ANON_KEY: anon },
      'https://quant.example.test'
    );
    const options = vi.mocked(createClient).mock.calls.at(-1)?.[2];
    expect(options?.global?.fetch).toBeTypeOf('function');
    const transport = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', transport);
    await options!.global!.fetch!('https://fixture.supabase.co/rest/v1/live_snapshots', { method: 'GET' });
    expect(transport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cache: 'no-store' }));
    vi.unstubAllGlobals();
  });
});
