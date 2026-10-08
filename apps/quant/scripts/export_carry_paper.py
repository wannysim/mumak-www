"""Read-only public projection of a monthly PAPER ledger carried from a prior month.

The source ledgers are never changed; carried holdings are not fabricated fills.
Only a reconciled current-month observation and source close can be published.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import re
import sqlite3
from zoneinfo import ZoneInfo

from export_paper import (
    ExportError, PUBLIC_FILL_REASONS, export_snapshot, number, session_date, text, timestamp,
)

NY = ZoneInfo('America/New_York')
SYMBOL = re.compile(r'[A-Z0-9][A-Z0-9.\-]{0,15}')
FILL_ID = re.compile(r'[A-Za-z0-9:.+_\-]{1,200}')
EPISODE_ID = re.compile(r'[a-zA-Z0-9_-]{1,80}')


def export_carry_snapshot(ledger, policy_path, source_ledger, source_policy_path, *, episode_id, now=None):
    policy = json.loads(Path(policy_path).read_text())
    start = session_date(policy.get('paper_start_session'))
    end = session_date(policy.get('paper_end_session'))
    month = start.strftime('%Y-%m')
    source_policy = json.loads(Path(source_policy_path).read_text())
    source_end = session_date(source_policy.get('paper_end_session'))
    if (policy.get('live') is not False or start > end or end.strftime('%Y-%m') != month
            or source_end >= start or source_end.strftime('%Y-%m') == month
            or not EPISODE_ID.fullmatch(episode_id)):
        raise ExportError('Invalid PAPER-only monthly carry configuration')
    source = export_snapshot(source_ledger, source_policy_path, episode_id='source-verified')
    if (source['month'] != source_end.strftime('%Y-%m')
            or source['status'] not in ('active', 'stopped')):
        raise ExportError('Invalid source close')

    with sqlite3.connect(Path(ledger).resolve().as_uri() + '?mode=ro', uri=True) as conn:
        conn.execute('PRAGMA query_only=ON')
        conn.execute('BEGIN')
        book = json.loads(conn.execute('SELECT payload FROM book').fetchone()[0])
        opening_rows = conn.execute('SELECT payload FROM opening_balance').fetchall()
        fills = [json.loads(row[0]) for row in conn.execute('SELECT payload FROM fills')]
        observations = [json.loads(row[0]) for row in conn.execute('SELECT payload FROM observations')]
    if len(opening_rows) != 1:
        raise ExportError('Expected exactly one opening balance')
    opening = json.loads(opening_rows[0][0])
    baseline = number(opening.get('month_start_nav'))
    cash = number(opening.get('cash'))
    source_close = opening.get('source_close') or {}
    source_observation = opening.get('source_close_observation') or {}
    if (book.get('live') is not False or book.get('mode') != 'forward_paper'
            or opening.get('live') is not False or opening.get('mode') != 'forward_paper'
            or opening.get('not_a_fill') is not True
            or opening.get('no_retrospective_execution') is not True
            or opening.get('month') != month or book.get('month') != month
            or book.get('performance_provisional') is not False or book.get('corporate_holds')
            or number(book.get('net_contributions', 0)) != 0
            or book.get('cashflows') or book.get('external_flows')
            or number(book.get('month_start_nav')) != baseline
            or baseline <= 0 or cash < 0
            or source_close.get('session') != source_end.isoformat()
            or number(source_close.get('nav')) != baseline
            or source_observation.get('received_at') != source['asOf']
            or number(source['summary']['currentNav']) != baseline
            or number(source['summary']['cash']) != cash
            or (opening.get('source_root') is not None
                and Path(opening['source_root']).resolve() != Path(source_ledger).resolve().parent)):
        raise ExportError('Carry baseline does not match verified source close')
    source_holdings = {holding['symbol']: holding for holding in source['holdings']}
    positions = {}
    costs = {}
    for symbol, carried in opening.get('positions', {}).items():
        if not SYMBOL.fullmatch(symbol) or symbol not in source_holdings:
            raise ExportError('Carry symbol not present in source close')
        qty = number(carried.get('qty'))
        old = source_holdings[symbol]
        if qty <= 0 or qty != number(old['quantity']):
            raise ExportError('Carry quantity mismatch')
        quote = (source_observation.get('quotes') or {}).get(symbol) or {}
        if (number(quote.get('price')) != number(old['markPrice'])
                or quote.get('asof') != old['markAsOf']):
            raise ExportError('Carry quote mismatch')
        positions[symbol] = qty
        costs[symbol] = qty * number(old['averageCost'])
    if set(source_holdings) != set(positions):
        raise ExportError('Missing carried position')
    if not observations:
        raise ExportError('No current-month observation')
    seen = set()
    for fill in fills:
        fid, symbol = fill.get('id'), fill.get('symbol')
        if (not isinstance(fid, str) or not FILL_ID.fullmatch(fid) or fid in seen
                or not isinstance(symbol, str) or not SYMBOL.fullmatch(symbol)
                or fill.get('paper_only') is not True or fill.get('side') not in ('buy', 'sell')
                or number(fill.get('quantity')) <= 0 or number(fill.get('modeled_price')) <= 0
                or number(fill.get('commission')) < 0):
            raise ExportError('Invalid current-month fill')
        seen.add(fid)
        date = timestamp(fill['filled_at']).astimezone(NY).date()
        if not start <= date <= end or fill.get('session') != date.isoformat():
            raise ExportError('Fill outside current month')
    for observation in observations:
        received = timestamp(observation['received_at'])
        date = received.astimezone(NY).date()
        if not start <= date <= end or observation.get('session') != date.isoformat():
            raise ExportError('Observation outside current month')
        for quote in observation['quotes'].values():
            if (quote.get('currency') != 'USD' or number(quote.get('price')) <= 0
                    or timestamp(quote['asof']) > received):
                raise ExportError('Invalid current-month quote')
    fills.sort(key=lambda fill: (timestamp(fill['filled_at']), fill['id']))
    observations.sort(key=lambda observation: timestamp(observation['received_at']))
    history, public_fills, latest_quotes = [], [], {}
    index = 0
    for observation in observations:
        at = timestamp(observation['received_at'])
        while index < len(fills) and timestamp(fills[index]['filled_at']) <= at:
            fill = fills[index]
            symbol = fill['symbol']
            qty, price, fee = (number(fill['quantity']), number(fill['modeled_price']),
                               number(fill['commission']))
            held = positions.get(symbol, Decimal(0))
            basis = costs.get(symbol, Decimal(0))
            if fill['side'] == 'buy':
                cash -= qty * price + fee
                positions[symbol] = held + qty
                costs[symbol] = basis + qty * price + fee
            else:
                if qty > held:
                    raise ExportError('Sale exceeds carried position')
                cash += qty * price - fee
                positions[symbol] = held - qty
                costs[symbol] = basis * (held - qty) / held
            public_fills.append({
                'id': fill['id'], 'at': fill['filled_at'], 'symbol': symbol,
                'side': fill['side'], 'quantity': text(qty), 'price': text(price),
                'commission': text(fee),
                'reason': PUBLIC_FILL_REASONS.get(fill['reason'])
                if isinstance(fill.get('reason'), str) else None,
            })
            index += 1
        quotes = observation['quotes']
        active = {symbol: qty for symbol, qty in positions.items() if qty > 0}
        if not all(symbol in quotes for symbol in active):
            continue
        nav = cash + sum((qty * number(quotes[symbol]['price'])
                          for symbol, qty in active.items()), Decimal(0))
        history.append({'at': observation['received_at'], 'nav': text(nav),
                        'profit': text(nav - baseline),
                        'returnPct': text((nav / baseline - 1) * 100)})
        latest_quotes = quotes
    if (not history or index != len(fills)
            or timestamp(history[-1]['at']) != timestamp(observations[-1]['received_at'])
            or timestamp(history[-1]['at']) != timestamp(book['last_observation'])):
        raise ExportError('No complete current valuation after all fills')
    actual = {symbol: number(position['qty']) for symbol, position in book['positions'].items()
              if number(position['qty']) != 0}
    replay = {symbol: qty for symbol, qty in positions.items() if qty != 0}
    if (replay != actual or cash != number(book['cash'])
            or number(history[-1]['nav']) != number(book['nav'])):
        raise ExportError('Ledger reconciliation failed')
    holdings = []
    for symbol, qty in sorted(replay.items()):
        quote, basis = latest_quotes[symbol], costs[symbol]
        mark = number(quote['price'])
        value = qty * mark
        if basis <= 0:
            raise ExportError('Invalid carried cost basis')
        holdings.append({
            'symbol': symbol, 'quantity': text(qty), 'averageCost': text(basis / qty),
            'markPrice': text(mark), 'markAsOf': quote['asof'], 'marketValue': text(value),
            'unrealizedPnl': text(value - basis), 'returnPct': text((value / basis - 1) * 100),
        })
    current = number(history[-1]['nav'])
    return {
        'schemaVersion': 1, 'mode': 'paper', 'episodeId': episode_id, 'month': month,
        'label': f'{start.year}년 {start.month}월 · 미국 주식 저빈도 추세 모의운용',
        'currency': 'USD', 'status': 'stopped' if book.get('monthly_halt') else 'active',
        'startedAt': observations[0]['received_at'], 'asOf': history[-1]['at'],
        'exportedAt': now or datetime.now(timezone.utc).isoformat(),
        'source': 'forward-paper-ledger', 'baselineKind': 'month-start',
        'summary': {
            'startingNav': text(baseline), 'currentNav': text(current), 'cash': text(cash),
            'netContributions': '0', 'profit': text(current - baseline),
            'returnPct': text((current / baseline - 1) * 100),
            'returnMethod': 'simple-no-flows',
        },
        'holdings': holdings, 'history': history, 'fills': public_fills,
        'notes': [
            '실제 시세를 이용한 가상 자금 모의운용입니다. 실계좌 잔고가 아닙니다.',
            '9월 말 현금·보유종목을 그대로 이월했으며 이월은 가상 체결이 아닙니다.',
            '월 수익률은 검증된 9월 30일 마감 NAV를 기준으로 합니다.',
            '화면 갱신은 새 시세 수신을 뜻하지 않습니다.',
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ledger', required=True)
    parser.add_argument('--policy', required=True)
    parser.add_argument('--source-ledger', required=True)
    parser.add_argument('--source-policy', required=True)
    parser.add_argument('--episode-id', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    snapshot = export_carry_snapshot(
        args.ledger, args.policy, args.source_ledger, args.source_policy,
        episode_id=args.episode_id,
    )
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + '.tmp')
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(output)
    print(json.dumps({'status': 'exported', 'mode': 'paper', 'month': snapshot['month'],
                      'asOf': snapshot['asOf'], 'fills': len(snapshot['fills'])}))


if __name__ == '__main__':
    main()
