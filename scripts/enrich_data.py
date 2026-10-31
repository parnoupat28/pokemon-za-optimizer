"""Compare and merge pinned Z-A references. No unverified generic-game learnsets.
python scripts/enrich_data.py [--offline] [--dry-run]
Requires scripts/requirements.txt only for parsing Serebii corroboration pages.
"""
import argparse,copy,datetime,hashlib,json,re,struct,unicodedata,subprocess
from pathlib import Path
from urllib.request import Request,urlopen

ROOT=Path(__file__).resolve().parents[1]
PKHEX='5bfb32305c8af70e5885f6ac0800e50b3867f197'
CATCH='aeae99bc1f4a6bdfffdbad7c5fb11b58905c06e0'
PREFIX=f'https://raw.githubusercontent.com/kwsch/PKHeX/{PKHEX}/PKHeX.Core/'
TYPES=['Normal','Fighting','Flying','Poison','Ground','Rock','Bug','Ghost','Steel','Fire','Water','Grass','Electric','Psychic','Ice','Dragon','Dark','Fairy']
FILES={'personal':'Resources/byte/personal/personal_za','levelup':'Resources/byte/levelup/lvlmove_za.pkl','plusLevels':'Resources/legality/misc/plus_za.pkl','schema':'PersonalInfo/Info/PersonalInfo9ZA.cs','forms':'PKM/Util/Conversion/FormConverter.cs','names':'Resources/text/other/en/text_Species_en.txt','moveInfo':'Moves/MoveInfo9a.cs','moveNames':'Resources/text/other/en/text_Moves_en.txt','learnReader':'Legality/Learnset/LearnsetReader.cs','containerReader':'Legality/Assets/BinLinkerAccessor16.cs','learnSource':'Legality/LearnSource/Sources/LearnSource9ZA.cs','license':'../LICENSE'}
FORM_LABELS={
 'Rotom':['Rotom','Heat Rotom','Wash Rotom','Frost Rotom','Fan Rotom','Mow Rotom'],
 'Vivillon':[s+' Pattern' for s in ['Icy Snow','Polar','Tundra','Continental','Garden','Elegant','Meadow','Modern','Marine','Archipelago','High Plains','Sandstorm','River','Monsoon','Savanna','Sun','Ocean','Jungle','Fancy','Poké Ball']],
 'Furfrou':['Natural Form','Heart Trim','Star Trim','Diamond Trim','Debutante Trim','Matron Trim','Dandy Trim','La Reine Trim','Kabuki Trim','Pharaoh Trim'],
 'Flabébé':['Red Flower','Yellow Flower','Orange Flower','Blue Flower','White Flower'],
 'Florges':['Red Flower','Yellow Flower','Orange Flower','Blue Flower','White Flower'],
 'Floette':['Red Flower','Yellow Flower','Orange Flower','Blue Flower','White Flower','Eternal Flower'],
 'Meowstic':['Male','Female'], 'Indeedee':['Male','Female'],
 'Aegislash':['Shield Forme','Blade Forme'],'Hoopa':['Hoopa Confined','Hoopa Unbound'],
 'Keldeo':['Ordinary Form','Resolute Form'],'Meloetta':['Aria Forme','Pirouette Forme'],
 'Mimikyu':['Disguised Form','Busted Form'],'Morpeko':['Full Belly Mode','Hangry Mode'],
 'Toxtricity':['Amped Form','Low Key Form'],'Gimmighoul':['Chest Form','Roaming Form'],
 'Squawkabilly':['Green Plumage','Blue Plumage','Yellow Plumage','White Plumage'],
 'Tatsugiri':['Curly Form','Droopy Form','Stretchy Form'],
 'Pumpkaboo':['Average Size','Small Size','Large Size','Super Size'],
 'Gourgeist':['Average Size','Small Size','Large Size','Super Size'],
}

def slug(s):
 s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
 return re.sub('[^a-z0-9]+','-',s).strip('-')

