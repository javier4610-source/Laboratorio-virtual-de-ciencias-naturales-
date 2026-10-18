# Auditoría técnica, científica y pedagógica

Fecha: octubre de 2026. Alcance: las 9 prácticas implementadas, la navegación, el panel docente, los informes, el banco de preguntas y la accesibilidad.

**Cómo se verificó:** 70 pruebas unitarias (Vitest) sobre modelos, currículo y utilidades, y 15 pruebas de interfaz de extremo a extremo (Playwright con Chromium) sobre la versión compilada. Además, revisión visual con capturas a 1280 px (tema claro) y 380 px (tema oscuro) de todas las prácticas, buscando errores de consola y desplazamiento horizontal. Todas las pruebas se ejecutaron y pasaron; no se reporta como exitoso nada que no se haya ejecutado.

**No verificado:** lectores de pantalla reales (NVDA, VoiceOver), navegadores distintos de Chromium (Firefox, Safari), equipos escolares de bajo rendimiento reales, usabilidad con estudiantes y docentes. La correspondencia con DBA no se pudo contrastar con el documento oficial (sin acceso de red a los sitios del MEN/ICFES durante el desarrollo).

## Tabla de auditoría

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Densidad – modelo | Aluminio 2 cm (21,6 g; 8 cm³; 2,70 g/cm³); 4 tamaños de hierro; corcho con y sin alfiler; plomo 3,4 cm con 70 mL; arista fuera de rango | Valores esperados; desbordamiento y rango detectados | Con el agua inicial máxima (60 mL) nunca podía ocurrir desbordamiento, aunque el modelo lo contemplaba | Rango de agua inicial ampliado a 20–70 mL | Correcto (prueba unitaria) |
| Densidad – error de resolución | Comparar error relativo con cubos pequeños y grandes | Muestras pequeñas con mayor error | La prueba original usaba 1 cm (volumen exacto) y no mostraba el efecto | Caso de prueba cambiado a 1,3 cm y 3,1 cm | Correcto |
| Densidad – interfaz | E2E: hipótesis obligatoria en modo guiado, pesar, sumergir, guardar 4 ensayos, comprobar cálculo, análisis de tendencia | Funciona; la tendencia detectada coincide con la predicha | — | — | Correcto |
| Ósmosis – modelo | 0,9 % NaCl ≈ 0,308 Osm/L; agua destilada (lisis / turgencia); 3 % (crenación / plasmólisis); equilibrio analítico; efecto de la temperatura | Valores coherentes | **Incoherencia científica:** con 0,9 % la interfaz decía «medio isotónico» y a la vez «sale agua / crenada», por tolerancias distintas (5 % vs 1 %) | Tolerancia única de 2 % de volumen; tonicidad basada en el volumen de equilibrio; la dirección del agua se deriva del gradiente | Corregido + prueba de regresión que recorre 0–3 % para ambos tipos de célula |
| Difusión – modelo | Conservación de la masa en cada punto; t½ de glucosa entre 5 y 15 min; efecto de temperatura (Stokes-Einstein con viscosidad de Vogel) y área | Correcto | El espesor efectivo inicial daba t½ ≈ 47 min (poco práctico en clase) | Espesor efectivo recalibrado (3,2 × 10⁻⁵ m); declarado como parámetro aproximado | Correcto |
| Ósmosis – interfaz | E2E: agua destilada → lisis visible, guardar ensayo, pestaña de difusión | Funciona | — | — | Correcto |
| Mendel – modelo | 3:1, 1:2:1, 9:3:3:1, 1:1, dominancia incompleta, ley de los grandes números, reproducibilidad por semilla, χ² de los datos históricos (5474:1850) y valores críticos | Correcto | — | — | Correcto |
| Mendel – interfaz | E2E: cuadro de Punnett mono/dihíbrido, siembra, χ², registro | Funciona | — | — | Correcto |
| ADN – modelo | 64 codones, AUG/stop, traducción del gen de práctica, HBB → MVHLTPEEK…; GAG→GTG = sentido erróneo en el codón 7; silenciosa, sin sentido, corrimiento, codón de inicio | Correcto | — | Nota aclaratoria: la mutación se nombra Glu6Val porque la Met inicial se retira | Correcto |
| ADN – interfaz | E2E: completar hebra complementaria, traducción, mutación falciforme y registro | Funciona | — | — | Correcto |
| Soluciones – modelo | 5,844 g NaCl/100 mL = 1,000 M; dilución 10→100 mL; A ∝ c; saturación; masa molar del pentahidrato | Correcto | — | — | Correcto |
| Soluciones – interfaz | E2E: entrada inválida («abc») muestra error; NaCl 1,000 mol/L; medir absorbancia; registrar | Funciona | — | — | Correcto |
| Enzimas – modelo | v(Km) = Vmax/2; óptimo de la amilasa entre 35 y 45 °C; actividad casi nula a 70 °C; pepsina vs amilasa según pH; v ∝ [E]; producto ≤ sustrato | Correcto | La curva de referencia del modelo se mostraba siempre y revelaba el resultado antes de experimentar | La curva queda en un panel plegable que se abre después de recolectar datos | Corregido |
| Circuitos – modelo | Serie, paralelo, mixto; mallas, nodos y conservación de la energía con r ≠ 0; interruptores; I ∝ V | Correcto | — | — | Correcto |
| Circuitos – interfaz | E2E: 0,200 A en serie, apertura de R2 → circuito abierto, paralelo con rama abierta → 1,200 A | Funciona | En el esquema en serie los interruptores de cada bombilla estaban dibujados fuera del conductor (representación físicamente engañosa); la fila «Suma» sumaba corrientes en serie (sin significado físico) | Interruptores dibujados sobre el cable; la suma de corrientes se omite en serie y se indica qué comparar en cada configuración | Corregido |
| Estequiometría – modelo | Todas las ecuaciones balanceadas; detección de no balanceadas; conservación de la masa en 5 reacciones; 4,032 g H₂ + 32 g O₂ → 36,03 g H₂O; reactivo en exceso no cambia el producto | Correcto | — | — | Correcto |
| Población – modelo | Logístico → K; con cosecha → K(1 − h/r); colapso si h > r; duplicación ln2/r; solución analítica vs integración numérica | Correcto | — | — | Correcto |
| Tendencias (análisis de hipótesis) | Lineal creciente/decreciente, constante, máximo (enzima simulada), estabilización (reactivo limitante), menos de 3 puntos | Correcto | — | Advertencia de control de variables cuando cambian otras entradas | Correcto |
| Preguntas y retroalimentación | Integridad: id único, una correcta, retroalimentación por opción, «Correcto» solo en la opción correcta, transferencia existente, 3 competencias cubiertas; E2E: incorrecta → repaso → reintento → correcta; el puntaje cuenta el primer intento | Correcto | Una opción incorrecta de la pregunta saber-est-1 tenía retroalimentación que empezaba con «Correcto» | Texto corregido; prueba automática que impide que se repita | Corregido |
| Pertinencia por grado | Revisión de contenidos y matemática exigida | Adecuada | El χ² puede exceder el nivel de 8.º | Presentado como extensión opcional | Aceptado con nota |
| Navegación | E2E: inicio → 6 grados; catálogo con búsqueda y filtros; ruta inexistente | Funciona | El botón «Elegir mi grado» usaba un ancla `#grados` que el enrutador por hash interpretaba como ruta desconocida | Reemplazado por un botón que desplaza y enfoca la sección | Corregido |
| Botones de reinicio y borrado | Revisión de código y E2E | Funcionan | `window.confirm` está bloqueado en algunos entornos incrustados y el borrado no se ejecutaba | Confirmación en la propia página (componente `ConfirmButton`) | Corregido |
| Informes | E2E: descarga del informe JSON e importación en el panel docente | Funciona | — | Alternativas «Copiar informe» cuando el entorno bloquea descargas o impresión | Correcto |
| Panel docente | E2E: asignación → código → apertura por el estudiante; importación de informes; validación de formato (prueba unitaria) | Funciona | — | Limitaciones de almacenamiento local explicadas en la interfaz | Correcto (sin servidor) |
| Diseño adaptable | Capturas a 380 px de las 9 prácticas; E2E sin desplazamiento horizontal a 375 px | Sin desbordamiento | El texto de las gráficas quedaba ilegible en móvil (SVG escalado) y había espacio vacío en tarjetas de la portada | Gráficas que miden su contenedor y conservan el tamaño real del texto; esquemas con desplazamiento interno y ancho mínimo; alineación de rejillas | Corregido |
| Encabezado | Captura en escritorio | — | El botón «Menú» aparecía también en escritorio (conflicto de especificidad CSS) | Selector corregido | Corregido |
| Accesibilidad | Revisión de código: etiquetas, `aria-live`, descripciones de gráficas y tabla equivalente, foco visible, teclado en interruptores SVG | Implementado | Las pestañas no admiten navegación con flechas (sí con Tab) | Pendiente | Parcial |
| Rendimiento | Compilación de producción | JS principal ≈ 156 KB comprimido; laboratorios cargados bajo demanda | Aviso de tamaño > 500 KB sin comprimir (texto curricular + React) | Pendiente dividir el contenido curricular por práctica | Aceptable |
| Errores en tiempo de ejecución | Consola del navegador en todas las capturas y pruebas E2E | Sin errores | — | Límite de errores (`ErrorBoundary`) para que un fallo no deje la página en blanco | Correcto |

