import { useEffect } from 'react';
import { CATALOG as PRACTICES } from '../curriculum/catalog';
import { PLANNED } from '../curriculum/grades';
import { href } from '../lib/router';
import type { Prefs } from '../lib/prefs';
import { Segmented } from '../components/ui';
import { storageAvailable } from '../lib/storage';
import { InstallButton } from '../components/PwaUi';
import { SoundSettingsPanel } from '../components/SoundUi';

export function AccessibilityPanel({ prefs, setPrefs }: { prefs: Prefs; setPrefs: (p: Prefs) => void }) {
  return (
    <div className="stack">
      <Segmented label="Tema de color" value={prefs.theme} onChange={(v) => setPrefs({ ...prefs, theme: v })} options={[{ value: 'auto', label: 'Automático' }, { value: 'claro', label: 'Claro' }, { value: 'oscuro', label: 'Oscuro' }]} />
      <Segmented label="Tamaño del texto" value={String(prefs.fontScale) as '1' | '1.15' | '1.3'} onChange={(v) => setPrefs({ ...prefs, fontScale: Number(v) as Prefs['fontScale'] })} options={[{ value: '1', label: 'Normal' }, { value: '1.15', label: 'Grande' }, { value: '1.3', label: 'Muy grande' }]} />
      <label className="check"><input type="checkbox" checked={prefs.contrast} onChange={(e) => setPrefs({ ...prefs, contrast: e.target.checked })} /> Alto contraste</label>
      <label className="check"><input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => setPrefs({ ...prefs, reduceMotion: e.target.checked })} /> Reducir animaciones</label>
    </div>
  );
}

const IMPLEMENTED = [
  'Navegación por grados (6.º a 11.º), asignaturas, catálogo con buscador y filtros.',
  `${PRACTICES.length} prácticas completas con modelos científicos calculados, controles, tabla de datos, gráficas configurables, análisis, conclusión y evaluación.`,
  'Modos de práctica guiada, exploración libre y evaluación.',
  'Funciona sin conexión después de la primera visita e instalable como aplicación (escritorio, Android e iPhone).',
  'Detección de tendencias en los datos y advertencias de control de variables en el análisis.',
  'Preguntas de selección múltiple con retroalimentación por opción, explicación, repaso y transferencia; reintentos.',
  'Banco de preguntas originales tipo Saber 11 con filtros por grado, competencia, componente y dificultad.',
  'Informe de práctica imprimible, descargable (JSON y CSV), copiable y, si el colegio instala el servidor, enviable por internet con un código de curso.',
  'Panel docente: catálogo, validación curricular de los DBA, asignaciones y listas por código, importación de informes, resultados agregados, preguntas con mayor error, opinión de los estudiantes, exportación CSV, rúbrica y conexión opcional al servidor institucional.',
  'Servidor institucional opcional (carpeta server/) con cuentas docentes, cursos y recepción de informes, sin cuentas de estudiantes.',
  'Accesibilidad: navegación por teclado (incluidas flechas en las pestañas), enlace para saltar al contenido, textos alternativos y tablas equivalentes para las gráficas, tema claro/oscuro, alto contraste, tamaño de texto y reducción de animaciones. Auditoría automática WCAG 2.1 AA con axe-core.',
  'Sonidos realistas de laboratorio (vidrio, líquidos, efervescencia, balanza, fotopuertas, interruptores, soplador, choques…) sintetizados en el navegador, sin archivos de audio; se silencian con el botón «Sonido» y el volumen se ajusta en esta página.',
  'Carga bajo demanda: cada práctica se descarga solo al abrirla.',
  'Pruebas automatizadas de las fórmulas, del currículo, del servidor y de los flujos principales de la interfaz.',
];

const NOT_IMPLEMENTED = [
  'Sincronización del progreso del estudiante entre dispositivos (el servidor recibe informes, no sesiones en curso).',
  'Recuperación de contraseña de docentes por correo y panel de administración del servidor.',
  `${PLANNED.length} prácticas de la malla curricular planificadas que aún no están construidas (se muestran como «Próximamente»).`,
  'La validación de los DBA la debe hacer el equipo docente con los documentos oficiales; la plataforma solo la registra.',
  'Pruebas de usabilidad con estudiantes reales: hay un protocolo listo (docs/PROTOCOLO-USABILIDAD.md), pero deben aplicarse en el colegio.',
];

