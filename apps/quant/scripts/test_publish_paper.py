"""No-network publisher tests: transport is injected, never a broker client."""
import copy
import unittest
from unittest.mock import Mock
from publish_paper import publish, PublishError

class PublishTests(unittest.TestCase):
    def setUp(self):
        self.doc = {'schemaVersion': 1, 'mode': 'paper', 'episodeId': 'test',
                    'month': '2026-09', 'label': 'fixture', 'currency': 'USD', 'status': 'active',
                    'startedAt': '2026-09-18T13:30:00+00:00',
                    'asOf': '2026-09-18T14:00:00+00:00',
                    'exportedAt': '2026-09-21T06:00:00+00:00',
                    'source': 'forward-paper-ledger', 'baselineKind': 'inception',
                    'summary': {'startingNav': '1000', 'currentNav': '1019', 'cash': '799',
                                'netContributions': '0', 'profit': '19', 'returnPct': '1.9',
                                'returnMethod': 'simple-no-flows'},
                    'holdings': [{'symbol': 'TEST', 'quantity': '2', 'averageCost': '100.5',
                                  'markPrice': '110', 'markAsOf': '2026-09-18T13:59:00+00:00',
                                  'marketValue': '220', 'unrealizedPnl': '19', 'returnPct': '9.45'}],
                    'history': [{'at': '2026-09-18T14:00:00+00:00', 'nav': '1019',
                                 'profit': '19', 'returnPct': '1.9'}],
                    'fills': [{'id': 'fixture-buy', 'at': '2026-09-18T13:45:00+00:00',
                               'symbol': 'TEST', 'side': 'buy', 'quantity': '2', 'price': '100',
                               'commission': '1'}],
                    'notes': ['arbitrary public note']}
        self.row = {'episode_id': 'test', 'month': '2026-09', 'as_of': self.doc['asOf'], 'payload': self.doc}

    def test_publish_then_read_back_exact_payload(self):
        transport = Mock(side_effect=[True, [self.row]])
        self.assertEqual(publish(self.doc, 'https://fixture.supabase.co', 'test-key', transport), 'verified')
        self.assertEqual(transport.call_args_list[0].args[0], 'POST')
        self.assertTrue(transport.call_args_list[0].args[1].endswith('/rpc/publish_paper_snapshot'))
        self.assertEqual(transport.call_args_list[1].args[0], 'GET')

    def test_refuses_live_source_and_bad_host_without_network(self):
        cases = [({**self.doc, 'mode': 'live'}, 'https://fixture.supabase.co', 'test-key'),
                 ({**self.doc, 'source': 'live-ledger'}, 'https://fixture.supabase.co', 'test-key'),
                 (self.doc, 'http://fixture.supabase.co', 'test-key'),
                 (self.doc, 'https://fixture.supabase.co.evil.invalid', 'test-key'),
                 (self.doc, 'https://fixture.supabase.co', '')]
        for doc, url, key in cases:
            transport = Mock()
            with self.assertRaises(PublishError):
                publish(doc, url, key, transport)
            transport.assert_not_called()

    def test_failed_or_stale_write_never_reported_success(self):
        for result in [False, None]:
            with self.subTest(result=result):
                transport = Mock(side_effect=[result, [self.row]])
                with self.assertRaises(PublishError):
                    publish(self.doc, 'https://fixture.supabase.co', 'test-key', transport)
        transport = Mock(side_effect=[True, [{**self.row, 'month': '2026-10'}]])
        with self.assertRaises(PublishError):
            publish(self.doc, 'https://fixture.supabase.co', 'test-key', transport)

    def test_extra_top_level_or_nested_fields_are_rejected_before_post(self):
        cases = []
        for path in [('unexpectedSecret',), ('summary', 'unexpectedSecret'),
                     ('holdings', 0, 'unexpectedSecret'), ('history', 0, 'unexpectedSecret'),
                     ('fills', 0, 'unexpectedSecret')]:
            doc = copy.deepcopy(self.doc)
            target = doc
            for part in path[:-1]:
                target = target[part]
            target[path[-1]] = 'private'
            cases.append(doc)
        for doc in cases:
            transport = Mock()
            with self.assertRaises(PublishError):
                publish(doc, 'https://fixture.supabase.co', 'test-key', transport)
            transport.assert_not_called()

    def test_missing_required_contract_fields_are_rejected_before_post(self):
        for path in [('label',), ('summary', 'cash'), ('holdings', 0, 'symbol'),
                     ('history', 0, 'nav'), ('fills', 0, 'commission'), ('notes',)]:
            doc = copy.deepcopy(self.doc)
            target = doc
            for part in path[:-1]:
                target = target[part]
            del target[path[-1]]
            transport = Mock()
            with self.assertRaises(PublishError):
                publish(doc, 'https://fixture.supabase.co', 'test-key', transport)
            transport.assert_not_called()

if __name__ == '__main__':
    unittest.main()
