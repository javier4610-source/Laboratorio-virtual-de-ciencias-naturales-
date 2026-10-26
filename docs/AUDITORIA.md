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

# Programa v2 · Fase 4: secuencias, BLAST y rastreo génico

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Secuencias | 39 pruebas: 64 codones × 3 tablas y 12 codones ambiguos iguales a Biopython 1.85; %GC y reverso complementario; traducción de los CDS igual a la anotación; ORF exactos; 16 alineamientos con puntaje igual a Biopython; BLOSUM62 igual al archivo del NCBI; E2E (51,3 % GC, ORF 51..494, insulina humana frente a bovina: 458,0 y 80,0 %) | Correcto | — | — | Correcto |
| BLAST | 37 pruebas con respuestas grabadas de una búsqueda real (RID D9HJG79C016): analizador, cola con 10 s entre contactos y 60 s por RID, límites, listas permitidas, estados; E2E sin servidor (aviso, formulario oficial, resultado grabado rotulado) | Correcto | La búsqueda real tardó 67 min en la cola del NCBI | Tiempo máximo de 120 min en el proxy | Correcto; la búsqueda en vivo queda **bloqueada por infraestructura** hasta publicar el servidor |
| Rastreo génico | 17 pruebas; validación contra los registros en vivo 67/67 y 25 enlaces con respuesta 200; E2E (HBB c.20A>T → p.Glu7Val, 99,3 %; 39,1 % exónico) | Correcto | 11 enlaces de Reactome no verificables (dominio bloqueado en el entorno) | Marcados «no verificado» en el informe | Parcial (enlaces) |
| Regresión | 847 pruebas unitarias y 97 E2E (axe WCAG 2.2 AA, teléfono) | Todas pasan | — | — | Correcto |

# Corrección: visor 3D de geometría molecular (reportado por el docente)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Visor 3D | Chromium con GPU por software, sin WebGL (`--disable-webgl`), sin poder descargar 3Dmol.js (sin service worker y con la descarga bloqueada), teléfono 390 × 844 | Con WebGL funciona (dibuja y gira al arrastrar); sin WebGL o sin descarga solo mostraba un aviso | En equipos sin WebGL o sin conexión no había vista de la molécula; los errores internos apagaban el visor sin registro | Vista de respaldo en SVG con las coordenadas reales (girar con ratón, dedo o teclado; elegir átomos; medir), registro de errores en la consola, 3Dmol.js incluido en la descarga sin conexión | Corregido; E2E nuevo `tests/e2e/geometria.spec.ts` |
| Regresión | 847 pruebas unitarias y 98 E2E (axe WCAG 2.2 AA, teléfono) | Todas pasan | — | — | Correcto |

# Programa v2 · Fase 5: visor de estructuras de proteínas

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Lector de estructuras | 16 pruebas: cadenas, residuos (estándar, heterogrupos, agua) y átomos de las 5 estructuras iguales a Biopython 1.85; 20 distancias con tolerancia 10⁻³ Å (p. ej., puente disulfuro de la insulina 2,027 Å; His87–Fe del hemo 2,146 Å); fracciones de pLDDT de OCA2 iguales a las de la API de AlphaFold; entradas malformadas rechazadas | Correcto | — | — | Correcto |
| Visor | E2E con WebGL (2,027 Å) y sin poder descargar el visor (traza de respaldo, mismas mediciones, axe); capturas en tema claro y oscuro con insulina, OCA2 (AlphaFold) y hemoglobina | Correcto | Las marcas A, B y R de la cinta de secuencia tapaban el título | Más espacio sobre la primera fila | Corregido |
| Regresión | 865 pruebas unitarias y 100 E2E (axe WCAG 2.2 AA, teléfono) | Todas pasan | — | — | Correcto |


# Programa v2 · Fase 6: metabolismo con análisis de balance de flujos

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Solucionador FBA | 24 pruebas: crecimiento con glucosa 10 mmol/gDW/h igual a COBRApy 0.32.1 con GLPK (0,873921506968 y 0,211662949735 h⁻¹); 439 casos (fuentes de carbono, oxígeno, eliminaciones de genes y reacciones) con error relativo máximo 3×10⁻¹²; balance de masa ‖S·v‖ ≤ 10⁻⁹; reglas GPR; FVA con error ≤ 4,8×10⁻¹⁰; genes esenciales (aerobio: gltA, icd, gapA, ptsH, ptsI, eno, pgk; anaerobio además tpiA, ppc, pgi); entradas fuera de rango rechazadas | Correcto | — | — | Correcto |
| Práctica | E2E (0,8739 h⁻¹ y 48 min; sin oxígeno 0,2117 h⁻¹ y 24,2 %; guardar en la tabla); axe WCAG 2.2 AA en tema claro, oscuro y teléfono; capturas en ambos temas | Correcto | Una referencia bibliográfica no verificable desde el entorno | Retirada de las referencias | Corregido |
| Licencias | Modelo con cita (PMID 26443778); licencia del archivo del modelo | Parcial | La licencia de BiGG no se pudo consultar (dominio bloqueado) | Registrada como «Por verificar» en `docs/v2/LICENCIAS.md` | Parcial |
| Regresión | 891 pruebas unitarias y 101 E2E (axe WCAG 2.2 AA, teléfono) | Todas pasan | — | — | Correcto |

