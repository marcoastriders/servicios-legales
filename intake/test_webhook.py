import unittest,os,tempfile,json,time,hmac,hashlib,copy,importlib.util,pathlib
os.environ.update(SMTP_USER='offline@example.test',SMTP_PASS='offline',STRIPE_WEBHOOK_SECRET='whsec_official_literal_test_secret')
import sys
P=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location('backend',P/'server.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(dir=P);m.PAYMENT_DB=self.tmp.name+'/payments.db';self.mail=[];m.send_mail=lambda *a,**kw:self.mail.append((a,kw))
  self.event={'id':'evt_offline1','object':'event','type':'checkout.session.completed','livemode':True,'data':{'object':{'id':'cs_live_offline1','object':'checkout.session','livemode':True,'mode':'payment','status':'complete','payment_status':'paid','currency':'eur','metadata':{'site':'revisioncontratos.es','key':'essential'},'payment_link':m.PAYMENT_LINKS['essential'],'amount_total':12900,'customer_details':{'email':'offline@example.test','name':'Offline'}}}}
 def tearDown(self):self.tmp.cleanup()
 def test_official_signature(self):
  raw=json.dumps(self.event).encode();ts=str(int(time.time()));sig=hmac.new(m.STRIPE_WEBHOOK_SECRET.encode(),ts.encode()+b'.'+raw,hashlib.sha256).hexdigest();header=f't={ts},v1={sig}'
  try:
   import stripe
   stripe.Webhook.construct_event(raw,header,m.STRIPE_WEBHOOK_SECRET)
  except (ModuleNotFoundError, AttributeError):pass
  self.assertTrue(m.stripe_sig_ok(raw,header));self.assertFalse(m.stripe_sig_ok(raw+b' ',header));self.assertFalse(m.stripe_sig_ok(raw,'t=1,v1='+sig));self.assertFalse(m.stripe_sig_ok(raw,'invalid'))
 def test_duplicate_event_and_session(self):
  self.assertEqual(m.accept_payment(self.event),'queued');self.assertEqual(m.accept_payment(self.event),'duplicate');self.event['id']='evt_offline2';self.assertEqual(m.accept_payment(self.event),'duplicate');self.assertTrue(m.deliver_one());self.assertFalse(m.deliver_one());self.assertEqual(len(self.mail),1)
 def test_unpaid_wrong_site_and_mismatch_no_mail(self):
  changes=[('payment_status','unpaid'),('payment_status','no_payment_required'),('status','open'),('livemode',False),('currency','usd'),('amount_total',12901),('payment_link','plink_wrong')]
  for field,value in changes:
   e=copy.deepcopy(self.event);e['data']['object'][field]=value;self.assertEqual(m.accept_payment(e),'ignored')
  for meta in [{'site':'burofaxlegal.es','key':'essential'},{'site':'revisioncontratos.es','key':'wrong'}]:
   e=copy.deepcopy(self.event);e['data']['object']['metadata']=meta;self.assertEqual(m.accept_payment(e),'ignored')
  self.assertFalse(m.deliver_one());self.assertEqual(self.mail,[])
 def test_invalid_schema(self):
  for e in [[],{}, {'id':'evt_x','object':'event','type':'checkout.session.completed','livemode':True,'data':[]}]:
   with self.assertRaises(ValueError):m.accept_payment(e)
 def test_smtp_retry_is_durable(self):
  m.accept_payment(self.event)
  def fail(*a,**kw):raise RuntimeError('offline SMTP failure')
  m.send_mail=fail;self.assertFalse(m.deliver_one())
  with m.payment_db() as db:self.assertEqual(db.execute('SELECT sent,attempts FROM payments').fetchone(),(0,1));db.execute('UPDATE payments SET next_try=0')
  m.send_mail=lambda *a,**kw:self.mail.append(a);self.assertTrue(m.deliver_one());self.assertEqual(len(self.mail),1)
 def test_confirmation_separation(self):
  m.confirm_client('offline@example.test','Test','RevisiónContratos');self.assertNotIn('presupuesto',self.mail[-1][0][1]);self.assertIn('Carla verificará el pago',self.mail[-1][0][1]);m.confirm_client('offline@example.test','Test','BurofaxLegal');self.assertIn('presupuesto cerrado',self.mail[-1][0][1])
if __name__=='__main__':unittest.main(verbosity=2)
