# Tabla de licencias y fuentes de datos

Fecha: 2026-10-18 · Prompt maestro, sección 14.4. Se actualiza cada vez que se añade, quita o actualiza una
dependencia o un servicio externo (ADR 0005).

Método de verificación: versión fijada en `package.json`; licencia leída del campo `license` de
`node_modules/<paquete>/package.json` instalado y contrastada con `package-lock.json`.

## 1. Código del laboratorio

| Elemento | Licencia | Observación |
|---|---|---|
| Código fuente del repositorio | **Por verificar** | No hay archivo `LICENSE` en la raíz; `package.json` declara `"private": true` y no tiene campo `license`. El docente debe decidir la licencia antes de aceptar contribuciones o redistribuir |
| Logo institucional (`scripts/guias/assets/LOGO_COLEGIOS.png`) | Propiedad de la institución | Uso autorizado: **por verificar** con la institución. Solo se usa en las guías en PDF |

## 2. Dependencias de ejecución (`dependencies`)

Se distribuyen con la aplicación publicada.

| Paquete | Versión | Licencia | Obligaciones principales |
|---|---|---|---|
| `react` | 19.3.0 | MIT | Conservar el aviso de copyright y la licencia |
| `react-dom` | 19.3.0 | MIT | Ídem |
| `@fontsource/atkinson-hyperlegible` | 5.2.6 | OFL-1.1 | Fuente: se puede usar, empaquetar y redistribuir con el software; no se vende sola; conservar la licencia; las versiones modificadas no pueden usar el nombre reservado de la fuente |
| `@fontsource/bricolage-grotesque` | 5.2.8 | OFL-1.1 | Ídem |
| `@fontsource/jetbrains-mono` | 5.2.6 | OFL-1.1 | Ídem |
| `3dmol` (3Dmol.js) | 2.5.5 | BSD-3-Clause | Conservar el aviso de copyright y la licencia: se publica en `licencias/3dmol-LICENSE.txt` (copia de `node_modules/3dmol/LICENSE`). Incorpora código de GLmol, Three.js y jQuery según su LICENSE; el fragmento minificado parece incluir pako (licencia **por verificar**). Citar: Rego, N. y Koes, D. (2015), *Bioinformatics* 31(8), doi:10.1093/bioinformatics/btu829 (tomado de su `CITATION.cff`). Se carga solo en la práctica de geometría; se incluye en la descarga para uso sin conexión. Sin WebGL o sin 3Dmol.js, la práctica usa una vista de respaldo en SVG propia |
| `qrcode` | 1.5.4 | MIT | Conservar el aviso de copyright; se carga bajo demanda al abrir el código QR |

Dependencia transitiva de ejecución: `scheduler` (MIT), requerida por `react-dom`.

Nota sobre las fuentes: el archivo `LICENSE` que trae cada paquete `@fontsource` contiene el texto de la SIL Open Font
License 1.1, pero su línea de titular dice «Google Inc.», que no corresponde necesariamente a los autores de cada
tipografía. Los titulares reales del copyright están **por verificar** en el repositorio original de cada fuente
antes de redactar la atribución en la interfaz.

## 3. Dependencias de desarrollo (`devDependencies`)

Se usan para compilar y probar; **no** se distribuyen en el sitio publicado.

| Paquete | Versión | Licencia |
|---|---|---|
| `@axe-core/playwright` | 4.10.2 | MPL-2.0 |
| `jsqr` | 1.4.0 | Apache-2.0 |
| `@types/qrcode` | 1.5.5 | MIT |
| `@playwright/test` | 1.56.1 | Apache-2.0 |
| `@types/node` | 22.15.30 | MIT |
| `@types/react` | 19.3.0 | MIT |
| `@types/react-dom` | 19.3.0 | MIT |
| `@vitejs/plugin-react` | 5.2.0 | MIT |
| `typescript` | 5.9.3 | Apache-2.0 |
| `vite` | 7.3.7 | MIT |
| `vitest` | 5.0.3 | MIT |

Resumen de las 146 entradas de `package-lock.json` (directas y transitivas) por licencia declarada: MIT 128,
Apache-2.0 6, ISC 5, OFL-1.1 3, MPL-2.0 2 (`axe-core` 4.10.3 y `@axe-core/playwright`), BSD-3-Clause 1
(`source-map-js`), CC-BY-4.0 1 (`caniuse-lite`, base de datos de compatibilidad de navegadores usada en la
compilación). Ninguna tiene licencia de copyleft fuerte (GPL o AGPL).

## 4. Herramientas fuera de `package.json`

