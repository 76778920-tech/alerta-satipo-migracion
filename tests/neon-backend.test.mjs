import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {NeonRepository,createIdentity} from '../backend/adapters/out/neon.mjs';
import {evaluatePmv1} from '../backend/domain/pmv1.mjs';
import {createVercelHandler} from '../backend/vercel.mjs';

test('Neon repository persists atomically, retries safely and rejects conflicting IDs',async()=>{
 const db=new PGlite();
 try {
  await db.exec(await readFile(new URL('../database/001_pmv1.sql',import.meta.url),'utf8'));
  const client={query:(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):db.query(sql,args),release(){}};
  const repo=new NeonRepository({...client,connect:async()=>client});
  const input={id:'11111111-1111-4111-8111-111111111111',node_id:'22222222-2222-4222-8222-222222222222',source:'simulation',observed_at:'2026-10-30T10:00:00Z',values:{temperature_c:60,humidity_pct:10,smoke_index:90,gas_index:90,dust_ugm3:400}};
  const record=evaluatePmv1(input);
  await repo.savePmv1(record);await repo.savePmv1(record);
  assert.equal((await repo.pmv1History()).length,1);
  await assert.rejects(repo.savePmv1(evaluatePmv1({...input,values:{...input.values,temperature_c:50}})),e=>e.code==='CONFLICT');
  await assert.rejects(repo.savePmv1(evaluatePmv1({...input,id:'33333333-3333-4333-8333-333333333333',source:'sensor'})),e=>e.code==='CONFLICT');
  assert.equal((await repo.pmv1History()).length,1);
 }finally{await db.close();}
});
test('health reports actual query failures without exposing credentials',async()=>{
 const handler=createVercelHandler({env:{},poolFactory:()=>({query:async()=>{throw new Error('secret password');}})});
 const response=await handler(new Request('https://example.com/api/health'));
 assert.equal(response.status,503);assert.equal((await response.text()).includes('secret'),false);
});
test('unauthenticated writes never open a database connection',async()=>{
 const handler=createVercelHandler({env:{},poolFactory:()=>{throw new Error('must not connect');}});
 assert.equal((await handler(new Request('https://example.com/api/pmv1',{method:'PATCH'}))).status,401);
});
test('identity requires explicit admin subject and checks issuer',async()=>{
 const env={NEON_AUTH_BASE_URL:'https://auth.example.com/auth',NEON_AUTH_JWKS_URL:'https://auth.example.com/auth/jwks',ADMIN_USER_IDS:'admin-id'};
 const identity=createIdentity(env,async(token,keys,options)=>{assert.equal(options.issuer,'https://auth.example.com');return {payload:{sub:token,role:'admin'}};});
 assert.equal((await identity.authenticate('resident-id')).isAdmin,false);
 assert.equal((await identity.authenticate('admin-id')).isAdmin,true);
});