# Rediseño visual y práctica 56: energía cinética y potencial (versión 1.7.0)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Rediseño visual | E2E completo con axe WCAG 2.2 AA en tema claro, oscuro y teléfono; capturas de inicio, catálogo, grado y prácticas en ambos temas a 1280 y 390 px | Correcto | Números decorativos del ciclo con contraste 1,79:1; el diálogo «Mi curso» se auditaba a mitad de su animación de opacidad | Contraste ≥ 3:1 (texto grande); la animación del diálogo solo desplaza | Corregido |
| Modelo de energía cinética y potencial | 28 pruebas: 98,1 J y 14,007 m/s calculados a mano; Δt de la fotopuerta = 3,5696 ms; doble rapidez → 4 × Ec; ½kx² = ½mv²; conservación en todo instante con y sin rozamiento o aire; comparación con integración RK4 independiente; rangos y casos límite | Correcto | — | — | Correcto |
| Práctica | Valor dorado (caso 9.1 del programa); E2E de las tres estaciones (100,00 ms y 0,0625 J; 98,1 J, 9,81 N, 3,57 ms y 14,0 m/s; resorte 2,50 N) y del teclado; axe en ambos temas; capturas | Correcto | La burbuja de ayuda del botón «Tabla» de las gráficas ensancha la página a 390 px | Recorte local en el contenedor de gráficas de esta práctica | Correcto (pendiente revisar la causa general en el componente de gráficas) |
| Regresión | 920 pruebas unitarias y 105 E2E (axe WCAG 2.2 AA, teléfono) | Todas pasan | — | — | Correcto |

# Retiro de la etapa de hipótesis (pedido del docente, ADR 0006)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Etapas y progreso | Prueba unitaria: cinco etapas (Preparación, Experimento, Análisis y conclusión, Evaluación, Modelo y referencias) y avance de 0, 25, 50, 75 y 100 %; E2E: la práctica abre en Preparación, el botón lleva al Experimento y el progreso pasa a 25 % | Correcto | — | — | Correcto |
| Modo guiado | E2E de densidad en «Práctica guiada»: experimento abierto sin hipótesis; el Análisis sigue bloqueado hasta guardar un ensayo | Correcto | — | — | Correcto |
| Ninguna práctica con hipótesis | E2E que abre las 56 prácticas: 5 pestañas, ninguna pestaña ni botón con «hipótesis»; prueba unitaria: ninguna ficha tiene `hypothesis` y ningún paso o pregunta guía pide formular o comparar una hipótesis | Correcto | Cuatro procedimientos pedían «escribe tu hipótesis» o «compara con tu hipótesis» (metabolismo, proteínas, reto, secuencias) y una pregunta de interpretación de proteínas pedía «formular una hipótesis» | Redactados sin la etapa | Corregido |
| Análisis y conclusión | E2E: tendencia «aumenta» detectada, sin comparación con la hipótesis ni veredicto; axe WCAG 2.2 AA de la etapa en ambos temas; capturas | Correcto | — | Componente de tendencia separado; sin `relations` solo se muestran interpretación y conclusión | Correcto |
| Compatibilidad de sesiones y servidor | Pruebas unitarias: sesión antigua con hipótesis se carga; el resumen nuevo no envía hipótesis y el servidor lo acepta; un resumen antiguo con la etapa `hipotesis` se valida y se restaura; E2E de seguimiento con datos antiguos: no se muestra la hipótesis | Correcto | — | Campos `hypothesis` y `comparison` opcionales y obsoletos | Correcto |
| Informe y registro | Pruebas unitarias: el informe lleva los campos vacíos (para paneles anteriores) sin el texto antiguo; el registro nuevo no trae `hipotesis` y uno antiguo que la trae se sigue importando; esquema JSON con `hipotesis` opcional y obsoleta | Correcto | — | Formatos `lvcn-informe-v1` y `lvcn-registro-experimento/1` se conservan | Correcto |
| Guías en PDF | `npm run guias` (112 PDF) y extracción de texto | Sin actividad ni pregunta de hipótesis; quedan menciones del concepto científico (chi-cuadrado, FBA, AlphaFold, estándares del MEN) | — | Actividad 1 solo con variables; pregunta de tendencia en el análisis; rúbrica sin hipótesis | Correcto |
| Regresión | 930 pruebas unitarias (Vitest, 58 archivos) y 106 E2E (axe WCAG 2.2 AA en tema claro, oscuro y teléfono) | Todas pasan | — | — | Correcto |