## Funciones implementadas frente a representadas

Todo lo que aparece en la interfaz como disponible está implementado. Las 30 prácticas restantes de la malla se muestran explícitamente como «Próximamente», sin botón de acceso. No existen cuentas, base de datos, sincronización ni envío automático; la interfaz lo dice en el panel docente y en la ayuda.

---

# Fase 2: ampliación y verificación

Alcance: carga bajo demanda, 5 prácticas nuevas, servidor institucional, accesibilidad y validación curricular.

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Carga bajo demanda | Compilación de producción; prueba de que el catálogo liviano coincide con cada definición completa | Paquete inicial de ~156 KB a ~84 KB comprimidos | — | — | Correcto |
| Mitosis – modelo | Fracciones por fase, índice esperado 2/18, zona de elongación, colchicina, ADN y cromosomas en el ciclo, reproducibilidad | Correcto | — | — | Correcto |
| Ondas – modelo | v = λf, v = √(T/μ), energía ∝ A², sonido a 20 °C (343 m/s), periodicidad de la función de onda | Correcto | — | — | Correcto |
| Fotosíntesis – modelo | Inverso del cuadrado, saturación lumínica, factor limitante, óptimo térmico, compensación, luz verde | Correcto | — | — | Correcto |
| Fotosíntesis – interfaz | Revisión visual | — | Los valores del modelo (fotosíntesis neta, factor limitante) se mostraban antes de contar las burbujas | Se muestran después de medir | Corregido |
| pH – modelo | HCl 0,1 M → 1; dilución; HCl 10⁻⁸ M → 6,98; acético 0,1 M → 2,88; equivalencias fuerte (7) y débil (≈ 8,7); pKa en la semiequivalencia; curva creciente | Correcto | — | — | Correcto |
| pH – interfaz | E2E: 25 mL de NaOH → pH 7,00 y «punto de equivalencia» | Funciona | El volumen de equivalencia se mostraba antes de titular | Se muestra solo con «Mostrar la curva del modelo» | Corregido |
| Genética de poblaciones – modelo | Hardy-Weinberg, recesivo letal (1/q_t = 1/q₀ + t), ventaja del heterocigoto (p* = t/(s+t)) desde ambos lados, deriva (estadística sobre 80 poblaciones), mutación, migración, semilla | Correcto | — | — | Correcto |
| Ósmosis – interfaz | Repetición de las pruebas E2E (×5) | Funciona | **Caída intermitente de la página**: la marca de tiempo de requestAnimationFrame podía ser anterior al inicio y producir un índice negativo | Índice acotado entre 0 y el final de la serie | Corregido; prueba repetida 5/5 |
| Servidor | 12 pruebas: contraseñas scrypt, código de registro, duplicados, informes inválidos, aislamiento entre docentes, curso cerrado, límite de envíos, cierre y expiración de sesión, CORS | Correcto | El límite de 30 envíos cada 10 minutos por IP bloquearía a un salón completo detrás de la misma red | Límite por defecto subido a 120 | Corregido |
| Servidor + interfaz | E2E con servidor real: registro, curso, envío del estudiante, descarga del docente | Funciona | — | — | Correcto |
| Accesibilidad (axe-core, WCAG 2.1 A/AA) | 6 páginas, 6 pestañas del panel docente, 14 prácticas × 3 etapas e informe, en tema claro y oscuro | 0 infracciones tras las correcciones | Contraste insuficiente: etiquetas de Biología y Ambiente (4,44 y 4,66:1 sobre fondo gris, en el límite) y botón «Guardar ensayo» en tema oscuro (texto blanco sobre naranja, 2,26:1); atributo `aria-pressed` no permitido en pestañas | Colores ajustados (≥ 4,5:1), texto oscuro sobre naranja en tema oscuro, atributo eliminado | Corregido |
| Teclado en pestañas | E2E: flechas, Inicio y Fin en las etapas de la práctica | Funciona | Faltaba (señalado en la fase 1) | Patrón WAI-ARIA de pestañas con foco itinerante | Corregido |
| Validación curricular | Pruebas unitarias de importación/fusión; E2E de registro y persistencia | Funciona | — | — | Correcto |
| Encuesta de opinión | E2E: la respuesta aparece en el informe | Funciona | — | — | Correcto |

