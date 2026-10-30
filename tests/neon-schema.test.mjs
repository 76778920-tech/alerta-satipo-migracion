import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Esquema PostgreSQL: repeticion, rangos, integridad y rollback', async () => {
  const db = new PGlite();
  try {
    const sql = await readFile('database/001_pmv1.sql', 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    assert.equal((await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='alerta'")).rows.length, 4);
    const node = '00000000-0000-4000-8000-000000000001';
    const reading = '00000000-0000-4000-8000-000000000002';
    await db.query('INSERT INTO alerta."NodoSensor" (nodo_id,source) VALUES ($1,$2)', [node,'simulation']);
    const insert = 'INSERT INTO alerta."LecturaAmbiental" (lectura_id,nodo_id,source,observed_at,temperature_c,humidity_pct,smoke_index,gas_index,dust_ugm3) VALUES ($1,$2,$3,now(),$4,50,40,40,90)';
    await assert.rejects(db.query(insert,[reading,node,'simulation',81]));
    await assert.rejects(db.query(insert,[reading,node,'sensor',30]));
    await db.query(insert,[reading,node,'simulation',30]);
    for (const scores of ['[1,1,1]','[null,0,1]','["0",0,1]','{}','[0,1]']) {
      await assert.rejects(db.query('INSERT INTO alerta."HistoricoPrediccion" (lectura_id,level,model_version,scores) VALUES ($1,$2,$3,$4)',[reading,'Advertencia','test',scores]));
    }
    const prediction = (await db.query('INSERT INTO alerta."HistoricoPrediccion" (lectura_id,level,model_version,scores) VALUES ($1,$2,$3,$4) RETURNING prediccion_id',[reading,'Advertencia','test','[0,1,0]'])).rows[0].prediccion_id;
    await assert.rejects(db.query('INSERT INTO alerta."EventoAlerta" (prediccion_id,level) VALUES ($1,$2)',[prediction,'Emergencia']));
    await db.exec('BEGIN');
    await db.query('INSERT INTO alerta."EventoAlerta" (prediccion_id,level) VALUES ($1,$2)',[prediction,'Advertencia']);
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT * FROM alerta."EventoAlerta"')).rows.length,0);
    await db.query('INSERT INTO alerta."EventoAlerta" (prediccion_id,level) VALUES ($1,$2)',[prediction,'Advertencia']);
    await assert.rejects(db.query('INSERT INTO alerta."EventoAlerta" (prediccion_id,level) VALUES ($1,$2)',[prediction,'Advertencia']));
  } finally { await db.close(); }
});
