import {damageEstimate, effectiveCooldown, effectiveness, legalMoves} from './mechanics.js';

export const STRATEGIES = [
 {id:'balanced', name:'Balanced', description:'A mix of damage, quick response and short cooldown.', explanation:'50% normalized damage, 25% response speed, 25% cooldown speed.'},
 {id:'quickest', name:'Quickest', description:'Hit sooner, then recover sooner.', explanation:'Lowest wind-up frames first, then total animation frames, then cooldown.'},
 {id:'damage', name:'Highest Damage', description:'The largest estimated damage per use.', explanation:'Highest direct-hit estimate against this target; cooldown breaks ties.'},
 {id:'sustained', name:'Sustained Damage', description:'Strong damage on a short cooldown.', explanation:'Highest damage / effective cooldown. This is a repeat-use proxy, not simulated DPS; animation and travel are excluded.'},
 {id:'matchup', name:'Best Type Matchups', description:'Prioritize super-effective attacks.', explanation:'Highest type multiplier first, then estimated damage. STAB is included in damage.'}
];

// Do not write inferred inheritance into the imported legal learnsets.
export function suggestionSource(species, roster, learnsets, allowInheritance=false) {
 const own=learnsets[species?.learnsetId];
 if(own?.status==='sourced') return {species, source:own, inherited:false};
 if(!species) return {reason:'Choose a Pokémon to see suggestions.'};
 if(!allowInheritance || !(species.name.startsWith('Mega ') || species.form==='Primal Reversion'))
  return {reason:'No sourced learnset for this form. Mega/Primal base-form comparisons require the optional inheritance setting.'};
 const candidates=roster.filter(p=>p.species===species.species && !p.name.startsWith('Mega ') && p.form!=='Primal Reversion' && learnsets[p.learnsetId]?.status==='sourced');
 const ordinary=candidates.filter(p=>!p.form || p.form===p.species);
 const pool=ordinary.length===1?ordinary:candidates;
 if(pool.length!==1) return {reason:'The base form is ambiguous. Choose a specific non-Mega form to see its sourced moves.'};
 return {species:pool[0], source:learnsets[pool[0].learnsetId], inherited:true};
}

export function suggestMoves({species, roster=[], learnsets, moves, attacker, defender, level=50, allowInheritance=false}) {
 const source=suggestionSource(species,roster,learnsets,allowInheritance);
 const empty=reason=>({...source,reason,rankings:[],eligibleCount:0});
 if(source.reason) return empty(source.reason);
 if(!attacker?.stats || !defender?.stats) return empty('Battle stats are unavailable. Enter valid stats or choose a neutral target.');
 if(!['atk','spa','spe'].every(k=>Number.isFinite(attacker.stats[k])&&attacker.stats[k]>0) || !['def','spd'].every(k=>Number.isFinite(defender.stats[k])&&defender.stats[k]>0) || !Number.isInteger(level)||level<1||level>200)
  return empty('Enter valid Attack, Sp. Atk, Speed, target defenses and a level from 1 to 200.');
 const pool=legalMoves(source.species,learnsets,moves);
 const eligible=[];const seen=new Set();
 for(const move of pool) {
  if(seen.has(move.baseId) || move.crossCheck==='conflict') continue;
  const damage=damageEstimate(move,attacker,defender,level), cooldown=effectiveCooldown(move.cooldown,attacker.stats.spe);
  // One comparable pool across strategies: exclude unknown timings and special-rule damage.
  if(!(damage>0) || !(cooldown>0) || !Number.isFinite(move.windup) || move.windup<0 || !Number.isFinite(move.execution) || move.execution<0 || move.windup+move.execution<=0) continue;
  seen.add(move.baseId);
  eligible.push({move,damage,cooldown,frames:move.windup+move.execution,multiplier:effectiveness(move.type,defender.types),repeatScore:damage/cooldown,stab:attacker.types.includes(move.type)});
 }
 if(!eligible.length) return empty('No modeled damaging moves can hit this target in the sourced pool. Try another opponent.');
 const maxDamage=Math.max(...eligible.map(x=>x.damage));
 const fastest=Math.min(...eligible.map(x=>x.move.windup));const shortestCD=Math.min(...eligible.map(x=>x.cooldown));
 for(const x of eligible) x.balance=.5*x.damage/maxDamage+.25*(fastest+1)/(x.move.windup+1)+.25*shortestCD/x.cooldown;
 const compare={
  balanced:(a,b)=>b.balance-a.balance||b.damage-a.damage,
  quickest:(a,b)=>a.move.windup-b.move.windup||a.frames-b.frames||a.cooldown-b.cooldown,
  damage:(a,b)=>b.damage-a.damage||a.cooldown-b.cooldown,
  sustained:(a,b)=>b.repeatScore-a.repeatScore||a.frames-b.frames,
  matchup:(a,b)=>b.multiplier-a.multiplier||b.damage-a.damage
 };
 return {...source,reason:null,eligibleCount:eligible.length,excludedCount:pool.length-eligible.length,
  rankings:STRATEGIES.map(s=>({...s,moves:[...eligible].sort((a,b)=>compare[s.id](a,b)||a.move.id-b.move.id).slice(0,8)}))};
}
