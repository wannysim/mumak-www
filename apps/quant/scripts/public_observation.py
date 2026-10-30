"""Independent allowlisted observation contract, not a strategy or source authenticator."""
from decimal import Decimal
import json
from pathlib import Path
from zoneinfo import ZoneInfo

from public_operations import check, instant, meaningful

CONTRACT = json.loads((Path(__file__).parent.parent / 'src/lib/observation-contract.json').read_text())
KINDS = {'ingest':'ingest-readback','schedule':'schedule-receipt','collection':'collector-receipt',
         'publication':'publication-receipt','decision':'decision-record','account':'risk-record','symbols':'risk-record'}


def validate_observation(p):
    try:
        check(p, CONTRACT['payload'], CONTRACT)
        if len(json.dumps(p).encode()) > 2 * 1024 * 1024 or p['session'][:7] != p['month']:
            raise ValueError()
        ev = {e['id']:e for e in p['evidence']}
        if len(ev) != len(p['evidence']):
            raise ValueError()
        for e in ev.values():
            if instant(e['evidenceAt']) > instant(e['observedAt']) or instant(e['observedAt']) > instant(p['exportedAt']):
                raise ValueError()
        if max(instant(e['evidenceAt']) for e in ev.values()) != instant(p['sourceAsOf']) or instant(p['sourceAsOf']) > instant(p['exportedAt']):
            raise ValueError()
        if instant(p['effectiveFrom']) >= instant(p['effectiveThrough']):
            raise ValueError()
        def refs(value):
            if isinstance(value, dict):
                ids = value.get('evidenceIds', [])
                if len(set(ids)) != len(ids) or any(i not in ev for i in ids):
                    raise ValueError()
                for child in value.values():
                    refs(child)
            elif isinstance(value, list):
                for child in value:
                    refs(child)
        refs(p)
        def bound(f, stamp):
            if not any(ev[i]['kind'] == KINDS[f] and instant(ev[i]['evidenceAt']) == instant(stamp) for i in p[f]['evidenceIds']):
                raise ValueError()
        def session(stamp):
            if instant(stamp).astimezone(ZoneInfo('America/New_York')).date().isoformat() != p['session']:
                raise ValueError()
        def assessment(value):
            at, until = instant(value['assessedAt']), instant(value['validUntil'])
            if not instant(p['effectiveFrom']) <= at < until <= instant(p['effectiveThrough']):
                raise ValueError()
            session(value['assessedAt'])
        for field in KINDS:
            fact = p[field]
            if fact['value'] is None:
                continue
            if not any(ev[i]['kind'] == KINDS[field] for i in fact['evidenceIds']):
                raise ValueError()
            v = fact['value']
            if field in ('collection','publication','account'):
                assessment(v)
                bound(field, v['assessedAt'])
            elif field == 'decision':
                bound(field, v['at'])
                session(v['at'])
            elif field == 'ingest':
                bound(field, v['readbackAt'])
                if instant(v['snapshotAsOf']) > instant(v['readbackAt']):
                    raise ValueError()
            elif field == 'schedule':
                if instant(v['opensAt']) >= instant(v['closesAt']) or instant(v['nextExpectedAt']) > instant(v['expectedBy']):
                    raise ValueError()
                session(v['opensAt'])
                session(v['closesAt'])
            elif field == 'symbols':
                if len({s['symbol'] for s in v}) != len(v):
                    raise ValueError()
                for s in v:
                    assessment(s)
                    if not any(ev[i]['kind']=='risk-record' and instant(ev[i]['evidenceAt'])==instant(s['assessedAt']) for i in s['evidenceIds']):
                        raise ValueError()
                    if s['inputConfidence']=='unknown' and s['state'] not in ('unknown','hold'):
                        raise ValueError()
                    required = ('entryPrice','sigmaEntry','highWater','mark','stopThreshold')
                    if s['inputConfidence']=='validated' and any(s[k] is None or Decimal(s[k])<=0 for k in required):
                        raise ValueError()
                    if any(s[k] is not None and Decimal(s[k])<=0 for k in required):
                        raise ValueError()
                    if (s['exposureProxy'] is not None and Decimal(s['exposureProxy'])<0) or (s['gamma'] is not None and Decimal(s['gamma'])<=0):
                        raise ValueError()
                    if s['targetQuantity'] is not None and s['targetQuantity'] > s['quantity']:
                        raise ValueError()
                    if s['state']=='full-exit' and (s['targetQuantity']!=0 or s['reason'] not in ('symbol-stop','symbol-trim','account-stop')):
                        raise ValueError()
                    if s['state']=='trim' and (s['targetQuantity'] is None or s['targetQuantity']>=s['quantity'] or s['reason']!='symbol-trim'):
                        raise ValueError()
        a = p['account']['value']
        if a:
            if Decimal(a['dailyStop'])!=Decimal('.01') or Decimal(a['monthlyStop'])!=Decimal('.30'):
                raise ValueError()
            if a['state']=='clear' and (a['reason']!='none' or a['dailyReturn'] is None or a['monthlyReturn'] is None or Decimal(a['dailyReturn'])<=-Decimal(a['dailyStop']) or Decimal(a['monthlyReturn'])<=-Decimal(a['monthlyStop'])):
                raise ValueError()
            if a['state']=='stopped' and a['reason'] not in ('daily-loss-stop','monthly-loss-stop','both-loss-stops'):
                raise ValueError()
            if a['state']=='unknown' and a['reason']!='unknown':
                raise ValueError()
        return p
    except (ValueError, TypeError, KeyError, OverflowError, RecursionError):
        raise ValueError('Invalid public observation') from None
