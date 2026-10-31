import {T, effectiveness, effectiveCooldown, battleStat, damageEstimate, legalMoves} from './mechanics.js';
import {suggestMoves} from './suggestions.js';
const el = id => document.getElementById(id);
const safe = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge = t => `<span class="type" style="--tc:${T[t]?.[0] || '#666'}"><span class="symbol" aria-hidden="true">${T[t]?.[1] || '●'}</span>${safe(t)}</span>`;
const fmt = (n, suffix = '') => Number.isFinite(n) ? `${Number.isInteger(n) ? n : n.toFixed(2)}${suffix}` : 'Unknown';
let roster=[], moves=[], learnsets={}, report={}, selected={attacker:null,defender:null}, stats={attacker:null,defender:null}, chosen=[null,null,null,null];
const byId = new Map();
let suggestions=null, appliedContext=null;
const alreadyChosen = m => chosen.some(id => byId.get(id)?.baseId === m.baseId);
const estimate = m => damageEstimate(m,{...selected.attacker,stats:stats.attacker},{...selected.defender,stats:stats.defender},+el('level').value);
const comboEstimate = m => comparisonNeutral?damageEstimate(m,{...selected.attacker,stats:stats.attacker},{types:[],stats:{def:100,spd:100}},+el('level').value):estimate(m);
const poolEvidence = set => set?.poolCrossCheck==='matched'?'Pool agrees with Pokémon Database and PKHeX.':set?.plusLevelSource?'PKHeX form-specific pool; second learnset source pending.':'Learnset completeness awaits review.';
const masteryNote = m => {const level=learnsets[selected.attacker?.learnsetId]?.plusLevels?.[String(m.baseId)];return Number.isInteger(level)?`<br><small class="hint">Natural Plus mastery: ${'Lv. '+level} · mastery state unknown</small>`:'';};
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
 comparisonNeutral=el('comparisonTargetSelect').value==='neutral';
 const legal=allowed(), set=learnsets[selected.attacker?.learnsetId];
 el('learnsetStatus').innerHTML=set?`${legal.size} distinct sourced base moves · <a href="${safe(set.source)}">Z-A learnset</a>. ${poolEvidence(set)} Full legality remains uncertified.`:'No form-specific learnset verified. Use “All moves” for reference.';
 renderSuggestions();
 const list=filtered();el('moveSummary').textContent=`${list.length} records shown · source links identify evidence · no claim of set legality`;
 el('moveRows').innerHTML=list.length?list.map(m=>`<tr><td><b>${safe(m.name)}</b><br>${badge(m.type)} <span class="hint">${m.category}</span><br><a class="source" href="${safe(m.sources[0])}">${m.crossCheck==='conflict'?'Source conflict':m.crossCheck==='matched'?'Core fields cross-checked':'Single source'}</a>${masteryNote(m)}</td><td>${safe(m.powerText)}</td><td>${fmt(m.windup,'f')}</td><td>${fmt(m.execution,'f')}</td><td>${fmt(Number.isFinite(m.windup)&&Number.isFinite(m.execution)?m.windup+m.execution:null,'f')}</td><td>${fmt(cd(m),'s')}<br><small class="hint">Base ${fmt(m.cooldown,'s')}</small></td><td>${fmt(m.minRange)} / ${fmt(m.maxRange)} / ${fmt(m.effectiveRange)}</td><td>${m.crossCheck==='conflict'?'Source conflict':estimate(m)===null?'Unmodeled':fmt(estimate(m))}</td><td><button class="secondary" data-add="${m.id}" ${m.variant==='boss'||alreadyChosen(m)||!chosen.includes(null)?'disabled':''} aria-label="Add ${safe(m.name)}">Add</button></td></tr>`).join(''):'<tr><td colspan="9" class="empty">No matching records. Try another filter or select All moves.</td></tr>';
 el('moveRows').querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const i=chosen.indexOf(null);if(i>=0)chosen[i]=+b.dataset.add;render();});
 el('matchup').innerHTML=selected.defender?Object.keys(T).map(t=>`<div class="row" style="justify-content:space-between">${badge(t)}<b>${effectiveness(t,selected.defender.types)}×</b></div>`).join(''):'Choose an opponent.';
 renderCombo();
}
function suggestionContext() {
 return JSON.stringify([selected.attacker?.id,selected.defender?.id,stats,el('level').value,el('recommendTarget').value,el('allowInheritance').checked]);
}
function renderSuggestions() {
 const neutral=el('recommendTarget').value==='neutral';
 const defender=neutral?{types:[],stats:{def:100,spd:100}}:{...selected.defender,stats:stats.defender};
 suggestions=suggestMoves({species:selected.attacker,roster,learnsets,moves,attacker:{...selected.attacker,stats:stats.attacker},defender,level:+el('level').value,allowInheritance:el('allowInheritance').checked});
 const target=neutral?'neutral target (Defense / Sp. Def 100)':selected.defender?selected.defender.name+(selected.defender.form?' · '+selected.defender.form:''):'no opponent selected';
 el('recommendContext').textContent=`${selected.attacker?.name||'No Pokémon selected'}${selected.attacker?.form?' · '+selected.attacker.form:''} → ${target}. Recalculates when stats, level or Pokémon change.`;
 const active=suggestions.rankings.find(s=>s.id===el('strategy').value);
 el('optimize').disabled=!active?.moves.length;
 el('gate').textContent=suggestions.reason||`Use up to four ${active?.name.toLowerCase()} suggestions in the comparison below. You can edit every slot.`;
 el('recommendStatus').innerHTML=suggestions.reason?safe(suggestions.reason):`${suggestions.eligibleCount} modeled attacks ranked · ${suggestions.excludedCount} other sourced moves excluded. <a href="${safe(suggestions.source.source)}">Learnset evidence</a>. ${suggestions.inherited?'<strong>Base-form pool: inheritance is unverified.</strong>':poolEvidence(suggestions.source)+' Full legality remains uncertified.'}`;
 el('recommendations').innerHTML=suggestions.rankings.map(s=>`<article class="recommend-card ${s.id===el('strategy').value?'selected':''}"><h3>${safe(s.name)}</h3><p class="hint">${safe(s.description)}</p><ol>${s.moves.slice(0,4).map(x=>`<li><b>${safe(x.move.name)}</b> ${badge(x.move.type)}<div class="hint">${fmt(x.damage)} damage · ${fmt(x.move.windup)}f wind-up · ${fmt(x.cooldown,'s')} CD</div><small>${fmt(x.multiplier)}× type${x.stab?' · STAB':''}${s.id==='sustained'?' · '+fmt(x.repeatScore)+' damage / CD-second':''}</small></li>`).join('')}</ol><p class="hint">${safe(s.explanation)}</p><button class="secondary" data-suggestion="${s.id}">Use ${safe(s.name)}</button></article>`).join('');
 el('recommendations').querySelectorAll('[data-suggestion]').forEach(b=>b.onclick=()=>applySuggestion(b.dataset.suggestion));
 if(appliedContext && appliedContext!==suggestionContext())el('applyStatus').textContent='Battle setup changed. Suggestions updated; apply a strategy again to replace your comparison.';
}
function applySuggestion(id) {
 const strategy=suggestions?.rankings.find(s=>s.id===id);
 if(!strategy?.moves.length)return;
 chosen=strategy.moves.slice(0,4).map(x=>x.move.id);
 while(chosen.length<4)chosen.push(null);
 el('strategy').value=id;
 // Match the comparison target to the recommendation target without inventing roster records.
 comparisonNeutral=el('recommendTarget').value==='neutral';
 el('comparisonTargetSelect').value=comparisonNeutral?'neutral':'opponent';
 appliedContext=suggestionContext();
 el('applyStatus').textContent=`${strategy.name} suggestions loaded (${strategy.moves.slice(0,4).length} moves). ${suggestions.inherited?'Base-form inheritance is unverified. ':''}Review the experimental comparison below.`;
 render();
 const heading=el('comparisonHeading');
 heading.focus({preventScroll:true});
 heading.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
let comparisonNeutral=false;
function renderCombo() {
 el('comparisonTarget').textContent=comparisonNeutral?'Comparison target: neutral (Defense / Sp. Def 100).':'Comparison target: selected opponent.';
 const legal=allowed(), options=moves.filter(m=>m.variant==='base').sort((a,b)=>a.name.localeCompare(b.name));
 el('slots').innerHTML=chosen.map((id,i)=>`<div><label for="slot${i}">Move ${i+1}</label><select id="slot${i}" data-slot="${i}"><option value="">Choose move</option>${options.map(m=>`<option value="${m.id}" ${id===m.id?'selected':''} ${alreadyChosen(m)&&id!==m.id?'disabled':''}>${safe(m.name)}</option>`).join('')}${id&&byId.get(id)?.variant==='plus'?`<option selected value="${id}">${safe(byId.get(id).name)}</option>`:''}</select><div class="slot-note">${id?legal.has(id)?'In sourced learnset · completeness pending':byId.get(id)?.variant==='plus'?'Plus mastery state unverified':'Learnability unverified':''}</div></div>`).join('');
 el('slots').querySelectorAll('select').forEach(s=>s.onchange=()=>{chosen[+s.dataset.slot]=s.value===''?null:+s.value;render();});
 const active=chosen.map(id=>byId.get(id)).filter(Boolean), allFrames=active.every(m=>Number.isFinite(m.windup)&&Number.isFinite(m.execution)), total=active.reduce((v,m)=>v+m.windup+m.execution,0), damages=active.map(m=>m.crossCheck==='conflict'?null:comboEstimate(m)), cds=active.map(cd);
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
  el('dataStatus').textContent=`Sourced data, review in progress. ${c.roster} species/form records, ${c.moves} move variants (${c.bossMoves} boss-only). Experimental suggestions are available from sourced moves; certified legality and optimality remain unverified.`;
  el('coverage').innerHTML=[['Roster stats',c.stats,c.roster],['Sourced learnsets',c.learnsets,c.roster],['Cross-checked base move fields',c.crossCheckedMoves,c.baseMoves],['Stats corroborated across references',c.crossCheckedStats||0,c.roster],['Move pools matched to prior source',c.crossCheckedLearnsets||0,c.learnsets]].map(([label,n,d])=>`<p>${label}: <b>${n} / ${d}</b></p><div class="coverage"><span style="width:${n/d*100}%"></span></div>`).join('')+`<p class="hint">Imported ${safe(report.importedAt.slice(0,10))}. “Sourced” means traced to the cited reference; independent confirmation is reported separately.</p>`;
  if(report.enrichment){
   const merge=report.enrichment;
   el('coverage').innerHTML+=`<h3>Database merge: before and after</h3><div class="scroll" tabindex="0" aria-label="Database merge comparison"><table id="mergeTable"><thead><tr><th>Coverage</th><th>Previous</th><th>Merged</th></tr></thead><tbody>${[['Pokémon / forms','roster'],['Resolved stat records','stats'],['Sourced move pools','learnsets'],['Move variants','moves']].map(([label,key])=>`<tr><td>${label}</td><td>${merge.before[key]}</td><td>${merge.after[key]}</td></tr>`).join('')}</tbody></table></div><p>${fmt(c.plusLevelRecords)} natural Plus-mastery level records · ${merge.summary.addedLearnsetPools} additional native form pools · ${merge.summary.conflicts} unresolved source conflicts. <a href="./source-comparison.json">Full comparison audit</a> · <a href="./docs/SOURCE_COMPARISON.md">Source notes</a>.</p>`;
  }
  el('issues').innerHTML=report.blockers.map(x=>`<p>${safe(x)}</p>`).join('')+`<p>${report.conflicts.length} move conflicts · ${report.unmatchedForms.length} unresolved stat mappings · ${report.errors.length} import issues. <a href="./data-report.json">View details</a></p>`;
  el('typeFilter').innerHTML='<option value="">All types</option>'+Object.keys(T).map(t=>`<option>${t}</option>`).join('');
  selectPokemon('attacker',true);selectPokemon('defender',true);
 } catch(e) {el('error').classList.add('visible');el('error').textContent='Could not load the database. Reload to retry. '+e.message;el('dataStatus').textContent='Data unavailable; recommendations disabled.';}
}
for(const id of ['moveQ','typeFilter','category','variant','scope','sort','strategy','level','recommendTarget','allowInheritance','comparisonTargetSelect'])el(id).addEventListener('input',render);
for(const [id,side] of [['pokemon','attacker'],['enemy','defender']])el(id).addEventListener('change',()=>pick(side));
for(const [id,side] of [['pokeQ','attacker'],['enemyQ','defender']])el(id).addEventListener('input',()=>selectPokemon(side));
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{el('sort').value=b.dataset.sort;render();});
el('optimize').onclick=()=>applySuggestion(el('strategy').value);
init();
