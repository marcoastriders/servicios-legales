"""Fixed VAT checkout regressions: local HTTP, mocked Stripe and SMTP only."""
from typing import Any
from email.message import Message
import io
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import parse_qs
from unittest.mock import patch

os.environ.setdefault('SMTP_USER', 'test@example.invalid')
os.environ.setdefault('SMTP_PASS', 'unused')
spec = importlib.util.spec_from_file_location('fixed_app', Path(__file__).resolve().parents[1] / 'intake/server.py')
assert spec is not None and spec.loader is not None
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

class FixedCheckout(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = app.ThreadingHTTPServer(('127.0.0.1', 0), app.H)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join()
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = patch.object(app, 'PAYMENT_DB', self.tmp.name + '/payments.db'); self.db.start(); self.addCleanup(self.db.stop)
        self.env = patch.dict(os.environ, STRIPE_SECRET_KEY='sk_test_mock'); self.env.start(); self.addCleanup(self.env.stop)
        self.smtp = patch.object(app.smtplib, 'SMTP'); self.mail = self.smtp.start().return_value.__enter__.return_value; self.addCleanup(self.smtp.stop)
        self.stripe = patch('urllib.request.urlopen'); self.api = self.stripe.start(); self.addCleanup(self.stripe.stop)
        app.RATE.clear()
        app.CHECKOUT_RATE.clear()
    def request(self, data=None, path='/checkout', origin='https://revisioncontratos.es'):
        req = Request(f'http://127.0.0.1:{self.server.server_port}{path}', data=None if data is None else json.dumps(data).encode(), headers={'Origin':origin,'Content-Type':'application/json'})
        try: response = urlopen(req)
        except HTTPError as e: response = e
        with response:
            self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), origin if origin in app.ALLOWED_ORIGINS else None)
            return response.status, json.load(response)
    def mock_session(self, key='essential'):
        amount = app.PRICES[key]
        sid = 'cs_live_Mocked' + str(getattr(self, 'counter', 0))
        self.counter = getattr(self, 'counter', 0) + 1
        self.session: dict[str, Any] = dict(id=sid, url='https://checkout.stripe.com/c/pay/' + sid, amount_total=amount,currency='eur',total_details={'amount_tax':(amount*21+60)//121})
        self.api.return_value.__enter__.return_value.read.return_value = json.dumps(self.session).encode()
    def test_status(self):
        code, body = self.request(path='/checkout/status')
        self.assertEqual(code, 200); self.assertTrue(body['ready']); self.assertEqual(body['prices'], app.PRICES)
        with patch.dict(os.environ, STRIPE_SECRET_KEY=''):
            self.assertFalse(self.request(path='/checkout/status')[1]['ready'])
    def test_all_prices_scope_and_server_payload(self):
        for key, amount in app.PRICES.items():
            for postal in ('28001','07001'):
                app.RATE.clear(); self.mock_session(key)
                code, body = self.request(dict(key=key,country='ES',postal_code=postal))
                self.assertEqual(code,200); self.assertEqual(body['session_id'],self.session['id'])
                req = self.api.call_args.args[0]; payload = parse_qs(req.data.decode())
                self.assertEqual(req.full_url,'https://api.stripe.com/v1/checkout/sessions')
                self.assertEqual(payload['line_items[0][price_data][unit_amount]'],[str(amount)])
                self.assertEqual(payload['line_items[0][price_data][tax_behavior]'],['inclusive'])
                self.assertNotIn('automatic_tax[enabled]',payload)
                self.assertEqual(payload['metadata[tax_mode]'],['fixed_vat21'])
                self.assertIn('session_id={CHECKOUT_SESSION_ID}',payload['success_url'][0])
                with app.payment_db() as db:
                    self.assertIsNotNone(db.execute('SELECT session FROM checkout_sessions WHERE session=?',(body['session_id'],)).fetchone())
    def test_rejections_and_errors(self):
        for changes in ({'country':'FR'},{'postal_code':'35001'},{'postal_code':'38001'},{'postal_code':'51001'},{'postal_code':'52001'},{'postal_code':'00001'},{'postal_code':'53001'},{'postal_code':'2800'},{'postal_code':28001},{'key':'forged'},{'price':1}):
            app.RATE.clear(); self.api.reset_mock()
            self.assertEqual(self.request(dict(key='essential',country='ES',postal_code='28001',**{}) | changes)[0],400)
            self.api.assert_not_called()
        for origin in ('https://burofaxlegal.es','https://www.burofaxlegal.es','https://evil.invalid',''):
            self.assertEqual(self.request({},origin=origin)[0],403)
        self.assertEqual(self.request({})[0],400)
        app.RATE.clear(); self.mock_session(); self.api.side_effect=OSError('network')
        self.assertEqual(self.request(dict(key='essential',country='ES',postal_code='28001'))[0],502)
        self.api.side_effect=None; app.RATE.clear(); self.mock_session(); self.session['amount_total']=1
        self.api.return_value.__enter__.return_value.read.return_value=json.dumps(self.session).encode()
        self.assertEqual(self.request(dict(key='essential',country='ES',postal_code='28001'))[0],502)
        app.RATE.clear(); self.mock_session()
        with patch.object(app,'PAYMENT_DB',self.tmp.name+'/absent/db'):
            self.assertEqual(self.request(dict(key='essential',country='ES',postal_code='28001'))[0],503)
    def test_stripe_malformed_responses_body_limit_and_rate_limit(self):
        data = dict(key='essential', country='ES', postal_code='28001')
        for field, value in (('currency','usd'), ('total_details', {'amount_tax':0}), ('id','forged'), ('url','https://evil.invalid/pay'), ('url','https://checkout.stripe.com.evil.invalid/pay')):
            self.mock_session(); self.session[field] = value
            self.api.return_value.__enter__.return_value.read.return_value = json.dumps(self.session).encode()
            self.assertEqual(self.request(data)[0],502)
        self.api.return_value.__enter__.return_value.read.return_value = b'not json'
        self.assertEqual(self.request(data)[0],502)
        error = HTTPError('https://api.stripe.com', 401, 'mock', Message(), io.BytesIO())
        self.addCleanup(error.close)
        self.api.side_effect = error
        self.assertEqual(self.request(data)[0],502)
        self.api.side_effect = None
        self.assertEqual(self.request(data | {'padding':'x'*app.MAX_JSON})[0],400)
        app.CHECKOUT_RATE['127.0.0.1'] = [app.time.time()] * 30
        self.assertEqual(self.request(data)[0],429)

    def test_webhook_provenance(self):
        self.mock_session()
        session = self.session | dict(object='checkout.session',livemode=True,mode='payment',status='complete',payment_status='paid',payment_link=None,metadata=dict(site='revisioncontratos.es',key='essential',tax_mode='fixed_vat21'),customer_details={'email':'client@example.invalid'})
        event = dict(object='event',id='evt_Mocked',livemode=True,type='checkout.session.completed',data={'object':session})
        self.assertEqual(app.accept_payment(event),'ignored')
        self.assertEqual(self.request(dict(key='essential',country='ES',postal_code='28001'))[0],200)
        session['total_details']={'amount_tax':0}
        self.assertEqual(app.accept_payment(event),'ignored')
        session['total_details']=self.session['total_details']
        for field, bad in (('currency', 'usd'), ('amount_total', 1), ('payment_status', 'unpaid')):
            original = session[field]; session[field] = bad
            self.assertEqual(app.accept_payment(event), 'ignored')
            session[field] = original
        session['metadata']['tax_mode'] = 'automatic'
        self.assertEqual(app.accept_payment(event), 'ignored')
        session['metadata']['tax_mode'] = 'fixed_vat21'
        self.assertEqual(app.accept_payment(event),'queued'); self.assertEqual(app.accept_payment(event),'duplicate')
        event['id']='evt_Legacy'; session['id']='cs_live_Legacy'; session['payment_link']=app.PAYMENT_LINKS['essential']; session['metadata'].pop('tax_mode'); session.pop('total_details')
        self.assertEqual(app.accept_payment(event),'queued')
        self.mail.send_message.side_effect = OSError('mock SMTP unavailable')
        self.assertFalse(app.deliver_one())
        with app.payment_db() as db:
            self.assertEqual(db.execute('SELECT attempts FROM payments ORDER BY rowid LIMIT 1').fetchone()[0], 1)
            db.execute('UPDATE payments SET next_try=0')
        self.mail.send_message.side_effect = None
        self.assertTrue(app.deliver_one()); self.assertTrue(app.deliver_one()); self.assertFalse(app.deliver_one())
    def test_territory_quote(self):
        data=dict(mode='territory_quote',region='Canarias',nombre='Test Client',email='client@example.invalid',asunto='Arras',caso='Necesito revisar las condiciones del contrato.',privacidad=True,paquete='')
        self.assertEqual(self.request(data,path='/')[0],200)
        text=self.mail.send_message.call_args.args[0].get_content()
        self.assertIn('presupuesto',text); self.assertNotIn('pago',text); self.assertNotIn('documentos adjuntos',text)
        for changes in ({'region':''},{'region':'x'},{'paquete':'Revisión Esencial — 129 €'},{'asunto':'forged'}):
            app.RATE.clear(); self.assertEqual(self.request(data|changes,path='/')[0],400)
        self.assertEqual(self.request(data,path='/',origin='https://burofaxlegal.es')[0],400)
        self.mail.reset_mock(); app.confirm_client('client@example.invalid','Test','RevisiónContratos',1,'territory_quote')
        self.assertIn('documentos adjuntos',self.mail.send_message.call_args.args[0].get_content())

if __name__ == '__main__': unittest.main()
