import { useEffect, useState } from 'react';
import type { PracticeDef } from '../core/types';
import { balancePractice } from '../assessment/balance';
import { ensureTransferQuestions } from '../assessment/lookup';
import { isChunkLoadError, retryableThen } from '../lib/importar';

/**
 * Carga bajo demanda del contenido completo de cada práctica (texto, preguntas,
 * ficha del modelo). Así el navegador descarga solo lo que el estudiante abre.
 */
const LOADERS: Record<string, () => Promise<PracticeDef>> = {
  'estados-de-la-materia': retryableThen(() => import('./practices/estados-de-la-materia'), (m) => m.estadosDeLaMateria),
  'cambios-quimicos': retryableThen(() => import('./practices/cambios-quimicos'), (m) => m.cambiosQuimicos),
  'movimiento-circular': retryableThen(() => import('./practices/movimiento-circular'), (m) => m.movimientoCircular),
  lentes: retryableThen(() => import('./practices/lentes'), (m) => m.lentes),
  'magnetismo-imanes': retryableThen(() => import('./practices/magnetismo-imanes'), (m) => m.magnetismoImanes),
  'efecto-invernadero': retryableThen(() => import('./practices/efecto-invernadero'), (m) => m.efectoInvernadero),
  'homeostasis-glucosa': retryableThen(() => import('./practices/homeostasis-glucosa'), (m) => m.homeostasisGlucosa),
  'clasificacion-seres-vivos': retryableThen(() => import('./practices/clasificacion-seres-vivos'), (m) => m.clasificacionSeresVivos),
  'sistema-circulatorio': retryableThen(() => import('./practices/sistema-circulatorio'), (m) => m.sistemaCirculatorio),
  'sistema-nervioso': retryableThen(() => import('./practices/sistema-nervioso'), (m) => m.sistemaNervioso),
  meiosis: retryableThen(() => import('./practices/meiosis'), (m) => m.meiosis),
  'pila-electroquimica': retryableThen(() => import('./practices/pila-electroquimica'), (m) => m.pilaElectroquimica),
  'configuracion-electronica': retryableThen(() => import('./practices/configuracion-electronica'), (m) => m.configuracionElectronica),
  'modelos-atomicos': retryableThen(() => import('./practices/modelos-atomicos'), (m) => m.modelosAtomicos),
  'tabla-periodica': retryableThen(() => import('./practices/tabla-periodica'), (m) => m.tablaPeriodica),
  'enlace-quimico': retryableThen(() => import('./practices/enlace-quimico'), (m) => m.enlaceQuimico),
  electrostatica: retryableThen(() => import('./practices/electrostatica'), (m) => m.electrostatica),
  densidad: retryableThen(() => import('./practices/densidad'), (m) => m.densidad),
  osmosis: retryableThen(() => import('./practices/osmosis'), (m) => m.osmosis),
  mendel: retryableThen(() => import('./practices/mendel'), (m) => m.mendel),
  adn: retryableThen(() => import('./practices/adn'), (m) => m.adn),
  soluciones: retryableThen(() => import('./practices/soluciones'), (m) => m.soluciones),
  enzimas: retryableThen(() => import('./practices/enzimas'), (m) => m.enzimas),
  circuitos: retryableThen(() => import('./practices/circuitos'), (m) => m.circuitos),
  estequiometria: retryableThen(() => import('./practices/estequiometria'), (m) => m.estequiometria),
  poblacion: retryableThen(() => import('./practices/poblacion'), (m) => m.poblacion),
  mitosis: retryableThen(() => import('./practices/mitosis'), (m) => m.mitosis),
  ondas: retryableThen(() => import('./practices/ondas'), (m) => m.ondas),
  fotosintesis: retryableThen(() => import('./practices/fotosintesis'), (m) => m.fotosintesis),
  ph: retryableThen(() => import('./practices/ph'), (m) => m.ph),
  popgen: retryableThen(() => import('./practices/popgen'), (m) => m.popgen),
  mezclas: retryableThen(() => import('./practices/mezclas'), (m) => m.mezclas),
  optica: retryableThen(() => import('./practices/optica'), (m) => m.optica),
  newton: retryableThen(() => import('./practices/newton'), (m) => m.newton),
  gases: retryableThen(() => import('./practices/gases'), (m) => m.gases),
  energia: retryableThen(() => import('./practices/energia'), (m) => m.energia),
  'reacciones-organicas': retryableThen(() => import('./practices/reacciones-organicas'), (m) => m.reaccionesOrganicas),
  'grupos-nitrogenados': retryableThen(() => import('./practices/grupos-nitrogenados'), (m) => m.gruposNitrogenados),
  'grupos-oxigenados': retryableThen(() => import('./practices/grupos-oxigenados'), (m) => m.gruposOxigenados),
  'nomenclatura-organica': retryableThen(() => import('./practices/nomenclatura-organica'), (m) => m.nomenclaturaOrganica),
  aromaticos: retryableThen(() => import('./practices/aromaticos'), (m) => m.aromaticos),
  hidrocarburos: retryableThen(() => import('./practices/hidrocarburos'), (m) => m.hidrocarburos),
  'nomenclatura-inorganica': retryableThen(() => import('./practices/nomenclatura-inorganica'), (m) => m.nomenclaturaInorganica),
  'acidos-sales': retryableThen(() => import('./practices/acidos-sales'), (m) => m.acidosSales),
  'oxidos-hidroxidos': retryableThen(() => import('./practices/oxidos-hidroxidos'), (m) => m.oxidosHidroxidos),
  'cinetica-potencial': retryableThen(() => import('./practices/cinetica-potencial'), (m) => m.cineticaPotencial),
  metabolismo: retryableThen(() => import('./practices/metabolismo'), (m) => m.metabolismo),
  proteinas: retryableThen(() => import('./practices/proteinas'), (m) => m.proteinas),
  rastreo: retryableThen(() => import('./practices/rastreo'), (m) => m.rastreo),
  secuencias: retryableThen(() => import('./practices/secuencias'), (m) => m.secuencias),
  geometria: retryableThen(() => import('./practices/geometria'), (m) => m.geometria),
  reto: retryableThen(() => import('./practices/reto'), (m) => m.reto),
  mol: retryableThen(() => import('./practices/mol'), (m) => m.mol),
  'extraccion-adn': retryableThen(() => import('./practices/extraccion-adn'), (m) => m.extraccionAdn),
  'circuitos-simples': retryableThen(() => import('./practices/circuitos-simples'), (m) => m.circuitosSimples),
  induccion: retryableThen(() => import('./practices/induccion'), (m) => m.induccion),
  interferencia: retryableThen(() => import('./practices/interferencia'), (m) => m.interferencia),
  movimiento: retryableThen(() => import('./practices/movimiento'), (m) => m.movimiento),
  flotacion: retryableThen(() => import('./practices/flotacion'), (m) => m.flotacion),
  trabajo: retryableThen(() => import('./practices/trabajo'), (m) => m.trabajo),
  sonido: retryableThen(() => import('./practices/sonido'), (m) => m.sonido),
  conduccion: retryableThen(() => import('./practices/conduccion'), (m) => m.conduccion),
  expresion: retryableThen(() => import('./practices/expresion'), (m) => m.expresion),
  balanceo: retryableThen(() => import('./practices/balanceo'), (m) => m.balanceo),
  ecosistema: retryableThen(() => import('./practices/ecosistema'), (m) => m.ecosistema),
  presion: retryableThen(() => import('./practices/presion'), (m) => m.presion),
  calor: retryableThen(() => import('./practices/calor'), (m) => m.calor),
  maquinas: retryableThen(() => import('./practices/maquinas'), (m) => m.maquinas),
  agua: retryableThen(() => import('./practices/agua'), (m) => m.agua),
  respiracion: retryableThen(() => import('./practices/respiracion'), (m) => m.respiracion),
  conservacion: retryableThen(() => import('./practices/conservacion'), (m) => m.conservacion),
  choques: retryableThen(() => import('./practices/choques'), (m) => m.choques),
  'gravitacion-orbitas': retryableThen(() => import('./practices/gravitacion-orbitas'), (m) => m.gravitacionOrbitas),
  'fluidos-bernoulli': retryableThen(() => import('./practices/fluidos-bernoulli'), (m) => m.fluidosBernoulli),
  pendulo: retryableThen(() => import('./practices/pendulo'), (m) => m.pendulo),
  proyectiles: retryableThen(() => import('./practices/proyectiles'), (m) => m.proyectiles),
  equilibrio: retryableThen(() => import('./practices/equilibrio'), (m) => m.equilibrio),
  descomposicion: retryableThen(() => import('./practices/descomposicion'), (m) => m.descomposicion),
  'ciclo-del-carbono': retryableThen(() => import('./practices/ciclo-del-carbono'), (m) => m.cicloDelCarbono),
  conductores: retryableThen(() => import('./practices/conductores'), (m) => m.conductores),
  seleccion: retryableThen(() => import('./practices/seleccion'), (m) => m.seleccion),
  redes: retryableThen(() => import('./practices/redes'), (m) => m.redes),
  cinetica: retryableThen(() => import('./practices/cinetica'), (m) => m.cinetica),
  termoquimica: retryableThen(() => import('./practices/termoquimica'), (m) => m.termoquimica),
  cinematica: retryableThen(() => import('./practices/cinematica'), (m) => m.cinematica),
  celulas: retryableThen(() => import('./practices/celulas'), (m) => m.celulas),
  termodinamica: retryableThen(() => import('./practices/termodinamica'), (m) => m.termodinamica),
  'efecto-doppler': retryableThen(() => import('./practices/efecto-doppler'), (m) => m.efectoDoppler),
  'nutricion-digestion': retryableThen(() => import('./practices/nutricion-digestion'), (m) => m.nutricionDigestion),
  'biotecnologia-pcr': retryableThen(() => import('./practices/biotecnologia-pcr'), (m) => m.biotecnologiaPcr),
  'sistema-inmune': retryableThen(() => import('./practices/sistema-inmune'), (m) => m.sistemaInmune),
};

