# Alerta Satipo Android local

Ejecutar `flutter pub get`, `flutter analyze`, `flutter test` y `flutter run`.

La aplicacion usa SQLite, almacenamiento seguro y procesamiento local de cinco variables. Conserva acceso para pobladores, historial, exportacion y recepcion BLE. No tiene proveedor remoto instalado: no se pueden consultar alertas generales ni vincular cuentas de nube.

Los datos simulados no constituyen validacion con sensores fisicos. Se requiere hardware para comprobar Bluetooth, luces y buzzer.
