import {createPool,createIdentity,NeonRepository} from './adapters/out/neon.mjs';
import {AdminService} from './application/use-cases/admin-service.mjs';
import {createHandler} from './adapters/in/http.mjs';

export function createVercelHandler({env=process.env,poolFactory=()=>createPool(env)}={}){
  let pool;
  const getPool=()=>pool??=poolFactory();
  const identity=createIdentity(env);
  const api=createHandler({allowedOrigins:(env.ALLOWED_ORIGINS||'https://alerta-satipo-migracion.vercel.app').split(',').map(x=>x.trim()),
    serviceFactory:()=>new AdminService({identity,repository:new NeonRepository({query:(...args)=>getPool().query(...args),connect:()=>getPool().connect()})})});
  return async request=>{
    if(new URL(request.url).pathname==='/api/health' && request.method==='GET'){
      try {
        const {rows}=await getPool().query(`SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema='alerta' AND table_name IN ('NodoSensor','LecturaAmbiental','HistoricoPrediccion','EventoAlerta')`);
        const ready=rows[0].total===4;
        return Response.json({status:ready?'ok':'schema_missing',database:'connected',schema:ready?'ready':'incomplete'},{status:ready?200:503,headers:{'Cache-Control':'no-store'}});
      }catch{return Response.json({status:'unavailable',database:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
    }
    return api(request);
  };
}