def decode_container(raw):
 if len(raw)<6 or raw[:2]!=b'za':raise ValueError('Not a Z-A container')
 count=struct.unpack_from('<H',raw,2)[0]
 header=4+2*(count+1)
 if header>len(raw):raise ValueError('Truncated offset table')
 offsets=struct.unpack_from('<'+'H'*(count+1),raw,4)
 if offsets[0]<header or offsets[-1]>len(raw) or list(offsets)!=sorted(offsets):raise ValueError('Invalid container offsets')
 return [raw[a:b] for a,b in zip(offsets,offsets[1:])]

def decode_levels(raw):
 n=len(raw)//3
 if raw[3*n:] not in [b'',b'\x00']:raise ValueError('Invalid move/level padding')
 return list(zip(struct.unpack_from('<'+'H'*n,raw),raw[2*n:]))

def cs_array(text,name):
 match=re.search(r'\b'+re.escape(name)+r'\s*=>\s*\[(.*?)\];',text,re.S)
 if not match:raise ValueError('Missing C# data array: '+name)
 body=re.sub(r'//[^\n]*','',match[1])
 return [int(v,16) if v.lower().startswith('0x') else int(v) for v in re.findall(r'0x[0-9A-Fa-f]+|\b\d+\b',body)]

class Personal:
 def __init__(self,raw):
  if len(raw)%80:raise ValueError('Invalid personal table size')
  self.records=[raw[i:i+80] for i in range(0,len(raw),80)]
 def get(self,sid,form):
  base=self.records[sid];start=struct.unpack_from('<H',base,24)[0]
  if form<0 or form>=max(1,base[26]):raise ValueError('Form outside declared range')
  index=start+form-1 if form and start else sid
  if form and not start and base[26]>1: # cosmetic forms share species data explicitly
   index=sid
  raw=self.records[index]
  return index,raw

def form_index(p,personal,sid):
 name,form,species=p['name'],p['form'],p['species']
 if name.startswith('Mega '):
  if species=='Meowstic':return {'Male':2,'Female':3}.get(form)
  if species=='Tatsugiri':return 3+FORM_LABELS[species].index(form)
  if species=='Magearna':return 3 if form=='Original Color' else 2
  if species=='Floette':return 6
  if species=='Greninja':return 3
  if species=='Zygarde':return 5
  if species in ['Absol','Garchomp','Lucario']:return 2 if name.endswith(' Z') else 1
  if species=='Raichu':return {'Mega Raichu X':2,'Mega Raichu Y':3}.get(name)
  if name.endswith(' X'):return 1
  if name.endswith(' Y'):return 2
  if name.endswith(' Z'):return 2
  # Single Mega is form 1 only for the explicit species list in FormConverter.
  if species in SINGLE_MEGAS:return 1
  return None
 if form=='Primal Reversion':return 1
 if form in ['Alolan Form','Galarian Form','Hisuian Form']:
  return 2 if (species,form) in [('Meowth','Galarian Form'),('Slowbro','Galarian Form')] else 1
 if species in FORM_LABELS:
  if form in FORM_LABELS[species]:return FORM_LABELS[species].index(form)
  return 0 if not form else None
 if species=='Magearna':return 1 if form=='Original Color' else 0
 if species=='Zygarde':return {'50% Forme':0,'10% Forme':1,'Complete Forme':4}.get(form)
 if species=='Genesect':return {'':0,'Douse Drive':1,'Shock Drive':2,'Burn Drive':3,'Chill Drive':4}.get(form)
 if species=='Pyroar' and form in ['Male','Female']:return 0 # gender is not a personal-table form
 if not form or form==species:return 0
 return None

