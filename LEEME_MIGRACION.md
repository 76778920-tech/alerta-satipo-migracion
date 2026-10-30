# Copia para migración de Alerta Satipo

Creada el 30/10/2026 desde `C:\Alerta de Incendios`.

## Estado de esta copia

- El original y los servicios remotos de Firebase y Supabase no se han modificado.
- La web está configurada en modo `demo`, sin URL ni clave de Supabase.
- El móvil utiliza almacenamiento local y no inicializa el cliente remoto.
- Se apartaron la configuración de Firebase Hosting, el enlace local del CLI de Supabase, las cuentas locales de prueba y los compilados anteriores.
- Esos archivos se conservan fuera del proyecto, en `C:\Alerta de Incendios - Respaldo configuracion anterior`. Ese respaldo contiene configuración privada: no publicarlo ni usarlo como nueva versión.
- Se retiró el remoto Git de esta copia para evitar publicar cambios en el repositorio original por accidente. El historial Git se conserva; contiene versiones anteriores del código y configuración pública.
- Se conservan los adaptadores, dependencias, funciones y migraciones SQL como referencia para implementar los proveedores nuevos. Esto es una desconexión, no una reimplementación completa de la base de datos.
- No se exportó ni se eliminó la base de datos alojada en Supabase. Copiar la carpeta no constituye un respaldo de esa base remota.

## Uso local

Web: ejecutar `npm run build`, `npm run configure` y `npm start` desde esta carpeta. Mantener `SATIPO_MODE=demo` y vacías las variables de Supabase en `.env`.

Móvil: ejecutar `flutter pub get` y `flutter run` desde `mobile`. No instalar los APK antiguos del respaldo: todavía incorporan la configuración anterior.

La autenticación y las alertas generales remotas estarán pendientes hasta integrar el nuevo proveedor. El registro y los datos locales del móvil se conservan. No se cambió el identificador Android, por lo que instalar esta versión sobre la anterior actualiza la misma aplicación.

## Próximo paso

Elegir el nuevo hosting y la nueva base de datos; adaptar autenticación, permisos, API y almacenamiento, migrar los datos necesarios y verificar el funcionamiento antes de publicar.
