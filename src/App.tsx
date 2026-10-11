import { useState } from 'react';
import { useRoute, href } from './lib/router';
import { usePrefs } from './lib/prefs';
import { practiceById } from './curriculum';
import { GRADES } from './curriculum/grades';
import type { GradeId } from './core/types';
import { HomePage } from './pages/HomePage';
import { CatalogPage, GradePage } from './pages/CatalogPages';
import { PracticePage } from './pages/PracticePage';
import { ReportPage } from './pages/ReportPage';
import { BankPage } from './pages/BankPage';
import { TeacherPage } from './pages/TeacherPage';
import { HelpPage } from './pages/HelpPage';
import { ErrorBoundary } from './components/ErrorBoundary';

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="8" fill="var(--accent)" />
      <path d="M13 7h8M14.5 7v7.5L9 25.5Q8 28 11 28h12q3 0 2-2.5L19.5 14.5V7" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10.6 22h12.8" stroke="var(--accent-ink)" strokeWidth="2" />
      <circle cx="15" cy="25" r="1.4" fill="var(--accent-ink)" /><circle cx="19.5" cy="24.4" r="1" fill="var(--accent-ink)" />
    </svg>
  );
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

  let page;
  let current = section ?? '';
  if (!section) page = <HomePage />;
  else if (section === 'grado' && GRADES.some((g) => String(g.id) === id)) page = <GradePage grade={Number(id) as GradeId} />;
  else if (section === 'catalogo') page = <CatalogPage initialArea={route.query.get('area') ?? undefined} />;
  else if (section === 'practica' && id && practiceById(id)) {
    const p = practiceById(id)!;
    page = sub === 'informe' ? <ReportPage practice={p} /> : <PracticePage key={p.id} practice={p} />;
    current = 'catalogo';
  } else if (section === 'banco') page = <BankPage />;
  else if (section === 'docente') page = <TeacherPage />;
  else if (section === 'ayuda') page = <HelpPage prefs={prefs} setPrefs={setPrefs} />;
  else page = <NotFound />;

  const nav = [
    { to: '', label: 'Inicio' },
    { to: 'catalogo', label: 'Prácticas' },
    { to: 'banco', label: 'Banco Saber 11' },
    { to: 'docente', label: 'Panel docente' },
    { to: 'ayuda', label: 'Ayuda y accesibilidad' },
  ];

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Saltar al contenido</a>
      <header className="site-header">
        <div className="wrap">
          <a className="brand" href={href()} onClick={() => setMenuOpen(false)}>
            <Logo />
            <span>Laboratorio Virtual<small>de Ciencias Naturales · 6.º a 11.º</small></span>
          </a>
          <button type="button" className="btn small menu-toggle" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen((v) => !v)}>Menú</button>
          <nav id="main-nav" className={`nav${menuOpen ? ' open' : ''}`} aria-label="Navegación principal">
            {nav.map((n) => (
              <a key={n.to} href={n.to ? href(n.to) : href()} aria-current={current === n.to ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{n.label}</a>
            ))}
            <button type="button" className="btn small ghost" onClick={() => setPrefs({ ...prefs, theme: prefs.theme === 'oscuro' ? 'claro' : 'oscuro' })} aria-label={`Cambiar a tema ${prefs.theme === 'oscuro' ? 'claro' : 'oscuro'}`}>
              {prefs.theme === 'oscuro' ? '☀' : '☾'}
            </button>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="wrap">
        <ErrorBoundary resetKey={route.path.join('/')}>{page}</ErrorBoundary>
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <span>Laboratorio Virtual de Ciencias Naturales · prototipo educativo de código abierto.</span>
          <span>Las simulaciones son modelos simplificados con supuestos declarados; no reemplazan el laboratorio real. Las preguntas tipo Saber 11 son originales y no oficiales del ICFES.</span>
        </div>
      </footer>
    </>
  );
}
