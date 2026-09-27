"""Pure contracts and validation for an isolated intraday paper experiment.

This module has no broker, credential, network-write, or ledger-write capability.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import json
import re
import time
from typing import Mapping, Protocol, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


class BarValidationError(ValueError):
    """A source response cannot safely become decision input."""


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(value):
    payload = value if isinstance(value, bytes) else canonical(value).encode()
    return hashlib.sha256(payload).hexdigest()


def decimal_value(value, name="value", *, positive=False, nonnegative=False):
    if isinstance(value, bool):
        raise BarValidationError(f"invalid {name}")
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise BarValidationError(f"invalid {name}") from exc
    if not result.is_finite():
        raise BarValidationError(f"invalid {name}")
    if positive and result <= 0:
        raise BarValidationError(f"invalid {name}")
    if nonnegative and result < 0:
        raise BarValidationError(f"invalid {name}")
    return result


def aware(value, name="timestamp"):
    if not isinstance(value, datetime) or value.tzinfo is None:
        raise BarValidationError(f"timezone required for {name}")
    return value.astimezone(timezone.utc)


@dataclass(frozen=True, slots=True)
class SessionWindow:
    session: str
    open_at: datetime
    close_at: datetime

    def __post_init__(self):
        open_at = aware(self.open_at, "session open")
        close_at = aware(self.close_at, "session close")
        if open_at >= close_at:
            raise BarValidationError("invalid session window")
        object.__setattr__(self, "open_at", open_at)
        object.__setattr__(self, "close_at", close_at)


@dataclass(frozen=True, slots=True)
class Bar:
    symbol: str
    event_at: datetime
    completed_at: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal
    source_event_id: str

    def __post_init__(self):
        event_at = aware(self.event_at, "bar event")
        completed_at = aware(self.completed_at, "bar completion")
        prices = tuple(decimal_value(value, "bar price", positive=True) for value in (self.open, self.high, self.low, self.close))
        volume = decimal_value(self.volume, "bar volume", nonnegative=True)
        if completed_at <= event_at:
            raise BarValidationError("invalid bar interval")
        if prices[1] < max(prices[0], prices[3]) or prices[2] > min(prices[0], prices[3]) or prices[2] > prices[1]:
            raise BarValidationError("invalid OHLC relationship")
        object.__setattr__(self, "event_at", event_at)
        object.__setattr__(self, "completed_at", completed_at)
        object.__setattr__(self, "open", prices[0])
        object.__setattr__(self, "high", prices[1])
        object.__setattr__(self, "low", prices[2])
        object.__setattr__(self, "close", prices[3])
        object.__setattr__(self, "volume", volume)

    def private_record(self):
        return {
            "symbol": self.symbol,
            "event_at": self.event_at.isoformat(),
            "completed_at": self.completed_at.isoformat(),
            "open": str(self.open),
            "high": str(self.high),
            "low": str(self.low),
            "close": str(self.close),
            "volume": str(self.volume),
            "source_event_id": self.source_event_id,
        }


@dataclass(frozen=True, slots=True)
class BarBatch:
    source: str
    symbol: str
    request_url: str
    requested_at: datetime
    received_at: datetime
    raw_sha256: str
    raw_response: bytes
    bars: tuple[Bar, ...]
    corporate_actions: tuple[dict, ...] = ()

    @property
    def source_event_id(self):
        return digest({
            "source": self.source,
            "symbol": self.symbol,
            "requested_at": self.requested_at.isoformat(),
            "received_at": self.received_at.isoformat(),
            "raw_sha256": self.raw_sha256,
        })


@dataclass(frozen=True, slots=True)
class TradeIntent:
    intent_id: str
    run_id: str
    session: str
    symbol: str
    side: str
    reason: str
    signal_at: datetime
    eligible_after: datetime
    reference_price: Decimal
    target_fraction: Decimal | None = None

    def private_record(self):
        return {
            "intent_id": self.intent_id,
            "run_id": self.run_id,
            "session": self.session,
            "symbol": self.symbol,
            "side": self.side,
            "reason": self.reason,
            "signal_at": self.signal_at.isoformat(),
            "eligible_after": self.eligible_after.isoformat(),
            "reference_price": str(self.reference_price),
            "target_fraction": str(self.target_fraction) if self.target_fraction is not None else None,
        }


@dataclass(frozen=True, slots=True)
class StrategyContext:
    run_id: str
    session: str
    signal_at: datetime
    session_window: SessionWindow
    bars: Mapping[str, Sequence[Bar]]
    positions: Mapping[str, Mapping[str, str]]
    prior_opening_volumes: Mapping[str, Sequence[Decimal]]
    parameters: Mapping[str, object]


class Strategy(Protocol):
    strategy_id: str

    def generate_intents(self, context: StrategyContext) -> tuple[TradeIntent, ...]: ...


class BarDataAdapter(Protocol):
    def fetch(self, symbol: str, *, requested_at: datetime) -> BarBatch: ...


class TradingCalendar(Protocol):
    def session(self, session: str) -> SessionWindow | None: ...


class StrategyRegistry:
    def __init__(self):
        self._strategies = {}

    def register(self, strategy: Strategy):
        strategy_id = getattr(strategy, "strategy_id", None)
        if not isinstance(strategy_id, str) or not strategy_id:
            raise ValueError("strategy id required")
        if strategy_id in self._strategies:
            raise ValueError("strategy already registered")
        self._strategies[strategy_id] = strategy

    def resolve(self, strategy_id: str) -> Strategy:
        try:
            return self._strategies[strategy_id]
        except KeyError as exc:
            raise ValueError("unknown strategy") from exc


class ExchangeCalendarsXNYS:
    """Small injected boundary around exchange_calendars' XNYS schedule."""

    def __init__(self, calendar=None):
        if calendar is None:
            try:
                import exchange_calendars
            except ImportError as exc:
                raise RuntimeError(
                    "exchange_calendars is required for non-test XNYS scheduling; "
                    "tests must inject a calendar"
                ) from exc
            calendar = exchange_calendars.get_calendar("XNYS")
        self.calendar = calendar

    @staticmethod
    def _datetime(value):
        if hasattr(value, "to_pydatetime"):
            value = value.to_pydatetime()
        return aware(value, "calendar timestamp")

    def session(self, session):
        if not self.calendar.is_session(session):
            return None
        return SessionWindow(
            session=session,
            open_at=self._datetime(self.calendar.session_open(session)),
            close_at=self._datetime(self.calendar.session_close(session)),
        )


