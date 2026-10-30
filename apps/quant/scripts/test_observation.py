"""Explicit synthetic saved RO receipt -> producer -> SQL inputs, never production results."""
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from export_observation import export_observation
from public_observation import validate_observation

AT='2026-09-18T14:00:00+00:00'
NOW='2026-09-18T14:01:00+00:00'
UNTIL='2026-09-18T14:15:00+00:00'

def fact(value, eid):
    return {'availability':'recorded','value':value,'evidenceIds':[eid]}

def absent():
    return {'availability':'unsupported','value':None,'evidenceIds':[]}

def native_fixture():
    stamp={'assessedAt':AT,'validUntil':UNTIL}
    evidence=[{'id':f,'kind':k,'at':AT} for f,k in [('ingest','ingest-readback'),('schedule','schedule-receipt'),('collection','collector-receipt'),('publication','publication-receipt'),('decision','decision-record'),('risk','risk-record')]]
    common={**stamp,'inputConfidence':'validated','entryPrice':'100','sigmaEntry':'0.02','highWater':'110','mark':'106','stopThreshold':'103.4','exposureProxy':'0.004','gamma':'0.003','quantity':10,'targetQuantity':7,'reentry':'same-session-blocked','evidenceIds':['risk']}
    return {'schema_version':1,'mode':'forward_paper','live':False,'origin':'synthetic','episode_id':'synthetic-paper','month':'2026-09','session':'2026-09-18','source_asof':AT,
        'effective_from':'2026-09-18T13:30:00+00:00','effective_through':'2026-09-18T20:00:00+00:00','evidence':evidence,
        'ingest':fact({'snapshotAsOf':'2026-09-18T13:59:00+00:00','readbackAt':AT,'status':'verified'},'ingest'),
        'schedule':fact({'opensAt':'2026-09-18T13:30:00+00:00','closesAt':'2026-09-18T20:00:00+00:00','nextExpectedAt':UNTIL,'expectedBy':'2026-09-18T14:20:00+00:00'},'schedule'),
        'collection':fact({**stamp,'status':'succeeded','reason':'receipt-confirmed'},'collection'),
        'publication':fact({**stamp,'status':'failed','reason':'execution-failed'},'publication'),
        'decision':fact({'at':AT,'strategyVersion':'synthetic-C-k3','action':'sell','reason':'symbol-trim'},'decision'),
        'account':fact({**stamp,'state':'clear','reason':'none','dailyReturn':'-0.002','monthlyReturn':'0.02','dailyStop':'0.01','monthlyStop':'0.30'},'risk'),
        'symbols':fact([{**common,'symbol':'TESTA','state':'trim','reason':'symbol-trim'},
                        {**common,'symbol':'TESTB','state':'monitor','reason':'none','targetQuantity':10,'reentry':'regular-entry-only','mark':'108','exposureProxy':'0.002'},
                        {**common,'symbol':'TESTC','state':'unknown','reason':'unknown','inputConfidence':'unknown','targetQuantity':None,'reentry':'hold-blocked',**{k:None for k in ('entryPrice','sigmaEntry','highWater','mark','stopThreshold','exposureProxy','gamma')}}], 'risk')}

def produced_fixture():
    with tempfile.TemporaryDirectory() as d:
        root=Path(d)
        raw=json.dumps(native_fixture()).encode()
        (root/'receipt.json').write_bytes(raw)
        binding={'sourceRoot':str(root),'receiptFile':'receipt.json','receiptSha256':hashlib.sha256(raw).hexdigest(),'episodeId':'synthetic-paper','month':'2026-09','origin':'synthetic'}
        return export_observation(binding,now=NOW)

