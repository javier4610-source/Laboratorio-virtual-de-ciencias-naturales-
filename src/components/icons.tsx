import type { ReactNode } from 'react';
import type { Area } from '../core/types';

/**
 * Sistema de íconos propio del laboratorio.
 * Rejilla de 24 × 24, trazo uniforme de 1,75 px con extremos y uniones redondeadas, sin rellenos
 * (salvo puntos de acento). Heredan el color del texto (currentColor) para respetar ambos temas.
 * Son decorativos: el nombre accesible siempre lo da el texto o el aria-label del control.
 */
const PATHS = {
  /* Áreas */
  biologia: <><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19c3-4 6-7 10-9" /></>,
  quimica: <><path d="M9 3h6M10 3v6l-5.2 9.1A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.9L14 9V3" /><path d="M7.3 15h9.4" /></>,
  fisica: <><circle cx="12" cy="12" r="1.6" /><ellipse cx="12" cy="12" rx="9" ry="3.6" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" /></>,
  ambiental: <><circle cx="12" cy="12" r="9" /><path d="M3.5 9.5h4l2 2.5-1 3 2 2.5V21M14 3.3 13 6l2.5 2h4M15 21v-3l2-2h3.4" /></>,
  /* Grados y competencias */
  grado: <><path d="m2.5 9 9.5-5 9.5 5-9.5 5z" /><path d="M6.5 11.2V16c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.8M21.5 9v5" /></>,
  competencia: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" /></>,
  /* Modos */
  guiada: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" /></>,
  libre: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><path d="m12 8 1.2 2.8L16 12l-2.8 1.2L12 16l-1.2-2.8L8 12l2.8-1.2z" /></>,
  evaluacion: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 12l2 2 4-4M9 17h6" /></>,
  /* Etapas */
  preparacion: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /><path d="M7 8h1.5M15.5 8H17M7 11.5h1.5M15.5 11.5H17" /></>,
  experimento: <><path d="M9 3h6M10 3v5.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9.5V3" /><circle cx="10.5" cy="15.5" r="0.9" /><circle cx="13.8" cy="17.5" r="0.9" /></>,
  analisis: <><path d="M4 4v16h16" /><path d="m7.5 15 3.5-4 3 2.5L19 7" /><circle cx="11" cy="11" r="0.9" /><circle cx="14" cy="13.5" r="0.9" /></>,
  modelo: <><path d="M17 4H7l6 8-6 8h10" /></>,
  /* Acciones e interfaz */
  informe: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  reiniciar: <><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 3.5v5h5" /></>,
  instalar: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17" /></>,
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  sonido: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  silencio: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="m15.5 9.5 5 5M20.5 9.5l-5 5" /></>,
  luna: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  buscar: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>,
  inicio: <><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15V15h-6v5.5H5.5A1.5 1.5 0 0 1 4 19z" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  reloj: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  proximamente: <><path d="M6.5 3h11M6.5 21h11" /><path d="M7.5 3v2.5c0 2 1.5 3.5 4.5 6.5 3-3 4.5-4.5 4.5-6.5V3M7.5 21v-2.5c0-2 1.5-3.5 4.5-6.5 3 3 4.5 4.5 4.5 6.5V21" /><path d="M10 18.5h4" /></>,
  docente: <><circle cx="12" cy="7.5" r="3.5" /><path d="M5 20.5c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  banco: <><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8v.2" /></>,
  ayuda: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.3M12 16.8v.2" /></>,
  codigo: <><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M7.5 10v4M10.5 10v4M13.5 10v4M16.5 10v4" /></>,
  datos: <><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></>,
  sinConexion: <><path d="M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0" /><circle cx="12" cy="18.5" r="0.9" /><path d="M2.5 9a14 14 0 0 1 19 0" /></>,
  /* Cuaderno de datos y gráficas */
  descargar: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19.5h14" /></>,
  copiar: <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" /><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" /></>,
  papelera: <><path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l.9 12.6a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12.6" /><path d="M10 10.5v6M14 10.5v6" /></>,
  acercar: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5M8 10.5h5M10.5 8v5" /></>,
  alejar: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5M8 10.5h5" /></>,
  encuadrar: <><path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" /><circle cx="12" cy="12" r="2.5" /></>,
  imagen: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="9.5" r="1.6" /><path d="m4 17.5 5-5 3.5 3.5 2.5-2.5 5 5" /></>,
  vector: <><path d="M5 19 19 5" /><rect x="3" y="17" width="4" height="4" rx="0.8" /><rect x="17" y="3" width="4" height="4" rx="0.8" /><path d="M5 17V9a4 4 0 0 1 4-4h8" /></>,
  tabla: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" /></>,
  ajustes: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  sigma: <path d="M17.5 5.5V4h-11l6 8-6 8h11v-1.5" />,
  incertidumbre: <><path d="M12 4v7M8.5 7.5h7M8.5 15.5h7" /><path d="M5 20h14" /></>,
  grafica: <><path d="M4 4v16h16" /><circle cx="8.5" cy="14.5" r="1.2" /><circle cx="12" cy="11.5" r="1.2" /><circle cx="15.5" cy="9" r="1.2" /><path d="m7 17 12-11" strokeDasharray="2 2.5" /></>,
  escudo: <><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  /* Simulación, avisos y navegación (rediseño 2026-10) */
  reproducir: <path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L8.7 4.5a.8.8 0 0 0-1.2.7z" />,
  pausa: <><rect x="6.5" y="5" width="3.5" height="14" rx="1" /><rect x="14" y="5" width="3.5" height="14" rx="1" /></>,
  alerta: <><path d="M10.3 4.3 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" /><path d="M12 9.5v4.5M12 17.2v.1" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.1" /></>,
  teclado: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7.5 14h9" /></>,
  mas: <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>,
  comparar: <><path d="M8 4v16M16 4v16" /><path d="M4 8h4M4 16h4M16 12h4" /></>,
  anterior: <path d="M19 12H5M11 6l-6 6 6 6" />,
  estudiante: <><path d="m2.5 9 9.5-5 9.5 5-9.5 5z" /><path d="M6.5 11.2V16c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.8" /></>,
  lupa: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5M8.5 11h5M11 8.5v5" /></>,
  continuar: <><circle cx="12" cy="12" r="8.5" /><path d="m10.5 8.5 4 3.5-4 3.5" /></>,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className, strokeWidth = 1.75 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg className={`icon${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

export const AREA_ICON: Record<Area, IconName> = { biologia: 'biologia', quimica: 'quimica', fisica: 'fisica', ambiental: 'ambiental' };

/** Marca del laboratorio: matraz con nivel de líquido sobre placa del color de acento. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <rect width="36" height="36" rx="9" fill="var(--accent)" />
      <path d="M8 27.5 h20" stroke="var(--accent-ink)" strokeOpacity=".35" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 7.5h8M15.5 7.5v7L10 24.4a1.9 1.9 0 0 0 1.7 2.8h12.6a1.9 1.9 0 0 0 1.7-2.8L20.5 14.5v-7" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M12.3 20.5h11.4l2.3 3.9a1.9 1.9 0 0 1-1.7 2.8H11.7a1.9 1.9 0 0 1-1.7-2.8z" fill="var(--accent-ink)" fillOpacity=".9" />
      <circle cx="17" cy="17.5" r="1.1" fill="var(--accent-ink)" /><circle cx="19.6" cy="15" r="0.8" fill="var(--accent-ink)" />
    </svg>
  );
}
