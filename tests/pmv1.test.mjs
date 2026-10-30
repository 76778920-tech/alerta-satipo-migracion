import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {evaluatePmv1,validatePmv1} from '../backend/domain/pmv1.mjs';
import {evaluatePmv1 as browserEvaluate} from '../frontend/src/domain/pmv1.mjs';
import {Pmv1Service} from '../frontend/src/application/use-cases/pmv1-service.mjs';
const example=()=>({id:'11111111-1111-4111-8111-111111111111',node_id:'22222222-2222-4222-8222-222222222222',source:'simulation',observed_at:'2026-10-26T15:00:00Z',values:{temperature_c:52,humidity_pct:25,smoke_index:85,gas_index:82,dust_ugm3:260}});
test('PMV1: cinco variables y rangos obligatorios, tres clases y paridad sklearn/navegador',async()=>{
  const fixtures=JSON.parse(await readFile('colab/pmv1/parity.json','utf8'));
  const labels=['Normal','Advertencia','Emergencia'],features=Object.keys(example().values);
  for(const fixture of fixtures){const input=example();input.values=Object.fromEntries(features.map((k,i)=>[k,fixture.x[i]]));const result=evaluatePmv1(input);assert.equal(result.prediction.level,labels[fixture.expected]);assert.deepEqual(result,browserEvaluate(input));}
  for(const key of features){const input=example();delete input.values[key];assert.throws(()=>validatePmv1(input));}
  for(const value of [-21,81,NaN,Infinity,null,'25']){const input=example();input.values.temperature_c=value;assert.throws(()=>validatePmv1(input));}
  assert.equal(evaluatePmv1(example()).prediction.level,'Emergencia');
  for(const [level,values] of [['Normal',[25,70,10,12,15]],['Advertencia',[34,48,45,42,90]]]){const input=example();input.values=Object.fromEntries(features.map((k,i)=>[k,values[i]]));assert.equal(evaluatePmv1(input).prediction.level,level);}
});
test('PMV1: diez capturas sin red y reintento conserva cola hasta confirmación correcta',async()=>{
  const rows=[];let id=0;
  const app=new Pmv1Service({store:{put:async r=>rows.push(r),all:async()=>rows,ack:async id=>{rows.find(r=>r.reading.id===id).synced=true;}},entropy:{now:()=>new Date('2026-10-26T15:00Z'),id:()=>`00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`,numbers:()=>[.5,.5,.5,.5,.5]},remote:{savePmv1:async()=>{throw Error('offline');}}});
  for(let i=0;i<10;i++)await app.capture();assert.equal(rows.length,10);assert.ok(rows.every(r=>Object.keys(r.reading.values).length===5));
  await assert.rejects(app.synchronize(),/offline/);assert.ok(rows.every(r=>!r.synced));
  app.remote.savePmv1=async r=>({id:r.id});assert.equal(await app.synchronize(),10);assert.equal(await app.synchronize(),0);
});