class YahooChartAdapter:
    """Bounded public chart reader. It has no auth, broker, or write endpoint."""

    MAX_RESPONSE_BYTES = 5 * 1024 * 1024

    def __init__(self, *, opener=urlopen, now=None, sleep=time.sleep, max_attempts=3, timeout=8):
        if not 1 <= max_attempts <= 3 or not 1 <= timeout <= 15:
            raise ValueError("unsafe request bounds")
        self.opener = opener
        self.now = now or (lambda: datetime.now(timezone.utc))
        self.sleep = sleep
        self.max_attempts = max_attempts
        self.timeout = timeout

    @staticmethod
    def _url(symbol):
        if not isinstance(symbol, str) or not re.fullmatch(r"[A-Z][A-Z0-9.\-]{0,9}", symbol):
            raise BarValidationError("invalid symbol")
        return (
            "https://query1.finance.yahoo.com/v8/finance/chart/"
            f"{quote(symbol, safe='')}?interval=5m&range=5d&includePrePost=false&events=div%2Csplits"
        )

    def fetch(self, symbol, *, requested_at):
        requested_at = aware(requested_at, "request")
        url = self._url(symbol)
        request = Request(url, headers={
            "Accept": "application/json",
            "User-Agent": "mumak-intraday-paper/1.0 (read-only; no-auth)",
        })
        last_error = None
        for attempt in range(self.max_attempts):
            try:
                with self.opener(request, timeout=self.timeout) as response:
                    raw = response.read(self.MAX_RESPONSE_BYTES + 1)
                if len(raw) > self.MAX_RESPONSE_BYTES:
                    raise BarValidationError("source response too large")
                received_at = aware(self.now(), "receipt")
                return normalize_yahoo_chart(
                    raw,
                    symbol=symbol,
                    request_url=url,
                    requested_at=requested_at,
                    received_at=received_at,
                )
            except BarValidationError:
                raise
            except (HTTPError, URLError, TimeoutError, OSError) as exc:
                last_error = exc
                self.now()
                if attempt + 1 < self.max_attempts:
                    self.sleep(0.25 * (2 ** attempt))
        raise BarValidationError("chart source unavailable") from last_error