export function HelpPage({ prefs, setPrefs }: { prefs: Prefs; setPrefs: (p: Prefs) => void }) {
  useEffect(() => { document.title = 'Ayuda y accesibilidad · Laboratorio Virtual'; }, []);
  return (
    <div className="stack">
      <h1>Ayuda y accesibilidad</h1>
      <div className="grid-2">
        <section className="card stack-sm">
          <h2>Cómo usar el laboratorio</h2>
          <ol className="list">
            <li>Elige tu grado en la página de inicio o busca una práctica en el catálogo.</li>
            <li>Lee la preparación: pregunta problema, fundamento y variables.</li>
            <li>Cambia las variables, ejecuta el experimento y pulsa «Guardar ensayo» para registrar cada resultado.</li>
            <li>Elige los ejes de la gráfica, analiza la tendencia de tus datos y escribe tu conclusión con afirmación, evidencia y razonamiento.</li>
            <li>Responde las preguntas y lee la retroalimentación. Puedes reintentar.</li>
            <li>Abre «Ver informe» para imprimirlo o enviarlo a tu docente.</li>
          </ol>
        </section>
        <section className="card stack-sm">
          <h2>Preferencias de visualización</h2>
          <AccessibilityPanel prefs={prefs} setPrefs={setPrefs} />
          <h3>Sonido</h3>
          <SoundSettingsPanel />
          <h3>Teclado</h3>
          <ul className="list small">
            <li><kbd>Tab</kbd> y <kbd>Mayús + Tab</kbd>: moverse entre controles.</li>
            <li>Flechas: ajustar los controles deslizantes.</li>
            <li><kbd>Enter</kbd> o <kbd>Espacio</kbd>: activar botones e interruptores del circuito.</li>
            <li>Cada gráfica tiene un botón para ver sus datos como tabla.</li>
          </ul>
        </section>
      </div>
      <section className="card stack-sm">
        <h2>Usar sin conexión e instalar</h2>
        <p>Después de abrir el laboratorio una vez con internet, queda guardado en este navegador y las prácticas funcionan sin conexión. Cuando hay una versión nueva, aparece un aviso para actualizar; tu trabajo se conserva.</p>
        <p>También puedes instalarlo como aplicación para abrirlo desde el escritorio o la pantalla de inicio. En Chrome o Edge usa el botón de abajo o el ícono de instalar en la barra de direcciones; en Android, el menú ⋮ → «Instalar aplicación»; en iPhone o iPad, Compartir → «Agregar a la pantalla de inicio».</p>
        <div className="btn-row"><InstallButton className="btn primary" /></div>
        <p className="small muted">Enviar informes al docente por internet sí necesita conexión; sin ella, descarga el informe y entrégalo después.</p>
      </section>
      <section className="card stack-sm">
        <h2>Dónde se guarda mi trabajo</h2>
        <p>Todo se guarda en el almacenamiento local de este navegador. Solo sale del equipo si tú envías el informe a tu docente con un código de curso. {storageAvailable() ? 'El almacenamiento local está disponible.' : 'En este momento el almacenamiento local no está disponible (por ejemplo, en modo privado): tu trabajo se perderá al cerrar la pestaña.'} Si cambias de computador o borras los datos del navegador, el trabajo no se conserva. Para entregarlo, genera el informe.</p>
      </section>
      <section className="grid-2">
        <div className="card stack-sm">
          <h2>Funciones implementadas</h2>
          <ul className="list small">{IMPLEMENTED.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="card stack-sm">
          <h2>Pendiente o con limitaciones</h2>
          <ul className="list small">{NOT_IMPLEMENTED.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      </section>
      <section className="card stack-sm">
        <h2>Referentes curriculares</h2>
        <ul className="list small">
          <li>Ministerio de Educación Nacional (2006). <em>Estándares Básicos de Competencias en Lenguaje, Matemáticas, Ciencias y Ciudadanas</em>.</li>
          <li>Ministerio de Educación Nacional (2016). <em>Derechos Básicos de Aprendizaje: Ciencias Naturales</em>, versión 1.</li>
          <li>ICFES. <em>Marco de referencia de la prueba de Ciencias Naturales Saber 11.°</em> y guías de orientación de Saber 11.</li>
        </ul>
        <p className="small muted">Las relaciones con estándares y DBA de cada práctica son paráfrasis y propuestas pedagógicas: no son citas textuales y deben validarse con los documentos oficiales vigentes.</p>
        <p className="small"><a href={href('catalogo')}>Ir al catálogo</a> · <a href={href('docente')}>Ir al panel docente</a></p>
      </section>
    </div>
  );
}
