# Muestra Smoke Detection IoT

300 registros reales del archivo fuente, utilizados exclusivamente como datos históricos de prueba.

- Fuente: [HamzaMa96/Smoke-Detection-IOT](https://github.com/HamzaMa96/Smoke-Detection-IOT), archivo [smoke_detection_iot.csv](https://raw.githubusercontent.com/HamzaMa96/Smoke-Detection-IOT/main/smoke_detection_iot.csv).
- Origen consultado: 62 630 filas; 17 873 con `Fire Alarm=0`, 44 757 con `Fire Alarm=1`.
- Muestra proporcional: **86 sin alarma y 214 con alarma**, semilla `20260923`.
- Las primeras 300 filas originales son todas negativas; por eso no se tomó simplemente el inicio del archivo.
- `metadata.json` conserva la URL y el SHA-256 del contenido fuente. El identificador `source_row` permite encontrar cada fila original.
- `smoke_detection_300.csv`: importación manual en la tabla `smoke_readings` ya creada.
- `smoke_detection_300.json`: importación automatizada y demostración local.

No se asignaron filas a pobladores ni a ubicaciones de Satipo: el dataset es una referencia común. Los datos privados de cada persona son sus reportes y preferencias.

## Diccionario

| CSV original | Columna en PostgreSQL | Interpretación |
| --- | --- | --- |
| índice sin encabezado | source_row | Índice original |
| UTC | utc_seconds / recorded_at | Marca Unix / fecha UTC derivada |
| Temperature[C] | temperature_c | °C |
| Humidity[%] | humidity_pct | % |
| TVOC[ppb] | tvoc_ppb | Compuestos orgánicos volátiles, ppb |
| eCO2[ppm] | eco2_ppm | CO₂ equivalente, ppm |
| Raw H2 | raw_h2 | Lectura cruda |
| Raw Ethanol | raw_ethanol | Lectura cruda |
| Pressure[hPa] | pressure_hpa | hPa |
| PM1.0 / PM2.5 | pm1_0 / pm2_5 | Valores originales; el encabezado no especifica unidad |
| NC0.5 / NC1.0 / NC2.5 | nc0_5 / nc1_0 / nc2_5 | Valores originales; el encabezado no especifica unidad |
| CNT | cnt | Contador original |
| Fire Alarm | fire_alarm | Etiqueta binaria original, conservada como booleano |

No existe una columna de porcentaje de humo, velocidad del viento, batería, coordenadas o identidad de un usuario. TVOC y PM no se convierten arbitrariamente en porcentaje de humo. La etiqueta no es una predicción calculada por la aplicación.

## Reproducir

`npm run dataset` descarga la fuente y regenera la muestra. Para reproducir exactamente la versión importada se debe conservar el hash indicado en `metadata.json`: la rama `main` remota puede cambiar. La muestra ya está versionada, por lo que no se descarga en cada inicio.

300 filas bastan para validar importación e interfaces; no demuestran precisión de detección forestal. Para entrenar habrá que diseñar separación temporal/de sesiones y evaluar generalización con sensores de campo. No usar UTC, CNT, índice original ni la etiqueta como variables predictoras sin justificarlo.
