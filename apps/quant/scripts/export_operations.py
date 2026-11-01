"""Read-only saved-artifact adapter. Dry-run JSON by default; never opens a ledger.

Binding is a host-only explicit root/episode/month/registration receipt, not public output.
No runtime module, broker, scheduler, strategy execution or retrospective ranking.
"""
import argparse
import copy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

from public_operations import validate_operations, instant


def absent(availability='unsupported'):
    return {'availability': availability, 'value': None, 'evidenceIds': []}


def fact(value, evidence):
    return {'availability': 'recorded', 'value': value, 'evidenceIds': [evidence]}


REASONS = dict(zip([
    'unverified_identity', 'unknown_classification', 'unknown_sector', 'unknown_underlying_lookthrough',
    'history_not_200_consecutive_completed_sessions', 'price_below_5', 'mean_20d_dollar_volume_below_20m', 'source_ineligible'], [
    'unverified-identity', 'unknown-classification', 'unknown-sector', 'unknown-lookthrough',
    'history-gap', 'price-threshold', 'liquidity-threshold', 'source-ineligible']))


def reason_code(value):
    if not isinstance(value, str):
        raise ValueError('Invalid source artifact')
    return 'fetch-failed' if value.startswith('history_fetch_or_parse_failed:') else REASONS.get(value, 'other-not-public')


def policy_rules(spec):
    """Source-backed registered v2 formula constants; declared policy inputs must agree."""
    e, s, p, r, c = (spec[k] for k in ['eligibility','signal','portfolio','risk','cost_assumptions'])
    if spec['version'] != 'broad-us-paper-v2' or p['rebalance'] != 'initial_and_monday':
        raise ValueError('Unregistered strategy')
    return {
        'universeType':'dated-spy-proxy-plus-selected-etfs',
        'nominalUniverseEquities':spec['universe_equity_count'], 'nominalUniverseEtfs':spec['universe_etf_count'],
        'minPriceUsd':e['minimum_price_usd'], 'minMeanDollarVolumeUsd':e['minimum_mean_daily_dollar_volume_20_sessions_usd'],
        'liquidityWindow':20, 'historyWindow':e['minimum_history_sessions'],
        'minUniverseCoverage':str(e['minimum_universe_data_coverage']), 'requiredHoldingsCoverage':str(e['holdings_data_coverage_required']).removesuffix('.0'),
        'returnWindows':s['return_lookbacks'], 'smaWindow':s['sma_sessions'], 'volatilityWindow':s['volatility_sessions'],
        'volatilityDof':1, 'priceBasis':'adjusted-close-signal_nominal-close-liquidity', 'positiveScoreRequired':s['positive_score_required'],
        'maxPositions':p['maximum_positions'], 'stockCap':str(p['single_stock_max_weight']), 'etfCap':str(p['single_etf_max_weight']),
        'sectorCap':str(p['sector_lookthrough_max_weight']), 'underlyingCompanyCap':'0.1', 'minCash':str(p['minimum_cash_weight']),
        'inverseVolBudget':'0.8', 'budgetDivisor':'1.002', 'sizingNavFactor':'0.997', 'wholeSharesOnly':p['whole_shares_only'],
        'dailyLossStop':str(r['daily_buy_stop_loss']), 'monthlyLossStop':str(r['monthly_persistent_buy_stop_loss']),
        'commissionBps':str(c['commission_bps_per_side']), 'slippageBps':str(c['slippage_bps_per_side']),
        'selectionCadence':'daily-preopen', 'entryCadence':'initial-and-monday', 'recoveryCadence':'none',
        'entryWindowOpenMinutes':15, 'entryWindowCloseMinutes':75, 'quoteSlotMinutes':spec['data_architecture']['quote_poll_minutes']}