**No verificado en esta fase:** el servidor no se ha desplegado en un hosting real (solo se probó localmente); no se hicieron pruebas con lectores de pantalla reales ni con estudiantes; Firefox y Safari no se probaron.

# Fase 3: cinco prácticas más de la malla

Alcance: separación de mezclas (6.º), reflexión y refracción (8.º), leyes de Newton (9.º), leyes de los gases (10.º) y conservación de la energía mecánica (10.º). Con ellas hay 19 prácticas implementadas y 20 planificadas.

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Mezclas – modelo | Orden de los métodos (el imán antes del agua; filtrar antes de evaporar), pureza y recuperación, conservación de la masa, mezcla seca no filtrable, tiempo de evaporación | Correcto | — | — | Correcto |
| Mezclas – interfaz | Revisión visual y E2E: imán → agua → filtración → evaporación da 97,0 % de la sal | Funciona | El vaso quedaba debajo del panel de fracciones (ancho mínimo de 520 px de las ilustraciones); la bitácora usaba punto decimal y decía «la arena y el hierro se van al fondo» aunque el hierro ya se había retirado | Ancho propio para el vaso; coma decimal (es-CO) y texto según lo que queda en el vaso | Corregido |
| Óptica – modelo | Ley de reflexión, Snell en ambos sentidos, ángulo crítico vidrio→aire (41,15°), reflexión total interna, Fresnel en incidencia normal (4 % en vidrio), índice desconocido por la pendiente sen θ₂ contra sen θ₁ | Correcto | La prueba y la ficha usaban un valor redondeado del ángulo crítico que no coincidía con n = 1,52 y n_aire = 1,0003 | Valor exacto 41,15° en la prueba y ≈ 41,2° en la ficha | Corregido |
| Óptica – interfaz | Revisión visual y E2E: 28,8° de aire a agua a 40°; reflexión total de vidrio a aire a 45° | Funciona | El transportador mostraba marcas solo en la mitad derecha | Marcas en toda la circunferencia | Corregido |
| Newton – modelo | a ∝ F con m fija, a ∝ 1/m con F fija, fricción estática que impide el movimiento, a = (F − μk·m·g)/m, a medida = 2d/t² | Correcto | — | — | Correcto |
| Newton – interfaz | E2E: 2 N sobre 0,5 kg recorre 1 m en 0,707 s; en lija el carrito no se mueve | Funciona | Faltaba la unidad en la flecha F del diagrama de cuerpo libre | Etiqueta «F = 2,0 N» | Corregido |
| Gases – modelo | Boyle (PV constante), Charles con intersección en −273,15 °C, Gay-Lussac, cantidad de gas constante, resolución de los instrumentos | Correcto | — | — | Correcto |
| Gases – interfaz | E2E: 50 mL a temperatura constante dan 202,6 kPa | Funciona | — | — | Correcto |
| Energía – modelo | Conservación sin fricción, independencia de la masa, colina no superada, energía disipada igual a la pérdida mecánica, rodadura v = √(10gh/7) | Correcto | **La rampa de salida empezaba horizontal**: con cualquier fricción la esfera nunca arrancaba | Rampa con pendiente inicial, h(x) = h₀·(1 − sen(πx/3)) | Corregido |
| Energía – interfaz | Revisión de código y E2E: 4,43 m/s en el valle desde 1 m; una colina de 1,2 m no se supera | Funciona | El trazado de la pista recalculaba la simulación completa 201 veces por cuadro de animación | Trazado calculado directamente con la función de la pista y memorizado | Corregido |
| Accesibilidad (axe-core) | Las 5 prácticas nuevas, en tema claro y oscuro | 0 infracciones | — | — | Correcto |

**No verificado en esta fase:** igual que en la fase 2 (sin lectores de pantalla reales, sin pruebas con estudiantes, sin Firefox ni Safari). Los DBA de las 5 prácticas nuevas son propuestas que deben validarse con el área.

# Fase 4: aplicación sin conexión, reparto de respuestas, guías en PDF y cinco prácticas más

