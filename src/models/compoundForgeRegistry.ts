import raw from '../data/quimica/compuestos-pubchem.json';

/**
 * Registro en PubChem de los compuestos del Taller de formación de compuestos (archivo precalculado por
 * scripts/validacion/compuestos_pubchem.mjs con consultas reales a PubChem PUG REST; fecha y método en el archivo).
 * - «registrado»: se encontró por su NOMBRE un registro (CID) con la misma fórmula de Hill (o un múltiplo entero,
 *   p. ej. P₄O₁₀), o se encontró por la FÓRMULA y su título, nombre IUPAC o un sinónimo coincide con un nombre del motor
 *   (regla de src/models/pubchemNameMatch.ts; via: 'formula-sinonimo').
 * - «misma-formula» (fórmula registrada sin coincidencia de nombre): PubChem tiene un registro con la misma fórmula exacta,
 *   pero ningún nombre coincide; puede ser la misma sustancia con otro nombre o una estructura distinta (isómero).
 * - «formal»: no se encontró como sustancia registrada (o los registros con su fórmula describen otra estructura y se
 *   descartaron); la fórmula sale solo de la neutralidad de cargas.
 * Estar registrado no garantiza que la sustancia sea estable, y no estarlo no prueba que no exista.
 */

export interface RegistryEntry {
  formula: string;
  hill: string;
  cid: number | null;
  titulo?: string;
  formulaPubChem?: string;
  via?: 'nombre' | 'formula-sinonimo' | 'formula';
  consulta?: string;
  relacion?: 'igual' | 'multiplo';
  consultas?: string[];
  /** Nombre IUPAC de PubChem (registros hallados por la fórmula). */
  iupac?: string;
  /** Sinónimo de PubChem y nombre del motor que coinciden (via: 'formula-sinonimo'). */
  sinonimo?: string;
  nombreMotor?: string;
  /** CID con la misma fórmula descartados por describir otra estructura (regla 2 de pubchemNameMatch.ts). */
  descartados?: { cid: number; titulo: string; iupac?: string; motivo: string }[];
}

interface RegistryFile {
  fuente: string; fecha: string; script: string; metodo: string;
  combinaciones: number; total: number; registrados: number; formales: number;
  porNombre: number; porSinonimo: number; soloFormula: number; conDescartes: number;
  compuestos: Record<string, RegistryEntry>;
}

const data = raw as unknown as RegistryFile;

export const REGISTRY_META = {
  fuente: data.fuente, fecha: data.fecha, script: data.script, metodo: data.metodo,
  combinaciones: data.combinaciones, total: data.total, registrados: data.registrados, formales: data.formales,
  porNombre: data.porNombre, porSinonimo: data.porSinonimo, soloFormula: data.soloFormula, conDescartes: data.conDescartes,
};

export type RegistryStatus =
  | { status: 'registrado'; entry: RegistryEntry & { cid: number } }
  | { status: 'misma-formula'; entry: RegistryEntry & { cid: number } }
  | { status: 'formal'; entry: RegistryEntry }
  | { status: 'sin-informacion' };

export function registryStatus(key: string): RegistryStatus {
  const entry = data.compuestos[key];
  if (!entry) return { status: 'sin-informacion' };
  if (entry.cid === null) return { status: 'formal', entry };
  return { status: entry.via === 'formula' ? 'misma-formula' : 'registrado', entry: entry as RegistryEntry & { cid: number } };
}

export const registryEntries = (): Record<string, RegistryEntry> => data.compuestos;

export const pubchemUrl = (cid: number) => `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const pretty = (f: string) => f.replace(/(\d+)/g, (d) => [...d].map((c) => SUB[+c]).join(''));

/** Texto de la interfaz para el estado de registro. */
export function registryText(key: string): { title: string; detail: string } {
  const r = registryStatus(key);
  if (r.status === 'registrado') {
    const e = r.entry;
    const mult = e.relacion === 'multiplo' ? ` PubChem lo registra con la fórmula molecular ${pretty(e.formulaPubChem ?? '')}.` : '';
    if (e.via === 'formula-sinonimo') return { title: `Compuesto registrado en PubChem (CID ${e.cid})`, detail: `Registro «${e.titulo}», hallado por la fórmula ${pretty(e.hill)}; su nombre «${e.sinonimo}» coincide con el nombre del taller «${e.nombreMotor}» (misma fórmula; se comparan sin números de oxidación, cargas ni prefijos multiplicadores). Consulta del ${data.fecha}. Estar registrado no garantiza que la sustancia sea estable.` };
    return { title: `Compuesto registrado en PubChem (CID ${e.cid})`, detail: `Registro «${e.titulo}», hallado por el nombre «${e.consulta}» con la misma fórmula (consulta del ${data.fecha}).${mult} Estar registrado no garantiza que la sustancia sea estable.` };
  }
  if (r.status === 'misma-formula') {
    const e = r.entry;
    const desc = e.descartados?.length ? ` Se descartaron ${e.descartados.length} registro(s) con la misma fórmula que describen otra sustancia (por ejemplo, CID ${e.descartados[0].cid}: ${e.descartados[0].motivo}).` : '';
    return { title: `Fórmula registrada en PubChem (CID ${e.cid}), sin coincidencia de nombre`, detail: `Ningún nombre del compuesto coincide con el registro «${e.titulo}», que tiene la misma fórmula ${pretty(e.hill)} (consulta del ${data.fecha}).${desc} Puede ser la misma sustancia con otro nombre o una estructura distinta (isómero): compruébalo en PubChem.` };
  }
  if (r.status === 'formal') {
    const d = r.entry.descartados ?? [];
    const desc = d.length ? ` PubChem tiene ${d.length === 1 ? 'un registro' : `${d.length} registros`} con la misma fórmula, pero ${d.length === 1 ? 'describe' : 'describen'} otra sustancia y se ${d.length === 1 ? 'descartó' : 'descartaron'} (CID ${d[0].cid}, «${d[0].titulo}»: ${d[0].motivo}).` : '';
    return { title: 'Fórmula formal por neutralidad de cargas: no se encontró como sustancia registrada; puede no existir o ser inestable', detail: `Se buscó en PubChem por ${(r.entry.consultas ?? []).length} nombres y por la fórmula exacta (consulta del ${data.fecha}) sin coincidencias.${desc}` };
  }
  return { title: 'Sin información disponible sobre su registro en PubChem', detail: 'Este compuesto no está en el archivo precalculado.' };
}
