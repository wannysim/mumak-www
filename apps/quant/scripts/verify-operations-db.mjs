import { PGlite } from '@electric-sql/pglite';
// Synthetic boundary controls against the actual SQL shipped in the PR.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
process.on('uncaughtException', error => {
  console.error(
    error.message,
    error.position ?? '',
    error.where ?? '',
    error.query?.slice(Math.max(0, Number(error.position) - 100), Number(error.position) + 100) ?? ''
  );
  process.exitCode = 1;
});
let input = '';
for await (const chunk of process.stdin) input += chunk;
const { month, session } = JSON.parse(input);
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;`);
for (const name of ['001_dashboard.sql', '002_paper_publisher.sql', '003_fill_reason.sql', '004_paper_operations.sql'])
  await db.exec(await fs.readFile(`supabase/migrations/${name}`, 'utf8'));
async function publish(payload, revision = 0) {
  return (
    await db.query(`SELECT public.publish_paper_operations_${payload.recordType}($1::jsonb,$2::bigint) AS revision`, [
      JSON.stringify(payload),
      revision,
    ])
  ).rows[0].revision;
}
const invalid = JSON.parse(await fs.readFile('src/__tests__/fixtures/operations-invalid.json', 'utf8'));
for (const test of invalid) {
  const payload = structuredClone(test.base === 'month' ? month : session);
  for (const [path, value] of test.changes) {
    let target = payload;
    for (const key of path.slice(0, -1)) target = target[key];
    target[path.at(-1)] = value;
  }
  await assert.rejects(publish(payload), test.name);
}
// A newer unrelated receipt must not erase a dated preserved-policy event.
const runtime = structuredClone(month);
runtime.episodeId = 'synthetic-runtime';
runtime.evidence[0].kind = 'runtime-receipt';
runtime.strategies.value[0].authority = 'runtime-receipt';
runtime.strategies.value[0].activationObservedAt = {
  availability: 'recorded',
  value: runtime.sourceAsOf,
  evidenceIds: ['policy'],
};
assert.equal(Number(await publish(runtime)), 1);
const preserved = structuredClone(month);
preserved.episodeId = 'synthetic-null-regression';
preserved.evidence[0].kind = 'preserved-policy';
preserved.evidence.push({
  id: 'registration',
  kind: 'policy-registration',
  evidenceAt: month.sourceAsOf,
  observedAt: month.exportedAt,
});
assert.equal(Number(await publish(preserved)), 1);
const erased = structuredClone(preserved);
erased.sourceAsOf = '2026-09-18T14:02:00+00:00';
erased.exportedAt = erased.sourceAsOf;
erased.evidence[0].evidenceAt = null;
erased.evidence[1].evidenceAt = erased.sourceAsOf;
erased.evidence[1].observedAt = erased.sourceAsOf;
await assert.rejects(publish(erased, 1), /Evidence regressed/);
assert.deepEqual(
  (await db.query('SELECT payload FROM public.paper_operation_months WHERE episode_id=$1', [preserved.episodeId]))
    .rows[0].payload,
  preserved
);
assert.equal(Number(await publish(month)), 1);
assert.equal(Number(await publish(session)), 1);
const reexport = structuredClone(month);
reexport.exportedAt = '2026-09-18T14:02:00+00:00';
reexport.evidence[0].observedAt = reexport.exportedAt;
assert.equal(Number(await publish(reexport, 1)), 1);
assert.equal(Number(await publish({ ...month, exportedAt: '2026-09-18T14:02:00+00:00' }, 1)), 1);
await assert.rejects(publish({ ...month, strategies: { ...month.strategies, value: [] } }, 1));
await assert.rejects(publish({ ...month, sourceAsOf: '2026-09-18T13:00:00+00:00' }, 1));
await assert.rejects(publish({ ...month, mode: 'live' }, 1));
await assert.rejects(publish({ ...month, secret: 'PRIVATE' }, 1));
const malformed = structuredClone(session);
malformed.candidates.value[0].score = { availability: 'recorded', value: 'NaN', evidenceIds: ['policy'] };
await assert.rejects(publish(malformed, 1));
const wrongCount = structuredClone(session);
wrongCount.counts.universe.value = 3;
await assert.rejects(publish(wrongCount, 1));
const badStage = structuredClone(session);
badStage.stages[0].status = 'running';
await assert.rejects(publish(badStage, 1));
const orphan = structuredClone(session);
orphan.candidates.evidenceIds = ['not-present'];
await assert.rejects(publish(orphan, 1));
const updated = structuredClone(session);
updated.sourceAsOf = '2026-09-18T14:03:00+00:00';
updated.exportedAt = updated.sourceAsOf;
updated.evidence[0].evidenceAt = updated.sourceAsOf;
updated.evidence[0].observedAt = updated.sourceAsOf;
assert.equal(Number(await publish(updated, 1)), 2);
await assert.rejects(publish(updated, 1));
await assert.rejects(publish(session, 2));
const readback = (await db.query('SELECT payload,summary,revision FROM public.paper_operation_sessions')).rows[0];
assert.deepEqual(readback.payload, updated);
assert.deepEqual(readback.summary.counts, updated.counts);
assert.equal(Number(readback.revision), 2);
for (const role of ['anon', 'authenticated']) {
  await db.exec(`SET ROLE ${role}`);
  assert.equal((await db.query('SELECT * FROM public.paper_operation_sessions')).rows.length, 1);
  await assert.rejects(publish(updated, 2));
  await assert.rejects(db.query('DELETE FROM public.paper_operation_sessions'));
  await assert.rejects(db.query('UPDATE public.paper_operation_months SET revision=99'));
  if (role === 'anon') await assert.rejects(db.query('SELECT * FROM public.live_snapshots'));
  else assert.equal((await db.query('SELECT * FROM public.live_snapshots')).rows.length, 0);
  await db.exec('RESET ROLE');
}
await db.exec('SET ROLE service_role');
assert.equal((await db.query('SELECT * FROM public.paper_operation_sessions')).rows.length, 1);
await db.exec('RESET ROLE');
const flags = await db.query(
  `SELECT bool_and(relrowsecurity AND relforcerowsecurity) AS safe FROM pg_class WHERE relname IN ('paper_operation_months','paper_operation_sessions','live_snapshots')`
);
assert.equal(flags.rows[0].safe, true);
await db.close();
console.log(
  'operations SQL PASS: exact readback, summary, CAS, idempotency, stale/conflict, allowlist, roles, legacy LIVE'
);
