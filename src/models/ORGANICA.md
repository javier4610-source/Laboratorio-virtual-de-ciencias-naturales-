# Módulos de química orgánica (reutilizables)

Escritos para las prácticas `hidrocarburos`, `aromaticos` y `nomenclatura-organica` y pensados para que la práctica de
grupos funcionales y la de reacciones orgánicas los reutilicen **sin cambiar sus API públicas**. Todo corre en el navegador
(nivel 0), sin dependencias nuevas: no se usa RDKit.js (MinimalLib 2026.9.1 no incrusta en 3D ni tiene campos de fuerza;
verificado en `node_modules/@rdkit/rdkit/dist/RDKit_minimal.d.ts`).

| Módulo | Qué hace | Estatus de lo que produce |
|---|---|---|
| `organicGraph.ts` | Grafo molecular, lector/escritor de SMILES, fórmula, anillos, huella canónica, isomorfismo, lector de molfile | Modelo calculado |
| `organicNomenclature.ts` | Motor de nombres IUPAC 2013 (inglés y español) con explicación paso a paso y E/Z | Modelo calculado (validado contra PubChem) |
| `organicBuilder.ts` | Estado del constructor de moléculas → grafo, con validación de valencia | — |
| `organicLayout.ts` | Coordenadas 2D para fórmulas de esqueleto | Ilustración |
| `hydrocarbons.ts` | Propiedades con reglas de comparabilidad, combustión, geometría medida, conformaciones, halogenación, adición, pruebas | Mixto (declarado en cada función) |
| `aromaticity.ts` | Regla de Hückel, planaridad, orbitales de Hückel (HMO), orto/meta/para | Modelo calculado |
| `../data/quimica/organica.ts` | 74 moléculas de PubChem (SDF 3D sin modificar y propiedades experimentales con su fuente); sin dependencia del kit | Datos con procedencia |
| `../data/quimica/organicaSpecies.ts` | Puente al kit 3D: `orgSpecies(id)` → `Species3D`; `asChemMolecule(id)` → formato común `ChemMolecule` | — |
| `../components/organica/StructureSvg.tsx` | Fórmula estructural 2D (esqueleto o con H), cadena resaltada y localizadores | Ilustración |
| `../components/organica/OrganicViewer3D.tsx` | Visor 3D sobre el motor del kit con rótulos por átomo, resaltado y estatus elegible | Según `status` |
| `../components/organica/OrganicParts.tsx` | `ExpValue`, `SourceList`, `PubChemLink`, `StatusLine`, `TestTubeSvg` | — |

Datos y su origen: `scripts/validacion/organica_pubchem.py` (PubChem PUG REST y PUG View; reproducible).

## 1. Grafo y SMILES (`organicGraph.ts`)

```ts
interface OAtom { el: ElementSymbol; charge?: number; hCount?: number; aromatic?: boolean }   // H implícitos
interface OBond { a: number; b: number; order: 1 | 2 | 3; aromatic?: boolean }                 // aromáticos ya kekulizados
interface DoubleBondStereo { a: number; b: number; x: number; y: number; relation: 'cis' | 'trans' } // x vecino de a, y de b
interface OMolecule { atoms: OAtom[]; bonds: OBond[]; stereo: DoubleBondStereo[] }

parseSmiles('C/C=C/C')        // → ParsedSmiles (OMolecule + warnings); lanza SmilesError con mensaje en español
toSmiles(mol)                 // SMILES Kekulé no canónico (con / \); sirve para consultar PubChem
hillFormula(mol, pretty?)     // 'C4H8' o 'C₄H₈'
implicitH(mol, i); neighbors(mol, i); bondBetween(mol, i, j); ringInfo(mol); isConnected(mol)
canonicalKey(mol, withStereo?) // huella invariante (WL); independiente de la estructura de Kekulé elegida
mapHeavyAtoms(a, b)           // isomorfismo de átomos pesados (alinear con un SDF) o null
molFromMolfile(sdf)           // grafo + coordenadas de un molfile V2000 (H explícitos)
stripHydrogens(mol)           // { mol sin H, index: índice original de cada átomo }
```

Lee O, N, S, P, B, Si, halógenos, cargas e hidrógenos entre corchetes, de modo que los grupos funcionales ya se pueden
**representar**; lo que falta es **nombrarlos** (sección 2).

## 2. Motor de nomenclatura (`organicNomenclature.ts`)

```ts
nameSmiles('CC(C)CC(C)(C)C')   // { ok: true, en: '2,2,4-trimethylpentane', es: '2,2,4-trimetilpentano', ... }
nameMolecule(mol)              // NameResult = NameOk | { ok: false, motivo }   (nunca lanza ni inventa)
```