Alcance: aplicación instalable y sin conexión; posición de la respuesta correcta; guías de trabajo en PDF; microscopio virtual (6.º), redes alimentarias (6.º), cinemática (9.º), selección natural (9.º) y velocidad de reacción (10.º). Quedan 24 prácticas implementadas y 15 planificadas.

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Sin conexión | E2E: primera visita, recarga sin red, práctica nunca abierta (Newton) funcionando sin red, fuentes propias cargadas; manifiesto e iconos | Funciona | Las fuentes venían de Google Fonts: sin conexión se perdían y el navegador del estudiante consultaba a un tercero | Fuentes incluidas en la aplicación (Fontsource); en la versión de un solo archivo, incrustadas | Corregido |
| Aviso «listo sin conexión» | Revisión de las pruebas E2E | — | El aviso fijo podía tapar botones | Se oculta solo a los 12 s; en las demás pruebas E2E el service worker se bloquea para que sean deterministas | Corregido |
| Evaluación | Conteo de la letra correcta en las 101 preguntas | — | **75 de 101 respuestas correctas eran B y ninguna D**: marcar siempre B daba 74 % | Reordenamiento estable por pregunta sin cambiar textos (balance.ts); prueba de que cada letra queda entre 15 % y 35 % | Corregido |
| Accesibilidad de grupos de botones | Revisión de código (reporte de un subagente) | — | El grupo «Segmented» usaba la etiqueta como id: con espacios, `aria-labelledby` apuntaba a ids inexistentes y el grupo quedaba sin nombre | Id generado con `useId` | Corregido |
| Guías en PDF | Generación de las 24 guías y claves; revisión visual de páginas | Funciona | Encabezados de tabla oscuros sobre verde; texto del banner superpuesto; encabezados partidos en tablas de más de 8 columnas | Estilo de encabezado blanco, interlineado del banner, fuente menor en tablas anchas | Corregido |
| Microscopio – modelo | 15 pruebas: aumento, campo, conteo y tamaño, visibilidad por tamaño/tinción/foco, profundidad de campo, clasificación | Correcto | — | — | Correcto |
| Redes alimentarias – modelo | 12 pruebas: equilibrio estable, cascada por caza, pesticida, sequía, pirámide de biomasa, sin productor, regla del 10 % | Correcto | — | Parámetros ilustrativos afinados numéricamente (declarado en el modelo) | Correcto |
| Selección natural – modelo | 14 pruebas: h² = 0 sin evolución, sin depredación sin cambio, estabilización en B, R = h²·S a mano y analítico, simetría | Correcto | Con ancho de contraste w = 0,15 la selección casi desaparecía lejos del fondo (en clase parecería «la selección no funciona») | w = 0,30 (declarado como valor ilustrativo); el suelo volcánico produce un cambio visible en 10 generaciones | Corregido |
| Cinemática – modelo | 12 pruebas: MRU, MRUA, pendiente x–t = v, área v–t = desplazamiento, frenado, fin de pista, resoluciones, reto | Correcto | — | — | Correcto |
| Velocidad de reacción – modelo | 11 pruebas: concentración, temperatura, área, catalizadores, catalasa desnaturalizada, volumen final por estequiometría | Correcto | A 50 °C el CO₂ no cabría en la jeringa de 100 mL | El gas se lee a 25 °C (declarado en los supuestos) | Corregido |
| Laboratorios nuevos – interfaz | Revisión visual a 1280 px y 380 px (tema claro y oscuro), E2E de cada práctica, axe en las 5 | Funciona; 0 infracciones | — | — | Correcto |

**Limitaciones de esta fase:** los parámetros de las redes alimentarias, de la selección y de la cinética son ilustrativos (no medidos); los DBA de las prácticas nuevas son propuestas por validar; las guías usan un logo provisional hasta recibir el oficial.

# Fase 5: experiencia de uso e instrumentos de nivel profesional

Alcance: espacio de trabajo de la práctica y calidad visual de los 24 laboratorios.

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Espacio de trabajo | Capturas a 1366×768 (portátil escolar) y 390 px | El laboratorio empieza a 384 px del borde superior | **El área experimental empezaba a 730 px: en un portátil escolar no se veía sin desplazarse** | Encabezado compacto durante el experimento, etapas fijas con progreso, acompañamiento paso a paso, controles fijos, pantalla completa | Corregido |
| Navegación | Revisión visual | — | Contorno naranja alrededor de todo el contenido al cambiar de página (foco programático en `main`) | Sin contorno en `main` (el foco sigue llegando para lectores de pantalla) | Corregido |
| Registro de datos | Revisión de flujo | — | Al guardar un ensayo no había confirmación visible cerca del trabajo; la tabla y la gráfica quedaban lejos | Aviso «Ensayo N guardado» con acceso al cuaderno, fila nueva resaltada, tabla y gráfica lado a lado | Corregido |
| Diseño adaptable | Medición automática del desborde horizontal en las 24 prácticas a 390 px | 0 desbordes | El nuevo contenedor en cuadrícula se ensanchaba con el contenido; el mensaje vacío de las gráficas no cabía en celulares | Columna `minmax(0, 1fr)`; mensaje en varias líneas | Corregido |
| Instrumentos | Revisión de capturas de los 24 laboratorios en tema claro y oscuro | Calidad de producto | Dibujos esquemáticos (rectángulos planos, emojis que cambian según el sistema operativo) | Kit de instrumentos con vidrio, menisco, metal y pantallas; rediseño de los 24 laboratorios sin cambiar cálculos ni textos | Corregido |
| Accesibilidad tras el rediseño | axe WCAG 2.1 A/AA en todas las páginas y prácticas, temas claro y oscuro | 0 infracciones | Las hebras de ADN con desplazamiento horizontal no eran alcanzables con teclado | Región enfocable con nombre accesible | Corregido |
| Regresión | 198 pruebas unitarias y 40 de interfaz | Todas pasan | — | — | Correcto |