def invalid_cases():
    return [
        ('private-field',[(['account','value','secret'],'PRIVATE')]),
        ('live',[(['mode'],'live')]),
        ('wrong-month',[(['month'],'2026-10')]),
        ('wrong-ny-session',[(['session'],'2026-09-19')]),
        ('orphan',[(['symbols','evidenceIds'],['missing'])]),
        ('wrong-kind',[(['account','evidenceIds'],['collection'])]),
        ('future-observation',[(['evidence',0,'observedAt'],'2026-09-19T14:00:00+00:00')]),
        ('source-clock',[(['sourceAsOf'],'2026-09-18T13:59:00+00:00')]),
        ('inverted-scope',[(['effectiveThrough'],'2026-09-18T13:00:00+00:00')]),
        ('expired-lease',[(['account','value','validUntil'],AT)]),
        ('clear-with-breach',[(['account','value','dailyReturn'],'-0.01')]),
        ('unknown-clear',[(['account','value','dailyReturn'],None)]),
        ('changed-limit',[(['account','value','dailyStop'],'0.01000000000000000001')]),
        ('stop-without-reason',[(['account','value','state'],'stopped')]),
        ('unknown-with-clear-reason',[(['account','value','state'],'unknown')]),
        ('invalid-price',[(['symbols','value',0,'mark'],'NaN')]),
        ('missing-input',[(['symbols','value',0,'mark'],None)]),
        ('unknown-active',[(['symbols','value',0,'inputConfidence'],'unknown')]),
        ('negative-price',[(['symbols','value',0,'mark'],'-1')]),
        ('no-trim',[(['symbols','value',0,'targetQuantity'],10)]),
        ('exit-not-zero',[(['symbols','value',0,'state'],'full-exit')]),
        ('increase-target',[(['symbols','value',0,'targetQuantity'],11)]),
        ('wrong-assessment',[(['symbols','value',0,'assessedAt'],'2026-09-18T14:00:01+00:00')]),
        ('duplicate-symbol',[(['symbols','value',1,'symbol'],'TESTA')]),
        ('reversed-schedule',[(['schedule','value','closesAt'],'2026-09-18T13:00:00+00:00')]),
        ('future-financial-source',[(['ingest','value','snapshotAsOf'],'2026-09-19T13:00:00+00:00')]),
        ('raw-reason',[(['decision','value','reason'],'/private/runtime')]),
    ]

def changed(p, changes):
    value=copy.deepcopy(p)
    for path,new in changes:
        obj=value
        for key in path[:-1]: obj=obj[key]
        obj[path[-1]]=new
    return value

class ObservationTests(unittest.TestCase):
    def test_producer_and_allowlist(self):
        p=produced_fixture()
        self.assertEqual(p['origin'],'synthetic')
        self.assertEqual(p['account']['value']['state'],'clear')
        self.assertEqual(p['publication']['value']['status'],'failed')
        self.assertNotIn('sourceRoot',json.dumps(p))
        self.assertEqual(validate_observation(p),p)

    def test_invalid_corpus(self):
        for name, changes in invalid_cases():
            with self.subTest(name=name),self.assertRaises(ValueError):
                validate_observation(changed(produced_fixture(),changes))

    def test_partial_sources_are_not_success(self):
        p=produced_fixture()
        p['account']=absent();p['symbols']=absent();p['schedule']=absent()
        self.assertIsNone(validate_observation(p)['account']['value'])
        self.assertEqual(p['collection']['value']['status'],'succeeded')

    def test_saved_source_pin_scope_and_private_fields(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);raw=json.dumps(native_fixture()).encode();(root/'receipt.json').write_bytes(raw)
            b={'sourceRoot':d,'receiptFile':'receipt.json','receiptSha256':hashlib.sha256(raw).hexdigest(),'episodeId':'synthetic-paper','month':'2026-09','origin':'synthetic'}
            for field,value in [('receiptSha256','0'*64),('month','2026-10'),('origin','paper-runtime'),('receiptFile','../receipt.json')]:
                with self.subTest(field=field),self.assertRaises((ValueError,OSError)):
                    export_observation({**b,field:value},now=NOW)
            native=native_fixture();native['private_path']='/private/source';raw=json.dumps(native).encode();(root/'receipt.json').write_bytes(raw)
            with self.assertRaises(ValueError):
                export_observation({**b,'receiptSha256':hashlib.sha256(raw).hexdigest()},now=NOW)

    def test_real_additive_sql(self):
        app=Path(__file__).parent.parent
        result=subprocess.run(['node','scripts/verify-observation-db.mjs'],input=json.dumps({'payload':produced_fixture(),'invalid':invalid_cases()}),text=True,cwd=app,capture_output=True,timeout=90,env=os.environ.copy())
        self.assertEqual(result.returncode,0,result.stderr or result.stdout)
        self.assertIn('observation SQL PASS',result.stdout)

if __name__=='__main__':
    import sys
    if sys.argv[1:]==['--synthetic-preview']:
        print(json.dumps({'payload':produced_fixture(),'invalid':invalid_cases()}))
    else:
        unittest.main()
