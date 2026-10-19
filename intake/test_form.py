import os, unittest, threading, http.client, json
from unittest.mock import patch
os.environ.setdefault('SMTP_USER','offline@example.test'); os.environ.setdefault('SMTP_PASS','offline')
import server as s
class Forms(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.http=s.ThreadingHTTPServer(('127.0.0.1',0),s.H); threading.Thread(target=cls.http.serve_forever,daemon=True).start()
 @classmethod
 def tearDownClass(cls): cls.http.shutdown(); cls.http.server_close()
 def setUp(self): s.RATE.clear()
 def req(self,body=b'{}',ctype='application/json',origin='https://revisioncontratos.es',extra=None):
  c=http.client.HTTPConnection('127.0.0.1',self.http.server_port); c.request('POST','/',body,{'Origin':origin,'Content-Type':ctype,**(extra or {})}); r=c.getresponse(); out=(r.status,dict(r.getheaders()),r.read()); c.close(); return out
 def check(self,result,status,origin='https://revisioncontratos.es'):
  self.assertEqual(result[0],status); self.assertEqual(result[1].get('Access-Control-Allow-Origin'),origin)
 def valid(self):    return {'paquete':'Revisión Esencial — 129 €', 'nombre':'Offline Test','email':'offline@example.test','asunto':'Arras','caso':'Consulta de prueba offline de longitud suficiente','privacidad':True}
 def test_errors(self):
  for body,ctype,status in [(b'{}','application/json',400),(b'[]','application/json',400),(b'null','application/json',400),(b'{','application/json',400),(b'x','text/plain',415),(b'','application/json',400)]:
   with self.subTest(body=body): self.check(self.req(body,ctype),status)
 def test_invalid_origin(self):
  r=self.req(origin='https://evil.example'); self.assertEqual(r[0],403); self.assertNotIn('Access-Control-Allow-Origin',r[1])
 def test_success_and_smtp_error(self):
  with patch.object(s,'send_mail') as mail:
   self.check(self.req(json.dumps(self.valid()).encode()),200); self.assertEqual(mail.call_count,2)
  with patch.object(s,'send_mail',side_effect=RuntimeError('offline')): self.check(self.req(json.dumps(self.valid()).encode()),502)
 def test_honeypot(self): self.check(self.req(b'{"website":"bot"}'),200)
 def test_multipart(self):
  boundary='offline'; fields=self.valid(); fields['privacidad']='true'
  body=''.join('--offline\r\nContent-Disposition: form-data; name="'+k+'"\r\n\r\n'+str(v)+'\r\n' for k,v in fields.items()).encode()+b'--offline\r\nContent-Disposition: form-data; name="file"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-offline\r\n--offline--\r\n'
  with patch.object(s,'send_mail') as mail:
   self.check(self.req(body,'multipart/form-data; boundary='+boundary),200); self.assertEqual(mail.call_args_list[0].kwargs['attachments'][0][0],'test.pdf')
 def test_forged_xff_no_bypass(self):
  with patch.object(s,'send_mail'):
   for i in range(3): self.check(self.req(json.dumps(self.valid()).encode(),extra={'X-Forwarded-For':f'1.1.1.{i+1}, 8.8.8.8'}),200)
   self.check(self.req(json.dumps(self.valid()).encode(),extra={'X-Forwarded-For':'9.9.9.9, 8.8.8.8'}),429)
 def test_direct_peer_ignores_forwarded(self):
  self.assertEqual(s.client_ip('8.8.4.4',{'X-Forwarded-For':'1.1.1.1','CF-Connecting-IP':'9.9.9.9'}),'8.8.4.4')
  self.assertEqual(s.client_ip('127.0.0.1',{'X-Forwarded-For':'1.1.1.1, garbage, 8.8.8.8, 10.0.0.1'}),'8.8.8.8')
if __name__=='__main__': unittest.main(verbosity=2)
