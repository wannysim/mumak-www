"""Execute dashboard migrations in the pinned test-only PGlite dependency."""
import json
import os
from pathlib import Path
import subprocess
import unittest


class FillReasonMigrationTests(unittest.TestCase):
    def test_rpc_accepts_legacy_and_safe_reason_but_rejects_other_fields(self):
        module = os.environ.get('PGLITE_MODULE', '@electric-sql/pglite')
        migrations = Path(__file__).parent.parent / 'supabase' / 'migrations'
        sql = [
            (migrations / name).read_text()
            for name in ('001_dashboard.sql', '002_paper_publisher.sql', '003_fill_reason.sql')
        ]
        script = r"""
const { PGlite } = await import(process.env.PGLITE_MODULE);
const db = new PGlite();
await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
`);
for (const migration of JSON.parse(process.env.MIGRATIONS)) await db.exec(migration);

const baseFill = {
  id: 'fill-1', at: '2026-09-18T14:00:00+00:00', symbol: 'TEST', side: 'buy',
  quantity: '1', price: '100', commission: '0'
};
function snapshot(episodeId, fill) {
  return {
    schemaVersion: 1, mode: 'paper', episodeId, month: '2026-09', label: 'fixture',
    currency: 'USD', status: 'active', startedAt: '2026-09-18T13:00:00+00:00',
    asOf: '2026-09-18T14:00:00+00:00', exportedAt: '2026-09-18T14:01:00+00:00',
    source: 'forward-paper-ledger', baselineKind: 'inception',
    summary: {startingNav:'1000', currentNav:'1000', cash:'900', netContributions:'0',
              profit:'0', returnPct:'0', returnMethod:'simple-no-flows'},
    holdings: [], history: [], fills: [fill], notes: []
  };
}
async function accepted(episodeId, fill) {
  const result = await db.query('SELECT public.publish_paper_snapshot($1::jsonb) AS accepted',
                                [JSON.stringify(snapshot(episodeId, fill))]);
  if (result.rows[0].accepted !== true) throw new Error(`not accepted: ${episodeId}`);
}
async function rejected(episodeId, fill) {
  try {
    await accepted(episodeId, fill);
  } catch (error) {
    if (String(error).includes('Invalid paper projection')) return;
    throw error;
  }
  throw new Error(`unexpectedly accepted: ${episodeId}`);
}
const pending = snapshot('pending', baseFill);
pending.status = 'pending';
pending.fills = [];
const pendingResult = await db.query('SELECT public.publish_paper_snapshot($1::jsonb) AS accepted', [JSON.stringify(pending)]);
if (pendingResult.rows[0].accepted !== true) throw new Error('pending contract rejected');
await accepted('legacy', baseFill);
await accepted('safe-string', {...baseFill, reason: '정기 리밸런싱'});
await accepted('safe-null', {...baseFill, reason: null});
await rejected('raw-private', {...baseFill, reason: 'private diagnostic'});
await rejected('extra-field', {...baseFill, reason: null, privateDiagnostic: 'secret'});
const rls = await db.query(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class
                            WHERE oid = 'public.paper_snapshots'::regclass`);
if (!rls.rows[0].relrowsecurity || !rls.rows[0].relforcerowsecurity) throw new Error('RLS weakened');
const acl = await db.query(`SELECT has_function_privilege('anon',
  'public.publish_paper_snapshot(jsonb)', 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', 'public.publish_paper_snapshot(jsonb)', 'EXECUTE') AS auth_execute`);
if (acl.rows[0].anon_execute || acl.rows[0].auth_execute) throw new Error('RPC privilege widened');
await db.close();
"""
        result = subprocess.run(
            ['node', '--input-type=module', '-'],
            input=script,
            text=True,
            cwd=Path(__file__).parent.parent,
            timeout=60,
            capture_output=True,
            env={**os.environ, 'PGLITE_MODULE': module, 'MIGRATIONS': json.dumps(sql)},
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)


if __name__ == '__main__':
    unittest.main()
