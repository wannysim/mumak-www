"""Synthetic saved-artifact fixtures and integration inputs; never market/trading evidence."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from export_operations import export_operations, policy_rules
from public_operations import meaningful
from test_operations import month_fixture

NOW = '2026-09-19T00:01:00+00:00'


def saved_source(root):
    (root / 'data/snapshots').mkdir(parents=True)
    (root / 'operations/reports').mkdir(parents=True)
    def save(path, value):
        (root / path).write_text(json.dumps(value))
    save('policy.json', {'mode':'forward_paper','live':False,'period':{'start_us_session':'2026-09-18','end_us_session':'2026-09-30'}})
    spec = {'version':'broad-us-paper-v2','live':False,'paper_start_session':'2026-09-18','paper_end_session':'2026-09-30',
            'universe_equity_count':503,'universe_etf_count':20,
            'eligibility':{'minimum_price_usd':'5','minimum_mean_daily_dollar_volume_20_sessions_usd':'20000000','minimum_history_sessions':200,'minimum_universe_data_coverage':0.95,'holdings_data_coverage_required':1.0},
            'signal':{'return_lookbacks':[63,126],'sma_sessions':120,'volatility_sessions':63,'positive_score_required':True},
            'portfolio':{'maximum_positions':8,'single_stock_max_weight':0.1,'single_etf_max_weight':0.2,'sector_lookthrough_max_weight':0.3,'minimum_cash_weight':0.2,'whole_shares_only':True,'rebalance':'initial_and_monday'},
            'risk':{'daily_buy_stop_loss':0.01,'monthly_persistent_buy_stop_loss':0.3},
            'cost_assumptions':{'commission_bps_per_side':10,'slippage_bps_per_side':5},'data_architecture':{'quote_poll_minutes':15}}
    save('universe-policy-v2.json', spec)
    assets = {f'TEST{i:03}':{'symbol':f'TEST{i:03}','kind':'equity','eligible':True,'exclusion_reasons':[]} for i in range(60)}
    assets['ETF'] = {'symbol':'ETF','kind':'etf','eligible':False,'exclusion_reasons':['unverified_identity']}
    save('data/snapshots/2026-09-18.json', {'schema_version':1,'session':'2026-09-18','collected_at':'2026-09-18T14:00:00+00:00','universe_count':61,'history_ok_count':61,'coverage':1.0,'assets':assets})
    save('data/progress-2026-09-18.json', {'session':'2026-09-18','started_at':'2026-09-18T13:59:00+00:00','updated_at':'2026-09-18T14:00:01+00:00','processed_count':61,'universe_count':61,'fetch_error_count':0,'eligible_so_far':60,'phase':'completed'})
    report = {'report':{'schema_version':1,'mode':'forward_paper','live':False,'session':'2026-09-18','asof':'2026-09-19T00:00:00+00:00','quality':{'universe_count':61,'eligible_count':60,'snapshot_collected_at':'2026-09-18T14:00:00+00:00','history_200_valid_count':61,'history_coverage':1.0,'history_gate_pass':True,'collector_process_success':True,'decision_verified':True}}}
    save('operations/reports/daily-2026-09-19.json', report)
    return {'sourceRoot':str(root),'episodeId':'synthetic-paper','month':'2026-09','registeredAt':'2026-09-18T13:00:00+00:00','authority':'preserved-policy'}, spec, report


class SavedSourceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.binding, self.spec, self.report = saved_source(self.root)

    def test_policy_formula_registry_and_c1_registration_are_not_activation(self):
        self.assertEqual(policy_rules(self.spec), month_fixture()['strategies']['value'][0]['rules'])
        base = export_operations(self.binding, now=NOW)
        release = {'mode':'forward_paper','live':False,'variant':'C1','historical_migration':False,'release_id':'synthetic-c1','effective_at':'2026-09-20T12:00:00+00:00'}
        (self.root / 'release.json').write_text(json.dumps(release))
        self.binding.update(releaseFile='release.json',releaseRegisteredAt='2026-09-19T00:00:00+00:00')
        result = export_operations(self.binding, now=NOW)
        self.assertGreater(result['sourceAsOf'],base['sourceAsOf'])
        self.assertIsNone(result['strategies']['value'][1]['activationObservedAt']['value'])
        self.assertEqual(result['strategies']['value'][1]['effectiveFrom']['value'],release['effective_at'])

    def test_identical_saved_inputs_ignore_only_observation_and_export_clocks(self):
        first = export_operations(self.binding,session='2026-09-18',now=NOW)
        second = export_operations(self.binding,session='2026-09-18',now='2026-09-19T00:02:00+00:00')
        self.assertEqual(meaningful(first),meaningful(second))
        self.assertNotEqual(first['exportedAt'],second['exportedAt'])

    def test_rejects_conflicting_equal_time_reports(self):
        conflicting = copy.deepcopy(self.report)
        conflicting['report']['quality']['decision_verified'] = False
        (self.root/'operations/reports/daily-conflict.json').write_text(json.dumps(conflicting))
        with self.assertRaises(ValueError):
            export_operations(self.binding,session='2026-09-18',now=NOW)

    def test_rejects_progress_from_different_universe(self):
        path = self.root/'data/progress-2026-09-18.json'
        progress = json.loads(path.read_text())
        progress['universe_count'] = 62
        path.write_text(json.dumps(progress))
        with self.assertRaises(ValueError):
            export_operations(self.binding,session='2026-09-18',now=NOW)

    def test_rejects_file_appearance_mid_read(self):
        path = self.root/'data/snapshots/2026-09-18.json'
        contents = path.read_bytes()
        path.unlink()
        original = Path.read_bytes
        def read(current):
            raw = original(current)
            if current.name.startswith('daily-'):
                path.write_bytes(contents)
            return raw
        with patch.object(Path,'read_bytes',read), self.assertRaises(ValueError):
            export_operations(self.binding,session='2026-09-18',now=NOW)

    def test_report_absent_keeps_collector_progress_separate_from_live_running(self):
        (self.root/'operations/reports/daily-2026-09-19.json').unlink()
        result = export_operations(self.binding,session='2026-09-18',now=NOW)
        self.assertEqual(result['stages'][0]['status'],'not-recorded')
        self.assertEqual(result['stages'][0]['progress']['value']['processed'],61)
        self.assertIsNone(result['stages'][4]['action']['value'])


if __name__ == '__main__':
    import sys
    if sys.argv[1:] == ['--synthetic-preview']:
        with tempfile.TemporaryDirectory() as directory:
            binding, _, _ = saved_source(Path(directory))
            print(json.dumps({'month':export_operations(binding,now=NOW),'session':export_operations(binding,session='2026-09-18',now=NOW)}))
    else:
        unittest.main()
