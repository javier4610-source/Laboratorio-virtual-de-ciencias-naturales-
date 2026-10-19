# Kit de química 3D (`src/chem/`)

Kit compartido para las prácticas de química: visor molecular, «reacción en 3D» y redes cristalinas, con
procedencia visible en cada vista. Todo funciona sin conexión salvo la descarga diferida de 3Dmol.js (que el
service worker cachea); sin WebGL o sin 3Dmol hay una vista de respaldo en SVG con las **mismas coordenadas**.

Importa desde `src/chem` (archivo `index.ts`) o desde cada módulo:

```ts
import { Molecule3D, Reaction3D, Crystal3D, moleculeSpecies, atomSpecies, latticeFragment, getCrystal, buildVsepr } from '../chem';
```

## 1. Especies (`species.ts`, `molecules.ts`)

Todas las vistas trabajan con `Species3D`:

```ts
interface Species3D {
  id: string; name: string; label: string;            // label = fórmula Unicode: 'H₂SO₄', 'SO₄²⁻'
  atoms: { el: string; x: number; y: number; z: number; charge?: number }[];   // Å
  bonds: { a: number; b: number; order: 1 | 2 | 3 | 4 }[];                     // índices desde 0
  charge: number;
  geometry: 'pubchem' | 'vsepr' | 'cristal' | 'atomo';
  geometryLabel: string;   // rótulo visible: empieza por el estatus («Modelo calculado: …»)
  method: string;          // método y supuestos en una frase
  source?: { cid?: number; url: string; fecha: string; sha256?: string };
}
```

### Biblioteca (`MOLECULES`, formato común `ChemMolecule`)

`{ id, nombre, nombreIupac, formula, cid, smiles, sdf, fuente: { url, fecha, sha256 } | null, geometria, categoria }`

- **38 confórmeros 3D de PubChem** (SDF sin modificar, SHA-256 verificado en las pruebas), descargados con
  `NODE_USE_ENV_PROXY=1 node scripts/validacion/quimica_fetch.mjs` → `src/data/quimica/molecules3d.ts`.
  El script busca el CID por nombre en inglés (PUG REST), **verifica la fórmula de Hill** y descarga
  `…/cid/<CID>/SDF?record_type=3d`. Rótulo: «Modelo calculado: confórmero 3D de PubChem (MMFF94s)».
  Ids: `agua oxigeno nitrogeno cloro hcl hf hbr hi h2s amoniaco co co2 so2 so3 n2o n2o3 n2o5 h2o2 hno3 hno2 h2so4
  h2so3 h3po4 h2co3 hclo cl2o p4o10 p4o6 metano etano propano butano eteno etino benceno metanol etanol glucosa`.
- **Sin confórmero en PubChem** (respuesta 404; no se dibujan a mano): geometría VSEPR calculada por el kit
  (`buildVsepr`, direcciones ideales + longitudes = suma de radios covalentes de Pyykkö). Rótulo:
  «Modelo calculado: geometría VSEPR ideal con longitudes de enlace de radios covalentes (Pyykkö)».
  Ids: `hidrogeno no no2 hclo2 hclo3 hclo4` e iones `hidroxido hidronio amonio sulfato hidrogenosulfato sulfito
  nitrato nitrito carbonato hidrogenocarbonato fosfato perclorato clorato clorito hipoclorito permanganato cromato`.
- `WITHOUT_GEOMETRY`: especies buscadas sin 3D ni geometría del kit (hoy Cl₂O₇): se informan, no se dibujan.

```ts
const etanol = moleculeSpecies('etanol');           // Species3D desde el SDF de PubChem
const mg = atomSpecies('Mg', 'magnesio');           // átomo aislado («Ilustración educativa»)
const ion = buildVsepr({ id: 'x', name: 'Ion amonio', label: 'NH₄⁺', center: 'N', centerCharge: 1,
  ligands: [{ el: 'H', order: 1 }, { el: 'H', order: 1 }, { el: 'H', order: 1 }, { el: 'H', order: 1 }], lonePairs: 0 });
```

**Para añadir moléculas orgánicas** (p. ej., hidrocarburos): agrega una línea a `LISTA` en
`scripts/validacion/quimica_fetch.mjs` (`[id, nombre, nombre en inglés, fórmula de Hill, 'organica']`), ejecuta el
script y añade la fórmula Unicode al mapa `DISPLAY` de `molecules.ts` (si falta, se muestra la de Hill). Si el script
dice «sin 3D», la especie va a `PUBCHEM_MISSING_3D`: no la dibujes a mano. Alternativa sin tocar la biblioteca: usa
`speciesFromSdf(sdfDescargado, meta)` con tus propios datos y procedencia.

Compuestos iónicos dentro de reacciones: `ionAssembly(id, nombre, fórmula, [especies])` coloca iones (p. ej. `singleAtom('na+', 'Ion sodio', 'Na', 1, 'Na⁺')` y `moleculeSpecies('hidroxido')`) en fila, sin enlaces, con el rótulo «Ilustración educativa: iones dibujados por separado…». Ejemplos de uso en `src/labs/inorganicReactions3d.ts` (13 reacciones probadas).

Utilidades: `toSdf`, `toXyz`, `elementCounts`, `hillFormulaOf`, `atomDistance`, `atomAngle`, `describeSpecies`.

## 2. `<Molecule3D>` — visor molecular

```tsx
<Molecule3D species={moleculeSpecies('h2so4')} idPrefix="oxh" height={280} defaultStyle="bs" controls measure />
```

