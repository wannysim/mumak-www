"""Synthetic saved symbol_plan -> real exporter -> existing decimal consumers."""
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from export_observation import export_observation
from project_symbol_observation import CANDIDATE_SHA256
from public_observation import validate_observation
from test_observation import AT, NOW, UNTIL, absent, native_fixture


def produced_symbol_fixture(*, scientific=False):
    state = {'symbol':'TEST','qty':1,'entry_modeled_vwap':'100',
             'high_water_nominal':'100','sigma_entry':'0.02',
             'symbol_data_hold':False,'corporate_basis_hold':False,
             'same_session_buy_block':None}
    saved = {'candidateSourceSha256':CANDIDATE_SHA256,
             'context':{'now_utc':AT,'session_ny':'2026-09-18',
                        'positions':{'TEST':{'qty':1}},'cash_decimal':'99999900',
                        'prices':{'TEST':'100'}},
             'plan':{'config':{'strategy_id':'C','k':'3','gamma':'0.003'},
                     'sells':[],'state_updates':{'TEST':state},'symbol_holds':{}},
             'validUntil':UNTIL,'evidenceId':'risk'}
    if scientific:
        state.update(entry_modeled_vwap='1E-8', high_water_nominal='1E-8', sigma_entry='2E-8')
        saved['context'].update(cash_decimal='99999999.99999999', prices={'TEST':'1E-8'})
        saved['plan']['config']['gamma'] = '3E-8'
    native = native_fixture()
    native['symbols'] = absent()
    native['symbol_plan'] = saved
    with tempfile.TemporaryDirectory() as directory:
        raw = json.dumps(native).encode()
        Path(directory, 'receipt.json').write_bytes(raw)
        binding = {'sourceRoot':directory,'receiptFile':'receipt.json',
                   'receiptSha256':hashlib.sha256(raw).hexdigest(),
                   'episodeId':'synthetic-paper','month':'2026-09','origin':'synthetic'}
        return export_observation(binding, now=NOW)


class SymbolProjectionTests(unittest.TestCase):
    def test_small_positive_proxy_is_accepted_by_real_exporter(self):
        payload = produced_symbol_fixture()
        row = payload['symbols']['value'][0]
        self.assertEqual(row['exposureProxy'], '0.00000002')
        self.assertEqual((row['state'], row['targetQuantity']), ('monitor', 1))
        self.assertEqual(validate_observation(payload), payload)

    def test_all_decimal_outputs_use_lossless_fixed_point(self):
        payload = produced_symbol_fixture(scientific=True)
        row = payload['symbols']['value'][0]
        expected = {'entryPrice':'0.00000001','sigmaEntry':'0.00000002',
                    'highWater':'0.00000001','mark':'0.00000001',
                    'stopThreshold':'0.0000000097','exposureProxy':'0.000000000000000000000002',
                    'gamma':'0.00000003'}
        for field, value in expected.items():
            with self.subTest(field=field):
                self.assertNotRegex(row[field], '[eE]')
                self.assertEqual(Decimal(row[field]), Decimal(value))
        self.assertEqual(validate_observation(payload), payload)

    def test_small_positive_proxy_roundtrips_through_real_005(self):
        payload = produced_symbol_fixture()
        app = Path(__file__).parent.parent
        result = subprocess.run(['node','scripts/verify-observation-db.mjs'],
                                input=json.dumps({'payload':payload,'invalid':[]}),
                                text=True,cwd=app,capture_output=True,timeout=90,
                                env=os.environ.copy())
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        self.assertIn('observation SQL PASS', result.stdout)


if __name__ == '__main__':
    import sys
    if sys.argv[1:] == ['--synthetic-preview']:
        print(json.dumps(produced_symbol_fixture()))
    else:
        unittest.main()
