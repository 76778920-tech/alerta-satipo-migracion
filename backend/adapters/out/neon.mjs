import pg from 'pg';
import {createRemoteJWKSet, jwtVerify} from 'jose';
import {ApplicationError} from '../../domain/errors.mjs';

export function createPool(env=process.env) {
  if(!env.DATABASE_URL) throw new ApplicationError('UNAVAILABLE','Base de datos no configurada.');
  const url=new URL(env.DATABASE_URL);
  // Require TLS with certificate verification, including when the URL contains sslmode=require.
  for(const key of ['sslmode','sslcert','sslkey','sslrootcert'])url.searchParams.delete(key);
  return new pg.Pool({connectionString:url.toString(),ssl:{rejectUnauthorized:true},max:3,connectionTimeoutMillis:8000,idleTimeoutMillis:10000,query_timeout:10000});
}

export function createIdentity(env=process.env, verify=jwtVerify) {
  let keys;
  return {async authenticate(token) {
    if(!env.NEON_AUTH_BASE_URL || !env.NEON_AUTH_JWKS_URL)
      throw new ApplicationError('UNAVAILABLE','Configura Neon Auth y su URL JWKS.');
    keys ??= createRemoteJWKSet(new URL(env.NEON_AUTH_JWKS_URL));
    try {
      const options={issuer:new URL(env.NEON_AUTH_BASE_URL).origin,requiredClaims:['sub','exp']};
      if(env.NEON_AUTH_AUDIENCE)options.audience=env.NEON_AUTH_AUDIENCE;
      const {payload}=await verify(token,keys,options);
      const admins=(env.ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
      return {id:payload.sub,isAdmin:admins.includes(payload.sub)};
    } catch {return null;}
  }};
}

const historySql=`SELECT jsonb_build_object('reading', jsonb_build_object(
 'id',l.lectura_id,'node_id',l.nodo_id,'source',l.source,'observed_at',l.observed_at,
 'values',jsonb_build_object('temperature_c',l.temperature_c,'humidity_pct',l.humidity_pct,
 'smoke_index',l.smoke_index,'gas_index',l.gas_index,'dust_ugm3',l.dust_ugm3)),
 'prediction',jsonb_build_object('level',p.level,'scores',p.scores,'model_version',p.model_version,'experimental',p.experimental),
 'alert',CASE WHEN e.alerta_id IS NULL THEN NULL ELSE jsonb_build_object('level',e.level,'channel',e.canal,'experimental',e.experimental) END) AS record
 FROM alerta."LecturaAmbiental" l JOIN alerta."HistoricoPrediccion" p USING(lectura_id)
 LEFT JOIN alerta."EventoAlerta" e USING(prediccion_id)`;
const unavailable=()=>{throw new ApplicationError('UNAVAILABLE','Este módulo todavía no está migrado a Neon.');};
export class NeonRepository {
  constructor(pool){this.pool=pool;}
  async pmv1History(){return (await this.pool.query(historySql+' ORDER BY l.observed_at DESC LIMIT 500')).rows.map(x=>x.record);}
  async savePmv1(record){
    const c=await this.pool.connect(),r=record.reading,p=record.prediction;
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[r.id]);
      const old=(await c.query(historySql+' WHERE l.lectura_id=$1',[r.id])).rows[0]?.record;
      if(old){
        const a=old.reading;
        if(a.node_id!==r.node_id||a.source!==r.source||Date.parse(a.observed_at)!==Date.parse(r.observed_at)||Object.keys(r.values).some(k=>a.values[k]!==r.values[k]))
          throw new ApplicationError('CONFLICT','El identificador pertenece a otra lectura.');
        await c.query('COMMIT');return old;
      }
      await c.query('INSERT INTO alerta."NodoSensor" (nodo_id,source) VALUES ($1,$2) ON CONFLICT (nodo_id) DO NOTHING',[r.node_id,r.source]);
      await c.query('INSERT INTO alerta."LecturaAmbiental" (lectura_id,nodo_id,source,observed_at,temperature_c,humidity_pct,smoke_index,gas_index,dust_ugm3) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',[r.id,r.node_id,r.source,r.observed_at,...['temperature_c','humidity_pct','smoke_index','gas_index','dust_ugm3'].map(k=>r.values[k])]);
      const id=(await c.query('INSERT INTO alerta."HistoricoPrediccion" (lectura_id,level,model_version,scores) VALUES ($1,$2,$3,$4::jsonb) RETURNING prediccion_id',[r.id,p.level,p.model_version,JSON.stringify(p.scores)])).rows[0].prediccion_id;
      if(record.alert)await c.query('INSERT INTO alerta."EventoAlerta" (prediccion_id,level) VALUES ($1,$2)',[id,record.alert.level]);
      await c.query('COMMIT');return record;
    }catch(error){await c.query('ROLLBACK');if(error.code==='23503')throw new ApplicationError('CONFLICT','El nodo pertenece a otro origen de datos.');throw error;}
    finally{c.release();}
  }
  readings(){return unavailable();} operations(){return unavailable();} activity(){return unavailable();}
  compareAndSet(){return unavailable();} exists(){return unavailable();} saveSettings(){return unavailable();}
}