| Herramienta | Uso | Licencia |
|---|---|---|
| Node.js ≥ 22.13 (`node:http`, `node:sqlite`, `node:crypto`) | Servidor opcional (`server/`) y scripts | **Por verificar** la licencia de la versión instalada en el servidor (Node.js se distribuye bajo licencia de tipo MIT con componentes de terceros) |
| ReportLab (Python) | Generación de guías en PDF (`npm run guias`), incluido su generador de código QR | BSD según los metadatos del paquete instalado en el entorno de desarrollo (5.0.1); la versión usada por el docente está **por verificar** |
| Fuente DejaVu Sans | Texto de las guías en PDF | **Por verificar** |

### Modelos y datos incluidos (Fase 6)

| Recurso | Uso | Licencia y condiciones |
|---|---|---|
| Modelo E. coli core (`e_coli_core`), archivo `cobra/data/textbook.xml.gz` del paquete `cobra` 0.32.1 (SHA-256 c674befd…f72a) | Práctica `metabolismo` (FBA), exportado a `src/data/ecoli_core.json` | **Por verificar:** el archivo no declara licencia; el paquete COBRApy se distribuye con licencia LGPL-2.0-or-later o GPL-2.0-or-later. Cita: Orth, Fleming y Palsson (2010), EcoSal Plus 4(1), doi:10.1128/ecosalplus.10.2.1 (verificada en PubMed, PMID 26443778) |

## 5. Bibliotecas candidatas (no instaladas)

Ver ADR 0005. Se añadirán a la sección 2 solo si se adoptan.

| Biblioteca | Versión en npm (2026-10-18) | Licencia según npm |
|---|---|---|
| NGL (`ngl`) | 2.5.0 | MIT |
| RDKit.js (`@rdkit/rdkit`) | 2026.9.1 | BSD-3-Clause |
| Pyodide (`pyodide`) | 314.0.7 | MPL-2.0 |

## 6. Servicios externos y bases de datos previstos

Antes de integrar cualquiera: leer y citar sus términos de uso y política de cuotas
vigentes, comprobar si permiten CORS desde el navegador, registrar la licencia de los datos que entregan y la forma de
atribución exigida, y documentarlo aquí con fecha.

| Servicio | Uso previsto (prompt) | Estado | Términos, cuotas y licencia de datos |
|---|---|---|---|
| NCBI (Entrez, BLAST) | Secuencias y BLAST (10.1, 10.2) | **Datos incluidos** en `secuencias` y `rastreo` (consultados el 2026-10-18); BLAST: ver docs/v2/BLAST.md | Verificar términos vigentes antes de integrar. El prompt menciona límites de solicitudes por segundo y de envíos BLAST que deben confirmarse en la documentación oficial |
| RCSB PDB | Estructuras experimentales (10.4) | **En uso** en `proteinas` (3I40, 2HHB, 2LZM, 1EMA incluidos; carga en vivo opcional) y metadatos en `rastreo` | CC0 1.0 (rcsb.org/pages/usage-policy, verificado el 2026-10-18) | Verificar términos vigentes antes de integrar |
| UniProt | Proteínas (10.2) | **Datos incluidos** en `secuencias` y `rastreo` (licencia CC BY 4.0 según la nota del agente: **por verificar** en uniprot.org antes de publicar) | Verificar términos vigentes antes de integrar |
| AlphaFold DB | Estructuras predichas (10.4) | **En uso** en `proteinas` (modelo AF-Q04671-F1 v6 incluido; carga en vivo opcional) | CC BY 4.0 según el campo `_pdbx_data_usage` del propio archivo; términos de la API: **por verificar** |
| PubChem (PUG REST y confórmeros 3D) | Geometría molecular (9.2); moléculas (10.5) | **En uso** desde la versión con la práctica `geometria`: 12 confórmeros (y desde 2.1.0, 38 más en el kit de química y sinónimos para validar la nomenclatura) incluidos en la aplicación (descargados el 2026-10-18, con CID, URL y SHA-256) y búsqueda en vivo opcional | El README de PubChem3D (ftp.ncbi.nlm.nih.gov/pubchem/Compound_3D/README, «Fair Use Disclaimer», leído el 2026-10-18) dice que NCBI no restringe el uso ni la distribución de los datos, aunque algunos depositantes pueden reclamar derechos sobre los datos originales; los confórmeros 3D los calcula PubChem. Atribución: CID, URL y fecha en la interfaz. Política de cuotas de PUG REST: **por verificar** (la página de documentación devolvió un desafío reCAPTCHA); el laboratorio espacia las solicitudes ≥ 0,5 s, una a la vez, con 15 s de tiempo máximo. CORS: permitido |

La única solicitud a terceros en tiempo de ejecución es la búsqueda opcional en PubChem de la práctica de geometría,
que el estudiante inicia a mano. Las fuentes tipográficas y los confórmeros incluidos van empaquetados con la aplicación.
