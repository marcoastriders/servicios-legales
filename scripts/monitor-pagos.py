#!/usr/bin/env python3
"""Vigilante diario de revisioncontratos.es / burofaxlegal.es.
Comprueba: 6 payment links de Stripe activos, rutas clave 200, salud del intake.
Imprime alertas (una por línea) solo si algo falla; exit 1 si hay fallos."""
import json, os, urllib.request, sys

env = {}
for line in open(os.path.expanduser('~/.secrets/carla-stripe.env')):
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
SK = env['STRIPE_SECRET_KEY']

PLINKS = {
    'essential 129€': 'plink_1UPVgBJ9L8bkYbaiupBbsFLQ',
    'professional 249€': 'plink_1UPVgCJ9L8bkYbaiVp6IWMJ5',
    'blindada 499€': 'plink_1UPVgEJ9L8bkYbaiGo8XPoTg',
    'essentialExpress 178€': 'plink_1UPVgGJ9L8bkYbaiIruOsIDd',
    'essentialCall 178€': 'plink_1UPVgIJ9L8bkYbaiiStxoIPt',
    'essentialBoth 227€': 'plink_1UPVgJJ9L8bkYbaibFnBZKOL',
}
RUTAS = [
    'https://revisioncontratos.es/', 'https://revisioncontratos.es/precios/',
    'https://revisioncontratos.es/cuenta-tu-caso/',
    'https://burofaxlegal.es/', 'https://burofaxlegal.es/cuenta-tu-caso/',
    'https://intake.marcospera.com/health',
]
alertas = []
for nombre, pid in PLINKS.items():
    try:
        req = urllib.request.Request(f'https://api.stripe.com/v1/payment_links/{pid}',
                                     headers={'Authorization': f'Bearer {SK}'})
        d = json.load(urllib.request.urlopen(req, timeout=30))
        if not d.get('active'):
            alertas.append(f'Payment link INACTIVO: {nombre} ({pid})')
    except Exception as e:
        alertas.append(f'No se pudo comprobar el payment link {nombre}: {e}')
for url in RUTAS:
    try:
        r = urllib.request.urlopen(url, timeout=30)
        body = r.read().decode('utf-8', 'ignore')
        if r.status != 200:
            alertas.append(f'{url} responde {r.status}')
        elif url.endswith('/health') and '"ok": true' not in body:
            alertas.append('intake /health no devuelve ok')
        elif url.endswith('/precios/') and 'buy.stripe.com' not in body:
            alertas.append('/precios/ sin botones de pago Stripe')
    except Exception as e:
        alertas.append(f'{url} ERROR: {e}')
if alertas:
    print('ALERTA servicios legales:')
    for a in alertas:
        print('-', a)
    sys.exit(1)