SINGLE_MEGAS=set('Venusaur Blastoise Alakazam Gengar Kangaskhan Pinsir Gyarados Aerodactyl Ampharos Scizor Heracross Houndoom Tyranitar Blaziken Gardevoir Mawile Aggron Medicham Manectric Banette Latias Latios Abomasnow Beedrill Pidgeot Slowbro Steelix Sceptile Swampert Sableye Sharpedo Camerupt Altaria Glalie Salamence Metagross Rayquaza Lopunny Gallade Audino Diancie Clefable Victreebel Starmie Dragonite Meganium Feraligatr Skarmory Froslass Emboar Excadrill Scolipede Scrafty Eelektross Chandelure Chesnaught Delphox Pyroar Malamar Barbaracle Dragalge Hawlucha Drampa Falinks Chimecho Staraptor Heatran Darkrai Golurk Crabominable Golisopod Zeraora Scovillain Glimmora Baxcalibur'.split())

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--offline',action='store_true');parser.add_argument('--dry-run',action='store_true');parser.add_argument('--recheck',action='store_true',help='Recompare even when the current output fingerprints match');args=parser.parse_args()
 cache=ROOT/'.cache/references';cache.mkdir(parents=True,exist_ok=True);manifest={}
 def fetch(url):
  path=cache/hashlib.sha256(url.encode()).hexdigest()
  if not path.exists():
   if args.offline:raise FileNotFoundError(url)
   with urlopen(Request(url,headers={'User-Agent':'ZA-Battle-Lab/1.0 (database validation)'}),timeout=45) as r:path.write_bytes(r.read())
  raw=path.read_bytes();manifest[url]={'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)};return raw
 def read(name):return json.loads((ROOT/name).read_text())
 # Preserve the original before/after audit on an unchanged repeat run.
 existing=read('data-report.json').get('enrichment',{})
 expected_pins={'PKHeX':PKHEX,'PokeZACatchCalc':CATCH}
 hashes=existing.get('artifactHashes',{})
 if not args.recheck and existing.get('sourceCommits')==expected_pins and hashes and all((ROOT/name).exists() and hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest for name,digest in hashes.items()):
  print('Pinned enrichment already applied; database and original comparison audit unchanged.')
  return
 data={k:fetch((PREFIX+v) if k!='license' else f'https://raw.githubusercontent.com/kwsch/PKHeX/{PKHEX}/LICENSE') for k,v in FILES.items()}
 schema=data['schema'].decode();personal=Personal(data['personal']);levelup=decode_container(data['levelup']);plus=decode_container(data['plusLevels']);tms=cs_array(schema,'MachineMoves');plus_moves=cs_array(schema,'PlusMoves')
 assert len(tms)==160 and len(plus_moves)==340 and len(levelup)==len(personal.records)==len(plus)
 names=data['names'].decode('utf-8-sig').splitlines();name_key=lambda name:''.join(c for c in name.casefold() if c.isalnum())
 name_ids={name_key(n):i for i,n in enumerate(names)}
 move_names=data['moveNames'].decode('utf-8-sig').splitlines();move_types=cs_array(data['moveInfo'].decode(),'Type')
 roster,learnsets,moves,report=map(read,['roster.json','learnsets.json','moves.json','data-report.json'])
 before={'roster':len(roster),'stats':sum(p['stats'] is not None for p in roster),'learnsets':len(learnsets),'moves':len(moves)}
 comparison={'schemaVersion':1,'comparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baselineCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'baselineFileHashes':{name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['roster.json','learnsets.json','moves.json','data-report.json']},'sourceCommits':{'PKHeX':PKHEX,'PokeZACatchCalc':CATCH},'before':before,'retiredRecords':[],'addedRecords':[],'statChecks':[],'learnsetChecks':[],'moveChecks':[],'conflicts':[],'unmapped':[],'acquisitionComparisonNote':'Level 0 and level 1 are compared as starting availability; raw level-zero trigger details remain uncertified.','policy':'Merge Z-A-specific facts by explicit species/form identity. Preserve unresolved disagreements. Complete-game legality and battle optimality are not certified.'}
 # Expand only forms independently defined by the legality table and Serebii size tables.
 for species in ['Pumpkaboo','Gourgeist','Meowstic']:
  candidates=[p for p in roster if (p['species']==species and (not p['form']) and (p['name']==species if species!='Meowstic' else p['name']=='Mega Meowstic'))]
  for old in candidates:
   labels=FORM_LABELS[species] if species!='Meowstic' else ['Male','Female']
   roster.remove(old);comparison['retiredRecords'].append({'id':old['id'],'reason':'Replaced ambiguous form with explicit personal-table forms'})
   for label in labels:
    new=copy.deepcopy(old);new['form']=label;new['id']=slug(new['name']+' '+label);new['learnsetId']=None
    if any(p['id']==new['id'] for p in roster):continue
    roster.append(new);comparison['addedRecords'].append(new['id'])
 # Remove retired, unattached sets, retaining all acquisition evidence in the new form copies.
 retired_sets={r['id']:learnsets.get(r['id']) for r in comparison['retiredRecords']}
 catch_url=f'https://raw.githubusercontent.com/TheFauxDreamer/PokeZACatchCalc/{CATCH}/pokemon-legends-za-data.json'
 catch_records=json.loads(fetch(catch_url))
 assert all(r['data']['speciesGame']['game']['slug']=='legends-z-a' for r in catch_records)
 catch_map={(r['data']['speciesGame']['species']['natID'],r['data']['formInternalID']):r for r in catch_records}
 mapping={};move_ids={m['id'] for m in moves if m['variant']=='base'}
 for p in roster:
  sid=name_ids.get(name_key(p['species']));form=form_index(p,personal,sid) if sid else None
  if form is None:comparison['unmapped'].append({'id':p['id'],'reason':'No reviewed form mapping'});continue
  index,raw=personal.get(sid,form)
  if not raw[28]:comparison['unmapped'].append({'id':p['id'],'reason':'Form not flagged present in Z-A'});continue
  mapping[p['id']]={'nationalDex':sid,'formIndex':form,'personalIndex':index,'identitySource':PREFIX+FILES['forms']}
  p['nationalDex']=sid;p['formIndex']=form;p['personalIndex']=index
  pk_stats=dict(zip(['hp','atk','def','spe','spa','spd'],raw[:6]));pk_types=list(dict.fromkeys([TYPES[raw[6]],TYPES[raw[7]]]))
  sources=list(dict.fromkeys(p.get('statsSources',[p['statsSource']] if p['statsSource'] else [])+[PREFIX+FILES['personal']]))
  stat_check={'id':p['id'],'previous':p['stats'],'pkhex':pk_stats,'result':'matched' if p['stats']==pk_stats else 'added' if p['stats'] is None else 'conflict'}
  catch=catch_map.get((sid,form))
  if catch:
   c=catch['data']['stats'];cstats={k:c[v] for k,v in {'hp':'hp','atk':'attack','def':'defense','spa':'spAttack','spd':'spDefense','spe':'speed'}.items()}
   stat_check['catchCalculator']=cstats
   if cstats==pk_stats:sources.append(catch_url)
   else:comparison['conflicts'].append({'id':p['id'],'field':'stats','source':catch_url,'previous':p['stats'],'candidate':cstats,'resolution':'Retained previous/PKHeX values; calculator disagrees'})
  if p['stats'] is None:p['stats']=pk_stats;p['statsSource']=PREFIX+FILES['personal']
  elif p['stats']!=pk_stats:
   comparison['conflicts'].append({'id':p['id'],'field':'stats','source':PREFIX+FILES['personal'],'previous':p['stats'],'candidate':pk_stats,'resolution':'Retained previous pending review'})
  p['statsSources']=list(dict.fromkeys(sources));p['statsCrossCheck']=stat_check['result'];comparison['statChecks'].append(stat_check)
  if p['types']!=pk_types:comparison['conflicts'].append({'id':p['id'],'field':'types','previous':p['types'],'candidate':pk_types,'resolution':'Retained previous pending review'})
  if any(raw[44+i//8]>>(i%8)&1 for i in range(len(tms),230)):raise ValueError('Unmapped TM permission flags')
  pk_entries=[{'moveId':mid,'method':'Moves available by reminder/evolution' if lev==0 else 'Moves learnt by level up','requirement':None if lev==0 else str(lev),'evidence':['pkhex-levelup']} for mid,lev in decode_levels(levelup[index])]
  pk_entries += [{'moveId':mid,'method':'Moves learnt by TM','requirement':str(i+1),'evidence':['pkhex-tm']} for i,mid in enumerate(tms) if raw[44+i//8]>>(i%8)&1]
  unknown=[e['moveId'] for e in pk_entries if e['moveId'] not in move_ids]
  if unknown:raise ValueError('Unresolved move IDs: '+str(unknown))
  old=learnsets.get(p['learnsetId']) or (retired_sets.get(slug(p['name'])) if p['name'] in ['Pumpkaboo','Gourgeist'] else None)
  previous={e['moveId'] for e in old['entries']} if old else set();newids={e['moveId'] for e in pk_entries}
  only_old=sorted(previous-newids);only_new=sorted(newids-previous)
  external=old and any('pokemondb.net/' in url for url in old.get('sources',[old['source']]))
  lc={'id':p['id'],'result':'matched' if external and not only_old and not only_new else 'expanded' if external else 'unchanged' if old else 'added','previousCount':len(previous),'pkhexCount':len(newids),'onlyPrevious':only_old,'onlyPKHeX':only_new}
  def acquisition_key(e):
   method=e['method'].lower()
   if 'reminder' in method:return (e['moveId'],'level',1)
   if 'evolution' in method:return (e['moveId'],'level',1)
   if 'level up' in method:return (e['moveId'],'level',max(1,int(e['requirement'])))
   if 'tm' in method:return (e['moveId'],'tm',int(e['requirement']))
   return (e['moveId'],method,e['requirement'])
  if external:
   previous_acquisition={acquisition_key(e) for e in old['entries']}
   new_acquisition={acquisition_key(e) for e in pk_entries}
   lc['onlyPreviousAcquisition']=[list(x) for x in sorted(previous_acquisition-new_acquisition)]
   lc['onlyPKHeXAcquisition']=[list(x) for x in sorted(new_acquisition-previous_acquisition)]
  comparison['learnsetChecks'].append(lc)
  evidence={}
  for e in pk_entries:evidence.setdefault(e['moveId'],[]).extend(e['evidence'])
  entries=copy.deepcopy(old['entries']) if old else []
  for e in entries:e['evidence']=list(dict.fromkeys(e.get('evidence',['pokemon-db'] if external else [])+evidence.get(e['moveId'],[])))
  entries += [e for e in pk_entries if e['moveId'] not in previous]
  set_source=old['source'] if old else PREFIX+FILES['levelup']
  plus_levels={str(mid):lev for mid,lev in decode_levels(plus[index]) if mid in newids}
  learnsets[p['id']]={'status':'sourced','complete':False,'source':set_source,'sources':list(dict.fromkeys((old.get('sources',[old['source']]) if old else [])+[PREFIX+FILES['levelup'],PREFIX+FILES['personal']])),'entries':entries,'poolCrossCheck':('matched' if external and not only_old and not only_new else 'partial' if external else 'single-source'),'checkedScope':['move-pool membership (level-up + TM union)'],'plusLevels':plus_levels,'plusLevelSource':PREFIX+FILES['plusLevels'],'note':'Explicit Z-A species/form table; full encounter, pre-evolution and event legality remains outside certification.'}
  p['learnsetId']=p['id']
  if only_old:comparison['conflicts'].append({'id':p['id'],'field':'learnset','onlyPrevious':only_old,'resolution':'Retained sourced prior moves; may involve pre-evolution or special acquisition'})
 for retired in retired_sets:learnsets.pop(retired,None)
 for m in moves:
  if m['variant']=='base':
   pk_type=TYPES[move_types[m['id']]];result='matched' if pk_type==m['type'] else 'conflict'
   comparison['moveChecks'].append({'id':m['id'],'field':'type','result':result})
   if result=='conflict':comparison['conflicts'].append({'id':m['id'],'field':'move type','previous':m['type'],'candidate':pk_type,'resolution':'Retained previous pending review'})
   else:m['sources']=list(dict.fromkeys(m['sources']+[PREFIX+FILES['moveInfo']]))
  if m['variant'] in ['base','plus']:
   m['plusAvailable']=m['baseId'] in plus_moves;m['plusAvailabilitySource']=PREFIX+FILES['schema']
 # Corroborate new size-form stats with named Serebii rows; use only that species' tables.
 from bs4 import BeautifulSoup
 corroborated=[]
 for name in ['Pumpkaboo','Gourgeist','Meowstic']:
  url='https://www.serebii.net/pokedex-sv/'+name.lower()+'/'
  soup=BeautifulSoup(fetch(url),'html.parser');panel=soup.find(id='swshbdsp') or soup
  stat_rows=[]
  for value in panel.find_all(string=lambda v:v and 'Base Stats - Total:' in v):
   row=value.find_parent('tr');cells=row.find_all('td',recursive=False)
   if len(cells)==7:stat_rows.append((row.find_parent('table').find('h2').get_text(' ',strip=True),dict(zip(['hp','atk','def','spa','spd','spe'],[int(c.get_text(strip=True)) for c in cells[1:]]))))
  expected_titles=['Stats','Stats - Small Variety','Stats - Large Variety','Stats - Jumbo Variety'] if name!='Meowstic' else ['Stats','Stats -']
  if [title for title,stats in stat_rows]!=expected_titles:raise ValueError('Unrecognized Serebii form headings: '+name)
  labels=['Average Size','Small Size','Large Size','Super Size'] if name!='Meowstic' else ['Male','Female']
  for label in labels:
   name_wanted='Mega Meowstic' if name=='Meowstic' else name
   p=next(x for x in roster if x['name']==name_wanted and x['form']==label)
   idx=1 if name=='Meowstic' else labels.index(label)
   if idx>=len(stat_rows) or stat_rows[idx][1]!=p['stats']:raise ValueError('Serebii corroboration mismatch: '+p['id'])
   p['statsSources']=list(dict.fromkeys(p['statsSources']+[url]));p['statsCrossCheck']='matched';corroborated.append(p['id'])
 roster.sort(key=lambda p:(p['species'],p['name'],p['form']))
 report['counts'].update(roster=len(roster),stats=sum(p['stats'] is not None for p in roster),learnsets=len(learnsets))
 report['unmatchedForms']=[x for x in report['unmatchedForms'] if x['id'] not in retired_sets]
 report['sources'].update(manifest)
 comparison['after']={'roster':len(roster),'stats':sum(p['stats'] is not None for p in roster),'learnsets':len(learnsets),'moves':len(moves)}
 comparison['summary']={'mappedForms':len(mapping),'matchedStats':sum(x['result']=='matched' for x in comparison['statChecks']),'matchedLearnsetPools':sum(x['result']=='matched' for x in comparison['learnsetChecks']),'addedLearnsetPools':sum(x['result']=='added' for x in comparison['learnsetChecks']),'expandedLearnsetPools':sum(x['result']=='expanded' for x in comparison['learnsetChecks']),'acquisitionDifferences':sum(bool(x.get('onlyPreviousAcquisition') or x.get('onlyPKHeXAcquisition')) for x in comparison['learnsetChecks']),'moveTypesMatched':sum(x['result']=='matched' for x in comparison['moveChecks']),'plusEligibleBaseMoves':len(plus_moves),'plusLevelRecords':sum(len(s.get('plusLevels',{})) for s in learnsets.values()),'corroboratedStats':sum(p.get('statsCrossCheck')=='matched' for p in roster),'serebiiNewFormsCorroborated':len(corroborated),'conflicts':len(comparison['conflicts'])}
 report['counts'].update(crossCheckedStats=comparison['summary']['corroboratedStats'],crossCheckedLearnsets=comparison['summary']['matchedLearnsetPools'],plusLevelRecords=comparison['summary']['plusLevelRecords'])
 report['blockers'][0]='Cross-checked move pools do not certify encounter, pre-evolution, event, Plus acquisition or competitive eligibility. Native form pools are sourced directly rather than inherited.'
 comparison['sources']=manifest
 report['enrichment']={'report':'source-comparison.json','comparedAt':comparison['comparedAt'],'summary':comparison['summary'],'before':comparison['before'],'after':comparison['after'],'sourceCommits':comparison['sourceCommits']}
 outputs={'roster.json':roster,'learnsets.json':learnsets,'moves.json':moves,'data-report.json':report,'source-comparison.json':comparison,'sources/pkhex-form-map.json':mapping}
 report['enrichment']['artifactHashes']={name:hashlib.sha256((json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode()).hexdigest() for name,obj in outputs.items() if name!='data-report.json'}
 if not args.dry_run:
  for name,obj in outputs.items():(ROOT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
 else:(ROOT/'.cache/enrichment-preview.json').write_text(json.dumps(comparison,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:comparison[k] for k in ['before','after','summary','unmapped','conflicts']},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