# Ronda de desarrollo continuo: lote 6

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Conductores – modelo | 12 pruebas: R = ρL/A a mano, metales frente a aislantes, agua salada frente a destilada, grafito, voltaje doble, umbral de brillo, suma de caídas de voltaje | Correcto | — | — | Correcto |
| Conductores – interfaz | Captura y E2E (cobre: 145,6 mA) | Funciona | El valor del amperímetro se salía de la pantalla | Tamaño de letra de las pantallas del kit ajustado al ancho disponible (beneficia a todos los laboratorios) | Corregido |
| Descomposición – modelo | 10 pruebas: decaimiento exponencial, plástico sin cambio, Q₁₀ = 2, óptimo de humedad, aireación, tamaño, vida media | Correcto | — | Parámetros k declarados como ilustrativos; sin fracción resistente (declarado) | Correcto |
| Descomposición – interfaz | Captura en tema oscuro y E2E (banano: 45,2 % en 4 semanas; plástico: 50,0 g) | Funciona | — | — | Correcto |
| Equilibrio – modelo | 11 pruebas: Kc constante tras perturbar, Q frente a K a mano, precipitación con Ag⁺, efecto de la temperatura, compresión de NO₂/N₂O₄ | Correcto | — | — | Correcto; **por verificar:** la entalpía de formación de FeSCN²⁺ usada (−6 kJ/mol) es aproximada y hace sutil el efecto de la temperatura en el sistema A (el sistema B sí lo muestra claramente) |
| Equilibrio – interfaz | E2E (absorbancia 0,427 → 0,781 al agregar Fe³⁺, Q < K) | Funciona | — | — | Correcto |
| Ronda | Ejecución con agentes en paralelo | — | Los agentes se detuvieron al alcanzar el límite de uso | Se reanudaron en la ronda siguiente con su contexto | Resuelto |

# Corrección de experimentos «no activos» y programa de nivel universitario (U1, U2)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Etapas de la práctica | Barrido automático de las 27 prácticas como estudiante nuevo | Todas las simulaciones responden | **En la práctica guiada (modo por defecto) la pestaña Experimento aparecía deshabilitada, sin explicación, hasta guardar la hipótesis: parecía que el experimento no funcionaba** | Las etapas nunca se deshabilitan; aviso con «Formular mi hipótesis» o «Explorar sin hipótesis»; igual para el análisis sin ensayos | Corregido |
| Actualizaciones | Revisión del service worker | — | Una versión nueva solo se activaba al pulsar «Actualizar»: quien no lo hacía seguía viendo prácticas «Próximamente» ya publicadas | La versión nueva se activa sola en el siguiente cambio de página (el trabajo guardado se conserva) | Corregido |
| U1 · Análisis de datos | 17 pruebas de ajustes (errores estándar contra fórmulas clásicas), axe del cuaderno e informe | Correcto | La recta de ajuste aparecía siempre, también en relaciones no lineales | Modelo de ajuste elegible (lineal, proporcional, cuadrático, exponencial, potencia, logarítmico) con incertidumbre, R², residuos, cursor, zoom, linealización y barras de incertidumbre | Corregido |
| U2 · Identidad visual | Capturas a 1366 y 390 px en ambos temas, axe | 0 infracciones tras corregir | Faltaban variables de vidrio y mesa en el tema oscuro explícito; desborde de 62 px en las etapas a 390 px; tablas del banco no alcanzables con teclado en celular | Variables completas; sin desborde; todas las tablas con desplazamiento son regiones enfocables | Corregido |
| Regresión | 248 pruebas unitarias y 43 de interfaz con axe | Todas pasan | — | — | Correcto |

# Docente conectado (T1) y sensores en tiempo real (U4)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Servidor de seguimiento | 23 pruebas nuevas: aislamiento entre docentes, cursos y estudiantes; PIN con scrypt y bloqueo tras 5 intentos; validación y tamaño máximo; idempotencia y versiones; CSV sin fórmulas; límites | Correcto | — | — | Correcto |
| Seguimiento del curso | E2E de punta a punta (el docente crea el curso, el estudiante se une con código y PIN, mide y responde, el docente ve su avance y puntaje) y axe en ambos temas a 1280 y 390 px | Funciona; 0 infracciones | — | — | Correcto |
| Sincronización del estudiante | Revisión de código y E2E | Funciona sin bloquear el laboratorio si el servidor falla; cola sin conexión | — | — | Correcto |
| Registrador de datos (U4) | 10 pruebas de la lógica (muestreo, disparo, estadísticas, ruido con semilla), axe | Correcto | Pocas marcas en el eje, unidad encimada en la pantalla, marcadores tapaban el canal | Corregidos antes de integrar | Corregido |
| Supuestos declarados | Revisión | — | El sensor de presión de cinética y el oxígeno disuelto de fotosíntesis no salen directamente de los modelos originales | Se calculan con supuestos explícitos (matraz tapado a T constante; 1 g de elodea en 100 mL) mostrados en la interfaz | Declarado |
| Regresión | 281 pruebas unitarias y 46 de interfaz con axe | Todas pasan | Conflicto de estilos al integrar (bloques añadidos por ambos lados) | Se conservaron ambos bloques | Correcto |

# Medición realista (U3) y física A (proyectiles, péndulo)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Medición realista | 21 pruebas (ruido reproducible, cuantización, estadística de repeticiones, propagación en cocientes y productos) y E2E (tres repeticiones en modo real difieren; en modo ideal coinciden) | Correcto | Con varios ensayos, la tabla ancha de densidad ensanchaba la página 178 px | `.table-wrap` con posición relativa | Corregido |
| Proyectiles | 13 pruebas: alcance v₀²sen2θ/g, ángulos complementarios, ángulo óptimo con altura, conservación de la energía sin aire, arrastre | Correcto | — | — | Correcto |
| Péndulo | 11 pruebas: período de pequeñas oscilaciones (0,1 %), período exacto, independencia de la masa, +7 % a 60°, T² ∝ L, energía, amortiguamiento, Luna | Correcto | — | — | Correcto |
| Regresión | 324 pruebas unitarias y 50 de interfaz con axe | Todas pasan | — | — | Correcto |

