"""Read-only projection of a forward-paper ledger. No broker access or live export.

The operational SQLite ledger remains authoritative. This adapter supports one
explicitly configured, no-external-flow monthly episode starting in cash.
It reconciles every fill and rejects unsupported events rather than invent NAV.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import re
import sqlite3
from zoneinfo import ZoneInfo


class ExportError(ValueError):
    """Source data cannot be safely projected."""


PUBLIC_FILL_REASONS = {
    'rebalance': '정기 리밸런싱',
    'risk_stop': '위험 한도에 따른 매도',
    'concentration_reduction': '집중도 한도 조정',
}
PUBLIC_REASON_LABELS = frozenset(PUBLIC_FILL_REASONS.values())
DEFAULT_LABEL = '미국 주식 저빈도 추세 모의운용'
DEFAULT_NOTES = [
    '실제 시세를 이용한 가상 자금 모의운용입니다. 실계좌 잔고가 아닙니다.',
    '월중 시작한 회차로 시작일 이후의 성과입니다. 입출금 없는 회차만 지원합니다.',
    '평균 매입가는 모의 매입 수수료를 포함합니다. 매도 비용은 월 손익에 반영됩니다.',
    '기존 시세 수집은 약 15분 간격입니다. 화면 갱신이 새 시세 수신을 뜻하지 않습니다.',
]


def number(value):
    try:
        result = Decimal(str(value))
    except InvalidOperation as exc:
        raise ExportError('Invalid decimal') from exc
    if not result.is_finite():
        raise ExportError('Nonfinite decimal')
    return result


def timestamp(value):
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (ValueError, TypeError, AttributeError) as exc:
        raise ExportError('Invalid timestamp') from exc
    if result.tzinfo is None:
        raise ExportError('Timezone is required')
    return result


def text(value):
    return format(value, 'f')


def session_date(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ExportError('Invalid session date')
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ExportError('Invalid session date') from exc


def presentation(policy):
    raw = policy.get('public_presentation')
    if raw is None:
        raw = policy.get('presentation')
        expected = {'label', 'notes'}
    else:
        expected = {'label', 'notes', 'reason_mapping'}
    if raw is None:
        return DEFAULT_LABEL, list(DEFAULT_NOTES), dict(PUBLIC_FILL_REASONS)
    if not isinstance(raw, dict) or set(raw) != expected:
        raise ExportError('Invalid public presentation fields')
    label, notes = raw['label'], raw['notes']
    if (not isinstance(label, str) or not 1 <= len(label) <= 80
            or label != label.strip() or any(ord(character) < 32 for character in label)):
        raise ExportError('Invalid public label')
    if (not isinstance(notes, list) or len(notes) > 8
            or any(not isinstance(note, str) or not 1 <= len(note) <= 240
                   or note != note.strip() or any(ord(character) < 32 for character in note)
                   for note in notes)):
        raise ExportError('Invalid public notes')
    mapping = dict(PUBLIC_FILL_REASONS)
    if 'reason_mapping' in raw:
        mapping = raw['reason_mapping']
        if (not isinstance(mapping, dict) or len(mapping) > 16
                or any(not isinstance(key, str) or not re.fullmatch(r'[a-z][a-z0-9_]{0,63}', key)
                       or value not in PUBLIC_REASON_LABELS
                       for key, value in mapping.items())):
            raise ExportError('Invalid public reason mapping')
    return label, list(notes), dict(mapping)


def export_snapshot(ledger, policy_path, *, episode_id, now=None):
    policy = json.loads(Path(policy_path).read_text())
    label, notes, reason_mapping = presentation(policy)
    with sqlite3.connect(Path(ledger).resolve().as_uri() + '?mode=ro', uri=True) as c:
        c.execute('PRAGMA query_only=ON')
        c.execute('BEGIN')
        book = json.loads(c.execute('SELECT payload FROM book').fetchone()[0])
        fills = [json.loads(row[0]) for row in c.execute('SELECT payload FROM fills')]
        observations = [json.loads(row[0]) for row in c.execute('SELECT payload FROM observations')]
    initial = number(policy['initial_virtual_cash_usd'])
    period = policy.get('period')
    if period is not None and (not isinstance(period, dict) or set(period) != {'start', 'end'}):
        raise ExportError('Invalid period fields')
    start_session = session_date(period['start'] if period is not None else policy.get('paper_start_session'))
    end_session = session_date(period['end'] if period is not None else policy.get('paper_end_session'))
    month = start_session.strftime('%Y-%m')
    if (policy.get('live') is not False or book.get('live') is not False
            or book.get('mode') != 'forward_paper'):
        raise ExportError('Only explicit forward-paper sources are accepted')
    if (book.get('performance_provisional') is not False or book.get('corporate_holds')
            or number(book.get('net_contributions', 0)) != 0
            or book.get('cashflows') or book.get('external_flows')):
        raise ExportError('Unsupported provisional, corporate-action or cashflow state')
    if (initial <= 0 or start_session > end_session
            or end_session.strftime('%Y-%m') != month):
        raise ExportError('Requires a positive baseline and a single-month episode')
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,80}', episode_id):
        raise ExportError('Invalid episode identifier')
    seen_fills = set()
    for f in fills:
        if f['id'] in seen_fills:
            raise ExportError('Duplicate fill identity')
        seen_fills.add(f['id'])
        if not re.fullmatch(r'[A-Z0-9][A-Z0-9.\-]{0,15}', f['symbol']):
            raise ExportError('Invalid public symbol')
        if not re.fullmatch(r'[A-Za-z0-9:.+_\-]{1,200}', f['id']):
            raise ExportError('Invalid public fill identity')
        if f.get('paper_only') is not True or f.get('side') not in ('buy', 'sell'):
            raise ExportError('Non-paper or unknown fill')
        if number(f['quantity']) <= 0 or number(f['modeled_price']) <= 0 or number(f['commission']) < 0:
            raise ExportError('Invalid fill economics')
        fill_session = timestamp(f['filled_at']).astimezone(ZoneInfo('America/New_York')).date()
        if not start_session <= fill_session <= end_session:
            raise ExportError('Fill outside configured session range')
    for obs in observations:
        observed = timestamp(obs['received_at'])
        observation_session = observed.astimezone(ZoneInfo('America/New_York')).date()
        if not start_session <= observation_session <= end_session:
            raise ExportError('Observation outside configured session range')
        for quote in obs['quotes'].values():
            if (quote['currency'] != 'USD' or number(quote['price']) <= 0
                    or timestamp(quote['asof']) > observed):
                raise ExportError('Invalid currency, price or future quote')
    fills.sort(key=lambda f: (timestamp(f['filled_at']), f['id']))
    observations.sort(key=lambda o: timestamp(o['received_at']))
    cash = initial
    positions = {}
    costs = {}
    history = []
    public_fills = []
    fill_index = 0
    latest_quotes = {}
    for obs in observations:
        at = timestamp(obs['received_at'])
        while fill_index < len(fills) and timestamp(fills[fill_index]['filled_at']) <= at:
            f = fills[fill_index]
            symbol = f['symbol']
            qty, price, fee = number(f['quantity']), number(f['modeled_price']), number(f['commission'])
            held = positions.get(symbol, Decimal(0))
            basis = costs.get(symbol, Decimal(0))
            if f['side'] == 'buy':
                cash -= qty * price + fee
                positions[symbol] = held + qty
                costs[symbol] = basis + qty * price + fee
            else:
                if qty > held:
                    raise ExportError('Sell exceeds owned quantity')
                cash += qty * price - fee
                positions[symbol] = held - qty
                costs[symbol] = basis * (held - qty) / held
            public_fills.append({'id': f['id'], 'at': f['filled_at'], 'symbol': symbol,
                                 'side': f['side'], 'quantity': text(qty), 'price': text(price),
                                 'commission': text(fee),
                                 'reason': reason_mapping.get(f['reason'])
                                 if isinstance(f.get('reason'), str) else None})
            fill_index += 1
        quotes = obs['quotes']
        active = {s: q for s, q in positions.items() if q > 0}
        if not all(s in quotes for s in active):
            continue
        nav = cash + sum((q * number(quotes[s]['price']) for s, q in active.items()), Decimal(0))
        history.append({'at': obs['received_at'], 'nav': text(nav),
                        'profit': text(nav-initial), 'returnPct': text((nav/initial-1)*100)})
        latest_quotes = quotes
    if not observations:
        initialized_at = timestamp(book.get('initialized_at'))
        if (fills or book.get('positions') or number(book.get('cash')) != initial
                or number(book.get('nav')) != initial or book.get('last_observation') is not None
                or book.get('state') != 'pending'
                or initialized_at.astimezone(ZoneInfo('America/New_York')).date() >= start_session):
            raise ExportError('Invalid empty initialized baseline')
        initialized = book['initialized_at']
        return {
            'schemaVersion': 1, 'mode': 'paper', 'episodeId': episode_id, 'month': month,
            'label': label, 'currency': 'USD', 'status': 'pending',
            'startedAt': initialized, 'asOf': initialized,
            'exportedAt': now or datetime.now(timezone.utc).isoformat(),
            'source': 'forward-paper-ledger', 'baselineKind': 'inception',
            'summary': {
                'startingNav': text(initial), 'currentNav': text(initial), 'cash': text(initial),
                'netContributions': '0', 'profit': '0', 'returnPct': '0',
                'returnMethod': 'simple-no-flows',
            },
            'holdings': [],
            'history': [{'at': initialized, 'nav': text(initial), 'profit': '0', 'returnPct': '0'}],
            'fills': [],
            'notes': notes,
        }
    if (not history or fill_index != len(fills)
            or timestamp(history[-1]['at']) != timestamp(observations[-1]['received_at'])
            or timestamp(history[-1]['at']) != timestamp(book['last_observation'])):
        raise ExportError('No complete current valuation after all fills')
    actual = {s: number(p['qty']) for s, p in book['positions'].items() if number(p['qty']) != 0}
    replay = {s: q for s, q in positions.items() if q != 0}
    if replay != actual or cash != number(book['cash']) or number(history[-1]['nav']) != number(book['nav']):
        raise ExportError('Ledger reconciliation failed')
    holdings = []
    for s, qty in sorted(replay.items()):
        quote = latest_quotes[s]
        basis = costs[s]
        mark = number(quote['price'])
        value = qty * mark
        holdings.append({'symbol': s, 'quantity': text(qty), 'averageCost': text(basis/qty),
                         'markPrice': text(mark), 'markAsOf': quote['asof'], 'marketValue': text(value),
                         'unrealizedPnl': text(value-basis), 'returnPct': text((value/basis-1)*100)})
    current = number(history[-1]['nav'])
    return {'schemaVersion': 1, 'mode': 'paper', 'episodeId': episode_id, 'month': month,
            'label': label, 'currency': 'USD',
            'status': 'stopped' if book.get('monthly_halt') else 'active',
            'startedAt': observations[0]['received_at'], 'asOf': history[-1]['at'],
            'exportedAt': now or datetime.now(timezone.utc).isoformat(),
            'source': 'forward-paper-ledger', 'baselineKind': 'inception',
            'summary': {'startingNav': text(initial), 'currentNav': text(current), 'cash': text(cash),
                        'netContributions': '0', 'profit': text(current-initial),
                        'returnPct': text((current/initial-1)*100), 'returnMethod': 'simple-no-flows'},
            'holdings': holdings, 'history': history, 'fills': public_fills,
            'notes': notes}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ledger', required=True)
    parser.add_argument('--policy', required=True)
    parser.add_argument('--episode-id', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    snapshot = export_snapshot(args.ledger, args.policy, episode_id=args.episode_id)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(output.suffix + '.tmp')
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(output)
    print(json.dumps({'status': 'exported', 'mode': 'paper', 'month': snapshot['month'],
                      'asOf': snapshot['asOf'], 'holdings': len(snapshot['holdings'])}))


if __name__ == '__main__':
    main()
