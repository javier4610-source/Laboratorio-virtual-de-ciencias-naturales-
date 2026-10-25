import { BenchTop, Beaker, Burette, Cube, DigitalBalance, Erlenmeyer, GraduatedCylinder, TestTube, Thermometer } from '../labs/kit';

/** Escena de laboratorio de la portada: instrumentos del kit con burbujas y una gota en movimiento suave. */
export default function HeroScene() {
  const bubbles: [number, number, number][] = [[266, 0, 3.2], [280, 1.1, 2.4], [294, 2.2, 2.8], [272, 3.1, 2], [300, 0.6, 1.8], [286, 2.7, 2.2]];
  return (
    <svg viewBox="0 0 614 340" className="hero-scene" role="img" aria-label="Ilustración: mesa de laboratorio con probeta graduada, bureta sobre un matraz Erlenmeyer, vaso de precipitados con burbujas, termómetro, balanza digital, gradilla con tubos de ensayo y una gráfica de datos.">
      <defs>
        <linearGradient id="hero-screen" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--surface)" /><stop offset="1" stopColor="var(--surface-2)" /></linearGradient>
        <linearGradient id="hero-plot-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient>
      </defs>

      {/* Tarjeta de datos flotante */}
      <g transform="translate(392 22)"><g className="hero-float">
        <rect width="206" height="128" rx="12" fill="url(#hero-screen)" stroke="var(--line)" filter="url(#kit-shadow)" />
        <circle cx="16" cy="16" r="3.5" fill="var(--bad)" /><circle cx="28" cy="16" r="3.5" fill="var(--warn)" /><circle cx="40" cy="16" r="3.5" fill="var(--ok)" />
        <rect x="132" y="10" width="62" height="13" rx="6.5" fill="var(--accent-soft)" />
        <g transform="translate(18 34)">
          {[0, 1, 2, 3].map((i) => <line key={i} x1="0" x2="170" y1={i * 22} y2={i * 22} stroke="var(--line)" />)}
          <path d="M0 0V66H170" fill="none" stroke="var(--ink-2)" strokeWidth="1.2" />
          <path d="M0 62 C30 60 50 52 70 38 S120 8 170 4 V66 H0Z" fill="url(#hero-plot-fill)" />
          <path className="hero-trace" d="M0 62 C30 60 50 52 70 38 S120 8 170 4" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" />
          {[[14, 60], [42, 54], [70, 38], [100, 22], [134, 11], [164, 5]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3.2" fill="var(--data)" stroke="var(--surface)" strokeWidth="1.2" />)}
        </g>
      </g></g>

      {/* Soporte universal con bureta sobre el matraz */}
      <rect x="140" y="58" width="7" height="262" rx="2" fill="url(#kit-metal-h)" />
      <rect x="118" y="314" width="76" height="10" rx="3" fill="url(#kit-body-dark)" />
      <rect x="143" y="112" width="52" height="7" rx="2.5" fill="#78909c" />
      <Burette x={182} y={78} h={162} capacity={50} level={14} major={10} />
      <circle className="hero-drop" cx="191" cy="246" r="2.6" fill="#f48fb1" />
      <Erlenmeyer x={150} y={242} w={84} h={82} fill={0.42} liquid="#ec407a" liquidOpacity={0.5} />

      {/* Probeta graduada */}
      <GraduatedCylinder x={46} y={134} w={38} h={190} capacity={100} level={62} major={20} minor={10} liquid="#4f9fe0" />

      {/* Vaso con burbujas y termómetro */}
      <Beaker x={252} y={214} w={76} h={110} fill={0.62} liquid="#7fc7a8" liquidOpacity={0.55}>
        <g className="hero-bubbles">{bubbles.map(([x, d, r]) => <circle key={`${x}-${d}`} cx={x} cy={312} r={r} fill="#ffffff" fillOpacity="0.7" stroke="#2e7d5b" strokeOpacity="0.4" style={{ animationDelay: `${d}s` }} />)}</g>
      </Beaker>
      <g transform="rotate(8 312 260)"><Thermometer x={312} y={178} h={130} min={0} max={100} value={37} /></g>

      {/* Gradilla con tubos de ensayo */}
      <rect x="346" y="258" width="6" height="64" rx="1.5" fill="#c9a76a" />
      <rect x="430" y="258" width="6" height="64" rx="1.5" fill="#c9a76a" />
      {[['#fbc02d', 0.6], ['#7e57c2', 0.45], ['#26a69a', 0.7]].map(([c, f], i) => <TestTube key={i} x={358 + i * 26} y={232} w={16} h={82} fill={f as number} liquid={c as string} liquidOpacity={0.6} />)}
      <rect x="340" y="256" width="102" height="9" rx="2.5" fill="url(#kit-wood)" stroke="#b8975a" />
      <rect x="340" y="312" width="102" height="9" rx="2.5" fill="url(#kit-wood)" stroke="#b8975a" />

      {/* Balanza con muestra */}
      <DigitalBalance x={454} y={248} w={150} reading="21.60" />
      <Cube x={517} y={248} size={24} color="#b9c3c9" finish="metal" />

      <BenchTop y={324} width={614} />
    </svg>
  );
}

