"""Publish only reconciled paper projections; service credentials stay on host.

Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python publish_paper.py
       --ledger ... --policy ... --episode-id ...
No broker endpoint, live table, credential refresh, or trading capability exists.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
from export_paper import export_snapshot, ExportError
from public_snapshot import is_public_snapshot

class PublishError(ValueError):
    """Publication failed; details intentionally exclude credentials and URLs."""

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise PublishError('Redirect refused')


PUBLIC_FILL_REASONS = {
    '정기 리밸런싱',
    '위험 한도에 따른 매도',
    '집중도 한도 조정',
}


def is_publishable_snapshot(snapshot):
    if not isinstance(snapshot, dict) or not isinstance(snapshot.get('fills'), list):
        return False
    legacy_snapshot = dict(snapshot)
    legacy_snapshot['fills'] = []
    for fill in snapshot['fills']:
        if not isinstance(fill, dict):
            return False
        reason = fill.get('reason')
        if ('reason' in fill and reason is not None
                and (not isinstance(reason, str) or reason not in PUBLIC_FILL_REASONS)):
            return False
        legacy_fill = dict(fill)
        legacy_fill.pop('reason', None)
        legacy_snapshot['fills'].append(legacy_fill)
    return is_public_snapshot(legacy_snapshot)


def request_json(method, url, key, payload=None):
    body = json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None
    request = Request(url, data=body, method=method, headers={
        'apikey': key, 'Authorization': 'Bearer '+key, 'Content-Type': 'application/json',
        'Cache-Control': 'no-store'})
    try:
        with build_opener(NoRedirect()).open(request, timeout=20) as response:
            return json.loads(response.read(4_000_000))
    except HTTPError as exc:
        raise PublishError(f'HTTP {exc.code}; no automatic retry') from None
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise PublishError('Transport or response failure; no automatic retry') from None


def publish(snapshot, url, key, transport=request_json):
    if (not is_publishable_snapshot(snapshot)
            or snapshot.get('schemaVersion') != 1 or snapshot.get('mode') != 'paper'
            or snapshot.get('source') != 'forward-paper-ledger'):
        raise PublishError('Only versioned paper snapshots can be published')
    if not re.fullmatch(r'https://[a-z0-9-]+\.supabase\.co', url) or not key:
        raise PublishError('Expected Supabase HTTPS project URL and host-side key')
    accepted = transport('POST', url+'/rest/v1/rpc/publish_paper_snapshot', key, {'snapshot': snapshot})
    if accepted is not True:
        raise PublishError('Snapshot not accepted (stale or conflicting revision)')
    query = urlencode({'episode_id': 'eq.'+snapshot['episodeId'], 'month': 'eq.'+snapshot['month'],
                       'select': 'episode_id,month,as_of,payload'})
    rows = transport('GET', url+'/rest/v1/paper_snapshots?'+query, key)
    if (not isinstance(rows, list) or len(rows) != 1 or rows[0].get('payload') != snapshot
            or rows[0].get('episode_id') != snapshot['episodeId']
            or rows[0].get('month') != snapshot['month']):
        raise PublishError('Published row readback mismatch')
    return 'verified'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ledger', required=True)
    parser.add_argument('--policy', required=True)
    parser.add_argument('--episode-id', required=True)
    args = parser.parse_args()
    try:
        snapshot = export_snapshot(args.ledger, args.policy, episode_id=args.episode_id)
        status = publish(snapshot, os.environ.get('SUPABASE_URL', ''),
                         os.environ.get('SUPABASE_SERVICE_ROLE_KEY', ''))
        print(json.dumps({'status': status, 'mode': 'paper', 'month': snapshot['month'],
                          'asOf': snapshot['asOf']}))
    except (PublishError, ExportError) as exc:
        print(json.dumps({'status': 'error', 'reason': str(exc)}), file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
