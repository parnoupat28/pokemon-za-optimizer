"""Import cited Z-A facts; cache source HTML outside the deployed app.
Run: pip install -r scripts/requirements.txt
     python scripts/import_data.py [--offline]
"""
import concurrent.futures, datetime, hashlib, json, re, sys, time, unicodedata
from pathlib import Path
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup
from stat_overrides import apply_za_stats
ROOT=Path(__file__).resolve().parents[1]; CACHE=ROOT/'.cache/sources'; CACHE.mkdir(parents=True,exist_ok=True)
OFFLINE='--offline' in sys.argv
B='https://bulbapedia.bulbagarden.net/wiki/'
URLS={'moves':B+'List_of_moves_in_Pok%C3%A9mon_Legends%3A_Z-A','lumiose':B+'List_of_Pok%C3%A9mon_by_Lumiose_Pok%C3%A9dex_number','hyperspace':B+'List_of_Pok%C3%A9mon_by_Hyperspace_Pok%C3%A9dex_number','mega':B+'Mega_Evolution_Pok%C3%A9dex','serebii':'https://www.serebii.net/legendsz-a/attacks.shtml','cooldown':B+'Cooldown'}
manifest={}
def fetch(url):
 p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.html')
 if not p.exists():
  if OFFLINE: raise RuntimeError('Missing cache: '+url)
  for attempt in range(3):
   try:
    with urlopen(Request(url,headers={'User-Agent':'ZA-Battle-Lab/1.0 (source validation)'}),timeout=45) as r: data=r.read()
    p.write_bytes(data);break
   except Exception:
    if attempt==2: raise
    time.sleep(1+attempt)
 data=p.read_bytes(); manifest[url]={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)}
 return BeautifulSoup(data,'html.parser')
def txt(e): return e.get_text(' ',strip=True)
def slug(s):
 s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace('♀','-f').replace('♂','-m')
 return re.sub(r'[^a-z0-9]+','-',s).strip('-')
def number(s):
 try:return float(s) if '.' in s else int(s)
 except ValueError:return None
