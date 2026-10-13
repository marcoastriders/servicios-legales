#!/usr/bin/env python3
"""Webhook de intake para burofaxlegal.es y revisioncontratos.es.
Recibe POST JSON o multipart/form-data del formulario 'cuéntanos tu caso',
con adjuntos opcionales, y lo envía por email a Carla.
Sin dependencias externas: solo stdlib.
"""
import base64, hashlib, hmac, json, os, re, smtplib, ssl, time, sqlite3, threading, ipaddress
from collections import defaultdict
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SMTP_HOST = os.environ.get('SMTP_HOST', 'mail.marcospera.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ['SMTP_USER']
SMTP_PASS = os.environ['SMTP_PASS']
TO = os.environ.get('INTAKE_TO', 'abogada@carlamorales.es')
CC = os.environ.get('INTAKE_CC', 'marcoastriders.wf@gmail.com')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
ALLOWED_ORIGINS = {
    'https://burofaxlegal.es', 'https://www.burofaxlegal.es',
    'https://revisioncontratos.es', 'https://www.revisioncontratos.es',
    'http://localhost:8080', 'http://127.0.0.1:8080',
}
VALID_ASUNTOS = {
    'Impago de alquiler', 'Devolución de fianza', 'Incumplimiento de contrato',
    'Vecino moroso (comunidad)', 'Deuda entre particulares',
    'Revisión de contrato de alquiler', 'Cláusulas abusivas', 'Actualización de renta',
    'Prórroga de alquiler', 'Arras', 'Préstamo entre particulares', 'Contrato a medida',
    'Otro asunto',
}
RATE = defaultdict(list)  # ip -> [timestamps]
LIMIT, WINDOW = 3, 600

EMAIL_RE = re.compile(r'^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$')
DIGITS_RE = re.compile(r'\D+')

# Adjuntos: extensión -> familia MIME esperada
ALLOWED_EXT = {'.pdf': 'application', '.jpg': 'image', '.jpeg': 'image', '.png': 'image'}
MAX_FILE_SIZE = 5 * 1024 * 1024      # 5 MB por archivo
MAX_TOTAL_SIZE = 10 * 1024 * 1024    # 10 MB en total
MAX_FILES = 5
MAX_JSON = 100_000
MAX_BODY = 15 * 1024 * 1024          # tope duro de cuerpo (multipart)

def send_mail(subject, body, reply_to=None, to=None, cc=None, attachments=()):
    msg = EmailMessage()
    msg['From'] = f'Web {os.environ.get("SENDER_NAME", "Servicios legales")} <{SMTP_USER}>'
    msg['To'] = to or TO
    if cc is not None:
        msg['Cc'] = cc
    if reply_to:
        msg['Reply-To'] = reply_to
    msg['Subject'] = subject
    msg.set_content(body, charset='utf-8')
    for filename, ctype, data in attachments:
        maintype, subtype = (ctype.split('/', 1) + ['octet-stream'])[:2]
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=filename)
    ctx = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
        s.starttls(context=ctx)
        s.login(SMTP_USER, SMTP_PASS)
        s.send_message(msg)

def confirm_client(email, nombre, site_name, n_adjuntos=0):
    docs = (
        'Hemos recibido también los documentos adjuntos; Carla los revisará junto a tu historia.\n'
        if n_adjuntos else ''
    )
    if site_name == 'RevisiónContratos':
        body = (f'Hola {nombre},\n\nHemos recibido tus datos y tu contrato. '
                'El pago se verifica de forma independiente mediante Stripe. '
                + (docs if n_adjuntos else 'El contrato está pendiente: responde a este correo adjuntando el documento completo.\n')
                + 'Carla revisará el encargo pagado y te confirmará por email la recepción y el plazo de entrega.\n')
        send_mail(f'Tus datos han llegado — {site_name}', body, to=email, cc=None)
        return
    body = (
        f"Hola {nombre},\n\n"
        f"Hemos recibido tu consulta en {site_name}. Carla Morales, abogada colegiada en el Ilustre Colegio de Abogados de Jerez, "
        "revisará personalmente tu caso y te responderá con un presupuesto cerrado. El plazo habitual de respuesta es el mismo día laborable o el siguiente.\n"
        f"{docs}\n"
        "Si necesitas añadir algún documento o dato, puedes contestar directamente a este correo.\n\n"
        f"Un saludo,\nEl equipo de {site_name}\n"
    )
    send_mail(f'Tu consulta ha llegado — {site_name}', body, to=email, cc=None)

