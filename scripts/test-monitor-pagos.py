import copy
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('monitor', pathlib.Path(__file__).with_name('monitor-pagos.py'))
assert spec is not None and spec.loader is not None
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class MonitorTests(unittest.TestCase):
    def setUp(self):
        self.key = 'essential'
        self.expected = m.LINKS[self.key]
        self.link = {'active': True, 'metadata': {'key': self.key, 'site': 'revisioncontratos.es'}, 'automatic_tax': {'enabled': True}, 'after_completion': {'redirect': {'url': 'https://revisioncontratos.es/cuenta-tu-caso/?paquete=essential&session_id={CHECKOUT_SESSION_ID}'}}}
        self.items = {'data': [{'quantity': 1, 'price': {'unit_amount': 12900, 'currency': 'eur', 'tax_behavior': 'inclusive'}}]}

    def test_config_ok(self):
        self.assertEqual(m.check_link(self.key, self.expected, self.link, self.items), [])

    def test_inactive_and_bad_amount(self):
        self.link['active'] = False
        self.items['data'][0]['price']['unit_amount'] = 9900
        self.assertEqual(len(m.check_link(self.key, self.expected, self.link, self.items)), 2)

    def test_redirect_and_metadata(self):
        self.link['after_completion']['redirect']['url'] = 'https://example.invalid/'
        self.link['metadata']['key'] = 'blindada'
        self.assertEqual(len(m.check_link(self.key, self.expected, self.link, self.items)), 2)

    def test_tax_pending(self):
        self.assertEqual(len(m.check_tax({'status': 'pending', 'head_office': None}, {'data': []})), 2)
        self.assertEqual(m.check_tax({'status': 'active', 'head_office': {'address': {'country': 'ES'}}}, {'data': [{'country': 'ES', 'status': 'active'}]}), [])

    def test_html_substring_not_payment_buttons(self):
        self.assertTrue(m.check_page('https://revisioncontratos.es/precios/', 'site-revisioncontratos <script>buy.stripe.com</script>'))
        body = 'site-revisioncontratos ' + ''.join('<a href="https://buy.stripe.com/test'+str(i)+'">pagar</a>' for i in range(6))
        self.assertEqual(m.check_page('https://revisioncontratos.es/precios/', body), [])

if __name__ == '__main__':
    unittest.main()
