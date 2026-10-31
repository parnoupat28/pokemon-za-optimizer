"""Browser interactions and iPad-sized WebKit smoke tests.
Run: python -m pip install playwright && python -m playwright install --with-deps chromium webkit
     python tests/browser_smoke.py
"""
import contextlib, http.server, json, threading, os
from pathlib import Path
from functools import partial
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}'
results=[]
with sync_playwright() as p:
 for engine,device in [('chromium',None),('webkit','iPad (gen 7)'),('webkit','iPhone 13')]:
  launch_options={'headless':True}
  if engine=='webkit' and os.environ.get('ZA_WEBKIT_EXECUTABLE'):launch_options['executable_path']=os.environ['ZA_WEBKIT_EXECUTABLE']
  browser=getattr(p,engine).launch(**launch_options)
  context=browser.new_context(**(p.devices[device] if device else {'viewport':{'width':1440,'height':1000}}))
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url);page.wait_for_function("document.getElementById('countP').textContent !== '—'")
  assert page.locator('#error').is_hidden()
  assert page.locator('#mergeTable tbody tr').count()==4
  assert '547' in page.locator('#mergeTable').inner_text()
  assert '554' in page.locator('#mergeTable').inner_text()
  assert page.locator('#optimize').is_enabled()
  assert page.locator('#recommendations article').count()==5
  assert page.locator('#moveRows tr').count()>20
  assert page.locator('#slots select').count()==4
  page.locator('[data-suggestion="quickest"]').click()
  quick=[page.locator(f'#slot{i}').input_value() for i in range(4)]
  assert len(set(quick))==4
  page.locator('[data-suggestion="damage"]').click()
  high=[page.locator(f'#slot{i}').input_value() for i in range(4)]
  assert high!=quick
  page.locator('#recommendTarget').select_option('neutral')
  balanced=page.locator('.recommend-card').filter(has=page.locator('[data-suggestion="balanced"]'))
  expected=sum(float(t.split()[0]) for t in balanced.locator('li div.hint').all_text_contents())
  page.locator('[data-suggestion="balanced"]').click()
  assert float(page.locator('#burstTotal').inner_text())==expected
  assert page.locator('#comparisonTargetSelect').input_value()=='neutral'
  assert 'neutral' in page.locator('#comparisonTarget').inner_text()
  page.locator('#recommendTarget').select_option('opponent')
  page.locator('#comparisonTargetSelect').select_option('opponent')
  for i in range(4):page.locator(f'#slot{i}').select_option('')
  page.locator('#pokeQ').fill('Mega Darkrai');page.locator('#pokemon').select_option('mega-darkrai')
  assert page.locator('#attacker-spa').count()==1
  assert page.locator('#optimize').is_enabled()
  assert page.locator('#recommendations article').count()==5
  assert 'PKHeX form-specific pool' in page.locator('#recommendStatus').inner_text()
  assert not page.locator('#allowInheritance').is_checked()
  page.locator('#pokeQ').fill('Pumpkaboo')
  assert page.locator('#pokemon option').count()==4
  page.locator('#pokemon').select_option('pumpkaboo-small-size')
  assert page.locator('#attacker-hp').input_value()=='119'
  page.locator('#pokeQ').fill('Dragonite');page.locator('#pokemon').select_option('dragonite')
  # Source-scoped Dragonite moves and category stat sensitivity.
  page.locator('#moveQ').fill('Dragon Claw');assert page.locator('#moveRows button[data-add]').count()==1
  page.locator('#moveRows button[data-add]').click();assert 'Dragon Claw' in page.locator('#timeline').inner_text()
  before=page.locator('#burstTotal').inner_text();page.locator('#attacker-atk').fill('500');assert page.locator('#burstTotal').inner_text()!=before
  page.locator('#level').fill('200');assert page.locator('#level').evaluate('(e)=>e.validity.valid')
  page.locator('#level').fill('50')
  page.locator('#slot1').select_option('7');assert 'learnability unverified' not in page.locator('#slots').inner_text().lower() # Dragonite learns Fire Punch
  # Duplicate move option disabled in another slot.
  assert page.locator('#slot2 option[value="7"]').is_disabled()
  page.locator('#moveQ').fill('no-such-move-zz');assert 'No matching records' in page.locator('#moveRows').inner_text()
  page.locator('#pokeQ').fill('no-such-pokemon-zz');assert page.locator('#pokemon option').count()==0
  assert page.locator('#optimize').is_disabled()
  page.locator('#pokeQ').fill('Dragonite');page.locator('#pokemon').select_option('dragonite')
  page.locator('#moveQ').fill('');page.locator('#scope').select_option('all');page.locator('#variant').select_option('boss')
  assert page.locator('#moveRows button[data-add]:enabled').count()==0
  page.locator('#variant').select_option('plus');assert page.locator('#moveRows tr').count()==340
  assert page.locator('#moveRows button[data-add="1007"]').is_disabled()
  assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+1')
  page.screenshot(path=str(ROOT/'test-results'/f'{engine}-{device or "desktop"}.png'),full_page=True,scale='css')
  assert not errors, errors
  # Fail one data resource and verify safe failure presentation.
  page.route('**/learnsets.json',lambda route:route.fulfill(status=503,body='Unavailable'))
  page.reload();page.wait_for_selector('#error.visible');assert page.locator('#optimize').is_disabled()
  assert not errors,errors
  results.append({'engine':engine,'device':device or 'desktop','errors':errors,'passed':True})
  context.close();browser.close()
server.shutdown()
print(json.dumps(results,indent=2))
