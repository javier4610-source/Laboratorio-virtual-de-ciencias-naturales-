/**
 * Fichas de los modelos (ModelSpec) de las prácticas «grupos-oxigenados», «grupos-nitrogenados» y «reacciones-organicas».
 * Están en un módulo aparte, sin datos ni dependencias, porque las fichas de práctica se cargan con el catálogo: así la biblioteca
 * de moléculas (≈ 430 kB) y los modelos solo se descargan al abrir el laboratorio.
 */
import type { ModelSpec } from './types';

export const oxygenatedModelSpec: ModelSpec = {
  name: 'Funciones oxigenadas: reconocimiento del grupo funcional en el grafo, nomenclatura IUPAC 2013, datos experimentales citados (PubChem/HSDB) y equilibrio ácido-base',
  inputs: [
    { symbol: 'compuesto', name: 'Compuesto (biblioteca de 106 moléculas de PubChem) o SMILES escrito por el estudiante', unit: '—', initial: 'etanol' },
    { symbol: 'pH', name: 'pH del medio (simulador de acidez)', unit: '—', range: [0, 14], initial: 7 },
    { symbol: 'prueba', name: 'Prueba de laboratorio (Tollens, Fehling, FeCl₃, Lucas, NaHCO₃)', unit: '—', initial: 'tollens' },
  ],
  outputs: [
    { symbol: 'grupo', name: 'Grupo funcional, clase (1.º/2.º/3.º) y grupo principal', unit: '—' },
    { symbol: 'nombre', name: 'Nombre sistemático (IUPAC 2013) en español e inglés, con los pasos', unit: '—' },
    { symbol: 'Tₑb, s, pKa', name: 'Propiedades experimentales con su fuente', unit: '°C, g/L, —' },
    { symbol: 'α', name: 'Fracción ionizada a un pH dado', unit: '%' },
  ],
  equations: [
    'Prioridad de grupos (IUPAC 2013, P-41): ácido > éster > amida > aldehído > cetona > alcohol/fenol > amina; éteres y halógenos solo como prefijos',
    'Fracción ionizada de un ácido: α = 1 / (1 + 10^(pKa − pH)) (Henderson-Hasselbalch)',
    'pH de un ácido débil de concentración c: x² / (c − x) = Ka, pH = −log x',
    'Clasificación de alcoholes: número de átomos de C unidos al carbono que lleva el –OH (1, 2 o 3)',
  ],
  initialConditions: ['Etanol, pH = 7, prueba de Tollens.'],
  assumptions: [
    'Las propiedades (Tₑb, solubilidad, pKa, ΔcH°) son datos experimentales tomados de PubChem (PUG View) con la obra que cita cada base; se elige el dato con una regla fija documentada en scripts/validacion/funcionales_pubchem.py.',
    'Las geometrías 3D son confórmeros calculados por PubChem3D (OMEGA + MMFF94s): modelo calculado, no estructuras medidas.',
    'El resultado de las pruebas de laboratorio es la ilustración del resultado esperado según la bibliografía, deducido del grupo funcional; no se simula la cinética ni la concentración.',
    'Henderson-Hasselbalch supone disoluciones diluidas (actividades ≈ concentraciones) a 25 °C.',
  ],
  limits: [
    'El motor de nomenclatura no nombra heterociclos, anillos fusionados, anhídridos, haluros de ácido, nitrilos ni más de un éster; lo dice en lugar de inventar un nombre.',
    'Algunos datos faltan en PubChem (p. ej. Tₑb del 1-metoxipropano): se muestran como «Sin información disponible» y no se estiman.',
    'Distintas obras dan valores que difieren algunas décimas; la solubilidad «g/100 g» se aproxima como ×10 g/L (se indica).',
    'Un dato publicado puede estar mal transcrito: el control de calidad de la serie de alcoholes marca el ΔcH° del etanol (1336,8 kJ/mol) como incoherente con los demás (≈ 31 kJ/mol por debajo de la recta robusta de la serie).',
  ],
  testCases: [
    'Nomenclatura: 176 estructuras comparadas con el IUPACName de PubChem (LexiChem); 156 idénticas y 20 con diferencias de convención clasificadas.',
    'Tₑb (HSDB/CRC): butano −0,5 °C; propanal 48 °C; propanona 56,08 °C; propan-1-ol 97,2 °C; ácido acético 117,9 °C (≈ 58–60 g/mol).',
    'pKa: etanol 15,9; fenol 9,99; ácido acético 4,76; ácido tricloroacético 0,51. Ácido acético 0,100 M: pH = 2,88 (Ka = 10^−4,76).',
    'Pruebas: propanal Tollens (+) y Fehling (+); benzaldehído Tollens (+) y Fehling (−); 2-metilpropan-2-ol Lucas inmediato; fenol FeCl₃ violeta; ácido acético con NaHCO₃ burbujea.',
  ],
};

