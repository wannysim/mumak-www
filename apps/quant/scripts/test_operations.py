"""Synthetic operations contract cases. Never production trading evidence."""
import copy
import json
from pathlib import Path
import unittest

FIXTURES = Path(__file__).parent.parent / 'src' / '__tests__' / 'fixtures'


def unknown():
    return {'availability': 'unsupported', 'value': None, 'evidenceIds': []}


def recorded(value):
    return {'availability': 'recorded', 'value': value, 'evidenceIds': ['policy']}


def month_fixture():
    return json.loads((FIXTURES / 'operations-month.json').read_text())


def session_fixture():
    month = month_fixture()
    session = {k: v for k, v in month.items() if k not in ('recordType', 'strategies', 'improvement')}
    session.update(recordType='session', session='2026-09-18', strategyVersion=unknown(), ledgerAsOf=unknown(),
                   counts={k: recorded(v) if v is not None else unknown() for k, v in {
                       'universe': 2, 'collectorEligible': 1, 'collectorExcluded': 1,
                       'ranked': None, 'selected': None, 'watched': None}.items()}, stages=[],
                   candidates=recorded([]))
    for stage in ['collection', 'screening', 'decision', 'risk', 'paper-action', 'report', 'publication']:
        session['stages'].append({
            'id': stage, 'status': 'not-recorded',
            **{k: None for k in ['evidenceAt', 'startedAt', 'finishedAt', 'leaseUntil', 'nextExpectedAt', 'expectedBy', 'reasonCode']},
            'evidenceIds': [], **{k: unknown() for k in ['progress', 'quality', 'action', 'risk']}})
    for symbol, eligible, kind in [('TEST', True, 'equity'), ('ETF', False, 'etf')]:
        session['candidates']['value'].append({
            'symbol': symbol, 'kind': kind, 'collectorEligible': recorded(eligible),
            'reasonCodes': recorded([] if eligible else ['unverified-identity']),
            **{k: unknown() for k in ['signalQualified', 'score', 'volatility', 'rank', 'selected', 'targetWeight', 'watched']}})
    return session


class PublicOperationsTests(unittest.TestCase):
    def test_shared_invalid_corpus(self):
        from public_operations import validate_operations
        for case in json.loads((FIXTURES / 'operations-invalid.json').read_text()):
            with self.subTest(case=case['name']):
                payload = month_fixture() if case['base'] == 'month' else session_fixture()
                for path, value in case['changes']:
                    target = payload
                    for key in path[:-1]:
                        target = target[key]
                    target[path[-1]] = value
                with self.assertRaises(ValueError):
                    validate_operations(payload)

    def test_accepts_strict_month_and_session_and_preserves_unknown(self):
        from public_operations import validate_operations
        for payload in [month_fixture(), session_fixture()]:
            self.assertEqual(validate_operations(payload), payload)

    def test_accepts_typed_runtime_activation_receipt(self):
        from public_operations import validate_operations
        payload = month_fixture()
        payload['evidence'][0]['kind'] = 'runtime-receipt'
        payload['strategies']['value'][0]['authority'] = 'runtime-receipt'
        payload['strategies']['value'][0]['activationObservedAt'] = recorded(payload['sourceAsOf'])
        self.assertEqual(validate_operations(payload), payload)

    def test_rejects_private_extra_nested_malformed_and_inconsistent_counts(self):
        from public_operations import validate_operations
        base = session_fixture()
        mutations = [
            lambda p: p.update(mode='live'), lambda p: p.update(secret='/home/private'),
            lambda p: p.update(session='2026-09-31'), lambda p: p.update(month='2026-10'),
            lambda p: p['candidates']['value'][0].update(symbol='bad/token'),
            lambda p: p['counts']['universe'].update(value=3),
            lambda p: p['candidates']['value'][0]['score'].update(availability='recorded', value='NaN', evidenceIds=['policy']),
            lambda p: p['evidence'][0].update(id='https://private'),
            lambda p: p['evidence'][0].update(evidenceAt='2026-09-18T14:00:01+00:00'),
            lambda p: p['stages'][0].update(status='running'),
            lambda p: p['candidates']['value'].append(copy.deepcopy(p['candidates']['value'][0])),
            lambda p: p['counts']['ranked'].update(availability='recorded', value=0, evidenceIds=[]),
            lambda p: p['stages'][1].update(id='collection'),
        ]
        for mutation in mutations:
            payload = copy.deepcopy(base)
            mutation(payload)
            with self.assertRaises(ValueError):
                validate_operations(payload)


