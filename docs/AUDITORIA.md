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
