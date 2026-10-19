#!/usr/bin/env python3
"""Watchdog de pagos: silencio solo si rutas, importes, retornos y fiscalidad pasan."""
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlparse

LINKS = {
    'essential': ('plink_1UPVgBJ9L8bkYbaiupBbsFLQ', 12900),
    'professional': ('plink_1UPVgCJ9L8bkYbaiVp6IWMJ5', 24900),
    'blindada': ('plink_1UPVgEJ9L8bkYbaiGo8XPoTg', 49900),
    'essentialExpress': ('plink_1UPVgGJ9L8bkYbaiIruOsIDd', 17800),
    'essentialCall': ('plink_1UPVgIJ9L8bkYbaiiStxoIPt', 17800),
    'essentialBoth': ('plink_1UPVgJJ9L8bkYbaibFnBZKOL', 22700),
}
ROUTES = {
    'https://revisioncontratos.es/': 'site-revisioncontratos',
    'https://revisioncontratos.es/precios/': 'site-revisioncontratos',
    'https://revisioncontratos.es/contratar/': 'id="order-pagar"',
    'https://revisioncontratos.es/cuenta-tu-caso/': 'id="f-paquete"',
    'https://revisioncontratos.es/solicitar-contrato/': 'custom_quote',
    'https://burofaxlegal.es/': 'site-burofaxlegal',
    'https://burofaxlegal.es/cuenta-tu-caso/': 'id="intake"',
    'https://intake.marcospera.com/health': None,
}


class Anchors(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.hrefs.append(dict(attrs).get('href', ''))


def check_link(key, expected, link, items):
    errors = []
    pid, amount = expected
    if not link.get('active'):
        errors.append(f'{key}: enlace INACTIVO ({pid})')
    redirect = link.get('after_completion', {}).get('redirect', {}).get('url', '')
    u = urlparse(redirect)
    q = parse_qs(u.query)
    if (u.scheme, u.netloc, u.path) != ('https', 'revisioncontratos.es', '/cuenta-tu-caso/') or q.get('paquete') != [key] or q.get('session_id') != ['{CHECKOUT_SESSION_ID}']:
        errors.append(f'{key}: retorno o paquete incorrecto')
    if link.get('metadata', {}).get('key') != key or link.get('metadata', {}).get('site') != 'revisioncontratos.es':
        errors.append(f'{key}: metadatos incompatibles con webhook')
    rows = items.get('data', [])
    if len(rows) != 1:
        errors.append(f'{key}: número de líneas inesperado')
    else:
        price = rows[0].get('price', {})
        if price.get('unit_amount') != amount or price.get('currency') != 'eur' or rows[0].get('quantity') != 1:
            errors.append(f'{key}: importe, moneda o cantidad incorrectos')
        if price.get('tax_behavior') != 'inclusive':
            errors.append(f'{key}: IVA no incluido en el precio')
    if not link.get('automatic_tax', {}).get('enabled'):
        errors.append(f'{key}: cálculo fiscal automático desactivado; revisar configuración')
    return errors


def check_tax(settings, registrations):
    errors = []
    office = settings.get('head_office') or {}
    if settings.get('status') != 'active' or not office.get('address'):
        errors.append('Stripe Tax NO preparado: comprobar domicilio fiscal y campos pendientes')
    if not any(r.get('country') == 'ES' and r.get('status') == 'active' for r in registrations.get('data', [])):
        errors.append('Stripe Tax: sin registro activo de recaudación ES configurado')
    return errors


def check_page(url, body):
    marker = ROUTES[url]
    if marker is None:
        return [] if json.loads(body).get('ok') is True else ['intake: health sin ok']
    errors = [] if marker in body else [f'{url}: identidad o control obligatorio ausente']
    if url.endswith('/precios/'):
        p = Anchors()
        p.feed(body)
        if len(set(h for h in p.hrefs if h.startswith('https://buy.stripe.com/'))) < 6:
            errors.append('/precios/: faltan enlaces reales de los seis paquetes')
    return errors


def main():
    env = {}
    with open(os.path.expanduser('~/.secrets/carla-stripe.env')) as f:
        for line in f:
            if '=' in line and not line.lstrip().startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('\"').strip("'")
    key = env['STRIPE_SECRET_KEY']

    def api(path):
        req = urllib.request.Request('https://api.stripe.com/v1/' + path, headers={'Authorization': 'Bearer ' + key})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)

    def one(item):
        k, expected = item
        pid = expected[0]
        try:
            return check_link(k, expected, api('payment_links/' + pid), api('payment_links/' + pid + '/line_items'))
        except Exception as e:
            return [f'{k}: comprobación API fallida ({type(e).__name__})']

    alerts = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        for result in pool.map(one, LINKS.items()):
            alerts.extend(result)
    try:
        alerts.extend(check_tax(api('tax/settings'), api('tax/registrations?limit=100')))
    except Exception as e:
        alerts.append(f'Comprobación fiscal fallida ({type(e).__name__})')

    def page(url):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                return check_page(url, r.read().decode('utf-8'))
        except Exception as e:
            return [f'{url}: comprobación fallida ({type(e).__name__})']
    with ThreadPoolExecutor(max_workers=6) as pool:
        for result in pool.map(page, ROUTES):
            alerts.extend(result)
    if alerts:
        print('ALERTA servicios legales:\n' + '\n'.join('- ' + a for a in alerts))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
