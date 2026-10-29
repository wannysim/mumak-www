"""Explicit service-only sidecar publisher; no retries and no trading effects."""
import argparse
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlencode

from public_operations import instant, validate_operations, meaningful
from publish_paper import request_json


def publish(payload, url, key, expected_revision, *, transport=request_json):
    validate_operations(payload)
    if (not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co',url) or not key
            or type(expected_revision) is not int or not 0 <= expected_revision < 9007199254740991):
        raise ValueError('Invalid publication configuration')
    record_type = payload['recordType']
    revision = transport('POST',url+'/rest/v1/rpc/publish_paper_operations_'+record_type,key,
                         {'snapshot':payload,'expected_revision':expected_revision})
    if type(revision) is not int or revision not in (expected_revision, expected_revision+1) or revision <= 0:
        raise ValueError('Publication uncertain; read existing row before any retry')
    query = {'episode_id':'eq.'+payload['episodeId'],'month':'eq.'+payload['month'],
             'select':'episode_id,month,revision,source_as_of,payload'}
    if record_type == 'session':
        query['session'] = 'eq.'+payload['session']
        query['select'] += ',session'
    table = 'paper_operation_months' if record_type == 'month' else 'paper_operation_sessions'
    rows = transport('GET',url+'/rest/v1/'+table+'?'+urlencode(query),key)
    if not isinstance(rows,list) or len(rows) != 1:
        raise ValueError('Publication readback mismatch')
    row = rows[0]
    actual = validate_operations(row.get('payload'))

    if (meaningful(actual) != meaningful(payload) or row.get('revision') != revision
            or row.get('episode_id') != payload['episodeId'] or row.get('month') != payload['month']
            or instant(row.get('source_as_of')) != instant(payload['sourceAsOf'])
            or (record_type == 'session' and row.get('session') != payload['session'])):
        raise ValueError('Publication readback mismatch')
    return {'status':'verified','recordType':record_type,'episodeId':payload['episodeId'],
            'month':payload['month'],'revision':revision,'sourceAsOf':payload['sourceAsOf']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--payload',required=True)
    parser.add_argument('--expected-revision',required=True,type=int)
    args = parser.parse_args()
    try:
        print(json.dumps(publish(json.loads(Path(args.payload).read_text()),os.environ.get('SUPABASE_URL',''),
                                 os.environ.get('SUPABASE_SERVICE_ROLE_KEY',''),args.expected_revision)))
        return 0
    except (ValueError, KeyError, OSError, TypeError):
        print('Operations publication not verified; inspect exact row before retry. No automatic retry.',file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
