import urllib.request,urllib.error,json,re
from pathlib import Path
import os
out=Path(__file__).resolve().parents[1]/'.impeccable/review'
results=[]
for host in ['burofaxlegal.es','revisioncontratos.es']:
 def get(p):
  req=urllib.request.Request(os.environ.get('BF_QA_URL','http://127.0.0.1:18123')+p,headers={'Host':host})
  with urllib.request.urlopen(req) as r:return r.status,dict(r.headers),r.read()
 status,headers,body=get('/')
 assert status==200 and b'index,follow' in body and ('site-'+host.split('.')[0]).encode() in body
 assert 'https://intake.marcospera.com' in headers['Content-Security-Policy']
 status,_,form=get('/cuenta-tu-caso/');assert b'id="intake"' in form
 status,_,portrait=get('/assets/carla-morales.png');assert portrait.startswith(b'\x89PNG\r\n\x1a\n')
if host=='burofaxlegal.es':
 class NoRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,*a,**k): return None
 try:
  urllib.request.build_opener(NoRedirect).open(urllib.request.Request(os.environ.get('BF_QA_URL','http://127.0.0.1:18123')+'/precios/',headers={'Host':host}))
  raise AssertionError('/precios/ no redirige en burofaxlegal.es')
 except urllib.error.HTTPError as error:
  assert error.code==301 and error.headers.get('Location','').rstrip('/').endswith('/cuenta-tu-caso'),(error.code,error.headers)
 count=0
else:
 _,_,prices=get('/precios/');count=len(re.findall(b'<article class="precio-card',prices));assert count==3
 css='burofax.css' if host=='burofaxlegal.es' else 'styles.css'
 assert get('/assets/'+css)[0]==200
 for font in ['bf-bodoni.ttf','bf-public-sans.ttf','bf-public-sans-semibold.ttf']:assert get('/assets/fonts/'+font)[0]==200
 for internal in ['/PRODUCT.md','/DESIGN.md','/.impeccable/design.json','/.impeccable/surfaces/build-mjs.md']:
  try:
   get(internal);raise AssertionError('development metadata publicly served: '+internal)
  except urllib.error.HTTPError as error:assert error.code==404
 results.append({'host':host,'home':200,'intake':200,'portraitPNG':True,'priceCards':count,'CSPIntake':True,'assets':True,'robots':'index,follow'})
(out/'docker-e2e.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