# Química inorgánica y kit 3D (versión 2.1.0)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Kit 3D | 18 pruebas: Na–Cl = a/2; coordinación 6:6, 8:4 y 8:8; densidades calculadas frente a las publicadas (< 1,5 %; NaCl 2,1635 frente a 2,17 g/cm³); conservación de átomos en toda la animación; rechazo de ecuaciones no balanceadas; visor con WebGL y respaldo SVG con `--disable-webgl` | Correcto | El lienzo 3D no se encogía en teléfonos | `minWidth: 0` en las figuras del kit | Corregido |
| Motor de nomenclatura | 149 compuestos con sus tres nombres en español; 145 con CID de PubChem de la misma fórmula y nombre del motor entre sus sinónimos; casos difíciles (Fe, Cu, Sn, Pb, Hg; ácidos de Cl, Br, I, S, N, P, C, Mn, Cr; peróxidos; hidruros) | Correcto | Agrupamiento de Hg₂; «cloruro de carbono» sin «(IV)» | Corregidos | Correcto |
| Modelos de pH | pH por balance de cargas igual al modelo existente (10⁻⁸); HCl 0,1 M = 1,00; acético 0,1 M = 2,875; equivalencia HCl/NaOH 7,00; NaHCO₃ 8,34; NH₄Cl 5,12; Mg(OH)₂ saturado 10,35 | Correcto | — | — | Correcto |
| Prácticas | Valores dorados; E2E de las tres prácticas y sin WebGL; axe WCAG 2.2 AA en ambos temas; teléfono sin desbordamiento; capturas revisadas | Correcto | Chip de texto largo ensanchaba la página 45 px a 390 px | Chip con salto de línea | Corregido |
| Regresión | 975 pruebas unitarias y 117 E2E | Todas pasan | Las pruebas que recorren todas las prácticas superaban 5 min | Tiempo máximo de 10 min | Corregido |

# Química orgánica, parte 1 (versión 2.2.0)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Motor de nomenclatura | 189 SMILES (188 estructuras) frente al IUPACName de PubChem (LexiChem): 173 idénticas; 4 solo paréntesis; 8 nombres retenidos de uso general; 3 localizador del cicloalqueno; 0 sin clasificar (la prueba falla si aparece una). 30 nombres en español a mano, E/Z, regla 2013 de la cadena más larga y orden alfabético por idioma | Correcto | — | — | Correcto (el «-1-» en cicloalquenos sustituidos es una convención por verificar en el texto IUPAC 2013) |
| Propiedades | Valores literales de PubChem PUG View (HSDB con su obra citada), con URL y fecha; huecos mostrados como «Sin información» | Correcto | NIST WebBook inaccesible desde el entorno | Solo HSDB citando CRC o Riddick | Parcial (algunos ΔcH° sin dato) |
| Geometría | C–C 1,512 / C=C 1,334 / C≡C 1,200 Å; benceno 6 × 1,395 Å; Hückel del benceno 2, 1, 1, −1, −1, −2 β | Correcto | El confórmero del tropilio de PubChem no es plano | Se muestran los dos veredictos con nota | Correcto |
| Prácticas | Valores dorados; 12 E2E con axe en ambos temas, 390 y 1280 px; visor con WebGL y sin WebGL; capturas revisadas | Correcto | — | — | Correcto |
| Regresión | 1039 pruebas unitarias y E2E completo | Todas pasan | Las pruebas que recorren todas las prácticas superaban 10 min | Tiempo máximo de 15 min | Corregido |

# Química orgánica, parte 2 (versión 2.3.0)

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Nomenclatura de grupos funcionales | 176 estructuras frente al IUPACName de PubChem: 156 idénticas; 20 diferencias de convención clasificadas (localizadores implícitos, nombres retenidos, paréntesis); 0 sin clasificar | Correcto | — | — | Correcto |
| Propiedades | Tₑb (96), solubilidad (102), pKa/pKb (57), ΔcH° (42) de PubChem/HSDB con su obra citada; huecos «Sin información» | Correcto | El ΔcH° del etanol de PubChem queda 30,5 kJ/mol fuera de la serie de los alcoholes | Se usa tal cual, marcado en la interfaz y en una prueba | Parcial (dato a revisar con otra fuente) |
| Reacciones | 24 reacciones balanceadas y con átomos conservados; Hess con ΔcH° citados (metano −890,8 kJ; hidrogenación del ciclohexeno −117,9 kJ); esterificación con K = 4: 2/3 y 0,9028 | Correcto | K ≈ 4 (Berthelot y Péan de Saint-Gilles, 1862) no verificable en línea desde el entorno | Rotulado y documentado | Parcial (fuente por verificar) |
| Geometría | Acetamida C–N 1,375 Å, Σθ(N) = 360,0° (plana); metanamina 1,431 Å, 326,0° (piramidal) | Correcto | — | — | Correcto |
| Prácticas | Valores dorados; E2E de las tres con axe en ambos temas, 390 y 1280 px; respaldo sin WebGL; 62 capturas revisadas | Correcto | Barras fuera del gráfico, «O» sin H en fórmulas 2D, rótulos genéricos | Corregidos | Correcto |
| Regresión | 1110 pruebas unitarias y E2E completo | Todas pasan | — | — | Correcto |

# Taller de formación de compuestos (versión 2.4.0)