`NameOk` trae: `en`, `es`, `sistematico?` (si el preferido es retenido, p. ej. tolueno), `retenido?` (xileno, estireno…),
`parent` ({ kind: 'cadena' | 'anillo' | 'benceno' | 'naftaleno', atoms en orden de numeración, size }),
`locants` (Map átomo → número), `substituents`, `multiples`, `stereo` (E/Z), `pasos` (explicación en español), `clase`, `avisos`.

Reglas (Recomendaciones IUPAC 2013): anillo > cadena; cadena más larga → más enlaces múltiples → más dobles; numeración por
valencia libre → enlaces múltiples → dobles → prefijos → primer prefijo alfabético → nombre completo. Alfabetización por idioma.
`cipCompare(mol, centro, a, b)` compara ramas por CIP (regla 1a con duplicados).

**Validación**: `tests/unit/organicNomenclature.test.ts` frente al `IUPACName` de PubChem (LexiChem TK) en 188 estructuras:
173 idénticas, 4 solo paréntesis (2013), 8 nombres retenidos de uso general, 3 localizador «-1-» del cicloalqueno; 0 sin clasificar.

### Cómo ampliar a grupos funcionales (alcoholes, aldehídos, cetonas, ácidos, ésteres, éteres, aminas, amidas)

1. Hoy `nameInternal` rechaza elementos distintos de C y halógenos con `motivo`. Para ampliarlo, registrar grupos en
   `CHARACTERISTIC_GROUPS` (interfaz `CharacteristicGroup`: `detect`, `suffix`, `prefix`, `seniority`) y:
   - elegir el grupo principal por seniority (P-41) y contarlo como **primer criterio** de la cadena (más grupos principales);
   - tratar su localizador como `Candidate.fv` (ya ocupa el lugar correcto en la numeración: antes que los enlaces múltiples);
   - el sufijo se pega al progenitor con elisión de la «e» final ante vocal (`propan-2-ol`, `propanal`, `butan-2-ona`) y conserva
     la «e» ante consonante (`propano-1,2-diol`); `unsaturationEnding(c, lang, tail)` ya resuelve elisiones con un `tail` distinto.
2. Los grupos que no son principales van como prefijos (`hydroxy/hidroxi`, `oxo`, `amino`) con `Prefix.simple = true`.
3. Agregar sus fragmentos a `SUBSTITUENTS` de `organicBuilder.ts` (p. ej. `{ id: 'oh', smiles: 'O', bond: 1, group: … }`).
4. Ampliar `tests/fixtures/pubchem-nomenclatura.json` con el mismo script (lista `NOMENCLATURA`) y clasificar cada diferencia.

No cambies la firma de `nameMolecule`/`nameSmiles` ni la forma de `NameOk`: los laboratorios dependen de ellas.

## 3. Constructor (`organicBuilder.ts`)

```ts
const s = emptyState({ kind: 'cadena', n: 5 });   // también { kind: 'anillo', n: 6 } o { kind: 'benceno' }
s.subs[1] = ['metil']; s.bondOrders[2] = 2; s.stereo[2] = 'trans';
const { mol, errors, skeletonAtoms } = buildMolecule(s);
canAddSub(s, pos, id); canSetBond(s, k, order); freeValence(s, pos); stereoPossible(s, k, mol, skeletonAtoms); resizeState(s, nuevo)
```

## 4. Componentes

```tsx
<StructureSvg mol={mol} mode="esqueleto" highlight={nm.parent.atoms} locants={nm.locants} title="…" />
<OrganicViewer3D atoms={sp.atoms} bonds={sp.bonds} idPrefix="xyz" viewKey={id} status="modelo" statusPrefix="Geometría"
  labels={[…]} highlight={[…]} provenance={<>…</>} ariaLabel="…" styleLabel="Estilo del modelo de …" />
```

Para vistas 3D y reacciones normales usa el kit (`src/chem/README.md`): `Molecule3D`, `Reaction3D` y `orgSpecies(id)`.

## 5. Datos (`src/data/quimica/organica.ts`)

`ORGANIC_RECORDS`, `getOrganic(id)`, `prettyHill(f)`; cada registro: formato común del kit + `propiedades.{tEb,tFus,densidad,dHc}`
(texto literal, base de PubChem, obra citada, URL de PUG View y fecha). Para usar una propiedad en una comparación pasa por las
funciones de `hydrocarbons.ts` (`liquidDensity`, `combustionEnthalpy`), que rechazan datos no comparables con un motivo.
Los 188 confórmeros de validación (`organica-nomenclatura.json`, solo molfile) se cargan con `import()` diferido.
