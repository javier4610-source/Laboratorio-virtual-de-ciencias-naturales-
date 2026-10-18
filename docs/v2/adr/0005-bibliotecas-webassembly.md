# 0005 · Bibliotecas de visualización molecular y WebAssembly

- **Estado:** Propuesta
- **Fecha:** 2026-10-18
- **Relacionado con:** prompt maestro, secciones 7, 9.2, 10.4, 10.5, 10.10 y 14.4; ADR 0001; `docs/v2/LICENCIAS.md`;
  `docs/v2/DIAGNOSTICO-FASE0.md` (sección 6)

## Contexto

- Las fases 3 (geometría molecular 3D), 5 (visor de proteínas) y 7 (descriptores de moléculas) necesitan bibliotecas
  que hoy no están en `package.json`. El prompt exige verificar disponibilidad real, versión y peso antes de
  comprometerse con una biblioteca WebAssembly.
- Hoy la aplicación no tiene dependencias de terceros en ejecución salvo React y las fuentes; el JS inicial es de
  376 kB (117 kB comprimido) según el diagnóstico.
- Candidatas consultadas en el registro npm (`npm view <paquete> version license`, 2026-10-18):

| Paquete npm | Biblioteca | Versión | Licencia (según npm) | Tamaño del paquete npm (diagnóstico) | Uso previsto |
|---|---|---|---|---|---|
| `3dmol` | 3Dmol.js | 2.5.5 | BSD-3-Clause | 20,7 MB sin comprimir | Visor de proteínas y moléculas (fases 3 y 5) |
| `ngl` | NGL | 2.5.0 | MIT | 23,0 MB sin comprimir | Alternativa al visor |
| `@rdkit/rdkit` | RDKit.js | 2026.9.1 | BSD-3-Clause | 7,5 MB (incluye WebAssembly) | SMILES, descriptores, reglas de Lipinski y Veber, geometría (fases 3 y 7) |
| `pyodide` | Pyodide | 314.0.7 (número reportado por npm; su correspondencia con la numeración de versiones del proyecto está **por verificar**) | MPL-2.0 | 13,9 MB | Python en el navegador (fase 9) |

  El tamaño del paquete npm **no** es lo que descarga el estudiante: incluye fuentes, mapas y ejemplos. El peso real
  (archivo minificado, `.wasm`, comprimido) está **por medir**.

## Decisión (propuesta)

1. **La elección se aplaza** a las fases 3 a 5 y se toma después de medir, para cada candidata: peso minificado y
   comprimido del JS, peso del `.wasm`, tiempo de carga y de primera interacción en un equipo modesto, y memoria.
   Entre 3Dmol.js y NGL se elegirá **uno solo**, con la justificación de peso y licencia que pide la sección 10.4.
2. **Carga bajo demanda:** la biblioteca se importa solo al abrir el módulo que la usa (importación dinámica), sin
   aumentar el JS inicial ni el tiempo de arranque de las demás prácticas.
3. **Empaquetada con versión fijada, sin CDN:** se instala con versión exacta en `package.json` (como el resto de
   dependencias) y se sirve desde el propio sitio. Así funciona sin conexión (PWA) y no se depende de terceros en
   tiempo de ejecución. Se definirá en esa fase si la PWA la precarga o la guarda en caché al primer uso.
4. **Degradación honesta:** si la biblioteca no carga (equipo sin WebAssembly, memoria insuficiente), el motor
   informa «no disponible» y la práctica sigue funcionando sin la vista 3D (ADR 0001, contrato de motores).
5. **Tabla de licencias:** cada biblioteca adoptada se añade a `docs/v2/LICENCIAS.md` con su licencia verificada en
   `node_modules/<paquete>/package.json` y en su archivo de licencia, y con sus obligaciones de atribución.

## Alternativas consideradas

| Alternativa | Resultado | Motivo |
|---|---|---|
| Cargar desde un CDN | Rechazada | Rompe el modo sin conexión, añade un tercero en ejecución y exige verificar integridad (SRI) en cada cambio |
| Adoptar ya las cuatro bibliotecas | Rechazada | Peso no medido; añadir dependencias sin necesidad inmediata contradice la sección 7 |
| Ejecutar RDKit o Python en un servidor (Nivel 2) | Rechazada por ahora | Requiere infraestructura que el docente no ha decidido (ADR 0001) |
| Dibujos 2D propios en lugar de un motor 3D | Rechazada para geometría | La sección 9.2 exige que la geometría provenga de un motor real o de un archivo, no de una ilustración |
| Medir y decidir por fase, con carga bajo demanda (propuesta) | Propuesta | Cumple «primero el Nivel 0» sin penalizar a los equipos modestos |

## Consecuencias

- Hasta la decisión, ninguna práctica depende de estas bibliotecas.
- El tamaño del sitio publicado y del caché de la PWA crecerá; debe registrarse en el presupuesto de rendimiento.
- Pyodide es la más pesada en uso real (intérprete y paquetes); su adopción en la fase 9 exigirá una medición propia.
- MPL-2.0 (Pyodide) es una licencia de copyleft por archivo: si se modifican sus archivos, esas modificaciones deben
  publicarse bajo la misma licencia; usarla sin modificarla no impone esa obligación al resto del código (confirmar al
  adoptarla).

## Costo

Sin costo monetario (bibliotecas de código abierto, servidas desde GitHub Pages). Costo para el usuario: descarga de
la biblioteca al abrir el módulo (**por medir**).

## Mantenimiento

Actualizar las versiones de forma deliberada (no automática), con las pruebas de referencia del módulo (sección 13)
antes de publicar. Revisar avisos de seguridad de cada dependencia.

## Licencia

BSD-3-Clause (3Dmol.js, RDKit.js) y MIT (NGL): permisivas; exigen conservar el aviso de copyright y el texto de la
licencia al redistribuir. MPL-2.0 (Pyodide): ver «Consecuencias». Los paquetes de Python que cargue Pyodide tienen
licencias propias, a revisar uno por uno.
