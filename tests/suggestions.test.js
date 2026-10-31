import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {suggestMoves,suggestionSource,STRATEGIES} from '../suggestions.js';
const stats={atk:120,spa:100,def:100,spd:100,spe:100};
const species={id:'test',name:'Test',species:'Test',learnsetId:'test',types:['Fire']};
const make=(id,properties={})=>({id,baseId:id,name:`Move ${id}`,variant:'base',type:'Normal',category:'Physical',power:70,windup:10,execution:20,cooldown:7,frameRate:null,crossCheck:'matched',...properties});
const moves=[make(1,{power:400,windup:60,cooldown:20}),make(2,{power:30,windup:0,cooldown:4}),make(3,{power:80,windup:15,cooldown:5}),make(4,{power:50,windup:5,cooldown:7}),make(5,{power:100,type:'Fire',windup:12}),make(6,{power:60,type:'Water',windup:15})];
const learnsets={test:{status:'sourced',complete:false,source:'https://example.com/za',entries:moves.map(m=>({moveId:m.id}))}};
const options={species,roster:[species],learnsets,moves,attacker:{types:['Fire'],stats},defender:{types:['Rock'],stats},level:50};
const ranking=(r,id)=>r.rankings.find(s=>s.id===id).moves;
test('experimental suggestions work from incomplete sourced learnsets without fabricated FPS',()=>{
 const r=suggestMoves(options);assert.equal(r.reason,null);assert.equal(r.rankings.length,5);
 assert.equal(r.eligibleCount,6);assert.equal(learnsets.test.complete,false);
 assert.equal(ranking(r,'quickest')[0].move.id,2);
 assert.equal(ranking(r,'damage')[0].move.id,1);
 assert.equal(ranking(r,'matchup')[0].move.id,6);
 for(const s of r.rankings) assert.equal(new Set(s.moves.map(x=>x.move.baseId)).size,s.moves.length);
 assert.ok(r.rankings.every(s=>s.moves.every(x=>Number.isFinite(x.balance))));
});
test('strategy ordering honors damage, animation, cooldown and matchup metrics',()=>{
 const r=suggestMoves(options);
 const quick=ranking(r,'quickest');assert.deepEqual(quick.map(x=>x.move.windup),[0,5,12,15,15,60]);
 for(const [id,field] of [['balanced','balance'],['damage','damage'],['sustained','repeatScore'],['matchup','multiplier']]){
  const pool=ranking(r,id);assert.ok(pool.every((x,i)=>!i||pool[i-1][field]>=x[field]));
 }
});
test('suggestions exclude unknown timings, conflicts, status, boss and Plus variants',()=>{
 const extras=[make(7,{windup:null}),make(8,{crossCheck:'conflict'}),make(9,{category:'Status'}),make(10,{name:'Body Press'}),make(11,{cooldown:null}),make(1001,{variant:'plus',baseId:1}),make(2001,{variant:'boss',baseId:1})];
 const r=suggestMoves({...options,moves:[...moves,...extras],learnsets:{test:{...learnsets.test,entries:[...learnsets.test.entries,...extras.map(m=>({moveId:m.id}))]}}});
 assert.equal(r.eligibleCount,6);assert.ok(r.rankings.every(s=>s.moves.every(x=>x.move.id<=6)));
});
test('immunity excludes attacks and defender stats affect rankings',()=>{
 const r=suggestMoves({...options,defender:{types:['Ghost'],stats}});
 assert.ok(r.rankings.every(s=>s.moves.every(x=>x.move.type!=='Normal')));
 assert.notEqual(ranking(suggestMoves(options),'damage')[0].damage,ranking(suggestMoves({...options,defender:{types:['Rock'],stats:{...stats,def:200,spd:200}}}),'damage')[0].damage);
});
test('missing or invalid stats never generate recommendations',()=>{
 for(const patch of [{attacker:{types:['Fire'],stats:null}},{attacker:{types:['Fire'],stats:{...stats,spe:NaN}}},{defender:{types:['Normal'],stats:{...stats,def:NaN}}},{level:0},{level:1.5}]){
  const r=suggestMoves({...options,...patch});assert.ok(r.reason);assert.equal(r.rankings.length,0);
 }
 assert.ok(suggestMoves({...options,defender:{types:[],stats:{def:100,spd:100}}}).rankings.length);
});
test('Mega inheritance requires opt-in and an unambiguous base form',()=>{
 const mega={id:'mega-test',name:'Mega Test',species:'Test',learnsetId:null,types:['Fire']};
 assert.ok(suggestionSource(mega,[species,mega],learnsets).reason);
 const r=suggestMoves({...options,species:mega,roster:[species,mega],allowInheritance:true});
 assert.equal(r.inherited,true);assert.equal(r.species.id,'test');assert.equal(r.reason,null);
 assert.equal(mega.learnsetId,null);
 const forms=[{...species,id:'form-a',form:'A'},{...species,id:'form-b',form:'B'}];
 assert.ok(suggestionSource(mega,forms,learnsets,true).reason);
});
test('real roster suggestions use sourced Dragonite moves and no boss/Plus records',()=>{
 const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
 const roster=read('roster.json'),allMoves=read('moves.json'),sets=read('learnsets.json'),dragonite=roster.find(p=>p.id==='dragonite');
 const r=suggestMoves({...options,species:dragonite,roster,learnsets:sets,moves:allMoves,attacker:{...dragonite,stats}});
 assert.equal(r.reason,null);assert.equal(r.rankings.length,STRATEGIES.length);
 const ids=new Set(sets[dragonite.learnsetId].entries.map(e=>e.moveId));
 assert.ok(r.rankings.every(s=>s.moves.every(x=>ids.has(x.move.id)&&x.move.variant==='base')));
});
