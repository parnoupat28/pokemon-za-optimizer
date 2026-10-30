import {T, effectiveness, effectiveCooldown, battleStat, damageEstimate, legalMoves, recommendationGate, optimizeFour} from './mechanics.js';
const el = id => document.getElementById(id);
const safe = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge = t => `<span class="type" style="--tc:${T[t]?.[0] || '#666'}"><span class="symbol" aria-hidden="true">${T[t]?.[1] || '●'}</span>${safe(t)}</span>`;
const fmt = (n, suffix = '') => Number.isFinite(n) ? `${Number.isInteger(n) ? n : n.toFixed(2)}${suffix}` : 'Unknown';
let roster=[], moves=[], learnsets={}, report={}, selected={attacker:null,defender:null}, stats={attacker:null,defender:null}, chosen=[null,null,null,null];
const byId = new Map();
const alreadyChosen = m => chosen.some(id => byId.get(id)?.baseId === m.baseId);
const estimate = m => damageEstimate(m,{...selected.attacker,stats:stats.attacker},{...selected.defender,stats:stats.defender},+el('level').value);
const cd = m => effectiveCooldown(m.cooldown,stats.attacker?.spe);
function selectPokemon(side, reset=false) {
 const prefix=side==='attacker'?'poke':'enemy', select=el(side==='attacker'?'pokemon':'enemy'), q=el(`${prefix}Q`).value.toLowerCase();
 const old=select.value;
 select.innerHTML=roster.filter(p=>(p.name+' '+p.form).toLowerCase().includes(q)).map(p=>`<option value="${p.id}">${safe(p.name+(p.form?' · '+p.form:''))}${p.stats?'':' · stats unavailable'}</option>`).join('');
 if ([...select.options].some(o=>o.value===old)) select.value=old;
 else if (reset) {const p=roster.find(p=>p.name===(side==='attacker'?'Dragonite':'Garchomp')&&!p.form);if(p)select.value=p.id;}
 pick(side);
}
function pick(side) {
 const p=roster.find(p=>p.id===el(side==='attacker'?'pokemon':'enemy').value)||null;
 selected[side]=p; stats[side]=p?.stats?Object.fromEntries(Object.entries(p.stats).map(([k,v])=>[k,battleStat(v,50,31,0,1,k==='hp')])):null;
 const info=el(side==='attacker'?'pokeInfo':'enemyInfo');
 info.innerHTML=p?p.types.map(badge).join('')+`<a class="source" href="${safe(p.availabilitySource)}">Form source</a>`:'<p>No Pokémon match your search.</p>';
 el(side+'Stats').innerHTML=p?.stats?Object.entries(stats[side]).map(([k,v])=>`<div><label for="${side}-${k}">${{hp:'HP',atk:'Attack',def:'Defense',spa:'Sp. Atk',spd:'Sp. Def',spe:'Speed'}[k]}</label><input id="${side}-${k}" data-stat="${k}" type="number" min="1" max="9999" value="${v}"></div>`).join(''):'<p class="hint">Stats unavailable; damage estimates are disabled.</p>';
 el(side+'Stats').querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{stats[side][input.dataset.stat]=input.validity.valid&&input.value!==''?+input.value:NaN;render();}));
 render();
}
function allowed() {return new Set(legalMoves(selected.attacker,learnsets,moves).map(m=>m.id));}
function filtered() {
 const legal=allowed(), q=el('moveQ').value.toLowerCase();
 const list=moves.filter(m=>m.name.toLowerCase().includes(q)&&(!el('typeFilter').value||m.type===el('typeFilter').value)&&(!el('category').value||m.category===el('category').value)&&(!el('variant').value||m.variant===el('variant').value)&&(el('scope').value==='all'||legal.has(m.baseId)&&m.variant!=='boss'));
 const key=el('sort').value;
 const val=m=>key==='total'?(Number.isFinite(m.windup)&&Number.isFinite(m.execution)?m.windup+m.execution:null):key==='damage'?estimate(m):key==='cooldown'?cd(m):m[key];
 return list.sort((a,b)=>{if(key==='name')return a.name.localeCompare(b.name);const x=val(a),y=val(b);if(x==null)return y==null?0:1;if(y==null)return -1;return (x-y)*(['damage','power'].includes(key)?-1:1)||a.id-b.id;});
}
function render() {
 const legal=allowed(), set=learnsets[selected.attacker?.learnsetId];
 el('learnsetStatus').innerHTML=set?`${legal.size} distinct sourced base moves · <a href="${safe(set.source)}">Z-A learnset</a>. Completeness awaits independent review.`:'No form-specific learnset verified. Use “All moves” for reference.';
 const gate=recommendationGate(selected.attacker,learnsets,moves);el('gate').textContent=gate||'Available as a limited model comparison.';el('optimize').disabled=!!gate;
 const list=filtered();el('moveSummary').textContent=`${list.length} records shown · source links identify evidence · no claim of set legality`;
 el('moveRows').innerHTML=list.length?list.map(m=>`<tr><td><b>${safe(m.name)}</b><br>${badge(m.type)} <span class="hint">${m.category}</span><br><a class="source" href="${safe(m.sources[0])}">${m.crossCheck==='conflict'?'Source conflict':m.crossCheck==='matched'?'Core fields cross-checked':'Single source'}</a></td><td>${safe(m.powerText)}</td><td>${fmt(m.windup,'f')}</td><td>${fmt(m.execution,'f')}</td><td>${fmt(Number.isFinite(m.windup)&&Number.isFinite(m.execution)?m.windup+m.execution:null,'f')}</td><td>${fmt(cd(m),'s')}<br><small class="hint">Base ${fmt(m.cooldown,'s')}</small></td><td>${fmt(m.minRange)} / ${fmt(m.maxRange)} / ${fmt(m.effectiveRange)}</td><td>${m.crossCheck==='conflict'?'Source conflict':estimate(m)===null?'Unmodeled':fmt(estimate(m))}</td><td><button class="secondary" data-add="${m.id}" ${m.variant==='boss'||alreadyChosen(m)||!chosen.includes(null)?'disabled':''} aria-label="Add ${safe(m.name)}">Add</button></td></tr>`).join(''):'<tr><td colspan="9" class="empty">No matching records. Try another filter or select All moves.</td></tr>';
 el('moveRows').querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const i=chosen.indexOf(null);if(i>=0)chosen[i]=+b.dataset.add;render();});
 el('matchup').innerHTML=selected.defender?Object.keys(T).map(t=>`<div class="row" style="justify-content:space-between">${badge(t)}<b>${effectiveness(t,selected.defender.types)}×</b></div>`).join(''):'Choose an opponent.';
 renderCombo();
}
function renderCombo() {
 const legal=allowed(), options=moves.filter(m=>m.variant==='base').sort((a,b)=>a.name.localeCompare(b.name));
 el('slots').innerHTML=chosen.map((id,i)=>`<div><label for="slot${i}">Move ${i+1}</label><select id="slot${i}" data-slot="${i}"><option value="">Choose move</option>${options.map(m=>`<option value="${m.id}" ${id===m.id?'selected':''} ${alreadyChosen(m)&&id!==m.id?'disabled':''}>${safe(m.name)}</option>`).join('')}${id&&byId.get(id)?.variant==='plus'?`<option selected value="${id}">${safe(byId.get(id).name)}</option>`:''}</select><div class="slot-note">${id?legal.has(id)?'In sourced learnset · completeness pending':byId.get(id)?.variant==='plus'?'Plus unlock unverified':'Learnability unverified':''}</div></div>`).join('');
 el('slots').querySelectorAll('select').forEach(s=>s.onchange=()=>{chosen[+s.dataset.slot]=s.value===''?null:+s.value;render();});
 const active=chosen.map(id=>byId.get(id)).filter(Boolean), allFrames=active.every(m=>Number.isFinite(m.windup)&&Number.isFinite(m.execution)), total=active.reduce((v,m)=>v+m.windup+m.execution,0), damages=active.map(m=>m.crossCheck==='conflict'?null:estimate(m)), cds=active.map(cd);
 el('animTotal').textContent=active.length&&allFrames?fmt(total,'f'):'—';el('windTotal').textContent=active.length&&allFrames?fmt(active.reduce((v,m)=>v+m.windup,0),'f'):'—';
 el('burstTotal').textContent=active.length?damages.every(Number.isFinite)?fmt(damages.reduce((a,b)=>a+b,0)):'Unmodeled':'—';el('cdMax').textContent=active.length&&cds.every(Number.isFinite)?fmt(Math.max(...cds),'s'):'—';
 let offset=0;
 el('timeline').innerHTML=active.map(m=>{const start=offset;offset+=m.windup+m.execution;return `<div><small>${safe(m.name)} · ${fmt(m.windup)} + ${fmt(m.execution)} frames</small><div class="track" role="img" aria-label="${safe(m.name)}: starts at frame ${start}, wind-up ${m.windup}, execution ${m.execution}"><span style="width:${total?start/total*100:0}%"></span><span class="wind" style="width:${total?m.windup/total*100:0}%"></span><span class="exec" style="width:${total?m.execution/total*100:0}%"></span></div></div>`;}).join('')||'<p class="hint">Choose up to four unique moves to compare their frame commitments.</p>';
 for (const [target,values,unit] of [['damageChart',damages,''],['cooldownChart',cds,'s']]) {
  const max=Math.max(1,...values.filter(Number.isFinite));
  el(target).innerHTML=active.map((m,i)=>`<div style="margin:12px 0"><div class="row" style="justify-content:space-between"><span>${safe(m.name)}</span><b>${values[i]===null?'Unmodeled':fmt(values[i],unit)}</b></div><div class="scorebar" role="img" aria-label="${safe(m.name)} ${fmt(values[i],unit)}"><span style="width:${Number.isFinite(values[i])?100*values[i]/max:0}%"></span></div></div>`).join('');
 }
}
async function init() {
 try {
  [roster,moves,learnsets,report]=await Promise.all(['roster.json','moves.json','learnsets.json','data-report.json'].map(async path=>{const r=await fetch('./'+path);if(!r.ok)throw Error(`${path}: HTTP ${r.status}`);return r.json();}));
  if(!Array.isArray(roster)||!roster.length||!Array.isArray(moves)||!moves.length||!report.counts)throw Error('Invalid database shape');
  moves.forEach(m=>byId.set(m.id,m));
  const c=report.counts;el('countP').textContent=c.roster;el('countM').textContent=`${c.baseMoves} + ${c.plusMoves}`;el('countL').textContent=c.learnsets;el('countV').textContent=c.crossCheckedMoves;
  el('dataStatus').textContent=`Sourced data, review in progress. ${c.roster} species/form records, ${c.moves} move variants (${c.bossMoves} boss-only). Recommendations remain locked while learnset completeness and timing assumptions are unresolved.`;
  el('coverage').innerHTML=[['Roster stats',c.stats,c.roster],['Sourced learnsets',c.learnsets,c.roster],['Cross-checked base move fields',c.crossCheckedMoves,c.baseMoves]].map(([label,n,d])=>`<p>${label}: <b>${n} / ${d}</b></p><div class="coverage"><span style="width:${n/d*100}%"></span></div>`).join('')+`<p class="hint">Imported ${safe(report.importedAt.slice(0,10))}. “Sourced” means traced to the cited reference; independent confirmation is reported separately.</p>`;
  el('issues').innerHTML=report.blockers.map(x=>`<p>${safe(x)}</p>`).join('')+`<p>${report.conflicts.length} move conflicts · ${report.unmatchedForms.length} unresolved stat mappings · ${report.errors.length} import issues. <a href="./data-report.json">View details</a></p>`;
  el('typeFilter').innerHTML='<option value="">All types</option>'+Object.keys(T).map(t=>`<option>${t}</option>`).join('');
  selectPokemon('attacker',true);selectPokemon('defender',true);
 } catch(e) {el('error').classList.add('visible');el('error').textContent='Could not load the database. Reload to retry. '+e.message;el('dataStatus').textContent='Data unavailable; recommendations disabled.';}
}
for(const id of ['moveQ','typeFilter','category','variant','scope','sort','strategy','level'])el(id).addEventListener('input',render);
for(const [id,side] of [['pokemon','attacker'],['enemy','defender']])el(id).addEventListener('change',()=>pick(side));
for(const [id,side] of [['pokeQ','attacker'],['enemyQ','defender']])el(id).addEventListener('input',()=>selectPokemon(side));
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{el('sort').value=b.dataset.sort;render();});
el('optimize').onclick=()=>{const result=optimizeFour({species:selected.attacker,learnsets,moves,attacker:{...selected.attacker,stats:stats.attacker},defender:{...selected.defender,stats:stats.defender},strategy:el('strategy').value,level:+el('level').value});if(result.reason)el('gate').textContent=result.reason;else{chosen=result.moves.map(m=>m.id);render();}};
init();
