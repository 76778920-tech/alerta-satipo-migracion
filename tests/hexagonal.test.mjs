import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { AdminService } from '../backend/application/use-cases/admin-service.mjs';
import { changeCommand } from '../backend/domain/operation.mjs';
import { MemoryIdentity, MemoryRepository } from '../backend/adapters/out/memory.mjs';
import { createHandler } from '../backend/adapters/in/http.mjs';
const setup=()=>new AdminService({identity:new MemoryIdentity(),repository:new MemoryRepository()});
test('Dominio: estados válidos y reapertura; rechaza tipos y valores incorrectos',()=>{
  assert.equal(changeCommand('maintenance','V-01','Completada','Pendiente').nextState,'Pendiente');
  for(const args of [['maintenance','V-01','Pendiente','Validado'],['cases','V-01','Pendiente',null],['maintenance','../../','Pendiente','Completada']])assert.throws(()=>changeCommand(...args),{code:'VALIDATION'});
});
test('Aplicación: autenticación y autorización antes de persistencia',async()=>{
  const app=setup();
  app.repository.readings=()=>{throw Error('No debería acceder');};
  await assert.rejects(app.listReadings(''),{code:'UNAUTHENTICATED'});
  await assert.rejects(app.listReadings('user'),{code:'FORBIDDEN'});
});
test('Aplicación: actualiza sin navegador ni base, detecta conflicto y ausencia',async()=>{
  const app=setup();
  assert.equal((await app.updateState('admin','maintenance','V-01',{expectedState:'Pendiente',state:'En progreso'})).state,'En progreso');
  await assert.rejects(app.updateState('admin','maintenance','V-01',{expectedState:'Pendiente',state:'Completada'}),{code:'CONFLICT'});
  await assert.rejects(app.updateState('admin','maintenance','V-06',{expectedState:'Pendiente',state:'Completada'}),{code:'NOT_FOUND'});
});
test('Aplicación: concurrencia con mismo estado esperado solo confirma una escritura',async()=>{
  const app=setup();
  const results=await Promise.allSettled(['En progreso','Completada'].map(state=>app.updateState('admin','maintenance','V-01',{expectedState:'Pendiente',state})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.code,'CONFLICT');
});
test('Aplicación: consulta y validación de configuración',async()=>{
  const app=setup();assert.equal((await app.listReadings('admin'))[0].source_row,201);
  await assert.rejects(app.updateSettings('admin',{temp_critical:100}),{code:'VALIDATION'});
  assert.equal((await app.updateSettings('admin',{temp_critical:39,smoke_critical:65,humidity_dry:38,wind_risk:18})).wind_risk,18);
});
test('Adaptador HTTP: códigos, CORS, token obligatorio, JSON y error seguro',async()=>{
  const app=setup();const handler=createHandler({serviceFactory:()=>app,allowedOrigins:['http://localhost:8000']});
  const request=(path,method='GET',body,token='admin',origin='http://localhost:8000')=>new Request('http://test/api'+path,{method,headers:{authorization:token?'Bearer '+token:'',origin,'content-type':'application/json'},...(body!==undefined?{body}: {})});
  assert.equal((await handler(request('/readings','GET',undefined,''))).status,401);
  assert.equal((await handler(request('/readings','GET',undefined,'user'))).status,403);
  assert.equal((await handler(request('/readings','GET',undefined,'admin','https://evil.test'))).status,403);
  assert.equal((await handler(request('/readings','OPTIONS'))).status,204);
  assert.equal((await handler(request('/readings'))).status,200);
  assert.equal((await handler(request('/missing'))).status,404);
  assert.equal((await handler(request('/maintenance/V-01','PATCH','{'))).status,400);
  assert.equal((await handler(request('/maintenance/V-01','PATCH','{}'))).status,422);
  assert.equal((await handler(request('/maintenance/V-01','PATCH',JSON.stringify({expectedState:'Pendiente',state:'En progreso'})))).status,200);
  assert.equal((await handler(request('/maintenance/V-01','PATCH',JSON.stringify({expectedState:'Pendiente',state:'Completada'})))).status,409);
  app.repository.readings=()=>{throw Error('SECRET_INTERNAL');};
  const failed=await handler(request('/readings'));assert.equal(failed.status,500);assert.ok(!(await failed.text()).includes('SECRET_INTERNAL'));
});
test('Arquitectura: dominio y aplicación no importan SDK, HTTP, navegador ni infraestructura',async()=>{
  for(const dir of ['domain','application'])for(const name of await readdir('backend/'+dir,{recursive:true})) {
    if(!name.endsWith('.mjs'))continue;
    const source=await readFile(`backend/${dir}/${name}`,'utf8');
    assert.ok(!/\b(window|document|fetch|Deno|process)\b/.test(source),name);
    for(const match of source.matchAll(/(?:from\s*|import\s*\()(['"])(.*?)\1/g)){
      const target=match[2];assert.ok(target.startsWith('.'),`${name}: dependencia externa ${target}`);
      assert.ok(!target.includes('infrastructure'),name);
      assert.ok(!target.includes('adapters'),name);
      if(dir==='domain')assert.ok(!target.includes('application'),name);
    }
  }
});
