"""Synthetic V1 acceptance against disposable PostgreSQL, never a remote DB.

Run explicitly (no skipped/faked PGlite concurrency):
  python3 -B scripts/verify_operations_concurrency.py --pg-bin /path/to/pg/bin
The caller supplies installed or user-extracted PostgreSQL tools. No installation,
network listener, credentials, production configuration or production data is used.
"""
import argparse
import copy
import json
import os
from pathlib import Path
import select
import subprocess
import tempfile
import time
import unittest
from urllib.parse import parse_qs, urlparse
import uuid

from publish_operations import publish
from test_operations import month_fixture, session_fixture
from test_publish_paper import PublishTests


def literal(value):
    return "'" + value.replace("'", "''") + "'"


class IsolatedPostgres:
    def __init__(self, bindir, library_dir):
        self.bindir = Path(bindir).resolve()
        self.temp = tempfile.TemporaryDirectory(prefix='operations-pg-')
        self.root = Path(self.temp.name)
        self.env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
        if library_dir:
            self.env['LD_LIBRARY_PATH'] = str(Path(library_dir).resolve())
        # Linux abstract Unix socket: no TCP listener and no long filesystem path.
        self.host = '@operations-' + uuid.uuid4().hex
        self.env.update(PGHOST=self.host, PGPORT='15432', PGUSER='isolated', PGDATABASE='postgres',
                        PGOPTIONS='-c timezone=UTC')
        self.started = False

    def run(self, tool, *args, **kwargs):
        return subprocess.run([str(self.bindir / tool), *args], env=self.env,
                              text=True, capture_output=True, check=True, timeout=30, **kwargs)

    def start(self):
        self.run('initdb', '-D', str(self.root / 'data'), '-U', 'isolated', '-A', 'trust',
                 '--no-locale', '-E', 'UTF8')
        self.run('pg_ctl', '-D', str(self.root / 'data'), '-l', str(self.root / 'server.log'),
                 '-o', f"-h '' -k {self.host} -p 15432", '-w', 'start')
        self.started = True
        self.sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; '
                 'CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql '
                 'AS $$ SELECT null::uuid $$;')
        for migration in sorted((Path(__file__).parent.parent / 'supabase/migrations').glob('00[1-4]_*.sql')):
            self.sql(migration.read_text())
        return self

    def command(self):
        return [str(self.bindir / 'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']

    def sql(self, sql):
        return subprocess.run(self.command(), input=sql, env=self.env, text=True,
                              capture_output=True, check=True, timeout=15).stdout.strip()

    def json(self, sql):
        return json.loads(self.sql(sql))

    def publication(self, payload, revision):
        return (f'SELECT public.publish_paper_operations_{payload["recordType"]}'
                f'({literal(json.dumps(payload))}::jsonb,{revision});')

    def row(self, payload):
        table = 'paper_operation_months' if payload['recordType'] == 'month' else 'paper_operation_sessions'
        where = f'episode_id={literal(payload["episodeId"])} AND month={literal(payload["month"])}'
        if payload['recordType'] == 'session':
            where += f' AND session={literal(payload["session"])}'
        return self.json(f'SELECT coalesce(jsonb_agg(to_jsonb(t)),\'[]\'::jsonb) '
                         f'FROM public.{table} t WHERE {where};')

    def close(self):
        if self.started:
            self.run('pg_ctl', '-D', str(self.root / 'data'), '-m', 'fast', '-w', 'stop')
        self.temp.cleanup()


class DurableFaultTransport:
    """Injected HTTP boundary; every accepted POST really commits shipped SQL."""
    def __init__(self, db):
        self.db = db
        self.calls = []
        self.fault = None

    def __call__(self, method, url, _key, body=None):
        parsed = urlparse(url)
        self.calls.append((method, parsed.path, copy.deepcopy(body)))
        if method == 'POST':
            payload = body['snapshot']
            if self.fault == 'session-before-write' and payload['recordType'] == 'session':
                raise OSError('synthetic session failure before commit')
            revision = int(self.db.sql(self.db.publication(payload, body['expected_revision'])))
            if self.fault == 'response-lost':
                raise OSError('synthetic response lost AFTER commit')
            return revision
        if self.fault == 'readback-failed':
            raise OSError('synthetic GET failure AFTER commit')
        query = parse_qs(parsed.query)
        payload = {'episodeId': query['episode_id'][0][3:], 'month': query['month'][0][3:],
                   'recordType': 'session' if parsed.path.endswith('sessions') else 'month'}
        if payload['recordType'] == 'session':
            payload['session'] = query['session'][0][3:]
        rows = self.db.row(payload)
        columns = query['select'][0].split(',')
        return [{key: row[key] for key in columns} for row in rows]


class ConcurrencyAcceptance(unittest.TestCase):
    db = None

    def financial(self):
        return self.db.json('SELECT jsonb_agg(to_jsonb(t)) FROM public.paper_snapshots t;')

    def assert_row(self, payload, revision):
        rows = self.db.row(payload)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row['payload'], payload)
        self.assertEqual(row['revision'], revision)
        self.assertEqual(row['source_as_of'], payload['sourceAsOf'])
        self.assertTrue(row['stored_at'])
        if payload['recordType'] == 'session':
            self.assertEqual(row['summary'], {
                'session': payload['session'], 'counts': payload['counts'],
                'stages': [{k: stage[k] for k in ('id', 'status', 'evidenceAt', 'reasonCode')}
                           for stage in payload['stages']]})
        return row

    def test_independent_transactions_contend_for_insert_and_update(self):
        for kind, factory in [('month', month_fixture), ('session', session_fixture)]:
            for existing in (False, True):
                with self.subTest(kind=kind, existing=existing):
                    baseline = factory()
                    baseline['episodeId'] = f'synthetic-race-{kind}-{int(existing)}'
                    if existing:
                        self.assertEqual(self.db.sql(self.db.publication(baseline, 0)), '1')
                    winner = copy.deepcopy(baseline)
                    loser = copy.deepcopy(baseline)
                    for payload, timestamp in [(winner, '2026-09-18T14:04:00+00:00'),
                                               (loser, '2026-09-18T14:05:00+00:00')]:
                        payload['sourceAsOf'] = timestamp
                        payload['exportedAt'] = timestamp
                        payload['evidence'][0]['evidenceAt'] = timestamp
                        payload['evidence'][0]['observedAt'] = timestamp
                    revision = int(existing)
                    finance_before = self.financial()
                    a = subprocess.Popen(self.db.command(), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                         stderr=subprocess.PIPE, text=True, env=self.db.env)
                    b = None
                    try:
                        a.stdin.write('BEGIN; ' + self.db.publication(winner, revision) +
                                      " SELECT 'winner-ready';\n")
                        a.stdin.flush()
                        self.assertTrue(select.select([a.stdout], [], [], 10)[0], 'winner did not execute')
                        self.assertEqual(a.stdout.readline().strip(), str(revision + 1))
                        self.assertEqual(a.stdout.readline().strip(), 'winner-ready')
                        env = {**self.db.env, 'PGAPPNAME': 'operations-contender'}
                        b = subprocess.Popen(self.db.command(), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                             stderr=subprocess.PIPE, text=True, env=env)
                        b.stdin.write('BEGIN; ' + self.db.publication(loser, revision) + ' COMMIT;\n')
                        b.stdin.close()
                        b.stdin = None
                        deadline = time.monotonic() + 10
                        blocked = False
                        while time.monotonic() < deadline:
                            blocked = self.db.sql("SELECT count(*) FROM pg_stat_activity WHERE "
                                "application_name='operations-contender' AND wait_event_type='Lock' "
                                "AND cardinality(pg_blocking_pids(pid))=1;") == '1'
                            if blocked:
                                break
                            self.assertIsNone(b.poll(), 'contender exited before overlapping')
                            time.sleep(0.01)
                        self.assertTrue(blocked, 'no independently blocked transaction observed')
                        # Winner is still uncommitted: a third connection sees only old committed state.
                        self.assertEqual(len(self.db.row(baseline)), int(existing))
                        a.stdin.write('COMMIT;\n')
                        a.stdin.close()
                        a.stdin = None
                        _, aerr = a.communicate(timeout=10)
                        _, berr = b.communicate(timeout=10)
                        self.assertEqual(a.returncode, 0, aerr)
                        self.assertNotEqual(b.returncode, 0)
                        self.assertIn('Revision conflict', berr)
                        committed = self.assert_row(winner, revision + 1)
                        self.assertEqual(self.db.sql(self.db.publication(winner, revision + 1)),
                                         str(revision + 1))
                        self.assertEqual(self.db.row(winner), [committed])
                        table = ('paper_operation_months' if kind == 'month'
                                 else 'paper_operation_sessions')
                        for role in ('anon', 'authenticated'):
                            visible = self.db.json(f'SET ROLE {role}; SELECT jsonb_agg(to_jsonb(t)) '
                                f'FROM public.{table} t WHERE episode_id='
                                f'{literal(winner["episodeId"])};')
                            self.assertEqual(visible, [committed])
                            for statement in (self.db.publication(winner, revision + 1),
                                              f'DELETE FROM public.{table};',
                                              f'UPDATE public.{table} SET revision=99;',
                                              f'INSERT INTO public.{table} SELECT * FROM public.{table};'):
                                with self.assertRaises(subprocess.CalledProcessError) as denied:
                                    self.db.sql(f'SET ROLE {role}; ' + statement)
                                self.assertIn('permission denied', denied.exception.stderr)
                            self.assertEqual(self.db.row(winner), [committed])
                        self.assertEqual(self.financial(), finance_before)
                        print(f'actual independent transaction overlap: {kind} '
                              f'{"update" if existing else "insert"}, one winner, loser CAS conflict', flush=True)
                    finally:
                        for process in (a, b):
                            if process and process.poll() is None:
                                process.kill()
                                process.communicate()

    def test_verified_month_survives_session_failure_and_explicit_recovery(self):
        month, session = month_fixture(), session_fixture()
        for payload in (month, session):
            payload['episodeId'] = 'synthetic-partial'
        transport = DurableFaultTransport(self.db)
        finance_before = self.financial()
        self.assertEqual(publish(month, 'https://synthetic.supabase.co', 'synthetic', 0,
                                 transport=transport)['status'], 'verified')
        month_row = self.assert_row(month, 1)
        transport.fault = 'session-before-write'
        with self.assertRaises(OSError):
            publish(session, 'https://synthetic.supabase.co', 'synthetic', 0, transport=transport)
        self.assertEqual([c[0] for c in transport.calls], ['POST', 'GET', 'POST'])
        self.assertEqual(self.db.row(month), [month_row])
        self.assertEqual(self.db.row(session), [])
        # Exact readback precedes this explicit new publication; no automatic retry.
        transport.fault = None
        self.assertEqual(publish(session, 'https://synthetic.supabase.co', 'synthetic', 0,
                                 transport=transport)['status'], 'verified')
        self.assert_row(session, 1)
        self.assertEqual(self.db.row(month), [month_row])
        self.assertEqual(self.financial(), finance_before)

    def test_committed_ambiguous_writes_require_readback_before_explicit_cas(self):
        for fault in ('response-lost', 'readback-failed'):
            for kind, factory in [('month', month_fixture), ('session', session_fixture)]:
                with self.subTest(fault=fault, kind=kind):
                    payload = factory()
                    payload['episodeId'] = 'synthetic-' + kind + '-' + fault
                    transport = DurableFaultTransport(self.db)
                    transport.fault = fault
                    finance_before = self.financial()
                    with self.assertRaises(OSError):
                        publish(payload, 'https://synthetic.supabase.co', 'synthetic', 0, transport=transport)
                    self.assertEqual([c[0] for c in transport.calls],
                                     ['POST'] if fault == 'response-lost' else ['POST', 'GET'])
                    committed = self.assert_row(payload, 1)
                    # Real exact-row inspection is the explicit operator recovery prerequisite.
                    self.assertEqual(self.db.row(payload), [committed])
                    transport.fault = None
                    receipt = publish(payload, 'https://synthetic.supabase.co', 'synthetic',
                                      committed['revision'], transport=transport)
                    self.assertEqual(receipt['status'], 'verified')
                    self.assertEqual(receipt['revision'], 1)  # no-op, not a duplicate revision
                    self.assertEqual(self.db.row(payload), [committed])
                    self.assertEqual(self.financial(), finance_before)
                    self.assertEqual(sum(c[0] == 'POST' for c in transport.calls), 2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pg-bin', required=True)
    parser.add_argument('--library-dir')
    args = parser.parse_args()
    db = IsolatedPostgres(args.pg_bin, args.library_dir)
    try:
        db.start()
        fixture = PublishTests()
        fixture.setUp()
        db.sql('SELECT public.publish_paper_snapshot(' + literal(json.dumps(fixture.doc)) + '::jsonb);')
        ConcurrencyAcceptance.db = db
        result = unittest.TextTestRunner(verbosity=2).run(
            unittest.defaultTestLoader.loadTestsFromTestCase(ConcurrencyAcceptance))
        return 0 if result.wasSuccessful() else 1
    finally:
        db.close()


if __name__ == '__main__':
    raise SystemExit(main())
