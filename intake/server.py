#!/usr/bin/env python3
"""Webhook de intake para burofaxlegal.es y revisioncontratos.es.
Recibe POST JSON del formulario 'cuéntanos tu caso' y lo envía por email a Carla.
Sin dependencias externas: solo stdlib.
"""
import ipaddress, json, os, re, smtplib, ssl, time
from collections import defaultdict
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SMTP_HOST = os.environ.get('SMTP_HOST', 'mail.marcospera.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ['SMTP_USER']
SMTP_PASS = os.environ['SMTP_PASS']
TO = os.environ.get('INTAKE_TO', 'abogada@carlamorales.es')
CC = os.environ.get('INTAKE_CC', 'marcoastriders.wf@gmail.com')
ORIGIN_SITES = {
    'https://burofaxlegal.es': 'BurofaxLegal',
    'https://www.burofaxlegal.es': 'BurofaxLegal',
    'https://revisioncontratos.es': 'RevisiónContratos',
    'https://www.revisioncontratos.es': 'RevisiónContratos',
    'http://localhost:8080': 'RevisiónContratos',
    'http://127.0.0.1:8080': 'RevisiónContratos',
}
ALLOWED_ORIGINS = set(ORIGIN_SITES)
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


def client_ip(headers, peer_ip):
    """Acepta cabeceras de cliente solo cuando la conexión llega del proxy interno."""
    try:
        peer = ipaddress.ip_address(peer_ip)
    except ValueError:
        return peer_ip
    if not (peer.is_private or peer.is_loopback or peer.is_link_local):
        return peer_ip

    for header in ('CF-Connecting-IP', 'X-Real-IP'):
        candidate = headers.get(header, '').strip()
        try:
            if candidate and ipaddress.ip_address(candidate).is_global:
                return candidate
        except ValueError:
            pass

    chain = [p.strip() for p in headers.get('X-Forwarded-For', '').split(',') if p.strip()]
    for candidate in reversed(chain):
        try:
            if ipaddress.ip_address(candidate).is_global:
                return candidate
        except ValueError:
            continue
    return peer_ip

def send_mail(subject, body, reply_to=None, to=None, cc=None):
    msg = EmailMessage()
    msg['From'] = f'Web {os.environ.get("SENDER_NAME", "Servicios legales")} <{SMTP_USER}>'
    msg['To'] = to or TO
    if cc is not None:
        msg['Cc'] = cc
    if reply_to:
        msg['Reply-To'] = reply_to
    msg['Subject'] = subject
    msg.set_content(body, charset='utf-8')
    ctx = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
        s.starttls(context=ctx)
        s.login(SMTP_USER, SMTP_PASS)
        s.send_message(msg)

def confirm_client(email, nombre, site_name):
    if site_name == 'RevisiónContratos':
        body = (
            f"Hola {nombre},\n\n"
            "Hemos recibido los datos de tu encargo en RevisiónContratos. Si ya has pagado, responde directamente "
            "a este correo adjuntando el contrato en PDF o fotos legibles. Si todavía no has pagado, puedes elegir y "
            "contratar cualquiera de los niveles publicados en https://revisioncontratos.es/precios/.\n\n"
            "Carla Morales revisará personalmente el documento. El plazo empieza cuando se hayan recibido el pago, "
            "los datos y el contrato completo.\n\n"
            "Un saludo,\nEl equipo de RevisiónContratos\n"
        )
    else:
        body = (
            f"Hola {nombre},\n\n"
            "Hemos recibido tu consulta en BurofaxLegal. Carla Morales, abogada colegiada en el Ilustre Colegio de "
            "Abogados de Jerez, revisará personalmente tu caso y te indicará el servicio y presupuesto que correspondan. "
            "El plazo habitual de respuesta es el mismo día laborable o el siguiente.\n\n"
            "Si necesitas añadir algún documento o dato, puedes contestar directamente a este correo.\n\n"
            "Un saludo,\nEl equipo de BurofaxLegal\n"
        )
    send_mail(f'Tu solicitud ha llegado — {site_name}', body, to=email, cc=None)

class H(BaseHTTPRequestHandler):
    server_version = 'intake/1.0'

    def _json(self, code, obj, origin=None):
        data = json.dumps(obj).encode()
        self.send_response(code)
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
        origin = self.headers.get('Origin', '')
        if origin not in ALLOWED_ORIGINS:
            return self._json(403, {'ok': False, 'error': 'origen no permitido'})
        ip = client_ip(self.headers, self.client_address[0])
        now = time.time()
        RATE[ip] = [t for t in RATE[ip] if now - t < WINDOW]
        if len(RATE[ip]) >= LIMIT:
            return self._json(429, {'ok': False, 'error': 'demasiados envíos, inténtalo más tarde'})
        try:
            n = int(self.headers.get('Content-Length', 0))
            if n <= 0 or n > 100_000:
                raise ValueError('longitud')
            d = json.loads(self.rfile.read(n))
        except Exception:
            return self._json(400, {'ok': False, 'error': 'datos no válidos'})

        if d.get('website'):  # honeypot: los bots lo rellenan
            return self._json(200, {'ok': True})  # fingimos éxito

        nombre = str(d.get('nombre', '')).strip()[:120]
        email = str(d.get('email', '')).strip()[:200]
        telefono = str(d.get('telefono', '')).strip()[:40]
        asunto = str(d.get('asunto', '')).strip()
        caso = str(d.get('caso', '')).strip()[:8000]
        web = origin.removeprefix('https://').removeprefix('http://').removeprefix('www.').split(':', 1)[0]

        errs = []
        if len(nombre) < 2: errs.append('nombre')
        if not EMAIL_RE.match(email): errs.append('email')
        if asunto not in VALID_ASUNTOS: errs.append('asunto')
        if len(caso) < 30: errs.append('caso')
        if d.get('privacidad') is not True: errs.append('privacidad')
        if errs:
            return self._json(400, {'ok': False, 'error': 'campos: ' + ', '.join(errs)})

        RATE[ip].append(now)
        site_name = ORIGIN_SITES[origin]
        subject = f'[Nuevo caso {site_name}] {asunto} — {nombre}'
        body = (
            f'Nuevo caso recibido desde {web}\n\n'
            f'Nombre: {nombre}\nEmail: {email}\nTeléfono: {telefono or "(no indicado)"}\n'
            f'Asunto: {asunto}\n\nHistoria:\n{caso}\n\n---\nIP: {ip}\n'
            f'Responder escribiendo a: {email}\n'
        )
        try:
            send_mail(subject, body, reply_to=email, cc=CC)
            confirm_client(email, nombre, site_name)
        except Exception as e:
            print('SMTP ERROR:', e, flush=True)
            return self._json(502, {'ok': False, 'error': 'no se pudo enviar, prueba de nuevo o escribe a abogada@carlamorales.es'})
        print(f'CASO OK {site_name} {asunto} {email}', flush=True)
        return self._json(200, {'ok': True})

    def log_message(self, format, *args):  # noqa: A002 - firma de BaseHTTPRequestHandler
        pass

if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8000), H).serve_forever()