export const nitrogenModelSpec: ModelSpec = {
  name: 'Funciones nitrogenadas: aminas y amidas, basicidad con pKa citados, geometría medida en confórmeros y enlace peptídico',
  inputs: [
    { symbol: 'compuesto', name: 'Amina, amida o aminoácido de la biblioteca (PubChem)', unit: '—', initial: 'metanamina' },
    { symbol: 'c', name: 'Concentración de la base', unit: 'mol/L', range: [0.001, 1], initial: 0.1 },
    { symbol: 'pH', name: 'pH del medio', unit: '—', range: [0, 14], initial: 7.4 },
  ],
  outputs: [
    { symbol: 'pKaH', name: 'pKa del ácido conjugado (dato o pKw − pKb)', unit: '—' },
    { symbol: 'pH', name: 'pH de la disolución de la base', unit: '—' },
    { symbol: 'f(BH⁺)', name: 'Fracción protonada al pH elegido', unit: '%' },
    { symbol: 'd(C–N), Σθ(N)', name: 'Longitud C–N y suma de ángulos en el N medidas en el confórmero', unit: 'Å, °' },
  ],
  equations: [
    'pKaH = pKw − pKb, con pKw = 14,00 a 25 °C (cuando la fuente da pKb)',
    'Base débil: x² / (c − x) = Kb = 10^−(14 − pKaH); [OH⁻] = x; pH = 14 − pOH',
    'Fracción protonada: f = 1 / (1 + 10^(pH − pKaH))',
    'Suma de ángulos alrededor del N: 360° si es plano (sp², amida), ≈ 320–335° si es piramidal (amina)',
  ],
  initialConditions: ['Metanamina 0,10 mol/L, pH = 7,4 (sangre).'],
  assumptions: [
    'pKa y pKb son datos experimentales citados por PubChem (HSDB: Perrin, Merck Index, CRC Handbook…).',
    'Geometría: confórmeros MMFF94s de PubChem; el campo de fuerza reproduce la planaridad de la amida, pero no es una medición.',
    'Disoluciones diluidas a 25 °C (actividades ≈ concentraciones); se ignora la autoionización del agua salvo en pKw.',
  ],
  limits: [
    'La basicidad en agua depende también de la solvatación (por eso la trimetilamina es menos básica que la dimetilamina); el modelo no la calcula, la muestra con los datos.',
    'Los aminoácidos existen como iones dipolares (zwitteriones); el confórmero de PubChem es la forma neutra y no representa la estructura en disolución.',
  ],
  testCases: [
    'Metanamina pKaH 10,66 → pH de 0,10 M ≈ 11,8; anilina pKaH 4,6 → pH ≈ 8,8; amoníaco pKb 4,751 → pKaH 9,249.',
    'Amida (acetamida, MMFF94s): C–N = 1,375 Å, suma de ángulos en N = 360,0° (plana); metanamina: C–N = 1,431 Å, suma = 326,0° (pirámide).',
    'Nomenclatura: N-metilmetanamina, N,N-dimetilmetanamina, anilina, N-(4-hidroxifenil)acetamida, ácido 2-aminopropanoico, urea.',
  ],
};

