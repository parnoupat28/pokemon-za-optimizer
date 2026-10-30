import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {T} from '../mechanics.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const roster=read('roster.json'), moves=read('moves.json'), learnsets=read('learnsets.json'), report=read('data-report.json');
const unique=(list,key)=>assert.equal(new Set(list.map(x=>x[key])).size,list.length,`Duplicate ${key}`);
unique(roster,'id'); unique(moves,'id');
const ids=new Map(moves.map(m=>[m.id,m]));
for(const m of moves){
 assert.ok(['base','plus','boss'].includes(m.variant));
 assert.ok(T[m.type]);assert.ok(['Physical','Special','Status'].includes(m.category));
 assert.ok(m.sources.length&&m.sources.every(s=>s.startsWith('https://')));
 for(const key of ['cooldown','windup','execution','minRange','maxRange','effectiveRange'])assert.ok(m[key]===null||Number.isFinite(m[key])&&m[key]>=0,`${m.name} ${key}`);
 assert.ok(m.minRange<=m.maxRange);
 if(m.variant==='plus')assert.ok(ids.get(m.baseId)?.variant==='base',`Missing base ${m.id}`);
}
for(const p of roster){
 assert.ok(p.types.length>0&&p.types.length<=2&&p.types.every(t=>T[t]));
 assert.ok(p.availabilitySource.startsWith('https://'));
 if(p.stats){assert.deepEqual(Object.keys(p.stats).sort(),['atk','def','hp','spa','spd','spe']);assert.ok(Object.values(p.stats).every(v=>Number.isInteger(v)&&v>0));assert.ok(p.statsSource);}
 if(p.learnsetId)assert.ok(learnsets[p.learnsetId]);
}
for(const [id,set] of Object.entries(learnsets)){
 assert.ok(roster.some(p=>p.id===id));assert.ok(set.source.endsWith('/moves/9#tab-moves-22'));
 assert.equal(set.status,'sourced'); assert.ok(set.entries.length);
 for(const e of set.entries){assert.equal(ids.get(e.moveId)?.variant,'base');assert.ok(e.method);}
}
assert.equal(report.counts.roster,roster.length);assert.equal(report.counts.moves,moves.length);assert.equal(report.counts.learnsets,Object.keys(learnsets).length);
assert.equal(report.counts.stats,roster.filter(p=>p.stats).length);
assert.equal(report.counts.crossCheckedMoves,moves.filter(m=>m.crossCheck==='matched').length);
assert.equal(report.recommendationsEnabled,false);
assert.ok(Object.keys(report.sources).length>700);
console.log(`Validated ${roster.length} roster records, ${moves.length} move variants, ${Object.keys(learnsets).length} learnsets.`);
