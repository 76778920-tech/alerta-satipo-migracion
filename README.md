# Alerta Satipo - Migracion

Copia independiente para integrar nuevos proveedores de hosting y persistencia.

## Estado actual

- Web en modo demostracion local. El acceso administrativo remoto queda deshabilitado hasta implementar el nuevo proveedor.
- Android conserva registro local, SQLite, clasificacion local, historial y recepcion BLE. No inicia clientes de nube.
- Se mantienen los modelos, datos, casos de uso y puertos independientes del proveedor.
- Se retiraron SDK, adaptadores, funciones remotas, migraciones especificas, configuraciones, pruebas de integracion antiguas y documentos del despliegue anterior. El original conserva esos archivos.
- No se migraron datos del servidor ni se eliminaron servicios remotos.

## Web local

Ejecutar `npm ci`, `npm run build`, `npm run configure` y `npm start`.
Abrir http://127.0.0.1:8000. Las funciones que requieren autenticacion o almacenamiento remoto no estan disponibles en esta etapa.

## Android

Desde mobile ejecutar `flutter pub get` y `flutter run`.

## Comprobaciones

Ejecutar `npm test` y `npm run test:python`.
Dentro de mobile: `flutter analyze` y `flutter test`.

## Repositorio

https://github.com/76778920-tech/alerta-satipo-migracion

El historial Git conserva versiones anteriores. La limpieza afecta al arbol actual; no reescribe commits publicados.