# Física A completa (choques) y lote 7 (conservación de la masa)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Choques | 13 pruebas: conservación de p en los cuatro tipos, Ec conservada solo en el elástico, e = 0 pega los deslizadores, explosión desde el reposo, valores calculados a mano, p conservado durante el contacto | Correcto | — | — | Correcto |
| Conservación de la masa | 12 pruebas: estequiometría de las cuatro reacciones, reactivo limitante, masa constante en sistema cerrado, pérdida igual al CO₂ en sistema abierto, empuje del aire sobre el globo, O₂ limitante en el frasco sellado | Correcto | — | — | Correcto |
| Interfaz | E2E de ambas prácticas, capturas en tema claro y oscuro, axe en todas las etapas | 0 infracciones | — | — | Correcto |
| Supuestos declarados | Revisión | — | La lana de acero arde de forma incompleta en el aula; en el frasco sellado la presión supera 200 kPa | Se declaran en los límites del modelo, con aviso de seguridad | Declarado |
| Regresión | 349 pruebas unitarias y 52 de interfaz con axe (suite completa) | Todas pasan | — | — | Correcto |
| Cuaderno de laboratorio | Rediseño como software científico: tabla tipo hoja de cálculo con encabezado fijo, panel de configuración, gráfica con leyenda, residuos y cuadro de ajuste con parámetros ± incertidumbre; axe del cuaderno lleno en ambos temas a 1366 y 390 px | 0 infracciones, sin desborde horizontal | Tabla apretada con texto en 5 líneas, columnas cortadas, botones de la gráfica como texto | Rediseño completo conservando nombres accesibles y lógica de análisis | Corregido |

# Lote 7 completo (respiración celular y contaminación del agua)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Respiración celular | 11 pruebas: Q10 = 2 y óptimo, CR de glucosa (1,00) y trioleína (57/80), ATP 32/30/38/36 y 2, corrección con termobarómetro, fermentación en anoxia | Correcto | — | — | Correcto |
| Contaminación del agua | 15 pruebas: saturación de O₂ (Benson–Krause), mezcla completa, punto crítico de Streeter–Phelps calculado a mano, clases BMWP/Col e ICA, normas | Correcto | — | — | Correcto |
| Medición realista | Fichas de instrumento de ambas prácticas en `instruments.ts` | El selector ideal/real aparece | — | — | Correcto |
| Supuestos declarados | Revisión | — | Umbrales de presencia de macroinvertebrados didácticos; ríos ilustrativos; normas por validar; levadura excluida por efecto Crabtree | Declarados en la interfaz y en los límites del modelo | Declarado |
| Regresión | 375 pruebas unitarias y 54 de interfaz con axe (suite completa) | Todas pasan | Prueba E2E con texto repetido en dos lecturas | Selector más preciso | Corregido |

# Manipulación directa (U5) y física B (máquinas simples, calor)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Manipulación directa | 12 pruebas de la geometría (límites, ajuste a la escala, teclado, ángulos que cruzan ±180°, zonas de soltado, objetivo mínimo de 44 px) y 5 E2E con teclado y arrastre en gases, óptica, circuitos, densidad, péndulo, proyectiles y Newton | Correcto; una sola fuente de verdad con los controles del panel | Controles interactivos dentro de escenas `role="img"` no pasan axe | Capa superpuesta con `role="group"` y el mismo viewBox | Corregido |
| Máquinas simples | 14 pruebas: equilibrio de momentos con y sin masa de la barra, ventaja mecánica, recorridos, polea fija, móvil y polipasto con rozamiento, trabajo, fuera de escala | Correcto | La prueba E2E no seleccionaba «Poleas» antes de «Polipasto» | Prueba corregida | Correcto |
| Calor y equilibrio térmico | 14 pruebas: Te a mano, solución exacta contra integración numérica, balance de energía, icopor frente a vidrio y lata, calor específico recuperado | Correcto | — | — | Correcto |
| Supuestos declarados | Revisión | — | Pérdidas de los recipientes ilustrativas; eficiencia de 99 % en el caso ideal por redondeo de lecturas | Declarados en la interfaz | Declarado |
| Regresión | 415 pruebas unitarias y 61 de interfaz con axe (suite completa) | Todas pasan | — | — | Correcto |

# Publicación, presión, sonidos y manipulación ampliada

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Publicación en GitHub Pages | Revisión de las ejecuciones de GitHub Actions | Las publicaciones desde «Choques» no llegaban a la página | axe en el servidor de integración: la línea de tiempo del seguimiento era una región desplazable sin acceso por teclado (el ancho de ventana del servidor difiere del local) | Región enfocable; la publicación vuelve a pasar | Corregido |
| Presión en líquidos | 13 pruebas: p = ρgh, manómetro en U, membrana en cualquier orientación, vasos de Pascal, Torricelli, atmósfera estándar e isotérmica; E2E con teclado sobre la sonda | Correcto | — | — | Correcto |
| Sonidos | 15 pruebas (envolventes, limitador, preferencias, modo silencioso sin AudioContext) y 3 E2E (sin audio antes de un gesto, botón «Sonido», volumen) | Correcto; sonidos sintetizados, sin archivos | El zumbido del circuito suena al abrir la práctica si el circuito está cerrado | Se detiene con el botón «Sonido» | Declarado |
| Manipulación ampliada | 4 E2E nuevas: tubos que se agregan, se sacan y se meten al baño; perillas; arrastre de la lámpara y de la muestra | Correcto | — | — | Correcto |
| Encabezado | Altura medida de 390 a 1600 px | Una sola fila en todos los anchos | El botón «Sonido» hacía que el encabezado ocupara dos filas a 1366 px | Menú compacto bajo 1000 px; iconos del menú ocultos en escritorio | Corregido |
| Regresión | 443 pruebas unitarias y 69 de interfaz con axe (suite completa) | Todas pasan | Conflicto de importaciones al integrar | Se conservaron ambas | Correcto |

