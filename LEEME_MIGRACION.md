# Migracion: version local independiente

El codigo actual no incluye clientes ni configuraciones de los proveedores retirados. No se modificaron el proyecto original ni sus servicios alojados.

Los archivos retirados se conservaron fuera de esta carpeta en el respaldo anterior, subcarpeta limpieza-completa. No incorporar ese respaldo al nuevo repositorio.

La web requiere una nueva integracion para el acceso administrativo; Android funciona con cuentas y datos locales. Las alertas generales remotas no estan disponibles. El puerto abstracto RemoteRecords define el contrato para una futura implementacion, sin conexiones ni SDK.

Los documentos y pruebas especificos del despliegue anterior se retiraron con sus integraciones. Las pruebas independientes del dominio permanecen. El historial Git no se reescribio: conserva el estado antiguo.

Consultar README.md para ejecutar y verificar la version local.