class ExportOperationsTests(unittest.TestCase):
    def test_file_adapter_projects_candidate_report_session_not_filename(self):
        import tempfile
        from export_operations import export_operations
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data/snapshots').mkdir(parents=True)
            (root / 'operations/reports').mkdir(parents=True)
            policy = {'mode':'forward_paper','live':False,'period':{'start_us_session':'2026-09-18','end_us_session':'2026-09-30'}}
            (root / 'policy.json').write_text(json.dumps(policy))
            rules = month_fixture()['strategies']['value'][0]['rules']
            # Synthetic saved policy, not a runner or a generated market result.
            spec = {'version':'broad-us-paper-v2','live':False,'paper_start_session':'2026-09-18','paper_end_session':'2026-09-30', 'public_rules': rules}
            (root / 'universe-policy-v2.json').write_text(json.dumps(spec))
            snapshot = {'schema_version':1,'session':'2026-09-18','collected_at':'2026-09-18T14:00:00+00:00','universe_count':2,'history_ok_count':2,'coverage':1.0,'assets':{
                'TEST':{'symbol':'TEST','kind':'equity','eligible':True,'exclusion_reasons':[]},
                'ETF':{'symbol':'ETF','kind':'etf','eligible':False,'exclusion_reasons':['history_fetch_or_parse_failed: /home/PRIVATE_TOKEN']}}}
            (root / 'data/snapshots/2026-09-18.json').write_text(json.dumps(snapshot))
            report = {'report':{'mode':'forward_paper','live':False,'schema_version':1,'session':'2026-09-18','asof':'2026-09-19T00:00:00+00:00','quality':{'universe_count':2,'eligible_count':1,'snapshot_collected_at':snapshot['collected_at'],'collector_process_success':True,'decision_verified':True,'history_gate_pass':True,'history_200_valid_count':2,'history_coverage':1.0}}}
            (root / 'operations/reports/daily-2026-09-19.json').write_text(json.dumps(report))
            binding = {'sourceRoot':str(root),'episodeId':'synthetic-paper','month':'2026-09','registeredAt':'2026-09-18T13:00:00+00:00','authority':'preserved-policy'}
            result = export_operations(binding, session='2026-09-18', now='2026-09-19T00:01:00+00:00')
            self.assertEqual(result['session'], '2026-09-18')
            self.assertEqual(result['counts']['collectorEligible']['value'], 1)
            self.assertEqual(result['stages'][0]['status'], 'succeeded')
            self.assertIsNone(result['stages'][4]['action']['value'])
            self.assertEqual(result['candidates']['value'][0]['reasonCodes']['value'], ['fetch-failed'])
            self.assertNotIn('PRIVATE_TOKEN', json.dumps(result))
            from public_operations import meaningful
            repeated = export_operations(binding, session='2026-09-18', now='2026-09-19T00:02:00+00:00')
            self.assertEqual(meaningful(result), meaningful(repeated))
            binding['authority'] = 'runtime-receipt'
            with self.assertRaises(ValueError):
                export_operations(binding, session='2026-09-18', now='2026-09-19T00:02:00+00:00')
            binding['authority'] = 'preserved-policy'
            report['report']['quality']['eligible_count'] = 2
            (root / 'operations/reports/daily-2026-09-19.json').write_text(json.dumps(report))
            with self.assertRaises(ValueError):
                export_operations(binding, session='2026-09-18', now='2026-09-19T00:01:00+00:00')


class PublishOperationsTests(unittest.TestCase):
    def test_verifies_exact_row_and_revision_without_retrying_ambiguous_write(self):
        from publish_operations import publish
        payload = month_fixture()
        calls = []
        def transport(method, url, key, body=None):
            calls.append((method, url, body))
            if method == 'POST':
                self.assertEqual(body['expected_revision'], 0)
                return 1
            return [{'episode_id':payload['episodeId'],'month':payload['month'],'revision':1,'source_as_of':payload['sourceAsOf'],'payload':payload}]
        self.assertEqual(publish(payload, 'https://synthetic.supabase.co', 'synthetic-key', 0, transport=transport)['revision'], 1)
        self.assertEqual([c[0] for c in calls], ['POST','GET'])
        def mismatch(method, url, key, body=None):
            return 1 if method == 'POST' else []
        with self.assertRaises(ValueError):
            publish(payload,'https://synthetic.supabase.co','synthetic-key',0,transport=mismatch)


if __name__ == '__main__':
    unittest.main()