Pedido del docente: formar óxidos, hidróxidos, ácidos y sales a partir de elementos elegidos por el estudiante, en las
prácticas `oxidos-hidroxidos`, `acidos-sales` y `nomenclatura-inorganica`.

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Modelo del taller | 38 360 entradas (31 elementos × estados × 9 rutas × formas) → 1196 combinaciones válidas y 1066 compuestos; Σ n·q = 0 en todos; ecuaciones balanceadas con coeficientes mínimos (mcd 1); búsqueda exhaustiva (118 elementos × 11 estados) sin compuestos fuera del conjunto | Correcto | Sales de Cr(III)/Mn(II) con anión del mismo metal rompían el modelo de cargas | Se rechazan con explicación | Correcto |
| Nombres | 135 de los 149 casos de referencia los forma también el taller: 0 diferencias en sistemática, Stock y tradicional | Correcto | — | — | Correcto |
| Rechazos | 27 casos con código y explicación (gases nobles, estados inexistentes o raros, metal sin oxácido, óxidos neutros, dos metales, dos no metales, fuera del taller…); los 87 elementos fuera del taller se rechazan en las 9 rutas | Correcto | F con +2 caía en «estado inexistente» antes que en «el flúor no forma óxidos» | Se prueban los dos casos | Correcto |
| Registro en PubChem | `compuestos_pubchem.mjs` (2026-10-25): 583 por nombre con la misma fórmula, 337 solo por fórmula exacta, 146 sin registro (fórmula formal); CID de CaO 14778, Ca(OH)₂ 6093208, SO₃ 24682, H₂SO₄ 1118, CaSO₄ 24497, H₂O 962, NaCl 5234 | Correcto | Las coincidencias solo por fórmula pueden ser otro isómero (Cl₂O₅ → «Chloroperoxyperoxy hypochlorite») | Tercer rótulo: «Fórmula registrada en PubChem… sin coincidencia de nombre» | Correcto (revisión manual pendiente de las 337) |
| 3D | Reacción 3D en 1025 de 1196 combinaciones (el resto explica por qué no); CaO red, H₂SO₄ confórmero, HBrO₃ VSEPR, CaSO₄ ion poliatómico, Cl₂O₅ y SiO₂ sin geometría; P₂O₅ se anima como P₄O₁₀ | Correcto | — | — | Correcto |
| Interfaz | E2E del taller en las tres prácticas (recorrido Ca → CaO → Ca(OH)₂; S(+6) → SO₃ → H₂SO₄ → CaSO₄; He rechazado; teclado en la tabla) y axe WCAG 2.2 AA en ambos temas (resultado, reacción 3D y rechazo); 390 y 1280 px sin desbordamiento; capturas revisadas | Correcto | Ecuación partida entre coeficiente y fórmula a 390 px; tabla de nombres apretada | Términos sin salto interno; tabla con ancho mínimo y desplazamiento | Corregido |
| Regresión | `tsc -b` sin errores; 1152 pruebas unitarias (66 archivos, 42 del taller); `npm run build`; E2E completo 151 de 151 (9 nuevas del taller) | Todas pasan | — | — | Correcto |

# Visores 3D y taller ampliado (versión 2.5.0)

Pedido del docente: «en algunas [moléculas] los palitos no se ven» y «amplía la cantidad de elementos de la tabla
periódica que son funcionales».

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Conectividad 3D | 2940 especies (biblioteca, orgánicas, funcionales, geometría VSEPR, iones, ensamblados iónicos, 2944 reacciones 3D del taller): índices en rango, órdenes 1–3, sin repetidos, longitudes ±25 % de Pyykkö, ningún enlace faltante, moléculas conectadas, iones poliatómicos con sus enlaces; `toSdf` leído con las reglas de columnas de 3Dmol 2.5.5 | Correcto | Ninguno en los datos | — | Correcto |
| Palitos en 3Dmol | Píxeles en el punto medio de cada palito (imagen real frente a máscara de solo esferas) en H₂SO₄, CaSO₄, Ca(OH)₂, NaNO₃, H₂O₂, CO₂, HClO₄, NH₃ y un hidrocarburo, en «esferas y palitos» y «palitos», y en sus reacciones al 0, 30, 70 y 100 % | Todos visibles | Con la esfera por defecto de 3Dmol (0,28 × van der Waals) solo 1 de 3 palitos de H₂O₂ y 2 de 3 de NH₃ quedaban a la vista; fracción visible mínima calculada 9 % (H₂) | Esfera = máx(0,20 Å; 0,42 × r_cov) en todos los visores (`ballRadius`, `applyMolStyle`); mínimo 38 % | Corregido |
| Respaldo SVG | Sin 3Dmol: 7 de 8 trazos de palito de H₂SO₄ visibles en su punto medio (`elementFromPoint`) | Correcto | — | Mismos radios que 3Dmol | Correcto |
| Sólidos iónicos | Redes y ensamblados de iones sin palitos entre iones; leyenda visible | Correcto | No se explicaba | Leyenda en la reacción 3D y en el taller | Corregido |
| Elementos | 77 habilitados (antes 31); los 41 restantes (gases nobles, Fr, Ra, Tc, Pm, At, actínidos, superpesados) explican por qué; estados habituales y raros con fuente (Greenwood y Earnshaw, IUPAC) | Correcto | — | — | Correcto |
| Modelo del taller | 157 044 entradas → 3756 combinaciones y 3329 compuestos; Σ n·q = 0; balanceo con coeficientes mínimos; búsqueda exhaustiva sin compuestos fuera del conjunto | Correcto | Estados sin hidróxido u oxisal definidos (Ti(IV), V(IV), Ge, Mo, W…) | Se rechazan con explicación | Correcto |
| Nomenclatura | 294 casos de referencia (149 + 145 nuevos escritos a mano y comparados con el motor: 0 diferencias); 290 con CID de la misma fórmula y algún nombre del motor entre los sinónimos; 278 los forma también el taller, 0 diferencias | Correcto | 11 candidatos sin CID de la misma fórmula o sin nombre en PubChem (Rb₂O, Cs₂O, Bi₂O₃, PoO₂, SrH₂, Y(OH)₃, ZnSe, InCl₃, Na₃AsO₃, CaWO₄, Bi(NO₃)₃) | No se incluyen en la referencia (no se inventan CID) | Correcto |
| Registro en PubChem | `compuestos_pubchem.mjs` (2026-10-25): 1391 por nombre, 1129 solo por fórmula, 809 formales; BaO 62392, SnO₂ 16747781, TiO₂ 26042, SrO 73975, CeO₂ 73963, Na₂SeO₄ 25960 | Correcto | Las coincidencias solo por fórmula pueden ser otra sustancia | Rótulo «sin coincidencia de nombre» | Correcto (revisión manual pendiente) |
| 3D del taller | Reacción 3D en 2907 de 3756 combinaciones; oxoaniones VSEPR nuevos (AsO₄³⁻, SeO₄²⁻, MoO₄²⁻, WO₄²⁻, VO₄³⁻, ReO₄⁻); sin geometría (explicado) para H₂TeO₄, H₃SbO₄, ácidos de Mo, W, V y Re y óxidos de red | Correcto | — | — | Correcto |
| Regresión | `tsc -b` sin errores; 1187 pruebas unitarias (67 archivos); `npm run build`; E2E completo: 154 de 155 a la primera; la que falló (conservación de la masa, `app.spec.ts`) también falla de forma intermitente en la v2.4.0 (4 de 6 repeticiones) | Pasa tras la corrección | Aserción estricta de «217,45 g» con dos lecturas iguales en pantalla | `.first()` en la prueba (6 de 6) | Correcto |

