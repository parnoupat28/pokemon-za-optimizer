import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveness,effectiveCooldown,battleStat,damageEstimate,legalMoves,recommendationGate,optimizeFour} from '../mechanics.js';
const mon=(types,stats={atk:100,spa:200,def:100,spd:200,spe:100})=>({types,stats});
const move={id:1,baseId:1,name:'Tackle',variant:'base',type:'Normal',category:'Physical',power:40,hits:1,windup:10,execution:20,cooldown:7,frameRate:60,crossCheck:'matched'};
test('dual types, resistances and immunities',()=>{
 assert.equal(effectiveness('Ice',['Dragon','Flying']),4);
 assert.equal(effectiveness('Ground',['Electric','Flying']),0);
 assert.equal(effectiveness('Grass',['Fire','Dragon']),.25);
 assert.throws(()=>effectiveness('Unknown',['Normal']));
});
test('Speed cooldown boundaries and floor',()=>{
 assert.equal(effectiveCooldown(8,25),8);
 assert.equal(effectiveCooldown(8,125),5);
 assert.equal(effectiveCooldown(8,225),3);
 assert.equal(effectiveCooldown(3,400),3);
 assert.equal(effectiveCooldown(8,5),8.6);
 assert.equal(effectiveCooldown(null,100),null);
 assert.equal(effectiveCooldown(8,NaN),null);
});
test('actual stat conversion and nature rounding',()=>{
 assert.equal(battleStat(134),154);
 assert.equal(battleStat(91,50,31,0,1,true),166);
 assert.equal(battleStat(134,50,31,252,1.1),204);
 assert.throws(()=>battleStat(100,201));
});
test('damage separates physical/special stats, STAB and immunity',()=>{
 const target=mon(['Normal']);
 assert.equal(damageEstimate(move,mon(['Water']),target),19);
 assert.equal(damageEstimate(move,mon(['Normal']),target),28);
 assert.equal(damageEstimate({...move,category:'Special'},mon(['Water']),target),19);
 assert.equal(damageEstimate(move,mon(['Normal']),mon(['Ghost'])),0);
 assert.equal(damageEstimate({...move,type:'Fighting',power:80},mon(['Fighting']),mon(['Rock','Steel'])),222);
 assert.equal(damageEstimate({...move,name:'Body Press'},mon(['Fighting']),target),null);
 assert.equal(damageEstimate(move,{types:['Normal'],stats:null},target),null);
 assert.equal(damageEstimate({...move,category:'Status'},mon(['Normal']),target),0);
});
test('legal pool never includes Plus or boss variants automatically',()=>{
 const species={learnsetId:'a'},learnsets={a:{status:'sourced',complete:false,entries:[{moveId:1}]}};
 assert.deepEqual(legalMoves(species,learnsets,[move,{...move,id:1001,variant:'plus'},{...move,id:2001,variant:'boss'}]).map(m=>m.id),[1]);
 assert.ok(recommendationGate(species,learnsets,[move]));
 assert.deepEqual(optimizeFour({species,learnsets,moves:[move],strategy:'Burst'}).moves,[]);
});
test('strategy engine uses four unique moves and rejects incomplete timing',()=>{
 const species={learnsetId:'a'},moves=[1,2,3,4,5].map((id)=>({...move,id,baseId:id,power:id*30,windup:id*20}));
 const learnsets={a:{status:'sourced',complete:true,entries:moves.map(m=>({moveId:m.id}))}};
 const options={species,learnsets,moves,attacker:mon(['Normal']),defender:mon(['Normal'])};
 assert.deepEqual(optimizeFour({...options,strategy:'Burst'}).moves.map(m=>m.id),[5,4,3,2]);
 assert.deepEqual(optimizeFour({...options,strategy:'Fastest'}).moves.map(m=>m.id),[1,2,3,4]);
 assert.equal(new Set(optimizeFour({...options,strategy:'Balanced'}).moves.map(m=>m.id)).size,4);
 assert.ok(optimizeFour({...options,strategy:'Sustained DPS'}).moves.length===4);
 assert.ok(recommendationGate(species,learnsets,moves.map(m=>({...m,frameRate:null}))));
});
