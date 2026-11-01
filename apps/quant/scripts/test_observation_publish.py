import copy
import unittest

from publish_observation import publish
from project_symbol_observation import CANDIDATE_SHA256, project_symbols
from test_observation import produced_fixture, AT, UNTIL

class ObservationPublicationTests(unittest.TestCase):
    def test_exact_readback_and_uncertain_post_never_retry(self):
        p=produced_fixture();calls=[]
        def transport(method,url,key,body=None):
            calls.append(method)
            if method=='POST':return 1
            return [{'episode_id':p['episodeId'],'month':p['month'],'session':p['session'],'revision':1,'source_as_of':p['sourceAsOf'],'payload':p}]
        self.assertEqual(publish(p,'https://synthetic.supabase.co','synthetic-key',0,transport=transport)['status'],'verified')
        self.assertEqual(calls,['POST','GET'])
        calls.clear()
        def uncertain(method,*args):
            calls.append(method)
            raise OSError('synthetic response lost')
        with self.assertRaises(OSError):publish(p,'https://synthetic.supabase.co','synthetic-key',0,transport=uncertain)
        self.assertEqual(calls,['POST'])
        def wrong(method,*args):
            if method=='POST':return 1
            return []
        with self.assertRaises(ValueError):publish(p,'https://synthetic.supabase.co','synthetic-key',0,transport=wrong)

    def test_native_shape_projection_carries_saved_action_not_new_strategy_execution(self):
        st={'symbol':'TEST','qty':10,'entry_modeled_vwap':'100','high_water_nominal':'110','sigma_entry':'0.02','symbol_data_hold':False,'corporate_basis_hold':False,'same_session_buy_block':None}
        saved={'candidateSourceSha256':CANDIDATE_SHA256,'context':{'now_utc':AT,'session_ny':'2026-09-18','positions':{'TEST':{'qty':10}},'cash_decimal':'9000','prices':{'TEST':'106'}},'plan':{'config':{'strategy_id':'C','k':'3','gamma':'0.003'},'sells':[{'symbol':'TEST','sell_qty':3,'target_qty':7,'reason':'symbol_trim'}],'state_updates':{'TEST':st},'symbol_holds':{}}}
        row=project_symbols(saved,valid_until=UNTIL,evidence_id='risk')[0]
        self.assertEqual((row['state'],row['targetQuantity'],row['stopThreshold']),('trim',7,'103.40'))
        unknown=copy.deepcopy(saved);unknown['plan']['symbol_holds']['TEST']='UNKNOWN_STATE'
        self.assertEqual(project_symbols(unknown,valid_until=UNTIL,evidence_id='risk')[0]['inputConfidence'],'unknown')
        bad=copy.deepcopy(saved);bad['candidateSourceSha256']='0'*64
        with self.assertRaises(ValueError):project_symbols(bad,valid_until=UNTIL,evidence_id='risk')
