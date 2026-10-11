import type { PracticeMeta } from '../core/types';

/**
 * Catálogo liviano: lo que necesitan el inicio, el catálogo y las tarjetas.
 * El contenido completo de cada práctica se carga solo al abrirla (ver loader.ts).
 * Una prueba unitaria verifica que estos datos coincidan con las definiciones completas.
 */
export const CATALOG: PracticeMeta[] = [
  { id: 'densidad', title: 'Medición de masa, volumen y densidad', grade: 6, area: 'fisica', topic: 'Materia y sus propiedades: medición, masa, volumen y densidad', durationMin: 45,
    summary: 'Usa una balanza, una regla y una probeta para medir cubos de distintos materiales, calcular su densidad e identificar muestras misteriosas.',
    competencies: ['indagacion', 'uso'], keywords: ['densidad', 'masa', 'volumen', 'probeta', 'balanza', 'flotación', 'Arquímedes', 'medición'] },
  { id: 'osmosis', title: 'Difusión y ósmosis a través de la membrana', grade: 7, area: 'biologia', topic: 'Membrana celular, difusión y ósmosis', durationMin: 60,
    summary: 'Coloca glóbulos rojos y células vegetales en soluciones salinas y observa cómo entra o sale el agua; luego mide la difusión de glucosa y yodo en una bolsa de diálisis.',
    competencies: ['explicacion', 'indagacion'], keywords: ['ósmosis', 'difusión', 'membrana', 'tonicidad', 'hipotónica', 'hipertónica', 'isotónica', 'plasmólisis', 'lisis', 'suero'] },
  { id: 'mitosis', title: 'Mitosis al microscopio: fases e índice mitótico', grade: 7, area: 'biologia', topic: 'Reproducción celular: ciclo celular y mitosis', durationMin: 60,
    summary: 'Observa un campo de células de raíz de cebolla, clasifica cada célula según su fase, calcula el índice mitótico y estima cuánto dura cada fase. Prueba el efecto de la colchicina.',
    competencies: ['uso', 'indagacion'], keywords: ['mitosis', 'ciclo celular', 'cromosomas', 'meristemo', 'cebolla', 'índice mitótico', 'colchicina', 'interfase'] },
  { id: 'mendel', title: 'Herencia mendeliana y cuadros de Punnett', grade: 8, area: 'biologia', topic: 'Leyes de Mendel: cruces monohíbridos y dihíbridos', durationMin: 60,
    summary: 'Elige los genotipos de dos plantas, construye el cuadro de Punnett y siembra cientos de semillas virtuales para comparar lo observado con lo esperado.',
    competencies: ['uso', 'indagacion'], keywords: ['Mendel', 'genética', 'herencia', 'Punnett', 'alelo', 'dominante', 'recesivo', 'probabilidad', 'chi cuadrado'] },
  { id: 'ondas', title: 'Laboratorio de ondas: frecuencia, amplitud y longitud de onda', grade: 8, area: 'fisica', topic: 'Ondas mecánicas y sonido', durationMin: 60,
    summary: 'Genera ondas en una cuerda, mide su longitud de onda con una regla virtual y descubre qué la cambia; luego calcula la longitud de onda de sonidos en el aire.',
    competencies: ['uso', 'explicacion', 'indagacion'], keywords: ['ondas', 'frecuencia', 'longitud de onda', 'amplitud', 'periodo', 'sonido', 'rapidez', 'cuerda'] },
  { id: 'adn', title: 'Del ADN a la proteína: replicación, transcripción y traducción', grade: 9, area: 'biologia', topic: 'Dogma central de la biología molecular y mutaciones', durationMin: 75,
    summary: 'Replica una molécula de ADN, transcribe un gen a ARNm, tradúcelo con el código genético y provoca mutaciones para ver cómo cambian las proteínas, incluida la de la anemia falciforme.',
    competencies: ['uso', 'explicacion', 'indagacion'], keywords: ['ADN', 'ARN', 'transcripción', 'traducción', 'proteína', 'mutación', 'codón', 'replicación', 'anemia falciforme', 'código genético'] },
  { id: 'soluciones', title: 'Preparación de soluciones, molaridad y colorimetría', grade: 10, area: 'quimica', topic: 'Soluciones: concentración, molaridad y dilución', durationMin: 75,
    summary: 'Pesa solutos, afora balones, diluye con pipetas y mide la absorbancia para construir una curva de calibración y determinar la concentración de una muestra problema.',
    competencies: ['uso', 'indagacion'], keywords: ['solución', 'molaridad', 'concentración', 'dilución', 'Beer', 'absorbancia', 'colorimetría', 'solubilidad', 'mol'] },
  { id: 'enzimas', title: 'Actividad enzimática: temperatura, pH y concentración', grade: 10, area: 'biologia', topic: 'Biomoléculas y enzimas', durationMin: 60,
    summary: 'Mide la velocidad de reacción de la amilasa, la pepsina y la catalasa cambiando temperatura, pH, sustrato y enzima, y encuentra sus condiciones óptimas.',
    competencies: ['explicacion', 'indagacion'], keywords: ['enzima', 'amilasa', 'pepsina', 'catalasa', 'temperatura', 'pH', 'desnaturalización', 'Michaelis', 'sustrato'] },
  { id: 'fotosintesis', title: 'Fotosíntesis: luz, CO₂ y temperatura', grade: 10, area: 'biologia', topic: 'Fotosíntesis, respiración celular y factores limitantes', durationMin: 60,
    summary: 'Cuenta las burbujas de oxígeno que libera una planta acuática al cambiar la distancia de la lámpara, el CO₂ disponible, la temperatura y el color de la luz.',
    competencies: ['explicacion', 'indagacion'], keywords: ['fotosíntesis', 'luz', 'CO₂', 'oxígeno', 'Elodea', 'factor limitante', 'respiración', 'clorofila', 'temperatura'] },
  { id: 'circuitos', title: 'Circuitos eléctricos: voltaje, corriente y resistencia', grade: 11, area: 'fisica', topic: 'Electricidad: ley de Ohm, circuitos en serie, paralelo y mixtos', durationMin: 75,
    summary: 'Arma circuitos en serie, en paralelo y mixtos, mide con voltímetro y amperímetro virtuales y verifica la ley de Ohm y las leyes de Kirchhoff.',
    competencies: ['uso', 'explicacion', 'indagacion'], keywords: ['circuito', 'Ohm', 'Kirchhoff', 'voltaje', 'corriente', 'resistencia', 'serie', 'paralelo', 'potencia', 'electricidad'] },
  { id: 'estequiometria', title: 'Estequiometría y reactivo limitante', grade: 11, area: 'quimica', topic: 'Estequiometría avanzada: reactivo limitante, exceso y rendimiento', durationMin: 60,
    summary: 'Balancea ecuaciones, mezcla cantidades de reactivos y descubre cuál se agota primero, cuánto producto se forma y cuánto sobra.',
    competencies: ['uso', 'indagacion'], keywords: ['estequiometría', 'reactivo limitante', 'mol', 'masa molar', 'balanceo', 'rendimiento', 'conservación de la masa', 'reacción'] },
  { id: 'ph', title: 'pH, dilución y neutralización ácido-base', grade: 11, area: 'quimica', topic: 'Ácidos, bases y pH; neutralización y titulación', durationMin: 75,
    summary: 'Diluye ácidos y observa cómo cambia el pH; luego titula ácido clorhídrico o vinagre con hidróxido de sodio usando bureta, pH-metro e indicadores.',
    competencies: ['uso', 'explicacion', 'indagacion'], keywords: ['pH', 'ácido', 'base', 'neutralización', 'titulación', 'indicador', 'dilución', 'vinagre', 'equivalencia'] },
  { id: 'poblacion', title: 'Crecimiento poblacional y capacidad de carga', grade: 11, area: 'ambiental', topic: 'Ecología: dinámica de poblaciones, capacidad de carga y aprovechamiento sostenible', durationMin: 45,
    summary: 'Simula una población de peces en una ciénaga: compara el crecimiento exponencial y el logístico y evalúa cuánta pesca es sostenible.',
    competencies: ['explicacion', 'indagacion'], keywords: ['población', 'ecología', 'capacidad de carga', 'logístico', 'exponencial', 'pesca', 'sostenible', 'ambiente'] },
  { id: 'popgen', title: 'Genética de poblaciones y frecuencias alélicas', grade: 11, area: 'biologia', topic: 'Evolución y genética de poblaciones: Hardy-Weinberg, selección y deriva', durationMin: 75,
    summary: 'Sigue la frecuencia de un alelo durante cientos de generaciones y descubre cómo la selección natural, la deriva génica, la mutación y la migración cambian una población.',
    competencies: ['uso', 'explicacion', 'indagacion'], keywords: ['genética de poblaciones', 'Hardy-Weinberg', 'evolución', 'selección natural', 'deriva génica', 'alelo', 'anemia falciforme', 'malaria'] },
];

export function metaById(id: string): PracticeMeta | undefined {
  return CATALOG.find((p) => p.id === id);
}
