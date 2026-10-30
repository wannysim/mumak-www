"""Dry-run saved RO receipt projection. Never reads a ledger, executes strategy, or connects to a service."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

from public_observation import KINDS, validate_observation
from public_operations import instant
from project_symbol_observation import project_symbols


def export_observation(binding, *, now=None):
    now = now or datetime.now(timezone.utc).isoformat()
    instant(now)
    # A trusted source-native operator must create and pin this saved receipt.
    # Pinning proves input identity, NOT independent authenticity or activation.
    if set(binding) != {'sourceRoot','receiptFile','receiptSha256','episodeId','month','origin'}:
        raise ValueError('Invalid source binding')
    root = Path(binding['sourceRoot']).resolve(strict=True)
    relative = Path(binding['receiptFile'])
    if relative.is_absolute() or '..' in relative.parts:
        raise ValueError('Invalid source binding')
    path = (root / relative).resolve(strict=True)
    if not path.is_relative_to(root) or path.stat().st_size > 2 * 1024 * 1024:
        raise ValueError('Invalid source binding')
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != binding['receiptSha256']:
        raise ValueError('Source pin mismatch')
    source = json.loads(raw)
    keys = {'schema_version','mode','live','origin','episode_id','month','session','source_asof','effective_from','effective_through','evidence',*KINDS}
    if set(source) not in (keys, keys | {'symbol_plan'}) or source['schema_version'] != 1 or source['mode'] != 'forward_paper' or source['live'] is not False:
        raise ValueError('Invalid source receipt')
    if (source['episode_id'],source['month'],source['origin']) != (binding['episodeId'],binding['month'],binding['origin']):
        raise ValueError('Source scope mismatch')
    evidence = []
    for e in source['evidence']:
        if set(e) != {'id','kind','at'}:
            raise ValueError('Invalid source evidence')
        evidence.append({'id':e['id'],'kind':e['kind'],'evidenceAt':e['at'],'observedAt':now})
    p = {'contract':'paper-observability/v1','mode':'paper','origin':source['origin'],
         'episodeId':source['episode_id'],'month':source['month'],'session':source['session'],
         'sourceAsOf':source['source_asof'],'effectiveFrom':source['effective_from'],
         'effectiveThrough':source['effective_through'],'exportedAt':now,'evidence':evidence,
         **{k:source[k] for k in KINDS}}
    if 'symbol_plan' in source:
        if source['symbols']['value'] is not None:
            raise ValueError('Ambiguous symbol sources')
        saved=source['symbol_plan']
        p['symbols']={'availability':'recorded','value':project_symbols(saved,valid_until=saved['validUntil'],evidence_id=saved['evidenceId']),'evidenceIds':[saved['evidenceId']]}
    validate_observation(p)
    if (root / relative).resolve(strict=True) != path or path.read_bytes() != raw:
        raise ValueError('Source changed during read')
    return p


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binding',required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(export_observation(json.loads(Path(args.binding).read_text())),ensure_ascii=False))
        return 0
    except (ValueError,KeyError,TypeError,OSError):
        print('Observation export rejected; verify saved RO receipt and binding.',file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
