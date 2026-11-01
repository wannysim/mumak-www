"""Display-only projection of a saved candidate537 risk plan; never generates orders or fills.

The caller must supply a complete, pinned, source-native RO receipt. This function
is not an authenticity verifier or a replacement for candidate state validation.
"""
from decimal import Decimal

CANDIDATE_SHA256='47caa87eeaa43059af094b18af814d14ed0948c82024de36fb648bc660fc84e4'


def project_symbols(saved, *, valid_until, evidence_id):
    if saved.get('candidateSourceSha256') != CANDIDATE_SHA256:
        raise ValueError('Unreviewed symbol source')
    context,plan=saved['context'],saved['plan']
    config=plan['config']
    if config['strategy_id'] not in ('B','C'):
        raise ValueError('Unsupported symbol candidate')
    positions=context['positions']
    sells={s['symbol']:s for s in plan['sells']}
    if len(sells)!=len(plan['sells']) or not set(sells)<=set(positions):
        raise ValueError('Invalid saved plan')
    rows=[]
    for symbol,p in sorted(positions.items()):
        state=plan['state_updates'].get(symbol)
        hold=plan['symbol_holds'].get(symbol)
        base={'symbol':symbol,'assessedAt':context['now_utc'],'validUntil':valid_until,'quantity':p['qty'],
              'evidenceIds':[evidence_id],'state':'unknown','reason':'unknown','inputConfidence':'unknown',
              'targetQuantity':None,'reentry':'hold-blocked',**{k:None for k in ('entryPrice','sigmaEntry','highWater','mark','stopThreshold','exposureProxy','gamma')}}
        if hold or not state:
            if hold:
                base.update(state='hold',reason='corporate-hold' if hold=='CORPORATE_BASIS_HOLD' else 'data-hold' if hold=='DATA_HOLD' else 'unknown')
            rows.append(base)
            continue
        def positive(value):
            if not isinstance(value,str): raise ValueError('Invalid saved decimal')
            n=Decimal(value)
            if not n.is_finite() or n<=0: raise ValueError('Invalid saved decimal')
            return n
        entry=positive(state['entry_modeled_vwap']);high=positive(state['high_water_nominal']);sigma=positive(state['sigma_entry']);mark=positive(context['prices'][symbol])
        if state['symbol']!=symbol or state['qty']!=p['qty'] or state['symbol_data_hold'] or state['corporate_basis_hold']:
            raise ValueError('Saved position mismatch')
        distance=min(Decimal('.10'),max(Decimal('.03'),positive(config['k'])*sigma))
        threshold=max(entry,high)*(1-distance)
        action=sells.get(symbol)
        reason='none';status='monitor';target=p['qty']
        if action:
            if action['reason'] not in ('symbol_stop','symbol_trim') or action['sell_qty']<=0 or action['target_qty']<0 or action['sell_qty']+action['target_qty']!=p['qty']:
                raise ValueError('Invalid saved action')
            target=action['target_qty'];reason=action['reason'].replace('_','-');status='full-exit' if target==0 else 'trim'
        cash=Decimal(context['cash_decimal'])
        if not cash.is_finite() or cash<0: raise ValueError('Invalid saved cash')
        nav=cash+sum(Decimal(x['qty'])*positive(context['prices'][s]) for s,x in positions.items())
        if nav<=0: raise ValueError('Invalid saved NAV')
        gamma=positive(config['gamma']) if config['strategy_id']=='C' else None
        # The public decimal contract rejects exponent notation; preserve Decimal precision.
        base.update(state=status,reason=reason,inputConfidence='validated',entryPrice=format(entry,'f'),sigmaEntry=format(sigma,'f'),highWater=format(high,'f'),mark=format(mark,'f'),stopThreshold=format(threshold,'f'),
                    exposureProxy=format(Decimal(p['qty'])*mark/nav*sigma,'f') if gamma else None,gamma=format(gamma,'f') if gamma else None,targetQuantity=target,
                    reentry='same-session-blocked' if action or state['same_session_buy_block']==context['session_ny'] else 'regular-entry-only')
        rows.append(base)
    return rows
