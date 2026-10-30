-- Ejecutar en neondb. Crea tablas vacias; no modifica usuarios de autenticacion.
BEGIN;
CREATE SCHEMA IF NOT EXISTS alerta;
REVOKE ALL ON SCHEMA alerta FROM PUBLIC;

CREATE TABLE IF NOT EXISTS alerta."NodoSensor" (
  nodo_id uuid PRIMARY KEY,
  nombre text NOT NULL DEFAULT 'Nodo PMV1',
  source text NOT NULL CHECK (source IN ('simulation', 'sensor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nodo_id, source)
);

CREATE TABLE IF NOT EXISTS alerta."LecturaAmbiental" (
  lectura_id uuid PRIMARY KEY,
  nodo_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('simulation', 'sensor')),
  observed_at timestamptz NOT NULL,
  temperature_c double precision NOT NULL CHECK (temperature_c BETWEEN -20 AND 80),
  humidity_pct double precision NOT NULL CHECK (humidity_pct BETWEEN 0 AND 100),
  smoke_index double precision NOT NULL CHECK (smoke_index BETWEEN 0 AND 100),
  gas_index double precision NOT NULL CHECK (gas_index BETWEEN 0 AND 100),
  dust_ugm3 double precision NOT NULL CHECK (dust_ugm3 BETWEEN 0 AND 1000),
  received_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (nodo_id, source) REFERENCES alerta."NodoSensor" (nodo_id, source)
);
CREATE INDEX IF NOT EXISTS lectura_nodo_fecha
  ON alerta."LecturaAmbiental" (nodo_id, observed_at DESC);

CREATE OR REPLACE FUNCTION alerta.valid_scores(scores jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE item jsonb; value numeric; total numeric := 0;
BEGIN
  IF scores IS NULL OR jsonb_typeof(scores) <> 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(scores) <> 3 THEN RETURN false; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(scores) LOOP
    IF jsonb_typeof(item) <> 'number' THEN RETURN false; END IF;
    value := item::text::numeric;
    IF value < 0 OR value > 1 THEN RETURN false; END IF;
    total := total + value;
  END LOOP;
  RETURN abs(total - 1) <= 0.000001;
END;
$$;

CREATE TABLE IF NOT EXISTS alerta."HistoricoPrediccion" (
  prediccion_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lectura_id uuid NOT NULL UNIQUE REFERENCES alerta."LecturaAmbiental" (lectura_id),
  level text NOT NULL CHECK (level IN ('Normal', 'Advertencia', 'Emergencia')),
  model_version text NOT NULL CHECK (length(model_version) BETWEEN 1 AND 100),
  scores jsonb NOT NULL CHECK (alerta.valid_scores(scores)),
  experimental boolean NOT NULL DEFAULT true CHECK (experimental),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prediccion_id, level)
);

CREATE TABLE IF NOT EXISTS alerta."EventoAlerta" (
  alerta_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediccion_id uuid NOT NULL UNIQUE,
  level text NOT NULL CHECK (level IN ('Advertencia', 'Emergencia')),
  canal text NOT NULL DEFAULT 'software' CHECK (canal = 'software'),
  experimental boolean NOT NULL DEFAULT true CHECK (experimental),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (prediccion_id, level)
    REFERENCES alerta."HistoricoPrediccion" (prediccion_id, level)
);

-- Solo el propietario tiene acceso por ahora. La API autenticada se integrara despues.
REVOKE ALL ON ALL TABLES IN SCHEMA alerta FROM PUBLIC;
REVOKE ALL ON FUNCTION alerta.valid_scores(jsonb) FROM PUBLIC;
COMMIT;

-- Resultado esperado: cuatro tablas, inicialmente vacias.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'alerta' AND table_type = 'BASE TABLE'
ORDER BY table_name;
