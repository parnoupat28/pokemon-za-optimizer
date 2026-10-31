import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const moves=read('moves.json'),sets=read('learnsets.json'),roster=read('roster.json');
const id=name=>moves.find(m=>m.name===name&&m.variant==='base').id;
const has=(form,name)=>sets[form].entries.some(e=>e.moveId===id(name));
test('form-specific source tabs do not leak moves into other forms',()=>{
 assert.ok(has('rotom-heat-rotom','Overheat'));
 assert.ok(!has('rotom-rotom','Overheat'));
 assert.ok(has('raichu-alolan-form','Psychic'));
 assert.ok(sets['meowstic-male'].entries.length!==sets['meowstic-female'].entries.length);
 const light=id('Light of Ruin');
 assert.ok(sets['floette-eternal-flower'].entries.some(e=>e.moveId===light));
 assert.ok(!sets['floette-red-flower'].entries.some(e=>e.moveId===light));
});
test('Mega X/Y/Z and DLC forms retain independent records and stats',()=>{
 for(const name of ['Mega Charizard X','Mega Charizard Y','Mega Raichu X','Mega Raichu Y','Mega Lucario Z','Mega Zygarde','Mega Darkrai','Mega Heatran','Mega Zeraora','Mega Rayquaza'])assert.ok(roster.some(p=>p.name===name&&p.stats),name);
 const x=roster.find(p=>p.name==='Mega Charizard X'),y=roster.find(p=>p.name==='Mega Charizard Y');
 assert.notDeepEqual(x.types,y.types);assert.notDeepEqual(x.stats,y.stats);
 assert.equal(x.learnsetId,x.id);assert.equal(sets[x.learnsetId].poolCrossCheck,'single-source');assert.equal(sets[x.learnsetId].complete,false);
});
test('Plus variants use explicit source values instead of a power multiplier',()=>{
 const base=moves.find(m=>m.name==='Fire Punch'),plus=moves.find(m=>m.id===base.id+1000);
 assert.equal(plus.power,90);assert.equal(base.maxRange,2);assert.equal(plus.maxRange,3);
 assert.ok(moves.some(m=>m.variant==='boss'));
 assert.ok(moves.every(m=>m.frameRate===null));
});
test('Z-A stat overrides replace standard stats for ability-dependent species',()=>{
 for(const [name,attack] of [['Meditite',56],['Medicham',84],['Mega Medicham',140],['Mega Mawile',147]]){
  const p=roster.find(p=>p.name===name&&!p.form);
  assert.equal(p.stats.atk,attack);assert.ok(p.standardStats.atk!==attack);
  assert.ok(p.statsSource.endsWith('/legendsz-a/updatedstats.shtml'));
 }
});

test('size forms have explicit, corroborated stats and separate identities',()=>{
 const sizes=['average','small','large','super'];
 for(const species of ['pumpkaboo','gourgeist']){
  const forms=sizes.map(size=>roster.find(p=>p.id===`${species}-${size}-size`));
  assert.ok(forms.every(p=>p?.stats && p.statsSources.some(url=>url.includes('serebii.net'))));
  assert.equal(new Set(forms.map(p=>p.stats.hp)).size,4);
  assert.equal(new Set(forms.map(p=>p.personalIndex)).size,4);
  assert.ok(!roster.some(p=>p.id===species));
 }
});
test('Mega Meowstic male and female retain distinct native move pools',()=>{
 assert.ok(has('mega-meowstic-male','Wish'));assert.ok(!has('mega-meowstic-female','Wish'));
 assert.ok(has('mega-meowstic-female','Earth Power'));assert.ok(!has('mega-meowstic-male','Earth Power'));
 for(const id of ['mega-meowstic-male','mega-meowstic-female'])assert.equal(sets[id].poolCrossCheck,'single-source');
});
test('Plus natural mastery levels retain pinned form-specific provenance',()=>{
 assert.equal(sets.dragonite.plusLevels['7'],10);
 assert.equal(sets.dragonite.plusLevels['245'],53);
 assert.ok(sets.dragonite.plusLevelSource.includes('/5bfb32305c8af70e5885f6ac0800e50b3867f197/'));
 assert.ok(moves.filter(m=>m.variant!=='boss').every(m=>m.plusAvailable && m.plusAvailabilitySource));
});
test('source comparison retains prior snapshot and reports additions without false timing verification',()=>{
 const audit=read('source-comparison.json');
 assert.equal(audit.before.roster,547);assert.equal(audit.after.roster,554);
 assert.equal(audit.before.learnsets,449);assert.equal(audit.after.learnsets,554);
 assert.equal(audit.summary.matchedLearnsetPools,455);assert.equal(audit.summary.conflicts,0);
 assert.equal(audit.unmapped.length,0);assert.ok(Object.values(audit.sources).every(s=>s.sha256.length===64));
 assert.ok(moves.every(m=>m.frameRate===null));
});
