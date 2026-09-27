"""Isolated, long-only intraday PAPER engine with no broker capability."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import copy
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_FLOOR
import fcntl
import json
from pathlib import Path
import re
import sqlite3
import sys
from uuid import uuid4
from zoneinfo import ZoneInfo

from intraday_core import (
    Bar,
    BarBatch,
    BarValidationError,
    ExchangeCalendarsXNYS,
    StrategyContext,
    StrategyRegistry,
    YahooChartAdapter,
    aware,
    canonical,
    decimal_value,
    digest,
)
from intraday_strategy import OpeningRangeBreakout


NY = ZoneInfo("America/New_York")
IDENTIFIER = re.compile(r"[a-zA-Z0-9_-]{1,80}")
SYMBOL = re.compile(r"[A-Z][A-Z0-9.\-]{0,9}")


class ConfigError(ValueError):
    """A preregistered run configuration is unsafe or ambiguous."""


class StateError(RuntimeError):
    """Durable run state cannot safely advance."""


class RunBusyError(StateError):
    """Another process owns the run lock."""


def _decimal(value, name, *, positive=False, nonnegative=False):
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ConfigError(f"invalid {name}") from exc
    if not result.is_finite() or (positive and result <= 0) or (nonnegative and result < 0):
        raise ConfigError(f"invalid {name}")
    return result


def _timestamp(value, name="timestamp"):
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ConfigError(f"invalid {name}") from exc
    if result.tzinfo is None:
        raise ConfigError(f"timezone required for {name}")
    return result.astimezone(timezone.utc)


def _date(value, name):
    try:
        result = date.fromisoformat(value)
    except (ValueError, TypeError) as exc:
        raise ConfigError(f"invalid {name}") from exc
    if value != result.isoformat():
        raise ConfigError(f"invalid {name}")
    return result


def _exact(value, keys, name):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ConfigError(f"{name} fields")


def _secret_scan(value, path="config"):
    if isinstance(value, dict):
        for key, item in value.items():
            if re.search(r"broker|credential|password|secret|api.?key|token", str(key), re.I):
                raise ConfigError(f"forbidden secret/broker field at {path}.{key}")
            _secret_scan(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _secret_scan(item, f"{path}[{index}]")


def validate_config(raw, *, calendar):
    config = copy.deepcopy(raw)
    _secret_scan(config)
    top = {
        "schema_version", "run_id", "episode_id", "live", "mode", "strategy_id",
        "strategy_version", "initialized_at", "period", "initial_virtual_cash_usd",
        "universe", "data", "costs", "risk", "strategy", "presentation",
        "hypothesis", "references",
    }
    _exact(config, top, "config")
    if config["schema_version"] != 1 or config["live"] is not False or config["mode"] != "forward_paper":
        raise ConfigError("paper-only config required")
    if config["strategy_id"] != OpeningRangeBreakout.strategy_id or config["strategy_version"] != "orb-long-15m-v1":
        raise ConfigError("unknown strategy identity")
    for name in ("run_id", "episode_id"):
        if not isinstance(config[name], str) or not IDENTIFIER.fullmatch(config[name]):
            raise ConfigError(f"invalid {name}")
    initialized = _timestamp(config["initialized_at"], "initialization")
    _exact(config["period"], {"start", "end"}, "period")
    start = _date(config["period"]["start"], "period start")
    end = _date(config["period"]["end"], "period end")
    if start > end or start.strftime("%Y-%m") != end.strftime("%Y-%m"):
        raise ConfigError("single ordered month required")
    start_window = calendar.session(start.isoformat())
    end_window = calendar.session(end.isoformat())
    if start_window is None or end_window is None or initialized >= start_window.open_at:
        raise ConfigError("episode must start on a later valid XNYS session")
    initial = _decimal(config["initial_virtual_cash_usd"], "initial cash", positive=True)
    if initial != Decimal("100000"):
        raise ConfigError("independent initial cash must be USD100000")
    config["initial_virtual_cash_usd"] = str(initial)

    universe = config["universe"]
    if (not isinstance(universe, list) or not 1 <= len(universe) <= 8
            or len(set(universe)) != len(universe)
            or any(not isinstance(item, str) or not SYMBOL.fullmatch(item) for item in universe)):
        raise ConfigError("invalid bounded liquid universe")

    _exact(config["data"], {"bar_minutes", "max_delay_seconds", "max_attempts"}, "data")
    if config["data"]["bar_minutes"] != 5 or not 1 <= config["data"]["max_delay_seconds"] <= 120:
        raise ConfigError("five-minute fresh bars required")
    if not 1 <= config["data"]["max_attempts"] <= 3:
        raise ConfigError("request attempts exceed bound")

    _exact(config["costs"], {
        "commission_bps_each_side", "slippage_bps_each_side",
        "stress_commission_bps_each_side", "stress_slippage_bps_each_side",
    }, "costs")
    costs = {key: _decimal(value, key, nonnegative=True) for key, value in config["costs"].items()}
    if (costs["commission_bps_each_side"] != 10 or costs["slippage_bps_each_side"] != 5
            or costs["stress_commission_bps_each_side"] < costs["commission_bps_each_side"]
            or costs["stress_slippage_bps_each_side"] < costs["slippage_bps_each_side"]):
        raise ConfigError("base 10bp commission and 5bp slippage required")
    config["costs"] = {key: str(value) for key, value in costs.items()}

    risk_keys = {
        "max_positions", "position_cap_pct", "minimum_cash_pct", "max_entries_per_symbol_day",
        "max_entries_per_day", "max_trades_per_day", "max_daily_turnover_pct",
        "daily_loss_stop_pct", "episode_loss_stop_pct",
    }
    _exact(config["risk"], risk_keys, "risk")
    risk = config["risk"]
    for key in ("max_positions", "max_entries_per_symbol_day", "max_entries_per_day", "max_trades_per_day"):
        if type(risk[key]) is not int:
            raise ConfigError(f"integer risk cap required: {key}")
    if not 1 <= risk["max_positions"] <= 4:
        raise ConfigError("position count cap")
    if not 1 <= risk["max_entries_per_symbol_day"] <= 2:
        raise ConfigError("symbol entry cap")
    if not 1 <= risk["max_entries_per_day"] <= 12 or not 2 <= risk["max_trades_per_day"] <= 24:
        raise ConfigError("daily trade cap")
    for key in ("position_cap_pct", "minimum_cash_pct", "max_daily_turnover_pct", "daily_loss_stop_pct", "episode_loss_stop_pct"):
        risk[key] = str(_decimal(risk[key], key, positive=True))
    if Decimal(risk["position_cap_pct"]) > 20 or Decimal(risk["minimum_cash_pct"]) < 20:
        raise ConfigError("position/cash concentration limit")
    if Decimal(risk["max_daily_turnover_pct"]) > 160:
        raise ConfigError("turnover cap")
    if Decimal(risk["daily_loss_stop_pct"]) > 1:
        raise ConfigError("daily loss limit")
    if Decimal(risk["episode_loss_stop_pct"]) > 10:
        raise ConfigError("episode loss limit")

    strategy_keys = {
        "opening_range_bars", "breakout_buffer_bps", "relative_volume_min", "momentum_bars",
        "stop_loss_pct", "profit_target_pct", "max_hold_minutes",
        "last_entry_minutes_before_close", "force_exit_minutes_before_close",
    }
    _exact(config["strategy"], strategy_keys, "strategy")
    strategy = config["strategy"]
    if strategy["opening_range_bars"] != 3 or strategy["momentum_bars"] != 1:
        raise ConfigError("exact 15-minute opening range required")
    if not 0 <= strategy["breakout_buffer_bps"] <= 50:
        raise ConfigError("breakout buffer")
    if not 5 <= strategy["max_hold_minutes"] <= 240:
        raise ConfigError("max hold")
    if not 20 <= strategy["force_exit_minutes_before_close"] <= 60:
        raise ConfigError("exit cutoff")
    if strategy["last_entry_minutes_before_close"] < strategy["force_exit_minutes_before_close"]:
        raise ConfigError("entry cutoff")
    for key in ("relative_volume_min", "stop_loss_pct", "profit_target_pct"):
        strategy[key] = str(_decimal(strategy[key], key, positive=True))

    _exact(config["presentation"], {"label", "notes"}, "presentation")
    label = config["presentation"]["label"]
    notes = config["presentation"]["notes"]
    if not isinstance(label, str) or not 1 <= len(label) <= 80:
        raise ConfigError("presentation label")
    if (not isinstance(notes, list) or len(notes) > 8
            or any(not isinstance(note, str) or not 1 <= len(note) <= 240 for note in notes)):
        raise ConfigError("presentation notes")
    if not isinstance(config["hypothesis"], str) or not 1 <= len(config["hypothesis"]) <= 500:
        raise ConfigError("hypothesis required")
    if (not isinstance(config["references"], list) or not config["references"]
            or any(not isinstance(item, str) or not 1 <= len(item) <= 300 for item in config["references"])):
        raise ConfigError("references required")
    return config


def modeled_fill(observed_price, quantity, side, *, commission_bps, slippage_bps,
                 stress_commission_bps=None, stress_slippage_bps=None):
    price = decimal_value(observed_price, "observed price", positive=True)
    qty = Decimal(quantity)
    if qty <= 0 or qty != qty.to_integral_value() or side not in ("buy", "sell"):
        raise StateError("invalid fill request")
    direction = Decimal(1) if side == "buy" else Decimal(-1)
    modeled_price = price * (Decimal(1) + direction * Decimal(slippage_bps) / Decimal(10000))
    notional = modeled_price * qty
    commission = notional * Decimal(commission_bps) / Decimal(10000)
    cash_delta = -(notional + commission) if side == "buy" else notional - commission
    base_cost = abs(modeled_price - price) * qty + commission
    stress_commission_bps = Decimal(stress_commission_bps if stress_commission_bps is not None else commission_bps)
    stress_slippage_bps = Decimal(stress_slippage_bps if stress_slippage_bps is not None else slippage_bps)
    stress_price = price * (Decimal(1) + direction * stress_slippage_bps / Decimal(10000))
    stress_cost = abs(stress_price - price) * qty + stress_price * qty * stress_commission_bps / Decimal(10000)
    return {
        "observed_price": price,
        "modeled_price": modeled_price,
        "commission": commission,
        "cash_delta": cash_delta,
        "notional": notional,
        "base_cost": base_cost,
        "stress_cost": stress_cost,
    }


class IntradayPaperEngine:
    def __init__(self, root, *, calendar=None, fault=None, clock=None):
        self.root = Path(root)
        self.calendar = calendar or ExchangeCalendarsXNYS()
        self.fault = fault
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.registry = StrategyRegistry()
        self.registry.register(OpeningRangeBreakout())

    def _run_dir(self, run_id):
        if not isinstance(run_id, str) or not IDENTIFIER.fullmatch(run_id):
            raise StateError("invalid run id")
        return self.root / run_id

    @contextmanager
    def _lock(self, run_id, *, create=False):
        run_dir = self._run_dir(run_id)
        if create:
            run_dir.mkdir(parents=True, exist_ok=True)
        if not run_dir.is_dir():
            raise StateError("run not initialized")
        lock_path = run_dir / "run.lock"
        with lock_path.open("a+") as handle:
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise RunBusyError("run is already active") from exc
            try:
                yield run_dir
            finally:
                fcntl.flock(handle, fcntl.LOCK_UN)

    @staticmethod
    def _connect(run_dir):
        db = sqlite3.connect(run_dir / "ledger.sqlite3")
        db.execute("PRAGMA foreign_keys=ON")
        return db

    @staticmethod
    def _book(db):
        row = db.execute("SELECT payload FROM book WHERE id=1").fetchone()
        if not row:
            raise StateError("missing book")
        return json.loads(row[0])

    @staticmethod
    def _save_book(db, state):
        db.execute("UPDATE book SET payload=? WHERE id=1", (canonical(state),))

    @staticmethod
    def _config(run_dir):
        try:
            config = json.loads((run_dir / "config.json").read_text())
        except (OSError, json.JSONDecodeError) as exc:
            raise StateError("frozen config unavailable") from exc
        return config

    def initialize(self, raw_config, *, at_time):
        config = validate_config(raw_config, calendar=self.calendar)
        now = aware(at_time, "initialization")
        if now != _timestamp(config["initialized_at"], "initialization"):
            raise ConfigError("initialization time must match preregistration")
        run_id = config["run_id"]
        config_hash = digest(config)
        with self._lock(run_id, create=True) as run_dir:
            ledger = run_dir / "ledger.sqlite3"
            if ledger.exists():
                stored = self._config(run_dir)
                if digest(stored) != config_hash:
                    raise ConfigError("run config is immutable")
                with self._connect(run_dir) as db:
                    tables = [row[0] for row in db.execute(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                    )]
                    if "book" in tables:
                        try:
                            if db.execute("SELECT 1 FROM book LIMIT 1").fetchone():
                                return self._status(db, self._book(db))
                        except sqlite3.DatabaseError as exc:
                            raise StateError("conflicting ledger schema requires manual review") from exc
                    if any(db.execute(f'SELECT 1 FROM "{table}" LIMIT 1').fetchone() for table in tables):
                        raise StateError("populated incomplete ledger requires manual review")
                # Preserve the failed initialization intact; never reset a populated ledger.
                ledger.rename(run_dir / f"ledger.sqlite3.orphan-{uuid4().hex}")
            (run_dir / "config.json").write_text(canonical(config) + "\n")
            state = {
                "live": False,
                "mode": "forward_paper",
                "run_id": run_id,
                "episode_id": config["episode_id"],
                "strategy_id": config["strategy_id"],
                "strategy_version": config["strategy_version"],
                "config_hash": config_hash,
                "initialized_at": now.isoformat(),
                "state": "pending",
                "cash": config["initial_virtual_cash_usd"],
                "nav": config["initial_virtual_cash_usd"],
                "positions": {},
                "performance_provisional": False,
                "corporate_holds": {},
                "net_contributions": "0",
                "cashflows": [],
                "external_flows": [],
                "last_observation": None,
                "last_tick": None,
                "last_error": None,
                "data_hold": False,
                "daily_halt": False,
                "episode_halt": False,
                "monthly_halt": False,
                "unresolved_overnight": False,
                "current_session": None,
                "session_open_nav": config["initial_virtual_cash_usd"],
                "daily_entries": 0,
                "daily_trades": 0,
                "daily_turnover_notional": "0",
                "entries_by_symbol": {},
                "cumulative_base_cost": "0",
                "cumulative_stress_cost": "0",
            }
            with self._connect(run_dir) as db:
                db.executescript("""
                    CREATE TABLE book(id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
                    CREATE TABLE fills(id TEXT PRIMARY KEY, session TEXT NOT NULL, payload TEXT NOT NULL);
                    CREATE TABLE observations(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                    CREATE TABLE intents(intent_id TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL);
                    CREATE TABLE decisions(decision_id TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, payload TEXT NOT NULL);
                    CREATE TABLE source_events(source_event_id TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, payload TEXT NOT NULL, raw_response BLOB NOT NULL);
                    CREATE TABLE bars(symbol TEXT NOT NULL, event_at TEXT NOT NULL, payload_hash TEXT NOT NULL, payload TEXT NOT NULL,
                                      PRIMARY KEY(symbol,event_at));
                    CREATE TABLE warnings(warning_id TEXT PRIMARY KEY, payload TEXT NOT NULL);
                """)
                db.execute("INSERT INTO book VALUES(1,?)", (canonical(state),))
                return self._status(db, state)

    def _warning(self, db, state, now, message):
        record = {"at": now.isoformat(), "message": message}
        db.execute("INSERT OR IGNORE INTO warnings VALUES(?,?)", (digest(record), canonical(record)))
        state["last_error"] = message

    def _ensure_tick_order(self, state, now):
        previous = state.get("last_tick")
        if previous and now <= datetime.fromisoformat(previous):
            raise StateError("out-of-order tick timestamp")

    def _session_for_now(self, now):
        session = now.astimezone(NY).date().isoformat()
        return session, self.calendar.session(session)

    def _store_source(self, db, batch):
        record = {
            "source_event_id": batch.source_event_id,
            "source": batch.source,
            "symbol": batch.symbol,
            "request_url": batch.request_url,
            "requested_at": batch.requested_at.isoformat(),
            "received_at": batch.received_at.isoformat(),
            "raw_sha256": batch.raw_sha256,
            "event_times": [bar.event_at.isoformat() for bar in batch.bars],
            "corporate_actions": list(batch.corporate_actions),
        }
        payload_hash = digest(record)
        row = db.execute("SELECT payload_hash FROM source_events WHERE source_event_id=?", (batch.source_event_id,)).fetchone()
        if row and row[0] != payload_hash:
            raise StateError("source event identity conflict")
        if not row:
            db.execute("INSERT INTO source_events VALUES(?,?,?,?)",
                       (batch.source_event_id, payload_hash, canonical(record), batch.raw_response))

    def _bar_session(self, bar):
        return bar.event_at.astimezone(NY).date().isoformat()

    def _ingest(self, db, config, batches, now, session, window):
        current_by_symbol = {}
        max_delay = timedelta(seconds=config["data"]["max_delay_seconds"])
        for batch in batches:
            self._store_source(db, batch)
            if batch.received_at > now:
                return "future receipt"
            current = []
            for bar in batch.bars:
                if bar.completed_at > batch.received_at or bar.completed_at > now:
                    return f"future completed bar for {batch.symbol}"
                bar_session = self._bar_session(bar)
                bar_window = self.calendar.session(bar_session)
                if bar_window is None:
                    continue
                if not (bar_window.open_at <= bar.event_at and bar.completed_at <= bar_window.close_at):
                    continue
                record = bar.private_record()
                economics = {key: value for key, value in record.items() if key != "source_event_id"}
                payload_hash = digest(economics)
                row = db.execute("SELECT payload_hash FROM bars WHERE symbol=? AND event_at=?",
                                 (bar.symbol, bar.event_at.isoformat())).fetchone()
                if row and row[0] != payload_hash:
                    return f"conflicting revision for {bar.symbol} at {bar.event_at.isoformat()}"
                if not row:
                    db.execute("INSERT INTO bars VALUES(?,?,?,?)",
                               (bar.symbol, bar.event_at.isoformat(), payload_hash, canonical(record)))
                if bar_session == session:
                    current.append(bar)
            current.sort(key=lambda item: item.event_at)
            if not current:
                return f"missing current-session bars for {batch.symbol}"
            expected = window.open_at
            for bar in current:
                if bar.event_at != expected:
                    return f"missing or reordered bars for {batch.symbol}"
                expected = bar.completed_at
            if batch.received_at - current[-1].completed_at > max_delay:
                return f"stale bars for {batch.symbol}"
            current_by_symbol[batch.symbol] = (batch, tuple(current))
        if set(current_by_symbol) != set(config["universe"]):
            return "missing universe response"
        if any(now - bars[-1].completed_at > max_delay for _batch, bars in current_by_symbol.values()):
            return "stale bars at aggregate observation"
        return current_by_symbol

    @staticmethod
    def _intent_rows(db, status="pending"):
        return [(row[0], json.loads(row[1])) for row in db.execute(
            "SELECT intent_id,payload FROM intents WHERE status=? ORDER BY intent_id", (status,)
        )]

    @staticmethod
    def _store_intent(db, intent):
        payload = intent.private_record() if hasattr(intent, "private_record") else intent
        intent_id = payload["intent_id"]
        payload_hash = digest(payload)
        row = db.execute("SELECT payload_hash FROM intents WHERE intent_id=?", (intent_id,)).fetchone()
        if row and row[0] != payload_hash:
            raise StateError("intent identity conflict")
        if not row:
            db.execute("INSERT INTO intents VALUES(?,?,?,?)", (intent_id, payload_hash, "pending", canonical(payload)))
        return not row

    @staticmethod
    def _prices(current):
        return {symbol: values[1][-1].close for symbol, values in current.items()}

    @staticmethod
    def _nav(state, prices):
        value = Decimal(state["cash"])
        for symbol, position in state["positions"].items():
            if symbol not in prices:
                raise StateError("missing position valuation")
            value += Decimal(position["qty"]) * prices[symbol]
        return value

    def _fill_intent(self, db, state, config, intent, bar, received_at):
        side = intent["side"]
        symbol = intent["symbol"]
        risk = config["risk"]
        costs = config["costs"]
        positions = state["positions"]
        if side == "buy":
            if state["daily_halt"] or state["episode_halt"] or state["unresolved_overnight"]:
                return "blocked"
            if symbol in positions or len(positions) >= risk["max_positions"]:
                return "blocked"
            if state["daily_entries"] >= risk["max_entries_per_day"]:
                return "blocked"
            # Keep one trade slot for the matching risk-reducing exit. Mandatory
            # sells remain allowed even if an emergency pushes counters over a cap.
            if state["daily_trades"] + 2 > risk["max_trades_per_day"]:
                return "blocked"
            if state["entries_by_symbol"].get(symbol, 0) >= risk["max_entries_per_symbol_day"]:
                return "blocked"
            nav = Decimal(state["nav"])
            cap = nav * Decimal(risk["position_cap_pct"]) / Decimal(100)
            reserve = nav * Decimal(risk["minimum_cash_pct"]) / Decimal(100)
            available = min(cap, max(Decimal(0), Decimal(state["cash"]) - reserve))
            turnover_limit = Decimal(state["session_open_nav"]) * Decimal(risk["max_daily_turnover_pct"]) / Decimal(100)
            available = min(available, max(Decimal(0), turnover_limit - Decimal(state["daily_turnover_notional"])))
            one = modeled_fill(
                bar.close, 1, side,
                commission_bps=Decimal(costs["commission_bps_each_side"]),
                slippage_bps=Decimal(costs["slippage_bps_each_side"]),
            )
            unit_cash = -one["cash_delta"]
            quantity = int((available / unit_cash).to_integral_value(rounding=ROUND_FLOOR))
            if quantity <= 0:
                return "blocked"
        else:
            position = positions.get(symbol)
            if not position:
                return "blocked"
            quantity = int(position["qty"])
        result = modeled_fill(
            bar.close, quantity, side,
            commission_bps=Decimal(costs["commission_bps_each_side"]),
            slippage_bps=Decimal(costs["slippage_bps_each_side"]),
            stress_commission_bps=Decimal(costs["stress_commission_bps_each_side"]),
            stress_slippage_bps=Decimal(costs["stress_slippage_bps_each_side"]),
        )
        cash = Decimal(state["cash"]) + result["cash_delta"]
        if cash < 0:
            raise StateError("negative cash")
        state["cash"] = str(cash)
        if side == "buy":
            basis = -result["cash_delta"]
            positions[symbol] = {
                "qty": str(quantity),
                "cost_basis": str(basis),
                "average_cost": str(basis / quantity),
                "entered_at": received_at.isoformat(),
                "metadata": {"symbol": symbol},
            }
            state["daily_entries"] += 1
            state["entries_by_symbol"][symbol] = state["entries_by_symbol"].get(symbol, 0) + 1
        else:
            del positions[symbol]
            if not positions and intent["reason"] == "overnight_exit":
                state["unresolved_overnight"] = False
                if not state["episode_halt"]:
                    state["state"] = "active"
        state["daily_trades"] += 1
        state["daily_turnover_notional"] = str(Decimal(state["daily_turnover_notional"]) + result["notional"])
        state["cumulative_base_cost"] = str(Decimal(state["cumulative_base_cost"]) + result["base_cost"])
        state["cumulative_stress_cost"] = str(Decimal(state["cumulative_stress_cost"]) + result["stress_cost"])
        fill_id = digest({"intent_id": intent["intent_id"], "paper_only": True})
        fill = {
            "id": fill_id,
            "intent_id": intent["intent_id"],
            "run_id": config["run_id"],
            "session": intent["session"],
            "symbol": symbol,
            "side": side,
            "quantity": str(quantity),
            "observed_price": str(result["observed_price"]),
            "modeled_price": str(result["modeled_price"]),
            "commission": str(result["commission"]),
            "base_cost": str(result["base_cost"]),
            "stress_cost": str(result["stress_cost"]),
            "observed_event_at": bar.completed_at.isoformat(),
            "filled_at": received_at.isoformat(),
            "decision_at": intent["signal_at"],
            "reason": intent["reason"],
            "paper_only": True,
        }
        db.execute("INSERT INTO fills VALUES(?,?,?)", (fill_id, intent["session"], canonical(fill)))
        db.execute("UPDATE intents SET status='filled' WHERE intent_id=?", (intent["intent_id"],))
        if self.fault:
            self.fault("after_fill")
        return "filled"

    def _apply_pending(self, db, state, config, current, session, window, prices):
        for intent_id, intent in self._intent_rows(db):
            if intent["session"] != session:
                db.execute("UPDATE intents SET status='expired' WHERE intent_id=?", (intent_id,))
                continue
            signal_at = datetime.fromisoformat(intent["signal_at"])
            batch, bars = current[intent["symbol"]]
            latest = bars[-1]
            if latest.completed_at <= signal_at or batch.received_at <= signal_at:
                continue
            if (intent["side"] == "buy"
                    and batch.received_at >= window.close_at - timedelta(
                        minutes=config["strategy"]["last_entry_minutes_before_close"]
                    )):
                db.execute("UPDATE intents SET status='expired' WHERE intent_id=?", (intent_id,))
                continue
            self._apply_risk_halts(state, config)
            status = self._fill_intent(db, state, config, intent, latest, batch.received_at)
            if status == "blocked":
                db.execute("UPDATE intents SET status='blocked' WHERE intent_id=?", (intent_id,))
            else:
                state["nav"] = str(self._nav(state, prices))
                self._apply_risk_halts(state, config)

    @staticmethod
    def _apply_risk_halts(state, config):
        daily_boundary = Decimal(state["session_open_nav"]) * (
            Decimal(1) - Decimal(config["risk"]["daily_loss_stop_pct"]) / Decimal(100)
        )
        episode_boundary = Decimal(config["initial_virtual_cash_usd"]) * (
            Decimal(1) - Decimal(config["risk"]["episode_loss_stop_pct"]) / Decimal(100)
        )
        if Decimal(state["nav"]) <= episode_boundary:
            state["episode_halt"] = True
            state["monthly_halt"] = True
            state["state"] = "stopped"
            return "episode_loss_stop"
        if Decimal(state["nav"]) <= daily_boundary:
            state["daily_halt"] = True
            return "daily_loss_stop"
        return None

    def _prior_opening_volumes(self, db, config, session):
        result = {}
        count = config["strategy"]["opening_range_bars"]
        for symbol in config["universe"]:
            groups = {}
            for payload, in db.execute("SELECT payload FROM bars WHERE symbol=? ORDER BY event_at", (symbol,)):
                item = json.loads(payload)
                bar_session = datetime.fromisoformat(item["event_at"]).astimezone(NY).date().isoformat()
                if bar_session == session:
                    continue
                groups.setdefault(bar_session, []).append(item)
            totals = []
            for day, items in groups.items():
                window = self.calendar.session(day)
                ordered = sorted(items, key=lambda item: item["event_at"])
                if (window and len(ordered) >= count
                        and datetime.fromisoformat(ordered[0]["event_at"]) == window.open_at):
                    totals.append(sum((Decimal(item["volume"]) for item in ordered[:count]), Decimal(0)))
            result[symbol] = tuple(totals)
        return result

    def _decision_and_intents(self, db, state, config, current, session, window):
        signal_at = max(batch.received_at for batch, _bars in current.values())
        bars = {symbol: values[1] for symbol, values in current.items()}
        prices = self._prices(current)
        state["nav"] = str(self._nav(state, prices))
        reason = self._apply_risk_halts(state, config)
        if state["unresolved_overnight"] and state["positions"]:
            reason = "overnight_exit"

        candidates = []
        if reason:
            for symbol in sorted(state["positions"]):
                latest = bars[symbol][-1]
                identity = {
                    "run_id": config["run_id"], "session": session, "symbol": symbol,
                    "side": "sell", "reason": reason, "signal_at": signal_at.isoformat(),
                }
                candidates.append({
                    "intent_id": f"{config['run_id']}:{digest(identity)}",
                    **identity,
                    "eligible_after": latest.completed_at.isoformat(),
                    "reference_price": str(latest.close),
                    "target_fraction": None,
                })
        elif not state["daily_halt"] and not state["episode_halt"]:
            strategy = self.registry.resolve(config["strategy_id"])
            context = StrategyContext(
                run_id=config["run_id"],
                session=session,
                signal_at=signal_at,
                session_window=window,
                bars=bars,
                positions=state["positions"],
                prior_opening_volumes=self._prior_opening_volumes(db, config, session),
                parameters=config["strategy"],
            )
            candidates.extend(strategy.generate_intents(context))

        pending = [payload for _key, payload in self._intent_rows(db)]
        for intent in candidates:
            payload = intent.private_record() if hasattr(intent, "private_record") else intent
            if any(item["symbol"] == payload["symbol"] and item["side"] == payload["side"] for item in pending):
                continue
            if payload["side"] == "buy":
                pending_buys = sum(item["side"] == "buy" for item in pending)
                if len(state["positions"]) + pending_buys >= config["risk"]["max_positions"]:
                    continue
                if state["daily_entries"] + pending_buys >= config["risk"]["max_entries_per_day"]:
                    continue
            if self._store_intent(db, intent):
                pending.append(payload)
        decision = {
            "run_id": config["run_id"],
            "strategy_id": config["strategy_id"],
            "strategy_version": config["strategy_version"],
            "config_hash": state["config_hash"],
            "session": session,
            "signal_at": signal_at.isoformat(),
            "latest_completed": {symbol: bars[symbol][-1].completed_at.isoformat() for symbol in sorted(bars)},
            "intent_ids": sorted(payload["intent_id"] for payload in pending),
        }
        decision_id = digest(decision)
        db.execute("INSERT OR IGNORE INTO decisions VALUES(?,?,?)", (decision_id, digest(decision), canonical(decision)))

    def _observation(self, db, state, current, session):
        received_at = max(batch.received_at for batch, _bars in current.values())
        quotes = {
            symbol: {
                "price": str(bars[-1].close),
                "currency": "USD",
                "asof": bars[-1].completed_at.isoformat(),
            }
            for symbol, (_batch, bars) in sorted(current.items())
        }
        observation = {
            "session": session,
            "received_at": received_at.isoformat(),
            "quotes": quotes,
            "source_event_ids": sorted(batch.source_event_id for batch, _bars in current.values()),
        }
        observation_id = digest(observation)
        db.execute("INSERT OR IGNORE INTO observations VALUES(?,?)", (observation_id, canonical(observation)))
        state["last_observation"] = received_at.isoformat()

    def tick(self, run_id, *, adapter, at_time=None):
        simulation = at_time is not None
        requested_now = aware(at_time if simulation else self.clock(), "tick")
        with self._lock(run_id) as run_dir:
            config = self._config(run_dir)
            if digest(config) == "" or config["run_id"] != run_id:
                raise StateError("frozen config identity")
            with self._connect(run_dir) as db:
                state = self._book(db)
                if digest(config) != state["config_hash"]:
                    raise StateError("frozen config hash mismatch")
                self._ensure_tick_order(state, requested_now)
                session, window = self._session_for_now(requested_now)
                start, end = config["period"]["start"], config["period"]["end"]
                if (window is None or not start <= session <= end
                        or requested_now < window.open_at or requested_now > window.close_at):
                    db.execute("BEGIN IMMEDIATE")
                    if window and requested_now > window.close_at and state["positions"]:
                        state["unresolved_overnight"] = True
                        state["state"] = "unresolved_overnight"
                        self._warning(db, state, requested_now, "session closed with unresolved position")
                    state["last_tick"] = requested_now.isoformat()
                    self._save_book(db, state)
                    db.commit()
                    return self._status(db, state)

            batches = []
            fetch_error = None
            for symbol in config["universe"]:
                try:
                    batches.append(adapter.fetch(symbol, requested_at=requested_now))
                except Exception as exc:
                    fetch_error = f"data source failure for {symbol}: {type(exc).__name__}"
                    break
            observed_now = (max((batch.received_at for batch in batches), default=requested_now)
                            if simulation else aware(self.clock(), "post-fetch clock"))

            with self._connect(run_dir) as db:
                db.execute("BEGIN IMMEDIATE")
                state = self._book(db)
                self._ensure_tick_order(state, observed_now)
                observed_session, observed_window = self._session_for_now(observed_now)
                if (observed_session != session or observed_window is None
                        or observed_now > observed_window.close_at):
                    for batch in batches:
                        self._store_source(db, batch)
                    state["data_hold"] = True
                    self._warning(db, state, observed_now, "fetch crossed the session boundary")
                    state["last_tick"] = observed_now.isoformat()
                    self._save_book(db, state)
                    db.commit()
                    return self._status(db, state)
                if state["current_session"] != session:
                    if state["current_session"] is not None and state["positions"]:
                        state["unresolved_overnight"] = True
                        state["state"] = "unresolved_overnight"
                    state.update(
                        current_session=session,
                        session_open_nav=state["nav"],
                        daily_entries=0,
                        daily_trades=0,
                        daily_turnover_notional="0",
                        entries_by_symbol={},
                        daily_halt=False,
                    )
                if fetch_error:
                    for batch in batches:
                        self._store_source(db, batch)
                    state["data_hold"] = True
                    self._warning(db, state, observed_now, fetch_error)
                    state["last_tick"] = observed_now.isoformat()
                    self._save_book(db, state)
                    db.commit()
                    return self._status(db, state)
                current = self._ingest(db, config, batches, observed_now, session, window)
                if isinstance(current, str):
                    state["data_hold"] = True
                    self._warning(db, state, observed_now, current)
                    state["last_tick"] = observed_now.isoformat()
                    self._save_book(db, state)
                    db.commit()
                    return self._status(db, state)
                held_actions = []
                for batch in batches:
                    position = state["positions"].get(batch.symbol)
                    if not position:
                        continue
                    entered_at = datetime.fromisoformat(position["entered_at"])
                    held_actions.extend(
                        (batch.symbol, action) for action in batch.corporate_actions
                        if datetime.fromisoformat(action["event_at"]) >= entered_at
                    )
                if held_actions or state["corporate_holds"]:
                    for symbol, action in held_actions:
                        state["corporate_holds"][symbol] = action
                    state["performance_provisional"] = True
                    state["data_hold"] = True
                    self._warning(db, state, observed_now, "corporate action requires manual reconciliation")
                    state["last_tick"] = observed_now.isoformat()
                    self._save_book(db, state)
                    db.commit()
                    return self._status(db, state)
                state["data_hold"] = False
                state["last_error"] = None
                state["state"] = "stopped" if state["episode_halt"] else "active"
                prices = self._prices(current)
                state["nav"] = str(self._nav(state, prices))
                self._apply_risk_halts(state, config)
                self._apply_pending(db, state, config, current, session, window, prices)
                state["nav"] = str(self._nav(state, prices))
                self._decision_and_intents(db, state, config, current, session, window)
                self._observation(db, state, current, session)
                state["last_tick"] = observed_now.isoformat()
                self._save_book(db, state)
                db.commit()
                return self._status(db, state)

    def _status(self, db, state):
        session_open = Decimal(state["session_open_nav"])
        turnover = Decimal(state["daily_turnover_notional"])
        return {
            "run_id": state["run_id"],
            "episode_id": state["episode_id"],
            "state": state["state"],
            "cash": state["cash"],
            "nav": state["nav"],
            "positions": len(state["positions"]),
            "fills": db.execute("SELECT count(*) FROM fills").fetchone()[0],
            "pending_intents": db.execute("SELECT count(*) FROM intents WHERE status='pending'").fetchone()[0],
            "data_hold": state["data_hold"],
            "daily_halt": state["daily_halt"],
            "episode_halt": state["episode_halt"],
            "unresolved_overnight": state["unresolved_overnight"],
            "daily_entries": state["daily_entries"],
            "daily_trades": state["daily_trades"],
            "daily_turnover_pct": str(turnover / session_open * 100 if session_open else Decimal(0)),
            "cumulative_base_cost": state["cumulative_base_cost"],
            "cumulative_stress_cost": state["cumulative_stress_cost"],
            "last_observation": state["last_observation"],
            "last_error": state["last_error"],
            "config_hash": state["config_hash"],
        }

    def status(self, run_id):
        with self._lock(run_id) as run_dir:
            with self._connect(run_dir) as db:
                return self._status(db, self._book(db))

    def export(self, run_id, output, *, exported_at=None):
        from export_paper import export_snapshot

        with self._lock(run_id) as run_dir:
            config = self._config(run_dir)
            with self._connect(run_dir) as db:
                if digest(config) != self._book(db)["config_hash"]:
                    raise StateError("frozen config hash mismatch")
            snapshot = export_snapshot(
                run_dir / "ledger.sqlite3",
                run_dir / "config.json",
                episode_id=config["episode_id"],
                now=exported_at,
            )
            destination = Path(output)
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_suffix(destination.suffix + ".tmp")
            temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
            temporary.replace(destination)
            return {
                "status": "exported",
                "episode_id": snapshot["episodeId"],
                "as_of": snapshot["asOf"],
                "output": str(destination),
            }


class RecordedBatchAdapter:
    """Explicit test-only adapter for exercising the CLI without a market request."""

    def __init__(self, path):
        try:
            document = json.loads(Path(path).read_text())
        except (OSError, json.JSONDecodeError) as exc:
            raise StateError("invalid fixture file") from exc
        if not isinstance(document, dict) or document.get("testOnly") is not True or set(document) != {"testOnly", "batches"}:
            raise StateError("fixture must be explicitly test-only")
        if not isinstance(document["batches"], dict):
            raise StateError("invalid fixture batches")
        self.document = document

    def fetch(self, symbol, *, requested_at):
        try:
            item = self.document["batches"][symbol]
            received_at = _timestamp(item["received_at"], "fixture receipt")
            records = item["bars"]
        except (KeyError, TypeError, ConfigError) as exc:
            raise StateError(f"missing fixture batch for {symbol}") from exc
        bars = []
        for record in records:
            try:
                bars.append(Bar(
                    symbol=symbol,
                    event_at=_timestamp(record["event_at"], "fixture event"),
                    completed_at=_timestamp(record["completed_at"], "fixture completion"),
                    open=record["open"], high=record["high"], low=record["low"], close=record["close"],
                    volume=record["volume"], source_event_id=record["source_event_id"],
                ))
            except (KeyError, TypeError, BarValidationError) as exc:
                raise StateError("invalid fixture bar") from exc
        raw = canonical(item).encode()
        return BarBatch(
            source="synthetic-cli-test-only",
            symbol=symbol,
            request_url=f"fixture://{symbol}",
            requested_at=aware(requested_at, "fixture request"),
            received_at=received_at,
            raw_sha256=digest(raw),
            raw_response=raw,
            bars=tuple(bars),
        )


def main(argv=None, *, calendar=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="Isolated private run root")
    subparsers = parser.add_subparsers(dest="command", required=True)
    init = subparsers.add_parser("init")
    init.add_argument("--config", required=True)
    init.add_argument("--at", required=True)
    tick = subparsers.add_parser("tick")
    tick.add_argument("--run-id", required=True)
    tick.add_argument("--fixture", help="Explicit test-only recorded batch JSON")
    tick.add_argument("--simulation-at", help="Test-only injected clock; requires --fixture")
    status = subparsers.add_parser("status")
    status.add_argument("--run-id", required=True)
    export = subparsers.add_parser("export")
    export.add_argument("--run-id", required=True)
    export.add_argument("--output", required=True)
    export.add_argument("--exported-at")
    sample = subparsers.add_parser("sample")
    sample.add_argument("--symbol", default="SPY")
    sample.add_argument("--at", help="Request timestamp only; defaults to the wall clock")
    args = parser.parse_args(argv)
    try:
        if args.command == "sample":
            adapter = YahooChartAdapter(max_attempts=1)
            requested_at = _timestamp(args.at) if args.at else datetime.now(timezone.utc)
            batch = adapter.fetch(args.symbol, requested_at=requested_at)
            result = {
                "source": batch.source,
                "symbol": batch.symbol,
                "received_at": batch.received_at.isoformat(),
                "raw_sha256": batch.raw_sha256,
                "bars": len(batch.bars),
                "first_event_at": batch.bars[0].event_at.isoformat(),
                "last_completed_at": batch.bars[-1].completed_at.isoformat(),
            }
            print(json.dumps(result, sort_keys=True))
            return 0
        engine = IntradayPaperEngine(args.root, calendar=calendar)
        if args.command == "init":
            result = engine.initialize(json.loads(Path(args.config).read_text()), at_time=_timestamp(args.at))
        elif args.command == "tick":
            config = engine._config(engine._run_dir(args.run_id))
            if args.simulation_at and not args.fixture:
                raise StateError("--simulation-at requires an explicit test fixture")
            adapter = (RecordedBatchAdapter(args.fixture) if args.fixture
                       else YahooChartAdapter(max_attempts=config["data"]["max_attempts"]))
            result = engine.tick(
                args.run_id,
                adapter=adapter,
                at_time=_timestamp(args.simulation_at) if args.simulation_at else None,
            )
        elif args.command == "status":
            result = engine.status(args.run_id)
        else:
            result = engine.export(args.run_id, args.output, exported_at=args.exported_at)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (ConfigError, StateError, BarValidationError, RuntimeError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
