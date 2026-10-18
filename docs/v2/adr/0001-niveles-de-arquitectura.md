# 0001 · Niveles de arquitectura: primero el navegador

- **Estado:** Aceptada
- **Fecha:** 2026-10-18
- **Relacionado con:** prompt maestro, secciones 2, 4.1 y 7; `docs/v2/DIAGNOSTICO-FASE0.md` (sección 6); `server/README.md`;
  `docs/DESPLIEGUE-SERVIDOR.md`; ADR 0005

## Contexto

- El laboratorio es una aplicación React 19 + TypeScript 5.9 + Vite 7 (ver `package.json`) publicada como sitio
  estático en GitHub Pages por `.github/workflows/deploy.yml`. Funciona sin conexión como PWA (service worker generado
  por `scripts/build-sw.mjs`) y también como archivo único (`npm run build:single`).
- Dependencias de ejecución: solo `react`, `react-dom` y tres paquetes de fuentes `@fontsource/*`. Los modelos
  científicos son funciones puras en `src/models/` con ficha técnica `ModelSpec` (`src/models/types.ts`).
- Existe un **servidor Node opcional** (`server/`, solo módulos nativos `node:http`, `node:sqlite`, `node:crypto`) para
  recibir informes y hacer seguimiento del curso. Está preparado para Render (`Dockerfile`, `render.yaml`), pero
  **no está desplegado**: depende de la tarea T2 del docente (`docs/HOJA-DE-RUTA.md`).
- El prompt maestro define cuatro niveles (0 navegador, 1 funciones sin servidor/proxy, 2 backend científico,
  3 cómputo intensivo) y exige «primero el Nivel 0».
- El proyecto lo mantiene un docente; parte de los estudiantes usa equipos modestos y conexión limitada.

## Decisión

1. **Nivel 0 por defecto.** Toda capacidad nueva se implementa en el navegador (JavaScript o WebAssembly) si es
   posible, compatible con GitHub Pages y con el modo sin conexión. Las bibliotecas pesadas se cargan bajo demanda
   (ADR 0005).
2. **Niveles 1 y 2 solo por decisión del docente.** No se crea ninguna cuenta de servicio, función sin servidor ni
   backend científico sin que el docente lo apruebe por escrito (costo, responsable y política de datos). Mientras
   tanto, las capacidades que los necesitan (por ejemplo, BLAST del NCBI, docking, ADMET) se marcan
   **«bloqueado por infraestructura»** y la interfaz ofrece una alternativa honesta (enlace al servicio oficial o
   resultado precalculado rotulado como tal), nunca una ejecución simulada.
3. **El servidor Node existente se conserva** con su función actual (informes y seguimiento del curso). No se
   convierte en backend científico ni se reescribe; cualquier cambio de su API se hace con compatibilidad temporal
   (sección 4.1).
4. **Nivel 3 fuera de alcance.** GPU, GROMACS y cribado masivo no se implementan; se documentan como «no
   implementado» en la matriz de capacidades.
5. **Contrato de motores.** Cada motor científico nuevo expone entrada, salida, errores, versión y un estado
   (`disponible`, `degradado` o `no disponible`), y declara el nivel mínimo que requiere.

## Alternativas consideradas

| Alternativa | Resultado | Motivo |
|---|---|---|
| Reescribir con Next.js (u otro marco con servidor) | Rechazada | Rompe rutas, contratos y pruebas existentes (sección 4.1); exige hosting con servidor y su costo; no aporta capacidad científica nueva |
| Backend FastAPI (Python) desde ahora | Rechazada por ahora | Requiere hosting, cola de trabajos y operación permanente; el docente no lo ha decidido. Se reconsiderará en las fases 6–7 si un módulo lo exige |
| Ampliar el servidor Node existente con cálculo científico | Rechazada | El ecosistema científico (Biopython, COBRApy, AutoDock Vina) es de Python o binarios nativos; mezclaría responsabilidades en un servicio pensado para informes |
| Nivel 0 con carga diferida (elegida) | Aceptada | Sin costo de hosting, funciona sin conexión, mínimo mantenimiento, conserva lo existente |

## Consecuencias

- Positivas: costo cero de infraestructura; sin datos de estudiantes en servidores de terceros por defecto; la
  aplicación sigue funcionando sin conexión.
- Negativas: algunas capacidades del prompt (BLAST real, docking, ADMET con modelos grandes) quedan bloqueadas hasta
  una decisión del docente. Las consultas directas desde el navegador a APIs públicas dependen de que estas permitan
  CORS: **por verificar** servicio por servicio antes de integrarlas.
- Riesgo: el peso de las bibliotecas WebAssembly puede penalizar equipos modestos; se mitiga con carga bajo demanda y
  un presupuesto de rendimiento, que aún no existe por escrito (diagnóstico de la Fase 0, sección 2, fila «Equipos
  modestos y conexión limitada»).

## Costo

- Nivel 0: sin costo monetario (GitHub Pages). Costo de desarrollo: el de cada módulo.
- Servidor Node: costo del plan de Render que elija el docente (**por verificar** al desplegar).
- Niveles 1 y 2: costo por definir cuando el docente decida; no se asume ninguno.

## Mantenimiento

- Nivel 0: actualizar dependencias con versión fijada y volver a ejecutar las pruebas (`npm test`, `npm run test:e2e`).
- Servidor Node: copias de seguridad del archivo SQLite y actualización de Node.js ≥ 22.13 (`server/README.md`).
- Cada nivel adicional suma una pieza que alguien debe operar; por eso solo se añade por decisión explícita.

## Licencia

- Código del laboratorio: **por verificar** (no se encontró un archivo `LICENSE` en la raíz; `package.json` declara
  `"private": true` y no tiene campo `license`).
- Dependencias actuales: ver `docs/v2/LICENCIAS.md`. Nuevas bibliotecas: ADR 0005.
