/**
 * Ficha de incertidumbre de los instrumentos de cada laboratorio que admite el modo «Instrumento real».
 * Resolución: la menor división (o el último dígito) del instrumento. Desviación típica (σ): dispersión
 * típica de lecturas repetidas, combinando un término absoluto (sigma) y uno relativo (relSigma) en cuadratura.
 * Los valores son ILUSTRATIVOS: corresponden a equipos escolares típicos y no a un modelo comercial concreto.
 * Información pura (sin React): la usan los laboratorios, el área de trabajo y las pruebas.
 */
export interface InstrumentSpec {
  id: string;
  name: string;
  /** Magnitud que lee el instrumento. */
  quantity: string;
  unit: string;
  resolution: number;
  sigma?: number;
  relSigma?: number;
  /** Resolución con la que se registra la lectura en modo ideal si difiere de la del instrumento (0: sin cuantizar, se conserva la precisión del modelo). */
  idealResolution?: number;
  nonNegative?: boolean;
  /** Origen principal de la dispersión. */
  note: string;
}

export const INSTRUMENTS: Record<string, InstrumentSpec[]> = {
  densidad: [
    { id: 'balanza', name: 'Balanza digital (600 g)', quantity: 'Masa', unit: 'g', resolution: 0.1, sigma: 0.08, note: 'Repetibilidad: corrientes de aire, vibraciones y posición de la muestra en el plato.' },
    { id: 'regla', name: 'Regla graduada en milímetros', quantity: 'Arista del cubo', unit: 'cm', resolution: 0.1, sigma: 0.04, note: 'Alineación del cero con el borde y paralaje al leer.' },
    { id: 'probeta', name: 'Probeta de 100 mL', quantity: 'Volumen final', unit: 'mL', resolution: 0.5, sigma: 0.3, note: 'Lectura del menisco (paralaje) y gotas que quedan en las paredes.' },
  ],
  newton: [
    { id: 'cronometro', name: 'Cronómetro de fotopuertas', quantity: 'Tiempo en 1,00 m', unit: 's', resolution: 0.001, sigma: 0.003, note: 'La electrónica es precisa (≈ 0,1 ms); domina la variación al soltar el carrito y la alineación de la bandera.' },
  ],
  optica: [
    { id: 'transportador', name: 'Transportador (disco graduado cada 2°)', quantity: 'Ángulos de reflexión y refracción', unit: '°', resolution: 1, sigma: 0.7, idealResolution: 0, nonNegative: true, note: 'Ancho del haz y alineación del rayo con la escala del disco.' },
  ],
  gases: [
    { id: 'manometro', name: 'Manómetro con sensor digital', quantity: 'Presión', unit: 'kPa', resolution: 0.1, sigma: 0.2, relSigma: 0.002, note: 'Ruido y deriva del sensor de presión.' },
    { id: 'jeringa', name: 'Escala de la jeringa de 200 mL', quantity: 'Volumen del gas', unit: 'mL', resolution: 1, sigma: 0.4, note: 'Alinear el émbolo con la marca: el volumen real del gas difiere un poco del indicado, y eso cambia la presión.' },
  ],
  circuitos: [
    { id: 'voltimetro', name: 'Multímetro: voltímetro (rango 20 V)', quantity: 'Voltaje', unit: 'V', resolution: 0.01, sigma: 0.01, relSigma: 0.003, idealResolution: 0, note: 'Contacto de las puntas y exactitud del rango (± 0,3 % de la lectura).' },
    { id: 'amperimetro', name: 'Multímetro: amperímetro (rango 2 A)', quantity: 'Corriente', unit: 'A', resolution: 0.001, sigma: 0.001, relSigma: 0.005, idealResolution: 0, nonNegative: true, note: 'Resistencia de contacto y exactitud del rango (± 0,5 % de la lectura).' },
  ],
  conductores: [
    { id: 'amperimetro', name: 'Amperímetro (rango 0 a 2 A)', quantity: 'Corriente', unit: 'mA', resolution: 0.1, sigma: 0.1, relSigma: 0.005, nonNegative: true, note: 'Contacto de los caimanes con la muestra y exactitud del rango (± 0,5 % de la lectura).' },
  ],
  respiracion: [
    { id: 'capilar', name: 'Manómetro capilar con escala milimétrica (Ø 2,0 mm)', quantity: 'Desplazamiento de la gota', unit: 'mm', resolution: 0.5, sigma: 0.4, note: 'Paralaje al leer el borde de la gota, adherencia de la gota al vidrio y pequeñas fugas en los tapones.' },
  ],
  agua: [
    { id: 'temp', name: 'Sonda multiparamétrica: termistor', quantity: 'Temperatura', unit: '°C', resolution: 0.1, sigma: 0.1, note: 'Tiempo de estabilización del sensor en la corriente.' },
    { id: 'pH', name: 'Sonda multiparamétrica: electrodo de pH', quantity: 'pH', unit: '—', resolution: 0.01, sigma: 0.02, note: 'Calibración con soluciones tampón 4, 7 y 10 y deriva del electrodo.' },
    { id: 'od', name: 'Sonda multiparamétrica: sensor óptico de oxígeno', quantity: 'Oxígeno disuelto', unit: 'mg/L', resolution: 0.01, sigma: 0.05, relSigma: 0.01, nonNegative: true, note: 'Calibración en aire saturado y velocidad del agua sobre el sensor.' },
    { id: 'ec', name: 'Sonda multiparamétrica: celda de conductividad', quantity: 'Conductividad (25 °C)', unit: 'µS/cm', resolution: 1, sigma: 2, relSigma: 0.01, nonNegative: true, note: 'Compensación de temperatura a 25 °C y burbujas en la celda.' },
    { id: 'turb', name: 'Turbidímetro nefelométrico', quantity: 'Turbidez', unit: 'UNT', resolution: 0.1, sigma: 0.3, relSigma: 0.03, nonNegative: true, note: 'Sedimentación de partículas y rayas o huellas en la celda.' },
    { id: 'no3', name: 'Fotómetro: nitratos (reducción con cadmio)', quantity: 'Nitratos', unit: 'mg/L NO₃⁻', resolution: 0.1, sigma: 0.2, relSigma: 0.05, nonNegative: true, note: 'Tiempo de reacción del reactivo y turbidez de la muestra.' },
    { id: 'po4', name: 'Fotómetro: fosfatos (ácido ascórbico)', quantity: 'Fosfatos', unit: 'mg/L PO₄³⁻', resolution: 0.01, sigma: 0.02, relSigma: 0.05, nonNegative: true, note: 'Contaminación con detergentes del material y tiempo de desarrollo del color.' },
    { id: 'dbo', name: 'Botellas Winkler: DBO₅ (5 días a 20 °C)', quantity: 'DBO₅', unit: 'mg/L', resolution: 0.1, sigma: 0.3, relSigma: 0.1, nonNegative: true, note: 'Dilución de la muestra, semilla bacteriana e incubación de 5 días.' },
    { id: 'cf', name: 'Tubos múltiples: coliformes fecales (NMP)', quantity: 'Coliformes fecales', unit: 'NMP/100 mL', resolution: 1, relSigma: 0.3, nonNegative: true, note: 'El NMP es una estimación estadística con un intervalo de confianza amplio.' },
  ],
  maquinas: [
    { id: 'dinamometro', name: 'Dinamómetro de resorte (0 a 10 N)', quantity: 'Fuerza', unit: 'N', resolution: 0.1, sigma: 0.05, relSigma: 0.01, nonNegative: true, note: 'Paralaje al leer el indicador, ajuste del cero y rozamiento del resorte con el tubo.' },
    { id: 'regla', name: 'Regla vertical graduada en milímetros', quantity: 'Recorrido de la cuerda o de la carga', unit: 'cm', resolution: 0.1, sigma: 0.08, nonNegative: true, note: 'Alinear la marca con el cero de la regla y paralaje al leer.' },
  ],
  calor: [
    { id: 'termometro', name: 'Termómetro digital de sonda (−50 a 150 °C)', quantity: 'Temperatura', unit: '°C', resolution: 0.1, sigma: 0.1, note: 'Tiempo de respuesta de la sonda, agitación incompleta y posición de la punta dentro del agua.' },
    { id: 'balanza', name: 'Balanza digital (600 g)', quantity: 'Masa', unit: 'g', resolution: 0.1, sigma: 0.08, note: 'Corrientes de aire, gotas en el plato y vasos aún tibios (convección sobre el plato).' },
  ],
  presion: [
    { id: 'manometro', name: 'Manómetro en U con agua coloreada y regla milimétrica', quantity: 'Desnivel entre las ramas', unit: 'mm', resolution: 1, sigma: 1, note: 'Paralaje al leer los dos meniscos, capilaridad en el tubo y pequeñas burbujas en la manguera.' },
    { id: 'barometro', name: 'Barómetro digital (300 a 1100 hPa)', quantity: 'Presión atmosférica', unit: 'hPa', resolution: 0.1, sigma: 0.3, note: 'Exactitud del sensor y variación de la presión durante el día (marea atmosférica de ± 1 a 2 hPa en el trópico).' },
    { id: 'cinta', name: 'Cinta métrica sobre la bandeja', quantity: 'Alcance del chorro', unit: 'cm', resolution: 0.5, sigma: 0.4, note: 'El chorro se abre al caer y salpica: el punto de impacto tiene un ancho de casi 1 cm.' },
  ],
  ecosistema: [
    { id: 'oximetro', name: 'Oxímetro con sonda polarográfica (0 a 20 mg/L)', quantity: 'Oxígeno disuelto', unit: 'mg/L', resolution: 0.1, sigma: 0.15, nonNegative: true, note: 'Calibración en aire saturado, temperatura del agua y consumo de O₂ de la propia sonda si el agua no se mueve.' },
    { id: 'carta', name: 'Carta de color del azul de bromotimol (cada 0,2 de pH)', quantity: 'pH de la muestra', unit: '—', resolution: 0.2, sigma: 0.15, note: 'Comparar colores a simple vista: la luz del salón y la turbidez verde de las algas cambian el tono percibido.' },
    { id: 'conteo', name: 'Conteo a simple vista a través del vidrio', quantity: 'Caracoles', unit: 'individuos', resolution: 1, sigma: 0.5, nonNegative: true, note: 'Los caracoles pequeños se esconden entre las hojas y en el sedimento; los recién nacidos miden menos de 1 mm.' },
    { id: 'biomasa', name: 'Biomasa de elodea estimada por la longitud de las ramitas', quantity: 'Biomasa fresca de elodea', unit: 'g', resolution: 0.5, sigma: 0.3, nonNegative: true, note: 'Se mide la longitud total con una regla a través del vidrio y se convierte con 0,25 g por cada centímetro de ramita.' },
  ],
  conduccion: [
    { id: 'termopar', name: 'Termopar tipo K con registrador (−50 a 400 °C)', quantity: 'Temperatura', unit: '°C', resolution: 0.1, sigma: 0.3, note: 'Contacto térmico de la unión con la varilla (pasta térmica), unión fría del registrador y ruido eléctrico.' },
    { id: 'cronometro', name: 'Cronómetro (caída de las tachuelas)', quantity: 'Tiempo', unit: 's', resolution: 1, sigma: 1, relSigma: 0.05, note: 'Tamaño desigual de las gotas de cera y tiempo de reacción al ver caer la tachuela.' },
    { id: 'regla', name: 'Regla graduada en milímetros', quantity: 'Posición sobre la varilla', unit: 'cm', resolution: 0.1, sigma: 0.05, note: 'Alineación del cero con la pared del baño y paralaje.' },
  ],
  sonido: [
    { id: 'regla', name: 'Cinta métrica junto al tubo (1 mm)', quantity: 'Longitud de la columna de aire', unit: 'cm', resolution: 0.1, sigma: 0.15, note: 'El menisco del agua (o el borde del tubo deslizante) y la boca del tubo no están a la altura del ojo: paralaje. Además, el pico de sonido es ancho y cuesta decidir dónde es máximo.' },
    { id: 'osciloscopio', name: 'Osciloscopio con cursores (retícula de 10 × 8 div)', quantity: 'Lectura de tiempo y de voltaje en la pantalla', unit: 'div', resolution: 0.2, sigma: 0.1, note: 'El grosor del trazo y la ubicación de los cursores: la incertidumbre en ms o en mV depende de la escala elegida (tiempo/div y volts/div).' },
    { id: 'sonometro', name: 'Sonómetro digital (ponderación Z, 30 a 130 dB)', quantity: 'Nivel sonoro', unit: 'dB', resolution: 0.1, sigma: 0.4, note: 'Reflexiones en las paredes y la mesa, ruido del salón y orientación del micrófono.' },
    { id: 'cinta', name: 'Cinta métrica sobre la mesa', quantity: 'Distancia al parlante', unit: 'm', resolution: 0.01, sigma: 0.005, note: 'Ubicar el centro del parlante y la rejilla del micrófono del sonómetro.' },
  ],
  trabajo: [
    { id: 'dinamometro', name: 'Dinamómetro de resorte (0 a 10 N)', quantity: 'Fuerza (peso del bloque y fuerza paralela a la rampa)', unit: 'N', resolution: 0.1, sigma: 0.06, relSigma: 0.015, nonNegative: true, note: 'El indicador oscila al jalar (no es fácil mantener la velocidad constante), paralaje y ajuste del cero.' },
    { id: 'regla', name: 'Regla y cinta métrica graduadas en milímetros', quantity: 'Recorrido sobre la rampa, altura ganada y altura de un escalón', unit: 'cm', resolution: 0.1, sigma: 0.1, nonNegative: true, note: 'Alinear las marcas con el borde del bloque y paralaje al leer la regla vertical.' },
    { id: 'cronometro', name: 'Cronómetro digital (0,01 s)', quantity: 'Tiempo de subida', unit: 's', resolution: 0.01, sigma: 0.12, nonNegative: true, note: 'Tiempo de reacción de quien pulsa al arrancar y al detener (≈ 0,1 a 0,2 s).' },
    { id: 'bascula', name: 'Báscula de piso (0,1 kg)', quantity: 'Masa de la persona', unit: 'kg', resolution: 0.1, sigma: 0.1, nonNegative: true, note: 'Postura sobre la báscula y ropa o zapatos.' },
  ],
  flotacion: [
    { id: 'dinamometro', name: 'Dinamómetro de resorte de 5 N', quantity: 'Peso y peso aparente', unit: 'N', resolution: 0.05, sigma: 0.02, nonNegative: true, note: 'Paralaje al leer el indicador, rozamiento del resorte con el tubo y oscilación del objeto colgado.' },
    { id: 'balanza', name: 'Balanza digital (2000 g, tarada)', quantity: 'Masa del líquido desalojado', unit: 'g', resolution: 0.1, sigma: 0.15, note: 'Gotas que quedan en el pico del vaso de rebose o en las paredes del colector, y corrientes de aire.' },
    { id: 'densimetro', name: 'Densímetro de vidrio (0,700 a 1,200 g/cm³)', quantity: 'Densidad del líquido', unit: 'g/cm³', resolution: 0.002, sigma: 0.001, note: 'Lectura del menisco sobre el tallo y burbujas adheridas al bulbo.' },
  ],
  movimiento: [
    { id: 'cinta', name: 'Cinta métrica de 50 m (fibra de vidrio)', quantity: 'Distancia entre la salida y la meta', unit: 'm', resolution: 0.01, sigma: 0.02, nonNegative: true, note: 'La cinta no queda del todo templada ni recta sobre el piso y el cero no se alinea exactamente con el borde del cono.' },
    { id: 'fotopuerta', name: 'Fotopuertas con temporizador (0,01 s)', quantity: 'Tiempo entre la salida y la meta', unit: 's', resolution: 0.01, sigma: 0.003, nonNegative: true, note: 'El haz se corta con la parte del móvil que va adelante (pecho, rueda o balón), no siempre con el mismo punto.' },
    { id: 'cronometro', name: 'Cronómetro de mano (0,01 s)', quantity: 'Tiempo entre la salida y la meta', unit: 's', resolution: 0.01, sigma: 0.08, nonNegative: true, note: 'Tiempo de reacción humano: se arranca tarde (≈ 0,2 s) y se detiene casi a tiempo porque el móvil se ve llegar.' },
  ],
  interferencia: [
    { id: 'calibrador', name: 'Calibrador (pie de rey) apoyado en la pantalla', quantity: 'Posición de una franja', unit: 'mm', resolution: 0.05, sigma: 0.06, note: 'Las franjas no tienen bordes nítidos: decidir dónde está el centro de una franja (o de un mínimo) es la mayor fuente de error.' },
    { id: 'regla', name: 'Regla milimetrada pegada a la pantalla', quantity: 'Posición de un orden de la red', unit: 'mm', resolution: 1, sigma: 0.5, note: 'Grosor de la mancha de luz y paralaje al leer la regla.' },
    { id: 'riel', name: 'Escala del riel óptico', quantity: 'Distancia rendija–pantalla L', unit: 'cm', resolution: 0.1, sigma: 0.15, note: 'Ubicar el plano de la diapositiva y de la pantalla sobre la escala del riel.' },
    { id: 'sensor', name: 'Sensor de luz (fotodiodo con ventana de 0,2 mm)', quantity: 'Intensidad relativa al máximo central', unit: '%', resolution: 0.1, sigma: 0.2, relSigma: 0.02, note: 'Luz ambiente, ruido electrónico y fluctuaciones de la potencia del láser.' },
  ],
  induccion: [
    { id: 'teslametro', name: 'Teslámetro con sonda Hall (0,01 mT)', quantity: 'Campo magnético en la punta de la sonda', unit: 'mT', resolution: 0.01, sigma: 0.02, relSigma: 0.02, note: 'Orientación del sensor Hall, deriva del cero y posición exacta de la punta.' },
    { id: 'sensorFem', name: 'Sensor de voltaje con registrador (1 mV, 2 000 muestras/s)', quantity: 'Fuerza electromotriz inducida en la bobina', unit: 'mV', resolution: 1, sigma: 2, relSigma: 0.02, note: 'Ruido eléctrico, rapidez no del todo constante de la mano y muestreo finito.' },
    { id: 'multimetro', name: 'Multímetro digital en voltios CA (0,01 V)', quantity: 'Voltaje eficaz y pico', unit: 'V', resolution: 0.01, sigma: 0.01, relSigma: 0.01, nonNegative: true, note: 'El multímetro escolar mide bien solo ondas sinusoidales de 45 a 400 Hz.' },
  ],
  'circuitos-simples': [
    { id: 'voltimetro', name: 'Multímetro escolar: voltímetro (rango 20 V)', quantity: 'Voltaje', unit: 'V', resolution: 0.01, sigma: 0.01, relSigma: 0.005, note: 'Contacto de las puntas con los bornes y exactitud del rango (± 0,5 % de la lectura).' },
    { id: 'amperimetro', name: 'Multímetro escolar: amperímetro (rango 10 A)', quantity: 'Corriente', unit: 'A', resolution: 0.001, sigma: 0.002, relSigma: 0.01, note: 'Resistencia de contacto de las puntas y exactitud del rango de 10 A (± 1 % de la lectura).' },
  ],
  'extraccion-adn': [
    { id: 'escala', name: 'Escala visual de referencia del precipitado (1 u.a.)', quantity: 'Índice de rendimiento relativo del ADN enrollado', unit: 'u.a.', resolution: 1, sigma: 2, relSigma: 0.15, nonNegative: true, note: 'Ilustrativo: variabilidad entre frutas (madurez, variedad), pérdidas al filtrar y apreciación visual del ovillo.' },
  ],
  mol: [
    { id: 'balanza', name: 'Balanza de precisión (220 g × 0,001 g) con cámara antiviento', quantity: 'Masa', unit: 'g', resolution: 0.001, sigma: 0.0015, note: 'Corrientes de aire, vibraciones de la mesa, electricidad estática de la navecilla de plástico y objetos aún tibios.' },
  ],
};

/** Especificación de un instrumento de una práctica (lanza un error si no existe: error de programación). */
export function instrument(practiceId: string, id: string): InstrumentSpec {
  const spec = INSTRUMENTS[practiceId]?.find((i) => i.id === id);
  if (!spec) throw new Error(`Instrumento desconocido: ${practiceId}/${id}`);
  return spec;
}
