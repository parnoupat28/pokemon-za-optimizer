"""Apply the explicit Z-A stat-change table, preserving game-specific provenance."""
STAT_KEYS=['hp','atk','def','spa','spd','spe']
def apply_za_stats(roster,page,url):
 applied=[]
 for row in page.select('tr'):
  cells=row.find_all('td',recursive=False)
  if len(cells)!=11 or not cells[0].get_text(strip=True).startswith('#'):continue
  anchor=cells[2].find('a')
  if not anchor:continue
  name=str(next(anchor.strings)).strip()
  values=[int(c.get_text(strip=True)) for c in cells[-6:]]
  matches=[p for p in roster if p['name']==name and not p['form']]
  if len(matches)!=1:raise ValueError('Unresolved stat override: '+name)
  p=matches[0];p['standardStats']=p['stats'];p['stats']=dict(zip(STAT_KEYS,values));p['statsSource']=url
  applied.append({'id':p['id'],'name':name,'stats':p['stats'],'source':url})
 if len(applied)!=4:raise ValueError('Unexpected Z-A stat-change table shape')
 return applied