def save(name,data): (ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
# Exact move IDs preserve base/Plus/boss variants without guessing multipliers.
s=fetch(URLS['moves']); table=next(t for t in s.select('table') if t.get('border')=='1' and 'Wind-up' in txt(t))
moves=[]
for row in table.select('tr'):
 cells=row.find_all('td',recursive=False)
 if len(cells)!=12: continue
 v=list(map(txt,cells)); mid=int(v[0]); variant='boss' if mid>=2000 else 'plus' if mid>=1000 else 'base'
 power=re.fullmatch(r'(\d+)(?:\s*×\s*(\d+))?',v[4])
 moves.append({'id':mid,'baseId':mid%1000,'name':v[1].replace(' +','+'),'variant':variant,'type':v[2],'category':v[3], 'power':int(power[1]) if power else None,'hits':int(power[2]) if power and power[2] else 1,'powerText':v[4], 'duration':number(v[5]),'cooldown':number(v[6]),'windup':number(v[7]),'execution':number(v[8]),'minRange':number(v[9]),'maxRange':number(v[10]),'effectiveRange':number(v[11]),'sources':[URLS['moves']], 'crossCheck':'single-source','frameRate':None})
dedup={}
for m in moves:
 if m['id'] in dedup:
  assert dedup[m['id']]==m, 'Conflicting duplicate move ID'
 dedup[m['id']]=m
moves=list(dedup.values())
assert len(moves)>650 and len({m['id'] for m in moves})==len(moves)
# Independently compare base power/type/category/cooldown; conflicts stay visible.
ref=fetch(URLS['serebii']); checks={}; conflicts=[]
for row in ref.select('tr'):
 c=row.find_all('td',recursive=False)
 if len(c)!=6 or not c[0].select_one('a[href*="attackdex"]'):continue
 imgs=[x.get('src','').split('/')[-1].split('.')[0] for x in row.select('img')]
 if len(imgs)!=2:continue
 checks[slug(txt(c[0]))]={'type':imgs[0].title(),'category':{'other':'Status'}.get(imgs[1],imgs[1].title()),'cooldown':number(txt(c[3])),'power':number(txt(c[4]))}
for m in moves:
 if m['variant']!='base':continue
 r=checks.get(slug(m['name']))
 if r:
  mismatch={k:{'bulbapedia':m[k],'serebii':v} for k,v in r.items() if m[k]!=v}
  m['sources'].append(URLS['serebii']);m['crossCheck']='conflict' if mismatch else 'matched'
  if mismatch:conflicts.append({'id':m['id'],'name':m['name'],'fields':mismatch})
# Roster availability from game-specific regional and Mega dex tables.
available={}
for key in ['lumiose','hyperspace','mega']:
 page=fetch(URLS[key])
 table=next(t for t in page.select('table') if any(txt(h)=='Ndex' for h in t.select('th')) and not any(child is not t and any(txt(h)=='Ndex' for h in child.select('th')) for child in t.select('table')))
 spans={}
 for row in table.select('tr'):
  cells=[]; col=0
  for c in row.find_all(['td','th'],recursive=False):
   while col in spans:
    cell,left=spans.pop(col);cells.append(cell)
    if left>1:spans[col]=(cell,left-1)
    col+=1
   for _ in range(int(c.get('colspan',1))):
    cells.append(c)
    if int(c.get('rowspan',1))>1:spans[col]=(c,int(c['rowspan'])-1)
    col+=1
  while col in spans:
   cell,left=spans.pop(col);cells.append(cell)
   if left>1:spans[col]=(cell,left-1)
   col+=1
  if not cells or not re.fullmatch(r'#(?:\d+|—)',txt(cells[0])):continue
  cell=next((c for c in cells if c.name=='td' and c.select_one('a[title$="(Pokémon)"]')),None)
  if cell is None:continue
  a=cell.select_one('a[title$="(Pokémon)"]'); species=a['title'].replace(' (Pokémon)',''); label=txt(cell)
  types=[txt(a) for c in cells for a in c.select('a[title$="(type)"]')]
  if not types:continue
  small=cell.select_one('small'); form=txt(small) if small else ''
  name=txt(a); name=name if name.startswith(('Mega ','Primal ')) else species
  record={'name':name,'species':species,'form':form,'types':list(dict.fromkeys(types)),'availabilitySource':URLS[key],'region':key}
  available[(name,form)]=record
print('Availability records:',len(available),flush=True)
# Match national IDs to Pokémon Database URLs via its game dex cards.
paths={}
for suffix in ['', '/mega-dimension']:
 url='https://pokemondb.net/pokedex/game/legends-z-a'+suffix
 for card in fetch(url).select('.infocard'):
  a=card.select_one('a.ent-name')
  if a:paths[txt(a)]=a['href']
# Event species may be outside either numbered dex; explicitly source availability above.
for p in available.values(): paths.setdefault(p['species'],'/pokedex/'+slug(p['species']))
errors=[]; pages={}
def load_species(item):
 name,path=item; url='https://pokemondb.net'+path
 try:return name,(fetch(url),fetch(url+'/moves/9'),url)
 except Exception as e:return name,str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
 for name,data in pool.map(load_species,paths.items()):
  if isinstance(data,str):errors.append({'species':name,'error':data})
  else:pages[name]=data
print('Species pages:',len(pages),'errors:',len(errors),flush=True)
base_moves={slug(m['name']):m for m in moves if m['variant']=='base'}
roster=[]; learnsets={}; unmatched=[]
STATS={'HP':'hp','Attack':'atk','Defense':'def','Sp. Atk':'spa','Sp. Def':'spd','Speed':'spe'}
def norm(s):return slug(s.replace('Forme','').replace('Form','').replace('Cloak','').replace('Mode','').replace('Standard','').replace('Normal','').replace('Male','').replace('Female','female'))
for p in available.values():
 rid=slug(p['name']+' '+p['form']);p['id']=rid;p['stats']=None;p['statsSource']=None;p['learnsetId']=None
 data=pages.get(p['species'])
 if data:
  page,learn,url=data; candidates=[]
  tabs={a.get('href','')[1:]:txt(a) for a in page.select('a.sv-tabs-tab[href^="#tab-basic-"]')}
  for panel_id,label in tabs.items():
   panel=page.find(id=panel_id)
   if not panel:continue
   stats={}
   for row in panel.select('table.vitals-table tr'):
    h=row.find('th');cell=row.select_one('td.cell-num')
    if h and txt(h) in STATS and cell:stats[STATS[txt(h)]]=int(txt(cell))
   if len(stats)==6:candidates.append((label,stats))
  wanted=p['name'] if p['name'].startswith(('Mega ','Primal ')) else p['species']+' '+p['form']
  if p['form'] in ['Alolan Form','Galarian Form','Hisuian Form']:wanted=p['form'].split()[0]+' '+p['species']
  if p['form']=='Primal Reversion':wanted='Primal '+p['species']
  matches=[c for c in candidates if norm(c[0])==norm(wanted)]
  # Identical-stat cosmetic forms are shared only when all source forms agree.
  if not matches:
   matches=[c for c in candidates if norm(c[0])==norm(p['form']) or norm(c[0])==norm(p['species']+' '+p['form'])]
  if not matches and not p['name'].startswith(('Mega ','Primal ')):
   matches=[c for c in candidates if c[0]==p['species'] and (not p['form'] or any(x in p['form'] for x in ['Flower','Pattern','Natural','Male','Female','Curly','Full Belly','Plumage','Original Color']))]
  if not matches and candidates and len({json.dumps(c[1],sort_keys=True) for c in candidates})==1:matches=candidates[:1]
  if matches:p['stats']=matches[0][1];p['statsSource']=url
  else:unmatched.append({'id':rid,'field':'stats','labels':[c[0] for c in candidates]})
  panel=learn.find(id='tab-moves-22')
  if panel:
   entries=[]; sections=panel.select('h3')
   # Shared tables apply at species scope; nested form tabs must match exactly.
   if not p['name'].startswith(('Mega ','Primal ')) and p['form']!='Primal Reversion':
    form_labels={a.get('href','')[1:]:txt(a) for a in panel.select('a.sv-tabs-tab')}
    identity=matches[0][0] if matches else wanted
    for table in panel.select('table.data-table'):
     subpanel=table.find_parent('div',class_='sv-tabs-panel')
     if subpanel and subpanel.get('id')!='tab-moves-22':
      label=form_labels.get(subpanel.get('id'),'')
      if not label or norm(label)!=norm(identity):continue
     heading=table.find_previous('h3'); method=txt(heading) if heading else 'unknown'
     for row in table.select('tbody tr'):
      a=row.select_one('a.ent-name[href^="/move/"]')
      if not a:continue
      m=base_moves.get(slug(txt(a)))
      if m:
       c=row.find('td');entries.append({'moveId':m['id'],'method':method,'requirement':txt(c) if c and 'cell-num' in c.get('class',[]) else None})
      else:errors.append({'species':p['species'],'unmatchedMove':txt(a)})
    if entries:
     learnsets[rid]={'status':'sourced','complete':False,'source':url+'/moves/9#tab-moves-22','entries':entries,'note':'Z-A section only; shared tables and explicitly matched form tabs. Completeness requires independent review.'};p['learnsetId']=rid
 roster.append(p)
roster.sort(key=lambda p:(p['species'],p['name'],p['form']))
stat_url='https://www.serebii.net/legendsz-a/updatedstats.shtml'
stat_overrides=apply_za_stats(roster,fetch(stat_url),stat_url)
assert len({p['id'] for p in roster})==len(roster)
save('moves.json',moves);save('roster.json',roster);save('learnsets.json',learnsets)
report={'importedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'counts':{'roster':len(roster),'stats':sum(p['stats'] is not None for p in roster),'learnsets':len(learnsets),'moves':len(moves),'baseMoves':sum(m['variant']=='base' for m in moves),'plusMoves':sum(m['variant']=='plus' for m in moves),'bossMoves':sum(m['variant']=='boss' for m in moves),'crossCheckedMoves':sum(m['crossCheck']=='matched' for m in moves)},'recommendationsEnabled':False,'blockers':['Learnset completeness and form-specific inheritance have not been independently verified.','Move table does not identify which records were introduced by DLC.','Frame-to-time conversion is not specified by the move reference; timelines remain in frames.','Special move effects, Plus eligibility and Mega Z mechanics need separate models.'],'statOverrides':stat_overrides,'conflicts':conflicts,'unmatchedForms':unmatched,'errors':errors,'sources':manifest}
save('data-report.json',report)
print(json.dumps({k:v for k,v in report.items() if k not in ['sources','unmatchedForms','errors']},ensure_ascii=False,indent=2))