export const reactionsModelSpec: ModelSpec = {
  name: 'Reacciones orgánicas: ecuaciones balanceadas por el método algebraico, estequiometría con masas molares, ley de Hess con ΔcH° citados y equilibrio de esterificación',
  inputs: [
    { symbol: 'reacción', name: 'Reacción de la biblioteca (24)', unit: '—', initial: 'combustion-metano' },
    { symbol: 'm', name: 'Masa del reactivo orgánico', unit: 'g', range: [0.1, 1000], initial: 16.04 },
    { symbol: 'η', name: 'Rendimiento', unit: '%', range: [0, 100], initial: 100 },
    { symbol: 'a, b, e₀, w₀', name: 'Moles iniciales de ácido, alcohol, éster y agua (esterificación)', unit: 'mol', range: [0, 10], initial: '1; 1; 0; 0' },
  ],
  outputs: [
    { symbol: 'ν', name: 'Coeficientes estequiométricos mínimos', unit: '—' },
    { symbol: 'm(producto)', name: 'Masa teórica y real del producto', unit: 'g' },
    { symbol: 'ΔrH°', name: 'Entalpía de reacción por la ley de Hess', unit: 'kJ' },
    { symbol: 'X', name: 'Conversión de equilibrio de la esterificación', unit: '%' },
  ],
  equations: [
    'Balanceo: A·ν = 0 (matriz de composición elementos × especies), ν = vector mínimo de enteros positivos del espacio nulo',
    'n = m / M;  ξ = n(reactivo clave)/ν;  m(i) = ξ·νᵢ·Mᵢ;  m(real) = m(teórica)·η/100',
    'ΔrH° = Σ ν·ΔcH°(reactivos) − Σ ν·ΔcH°(productos), con ΔcH°(O₂, CO₂, H₂O(l), N₂) = 0',
    'Esterificación: K = (e₀ + x)(w₀ + x) / ((a − x)(b − x)) = 4',
    'Markovnikov: el H se une al carbono del C=C con más hidrógenos',
  ],
  initialConditions: ['Combustión del metano con 16,04 g (1 mol), rendimiento 100 %; esterificación con 1 mol de ácido y 1 mol de alcohol.'],
  assumptions: [
    'Las moléculas 3D son confórmeros de PubChem (modelo calculado); la animación interpola entre reactivos y productos (ilustración educativa: no es el mecanismo).',
    'Las entalpías de combustión son datos experimentales citados por PubChem (HSDB → CRC Handbook, Riddick et al., Ullmann) en el estado indicado por la fuente, a 25 °C, con agua líquida como producto.',
    'K = 4 se supone independiente de la temperatura (la reacción es casi termoneutra) y de las actividades (mezcla ideal).',
    'En las ecuaciones de oxidación se usa O₂ como oxidante para poder balancear; en el aula el oxidante habitual es el dicromato o el permanganato.',
  ],
  limits: [
    'No hay ΔcH° citados en PubChem para varias especies (CO, glucosa, halogenados, propeno, propan-2-ol…): esas entalpías aparecen como «Sin información disponible».',
    'El ΔcH° del etanol que trae PubChem (1336,8 kJ/mol) no encaja con la serie homóloga; las entalpías que lo usan se marcan como dudosas.',
    'Las ecuaciones globales (fermentación, enlace peptídico) resumen varios pasos enzimáticos; no describen el mecanismo.',
    'El laboratorio no da protocolos de síntesis: las reacciones peligrosas (nitración, cloración) solo se estudian en papel y en el simulador.',
  ],
  testCases: [
    'Coeficientes: CH₄ + 2 O₂ → CO₂ + 2 H₂O; C₂H₆O + 3 O₂ → 2 CO₂ + 3 H₂O; 2 CH₄ + 3 O₂ → 2 CO + 4 H₂O; C₆H₁₂O₆ → 2 C₂H₆O + 2 CO₂.',
    'Hess: combustión del metano −890,8 kJ; hidrogenación del ciclohexeno = −(3751,7 + 285,8) + 3919,6 = −117,9 kJ; metanol → metanal 2·(−726,1 + 570,7) = −310,8 kJ.',
    'Esterificación (K = 4): a = b = 1 → X = 2/3 (66,7 %); a = 1, b = 3 → X = 90,3 %.',
    'Estequiometría: 46,07 g de etanol (1 mol) → 88,02 g de CO₂ y 54,05 g de agua; Σ masa reactivos = Σ masa productos.',
  ],
};