# Lote 8 (ecosistema, balanceo de ecuaciones, expresión génica)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Ecosistema | 13 pruebas: luz y pH calculados a mano, ciclo día/noche, frasco estable, oscuridad, sobrepoblación y K, sin descomponedores, conservación de O₂ + CO₂/1,375 | Correcto | — | — | Correcto |
| Balanceo de ecuaciones | 16 pruebas: analizador de fórmulas con paréntesis e hidratos, conteo de átomos, solucionador racional de espacio nulo (12 reacciones con solución única), MCD, masas | Correcto | — | — | Correcto |
| Expresión génica | 14 pruebas: el ARNm maduro (626 nt) traduce exactamente la β-globina humana (147 aa); anemia falciforme, codón 40 sin sentido, corrimiento del marco, sitios de empalme, promotor y poli-A | Correcto | — | — | Correcto |
| Catálogo | E2E de búsqueda | — | La búsqueda «adn» ahora encuentra también «Expresión génica» | Prueba actualizada a 2 resultados | Correcto |
| Supuestos declarados | Revisión | — | Parámetros fisiológicos ilustrativos; intrón 2 acortado; sin degradación del ARNm con terminación prematura | Declarados en la interfaz | Declarado |
| Regresión | 486 pruebas unitarias y 72 de interfaz con axe (suite completa) | Todas pasan | — | — | Correcto |

# Física C: conducción del calor y sonido y resonancia

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Conducción del calor | 15 pruebas: estado estacionario de la aleta y su flujo, solución erfc del medio semiinfinito, estabilidad del esquema explícito frente a Crank–Nicolson, convergencia de malla, orden de caída de tachuelas, temperatura de contacto | Correcto | El identificador «saber-con-1» ya lo usaba «Conductores y aislantes» | Preguntas renombradas a «cdc-» | Corregido |
| Sonido y resonancia | 13 pruebas: resonancias a (2n−1)λ/4 con corrección de extremo, espaciado λ/2 en tubo cerrado y abierto, Q y ancho del pico, osciloscopio, −6,02 dB al duplicar la distancia | Correcto | — | — | Correcto |
| Interfaz | E2E de ambas prácticas, axe en todas las etapas, capturas | 0 infracciones | La prueba contaba filas de la primera tabla de la página (una tabla del laboratorio) | La prueba verifica el aviso de ensayo guardado | Corregido |
| Regresión | 514 pruebas unitarias y 74 de interfaz con axe (suite completa) | Todas pasan | — | — | Correcto |

# U6 · Modo avanzado

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Ecuaciones en vivo | Pruebas del analizador de notación, sustitución paso a paso (densidad completa), paréntesis en negativos y potencias; E2E en densidad (se actualiza en vivo y la preferencia sobrevive a la recarga) | Correcto; MathML con equivalente en texto | — | — | Correcto |
| Parámetros editables | Pruebas de rangos y del texto de resumen; E2E en Newton con g = 1,62 m/s² (lecturas 0,98 → 0,16 N y 1,27 → 1,88 N; nota automática en el ensayo; restablecer) | Correcto | — | — | Correcto |
| Curva del modelo | Pruebas de las curvas de 11 prácticas con transformaciones de ejes; E2E de leyenda, residuos y tablas | Correcto | — | — | Correcto |
| Regresión | 559 pruebas unitarias y 77 de interfaz con axe (suite completa) | Todas pasan | Conflicto en la hoja de ruta al integrar | Se conservaron ambas versiones | Correcto |

# Trabajo, flotación y movimiento

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Trabajo y plano inclinado | 12 pruebas: caso inicial a mano, F·d = m·g·h + Q, límite μ → 0, tendencias, eficiencia independiente de la masa, P = F·v, torno, escalera | Correcto | — | — | Correcto |
| Empuje y flotación | 13 pruebas: E = ρ·g·V, peso aparente, fracción sumergida, umbral del huevo, bola y barco de plastilina, densímetro | Correcto | En la escena aparecía una copia del objeto dentro del vaso cuando sobresalía del borde (un `<svg>` anidado se posicionaba mal) | Recorte con `clipPath` | Corregido |
| Movimiento | 9 pruebas: tiempos, pasos por fotopuertas, ida y vuelta, carrera y adelantamiento, conversión de unidades, cronometraje a mano con tiempo de reacción | Correcto | — | — | Correcto |
| Cuaderno | Revisión visual con datos ideales | — | Con datos sin dispersión se mostraba «± 0,00000000» y un eje de residuos de 10⁻¹² | Se escribe «± 0» y una nota de residuos nulos | Corregido |
| Regresión | 568 pruebas unitarias y 80 de interfaz con axe (suite completa) | Todas pasan | — | — | Correcto |

# Interferencia, inducción y circuitos simples

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Interferencia y difracción | Pruebas del modelo (Fraunhofer de rendija, doble rendija, red, Airy); E2E: Δy = 10,40 mm con d = 250 µm y L = 100 cm da λ = 650,0 nm | Correcto | — | — | Correcto |
| Inducción electromagnética | 12 pruebas: campo del dipolo (axial = 2 × ecuatorial, 1/r³), espira exacta con integrales elípticas, solenoide 4,929 mT frente a 5,027 mT ideal, flujo analítico frente a numérico, ∫ε dt independiente de la rapidez, generador 2,513 V, transformador 120 V → 6 V; E2E: pico −86 mV y área −5,32 mV·s | Correcto | El identificador de la pregunta Saber `saber-ind-1` ya existía (preguntas de indagación) | Se usó `saber-emi-1` | Correcto |
| Circuitos simples | 16 pruebas: análisis nodal, ley de Ohm, cortocircuito, circuito abierto, serie y paralelo, ley de nodos de Kirchhoff, polaridad del LED, motor y zumbador, conductores y aislantes; E2E: 0,223 A en serie y 0,621 A en paralelo | Correcto | En la prueba E2E el valor del multímetro aparecía dos veces (lectura y tablero) | Selector más preciso | Correcto |
| Regresión | 615 pruebas unitarias y 83 de interfaz con axe (suite completa) | Todas pasan | — | — | Correcto |