def parse_multipart(body, content_type):
    """Devuelve (campos dict, adjuntos [(nombre, tipo, bytes)]) o lanza ValueError."""
    raw = b'Content-Type: ' + content_type.encode('utf-8', 'replace') + b'\r\nMIME-Version: 1.0\r\n\r\n' + body
    msg = BytesParser(policy=policy.default).parsebytes(raw)
    fields, files = {}, []
    for part in msg.iter_parts():
        name = part.get_param('name', header='content-disposition')
        filename = part.get_filename()
        payload = part.get_payload(decode=True) or b''
        if not name:
            continue
        if filename:
            files.append((os.path.basename(filename)[:120], part.get_content_type(), payload))
        else:
            fields[name] = payload.decode('utf-8', 'replace')
    return fields, files

def validate_files(files):
    """Devuelve adjuntos válidos [(nombre, ctype, bytes)] o lanza ValueError con motivo."""
    if len(files) > MAX_FILES:
        raise ValueError(f'máximo {MAX_FILES} archivos')
    total = 0
    clean = []
    for filename, ctype, data in files:
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXT:
            raise ValueError(f'formato no permitido: {filename} (usa PDF, JPG o PNG)')
        if not ctype.startswith(ALLOWED_EXT[ext] + '/') and ctype != 'application/octet-stream':
            raise ValueError(f'tipo de archivo no válido: {filename}')
        if len(data) > MAX_FILE_SIZE:
            raise ValueError(f'archivo mayor de 5 MB: {filename}')
        total += len(data)
        clean.append((filename, ctype, data))
    if total > MAX_TOTAL_SIZE:
        raise ValueError('los archivos suman más de 10 MB en total')
    return clean

def stripe_sig_ok(body: bytes, header: str) -> bool:
    """Verifica Stripe-Signature: t=timestamp,v1=mac (y v0 legacy)."""
    if not STRIPE_WEBHOOK_SECRET or not header:
        return False
    try:
        ts = re.search(r't=(\d+)', header).group(1)
        sigs = re.findall(r'v1=([0-9a-f]+)', header)
    except Exception:
        return False
    if abs(time.time() - int(ts)) > 300:  # tolerancia 5 min
        return False
    key = STRIPE_WEBHOOK_SECRET.encode('utf-8')
    mac = hmac.new(key, f'{ts}.'.encode() + body, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(mac, s) for s in sigs)


# Prices and Payment Link IDs are server-owned, never inferred from return URLs.
PRICES = {'essential': 12900, 'professional': 24900, 'blindada': 49900, 'essentialExpress': 17800, 'essentialCall': 17800, 'essentialBoth': 22700}
PAYMENT_LINKS = {'essential': 'plink_1UPVgBJ9L8bkYbaiupBbsFLQ', 'professional': 'plink_1UPVgCJ9L8bkYbaiVp6IWMJ5', 'blindada': 'plink_1UPVgEJ9L8bkYbaiGo8XPoTg', 'essentialExpress': 'plink_1UPVgGJ9L8bkYbaiIruOsIDd', 'essentialCall': 'plink_1UPVgIJ9L8bkYbaiiStxoIPt', 'essentialBoth': 'plink_1UPVgJJ9L8bkYbaibFnBZKOL'}
PAYMENT_DB = os.environ.get('PAYMENT_DB', '/data/payments.sqlite3')

from contextlib import contextmanager

@contextmanager
def payment_db():
    db = sqlite3.connect(PAYMENT_DB, timeout=30)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('PRAGMA synchronous=FULL')
    db.execute('CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, session TEXT NOT NULL)')
    db.execute("CREATE TABLE IF NOT EXISTS payments (session TEXT PRIMARY KEY, payload TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, next_try REAL NOT NULL DEFAULT 0)")
    try:
        with db:
            yield db
    finally:
        db.close()

