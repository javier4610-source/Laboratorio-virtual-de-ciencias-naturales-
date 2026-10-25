"""Verifica la paleta de src/tokens.css: contraste WCAG y separación de la escala de datos con daltonismo.

Uso:  python3 scripts/diseno/verificar_paleta.py
Sale con código 1 si un par de texto queda por debajo de 4,5:1, un control o una serie por debajo de 3:1, o si
dos series quedan con ΔE2000 < 5 en alguna visión simulada (normal, protanopía, deuteranopía, tritanopía).

Simulación: matrices de Machado, Oliveira y Fernandes (2009), severidad 1, aplicadas en RGB lineal.
Diferencia de color: CIEDE2000 (CIE 142-2001) en CIELAB con iluminante D65.
"""
import itertools
import math
import pathlib
import re
import sys

TOKENS = pathlib.Path(__file__).resolve().parents[2] / 'src' / 'tokens.css'


def hex2rgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def delin(c):
    c = min(1, max(0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def luminance(h):
    r, g, b = [lin(c) for c in hex2rgb(h)]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


MACHADO = {
    'protanopía': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    'deuteranopía': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    'tritanopía': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}


def simulate(h, kind):
    if kind == 'normal':
        return hex2rgb(h)
    r, g, b = [lin(c) for c in hex2rgb(h)]
    m = MACHADO[kind]
    return [delin(m[i][0] * r + m[i][1] * g + m[i][2] * b) for i in range(3)]


def lab(rgb):
    r, g, b = [lin(c) for c in rgb]
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))


def de2000(l1, l2):
    L1, a1, b1 = l1
    L2, a2, b2 = l2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2)
    Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dL, dC = L2 - L1, C2p - C1p
    if C1p * C2p == 0:
        dh = 0
    elif abs(h2p - h1p) <= 180:
        dh = h2p - h1p
    else:
        dh = h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lb, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    if C1p * C2p == 0:
        hb = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hb = (h1p + h2p) / 2
    else:
        hb = (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2
    T = (1 - 0.17 * math.cos(math.radians(hb - 30)) + 0.24 * math.cos(math.radians(2 * hb))
         + 0.32 * math.cos(math.radians(3 * hb + 6)) - 0.20 * math.cos(math.radians(4 * hb - 63)))
    Sl = 1 + 0.015 * (Lb - 50) ** 2 / math.sqrt(20 + (Lb - 50) ** 2)
    Sc, Sh = 1 + 0.045 * Cbp, 1 + 0.015 * Cbp * T
    dt = 30 * math.exp(-((hb - 275) / 25) ** 2)
    Rt = -math.sin(math.radians(2 * dt)) * 2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
    return math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))


def block(css, selector_regex):
    m = re.search(selector_regex + r'\s*\{\n([\s\S]*?)\n\s*\}', css, re.M)
    return dict(re.findall(r'(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b', m.group(1)))


PAIRS = [
    # (primer plano, fondo, descripción, mínimo)
    ('--ink', '--bg', 'texto sobre fondo', 4.5), ('--ink-2', '--surface', 'texto secundario sobre superficie', 4.5),
    ('--ink-2', '--surface-2', 'texto secundario sobre superficie 2', 4.5), ('--ink-2', '--surface-3', 'texto secundario sobre superficie 3', 4.5),
    ('--line-strong', '--surface', 'borde de control', 3), ('--accent-ink', '--accent', 'texto sobre primario', 4.5),
    ('--accent', '--surface', 'primario como texto o enlace', 4.5), ('--accent', '--accent-soft', 'primario sobre primario suave', 4.5),
    ('--secondary', '--secondary-soft', 'secundario sobre secundario suave', 4.5), ('--data', '--surface', 'dato sobre superficie', 4.5),
    ('--data', '--data-soft', 'dato sobre dato suave', 4.5), ('--ok', '--ok-soft', 'éxito', 4.5), ('--warn', '--warn-soft', 'advertencia', 4.5),
    ('--bad', '--bad-soft', 'error', 4.5), ('--info', '--info-soft', 'información', 4.5), ('--focus', '--surface', 'foco sobre superficie', 3),
    ('--focus', '--bg', 'foco sobre fondo', 3), ('--bio', '--surface', 'biología', 4.5), ('--qui', '--surface', 'química', 4.5),
    ('--fis', '--surface', 'física', 4.5), ('--amb', '--surface', 'ambiental', 4.5),
]


def main():
    css = TOKENS.read_text(encoding='utf8')
    light = block(css, r'^:root')
    dark = {**light, **block(css, r':root\[data-theme="dark"\]')}
    fails = 0
    for name, t in (('claro', light), ('oscuro', dark)):
        print(f'\n## Tema {name}\n\n| Par | Contraste | Mínimo |\n|---|---|---|')
        for fg, bg, label, need in PAIRS:
            r = contrast(t[fg], t[bg])
            ok = r >= need
            fails += not ok
            print(f'| {label} (`{fg}` sobre `{bg}`) | {r:.2f}:1{"" if ok else " **FALLA**"} | {need}:1 |')
        series = [t[f'--series-{i}'] for i in range(1, 9)]
        print(f'\n| Serie | Color | Contraste sobre la superficie |\n|---|---|---|')
        for i, c in enumerate(series, 1):
            r = contrast(c, t['--surface'])
            fails += r < 3
            print(f'| {i} | `{c}` | {r:.2f}:1 |')
        print('\n| Visión | ΔE2000 mínimo entre las 8 series | Entre las 4 primeras |\n|---|---|---|')
        for kind in ['normal', *MACHADO]:
            labs = [lab(simulate(c, kind)) for c in series]
            pairs = list(itertools.combinations(range(8), 2))
            worst = min((de2000(labs[i], labs[j]), i + 1, j + 1) for i, j in pairs)
            first4 = min(de2000(labs[i], labs[j]) for i, j in itertools.combinations(range(4), 2))
            fails += worst[0] < 5
            print(f'| {kind} | {worst[0]:.1f} (series {worst[1]} y {worst[2]}) | {first4:.1f} |')
    print(f'\n{"Todo cumple." if not fails else f"{fails} verificaciones fallan."}')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