def export_operations(binding, *, session=None, now=None):
    now = now or datetime.now(timezone.utc).isoformat()
    instant(now)
    if binding.get('authority') not in ('policy-declaration', 'preserved-policy'):
        raise ValueError('Unsupported policy authority')
    root = Path(binding['sourceRoot']).resolve(strict=True)
    reads = {}
    presence = {}
    def load(path):
        resolved = path.resolve(strict=True)
        if not resolved.is_relative_to(root) or resolved.stat().st_size > 64 * 1024 * 1024:
            raise ValueError('Invalid source binding')
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).digest()
        if path in reads and reads[path] != (resolved, digest):
            raise ValueError('Source changed during read')
        reads[path] = (resolved, digest)
        return json.loads(raw)
    def optional(path):
        presence[path] = path.exists()
        return load(path) if presence[path] else None
    evidence = []
    def add_evidence(identifier, kind, stamp):
        if stamp is not None and instant(stamp) > instant(now):
            raise ValueError('Source clock is in future')
        evidence.append({'id':identifier, 'kind':kind, 'evidenceAt':stamp, 'observedAt':now})
    policy = load(root / 'policy.json')
    spec = load(root / 'universe-policy-v2.json')
    start, end = policy['period']['start_us_session'], policy['period']['end_us_session']
    if (policy.get('mode') != 'forward_paper' or policy.get('live') is not False or spec.get('live') is not False
            or start != spec['paper_start_session'] or end != spec['paper_end_session']
            or start[:7] != binding['month'] or end[:7] != binding['month'] or (session and not start <= session <= end)):
        raise ValueError('PAPER episode or period mismatch')
    result = {'contract':'paper-operations/v1','mode':'paper','episodeId':binding['episodeId'], 'month':binding['month'], 'sourceAsOf':None, 'exportedAt':now, 'evidence':evidence}
    if session is None:
        add_evidence('policy-registration','policy-registration',binding['registeredAt'])
        add_evidence('policy','preserved-policy' if binding['authority'] == 'preserved-policy' else 'policy-declaration',None)
        strategy = {'version':spec['version'],'labelCode':'broad-us-low-frequency-trend','authority':binding['authority'], 'sessionFrom':start,'sessionThrough':end,'effectiveFrom':absent(),'effectiveTo':absent(),'activationObservedAt':absent(),'variant':'base','ruleSet':'broad-us-v2','rules':policy_rules(spec),'evidenceIds':['policy','policy-registration']}
        strategies = [strategy]
        if binding.get('releaseFile'):
            release = load(root / binding['releaseFile'])
            if release.get('mode') != 'forward_paper' or release.get('live') is not False or release.get('variant') != 'C1' or release.get('historical_migration') is not False:
                raise ValueError('Invalid release configuration')
            add_evidence('release','release-config',binding['releaseRegisteredAt'])
            c1 = copy.deepcopy(strategy)
            c1.update(version=release['release_id'],variant='C1',effectiveFrom=fact(release['effective_at'],'release'),evidenceIds=['policy','release'])
            c1['rules']['recoveryCadence'] = 'post-effective-stop-frozen-basket-next-session'
            strategies.append(c1)
        result.update(recordType='month', strategies=fact(strategies,'policy-registration'), improvement=absent())
    else:
        snapshot_path = root / 'data/snapshots' / f'{session}.json'
        snapshot = optional(snapshot_path)
        progress_path = root / 'data' / f'progress-{session}.json'
        progress = optional(progress_path)
        reports_dir = root / 'operations/reports'
        report_paths = sorted(reports_dir.glob('daily-*.json')) if reports_dir.exists() else []
        reports = []
        for path in report_paths:
            document = load(path)
            report = document.get('report', {})
            if report.get('session') == session:
                if report.get('mode') != 'forward_paper' or report.get('live') is not False or report.get('schema_version') != 1:
                    raise ValueError('Invalid report binding')
                reports.append(report)
        report = max(reports,key=lambda item:instant(item['asof'])) if reports else None
        if report and any(instant(r['asof']) == instant(report['asof']) and r != report for r in reports):
            raise ValueError('Conflicting report receipts')
        if snapshot:
            if snapshot.get('schema_version') != 1 or snapshot.get('session') != session:
                raise ValueError('Invalid snapshot binding')
            add_evidence('snapshot','candidate-snapshot',snapshot['collected_at'])
        if progress:
            if progress.get('session') != session:
                raise ValueError('Invalid progress binding')
            if instant(progress['started_at']) > instant(progress['updated_at']):
                raise ValueError('Invalid progress interval')
            if snapshot and (progress['universe_count'] != snapshot['universe_count'] or
                             (progress.get('phase') == 'completed' and progress.get('eligible_so_far') != sum(a['eligible'] is True for a in snapshot['assets'].values()))):
                raise ValueError('Progress snapshot mismatch')
            add_evidence('progress','collector-progress',progress['updated_at'])
        if report:
            add_evidence('report','daily-quality-report',report['asof'])
        if not evidence:
            raise ValueError('No recorded session artifacts')
        candidates = []
        if snapshot:
            for symbol, asset in sorted(snapshot['assets'].items()):
                if asset['symbol'] != symbol or type(asset['eligible']) is not bool:
                    raise ValueError('Invalid candidate identity')
                reasons = sorted(set(reason_code(r) for r in asset['exclusion_reasons']))
                if asset['eligible'] and reasons:
                    raise ValueError('Invalid collector classification')
                candidates.append({'symbol':symbol,'kind':asset['kind'],'collectorEligible':fact(asset['eligible'],'snapshot'),'reasonCodes':fact(reasons,'snapshot'), **{k:absent() for k in ['signalQualified','score','volatility','rank','selected','targetWeight','watched']}})
            if snapshot['universe_count'] != len(candidates):
                raise ValueError('Universe count mismatch')
        eligible = sum(c['collectorEligible']['value'] for c in candidates)
        quality = report.get('quality',{}) if report else {}
        if snapshot and report and (quality.get('universe_count') != len(candidates) or quality.get('eligible_count') != eligible or quality.get('snapshot_collected_at') != snapshot['collected_at'] or quality.get('history_200_valid_count') != snapshot['history_ok_count'] or quality.get('history_coverage') != snapshot['coverage']):
            raise ValueError('Report snapshot binding mismatch')
        stages = []
        for sid in ['collection','screening','decision','risk','paper-action','report','publication']:
            stage = {'id':sid,'status':'not-recorded', **{k:None for k in ['evidenceAt','startedAt','finishedAt','leaseUntil','nextExpectedAt','expectedBy','reasonCode']},'evidenceIds':[], **{k:absent() for k in ['progress','quality','action','risk']}}
            verified = {'collection':quality.get('collector_process_success'),'screening':quality.get('history_gate_pass'),'decision':quality.get('decision_verified'),'report':True if report else None}.get(sid)
            if verified is True:
                stage.update(status='succeeded',evidenceAt=report['asof'],evidenceIds=['report'])
            elif sid == 'collection' and verified is False:
                stage.update(status='failed',evidenceAt=report['asof'],reasonCode='verification-failed',evidenceIds=['report'])
            if sid == 'collection' and progress:
                stage.update(startedAt=progress['started_at'])
                stage['progress'] = fact({'processed':progress['processed_count'],'total':progress['universe_count'],'fetchErrors':progress['fetch_error_count']},'progress')
            if sid == 'report' and report:
                values = {}
                for key, source, field in [('historyValid',quality,'history_200_valid_count'),('historyCoverage',quality,'history_coverage'),('historyGatePass',quality,'history_gate_pass'),('decisionVerified',quality,'decision_verified'),('closeVerified',quality,'close_verified'),('ledgerReconciled',report,'ledger_reconciled'),('policyIntegrity',report,'policy_integrity')]:
                    value = source.get(field)
                    values[key] = absent('not-recorded') if value is None else fact(str(value) if key == 'historyCoverage' else value,'report')
                stage['quality'] = fact(values,'report')
            stages.append(stage)
        result.update(recordType='session',session=session,strategyVersion=absent('not-recorded'),ledgerAsOf=fact(report['last_observation'],'report') if report and report.get('last_observation') else absent(),counts={**{k:absent() for k in ['ranked','selected','watched']},**{k:fact(v,'snapshot') if snapshot else absent('not-recorded') for k,v in [('universe',len(candidates)),('collectorEligible',eligible),('collectorExcluded',len(candidates)-eligible)]}},stages=stages,candidates=fact(candidates,'snapshot') if snapshot else absent('not-recorded'))
        if report_paths != (sorted(reports_dir.glob('daily-*.json')) if reports_dir.exists() else []):
            raise ValueError('Source set changed during read')
    result['sourceAsOf'] = max((item['evidenceAt'] for item in evidence if item['evidenceAt']),key=instant)
    for path, exists in presence.items():
        if path.exists() != exists:
            raise ValueError('Source set changed during read')
    for path, (resolved, digest) in reads.items():
        if path.resolve(strict=True) != resolved or hashlib.sha256(path.read_bytes()).digest() != digest:
            raise ValueError('Source changed during read')
    return validate_operations(result)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binding', required=True)
    parser.add_argument('--session')
    args = parser.parse_args()
    try:
        result = export_operations(json.loads(Path(args.binding).read_text()),session=args.session)
        print(json.dumps(result,ensure_ascii=False))
        return 0
    except (ValueError, KeyError, OSError, TypeError):
        print('Operations export rejected; verify binding and saved artifacts.',file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
