import { lazy, Suspense, useEffect, useState } from 'react';
import { useRoute, href } from './lib/router';
import { usePrefs } from './lib/prefs';
import { metaById } from './curriculum/catalog';
import { usePractice } from './curriculum/loader';
import { GRADES } from './curriculum/grades';
import type { GradeId } from './core/types';
import { HomePage } from './pages/HomePage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PwaNotices } from './components/PwaUi';
import { Icon, Logo, type IconName } from './components/icons';
import { CourseButton, JoinPage } from './components/ClassroomUi';
import { startClassroomSync } from './lib/classroom';
import { installSound } from './lib/sound';
import { SoundToggle } from './components/SoundUi';
import { GlobalShortcuts } from './components/Shortcuts';

// Páginas pesadas cargadas bajo demanda: el inicio y el catálogo abren rápido en equipos modestos.
const PracticePage = lazy(() => import('./pages/PracticePage').then((m) => ({ default: m.PracticePage })));
const ReportPage = lazy(() => import('./pages/ReportPage').then((m) => ({ default: m.ReportPage })));
const BankPage = lazy(() => import('./pages/BankPage').then((m) => ({ default: m.BankPage })));
const AdvancedBankPage = lazy(() => import('./pages/AdvancedBankPage').then((m) => ({ default: m.AdvancedBankPage })));
const TeacherPage = lazy(() => import('./pages/TeacherPage').then((m) => ({ default: m.TeacherPage })));
const CatalogPage = lazy(() => import('./pages/CatalogPages').then((m) => ({ default: m.CatalogPage })));
const GradePage = lazy(() => import('./pages/CatalogPages').then((m) => ({ default: m.GradePage })));
// Definiciones SVG compartidas del kit de instrumentos (degradados, sombras): fuera del paquete inicial.
const KitDefs = lazy(() => import('./labs/kit').then((m) => ({ default: m.KitDefs })));
const HelpPage = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })));

/** Estado de carga: texto anunciado y un esqueleto que reserva el espacio (sin saltos al aparecer el contenido). */
function Loading({ text = 'Cargando…' }: { text?: string }) {
  return (
    <div className="loading-state">
      <p role="status" className="loading-text"><span className="spinner" aria-hidden="true" />{text}</p>
      <div className="skeleton" aria-hidden="true"><span className="sk-line w40" /><span className="sk-line w70" /><span className="sk-block" /></div>
    </div>
  );
}

function PracticeRoute({ id, report }: { id: string; report: boolean }) {
  const state = usePractice(id);
  if (state.status === 'loading') return <Loading text={`Cargando la práctica «${metaById(id)?.title ?? id}»…`} />;
  if (state.status === 'error') {
    return (
      <div className="notice bad stack-sm" role="alert">
        <strong>No se pudo cargar la práctica.</strong>
        <span className="small">{state.message} Revisa tu conexión a internet: si ya abriste esta práctica antes, funciona sin conexión; si es la primera vez, necesita descargarse una vez.</span>
        <div className="btn-row"><button type="button" className="btn" onClick={state.retry}>Reintentar</button></div>
      </div>
    );
  }
  return report ? <ReportPage practice={state.value} /> : <PracticePage key={state.value.id} practice={state.value} />;
}