def normalize_yahoo_chart(raw, *, symbol, request_url, requested_at, received_at):
    """Validate one no-auth Yahoo chart response and preserve its raw evidence."""
    if not isinstance(raw, bytes) or not raw:
        raise BarValidationError("missing raw response")
    requested_at = aware(requested_at, "request")
    received_at = aware(received_at, "receipt")
    if requested_at > received_at:
        raise BarValidationError("future request")
    try:
        document = json.loads(raw)
        chart = document["chart"]
        results = chart["result"]
    except (UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError) as exc:
        raise BarValidationError("malformed source response") from exc
    if chart.get("error") is not None or not isinstance(results, list) or len(results) != 1:
        raise BarValidationError("source error or missing result")
    result = results[0]
    meta = result.get("meta")
    if not isinstance(meta, dict):
        raise BarValidationError("missing metadata")
    if (meta.get("symbol") != symbol or meta.get("currency") != "USD"
            or meta.get("exchangeTimezoneName") != "America/New_York"
            or meta.get("dataGranularity") != "5m"):
        raise BarValidationError("source metadata mismatch")
    timestamps = result.get("timestamp")
    quotes = (result.get("indicators") or {}).get("quote")
    if not isinstance(timestamps, list) or not timestamps or not isinstance(quotes, list) or len(quotes) != 1:
        raise BarValidationError("missing bar series")
    quote = quotes[0]
    fields = ("open", "high", "low", "close", "volume")
    if any(not isinstance(quote.get(field), list) or len(quote[field]) != len(timestamps) for field in fields):
        raise BarValidationError("missing aligned bar fields")

    raw_hash = digest(raw)
    bars = []
    by_timestamp = {}
    previous = None
    for index, epoch in enumerate(timestamps):
        if isinstance(epoch, bool) or not isinstance(epoch, int):
            raise BarValidationError("invalid event time")
        event_at = datetime.fromtimestamp(epoch, timezone.utc)
        completed_at = event_at + timedelta(minutes=5)
        values = tuple(quote[field][index] for field in fields)
        signature = tuple(str(value) for value in values)
        if epoch in by_timestamp:
            if by_timestamp[epoch] != signature:
                raise BarValidationError("conflicting revision")
            raise BarValidationError("duplicate bar")
        if previous is not None and epoch < previous:
            raise BarValidationError("reordered bars")
        by_timestamp[epoch] = signature
        previous = epoch
        is_trailing_forming = index == len(timestamps) - 1 and event_at <= received_at < completed_at
        if event_at > received_at:
            raise BarValidationError("future-start bar")
        if completed_at > received_at:
            if is_trailing_forming:
                continue
            raise BarValidationError("non-trailing incomplete bar")
        if any(value is None for value in values):
            raise BarValidationError("missing bar value")
        source_event_id = digest({"raw_sha256": raw_hash, "symbol": symbol, "event_at": event_at.isoformat()})
        bars.append(Bar(
            symbol=symbol,
            event_at=event_at,
            completed_at=completed_at,
            open=values[0],
            high=values[1],
            low=values[2],
            close=values[3],
            volume=values[4],
            source_event_id=source_event_id,
        ))
    if not bars:
        raise BarValidationError("missing completed bars")
    corporate_actions = []
    events = result.get("events") or {}
    if not isinstance(events, dict):
        raise BarValidationError("malformed corporate events")
    for event_type in ("dividends", "splits"):
        collection = events.get(event_type) or {}
        if not isinstance(collection, dict):
            raise BarValidationError("malformed corporate events")
        for key, event in sorted(collection.items()):
            if not isinstance(event, dict):
                raise BarValidationError("malformed corporate event")
            epoch = event.get("date")
            if isinstance(epoch, bool) or not isinstance(epoch, int):
                try:
                    epoch = int(key)
                except (TypeError, ValueError) as exc:
                    raise BarValidationError("malformed corporate event time") from exc
            event_at = datetime.fromtimestamp(epoch, timezone.utc)
            if event_at > received_at:
                raise BarValidationError("future corporate event")
            corporate_actions.append({
                "type": event_type[:-1],
                "event_at": event_at.isoformat(),
                "source_event_id": digest({
                    "raw_sha256": raw_hash,
                    "symbol": symbol,
                    "event_type": event_type,
                    "event_at": event_at.isoformat(),
                }),
            })
    return BarBatch(
        source="yahoo-chart-no-auth",
        symbol=symbol,
        request_url=request_url,
        requested_at=requested_at,
        received_at=received_at,
        raw_sha256=raw_hash,
        raw_response=raw,
        bars=tuple(bars),
        corporate_actions=tuple(corporate_actions),
    )
