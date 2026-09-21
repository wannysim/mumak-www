"""Synthetic fixtures for the public projection; never shipped as portfolio data."""
import copy
import json
import sqlite3
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from export_paper import ExportError, export_snapshot

class ExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.db = self.root / 'ledger.sqlite3'
        self.policy = {'live': False, 'paper_start_session': '2026-09-18',
                       'paper_end_session': '2026-09-30', 'initial_virtual_cash_usd': '1000'}
        self.book = {'live': False, 'mode': 'forward_paper', 'state': 'active',
                     'cash': '799', 'nav': '1019', 'positions': {'TEST': {'qty': 2}},
                     'performance_provisional': False, 'corporate_holds': {},
                     'last_observation': '2026-09-18T14:00:00+00:00', 'monthly_halt': False}
        self.fills = [{'id': 'fixture-buy', 'session': '2026-09-18', 'filled_at': '2026-09-18T13:45:00+00:00',
                       'paper_only': True, 'symbol': 'TEST', 'side': 'buy', 'quantity': 2,
                       'modeled_price': '100', 'commission': '1'}]
        self.observations = [
            {'received_at': '2026-09-18T13:30:00+00:00', 'session': '2026-09-18', 'quotes': {}},
            {'received_at': '2026-09-18T14:00:00+00:00', 'session': '2026-09-18',
             'quotes': {'TEST': {'price': '110', 'currency': 'USD', 'asof': '2026-09-18T13:59:00+00:00'}}}]
        self.save()

    def tearDown(self):
        self.tmp.cleanup()

    def save(self):
        with sqlite3.connect(self.db) as c:
            for table in ('book', 'fills', 'observations'):
                c.execute(f'CREATE TABLE IF NOT EXISTS {table}(payload TEXT NOT NULL)')
                c.execute(f'DELETE FROM {table}')
            c.execute('INSERT INTO book VALUES (?)', (json.dumps(self.book),))
            for table, rows in [('fills', self.fills), ('observations', self.observations)]:
                c.executemany(f'INSERT INTO {table} VALUES (?)', [(json.dumps(x),) for x in rows])
        (self.root/'policy.json').write_text(json.dumps(self.policy))

    def export(self):
        return export_snapshot(self.db, self.root/'policy.json', episode_id='test-fixture',
                               now='2026-09-21T06:00:00+00:00')

    def test_projection_reconciles_actual_ledger_and_keeps_quote_time(self):
        before = self.db.read_bytes()
        doc = self.export()
        self.assertEqual(doc['mode'], 'paper')
        self.assertEqual(Decimal(doc['summary']['profit']), Decimal('19'))
        self.assertEqual(Decimal(doc['summary']['returnPct']), Decimal('1.9'))
        self.assertEqual(doc['baselineKind'], 'inception')
        h = doc['holdings'][0]
        self.assertEqual(Decimal(h['averageCost']), Decimal('100.5'))
        self.assertEqual(Decimal(h['unrealizedPnl']), Decimal('19'))
        self.assertEqual(h['markAsOf'], '2026-09-18T13:59:00+00:00')
        self.assertEqual(len(doc['history']), 2)
        self.assertEqual(self.db.read_bytes(), before)
        self.assertNotIn(str(self.root), json.dumps(doc))

    def test_never_exports_live_or_provisional_state(self):
        for key, value in [('live', True), ('mode', 'live'), ('performance_provisional', True),
                           ('corporate_holds', {'TEST': 'split'}), ('net_contributions', '50')]:
            with self.subTest(key=key):
                original = copy.deepcopy(self.book)
                self.book[key] = value
                self.save()
                with self.assertRaises(ExportError):
                    self.export()
                self.book = original

    def test_policy_must_be_paper_single_month_positive_baseline(self):
        for key, value in [('live', True), ('paper_end_session', '2026-10-30'),
                           ('initial_virtual_cash_usd', '0'), ('initial_virtual_cash_usd', 'NaN')]:
            with self.subTest(key=key):
                original = copy.deepcopy(self.policy)
                self.policy[key] = value
                self.save()
                with self.assertRaises(ExportError):
                    self.export()
                self.policy = original

    def test_policy_sessions_are_real_ordered_iso_dates(self):
        for patch in [
            {'paper_start_session': '2026-09-31'},
            {'paper_start_session': '2026-09-20', 'paper_end_session': '2026-09-18'},
            {'paper_start_session': '2026-09-18T00:00:00'},
        ]:
            with self.subTest(patch=patch):
                original = copy.deepcopy(self.policy)
                self.policy.update(patch)
                self.save()
                with self.assertRaises(ExportError):
                    self.export()
                self.policy = original

    def test_records_outside_inclusive_new_york_session_range_are_rejected(self):
        for collection, index, key, value in [
            ('fills', 0, 'filled_at', '2026-09-18T03:59:59+00:00'),
            ('observations', 0, 'received_at', '2026-10-01T04:00:00+00:00'),
        ]:
            with self.subTest(collection=collection, value=value):
                original = copy.deepcopy(getattr(self, collection))
                getattr(self, collection)[index][key] = value
                self.save()
                with self.assertRaises(ExportError):
                    self.export()
                setattr(self, collection, original)

    def test_missing_latest_marks_does_not_export_older_nav_as_current(self):
        self.observations.append({'received_at': '2026-09-18T14:15:00+00:00',
                                  'session': '2026-09-18', 'quotes': {}})
        self.book['last_observation'] = self.observations[-1]['received_at']
        self.save()
        with self.assertRaises(ExportError):
            self.export()

    def test_rejects_wrong_currency_and_future_quotes(self):
        for patch in [{'currency': 'KRW'}, {'asof': '2026-09-18T15:00:00+00:00'}]:
            with self.subTest(patch=patch):
                original = copy.deepcopy(self.observations)
                self.observations[-1]['quotes']['TEST'].update(patch)
                self.save()
                with self.assertRaises(ExportError):
                    self.export()
                self.observations = original

    def test_sale_uses_average_cost_and_reconciles_cash(self):
        self.fills.append({'id': 'fixture-sell', 'session': '2026-09-18',
                          'filled_at': '2026-09-18T13:50:00+00:00', 'paper_only': True,
                          'symbol': 'TEST', 'side': 'sell', 'quantity': 1,
                          'modeled_price': '120', 'commission': '1'})
        self.book.update(cash='918', nav='1028', positions={'TEST': {'qty': 1}})
        self.save()
        doc = self.export()
        self.assertEqual(Decimal(doc['summary']['profit']), Decimal('28'))
        self.assertEqual(Decimal(doc['holdings'][0]['averageCost']), Decimal('100.5'))
        self.assertEqual(Decimal(doc['holdings'][0]['unrealizedPnl']), Decimal('9.5'))

    def test_corrupt_cash_quantity_nav_never_published(self):
        for patch in [{'cash': '800'}, {'nav': '1020'}, {'positions': {'TEST': {'qty': 3}}}]:
            with self.subTest(patch=patch):
                original = copy.deepcopy(self.book)
                self.book.update(patch)
                self.save()
                with self.assertRaises(ExportError):
                    self.export()
                self.book = original

    def test_identical_export_is_deterministic_and_sorted(self):
        self.assertEqual(self.export(), self.export())
        self.observations.reverse()
        self.save()
        self.assertEqual([h['at'] for h in self.export()['history']], sorted(h['at'] for h in self.export()['history']))

    def test_unsafe_public_identifiers_and_duplicate_fills_rejected(self):
        for patch in [{'symbol': '/home/private'}, {'id': self.fills[0]['id'], 'paper_only': False}]:
            with self.subTest(patch=patch):
                original = copy.deepcopy(self.fills)
                self.fills[0].update(patch)
                self.save()
                with self.assertRaises(ExportError):
                    self.export()
                self.fills = original
        self.fills.append(copy.deepcopy(self.fills[0]))
        self.book.update(cash='598', nav='1038', positions={'TEST': {'qty': 4}})
        self.save()
        with self.assertRaises(ExportError):
            self.export()

if __name__ == '__main__':
    unittest.main()
