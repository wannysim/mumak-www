"""Explicit server-only observation publication with exact readback and no retry."""
import argparse
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlencode

from public_observation import validate_observation
from public_operations import instant, meaningful
from publish_paper import request_json


def publish(payload,url,key,expected_revision,*,transport=request_json):
    validate_observation(payload)
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co',url) or not key or type(expected_revision) is not int or not 0<=expected_revision<9007199254740991:
        raise ValueError('Invalid publication configuration')
    revision=transport('POST',url+'/rest/v1/rpc/publish_paper_observation',key,{'snapshot':payload,'expected_revision':expected_revision})
    if type(revision) is not int or revision<=0 or revision not in (expected_revision,expected_revision+1):
        raise ValueError('Publication uncertain; read exact row before retry')
    query={'episode_id':'eq.'+payload['episodeId'],'month':'eq.'+payload['month'],'session':'eq.'+payload['session'],'select':'episode_id,month,session,revision,source_as_of,payload'}
    rows=transport('GET',url+'/rest/v1/paper_observations?'+urlencode(query),key)
    if not isinstance(rows,list) or len(rows)!=1:
        raise ValueError('Publication readback mismatch')
    row=rows[0]
    if (row.get('episode_id')!=payload['episodeId'] or row.get('month')!=payload['month'] or row.get('session')!=payload['session'] or row.get('revision')!=revision or instant(row.get('source_as_of'))!=instant(payload['sourceAsOf']) or meaningful(validate_observation(row.get('payload')))!=meaningful(payload)):
        raise ValueError('Publication readback mismatch')
    return {'status':'verified','episodeId':payload['episodeId'],'month':payload['month'],'session':payload['session'],'revision':revision,'sourceAsOf':payload['sourceAsOf']}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--payload',required=True)
    p.add_argument('--expected-revision',type=int,required=True)
    args=p.parse_args()
    try:
        print(json.dumps(publish(json.loads(Path(args.payload).read_text()),os.environ.get('SUPABASE_URL',''),os.environ.get('SUPABASE_SERVICE_ROLE_KEY',''),args.expected_revision)))
        return 0
    except (ValueError,KeyError,TypeError,OSError):
        print('Observation publication not verified; read exact row before any retry.',file=sys.stderr)
        return 1

if __name__=='__main__':
    raise SystemExit(main())
