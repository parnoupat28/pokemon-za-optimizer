export const T={Normal:['#9199a1','●'],Fire:['#f08030','♨'],Water:['#5399d6','≈'],Electric:['#e7bb39','ϟ'],Grass:['#62b76b','✿'],Ice:['#72c9d3','❄'],Fighting:['#c94c53','✦'],Poison:['#a86ac5','☣'],Ground:['#cba65a','◆'],Flying:['#8f9edb','➤'],Psychic:['#e76b9d','◉'],Bug:['#93ad42','✳'],Rock:['#aa9a60','⬟'],Ghost:['#75669d','☾'],Dragon:['#6878d7','♜'],Dark:['#665e65','◕'],Steel:['#7396a3','⬡'],Fairy:['#df8fc0','✧']};
export const C={Normal:{Rock:.5,Ghost:0,Steel:.5},Fire:{Fire:.5,Water:.5,Grass:2,Ice:2,Bug:2,Rock:.5,Dragon:.5,Steel:2},Water:{Fire:2,Water:.5,Grass:.5,Ground:2,Rock:2,Dragon:.5},Electric:{Water:2,Electric:.5,Grass:.5,Ground:0,Flying:2,Dragon:.5},Grass:{Fire:.5,Water:2,Grass:.5,Poison:.5,Ground:2,Flying:.5,Bug:.5,Rock:2,Dragon:.5,Steel:.5},Ice:{Fire:.5,Water:.5,Grass:2,Ice:.5,Ground:2,Flying:2,Dragon:2,Steel:.5},Fighting:{Normal:2,Ice:2,Poison:.5,Flying:.5,Psychic:.5,Bug:.5,Rock:2,Ghost:0,Dark:2,Steel:2,Fairy:.5},Poison:{Grass:2,Poison:.5,Ground:.5,Rock:.5,Ghost:.5,Steel:0,Fairy:2},Ground:{Fire:2,Electric:2,Grass:.5,Poison:2,Flying:0,Bug:.5,Rock:2,Steel:2},Flying:{Electric:.5,Grass:2,Fighting:2,Bug:2,Rock:.5,Steel:.5},Psychic:{Fighting:2,Poison:2,Psychic:.5,Dark:0,Steel:.5},Bug:{Fire:.5,Grass:2,Fighting:.5,Poison:.5,Flying:.5,Psychic:2,Ghost:.5,Dark:2,Steel:.5,Fairy:.5},Rock:{Fire:2,Ice:2,Fighting:.5,Ground:.5,Flying:2,Bug:2,Steel:.5},Ghost:{Normal:0,Psychic:2,Ghost:2,Dark:.5},Dragon:{Dragon:2,Steel:.5,Fairy:0},Dark:{Fighting:.5,Psychic:2,Ghost:2,Dark:.5,Fairy:.5},Steel:{Fire:.5,Water:.5,Electric:.5,Ice:2,Rock:2,Steel:.5,Fairy:2},Fairy:{Fire:.5,Fighting:2,Poison:.5,Dragon:2,Dark:2,Steel:.5}};