function NotFound() {
  return (
    <div className="stack">
      <h1>No encontramos esa página</h1>
      <p>La dirección no corresponde a ninguna sección del laboratorio.</p>
      <a className="btn primary" href={href()}>Ir al inicio</a>
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const [prefs, setPrefs] = usePrefs();
  const [menuOpen, setMenuOpen] = useState(false);
  const [section, id, sub] = route.path;
  useEffect(() => { startClassroomSync(); installSound(); }, []);
  // Encabezado translúcido con desenfoque solo cuando la página se desplaza (un único oyente pasivo).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  let page;
  let current = section ?? '';
  if (!section) page = <HomePage />;
  else if (section === 'grado' && GRADES.some((g) => String(g.id) === id)) page = <GradePage grade={Number(id) as GradeId} />;
  else if (section === 'catalogo') page = <CatalogPage query={route.query} />;
  else if (section === 'practica' && id && metaById(id)) {
    page = <PracticeRoute id={id} report={sub === 'informe'} />;
    current = 'catalogo';
  } else if (section === 'banco') page = id === 'avanzado' ? <AdvancedBankPage /> : <BankPage />;
  else if (section === 'docente') page = <TeacherPage />;
  else if (section === 'unirme') page = <JoinPage code={route.query.get('codigo') ?? undefined} server={route.query.get('servidor') ?? undefined} />;
  else if (section === 'ayuda') page = <HelpPage prefs={prefs} setPrefs={setPrefs} />;
  else page = <NotFound />;

  const nav: { to: string; label: string; icon: IconName }[] = [
    { to: '', label: 'Inicio', icon: 'inicio' },
    { to: 'catalogo', label: 'Prácticas', icon: 'experimento' },
    { to: 'banco', label: 'Banco Saber 11', icon: 'banco' },
    { to: 'docente', label: 'Panel docente', icon: 'docente' },
    { to: 'ayuda', label: 'Ayuda y accesibilidad', icon: 'ayuda' },
  ];
  const dark = prefs.theme === 'oscuro' || (prefs.theme === 'auto' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Saltar al contenido</a>
      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="wrap">
          <a className="brand" href={href()} onClick={() => setMenuOpen(false)}>
            <Logo />
            <span>Laboratorio Virtual<small>de Ciencias Naturales · 6.º a 11.º</small></span>
          </a>
          <button type="button" className="btn small ghost menu-toggle" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen((v) => !v)}><Icon name={menuOpen ? 'cerrar' : 'menu'} size={18} /><span className="menu-label">Menú</span></button>
          <nav id="main-nav" className={`nav${menuOpen ? ' open' : ''}`} aria-label="Navegación principal">
            {nav.map((n) => (
              <a key={n.to} href={n.to ? href(n.to) : href()} aria-current={current === n.to ? 'page' : undefined} onClick={() => setMenuOpen(false)}><Icon name={n.icon} size={17} className="nav-icon" />{n.label}</a>
            ))}
            <span className="header-tools">
              <SoundToggle />
              <button type="button" className="btn small ghost theme-toggle" onClick={() => setPrefs({ ...prefs, theme: dark ? 'claro' : 'oscuro' })} aria-label={`Cambiar a tema ${dark ? 'claro' : 'oscuro'}`}>
                <Icon name={dark ? 'sol' : 'luna'} size={18} />
              </button>
            </span>
          </nav>
          <CourseButton />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="wrap">
        <ErrorBoundary resetKey={route.path.join('/')}><Suspense fallback={<Loading />}>{page}</Suspense></ErrorBoundary>
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <div className="footer-grid">
            <div className="footer-brand stack-sm">
              <span className="brand"><Logo size={30} /><span>Laboratorio Virtual<small>de Ciencias Naturales</small></span></span>
              <p className="small">Prototipo educativo de código abierto para la educación básica secundaria y media en Colombia.</p>
            </div>
            <nav aria-label="Grados" className="footer-col">
              <span className="footer-title">Grados</span>
              <ul>{GRADES.map((g) => <li key={g.id}><a href={href('grado', g.id)}>{g.id}.º · {g.name}</a></li>)}</ul>
            </nav>
            <nav aria-label="Recursos" className="footer-col">
              <span className="footer-title">Recursos</span>
              <ul>{nav.slice(1).map((n) => <li key={n.to}><a href={href(n.to)}>{n.label}</a></li>)}</ul>
            </nav>
          </div>
          <div className="footer-legal small">
            <span>Laboratorio Virtual de Ciencias Naturales · prototipo educativo de código abierto.</span>
            <span>Las simulaciones son modelos simplificados con supuestos declarados; no reemplazan el laboratorio real. Las preguntas tipo Saber 11 son originales y no oficiales del ICFES.</span>
          </div>
        </div>
      </footer>
      <PwaNotices />
      <GlobalShortcuts />
      <Suspense fallback={null}><KitDefs /></Suspense>
    </>
  );
}
