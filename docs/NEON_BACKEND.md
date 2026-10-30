# Backend en Vercel con Neon

La API utiliza DATABASE_URL exclusivamente en el servidor y verifica certificados TLS.
GET /api/health consulta Neon y comprueba las cuatro tablas del esquema alerta.
GET /api/pmv1 consulta hasta 500 registros. PATCH /api/pmv1 evalúa y guarda una lectura,
su predicción y, si corresponde, una alerta en una transacción. Reenviar la misma
lectura no genera duplicados; reutilizar su ID con datos distintos devuelve 409.

## Configuración pendiente en Vercel

- DATABASE_URL: ya la proporciona la integración. No copiarla al frontend.
- NEON_AUTH_BASE_URL: ya la proporciona la integración.
- NEON_AUTH_JWKS_URL: copiar la URL pública JWKS indicada en la configuración de
  Neon Auth. No es la cadena PostgreSQL ni una clave secreta.
- ADMIN_USER_IDS: ID exacto del usuario administrador creado en Neon Auth.
  Se pueden separar varios IDs con comas. Un usuario no obtiene permisos por su email
  ni por atributos editables de su perfil. Sin esta variable nadie administra la API.
- ALLOWED_ORIGINS: opcional, orígenes separados por comas. El predeterminado es
  https://alerta-satipo-migracion.vercel.app.
- NEON_AUTH_AUDIENCE: configurar si la emisión de JWT del proyecto establece audiencia.

Volver a desplegar tras cambiar variables. Las rutas PMV1 requieren un JWT de Neon
Auth en Authorization: Bearer. Un token de sesión opaco no sustituye al JWT.

## Capturas reales

1. Vercel > proyecto > Deployments: abrir el despliegue del commit nuevo y capturar Ready.
2. Abrir https://alerta-satipo-migracion.vercel.app/api/health y capturar la URL y
   status: ok, database: connected, schema: ready. Si muestra 503, la conexión o
   el esquema aún no están verificados: revisar variables y logs privados.
3. Neon > Postgres database > Tables > esquema alerta: capturar las cuatro tablas.
4. Vercel > Settings > Environments: capturar solo nombres de variables, valores ocultos.
5. Para demostrar escritura, ejecutar una solicitud autenticada a PATCH /api/pmv1
   y capturar luego la lectura y predicción en Neon Tables, sin mostrar el JWT.

## Alcance

Este cambio implementa la API y persistencia PMV1. El login de la interfaz web y
el cliente móvil todavía requieren su adaptador Neon Auth y conexión a esta API.
Operaciones, preferencias y reportes siguen pendientes de migrar y responden 503;
no se simula que están guardados. Un health correcto no prueba el login ni la escritura.

Referencias: https://neon.com/docs/compute/functions/authentication y
https://vercel.com/docs/functions/runtimes/node-js.
