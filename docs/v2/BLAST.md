# BLAST real del NCBI: reglas verificadas, proxy y resultado grabado

- **Fecha de verificación:** 2026-10-18 (documentación leída ese día desde el entorno de desarrollo).
- **Relacionado con:** prompt maestro, secciones 4, 7, 10.1, 11, 13 y 14; ADR 0001; `docs/v2/DIAGNOSTICO-FASE0.md`
  (tabla de acceso: `Blast.cgi` responde pero **sin cabecera CORS**, por eso hace falta el proxy de Nivel 1).
- **Código:** `server/blast.mjs` (proxy), `src/lib/blast.ts` (cliente), `src/components/BlastPanel.tsx` (interfaz).
- **Pruebas:** `tests/server/blast.test.ts`, `tests/unit/blastClient.test.ts` (respuestas grabadas, sin red).

## 1. Reglas del NCBI (citas textuales)

### 1.1 BLAST: «Developer Information», sección *Usage Guidelines*

Fuente: <https://blast.ncbi.nlm.nih.gov/doc/blast-help/developerinfo.html> (cabecera `Last-Modified: Tue, 16 Jun 2026
19:14:41 GMT`; leída el 2026-10-18).

> The NCBI BLAST servers are a shared resource. We give priority to interactive users. […] We will move searches of
> users who submit more than 100 searches in a 24 hour period to a slower queue, or, in extreme cases, will block the
> requests. To avoid problems, API users should comply with the following guidelines:
>
> - Do not contact the server more often than once every 10 seconds.
> - Do not poll for any single RID more often than once a minute.
> - Use the URL parameter email and tool, so that the NCBI can contact you if there is a problem.
> - Run scripts weekends or between 9 pm and 5 am Eastern time on weekdays if more than 50 searches will be submitted.

> BLAST often runs more efficiently if multiple queries are sent as one search […] If your queries are short (less
> than a few hundred bases) we suggest you merge them into one search of up to 1,000 bases

> The NCBI servers are a shared resource and not intended for projects that involve a large number of BLAST searches.
> We provide the Stand-alone BLAST+ binaries, Docker Image and Elastic BLAST for these purposes.

> Projects that involve a large number of BLAST searches should use the RESTful interface at a cloud provider or
> stand-alone BLAST.

Licencia del software: «BLAST is public domain software.» (misma página).

Observación: la regla de 10 s dice *contact the server*, no solo *submit*. El proxy la aplica a **todo** contacto
(envíos y consultas de estado comparten una sola cola).

### 1.2 BLAST: «Common URL API»

Fuente: <https://blast.ncbi.nlm.nih.gov/doc/blast-help/urlapi.html> (`Last-Modified: Tue, 16 Jun 2026 19:14:41 GMT`).

- `CMD=Put` envía (obligatorios `QUERY`, `DATABASE`, `PROGRAM`); `CMD=Get` con `RID` consulta el estado o el resultado.
- `PROGRAM`: «One of blastn, blastp, blastx, tblastn, tblastx». `DATABASE`: «Database file name (e.g.: core_nt,
  swissprot)». `HITLIST_SIZE` por defecto 100. `EXPECT` por defecto 10. `FORMAT_TYPE`: HTML, Text, XML2, XML2_S,
  JSONSA, JSON2, JSON2_S, SAM.
- «Parameters not listed are not supported and should not be relied upon by users of this API.» Por eso el proxy
  **no** usa `FORMAT_OBJECT=SearchInfo` (no está en la tabla): consulta con `CMD=Get&FORMAT_TYPE=JSON2_S` y lee el
  bloque `QBlastInfo` (`Status=WAITING`, `FAILED`, `UNKNOWN`) o el JSON final.
- `NO_DATABASE_OVERRIDE` (experimental): «Do not automatically switch nt to core_nt».
- `email` y `tool` no aparecen en esa tabla; los pide la página de 1.1.
- La URL API **no documenta** cómo cancelar una búsqueda: «cancelar» en el proxy significa dejar de consultar.

Mirror alternativo indicado en el encargo (<https://ncbi.github.io/blast-cloud/dev/api.html>): **por verificar**
(el proxy de red del entorno respondió 403 a `ncbi.github.io`).

### 1.3 E-utilities y condiciones generales del NCBI

- Manual de E-utilities, «Usage Guidelines and Requirements» (<https://www.ncbi.nlm.nih.gov/books/NBK25497/>):
  **por verificar** (la página devolvió una verificación reCAPTCHA en lugar del contenido).
- «NCBI Website and Data Usage Policies and Disclaimers» (<https://www.ncbi.nlm.nih.gov/home/about/policies/>, leída
  el 2026-10-18), sección *Guidelines for Scripting Calls to NCBI Servers*:

  > Run retrieval scripts on weekends or between 9 pm and 5 am Eastern Time weekdays for any series of more than 100
  > requests. Send E-utilities requests to https://eutils.ncbi.nlm.nih.gov, not the standard NCBI Web address. Make no
  > more than 3 requests every 1 second. Use the URL parameter email, and tool for distributed software […]
  > NCBI's Disclaimer and Copyright notice must be evident to users of your service.

  El límite de 10 solicitudes por segundo con clave de API que menciona el prompt **no aparece** en esta página:
  **por verificar** en el manual de E-utilities.
- *Molecular Data Usage* (misma página): «NCBI itself places no restrictions on the use or distribution of the data
  contained therein. […] some submitters of the original data […] may claim patent, copyright, or other intellectual
  property rights». El panel enlaza esta página de políticas (aviso legal y derechos de autor) junto a cada búsqueda.

### 1.4 Nombres de bases de datos y enlace al formulario web

- Nombres tomados de las opciones del formulario oficial (`Blast.cgi?PROGRAM=blastn|blastp&PAGE_TYPE=BlastSearch`,
  consultado el 2026-10-18) y presentes también en <https://ftp.ncbi.nlm.nih.gov/blast/db/>:
  nucleótidos `core_nt`, `refseq_select_rna`, `refseq_rna`; proteínas `swissprot`, `refseq_select_prot`,
  `refseq_protein`. Se excluyen `nt` y `nr` por tamaño (búsquedas más largas y más carga para un servicio compartido).
- Enlace al formulario web: `PROGRAM` y `PAGE_TYPE=BlastSearch` aparecen en los enlaces de la página de inicio de
  BLAST. El relleno con `QUERY=` **no está documentado** para el formulario web; se observó el 2026-10-18 que la
  página devuelta trae la secuencia en el cuadro `QUERY`. Como puede cambiar sin aviso, el panel ofrece además
  «Copiar secuencia».

## 2. Cómo cumple el proxy (`server/blast.mjs`)

| Regla | Implementación | Prueba |
|---|---|---|
| ≤ 1 contacto cada 10 s | Cola global única; envíos y consultas esperan `lastContact + 10 s`. El mínimo no se puede bajar por configuración. | «respeta ≥ 10 s…», «los intervalos no pueden configurarse por debajo del mínimo» |
| ≤ 1 consulta por minuto por RID | Primera consulta a `max(60 s, RTOE)`; luego cada 60 s. | ídem |
| `tool` y `email` | `NCBI_TOOL`, `NCBI_EMAIL` del entorno; sin `NCBI_EMAIL` el servicio queda desactivado. | «sin NCBI_EMAIL…», «configuración desde el entorno» |
| > 100 búsquedas/24 h → cola lenta | Tope diario global (`BLAST_DAILY_LIMIT`, 100 por defecto) y 20 envíos/hora por IP. | «límite por cliente…», «tope diario…» |
| Recurso compartido | Caché 24 h de búsquedas idénticas; las consultas del navegador leen memoria y no tocan el NCBI. | «consultar el estado desde el navegador no genera contactos…» |
| Tareas largas (prompt §7) | Tiempo de espera por solicitud 30 s, 2 reintentos, tiempo máximo 120 min, cancelación. | «reintentos acotados», «FAILED o UNKNOWN…», «cancelar…» |

Estados devueltos: `en-cola`, `ejecutando`, `completado`, `fallido`, `cancelado`. El navegador consulta el proxy cada
≥ 60 s (`src/lib/blast.ts`).

## 3. Búsqueda real grabada (prompt §10.1 «Validación» y §13)

Archivos: `tests/fixtures/blast/2026-10-18-hbb-blastn-refseq_select_rna/` (`meta.json` con todos los detalles).

| Dato | Valor (tal como lo informó el NCBI) |
|---|---|
| Consulta | Nucleótidos 1-90 de la CDS de NM_000518.5 (HBB, *Homo sapiens*), obtenidos con efetch el 2026-10-18 |
| Programa | blastn (`BLASTN 2.17.0+`), `EXPECT=10`, `HITLIST_SIZE=10` |
| Base de datos | `refseq_select_rna`, «RefSeq Select RNA sequences», 60 444 secuencias, 191 995 482 letras |
| Fecha de la base | «Posted date: Oct 13, 2026 2:43 AM» (sin zona horaria en el informe) |
| RID | D9HJG79C016 |
| Envío | 2026-10-18T13:14:55Z (RTOE = 1 s) |
| Resultado obtenido | 2026-10-18T14:22:22Z |
| Primer acierto | NM_000518.5, «Homo sapiens hemoglobin subunit beta (HBB), mRNA»: 90/90 idénticos (100 %), cobertura 100 %, 163.589 bits, E = 6.92717e-40, posiciones 51-140 del ARNm (= inicio de la CDS 51..494) |
| Siguientes | NM_000519 (HBD humano, 84/90), NM_008220 y NM_001201391 (ratón, 77/90), … |

Observaciones honestas:

- El envío se hizo **sin `email`**: en el entorno no había un correo autorizado para enviar al NCBI. Solo se envió
  `tool=lvcn-laboratorio`. En producción el servidor exige `NCBI_EMAIL`.
- La búsqueda siguió en `Status=WAITING` («Status Searching») en las 37 consultas hechas entre 13:15:58Z y 13:58:17Z
  y estaba lista en la consulta de 14:22:22Z. No se sabe por qué tardó tanto (posibles causas, **no verificadas**: carga
  del NCBI, o la IP compartida del entorno en la «slower queue»). Por eso el tiempo máximo por defecto es 120 min.
- Una segunda búsqueda (RID D9KBW4N7014, blastn con `MEGABLAST=on`, misma consulta y base, enviada 13:45:32Z) seguía en
  `WAITING` a las 14:22:50Z; se dejó de consultar y no se grabó.
- En `submit.html` y `status-waiting.html` se reemplazaron las metaetiquetas `ncbi_sessionid` y `ncbi_phid` por
  `REDACTADO`. `result.json` y `result.txt` están sin cambios.
- `src/data/blast/registro-hbb-refseq_select_rna.json` es el resumen que muestra la interfaz («Resultado grabado el …
  (no es una búsqueda en vivo)»); se generó con `parseJson2` y una prueba comprueba que coincide con `result.json`.
- Las pruebas que necesitan casos que esta búsqueda no cubre (varios HSP, proteínas) usan una estructura JSON2
  **sintética** rotulada como tal en `tests/server/blast.test.ts`; nunca se muestra en la interfaz.

Prueba real periódica (prompt §13): **no implementada**. Repetir esta búsqueda a mano (o en un flujo programado con
`NCBI_EMAIL`) y comparar con `meta.json`; el resultado puede cambiar con cada versión de la base de datos.

## 4. Mensajes obligatorios en la interfaz

`BlastPanel` muestra con cada resultado: que depende de la base de datos y de la fecha; que una identidad alta no
implica función idéntica; que se anote fecha, base, versión y RID. Sin servidor o con el servicio caído: «Servicio no
disponible», enlace al formulario oficial, «Copiar secuencia» y, si el estudiante lo pide, el resultado grabado
rotulado. Nunca se generan resultados.