def accept_payment(event):
    if not isinstance(event, dict) or event.get('object') != 'event' or not re.fullmatch(r'evt_[A-Za-z0-9]+', str(event.get('id', ''))) or type(event.get('livemode')) is not bool:
        raise ValueError('event schema')
    if event.get('type') != 'checkout.session.completed':
        return 'ignored'
    data = event.get('data')
    session = data.get('object') if isinstance(data, dict) else None
    if not isinstance(session, dict) or session.get('object') != 'checkout.session':
        raise ValueError('session schema')
    meta = session.get('metadata')
    if not isinstance(meta, dict):
        raise ValueError('metadata schema')
    key = meta.get('key')
    valid = (event['livemode'] is True and session.get('livemode') is True
             and session.get('mode') == 'payment' and session.get('status') == 'complete'
             and session.get('payment_status') == 'paid' and session.get('currency') == 'eur'
             and meta.get('site') == 'revisioncontratos.es' and key in PRICES
             and session.get('payment_link') == PAYMENT_LINKS.get(key)
             and type(session.get('amount_total')) is int and session['amount_total'] == PRICES.get(key)
             and re.fullmatch(r'cs_live_[A-Za-z0-9]+', str(session.get('id', ''))))
    if not valid:
        return 'ignored'
    cust = session.get('customer_details')
    if not isinstance(cust, dict) or not isinstance(cust.get('email'), str) or not EMAIL_RE.fullmatch(cust['email']):
        raise ValueError('customer schema')
    with payment_db() as db:
        db.execute('BEGIN IMMEDIATE')
        if db.execute('SELECT 1 FROM events WHERE id=?', (event['id'],)).fetchone():
            return 'duplicate'
        db.execute('INSERT INTO events VALUES (?,?)', (event['id'], session['id']))
        cur = db.execute('INSERT OR IGNORE INTO payments(session,payload) VALUES (?,?)', (session['id'], json.dumps(session)))
        return 'queued' if cur.rowcount else 'duplicate'

def deliver_one():
    # One worker per process; failed SMTP deliveries remain durable and retry.
    with payment_db() as db:
        row = db.execute('SELECT session,payload,attempts FROM payments WHERE sent=0 AND next_try<=? ORDER BY rowid LIMIT 1', (time.time(),)).fetchone()
    if not row:
        return False
    sid, payload, attempts = row
    session = json.loads(payload)
    key = session['metadata']['key']
    cust = session['customer_details']
    amount = session['amount_total'] / 100
    body = (f'PAGO VERIFICADO en revisioncontratos.es\nServicio: {key}\nImporte: {amount:.2f} EUR (IVA incluido)\n'
            f'Cliente: {cust.get("name", "")} <{cust["email"]}>\nSesión: {sid}\n'
            'Documentos pendientes de recepción/verificación. El enlace de retorno no prueba el pago.\n')
    try:
        send_mail(f'[PAGO] {key} — {amount:.2f} EUR', body, reply_to=cust['email'], cc=CC)
    except Exception:
        with payment_db() as db:
            db.execute('UPDATE payments SET attempts=attempts+1,next_try=? WHERE session=?', (time.time()+min(3600, 30*2**min(attempts,7)),sid))
        return False
    with payment_db() as db:
        db.execute('UPDATE payments SET sent=1 WHERE session=?', (sid,))
    return True

def payment_worker():
    while True:
        try:
            deliver_one()
        except Exception:
            print('PAYMENT QUEUE ERROR', flush=True)
        time.sleep(5)

def client_ip(peer, headers):
    """Trust XFF only behind the private proxy, which MUST append its peer.

    The rightmost global address is the nearest public hop; client-supplied
    prefixes cannot override it. Never trust CF-Connecting-IP without a proxy
    that overwrites it. Private-network ingress must remain proxy-only.
    """
    address = ipaddress.ip_address(peer)
    if address.is_private or address.is_loopback:
        for value in reversed(headers.get('X-Forwarded-For', '').split(',')):
            try:
                forwarded = ipaddress.ip_address(value.strip())
            except ValueError:
                continue
            if forwarded.is_global:
                return str(forwarded)
    return str(address)