# Programa v2 · Fase 1: línea base de regresión

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Valores dorados | 47 casos (uno por práctica) + prueba de cobertura del catálogo: 32 con valor calculado a mano, 9 con valor de referencia y 6 de línea base (5 por instantánea) | 48 de 48 pasan | Cuatro casos fallaron en el primer intento por datos de la prueba (pista de 1 m, densidad del aire en g/mL, identificador «guisante», rango de velocidad ±1 m/s); ningún modelo estaba mal | Se ajustaron las entradas de la prueba | Correcto |
| Referencias del prompt | pH HCl 0,100 M = 1,000; ácido acético 0,100 M = 2,875; volumen molar 22 413,97 mL; Ep = 19,62 J y v = √(2gh) | Cumplen | La jeringa de gases fija 101,3 kPa (22 420 mL); la pista de energía no admite h = 10 m | Documentado; se atiende en la Fase 3 | Pendiente (Fase 3) |
| Accesibilidad | axe con WCAG 2.2 AA en todas las prácticas, temas claro y oscuro, y en teléfono | Pasa | En teléfono, bancos y tablas desplazables no recibían el foco del teclado en 18 prácticas | Utilidad central `initScrollRegionFocus` | Corregido |
| Regresión | Suite completa: 663 pruebas unitarias y 85 E2E | Todas pasan | — | — | Correcto |

# Lote 10: extracción de ADN, el mol y reto de indagación (50 prácticas)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Extracción de ADN y complementariedad | 12 pruebas: factores del índice de rendimiento, tendencias, complemento, puentes de hidrógeno (2 y 3), regla de Wallace (GATTACAGGA = 28 °C), Chargaff en doble hebra y no en hebra sola; E2E: 43 u.a., 10 de 10 pares, 24 puentes, Tm = 28 °C | Correcto | — | — | Correcto |
| El mol | 18 pruebas: masas molares (NaCl 58,44; H₂O 18,015; sacarosa 342,30), N = n·N_A, volumen molar 22,414 L, tara, conservación de la masa en todo el rango; E2E: 1,250 g → 0,02139 mol; vinagre pierde 1,048 g de CO₂ | Correcto | — | — | Correcto |
| Reto de indagación | 10 pruebas: misma semilla da los mismos datos, σ del ruido igual a la declarada (±3 % en 20 000 muestras), estadísticos y ajuste a mano, cada disparador de la crítica, confusión que invierte la pendiente; E2E: pendiente −0,135 ± 0,024 mg/L por km con semilla 123 y rótulo de datos sintéticos | Correcto | — | — | Correcto |
| Honestidad (programa v2) | Revisión de rótulos: «Ilustración educativa», «Modelo calculado», «Datos sintéticos … (semilla N)»; sin datos reales inventados ni referencias dudosas | Correcto | — | — | Correcto |
| Regresión | 706 pruebas unitarias (incluidos 50 valores dorados) y 88 E2E con axe WCAG 2.2 AA y teléfono | Todas pasan | En la prueba E2E del catálogo cambiaron los conteos (búsqueda «adn» y química) por las prácticas nuevas | Conteos actualizados | Correcto |

# Programa v2 · Fase 2: procedencia, registro reproducible y privacidad

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Procedencia | 3 pruebas unitarias (ninguna práctica declara evidencia experimental; modo real y datos sintéticos rotulados; columna de estatus en el CSV) y E2E de la franja y la etiqueta del cuaderno | Correcto | — | — | Correcto |
| Registro reproducible | 5 pruebas unitarias (campos, sin datos personales, ida y vuelta exportar → importar con los mismos ensayos, rechazo de formato/práctica/columnas/valores inválidos, coincidencia con el esquema JSON) y E2E (descargar, borrar la tabla, importar y recuperar; rechazo de otra práctica) | Correcto | Al importar, el mensaje contaba los ensayos antes de que React aplicara el cambio y decía que no había ensayos nuevos | Se cuenta sobre la sesión actual y luego se actualiza | Corregido |
| Privacidad | Revisión de textos del seguimiento y del informe | Correcto | El formulario pedía «nombre y apellido» | Alias o código por defecto | Corregido |
| Documentación | ADR 0001–0005, plantillas, licencias; revisión cruzada con el código | Correcto | El ADR 0003 describía campos con nombres distintos a los implementados | Se alineó con el esquema real | Corregido |
| Regresión | 714 pruebas unitarias y 89 E2E (axe WCAG 2.2 AA, teléfono) | Todas pasan | — | — | Correcto |

# Programa v2 · Fase 3: física y química ampliadas con 3D y QR

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Energía en el tiempo | 15 pruebas: caso de referencia (98,1 J; 14,007 m/s; 1,4278 s) para todo Δt; deriva RK4 sin aire ≤ 1,3×10⁻¹⁴ (tolerancia declarada 10⁻⁶); convergencia de 4.º orden con aire lineal frente a la solución exacta; Euler supera la tolerancia; altura máxima; Luna y Marte; E2E con el indicador encendido y apagado | Correcto | — | — | Correcto |
| Gases | Valor dorado: 1 mol, 0 °C, 101,325 kPa → 22 413,97 mL | Correcto | La ley de Charles ignoraba la presión recibida | Campo opcional `externalPressure` y parámetro del modo avanzado | Corregido |
| Geometría molecular 3D | 16 pruebas (lector SDF con límites, distancias y ángulos a mano, SHA-256 y CID de los 12 confórmeros, CH₄ 109,5°, lineales 180°, planas 120° de media, clases VSEPR); valor dorado tetraédrico; E2E (agua 104,0° frente a 109,5°; 0,969 Å); visor revisado con WebGL en tema claro y oscuro | Correcto | El visor encuadraba las moléculas pequeñas diminutas (3Dmol encuadra un radio mínimo de ~5 Å) | Encuadre después del estilo y zoom según el tamaño real de la molécula | Corregido |
| QR por práctica | Unidad (enlaces válidos y estables para las 51 prácticas); E2E (decodificación con jsQR, apertura en teléfono, axe del diálogo, indicador apagado); 100 PDF decodificados sin errores | Correcto | — | — | Correcto |
| Regresión | 750 pruebas unitarias y 95 E2E (axe WCAG 2.2 AA, teléfono) | Todas pasan | — | — | Correcto |

