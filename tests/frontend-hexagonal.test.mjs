import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { BrowserService } from '../frontend/src/application/use-cases/browser-service.mjs';
import { createRiskService } from '../frontend/src/application/use-cases/risk-service.mjs';
import { SimulationService } from '../frontend/src/application/use-cases/simulation-service.mjs';
import { HttpAdmin } from '../frontend/src/adapters/out/http.mjs';
import { KeyValuePort } from '../frontend/src/application/ports/out/gateways.mjs';
import { validateHelp } from '../frontend/src/domain/account.mjs';
import { defaultThresholds, defaultWeights, calculateRiskWith } from '../frontend/src/domain/risk.mjs';
import * as fixtures from '../frontend/src/adapters/out/demo-data.mjs';

class MemoryStore extends KeyValuePort {
  values=new Map();
  get(key) { return this.values.get(key) ?? null; }
  set(key,value) { this.values.set(key,value); }
  remove(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
function setup(role='admin') {
  let logoutCount=0;
  const session=new MemoryStore(),preferences=new MemoryStore();
  const identity={currentUser:async()=>({id:'user-1',email:'test@example.invalid'}),signIn:async()=>{},signOut:async()=>{logoutCount++;},changePassword:async()=>{}};
  const profiles={find:async user=>({...user,role,name:'Prueba',notif_push:true}),updatePreference:async()=>{}};
  const app=new BrowserService({identity,profiles,session,preferences,cloud:true,
    admin:{readings:async()=>[{source_row:1}]},assets:{readings:async()=>[{source_row:9}]},
    community:{createReport:async()=>{},requestHelp:async()=>{}}});
  return {app,session,profiles,identity,logoutCount:()=>logoutCount};
}
const entropy={now:()=>new Date('2026-10-02T05:00:00Z'),id:()=> 'scenario-1',numbers:n=>Array(n).fill(0.5)};

test('Navegador: login administrativo, rechazo de poblador y limpieza de sesión sin DOM',async()=>{
  const admin=setup();
  assert.equal((await admin.app.login({email:'a',password:'b'})).role,'admin');
  assert.equal(admin.session.get('userName'),'Prueba');
  await admin.app.logout();
  assert.equal(admin.app.profile,null);assert.equal(admin.session.get('userRole'),null);
  const person=setup('user');
  await assert.rejects(person.app.login({}),{code:'FORBIDDEN'});
  assert.equal(person.logoutCount(),1);assert.equal(person.session.get('userRole'),null);
});
test('Navegador: pérdida de identidad elimina el perfil y un error remoto no activa demo',async()=>{
  const {app,identity,session}=setup();await app.identify();
  identity.currentUser=async()=>null;
  assert.equal(await app.identify(),null);assert.equal(session.get('userRole'),null);
  app.admin.readings=async()=>{throw new Error('offline');};
  await assert.rejects(app.listReadings(),/offline/);
  assert.equal(app.cloud,true);
});
test('Navegador: preferencias permiten solo campos conocidos y conservan valor ante fallos',async()=>{
  const {app,profiles}=setup();await app.identify();
  let writes=0;profiles.updatePreference=async()=>{writes++;throw new Error('offline');};
  await assert.rejects(app.savePreference('role',true),/inválida/);
  assert.equal(writes,0);
  await assert.rejects(app.savePreference('notif-push',false),/offline/);
  assert.equal(app.preference('notif-push',false),true);
  profiles.updatePreference=async(id,field,value)=>assert.deepEqual([id,field,value],['user-1','notif_push',false]);
  await app.savePreference('notif-push',false);
  assert.equal(app.preference('notif-push',true),false);
});
test('Navegador: consultas comunitarias usan su puerto y no la API exclusiva de administradores',async()=>{
  const {app}=setup('user');await app.identify();
  app.admin.readings=app.admin.activity=()=>{throw Error('No debe consultar la API administrativa');};
  app.community.readings=async()=>[{source_row:1}];
  app.community.activity=async id=>({reports:[{user_id:id}],incidents:[],settings:{}});
  assert.equal((await app.listReadings()).length,1);
  assert.equal((await app.getActivity()).reports[0].user_id,'user-1');
});
test('Navegador: reportes y apoyo validan antes de persistir; conserva regla de dos condiciones',async()=>{
  const {app}=setup();await app.identify();let writes=0;
  app.community.createReport=async()=>writes++;
  await assert.rejects(app.createReport({description:'corto'}));assert.equal(writes,0);
  await app.createReport({location:'Satipo',type:'Humo',severity:'high',description:'Humo visible cerca de una chacra'});
  assert.equal(writes,1);
  assert.doesNotThrow(()=>validateHelp({location:'Satipo',visible:true,safe:false,reference:true}));
  assert.throws(()=>validateHelp({location:'Satipo',visible:true,safe:false,reference:false}));
});
test('HTTP de salida: token de usuario, ruta escapada y errores sin activar otro origen',async()=>{
  let call;
  const port=new HttpAdmin({url:'https://test/api/',publicKey:'public',identity:{accessToken:async()=> 'jwt'},request:async(...args)=>{call=args;return new Response('{"state":"Nuevo"}');}});
  await port.updateState('incidents','a/b',{state:'Nuevo'});
  assert.equal(call[0],'https://test/api/incidents/a%2Fb');
  assert.equal(call[1].headers.Authorization,'Bearer jwt');assert.equal(call[1].method,'PATCH');
  port.request=async()=>new Response('{"error":"denegado"}',{status:403});
  await assert.rejects(port.readings(),/denegado/);
});
test('Riesgo: reglas y casos de uso sin almacenamiento real, red o reloj global',async()=>{
  const store=new MemoryStore();
  const app=createRiskService({Backend:{ready:Promise.resolve(),cloud:false},store,assets:{model:async()=>{throw Error('sin modelo');}},fixtures,entropy});
  await app.ready;
  assert.equal(app.getModelInfo().source,'defaults');
  assert.equal(calculateRiskWith({temp:39,smoke:65,humidity:38,wind:18,lastComm:1},defaultThresholds,defaultWeights),82);
  await app.createReport({location:'Satipo',type:'Humo',severity:'high',description:'Humo visible cerca de la comunidad'});
  assert.equal(app.readReports().length,1);assert.equal(app.readIncidents()[0].risk,82);
  await app.requestHelp({location:'Satipo',visible:true,safe:true,reference:false});
  assert.equal(app.readIncidents()[0].source,'mobile-help');
  const before=app.sensors[0].temp;app.simulateTelemetry();assert.equal(app.sensors[0].temp,before);
});
test('Simulación: determinismo, historial por usuario, límite y ausencia de almacenamiento',()=>{
  const store=new MemoryStore();let index=0;
  const app=new SimulationService({store,entropy:{...entropy,id:()=>String(++index)}});
  const result=app.generate('Seco','a');
  assert.equal(result.scenario.type,'SIMULATION_ONLY');assert.equal(result.scenario.districts.length,9);
  assert.equal(result.scenario.districts[0].temperatureC,32);
  assert.equal(app.history('b').length,0);
  for(let i=0;i<12;i++)app.generate('Variable','a');
  assert.equal(app.history('a').length,10);
  store.set=()=>{throw Error('quota');};assert.equal(app.generate('Lluvioso','b').saved,false);
});
test('Arquitectura: todos los módulos de los núcleos JS respetan su dirección de dependencias',async()=>{
  for(const root of ['backend','frontend/src']) for(const layer of ['domain','application']) {
    for(const name of await readdir(`${root}/${layer}`,{recursive:true})) {
      if(!name.endsWith('.mjs'))continue;
      const entry=`${root}/${layer}/${name}`;
      const source=await readFile(entry,'utf8');
      assert.ok(!/\b(window|document|fetch|localStorage|sessionStorage|Deno|process|XMLHttpRequest)\b/.test(source),entry);
      const {metafile}=await build({entryPoints:[entry],bundle:true,write:false,metafile:true,platform:'neutral',packages:'external',format:'esm'});
      const prefixes=[`${root}/domain/`,...(layer==='application'?[`${root}/application/`]:[])];
      for(const input of Object.keys(metafile.inputs))assert.ok(prefixes.some(p=>input.replaceAll('\\','/').startsWith(p)),`${entry} importa ${input}`);
      for(const output of Object.values(metafile.outputs))assert.equal(output.imports.length,0,entry);
    }
  }
});