export function effectiveness(type, types) {
  if (!T[type] || !Array.isArray(types) || types.some(t => !T[t])) throw Error('Unknown Pokémon type');
  return types.reduce((v, t) => v * (C[type]?.[t] ?? 1), 1);
}
export function effectiveCooldown(base, speed) {
  if (!Number.isFinite(base) || base < 0 || !Number.isFinite(speed) || speed < 1) return null;
  // Published internal formula, including Speed values below 25.
  return Math.max(3, base - 3 * (speed - 25) / 100);
}
export function battleStat(base, level = 50, iv = 31, ev = 0, nature = 1, hp = false) {
  if (![base, level, iv, ev, nature].every(Number.isFinite) || base < 1 || level < 1 || level > 200 || iv < 0 || iv > 31 || ev < 0 || ev > 252) throw Error('Invalid stat inputs');
  if (hp && base === 1) return 1;
  const v = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100);
  return hp ? v + level + 10 : Math.floor((v + 5) * nature);
}
// Conservative direct-hit estimate. Moves with special damage rules are excluded.
const exceptional = new Set(['Body Press','Foul Play','Psyshock','Psystrike','Secret Sword','Flying Press','Freeze-Dry','Super Fang','Night Shade','Seismic Toss','Dragon Rage','Sonic Boom','Fissure','Guillotine','Horn Drill','Sheer Cold','Counter','Mirror Coat','Metal Burst','Bide','Final Gambit','Endeavor','Nature’s Madness','Nature\'s Madness','Nihil Light']);
export function damageEstimate(move, attacker, defender, level = 50) {
  if (!Number.isFinite(level) || level < 1 || level > 200) return null;
  if (move.category === 'Status') return 0;
  if (!attacker?.stats || !defender?.stats || !Number.isFinite(move.power) || exceptional.has(move.name.replace(/\+$/, '')) || move.variant === 'boss') return null;
  const attack = move.category === 'Physical' ? attacker.stats.atk : attacker.stats.spa;
  const defense = move.category === 'Physical' ? defender.stats.def : defender.stats.spd;
  if (!Number.isFinite(attack) || !Number.isFinite(defense) || attack < 1 || defense < 1) return null;
  const mult = effectiveness(move.type, defender.types) * (attacker.types.includes(move.type) ? 1.5 : 1);
  if (mult === 0) return 0;
  const base = Math.floor(Math.floor((Math.floor(2 * level / 5) + 2) * move.power * attack / defense) / 50) + 2;
  return Math.max(1, Math.floor(base * mult)) * (move.hits || 1);
}
export function legalMoves(species, learnsets, moves) {
  const set = learnsets[species?.learnsetId];
  if (!set || set.status !== 'sourced') return [];
  const ids = new Set(set.entries.map(e => e.moveId));
  return moves.filter(m => m.variant === 'base' && ids.has(m.id));
}
export function recommendationGate(species, learnsets, moves) {
  const set = learnsets[species?.learnsetId];
  if (!set?.complete) return 'Recommendations locked: learnset completeness or form inheritance needs independent verification.';
  const pool = legalMoves(species, learnsets, moves);
  if (pool.length < 4) return 'Fewer than four sourced legal moves.';
  if (pool.some(m => m.crossCheck === 'conflict' || !m.frameRate || !Number.isFinite(m.windup) || !Number.isFinite(m.execution) || !Number.isFinite(m.cooldown))) return 'Recommendations locked: conflicting or incomplete move timing data.';
  return null;
}
// Strategy scores are explicit approximations; never a claim of in-game optimality.
export function optimizeFour({species, learnsets, moves, attacker, defender, strategy, level = 50}) {
  const reason = recommendationGate(species, learnsets, moves);
  if (reason) return {reason, moves: []};
  if (!['Balanced', 'Burst', 'Sustained DPS', 'Fastest'].includes(strategy)) throw Error('Unknown strategy');
  const pool = legalMoves(species, learnsets, moves).map(m => {
    const damage = damageEstimate(m, attacker, defender, level);
    const duration = (m.windup + m.execution) / m.frameRate;
    const cooldown = effectiveCooldown(m.cooldown, attacker.stats.spe);
    return {m, damage, duration, dps: damage / (duration + cooldown)};
  }).filter(x => x.damage > 0 && x.duration > 0);
  if (pool.length < 4) return {reason: 'Fewer than four modeled damaging moves.', moves: []};
  const maxDamage = Math.max(...pool.map(x => x.damage)), maxDps = Math.max(...pool.map(x => x.dps));
  for (const x of pool) x.score = strategy === 'Burst' ? x.damage : strategy === 'Sustained DPS' ? x.dps : strategy === 'Fastest' ? -x.duration : x.damage / maxDamage * .5 + x.dps / maxDps * .5;
  pool.sort((a,b) => b.score - a.score || a.m.id - b.m.id);
  return {reason: null, moves: pool.slice(0,4).map(x => x.m), label: 'Model comparison; effects, movement and scheduling are excluded.'};
}
