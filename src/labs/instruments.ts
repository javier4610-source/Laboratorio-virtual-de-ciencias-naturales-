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
};

/** Especificación de un instrumento de una práctica (lanza un error si no existe: error de programación). */
export function instrument(practiceId: string, id: string): InstrumentSpec {
  const spec = INSTRUMENTS[practiceId]?.find((i) => i.id === id);
  if (!spec) throw new Error(`Instrumento desconocido: ${practiceId}/${id}`);
  return spec;
}
