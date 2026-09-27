"""Synthetic end-to-end tests for the isolated intraday paper ledger."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import copy
from contextlib import redirect_stdout
import fcntl
import io
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from intraday_core import Bar, BarBatch, SessionWindow, digest
from intraday_paper import (
    ConfigError,
    IntradayPaperEngine,
    RunBusyError,
    StateError,
    main,
    modeled_fill,
    validate_config,
)


UTC = timezone.utc


def at(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class FixtureCalendar:
    WINDOWS = {
        "2026-09-25": ("2026-09-25T13:30:00Z", "2026-09-25T20:00:00Z"),
        "2026-09-28": ("2026-09-28T13:30:00Z", "2026-09-28T20:00:00Z"),
        "2026-09-29": ("2026-09-29T13:30:00Z", "2026-09-29T20:00:00Z"),
        "2026-09-30": ("2026-09-30T13:30:00Z", "2026-09-30T20:00:00Z"),
    }

    def session(self, session):
        values = self.WINDOWS.get(session)
        return SessionWindow(session, at(values[0]), at(values[1])) if values else None


def config(run_id="intraday-fixture-a", episode_id="paper-intraday-fixture-a", universe=None):
    return {
        "schema_version": 1,
        "run_id": run_id,
        "episode_id": episode_id,
        "live": False,
        "mode": "forward_paper",
        "strategy_id": "opening-range-breakout-long-v1",
        "strategy_version": "orb-long-15m-v1",
        "initialized_at": "2026-09-26T12:00:00+00:00",
        "period": {"start": "2026-09-28", "end": "2026-09-30"},
        "initial_virtual_cash_usd": "100000",
        "universe": universe or ["AAPL"],
        "data": {"bar_minutes": 5, "max_delay_seconds": 120, "max_attempts": 3},
        "costs": {
            "commission_bps_each_side": "10",
            "slippage_bps_each_side": "5",
            "stress_commission_bps_each_side": "20",
            "stress_slippage_bps_each_side": "10",
        },
        "risk": {
            "max_positions": 4,
            "position_cap_pct": "20",
            "minimum_cash_pct": "20",
            "max_entries_per_symbol_day": 2,
            "max_entries_per_day": 12,
            "max_trades_per_day": 24,
            "max_daily_turnover_pct": "160",
            "daily_loss_stop_pct": "1",
            "episode_loss_stop_pct": "10",
        },
        "strategy": {
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
        "presentation": {
            "label": "테스트 전용 장중 ORB 모의운용",
            "notes": ["테스트 전용 합성 데이터입니다."],
        },
        "hypothesis": "A completed-bar long-only opening-range breakout may be measurable after costs.",
        "references": ["doi:10.1016/j.jfineco.2018.05.009"],
    }


def make_bar(symbol, start, close, volume="1000", *, high=None, low=None, opening=None, suffix=""):
    price = Decimal(close)
    opened = Decimal(opening or close)
    return Bar(
        symbol=symbol,
        event_at=at(start),
        completed_at=at(start) + timedelta(minutes=5),
        open=opened,
        high=Decimal(high or max(opened, price)),
        low=Decimal(low or min(opened, price)),
        close=price,
        volume=Decimal(volume),
        source_event_id=f"fixture:{symbol}:{start}:{suffix}",
    )


def series(symbol, through="13:45", latest="102", *, revision=""):
    bars = [
        make_bar(symbol, "2026-09-25T13:30:00Z", "98", "300"),
        make_bar(symbol, "2026-09-25T13:35:00Z", "98.2", "300"),
        make_bar(symbol, "2026-09-25T13:40:00Z", "98.1", "300"),
        make_bar(symbol, "2026-09-28T13:30:00Z", "100", "500", high="100.5", low="99.5"),
        make_bar(symbol, "2026-09-28T13:35:00Z", "100.2", "500", high="100.6", low="100"),
        make_bar(symbol, "2026-09-28T13:40:00Z", "100.4", "500", high="100.8", low="100.1"),
    ]
    additions = {
        "13:45": [("2026-09-28T13:45:00Z", latest)],
        "13:50": [("2026-09-28T13:45:00Z", "102"), ("2026-09-28T13:50:00Z", latest)],
        "13:55": [
            ("2026-09-28T13:45:00Z", "102"),
            ("2026-09-28T13:50:00Z", "102.2"),
            ("2026-09-28T13:55:00Z", latest),
        ],
    }
    for start, close in additions[through]:
        bars.append(make_bar(symbol, start, close, "900", suffix=revision))
    return tuple(bars)


def batch(symbol, received, bars, *, corporate_actions=()):
    raw = json.dumps({"fixture": symbol, "received": received, "bars": [item.private_record() for item in bars]}).encode()
    return BarBatch(
        source="synthetic-test-only",
        symbol=symbol,
        request_url=f"fixture://{symbol}",
        requested_at=at(received) - timedelta(seconds=1),
        received_at=at(received),
        raw_sha256=digest(raw),
        raw_response=raw,
        bars=tuple(bars),
        corporate_actions=tuple(corporate_actions),
    )


def custom_series(symbol, closes, *, day="2026-09-28"):
    bars = [
        make_bar(symbol, "2026-09-25T13:30:00Z", "98", "300"),
        make_bar(symbol, "2026-09-25T13:35:00Z", "98.2", "300"),
        make_bar(symbol, "2026-09-25T13:40:00Z", "98.1", "300"),
    ]
    opened = at(f"{day}T13:30:00Z")
    for index, close in enumerate(closes):
        start = opened + timedelta(minutes=5 * index)
        price = Decimal(close)
        bars.append(make_bar(
            symbol,
            start.isoformat(),
            close,
            "500" if index < 3 else "900",
            high=str(price + Decimal("0.1")),
            low=str(price - Decimal("0.1")),
        ))
    return tuple(bars)


class FixtureAdapter:
    def __init__(self, batches):
        self.batches = batches
        self.calls = []

    def fetch(self, symbol, *, requested_at):
        self.calls.append((symbol, requested_at))
        value = self.batches[symbol]
        if isinstance(value, Exception):
            raise value
        return value


class IntradayPaperTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.engine = IntradayPaperEngine(self.root, calendar=FixtureCalendar())
        self.policy = config()

    def tearDown(self):
        self.tmp.cleanup()

    def initialize(self, policy=None):
        return self.engine.initialize(policy or self.policy, at_time=at("2026-09-26T12:00:00Z"))

    def test_config_is_strict_preregistered_and_run_identity_is_immutable(self):
        clean = validate_config(self.policy, calendar=FixtureCalendar())
        self.assertEqual(clean["initial_virtual_cash_usd"], "100000")
        self.assertEqual(clean["strategy"]["opening_range_bars"], 3)
        status = self.initialize()
        self.assertEqual(status["cash"], "100000")
        self.assertEqual(status["state"], "pending")

        changed = copy.deepcopy(self.policy)
        changed["strategy"]["breakout_buffer_bps"] = 6
        with self.assertRaisesRegex(ConfigError, "immutable"):
            self.engine.initialize(changed, at_time=at("2026-09-26T12:00:00Z"))

        for path, value in [
            (("live",), True),
            (("initial_virtual_cash_usd",), "99999"),
            (("risk", "position_cap_pct"), "25"),
            (("risk", "daily_loss_stop_pct"), "1.5"),
            (("risk", "episode_loss_stop_pct"), "31"),
            (("data", "bar_minutes"), 1),
        ]:
            with self.subTest(path=path):
                invalid = copy.deepcopy(self.policy)
                target = invalid
                for key in path[:-1]:
                    target = target[key]
                target[path[-1]] = value
                with self.assertRaises(ConfigError):
                    validate_config(invalid, calendar=FixtureCalendar())

    def test_initialization_retries_empty_orphan_without_losing_evidence(self):
        run_dir = self.root / self.policy["run_id"]
        def fail_after_create(directory):
            with sqlite3.connect(directory / "ledger.sqlite3"):
                pass
            raise OSError("injected schema-write failure")

        with patch.object(self.engine, "_connect", side_effect=fail_after_create):
            with self.assertRaisesRegex(OSError, "schema-write failure"):
                self.initialize()
        self.assertTrue((run_dir / "ledger.sqlite3").exists())
        self.assertEqual(self.initialize()["state"], "pending")
        self.assertEqual(self.initialize()["cash"], "100000")
        self.assertTrue(any(run_dir.glob("ledger.sqlite3.orphan-*")))

    def test_initialization_retries_partial_empty_schema_without_resetting_it(self):
        run_dir = self.root / self.policy["run_id"]
        run_dir.mkdir()
        (run_dir / "config.json").write_text(json.dumps(self.policy))
        with sqlite3.connect(run_dir / "ledger.sqlite3") as db:
            db.execute("CREATE TABLE book(id INTEGER PRIMARY KEY, payload TEXT NOT NULL)")
        self.assertEqual(self.initialize()["state"], "pending")
        archives = list(run_dir.glob("ledger.sqlite3.orphan-*"))
        self.assertEqual(len(archives), 1)
        with sqlite3.connect(archives[0]) as db:
            self.assertEqual(db.execute("SELECT name FROM sqlite_master WHERE name='book'").fetchone()[0], "book")

    def test_initialization_does_not_reset_populated_conflicting_ledger(self):
        run_dir = self.root / self.policy["run_id"]
        run_dir.mkdir()
        (run_dir / "config.json").write_text(json.dumps(self.policy))
        ledger = run_dir / "ledger.sqlite3"
        with sqlite3.connect(ledger) as db:
            db.execute("CREATE TABLE evidence(payload TEXT)")
            db.execute("INSERT INTO evidence VALUES('preserve me')")
        with self.assertRaises(StateError):
            self.initialize()
        with sqlite3.connect(ledger) as db:
            self.assertEqual(db.execute("SELECT payload FROM evidence").fetchone()[0], "preserve me")

    def test_cross_symbol_stale_at_aggregate_observation_holds(self):
        policy = config("async-review", "async-review-episode", ["AAPL", "MSFT"])
        self.initialize(policy)
        batches = {
            "AAPL": batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL")),
            "MSFT": batch("MSFT", "2026-09-28T14:01:00Z", series("MSFT", "13:55", latest="103")),
        }
        status = self.engine.tick(policy["run_id"], adapter=FixtureAdapter(batches), at_time=at("2026-09-28T13:51:00Z"))
        self.assertTrue(status["data_hold"])
        self.assertEqual(status["pending_intents"], 0)
        self.assertIsNone(status["last_observation"])

    def test_injected_adapter_future_completed_bar_holds(self):
        self.initialize()
        future = batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL", "13:55", latest="103"))
        status = self.engine.tick(self.policy["run_id"], adapter=FixtureAdapter({"AAPL": future}),
                                  at_time=at("2026-09-28T13:51:00Z"))
        self.assertTrue(status["data_hold"])
        self.assertEqual(status["pending_intents"], 0)
        self.assertIsNone(status["last_observation"])

    def test_boolean_risk_caps_are_rejected(self):
        for key in ("max_positions", "max_entries_per_symbol_day", "max_entries_per_day", "max_trades_per_day"):
            with self.subTest(key=key):
                policy = copy.deepcopy(self.policy)
                policy["risk"][key] = True
                with self.assertRaises(ConfigError):
                    validate_config(policy, calendar=FixtureCalendar())

    def test_before_start_and_non_session_ticks_do_not_fetch(self):
        self.initialize()
        adapter = FixtureAdapter({})
        before = self.engine.tick(self.policy["run_id"], adapter=adapter, at_time=at("2026-09-27T15:00:00Z"))
        self.assertEqual(before["state"], "pending")
        self.assertEqual(adapter.calls, [])

    def test_signal_cannot_fill_same_bar_and_restart_deduplicates_next_bar_fill(self):
        self.initialize()
        first = FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL"))})
        after_signal = self.engine.tick(self.policy["run_id"], adapter=first, at_time=at("2026-09-28T13:51:00Z"))
        self.assertEqual(after_signal["fills"], 0)
        self.assertEqual(after_signal["pending_intents"], 1)

        second = FixtureAdapter({
            "AAPL": batch("AAPL", "2026-09-28T13:56:00Z", series("AAPL", "13:50", latest="102.2"))
        })
        restarted = IntradayPaperEngine(self.root, calendar=FixtureCalendar())
        filled = restarted.tick(self.policy["run_id"], adapter=second, at_time=at("2026-09-28T13:56:00Z"))
        self.assertEqual(filled["fills"], 1)
        self.assertEqual(filled["positions"], 1)
        self.assertGreaterEqual(Decimal(filled["cash"]), Decimal("20000"))

        third = FixtureAdapter({
            "AAPL": batch("AAPL", "2026-09-28T14:01:00Z", series("AAPL", "13:55", latest="102.3"))
        })
        again = restarted.tick(self.policy["run_id"], adapter=third, at_time=at("2026-09-28T14:01:00Z"))
        self.assertEqual(again["fills"], 1)
        with sqlite3.connect(self.root / self.policy["run_id"] / "ledger.sqlite3") as db:
            fill = json.loads(db.execute("SELECT payload FROM fills").fetchone()[0])
        self.assertGreater(at(fill["filled_at"]), at(fill["decision_at"]))
        self.assertEqual(Decimal(fill["observed_price"]), Decimal("102.2"))
        self.assertEqual(Decimal(fill["modeled_price"]), Decimal("102.25110"))
        self.assertEqual(Decimal(fill["commission"]), Decimal(fill["modeled_price"]) * Decimal(fill["quantity"]) * Decimal("0.001"))

    def test_fill_and_state_are_one_transaction_across_injected_crash_and_retry(self):
        self.initialize()
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL"))}),
            at_time=at("2026-09-28T13:51:00Z"),
        )
        second = FixtureAdapter({
            "AAPL": batch("AAPL", "2026-09-28T13:56:00Z", series("AAPL", "13:50", latest="102.2"))
        })

        def crash(point):
            if point == "after_fill":
                raise RuntimeError("synthetic crash")

        faulty = IntradayPaperEngine(self.root, calendar=FixtureCalendar(), fault=crash)
        with self.assertRaisesRegex(RuntimeError, "synthetic crash"):
            faulty.tick(self.policy["run_id"], adapter=second, at_time=at("2026-09-28T13:56:00Z"))
        rolled_back = self.engine.status(self.policy["run_id"])
        self.assertEqual(rolled_back["fills"], 0)
        self.assertEqual(rolled_back["pending_intents"], 1)
        self.assertEqual(rolled_back["cash"], "100000")

        recovered = self.engine.tick(
            self.policy["run_id"], adapter=second, at_time=at("2026-09-28T13:56:00Z")
        )
        self.assertEqual(recovered["fills"], 1)
        self.assertEqual(recovered["pending_intents"], 0)

    def test_outage_recovery_uses_latest_fresh_bar_not_first_historical_candidate(self):
        self.initialize()
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL"))}),
            at_time=at("2026-09-28T13:51:00Z"),
        )
        recovered_bars = series("AAPL", "13:55", latest="104") + (
            make_bar("AAPL", "2026-09-28T14:00:00Z", "105", "1000"),
        )
        status = self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T14:06:00Z", recovered_bars)}),
            at_time=at("2026-09-28T14:06:00Z"),
        )
        self.assertEqual(status["fills"], 1)
        with sqlite3.connect(self.root / self.policy["run_id"] / "ledger.sqlite3") as db:
            fill = json.loads(db.execute("SELECT payload FROM fills").fetchone()[0])
        self.assertEqual(fill["observed_price"], "105")
        self.assertEqual(fill["observed_event_at"], "2026-09-28T14:05:00+00:00")

    def test_production_tick_reads_wall_clock_again_after_fetch(self):
        self.initialize()
        clock_values = iter((at("2026-09-28T13:51:00Z"), at("2026-09-28T13:52:00Z")))
        engine = IntradayPaperEngine(self.root, calendar=FixtureCalendar(), clock=lambda: next(clock_values))
        adapter = FixtureAdapter({
            "AAPL": batch("AAPL", "2026-09-28T13:51:30Z", series("AAPL"))
        })
        status = engine.tick(self.policy["run_id"], adapter=adapter)
        self.assertEqual(adapter.calls[0][1], at("2026-09-28T13:51:00Z"))
        self.assertEqual(status["pending_intents"], 1)
        with sqlite3.connect(self.root / self.policy["run_id"] / "ledger.sqlite3") as db:
            book = json.loads(db.execute("SELECT payload FROM book").fetchone()[0])
        self.assertEqual(book["last_tick"], "2026-09-28T13:52:00+00:00")

    def test_modeled_costs_and_whole_share_cash_turnover_caps(self):
        buy = modeled_fill(Decimal("100"), 10, "buy", commission_bps=Decimal("10"), slippage_bps=Decimal("5"))
        sell = modeled_fill(Decimal("100"), 10, "sell", commission_bps=Decimal("10"), slippage_bps=Decimal("5"))
        self.assertEqual(buy["modeled_price"], Decimal("100.0500"))
        self.assertEqual(buy["commission"], Decimal("1.0005000"))
        self.assertEqual(sell["modeled_price"], Decimal("99.9500"))
        self.assertEqual(sell["commission"], Decimal("0.9995000"))

        self.initialize()
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL"))}),
            at_time=at("2026-09-28T13:51:00Z"),
        )
        status = self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({
                "AAPL": batch("AAPL", "2026-09-28T13:56:00Z", series("AAPL", "13:50", latest="102.2"))
            }),
            at_time=at("2026-09-28T13:56:00Z"),
        )
        self.assertLessEqual(Decimal(status["daily_turnover_pct"]), Decimal("160"))
        self.assertLessEqual(status["daily_entries"], 12)
        self.assertLessEqual(status["daily_trades"], 24)

    def test_stale_data_and_conflicting_revision_fail_closed_without_clearing_hold(self):
        self.initialize()
        stale = FixtureAdapter({
            "AAPL": batch("AAPL", "2026-09-28T14:00:00Z", series("AAPL", latest="102"))
        })
        held = self.engine.tick(self.policy["run_id"], adapter=stale, at_time=at("2026-09-28T14:00:00Z"))
        self.assertTrue(held["data_hold"])
        self.assertEqual(held["fills"], 0)
        self.assertEqual(held["pending_intents"], 0)

        fresh = FixtureAdapter({
            "AAPL": batch("AAPL", "2026-09-28T14:01:00Z", series("AAPL", "13:55", latest="102.5"))
        })
        recovered = self.engine.tick(self.policy["run_id"], adapter=fresh, at_time=at("2026-09-28T14:01:00Z"))
        self.assertFalse(recovered["data_hold"])
        revised = FixtureAdapter({
            "AAPL": batch(
                "AAPL", "2026-09-28T14:02:00Z", series("AAPL", "13:55", latest="103.5", revision="changed")
            )
        })
        conflict = self.engine.tick(self.policy["run_id"], adapter=revised, at_time=at("2026-09-28T14:02:00Z"))
        self.assertTrue(conflict["data_hold"])
        self.assertIn("conflicting", conflict["last_error"])

    def test_pending_buy_is_expired_at_fill_cutoff_and_trade_cap_reserves_exit(self):
        self.initialize()
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL"))}),
            at_time=at("2026-09-28T13:51:00Z"),
        )
        extended = list(series("AAPL"))
        cursor = at("2026-09-28T13:50:00Z")
        while cursor < at("2026-09-28T19:00:00Z"):
            extended.append(make_bar("AAPL", cursor.isoformat(), "102.3", "1000"))
            cursor += timedelta(minutes=5)
        status = self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T19:01:00Z", tuple(extended))}),
            at_time=at("2026-09-28T19:01:00Z"),
        )
        self.assertEqual(status["fills"], 0)
        self.assertEqual(status["pending_intents"], 0)

        limited = config("intraday-limited", "paper-intraday-limited", ["AAPL", "MSFT"])
        limited["risk"]["max_trades_per_day"] = 2
        self.engine.initialize(limited, at_time=at("2026-09-26T12:00:00Z"))
        first = {symbol: batch(symbol, "2026-09-28T13:51:00Z", series(symbol)) for symbol in limited["universe"]}
        self.engine.tick(limited["run_id"], adapter=FixtureAdapter(first), at_time=at("2026-09-28T13:51:00Z"))
        second = {
            symbol: batch(symbol, "2026-09-28T13:56:00Z", series(symbol, "13:50", latest="102.2"))
            for symbol in limited["universe"]
        }
        capped = self.engine.tick(
            limited["run_id"], adapter=FixtureAdapter(second), at_time=at("2026-09-28T13:56:00Z")
        )
        self.assertEqual(capped["daily_trades"], 1)
        self.assertEqual(capped["positions"], 1)

    def test_current_portfolio_loss_blocks_queued_buy_before_execution(self):
        policy = config("intraday-prewire", "paper-intraday-prewire", ["AAPL", "MSFT"])
        self.engine.initialize(policy, at_time=at("2026-09-26T12:00:00Z"))
        first = {
            "AAPL": batch("AAPL", "2026-09-28T13:51:00Z", custom_series("AAPL", ["100", "100.2", "100.4", "102"])),
            "MSFT": batch("MSFT", "2026-09-28T13:51:00Z", custom_series("MSFT", ["100", "100.2", "100.4", "100.4"])),
        }
        self.engine.tick(policy["run_id"], adapter=FixtureAdapter(first), at_time=at("2026-09-28T13:51:00Z"))
        second = {
            "AAPL": batch("AAPL", "2026-09-28T13:56:00Z", custom_series("AAPL", ["100", "100.2", "100.4", "102", "102.2"])),
            "MSFT": batch("MSFT", "2026-09-28T13:56:00Z", custom_series("MSFT", ["100", "100.2", "100.4", "100.4", "102"])),
        }
        middle = self.engine.tick(
            policy["run_id"], adapter=FixtureAdapter(second), at_time=at("2026-09-28T13:56:00Z")
        )
        self.assertEqual(middle["positions"], 1)
        self.assertEqual(middle["pending_intents"], 1)
        third = {
            "AAPL": batch("AAPL", "2026-09-28T14:01:00Z", custom_series("AAPL", ["100", "100.2", "100.4", "102", "102.2", "96"])),
            "MSFT": batch("MSFT", "2026-09-28T14:01:00Z", custom_series("MSFT", ["100", "100.2", "100.4", "100.4", "102", "102.2"])),
        }
        stopped = self.engine.tick(
            policy["run_id"], adapter=FixtureAdapter(third), at_time=at("2026-09-28T14:01:00Z")
        )
        self.assertTrue(stopped["daily_halt"])
        self.assertEqual(stopped["fills"], 1)
        self.assertEqual(stopped["positions"], 1)
        with sqlite3.connect(self.root / policy["run_id"] / "ledger.sqlite3") as db:
            symbols = [json.loads(row[0])["symbol"] for row in db.execute("SELECT payload FROM fills")]
        self.assertEqual(symbols, ["AAPL"])

    def test_held_corporate_action_preserves_evidence_and_halts_projection(self):
        self.initialize()
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL"))}),
            at_time=at("2026-09-28T13:51:00Z"),
        )
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({
                "AAPL": batch("AAPL", "2026-09-28T13:56:00Z", series("AAPL", "13:50", latest="102.2"))
            }),
            at_time=at("2026-09-28T13:56:00Z"),
        )
        action = {"type": "split", "event_at": "2026-09-28T13:58:00+00:00", "source_event_id": "fixture-action"}
        held = self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({
                "AAPL": batch(
                    "AAPL", "2026-09-28T14:01:00Z", series("AAPL", "13:55", latest="102.3"),
                    corporate_actions=(action,),
                )
            }),
            at_time=at("2026-09-28T14:01:00Z"),
        )
        self.assertTrue(held["data_hold"])
        with sqlite3.connect(self.root / self.policy["run_id"] / "ledger.sqlite3") as db:
            book = json.loads(db.execute("SELECT payload FROM book").fetchone()[0])
            source = json.loads(db.execute("SELECT payload FROM source_events ORDER BY rowid DESC LIMIT 1").fetchone()[0])
        self.assertTrue(book["performance_provisional"])
        self.assertIn("AAPL", book["corporate_holds"])
        self.assertEqual(source["corporate_actions"], [action])

    def test_portfolio_daily_loss_creates_exit_then_later_observation_fills_it(self):
        self.initialize()
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL"))}),
            at_time=at("2026-09-28T13:51:00Z"),
        )
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({
                "AAPL": batch("AAPL", "2026-09-28T13:56:00Z", series("AAPL", "13:50", latest="102.2"))
            }),
            at_time=at("2026-09-28T13:56:00Z"),
        )
        stopped = self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({
                "AAPL": batch("AAPL", "2026-09-28T14:01:00Z", series("AAPL", "13:55", latest="96"))
            }),
            at_time=at("2026-09-28T14:01:00Z"),
        )
        self.assertTrue(stopped["daily_halt"])
        self.assertEqual(stopped["pending_intents"], 1)
        self.assertEqual(stopped["positions"], 1)

        later_bars = series("AAPL", "13:55", latest="96") + (
            make_bar("AAPL", "2026-09-28T14:00:00Z", "95.5", "1000"),
        )
        exited = self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T14:06:00Z", later_bars)}),
            at_time=at("2026-09-28T14:06:00Z"),
        )
        self.assertEqual(exited["positions"], 0)
        self.assertTrue(exited["daily_halt"])
        self.assertEqual(exited["fills"], 2)

    def test_missed_close_never_invents_fill_and_marks_overnight_risk(self):
        self.initialize()
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL"))}),
            at_time=at("2026-09-28T13:51:00Z"),
        )
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({
                "AAPL": batch("AAPL", "2026-09-28T13:56:00Z", series("AAPL", "13:50", latest="102.2"))
            }),
            at_time=at("2026-09-28T13:56:00Z"),
        )
        adapter = FixtureAdapter({})
        status = self.engine.tick(self.policy["run_id"], adapter=adapter, at_time=at("2026-09-28T20:01:00Z"))
        self.assertEqual(adapter.calls, [])
        self.assertTrue(status["unresolved_overnight"])
        self.assertEqual(status["positions"], 1)
        self.assertEqual(status["fills"], 1)

    def test_restart_next_session_blocks_buys_and_recovers_with_sell_only_path(self):
        self.initialize()
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL"))}),
            at_time=at("2026-09-28T13:51:00Z"),
        )
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({
                "AAPL": batch("AAPL", "2026-09-28T13:56:00Z", series("AAPL", "13:50", latest="102.2"))
            }),
            at_time=at("2026-09-28T13:56:00Z"),
        )
        next_day = custom_series("AAPL", ["103", "103.2", "103.4", "104"], day="2026-09-29")
        recovery = self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-29T13:51:00Z", next_day)}),
            at_time=at("2026-09-29T13:51:00Z"),
        )
        self.assertTrue(recovery["unresolved_overnight"])
        self.assertEqual(recovery["pending_intents"], 1)
        later = custom_series("AAPL", ["103", "103.2", "103.4", "104", "103.8"], day="2026-09-29")
        exited = self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-29T13:56:00Z", later)}),
            at_time=at("2026-09-29T13:56:00Z"),
        )
        self.assertEqual(exited["positions"], 0)
        self.assertFalse(exited["unresolved_overnight"])
        with sqlite3.connect(self.root / self.policy["run_id"] / "ledger.sqlite3") as db:
            reasons = [json.loads(row[0])["reason"] for row in db.execute("SELECT payload FROM fills ORDER BY rowid")]
        self.assertEqual(reasons, ["breakout_entry", "overnight_exit"])

    def test_out_of_order_tick_lock_and_strategy_run_isolation(self):
        self.initialize()
        other = config("intraday-fixture-b", "paper-intraday-fixture-b")
        self.engine.initialize(other, at_time=at("2026-09-26T12:00:00Z"))
        self.engine.tick(
            self.policy["run_id"],
            adapter=FixtureAdapter({"AAPL": batch("AAPL", "2026-09-28T13:51:00Z", series("AAPL"))}),
            at_time=at("2026-09-28T13:51:00Z"),
        )
        self.assertEqual(self.engine.status(other["run_id"])["pending_intents"], 0)
        with self.assertRaisesRegex(StateError, "out-of-order"):
            self.engine.tick(
                self.policy["run_id"],
                adapter=FixtureAdapter({}),
                at_time=at("2026-09-28T13:50:00Z"),
            )

        lock_path = self.root / self.policy["run_id"] / "run.lock"
        with lock_path.open("a+") as handle:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaises(RunBusyError):
                self.engine.status(self.policy["run_id"])
            fcntl.flock(handle, fcntl.LOCK_UN)

    def test_cli_init_tick_and_status_use_only_explicit_test_fixture(self):
        policy = config("intraday-cli", "paper-intraday-cli")
        policy_path = self.root / "policy.json"
        fixture_path = self.root / "fixture.json"
        snapshot_path = self.root / "snapshot.json"
        policy_path.write_text(json.dumps(policy))
        fixture_path.write_text(json.dumps({
            "testOnly": True,
            "batches": {
                "AAPL": {
                    "received_at": "2026-09-28T13:51:00Z",
                    "bars": [item.private_record() for item in series("AAPL")],
                }
            },
        }))
        output = io.StringIO()
        with redirect_stdout(output):
            self.assertEqual(main([
                "--root", str(self.root / "cli-runs"), "init",
                "--config", str(policy_path), "--at", policy["initialized_at"],
            ], calendar=FixtureCalendar()), 0)
            self.assertEqual(main([
                "--root", str(self.root / "cli-runs"), "tick",
                "--run-id", policy["run_id"], "--simulation-at", "2026-09-28T13:51:00Z",
                "--fixture", str(fixture_path),
            ], calendar=FixtureCalendar()), 0)
            self.assertEqual(main([
                "--root", str(self.root / "cli-runs"), "status", "--run-id", policy["run_id"],
            ], calendar=FixtureCalendar()), 0)
            self.assertEqual(main([
                "--root", str(self.root / "cli-runs"), "export", "--run-id", policy["run_id"],
                "--output", str(snapshot_path), "--exported-at", "2026-09-28T13:52:00Z",
            ], calendar=FixtureCalendar()), 0)
        lines = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertEqual(lines[0]["state"], "pending")
        self.assertEqual(lines[1]["pending_intents"], 1)
        self.assertEqual(lines[2]["fills"], 0)
        self.assertEqual(lines[3]["status"], "exported")
        snapshot = json.loads(snapshot_path.read_text())
        self.assertEqual(snapshot["episodeId"], policy["episode_id"])
        self.assertEqual(snapshot["label"], policy["presentation"]["label"])


if __name__ == "__main__":
    unittest.main()
