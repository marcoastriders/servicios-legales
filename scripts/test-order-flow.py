"""Local HTTP integration tests. SMTP is mocked; no payments or real mail."""
import importlib.util
import json
import os
from pathlib import Path
import threading
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch

os.environ.setdefault('SMTP_USER', 'test@example.invalid')
os.environ.setdefault('SMTP_PASS', 'unused')
spec = importlib.util.spec_from_file_location('intake_test', Path(__file__).resolve().parents[1] / 'intake/server.py')
assert spec is not None and spec.loader is not None
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

class OrderFlow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = app.ThreadingHTTPServer(('127.0.0.1', 0), app.H)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        app.RATE.clear()
        self.smtp = patch.object(app.smtplib, 'SMTP')
        self.mail = self.smtp.start().return_value.__enter__.return_value
        self.addCleanup(self.smtp.stop)

    def post(self, changes=None, multipart=False, origin='https://revisioncontratos.es', attachment=False):
        app.RATE.clear()
        data = dict(nombre='Test Client', email='test@example.invalid', telefono='123456789', asunto='Arras', caso='Necesito revisar las condiciones de este contrato.', privacidad=True, website='', paquete='Revisión Esencial — 129 €')
        data.update(changes or {})
        if multipart:
            boundary = 'local-test-boundary'
            parts = []
            for key, value in data.items():
                if isinstance(value, bool): value = '1' if value else ''
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
            if attachment:
                parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="adjuntos"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 local test\r\n'.encode())
            raw = b''.join(parts) + f'--{boundary}--\r\n'.encode()
            content_type = f'multipart/form-data; boundary={boundary}'
        else:
            raw = json.dumps(data).encode()
            content_type = 'application/json'
        request = Request(f'http://127.0.0.1:{self.server.server_port}/', data=raw, headers={'Origin': origin, 'Content-Type': content_type})
        try:
            response = urlopen(request)
        except HTTPError as error:
            response = error
        with response:
            self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), origin)
            return response.status, json.load(response)

    def test_normal_review_json_and_multipart(self):
        for multipart in (False, True):
            for package in sorted(app.VALID_REVISION_PAQUETES):
                with self.subTest(multipart=multipart, package=package):
                    self.assertEqual(self.post({'paquete':package}, multipart=multipart, attachment=multipart)[0], 200)
                    message = self.mail.send_message.call_args_list[-2].args[0]
                    self.assertIn(package, message.get_body(preferencelist=('plain',)).get_content())
            for package in ('', 'forged'):
                self.mail.reset_mock()
                self.assertEqual(self.post({'paquete':package}, multipart=multipart)[0], 400)
                self.mail.send_message.assert_not_called()

    def test_quote_json_and_attachment_confirmation(self):
        for multipart in (False, True):
            self.mail.reset_mock()
            status, body = self.post(dict(mode='custom_quote', asunto='Contrato a medida', paquete='', web='burofaxlegal.es'), multipart=multipart, attachment=multipart)
            self.assertEqual(status, 200)
            self.assertTrue(body['ok'])
            confirmation = self.mail.send_message.call_args_list[-1].args[0]
            text = confirmation.get_content()
            self.assertIn('Presupuesto solicitado', str(confirmation['Subject']))
            self.assertIn('presupuesto', text)
            self.assertNotIn('verificará el pago', text)
            self.assertNotIn('El contrato está pendiente', text)
            self.assertEqual('documentos adjuntos' in text, multipart)
            self.assertEqual(len(list(self.mail.send_message.call_args_list[-2].args[0].iter_attachments())), int(multipart))

    def test_restricted_quote_mode(self):
        cases = [dict(mode='custom_quote', asunto='Arras', paquete=''), dict(mode='custom_quote', asunto='Contrato a medida'), dict(mode='unknown', paquete=''), dict(mode=None, paquete=''), dict(mode=['custom_quote'], paquete=''), dict(mode='custom_quote', asunto='Contrato a medida', paquete='forged')]
        for multipart in (False, True):
            for changes in cases:
                with self.subTest(changes=changes, multipart=multipart):
                    self.assertEqual(self.post(changes, multipart=multipart)[0], 400)
        self.assertEqual(self.post(dict(mode='custom_quote', asunto='Contrato a medida', paquete='', web='revisioncontratos.es'), origin='https://burofaxlegal.es')[0], 400)
        self.mail.send_message.assert_not_called()

    def test_burofax_unchanged(self):
        self.assertEqual(self.post(dict(paquete='', web='revisioncontratos.es', asunto='Impago de alquiler'), origin='https://burofaxlegal.es')[0], 200)
        text = self.mail.send_message.call_args_list[-1].args[0].get_content()
        self.assertIn('BurofaxLegal', text)
        self.assertIn('presupuesto cerrado', text)

    def test_consent_and_smtp_failure(self):
        self.assertEqual(self.post({'mode':'custom_quote','asunto':'Contrato a medida','paquete':'','privacidad':False})[0], 400)
        self.mail.send_message.assert_not_called()
        self.mail.send_message.side_effect = RuntimeError('mock SMTP unavailable')
        self.assertEqual(self.post()[0], 502)

if __name__ == '__main__':
    unittest.main()