# Rediseño integral de la plataforma (versión 2.6.0, sin publicar)

Pedido del docente: rediseño integral de la interfaz. Diagnóstico y plan: `docs/v2/REDISENO-2026-10.md`; decisión:
ADR 0007; sistema de diseño: `docs/v2/SISTEMA-DE-DISENO.md`. Capturas antes y después (68 + 68, claro/oscuro, 1280 y
390 px) en el directorio temporal del agente (fuera del repositorio).

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Modelos científicos | Valores dorados (`tests/golden`) y pruebas de modelos sin cambios | Correcto | — | Ningún modelo se tocó | Correcto |
| Tokens del sistema de diseño | Prueba unitaria: bloques oscuros idénticos; todo token usado por laboratorios, componentes y páginas está definido | Correcto | Dos hojas de estilo con valores en conflicto (foco 3 px y 2 px, radios distintos) | Valores solo en `src/tokens.css` | Correcto |
| Contraste | `scripts/diseno/verificar_paleta.py`: 21 pares de texto, controles, foco y áreas por tema; axe WCAG 2.2 AA en todas las páginas y prácticas, ambos temas y teléfono | Todo cumple (texto secundario ≥ 5,87:1; foco ≥ 5,71:1) | El foco usaba el mismo naranja que los datos | Foco azul propio (`--focus`) | Correcto |
| Escala de datos y daltonismo | ΔE2000 mínimo entre 8 series tras simular protanopía, deuteranopía y tritanopía (Machado 2009) | Claro: 7,4 / 6,2 / 10,3 (antes 2,6 / 0,9 / 2,7); oscuro: 9,6 / 6,9 / 9,4 (antes 2,8 / 2,7 / 8,8) | Series indistinguibles con deuteranopía | Nueva escala + marcador con forma por serie | Correcto |
| Rendimiento: carga de la práctica | Recursos descargados al abrir densidad | Ya no se descargan las 65 fichas | `questionById` del currículo completo importado por `PracticeSections` y `lib/report` | `src/assessment/lookup.ts` + prueba de igualdad con `questionById` | Correcto |
| Rendimiento: JS inicial | `npm run build` | 407,86 → 391,3 kB (126,50 → 123,5 kB gzip); CSS 115,1 → 130,6 kB (22,4 → 25,4 kB gzip) | Kit de instrumentos y sintetizador en el paquete inicial | Catálogo, grado, héroe y definiciones del kit bajo demanda | Correcto (el sintetizador sigue en el paquete inicial: pendiente) |
| Carga medida (Chromium, CPU ×4, 1,6 Mb/s, 150 ms; mediana de 3; servidor sin compresión) | FCP, LCP, tiempo de bloqueo y JS transferido | Ver la tabla siguiente | — | — | Correcto (Lighthouse no disponible sin red) |
| Inicio por perfiles | E2E: perfiles, tareas, recordar el perfil, «Continuar mi práctica» | Correcto; alto de 13 620 → ~4 000 px (escritorio) y 36 535 → ~8 800 px (teléfono) | «Abrir el código de mi docente» chocaba con el botón «Abrir» de una prueba | Renombrado a «Usar el código de mi docente» | Correcto |
| Catálogo | Unitarias de filtros (adn → 3, química → 20, avance, orden, varias palabras); E2E: filtros en la dirección, chips, estado vacío | Correcto | — | — | Correcto |
| Práctica: espacio de trabajo | E2E: migas con área, anterior/siguiente del grado; axe en todas las etapas y prácticas | Correcto | En teléfono la barra de etapas ocultaba 3 de 5 pestañas sin pista; el orden flexible movía las pestañas del panel docente al final | Barra desplazable con degradado y etapa activa visible; regla limitada a `.stage-bar` | Corregido |
| Atajos de teclado | Unitaria de `shortcutKey`; E2E: `?`, `/`, números, sin efecto al escribir; axe del diálogo | Correcto | El botón «Atajos» quedaba sin nombre en teléfono (texto oculto) | `aria-label="Atajos de teclado"` | Corregido |
| Simulación (ósmosis, ondas) | E2E: estados «Lista para iniciar», «Terminada», «En pausa», «En curso» y avance 100 % | Correcto | — | — | Correcto |
| Cuaderno | Unitarias de comparación (B − A, variación, entradas cambiadas) y JSON; E2E: comparación +51,3 g, descarga JSON, axe | Correcto | La fila nueva parpadeaba en amarillo/rojo | Animación de color explícita | Corregido |
| Análisis | E2E: explicación de la relación y axe en claro y oscuro | Correcto | «en función de el volumen» | «en función del volumen» | Corregido |
| Panel docente, banco, ayuda, informe | axe en todas las pestañas (ahora también «Catálogo»); capturas | Correcto; panel 9 838 → ~1 250 px al abrir; banco 52 474 → ~6 450 px | — | — | Correcto |
| Impresión | Captura con `media: print` del experimento y del informe | Sin barras de herramientas, paginador ni ajustes | — | — | Correcto |
| Regresión | `tsc -b`; 1162 pruebas unitarias (67 archivos); `npm run build`; E2E completo 158 de 158 (7 nuevas en plataforma.spec.ts) | Todas pasan | — | — | Correcto |
| Regresión tras integrar la versión 2.5.0 | `tsc -b`; 1197 pruebas unitarias (68 archivos); `npm run build`; E2E completo 162 de 162 | Todas pasan | — | — | Correcto |

