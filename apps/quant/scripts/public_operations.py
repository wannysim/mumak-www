"""Strict public PAPER sidecar contract. No raw text, runtime imports or ledger IO."""
from datetime import date, datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import re

CONTRACT = json.loads((Path(__file__).parent.parent / 'src/lib/operations-contract.json').read_text())


def instant(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?\+00:00', value):
        raise ValueError('Invalid public operations')
    result = datetime.fromisoformat(value)
    if result.strftime('%H:%M:%S') != value[11:19]:
        raise ValueError('Invalid public operations')
    return result


def check(value, schema, contract=CONTRACT):
    def require(condition):
        if not condition:
            raise ValueError('Invalid public operations')
    if isinstance(schema, dict):
        require(isinstance(value, dict) and set(value) == set(schema))
        for key, child in schema.items():
            check(value[key], child, contract)
    elif isinstance(schema, list):
        require(isinstance(value, list) and schema[1] <= len(value) <= schema[2])
        for child in value:
            check(child, schema[0], contract)
    elif schema.endswith('?'):
        if value is not None:
            check(value, schema[:-1], contract)
    elif schema.startswith('fact:'):
        check(value, contract['definitions']['fact'], contract)
        if value['availability'] == 'recorded':
            require(len(value['evidenceIds']) > 0)
            check(value['value'], schema[5:], contract)
        else:
            require(value['value'] is None)
    elif schema in contract['definitions']:
        check(value, contract['definitions'][schema], contract)
    elif schema in contract['enums']:
        require(isinstance(value, str) and value in contract['enums'][schema])
    elif schema in ('count', 'positive'):
        require(type(value) is int and (1 if schema == 'positive' else 0) <= value <= 9007199254740991)
    elif schema == 'bool':
        require(type(value) is bool)
    elif schema == 'time':
        instant(value)
    elif schema == 'date':
        require(isinstance(value, str) and re.fullmatch(r'\d{4}-\d\d-\d\d', value))
        date.fromisoformat(value)
    elif schema in ('decimal', 'ratio'):
        require(isinstance(value, str) and len(value) <= 80 and re.fullmatch(r'-?(0|[1-9][0-9]*)(\.[0-9]+)?', value))
        if schema == 'ratio':
            require(0 <= Decimal(value) <= 1)
    elif schema in ('id', 'symbol', 'month'):
        pattern = {'id': r'[A-Za-z0-9_-]{1,80}', 'symbol': r'[A-Z0-9][A-Z0-9.\-]{0,15}', 'month': r'[0-9]{4}-(0[1-9]|1[0-2])'}[schema]
        require(isinstance(value, str) and re.fullmatch(pattern, value))
    elif schema != 'any':
        raise ValueError('Invalid public operations')


def meaningful(payload):
    """Observation/export clocks do not change evidence or freshness; preserve stored clocks on noop."""
    return {**{k: v for k, v in payload.items() if k not in ('exportedAt', 'evidence')},
            'evidence': [{k: v for k, v in e.items() if k != 'observedAt'} for e in payload['evidence']]}


def validate_operations(payload):
    """Return the identical payload, or reject the entire projection without private errors."""
    try:
        record_type = payload['recordType']
        if record_type not in ('month', 'session'):
            raise ValueError()
        check(payload, {**CONTRACT['envelope'], **CONTRACT[record_type]})
        if len(json.dumps(payload, ensure_ascii=False).encode()) > 2 * 1024 * 1024:
            raise ValueError()
        evidence = {item['id']: item for item in payload['evidence']}
        if len(evidence) != len(payload['evidence']):
            raise ValueError()
        times = []
        for item in evidence.values():
            if item['evidenceAt'] is None:
                if item['kind'] not in ('policy-declaration', 'preserved-policy'):
                    raise ValueError()
            else:
                times.append(instant(item['evidenceAt']))
                if instant(item['evidenceAt']) > instant(item['observedAt']):
                    raise ValueError()
        if not times or max(times) != instant(payload['sourceAsOf']) or instant(payload['sourceAsOf']) > instant(payload['exportedAt']):
            raise ValueError()
        def walk(value):
            if isinstance(value, dict):
                if 'evidenceIds' in value and (len(set(value['evidenceIds'])) != len(value['evidenceIds']) or any(i not in evidence for i in value['evidenceIds'])):
                    raise ValueError()
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)
        walk(payload)
        if record_type == 'month':
            for strategy in payload['strategies']['value'] or []:
                if strategy['authority'] == 'runtime-receipt' and not any(
                    evidence[i]['kind'] == 'runtime-receipt' and evidence[i]['evidenceAt'] is not None for i in strategy['evidenceIds']
                ):
                    raise ValueError()
                activation = strategy['activationObservedAt']
                if activation['value'] is not None and not any(
                    evidence[i]['kind'] == 'runtime-receipt' and evidence[i]['evidenceAt'] is not None
                    and instant(evidence[i]['evidenceAt']) == instant(activation['value']) for i in activation['evidenceIds']
                ):
                    raise ValueError()
                if strategy['sessionFrom'] > strategy['sessionThrough'] or strategy['sessionFrom'][:7] != payload['month'] or strategy['sessionThrough'][:7] != payload['month']:
                    raise ValueError()
                if strategy['variant'] == 'base' and strategy['rules']['recoveryCadence'] != 'none':
                    raise ValueError()
                if strategy['variant'] == 'C1' and (strategy['effectiveFrom']['value'] is None or strategy['rules']['recoveryCadence'] == 'none'):
                    raise ValueError()
            improvement = payload['improvement']['value']
            if improvement and (improvement['cycleMonth'] != payload['month'] or {s['id'] for s in improvement['stages']} != set(CONTRACT['enums']['improvementId'])):
                raise ValueError()
        else:
            if payload['session'][:7] != payload['month'] or {s['id'] for s in payload['stages']} != set(CONTRACT['enums']['stageId']):
                raise ValueError()
            for stage in payload['stages']:
                if stage['evidenceAt'] is not None and not any(
                    evidence[i]['evidenceAt'] is not None and instant(evidence[i]['evidenceAt']) == instant(stage['evidenceAt'])
                    for i in stage['evidenceIds']
                ):
                    raise ValueError()
                if stage['status'] == 'running' and (stage['startedAt'] is None or stage['leaseUntil'] is None or stage['evidenceAt'] is None or instant(stage['leaseUntil']) <= instant(stage['evidenceAt'])):
                    raise ValueError()
                if stage['status'] != 'not-recorded' and (stage['evidenceAt'] is None or not stage['evidenceIds']):
                    raise ValueError()
                if stage['status'] in ('skipped', 'blocked', 'failed') and not stage['reasonCode']:
                    raise ValueError()
                for field, sid in [('progress','collection'), ('quality','report'), ('action','paper-action'), ('risk','risk')]:
                    if stage['id'] != sid and stage[field]['availability'] != 'unsupported':
                        raise ValueError()
                if stage['startedAt'] and stage['finishedAt'] and instant(stage['finishedAt']) < instant(stage['startedAt']):
                    raise ValueError()
                progress = stage['progress']['value']
                quality = stage['quality']['value']
                if quality and quality['historyValid']['value'] is not None and (
                    payload['counts']['universe']['value'] is None or quality['historyValid']['value'] > payload['counts']['universe']['value']
                ):
                    raise ValueError()
                if progress and (progress['processed'] > progress['total'] or progress['fetchErrors'] > progress['processed']):
                    raise ValueError()
            candidates = payload['candidates']['value']
            counts = payload['counts']
            if candidates is not None:
                if len({c['symbol'] for c in candidates}) != len(candidates) or counts['universe']['value'] != len(candidates):
                    raise ValueError()
                for field, expected in [('collectorEligible',True), ('collectorExcluded',False)]:
                    if counts[field]['value'] != sum(c['collectorEligible']['value'] is expected for c in candidates):
                        raise ValueError()
                ranks = [c['rank']['value'] for c in candidates if c['rank']['value'] is not None]
                if len(set(ranks)) != len(ranks):
                    raise ValueError()
                for field, flag in [('ranked','signalQualified'), ('selected','selected'), ('watched','watched')]:
                    if counts[field]['availability'] == 'recorded' and (any(c[flag]['availability'] != 'recorded' for c in candidates) or counts[field]['value'] != sum(c[flag]['value'] is True for c in candidates)):
                        raise ValueError()
        return payload
    except (KeyError, TypeError, ValueError, OverflowError, RecursionError):
        raise ValueError('Invalid public operations') from None