| Prop | Uso |
|---|---|
| `species` | `Species3D` a mostrar |
| `idPrefix` | prefijo **único** de ids en tu laboratorio |
| `height` | alto en px (por defecto 300) |
| `defaultStyle` | `'bs'` esferas y palitos · `'esf'` espacio lleno · `'pal'` palitos |
| `controls` | estilo, nombres de átomos, giro continuo, girar 90°, centrar (por defecto `true`) |
| `measure` | elegir 2 átomos (distancia) o 3 (ángulo) con clic o con las listas «Átomo 1/2/3 de la medición en <fórmula>» |
| `extraDescription` | texto añadido a la descripción accesible |

Muestra el chip de estatus («Geometría: Modelo calculado») con el CID enlazado y la fecha. Etiquetas visibles de
los controles: «Estilo del modelo de <fórmula>», «Nombres de los átomos», «Girar continuamente», «Girar 90°», «Centrar».

## 3. `<Reaction3D>` — reacción en 3D

```tsx
import type { Reaction3DDef } from '../chem';
const combustion: Reaction3DDef = {
  id: 'metano', title: 'Combustión del metano',
  reactants: [{ species: moleculeSpecies('metano'), coef: 1, formula: 'CH4' }, { species: moleculeSpecies('oxigeno'), coef: 2, formula: 'O2' }],
  products: [{ species: moleculeSpecies('co2'), coef: 1, formula: 'CO2' }, { species: moleculeSpecies('agua'), coef: 2, formula: 'H2O' }],
};
<Reaction3D def={combustion} idPrefix="hco" height={300} />   // define `def` fuera del componente o con useMemo
```

- `coef` = coeficiente balanceado; `formula` = fórmula ASCII del término; cada copia 3D debe tener exactamente los
  átomos de `perInstance × formula` (`perInstance` por defecto 1; usa 2 si la especie es un fragmento con 2 unidades
  fórmula, p. ej. `latticeFragment(getCrystal('mgo'), 2)` con `coef: 2, perInstance: 2`).
- Lanza `RangeError` si los átomos no se conservan o si una especie no coincide con su fórmula.
- Mapeo de átomos automático (por elemento + intercambios que minimizan el desplazamiento) o `mapping` explícito.
- Controles: «Reproducir la reacción» / «Pausar la reacción», «Paso anterior», «Paso siguiente», «Reiniciar»,
  deslizador «Avance de la reacción» (0–100 %), «Velocidad de la animación» (0,5× 1× 2×), «Estilo de la reacción 3D».
  Con `labelSuffix` se añade un texto a esas etiquetas si hay dos visores en la misma página.
- Con `prefers-reduced-motion` (o la preferencia de la app) la reproducción avanza por los 5 pasos discretos
  (`STEPS`: reactivos separados → juntos → reorganización → productos juntos → separados).
- Siempre visible: ecuación balanceada sincronizada (se resalta el lado activo), tabla de conteo de átomos
  (reactivos / en este instante / productos) y el rótulo obligatorio
  «Ilustración educativa: interpolación entre geometrías calculadas de reactivos y productos; no representa el mecanismo ni la trayectoria real de la reacción».
- Funciones puras (para pruebas): `buildReactionScene`, `framePositions(scene, t)`, `frameBonds`, `countsAt`,
  `bondChanges`, `checkBalanced`, `equationText` («CH₄ + 2 O₂ → CO₂ + 2 H₂O»).

## 4. `<Crystal3D>` — redes cristalinas iónicas

```tsx
<Crystal3D crystal={getCrystal('nacl')} idPrefix="acs" height={300} />
```

Cristales (`CRYSTALS`): `nacl` (a = 5,6402 Å), `kcl` (6,2931), `mgo` (4,2112), `cao` (4,8105), `caf2` (5,4626),
`cscl` (4,123); parámetros de Wyckoff (1963), densidades del CRC Handbook (97.ª ed.). Calcula: posiciones
`generateLattice(c, n)`, `cationAnionDistance` (= a/2 en la halita), `coordinationNumber(c, 'cation'|'anion')`,
`calculatedDensity` (ρ = Z·M/(N_A·a³)), `densityDeviation` (todas < 1,5 %), `shannonSum`, `coordinationShell`,
`latticeFragment(c, unidades)`. Rótulo: «Modelo calculado: red generada a partir del parámetro de red publicado».
Controles: «Bloque de celdas», «Tamaño de los iones», «Coordinación de», «Mostrar las aristas de la celda».

## 5. Motor y respaldo

`engine3d.ts`: `load3Dmol()` (importación diferida de `3dmol/build/3Dmol.es6-min.js`, el mismo fragmento que
GeometryLab), `webglAvailable()`, `use3DViewer(hostRef, tag)` → `{ viewerRef, engine, retry, fail }` con estados
`cargando | disponible | sin-webgl | no-disponible` (avisos con `console.warn`), `useThemeVersion()`.
`ProjectedSvg.tsx`: respaldo SVG (arrastrar, flechas, Inicio), con `extentHint` para animaciones.

## 6. Pruebas

`tests/unit/chemKit.test.ts` (18 pruebas): SHA-256 y fórmula de cada SDF, rótulos, VSEPR (ángulos y longitudes),
ida y vuelta SDF, red NaCl (Na–Cl = a/2, 6:6, 27 iones en la celda dibujada, 4 unidades fórmula, densidad 2,1635
calculada vs 2,17 publicada), fluorita 8:4, CsCl 8:8, mapeo biyectivo y conservación de átomos en todo t, rechazo de
ecuaciones no balanceadas.

## Reglas de integridad

- Nunca dibujes coordenadas a mano: usa PubChem, `buildVsepr` (método declarado) o `crystal.ts`.
- No muestres una animación sin `<Reaction3D>` (que lleva su rótulo) o sin un rótulo equivalente.
- Los colores de los átomos son convención CPK/Jmol (de dibujo).
