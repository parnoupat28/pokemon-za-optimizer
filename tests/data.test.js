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
 for(const name of ['Mega Charizard X','Mega Charizard Y','Mega Raichu X','Mega Raichu Y','Mega Lucario Z','Mega Zygarde'])assert.ok(roster.some(p=>p.name===name&&p.stats),name);
 const x=roster.find(p=>p.name==='Mega Charizard X'),y=roster.find(p=>p.name==='Mega Charizard Y');
 assert.notDeepEqual(x.types,y.types);assert.notDeepEqual(x.stats,y.stats);
 assert.equal(x.learnsetId,null);
});
test('Plus variants use explicit source values instead of a power multiplier',()=>{
 const base=moves.find(m=>m.name==='Fire Punch'),plus=moves.find(m=>m.id===base.id+1000);
 assert.equal(plus.power,90);assert.equal(base.maxRange,2);assert.equal(plus.maxRange,3);
 assert.ok(moves.some(m=>m.variant==='boss'));
 assert.ok(moves.every(m=>m.frameRate===null));
});
