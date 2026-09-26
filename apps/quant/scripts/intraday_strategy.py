"""Preregistered long-only 5-minute opening-range breakout signal."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from intraday_core import TradeIntent, decimal_value, digest


class OpeningRangeBreakout:
    strategy_id = "opening-range-breakout-long-v1"

    @staticmethod
    def _intent(context, symbol, side, reason, bar, target_fraction=None):
        identity = {
            "run_id": context.run_id,
            "session": context.session,
            "symbol": symbol,
            "side": side,
            "reason": reason,
            "signal_at": context.signal_at.isoformat(),
            "eligible_after": bar.completed_at.isoformat(),
        }
        return TradeIntent(
            intent_id=f"{context.run_id}:{digest(identity)}",
            run_id=context.run_id,
            session=context.session,
            symbol=symbol,
            side=side,
            reason=reason,
            signal_at=context.signal_at,
            eligible_after=bar.completed_at,
            reference_price=bar.close,
            target_fraction=target_fraction,
        )

    def generate_intents(self, context):
        signal_at = context.signal_at
        parameters = context.parameters
        force_exit_at = context.session_window.close_at - timedelta(
            minutes=int(parameters["force_exit_minutes_before_close"])
        )
        last_entry_at = context.session_window.close_at - timedelta(
            minutes=int(parameters["last_entry_minutes_before_close"])
        )
        stop_loss = decimal_value(parameters["stop_loss_pct"], "stop loss", positive=True) / Decimal(100)
        profit_target = decimal_value(parameters["profit_target_pct"], "profit target", positive=True) / Decimal(100)
        max_hold_minutes = int(parameters["max_hold_minutes"])
        opening_range_bars = int(parameters["opening_range_bars"])
        buffer = decimal_value(parameters["breakout_buffer_bps"], "breakout buffer", nonnegative=True) / Decimal(10000)
        minimum_relative_volume = decimal_value(parameters["relative_volume_min"], "relative volume", positive=True)
        momentum_bars = int(parameters["momentum_bars"])
        if momentum_bars < 1 or opening_range_bars != 3 or max_hold_minutes < 5:
            raise ValueError("invalid preregistered strategy parameters")

        intents = []
        symbols = sorted(set(context.bars) | set(context.positions))
        for symbol in symbols:
            completed = tuple(sorted(
                (bar for bar in context.bars.get(symbol, ()) if bar.completed_at <= signal_at),
                key=lambda item: item.event_at,
            ))
            if not completed:
                continue
            latest = completed[-1]
            position = context.positions.get(symbol)
            if position:
                if signal_at >= force_exit_at:
                    intents.append(self._intent(context, symbol, "sell", "session_exit", latest))
                    continue
                average_cost = decimal_value(position["average_cost"], "average cost", positive=True)
                if latest.close <= average_cost * (Decimal(1) - stop_loss):
                    intents.append(self._intent(context, symbol, "sell", "risk_stop", latest))
                elif latest.close >= average_cost * (Decimal(1) + profit_target):
                    intents.append(self._intent(context, symbol, "sell", "profit_target", latest))
                elif "entered_at" in position and signal_at >= __import__("datetime").datetime.fromisoformat(
                        position["entered_at"].replace("Z", "+00:00")) + timedelta(minutes=max_hold_minutes):
                    intents.append(self._intent(context, symbol, "sell", "max_hold", latest))
                continue
            if signal_at >= last_entry_at or len(completed) < opening_range_bars + momentum_bars:
                continue
            session_bars = tuple(bar for bar in completed if context.session_window.open_at <= bar.event_at < context.session_window.close_at)
            if len(session_bars) < opening_range_bars + momentum_bars or session_bars[0].event_at != context.session_window.open_at:
                continue
            opening_bars = session_bars[:opening_range_bars]
            prior_volumes = tuple(decimal_value(value, "prior volume", positive=True)
                                  for value in context.prior_opening_volumes.get(symbol, ()))
            if not prior_volumes:
                continue
            average_prior_volume = sum(prior_volumes, Decimal(0)) / len(prior_volumes)
            opening_volume = sum((bar.volume for bar in opening_bars), Decimal(0))
            if opening_volume / average_prior_volume < minimum_relative_volume:
                continue
            comparison = session_bars[-1 - momentum_bars]
            if latest.close <= comparison.close:
                continue
            opening_high = max(bar.high for bar in opening_bars)
            if latest.close <= opening_high * (Decimal(1) + buffer):
                continue
            intents.append(self._intent(
                context,
                symbol,
                "buy",
                "breakout_entry",
                latest,
                target_fraction=Decimal("0.20"),
            ))
        return tuple(intents)