| Ruta (390 px) | FCP antes → después | LCP antes → después | Bloqueo (> 50 ms) antes → después | JS transferido antes → después |
|---|---|---|---|---|
| Inicio | 4296 → 3456 ms | 4296 → 3456 ms | 4099 → 810 ms | 429 → 457 kB |
| Catálogo | 3588 → 3084 ms | 3588 → 3968 ms | 2324 → 1651 ms | 429 → 463 kB |
| Práctica (densidad) | 3104 → 3132 ms | 14532 → 6264 ms | 190 → 96 ms | 2535 → 881 kB |

No verificado: lectores de pantalla reales, Firefox y Safari, equipos escolares reales, usabilidad con estudiantes y
docentes del nuevo inicio por perfiles y de los atajos; Lighthouse (no instalado y sin red para instalarlo).

# Barra de simulación común en las prácticas con dinámica temporal (sin publicar)

Elemento «Rediseño, siguiente paso» de la hoja de ruta (ADR 0007). Inventario con `grep` de `requestAnimationFrame`,
`setInterval` y estados `running`/`phase` en `src/labs`: 23 prácticas tienen una dinámica temporal que el estudiante
inicia y observa (21 adoptadas en esta ronda más ósmosis y ondas); otras 19 (15 con alguna animación y 4 de la lista
de la hoja de ruta sin animación) solo tienen transiciones de instrumento, pasos de procedimiento, generaciones
discretas o una fuente controlada por la propia práctica (tabla con el motivo en `docs/v2/SISTEMA-DE-DISENO.md`). Los laboratorios del taller de química inorgánica y orgánica no se tocaron.

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Modelos científicos | Valores dorados (`tests/golden`) y pruebas de modelos sin cambios; ningún archivo de `src/models` modificado | Correcto | — | — | Correcto |
| Estado de `SimControls` | `tests/unit/simControls.test.ts`: `simStatusOf`, recorrido iniciar → pausar → reanudar → terminar → repetir, rótulos propios, sin pausa, marcado (`role="group"` con nombre, `role="status"`, botones habilitados), avance y recorte, `resolutionText`, adopción en las 23 prácticas y en la tabla del documento | 9 pruebas pasan | No había prueba unitaria del componente | Lógica extraída a funciones puras (`simStatusOf`, `simPrimaryAction`) | Correcto |
| Pausa sin alterar resultados | E2E: proyectil (2,870 m) y choque (0,660 m/s) con pausa a mitad de camino; conducción por teclado termina en 82,2 °C; las pruebas existentes de cada práctica siguen pasando con sus valores | Correcto | Pausar y reanudar reiniciaba el reloj de la animación; cambiar la velocidad a mitad de la corrida (péndulo, cinemática, caída) también | El reloj se reconstruye desde el tiempo ya recorrido (`start = now − t`); en movimiento, el cronómetro de mano se corre lo que duró la pausa | Corregido |
| Lectura congelada en pausa | E2E: avance de conducción, calor y cinética, y cronómetro de cinemática, iguales tras 0,7 s en pausa | Correcto | En energía (caída) las gráficas desaparecían en pausa; en cinética química, las burbujas | Se muestran mientras la corrida está empezada | Corregido |
| Iniciar → pausar → reanudar → reiniciar | E2E con axe WCAG 2.2 AA en pausa: conducción, calor, cinética química, cinemática, péndulo y ecosistema | Correcto, sin violaciones | — | — | Correcto |
| Teclado y lector de pantalla | E2E: Enter inicia, el foco queda en «Pausar», Enter pausa, espacio reanuda; estado en `role="status"` | Correcto | — | — | Correcto |
| Movimiento reducido | E2E con `reducedMotion: 'reduce'`: calor salta a «Terminada» con 39,8 °C y avance 100 %; gases arranca «Lista para iniciar» | Correcto | Las animaciones continuas de gases y fotosíntesis no se podían detener (WCAG 2.2.2) y con movimiento reducido no había forma de verlas | Pausar/Reanudar; arrancan detenidas con movimiento reducido y se pueden iniciar a voluntad | Corregido |
| Condición imposible | E2E: choques con v₂ > v₁ muestra `ConditionAlert` «Cómo corregirlo» y bloquea «Lanzar» | Correcto | — | — | Correcto |
| Avance que revelaría la respuesta | Revisión de cada práctica | Sin barra donde la duración es la lectura (tiempo de vuelo, período, tiempo en 1 m, recorrido, rampa) | — | — | Correcto |
| Capturas claro/oscuro, 1280 y 390 px | Conducción, péndulo, cinética química y choques en pausa (`SIMC_SHOTS=<carpeta> npx playwright test simulacion`) | Barra legible en ambos temas y en teléfono, sin desplazamiento horizontal | — | — | Correcto |
| Rendimiento: JS inicial | `npm run build` | 391,33 kB (123,5 kB gzip), igual que antes | `resolutionText` en `ui.tsx` sumaba 0,12 kB al paquete inicial | Movido a `Experiment.tsx` (carga con la práctica) | Corregido |
| Regresión | `tsc -b`; 1206 pruebas unitarias (69 archivos); `npm run build`; E2E completo 172 pasan y 1 omitida (la de capturas, solo con `SIMC_SHOTS`); 11 nuevas en `simulacion.spec.ts` | Todas pasan | — | — | Correcto |

