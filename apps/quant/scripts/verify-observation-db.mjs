import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const { payload, invalid } = JSON.parse(raw);
const db = new PGlite();
await db.exec(
  'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;'
);
for (const name of [
  '001_dashboard.sql',
  '002_paper_publisher.sql',
  '003_fill_reason.sql',
  '004_paper_operations.sql',
  '005_paper_observations.sql',
])
  await db.exec(await fs.readFile(`supabase/migrations/${name}`, 'utf8'));
const publish = async (p, revision = 0) =>
  Number(
    (
      await db.query('SELECT public.publish_paper_observation($1::jsonb,$2::bigint) AS revision', [
        JSON.stringify(p),
        revision,
      ])
    ).rows[0].revision
  );
for (const [name, changes] of invalid) {
  const p = structuredClone(payload);
  for (const [path, value] of changes) {
    let obj = p;
    for (const key of path.slice(0, -1)) obj = obj[key];
    obj[path.at(-1)] = value;
  }
  await assert.rejects(publish(p), name);
}
await db.exec('SET ROLE service_role');
assert.equal(await publish(payload), 1);
const read = async () => (await db.query('SELECT * FROM public.paper_observations')).rows[0];
const first = await read();
assert.deepEqual(first.payload, payload);
const repeated = structuredClone(payload);
repeated.exportedAt = '2026-09-18T14:02:00+00:00';
repeated.evidence.forEach(e => (e.observedAt = repeated.exportedAt));
assert.equal(await publish(repeated, 1), 1);
assert.deepEqual(await read(), first);
await assert.rejects(publish(payload, 0), /Revision conflict/);
const update = structuredClone(payload);
update.exportedAt = update.sourceAsOf = '2026-09-18T14:03:00+00:00';
update.evidence.push({
  id: 'later-collector',
  kind: 'collector-receipt',
  evidenceAt: update.sourceAsOf,
  observedAt: update.exportedAt,
});
assert.equal(await publish(update, 1), 2);
await assert.rejects(publish(payload, 2), /Stale/);
const regressed = structuredClone(update);
regressed.sourceAsOf = regressed.exportedAt = '2026-09-18T14:04:00+00:00';
regressed.evidence.at(-1).evidenceAt = regressed.sourceAsOf;
regressed.evidence.at(-1).observedAt = regressed.exportedAt;
regressed.evidence = regressed.evidence.filter(e => e.id !== 'ingest');
regressed.ingest = { availability: 'unsupported', value: null, evidenceIds: [] };
await assert.rejects(publish(regressed, 2), /Evidence regressed/);
await db.exec('RESET ROLE');
for (const role of ['anon', 'authenticated']) {
  await db.exec(`SET ROLE ${role}`);
  assert.equal(Number((await read()).revision), 2);
  await assert.rejects(publish(update, 2));
  await assert.rejects(db.exec('DELETE FROM public.paper_observations'));
  await assert.rejects(db.exec('UPDATE public.paper_observations SET revision=99'));
  await assert.rejects(db.query('SELECT public.paper_observation_validate($1::jsonb)', [JSON.stringify(payload)]));
  if (role === 'anon') await assert.rejects(db.query('SELECT * FROM public.live_snapshots'));
  else assert.equal((await db.query('SELECT * FROM public.live_snapshots')).rows.length, 0);
  await db.exec('RESET ROLE');
}
assert.equal(
  (
    await db.query(
      "SELECT relrowsecurity AND relforcerowsecurity AS safe FROM pg_class WHERE relname='paper_observations'"
    )
  ).rows[0].safe,
  true
);
assert.equal((await db.query('SELECT * FROM public.paper_snapshots')).rows.length, 0);
await db.close();
console.log(
  `observation SQL PASS: ${invalid.length} invalid controls, producer payload, exact readback, CAS/noop/stale/evidence-regression, RLS/read-only/LIVE isolation`
);