class H(BaseHTTPRequestHandler):
    server_version = 'intake/1.2'

    def _json(self, code, obj, origin=None):
        data = json.dumps(obj).encode()
        if origin is None:
            origin = self.headers.get('Origin', '')
        self.send_response(code)
        self.send_header('Vary', 'Origin')
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        if origin in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self._json(204, {}, origin=self.headers.get('Origin', ''))

    def do_GET(self):
        if self.path == '/health':
            self._json(200, {'ok': True})
        else:
            self._json(404, {'ok': False})

    def do_POST(self):
        if self.path == '/stripe/webhook':
            return self._stripe_webhook()
        origin = self.headers.get('Origin', '')
        if origin not in ALLOWED_ORIGINS:
            return self._json(403, {'ok': False, 'error': 'origen no permitido'})
        ip = client_ip(self.client_address[0], self.headers)
        now = time.time()
        RATE[ip] = [t for t in RATE[ip] if now - t < WINDOW]
        if len(RATE[ip]) >= LIMIT:
            return self._json(429, {'ok': False, 'error': 'demasiados envíos, inténtalo más tarde'})

        ctype = self.headers.get('Content-Type', '')
        try:
            n = int(self.headers.get('Content-Length', 0))
            if n <= 0 or n > MAX_BODY:
                raise ValueError('longitud')
            raw = self.rfile.read(n)
            files = []
            if ctype.startswith('multipart/form-data'):
                fields, files = parse_multipart(raw, ctype)
                d = dict(fields)
                d['privacidad'] = fields.get('privacidad', '') in ('1', 'on', 'true', 'yes')
            elif ctype.startswith('application/json'):
                if n > MAX_JSON:
                    raise ValueError('longitud')
                d = json.loads(raw)
                if not isinstance(d, dict):
                    raise ValueError('objeto JSON requerido')
            else:
                return self._json(415, {'ok': False, 'error': 'formato no soportado'})
        except ValueError as e:
            return self._json(400, {'ok': False, 'error': f'datos no válidos ({e})'})
        except Exception:
            return self._json(400, {'ok': False, 'error': 'datos no válidos'})

        if d.get('website'):  # honeypot: los bots lo rellenan
            return self._json(200, {'ok': True})  # fingimos éxito

        nombre = str(d.get('nombre', '')).strip()[:120]
        email = str(d.get('email', '')).strip()[:200]
        telefono = str(d.get('telefono', '')).strip()[:40]
        asunto = str(d.get('asunto', '')).strip()
        caso = str(d.get('caso', '')).strip()[:8000]
        web = 'burofaxlegal.es' if origin in ('https://burofaxlegal.es', 'https://www.burofaxlegal.es') else 'revisioncontratos.es'

        errs = []
        if len(nombre) < 2: errs.append('nombre')
        if not EMAIL_RE.match(email): errs.append('email')
        if 'burofax' in web and len(DIGITS_RE.sub('', telefono)) < 5: errs.append('telefono')
        if asunto not in VALID_ASUNTOS: errs.append('asunto')
        if len(caso) < 30: errs.append('caso')
        if d.get('privacidad') is not True: errs.append('privacidad')
        if errs:
            return self._json(400, {'ok': False, 'error': 'campos: ' + ', '.join(errs)})

        try:
            adjuntos = validate_files(files)
        except ValueError as e:
            return self._json(400, {'ok': False, 'error': str(e)})

        RATE[ip].append(now)
        site_name = 'BurofaxLegal' if 'burofax' in web else 'RevisiónContratos'
        subject = f'[Nuevo caso {site_name}] {asunto} — {nombre}'
        adjuntos_linea = '\n'.join(f'Adjunto: {fn} ({len(data)//1024} KB, {ct})' for fn, ct, data in adjuntos)
        body = (
            f'Nuevo caso recibido desde {web}\n\n'
            f'Nombre: {nombre}\nEmail: {email}\nTeléfono: {telefono or "(no indicado)"}\n'
            f'Asunto: {asunto}\n\nHistoria:\n{caso}\n\n'
            f'{adjuntos_linea + chr(10) if adjuntos_linea else ""}---\nIP: {ip}\n'
            f'Responder escribiendo a: {email}\n'
        )
        try:
            send_mail(subject, body, reply_to=email, cc=CC, attachments=adjuntos)
            confirm_client(email, nombre, site_name, n_adjuntos=len(adjuntos))
        except Exception as e:
            print('SMTP ERROR:', e, flush=True)
            return self._json(502, {'ok': False, 'error': 'no se pudo enviar, prueba de nuevo o escribe a abogada@carlamorales.es'})
        print(f'CASO OK {site_name} {asunto} {email} adjuntos={len(adjuntos)}', flush=True)
        return self._json(200, {'ok': True})

    def _stripe_webhook(self):
        try:
            n = int(self.headers.get('Content-Length', 0))
        except ValueError:
            return self._json(400, {'ok': False, 'error': 'longitud'})
        if n <= 0 or n > 500_000:
            return self._json(400, {'ok': False, 'error': 'longitud'})
        raw = self.rfile.read(n)
        if not stripe_sig_ok(raw, self.headers.get('Stripe-Signature', '')):
            return self._json(400, {'ok': False, 'error': 'firma no válida'})
        try:
            d = json.loads(raw)
        except Exception:
            return self._json(400, {'ok': False, 'error': 'json no válido'})
        try:
            result = accept_payment(d)
        except ValueError:
            return self._json(400, {'ok': False, 'error': 'evento no válido'})
        except Exception:
            return self._json(503, {'ok': False, 'error': 'cola no disponible'})
        return self._json(200, {'ok': True, 'result': result})

    def log_message(self, format, *args):  # noqa: A002 - firma de BaseHTTPRequestHandler
        pass

if __name__ == '__main__':
    os.makedirs(os.path.dirname(PAYMENT_DB), exist_ok=True)
    with payment_db():
        pass
    threading.Thread(target=payment_worker, daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0', 8000), H).serve_forever()