No verificado: lectores de pantalla reales (NVDA, VoiceOver) leyendo el cambio de estado, Firefox y Safari, equipos
escolares modestos y uso con estudiantes de la pausa en clase.

# Taller de compuestos, siguiente paso (versión 2.8.0)

Elemento de la hoja de ruta: redes de más sólidos con estructura publicada, sales de amonio y binarios entre no
metales en el taller, y revisión de los registros de PubChem hallados solo por la fórmula. Capturas de revisión
(visor 3D y tarjeta de resultado, claro y oscuro, 1280 y 390 px) en el directorio temporal del agente.

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| Fuentes de las estructuras | AMCSD, COD, ICSD y Wikipedia bloqueados por el proxy; solo PubChem y PyPI accesibles | Corindón: CIF real de la AMCSD 0009325 (Lewis y otros, 1982) leído del paquete Dans_Diffraction 3.4.0; rutilo: a y c del CRC 60.ª ed. en el texto de la HSDB (PubChem); cuarzo: Levien y otros (1980), mismos valores que xrayutilities 1.8.0; cúbicas: Wyckoff (1963) | Los parámetros de Wyckoff de Li₂O, Na₂O, K₂O, BaO y ZnS no se pudieron releer en la fuente | Se comprueban con la densidad publicada y con la suma de radios de Shannon (≤ 0,02 Å) | Correcto, con la limitación declarada |
| Generador de redes | Operaciones de simetría de los CIF y de las Tablas Internacionales; Z por celda; celdas neutras | Rutilo 2 Ti + 4 O; corindón 12 Al + 18 O (V = 254,977 Å³ como el CIF); cuarzo 3 Si + 6 O | Con Si en (x, 0, 0) el cuarzo daba 6 Si por celda (otro origen) | Si en 3a = (x, 0, ⅔) y z(O) + ⅔, documentado | Correcto |
| Distancias y coordinación | `tests/unit/crystals.test.ts` | Ti–O 1,950 Å ×4 y 1,980 Å ×2; Al–O 1,855 Å ×3 y 1,972 Å ×3; Si–O 1,605 y 1,614 Å, Si–O–Si 143,7° (Levien: 1,605, 1,614 y 143,73°); antifluoritas 4:8, blenda 4:4, rutilo 6:3, corindón 6:4, cuarzo 4:2 | La ventana de 1 % no contaba los octaedros distorsionados | Ventana común de 1,10 × la distancia mínima | Correcto |
| Densidad calculada frente a publicada | 14 cristales; densidades leídas de PubChem con su fuente (`cristales_pubchem.mjs`) | 12 a menos de 2,1 %; las 6 densidades que ya tenía el kit coinciden con las de PubChem | Na₂O (+6,1 %) y BaO (+5,7 %): la densidad tabulada es menor que la de la red | Nota visible (medición macroscópica; posible porosidad o reacción con el aire, no comprobada) | Correcto, con nota |
| Visor de redes | Capturas con WebGL (SwiftShader) claro/oscuro, 1280 y 390 px | Eje c vertical en celdas no cúbicas; poliedro completo; red covalente con palitos (`applyMolStyle`) | Visto desde arriba, el octaedro del rutilo se veía plano; en la celda estrecha del corindón el poliedro quedaba con 3 de 6 vecinos; la columna de rótulos ocupaba media pantalla a 390 px | Orientación inicial fija por cuaternión; `periodicShell` dibuja los vecinos de la celda contigua; columna `fit-content(40%)` | Corregido |
| Sales de amonio | Unitarias: NH₃ + HCl → NH₄Cl, nitrato, sulfato, carbonato, DAP, MAP; rechazos | Correcto; NH₄⁺ con 4 enlaces N–H y el oxoanión en dos visores | Neutralidad del NH₄NO₃: contaba 2 aniones y 0 cationes | Oxoaniones contados por el O | Corregido |
| Binarios entre no metales | Unitarias: PCl₃, PCl₅, CCl₄, CS₂ (S=C=S), SF₆, BF₃, NF₃; orden de electronegatividad; S + Cl fuera del taller | Correcto | El PCl₅ se veía como una molécula plana (axiales de frente) | Giro rígido de presentación para 4 o más dominios | Corregido |
| Nomenclatura | 316 casos (22 nuevos); `nomenclatura_pubchem.mjs` 2026-10-26 | 312 con CID de la misma fórmula y en todos algún nombre del motor entre los sinónimos; 314 los forma el taller, 0 diferencias | — | — | Correcto |
| Registro en PubChem | `compuestos_pubchem.mjs` 2026-10-26 con la regla de `pubchemNameMatch.ts` | 3397 compuestos: 1449 por nombre, 546 por fórmula + sinónimo, 587 fórmulas registradas sin coincidencia de nombre, 815 formales; 9 con descartes (Rb₂O «Rubidium(1+),hydroxide», Cl₂O₅ «Chloroperoxyperoxy hypochlorite», V(OH)₃ «Hydroxy(oxo)vanadium;hydrate», NH₄BrO «Hydroxylammonium bromide»…) | De los 1129 de la v2.5.0 hallados solo por la fórmula, 545 eran la misma sustancia con otra notación y 5 eran otra estructura | Reclasificados por la regla; muestra de 25 revisada a mano sin falsos positivos | Correcto; los 587 restantes requieren revisión humana |
| Regresión | `tsc -b`; pruebas unitarias; `npm run build`; E2E completo tras el merge de la 2.7.0 | `tsc -b` sin errores; 1230 pruebas unitarias (71 archivos); `npm run build`; E2E completo tras el merge: 180 pasan y 1 se omite por diseño (capturas de `simulacion.spec.ts`, solo con SIMC_SHOTS); 8 nuevas en `taller-compuestos.spec.ts` | — | — | Correcto |

