"""Synthetic month-carry projection tests; no production ledger or network access."""
import copy
import json
import sqlite3
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

from export_paper import ExportError
from export_carry_paper import export_carry_snapshot
from publish_paper import PublishError, build_snapshot, is_publishable_snapshot


class CarryExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.sep = self.root / 'september.sqlite3'
        self.oct = self.root / 'october.sqlite3'
        self.sep_policy = self.root / 'september-policy.json'
        self.oct_policy = self.root / 'october-policy.json'
        self.sep_policy.write_text(json.dumps({
            'live': False, 'paper_start_session': '2026-09-18',
            'paper_end_session': '2026-09-30', 'initial_virtual_cash_usd': '1000',
        }))
        self.oct_policy.write_text(json.dumps({
            'live': False, 'paper_start_session': '2026-10-01',
            'paper_end_session': '2026-10-30', 'initial_virtual_cash_usd': '1000',
        }))
        self.sep_book = {
            'live': False, 'mode': 'forward_paper', 'cash': '799', 'nav': '1019',
            'positions': {'TEST': {'qty': 2}}, 'performance_provisional': False,
            'corporate_holds': {}, 'monthly_halt': False,
            'last_observation': '2026-09-30T20:15:00+00:00',
        }
        self.sep_fills = [{
            'id': 'sep-buy', 'session': '2026-09-18',
            'filled_at': '2026-09-18T13:45:00+00:00', 'paper_only': True,
            'symbol': 'TEST', 'side': 'buy', 'quantity': 2,
            'modeled_price': '100', 'commission': '1', 'reason': 'rebalance',
        }]
        self.sep_obs = [
            {'received_at': '2026-09-18T13:30:00+00:00', 'quotes': {}, 'session': '2026-09-18'},
            {'received_at': '2026-09-30T20:15:00+00:00', 'session': '2026-09-30',
             'quotes': {'TEST': {'price': '110', 'currency': 'USD',
                                 'asof': '2026-09-30T20:00:00+00:00'}}},
        ]
        self.opening = {
            'live': False, 'mode': 'forward_paper', 'month': '2026-10',
            'not_a_fill': True, 'no_retrospective_execution': True,
            'cash': '799', 'month_start_nav': '1019',
            'positions': {'TEST': {'qty': 2}},
            'source_close': {'nav': '1019', 'session': '2026-09-30'},
            'source_close_observation': {'received_at': '2026-09-30T20:15:00+00:00',
                                         'quotes': {'TEST': {'price': '110', 'currency': 'USD',
                                                             'asof': '2026-09-30T20:00:00+00:00'}}},
        }
        self.oct_book = {
            'live': False, 'mode': 'forward_paper', 'month': '2026-10',
            'cash': '928', 'nav': '1053', 'positions': {'TEST': {'qty': 1}},
            'performance_provisional': False, 'corporate_holds': {},
            'monthly_halt': False, 'last_observation': '2026-10-02T14:00:00+00:00',
            'month_start_nav': '1019',
        }
        self.oct_fills = [{
            'id': 'oct-sell', 'session': '2026-10-02', 'filled_at': '2026-10-02T13:45:00+00:00',
            'paper_only': True, 'symbol': 'TEST', 'side': 'sell', 'quantity': 1,
            'modeled_price': '130', 'commission': '1', 'reason': 'concentration_reduction',
        }]
        self.oct_obs = [
            {'received_at': '2026-10-01T13:30:00+00:00', 'session': '2026-10-01',
             'quotes': {'TEST': {'price': '120', 'currency': 'USD',
                                 'asof': '2026-10-01T13:29:00+00:00'}}},
            {'received_at': '2026-10-02T14:00:00+00:00', 'session': '2026-10-02',
             'quotes': {'TEST': {'price': '125', 'currency': 'USD',
                                 'asof': '2026-10-02T13:59:00+00:00'}}},
        ]
        self.save()

    def tearDown(self):
        self.tmp.cleanup()

    def save(self):
        for path, values in (
            (self.sep, {'book': [self.sep_book], 'fills': self.sep_fills,
                        'observations': self.sep_obs}),
            (self.oct, {'book': [self.oct_book], 'opening_balance': [self.opening],
                        'fills': self.oct_fills, 'observations': self.oct_obs}),
        ):
            with sqlite3.connect(path) as conn:
                for table, docs in values.items():
                    conn.execute(f'CREATE TABLE IF NOT EXISTS {table}(payload TEXT NOT NULL)')
                    conn.execute(f'DELETE FROM {table}')
                    conn.executemany(f'INSERT INTO {table}(payload) VALUES (?)',
                                     [(json.dumps(doc),) for doc in docs])

    def export(self):
        return export_carry_snapshot(
            self.oct, self.oct_policy, self.sep, self.sep_policy,
            episode_id='oct2026-low-frequency', now='2026-10-02T15:00:00+00:00',
        )

    def test_projects_month_start_carry_without_fabricated_fills(self):
        before = (self.sep.read_bytes(), self.oct.read_bytes())
        doc = self.export()
        self.assertEqual((doc['month'], doc['episodeId'], doc['baselineKind']),
                         ('2026-10', 'oct2026-low-frequency', 'month-start'))
        self.assertEqual(doc['summary']['startingNav'], '1019')
        self.assertEqual(doc['summary']['currentNav'], '1053')
        self.assertEqual(Decimal(doc['summary']['profit']), Decimal('34'))
        self.assertEqual(doc['summary']['returnPct'], str((Decimal('1053') / Decimal('1019') - 1) * 100))
        self.assertEqual(doc['summary']['cash'], '928')
        self.assertEqual(doc['history'][0]['at'], '2026-10-01T13:30:00+00:00')
        self.assertEqual([f['id'] for f in doc['fills']], ['oct-sell'])
        self.assertEqual(doc['fills'][0]['reason'], '집중도 한도 조정')
        self.assertEqual(Decimal(doc['holdings'][0]['averageCost']), Decimal('100.5'))
        self.assertTrue(is_publishable_snapshot(doc))
        self.assertNotIn(str(self.root), json.dumps(doc))
        self.assertEqual((self.sep.read_bytes(), self.oct.read_bytes()), before)

    def test_publisher_selects_carry_only_with_both_source_paths(self):
        doc = build_snapshot(self.oct, self.oct_policy, 'oct2026-low-frequency',
                             source_ledger=self.sep, source_policy=self.sep_policy)
        self.assertEqual(doc['month'], '2026-10')
        self.assertEqual(doc['baselineKind'], 'month-start')
        with self.assertRaises(PublishError):
            build_snapshot(self.oct, self.oct_policy, 'oct2026-low-frequency',
                           source_ledger=self.sep)
        with self.assertRaises(ExportError):
            build_snapshot(self.oct, self.oct_policy, 'oct2026-low-frequency')

    def test_fails_closed_on_mismatched_carry_or_current_book(self):
        for field, value in (
            ('opening_cash', '800'), ('opening_nav', '1020'),
            ('opening_qty', 3), ('book_nav', '1054'), ('book_cash', '929'),
            ('provisional', True), ('fill_paper_only', False),
        ):
            with self.subTest(field=field):
                opening, book, fills = copy.deepcopy((self.opening, self.oct_book, self.oct_fills))
                if field == 'opening_cash': self.opening['cash'] = value
                if field == 'opening_nav': self.opening['month_start_nav'] = value
                if field == 'opening_qty': self.opening['positions']['TEST']['qty'] = value
                if field == 'book_nav': self.oct_book['nav'] = value
                if field == 'book_cash': self.oct_book['cash'] = value
                if field == 'provisional': self.oct_book['performance_provisional'] = value
                if field == 'fill_paper_only': self.oct_fills[0]['paper_only'] = value
                self.save()
                with self.assertRaises(ExportError): self.export()
                self.opening, self.oct_book, self.oct_fills = opening, book, fills
                self.save()


if __name__ == '__main__':
    unittest.main()
