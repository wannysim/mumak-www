"""Synthetic contract tests for the intraday paper foundations."""
from datetime import datetime, timezone
from decimal import Decimal
import json
import unittest

from intraday_core import (
    Bar,
    BarValidationError,
    ExchangeCalendarsXNYS,
    SessionWindow,
    StrategyContext,
    StrategyRegistry,
    YahooChartAdapter,
    normalize_yahoo_chart,
)
from intraday_strategy import OpeningRangeBreakout


UTC = timezone.utc


def at(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def bar(symbol, start, close, volume, *, high=None, low=None, opening=None):
    opened = Decimal(opening or close)
    price = Decimal(close)
    return Bar(
        symbol=symbol,
        event_at=at(start),
        completed_at=at(start) + __import__("datetime").timedelta(minutes=5),
        open=opened,
        high=Decimal(high or max(opened, price)),
        low=Decimal(low or min(opened, price)),
        close=price,
        volume=Decimal(volume),
        source_event_id=f"fixture:{symbol}:{start}",
    )


class StaticCalendar:
    def session(self, session):
        if session == "2026-11-27":
            return SessionWindow(session, at("2026-11-27T14:30:00Z"), at("2026-11-27T18:00:00Z"))
        if session == "2026-11-02":
            return SessionWindow(session, at("2026-11-02T14:30:00Z"), at("2026-11-02T21:00:00Z"))
        return None


class IntradayFoundationTests(unittest.TestCase):
    def test_registry_resolves_typed_strategy_without_ledger_capability(self):
        registry = StrategyRegistry()
        strategy = OpeningRangeBreakout()
        registry.register(strategy)

        self.assertIs(registry.resolve("opening-range-breakout-long-v1"), strategy)
        self.assertFalse(hasattr(strategy, "fill"))
        self.assertFalse(hasattr(strategy, "write_ledger"))

    def test_strategy_uses_only_completed_bars_and_emits_durable_intent_contract(self):
        strategy = OpeningRangeBreakout()
        bars = {
            "SPY": (
                bar("SPY", "2026-09-28T13:30:00Z", "100", "500", high="101", low="99"),
                bar("SPY", "2026-09-28T13:35:00Z", "100.50", "500", high="100.8", low="100"),
                bar("SPY", "2026-09-28T13:40:00Z", "100.75", "600", high="100.9", low="100.4"),
                bar("SPY", "2026-09-28T13:45:00Z", "101.20", "900", high="101.30", low="100.8"),
                # This bar has not completed when the decision is made and must be ignored.
                bar("SPY", "2026-09-28T13:50:00Z", "110", "9000"),
            )
        }
        context = StrategyContext(
            run_id="fixture-run",
            session="2026-09-28",
            signal_at=at("2026-09-28T13:52:00Z"),
            session_window=SessionWindow(
                "2026-09-28", at("2026-09-28T13:30:00Z"), at("2026-09-28T20:00:00Z")
            ),
            bars=bars,
            positions={},
            prior_opening_volumes={"SPY": (Decimal("800"), Decimal("1000"))},
            parameters={
                "opening_range_bars": 3,
                "breakout_buffer_bps": 5,
                "relative_volume_min": "1.50",
                "momentum_bars": 1,
                "stop_loss_pct": "1.00",
                "profit_target_pct": "2.00",
                "max_hold_minutes": 120,
                "last_entry_minutes_before_close": 60,
                "force_exit_minutes_before_close": 20,
            },
        )

        intents = strategy.generate_intents(context)

        self.assertEqual(len(intents), 1)
        intent = intents[0]
        self.assertEqual((intent.symbol, intent.side, intent.reason), ("SPY", "buy", "breakout_entry"))
        self.assertEqual(intent.signal_at, context.signal_at)
        self.assertEqual(intent.eligible_after, at("2026-09-28T13:50:00Z"))
        self.assertEqual(intent.reference_price, Decimal("101.20"))
        self.assertEqual(intent.target_fraction, Decimal("0.20"))
        self.assertIn("fixture-run", intent.intent_id)

    def test_strategy_forces_exit_before_close_but_does_not_create_fill(self):
        strategy = OpeningRangeBreakout()
        context = StrategyContext(
            run_id="fixture-run",
            session="2026-11-27",
            signal_at=at("2026-11-27T17:41:00Z"),
            session_window=StaticCalendar().session("2026-11-27"),
            bars={"SPY": (bar("SPY", "2026-11-27T17:35:00Z", "101", "500"),)},
            positions={"SPY": {"qty": "10", "average_cost": "100"}},
            prior_opening_volumes={},
            parameters={
                "opening_range_bars": 3,
                "breakout_buffer_bps": 5,
                "relative_volume_min": "1.50",
                "momentum_bars": 1,
                "stop_loss_pct": "1.00",
                "profit_target_pct": "2.00",
                "max_hold_minutes": 120,
                "last_entry_minutes_before_close": 60,
                "force_exit_minutes_before_close": 20,
            },
        )

        intents = strategy.generate_intents(context)

        self.assertEqual([(intent.side, intent.reason) for intent in intents], [("sell", "session_exit")])
        self.assertEqual(intents[0].eligible_after, at("2026-11-27T17:40:00Z"))

    def test_injected_calendar_preserves_dst_and_early_close_boundaries(self):
        calendar = StaticCalendar()
        self.assertEqual(calendar.session("2026-11-02").open_at, at("2026-11-02T14:30:00Z"))
        self.assertEqual(calendar.session("2026-11-27").close_at, at("2026-11-27T18:00:00Z"))

    def test_yahoo_adapter_is_bounded_no_auth_and_retries_transient_failure(self):
        payload = {
            "chart": {
                "error": None,
                "result": [{
                    "meta": {
                        "symbol": "SPY", "currency": "USD",
                        "exchangeTimezoneName": "America/New_York", "dataGranularity": "5m",
                    },
                    "timestamp": [1790602200],
                    "indicators": {"quote": [{
                        "open": [100], "high": [102], "low": [99], "close": [101], "volume": [1000],
                    }]},
                }],
            }
        }
        calls = []

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self, limit):
                self.limit = limit
                return json.dumps(payload).encode()

        def opener(request, timeout):
            calls.append((request.full_url, dict(request.header_items()), timeout))
            if len(calls) == 1:
                raise TimeoutError("fixture timeout")
            return Response()

        clock = iter((at("2026-09-28T13:34:00Z"), at("2026-09-28T13:47:00Z")))
        delays = []
        adapter = YahooChartAdapter(
            opener=opener,
            now=lambda: next(clock),
            sleep=delays.append,
            max_attempts=2,
        )

        batch = adapter.fetch("SPY", requested_at=at("2026-09-28T13:34:00Z"))

        self.assertEqual(len(calls), 2)
        self.assertEqual(delays, [0.25])
        self.assertNotIn("key=", calls[-1][0])
        self.assertIn("interval=5m", calls[-1][0])
        self.assertIn("range=5d", calls[-1][0])
        self.assertEqual(batch.source, "yahoo-chart-no-auth")

    def test_exchange_calendar_dependency_is_explicit(self):
        class Calendar:
            def is_session(self, session):
                return True

            def session_open(self, session):
                self.open_session = session
                return at("2026-11-27T14:30:00Z")

            def session_close(self, session):
                return at("2026-11-27T18:00:00Z")

        wrapper = ExchangeCalendarsXNYS(calendar=Calendar())
        window = wrapper.session("2026-11-27")
        self.assertEqual(window.open_at, at("2026-11-27T14:30:00Z"))
        self.assertEqual(window.close_at, at("2026-11-27T18:00:00Z"))

    def test_yahoo_normalizer_records_provenance_and_rejects_bad_sequences(self):
        payload = {
            "chart": {
                "error": None,
                "result": [
                    {
                        "meta": {
                            "symbol": "SPY",
                            "currency": "USD",
                            "exchangeTimezoneName": "America/New_York",
                            "dataGranularity": "5m",
                        },
                        "timestamp": [1790602200, 1790602500],
                        "indicators": {
                            "quote": [
                                {
                                    "open": [100, 101],
                                    "high": [102, 103],
                                    "low": [99, 100],
                                    "close": [101, 102],
                                    "volume": [1000, 1200],
                                }
                            ]
                        },
                    }
                ],
            }
        }
        raw = json.dumps(payload, separators=(",", ":")).encode()
        batch = normalize_yahoo_chart(
            raw,
            symbol="SPY",
            request_url="https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=5m&range=5d",
            requested_at=at("2026-09-28T13:34:00Z"),
            received_at=at("2026-09-28T13:47:00Z"),
        )

        self.assertEqual(len(batch.bars), 2)
        self.assertEqual(batch.raw_response, raw)
        self.assertRegex(batch.raw_sha256, r"^[0-9a-f]{64}$")
        self.assertTrue(all(item.completed_at <= batch.received_at for item in batch.bars))

        payload["chart"]["result"][0]["timestamp"] = [1790602500, 1790602200]
        with self.assertRaisesRegex(BarValidationError, "reordered"):
            normalize_yahoo_chart(
                json.dumps(payload).encode(),
                symbol="SPY",
                request_url="https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=5m&range=5d",
                requested_at=at("2026-09-28T13:34:00Z"),
                received_at=at("2026-09-28T13:47:00Z"),
            )

    def test_yahoo_normalizer_fails_closed_on_missing_future_and_conflicting_revision(self):
        base = {
            "meta": {
                "symbol": "SPY",
                "currency": "USD",
                "exchangeTimezoneName": "America/New_York",
                "dataGranularity": "5m",
            },
            "timestamp": [1790602200],
            "indicators": {
                "quote": [{"open": [100], "high": [102], "low": [99], "close": [101], "volume": [1000]}]
            },
        }
        for label, patch, message in [
            ("missing", {"close": [None]}, "missing"),
            ("future", None, "future-start"),
        ]:
            with self.subTest(label=label):
                item = json.loads(json.dumps(base))
                if patch:
                    item["indicators"]["quote"][0].update(patch)
                if label == "future":
                    item["timestamp"] = [1790603400]
                received = at("2026-09-28T13:47:00Z")
                with self.assertRaisesRegex(BarValidationError, message):
                    normalize_yahoo_chart(
                        json.dumps({"chart": {"error": None, "result": [item]}}).encode(),
                        symbol="SPY",
                        request_url="https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=5m&range=5d",
                        requested_at=at("2026-09-28T13:30:00Z"),
                        received_at=received,
                    )

        item = json.loads(json.dumps(base))
        item["timestamp"] = [1790602200, 1790602200]
        item["indicators"]["quote"][0] = {
            "open": [100, 100], "high": [102, 102], "low": [99, 99],
            "close": [101, 101.5], "volume": [1000, 1000],
        }
        with self.assertRaisesRegex(BarValidationError, "conflicting revision"):
            normalize_yahoo_chart(
                json.dumps({"chart": {"error": None, "result": [item]}}).encode(),
                symbol="SPY",
                request_url="https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=5m&range=5d",
                requested_at=at("2026-09-28T13:34:00Z"),
                received_at=at("2026-09-28T13:47:00Z"),
            )

    def test_yahoo_normalizer_excludes_only_a_legitimate_forming_tail_and_keeps_events(self):
        payload = {
            "chart": {
                "error": None,
                "result": [{
                    "meta": {
                        "symbol": "AAPL", "currency": "USD",
                        "exchangeTimezoneName": "America/New_York", "dataGranularity": "5m",
                    },
                    "timestamp": [1790602200, 1790602500],
                    "indicators": {"quote": [{
                        "open": [100, None], "high": [101, None], "low": [99, None],
                        "close": [100.5, None], "volume": [1000, None],
                    }]},
                    "events": {"dividends": {"1790602200": {"date": 1790602200, "amount": 0.25}}},
                }],
            }
        }
        batch = normalize_yahoo_chart(
            json.dumps(payload).encode(),
            symbol="AAPL",
            request_url="https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=5m&range=5d",
            requested_at=at("2026-09-28T13:34:00Z"),
            received_at=at("2026-09-28T13:37:00Z"),
        )
        self.assertEqual([item.event_at for item in batch.bars], [at("2026-09-28T13:30:00Z")])
        self.assertEqual(batch.corporate_actions[0]["type"], "dividend")

        payload["chart"]["result"][0]["timestamp"] = [1790602500, 1790602200]
        with self.assertRaisesRegex(BarValidationError, "reordered"):
            normalize_yahoo_chart(
                json.dumps(payload).encode(),
                symbol="AAPL",
                request_url="https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=5m&range=5d",
                requested_at=at("2026-09-28T13:34:00Z"),
                received_at=at("2026-09-28T13:47:00Z"),
            )


if __name__ == "__main__":
    unittest.main()