No incluido (declarado en `CRYSTALS_NOT_INCLUDED`): CaSO₄ (sin acceso a un refinamiento publicado), SrO (sin densidad
publicada en PubChem) y redes de sales de amonio (el NH₄⁺ se desordena en el cristal).

| Parámetros de red de Li₂O, Na₂O, K₂O, BaO y ZnS (2.8.0) | Revisión de integridad del integrador | Parcial | Los valores se tomaron de Wyckoff (1963) sin poder consultar la obra desde el entorno (AMCSD, COD e ICSD bloqueados) | Marcados «por verificar» en la interfaz y en `src/chem/crystal.ts` (`WYCKOFF_PV`) | Pendiente: verificar contra la fuente |

# Rediseño, siguiente paso: avisos con «Cómo corregirlo» y resolución de instrumentos (versión 2.9.0)

Elemento de la hoja de ruta (ADR 0007). Capturas de revisión (gases, enzimas, densidad y circuitos; claro y oscuro;
1280 y 390 px) revisadas por el integrador; la prueba `tests/e2e/avisos.spec.ts` las regenera con `AVISOS_SHOTS`.

| Componente | Prueba realizada | Resultado | Error encontrado | Corrección aplicada | Estado final |
|---|---|---|---|---|---|
| «Cómo corregirlo» por modelo (19 prácticas) | `tests/unit/conditions.test.ts` (34 pruebas): se aplica al modelo el valor que sugiere cada corrección y se comprueba que el aviso desaparece | Correcto; los textos de las advertencias de los modelos no cambian (valores dorados intactos) | Cuatro avisos no se alcanzan con los rangos de los controles (sobrecarga de la balanza, H₂O₂ < 20 mL, globo > 3 L, todo el SCN⁻ precipitado) y los de circuitos simples se prueban con el texto del modelo | Se prueban con el texto literal del aviso | Correcto, con la limitación declarada |
| Región de estado de los avisos | axe (WCAG 2.2 AA) y prueba de una sola región `role="status"` por práctica | Una región viva; cada aviso con nivel en texto («Condición no válida», «Atención», «Nota») | Varias regiones vivas simultáneas | `ConditionAlert live={false}` dentro del contenedor común | Correcto |
| Resolución y estado en lecturas (17 prácticas más) | Resolución tomada de las fichas de instrumentos o de constantes del modelo; estado solo con rango definido (300 kPa, 3 A, Decreto 1076, absorbancia, 2,5 bar, Tm de Wallace…) | Correcto; sin números nuevos (`NO2_MAX_PRESSURE` y `COLORIMETER_RES` solo dan nombre a umbrales existentes) | — | — | Correcto |
| Optimización infactible (metabolismo) | Revisión | La corrección lee los controles actuales, que pueden diferir del último cálculo hasta pulsar «Calcular el óptimo» | — | — | Limitación conocida |
| Regresión | `tsc -b`; `vitest run`; `npm run build`; E2E completo con axe | Sin errores; 1264 pruebas unitarias (72 archivos); compilación correcta; E2E 188 pasan y 1 se omite por diseño | — | — | Correcto |