export const LOADER_IDS = Object.keys(LOADERS);

const cache = new Map<string, Promise<PracticeDef>>();

export function loadPractice(id: string): Promise<PracticeDef> {
  const loader = LOADERS[id];
  if (!loader) return Promise.reject(new Error(`No existe la práctica «${id}».`));
  let p = cache.get(id);
  if (!p) {
    // Con la ficha llegan sus preguntas de transferencia (solo el archivo del banco de su grado): así la página y el
    // informe las resuelven de forma síncrona.
    p = loader().then(balancePractice).then(async (def) => { await ensureTransferQuestions(def); return def; });
    p.catch(() => cache.delete(id)); // permitir reintentar si falla la red (sin recargar: ver src/lib/importar.ts)
    cache.set(id, p);
  }
  return p;
}

export type LoadState<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error'; message: string };

export function usePractice(id: string): LoadState<PracticeDef> & { retry: () => void; retries: number } {
  const [state, setState] = useState<LoadState<PracticeDef>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    loadPractice(id).then(
      (value) => alive && setState({ status: 'ready', value }),
      // El mensaje técnico del navegador («Failed to fetch dynamically imported module: …») no le sirve al estudiante.
      (e: Error) => alive && setState({ status: 'error', message: isChunkLoadError(e) ? 'La descarga se interrumpió.' : e.message || 'No se pudo cargar la práctica.' }),
    );
    return () => { alive = false; };
  }, [id, attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1), retries: attempt };
}
