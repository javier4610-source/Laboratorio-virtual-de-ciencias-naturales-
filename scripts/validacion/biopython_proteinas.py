#!/usr/bin/env python3
"""Valores de referencia de Biopython para la práctica «proteinas» (programa v2, sección 10.4).

Lee el conjunto curado (src/data/proteins.ts y los mmCIF sin modificar de src/data/proteinas/), comprueba el SHA-256 de
cada archivo y calcula, de forma independiente del lector TypeScript del laboratorio:
  - con Bio.PDB.MMCIFParser (primer modelo): cadenas, residuos por cadena (estándar, heterogrupos y agua), átomos por
    cadena y en total (las posiciones alternativas cuentan una vez), distancias entre átomos elegidos, el centroide de
    los Cα de los residuos estándar y la distancia de algunos Cα a ese centroide, y el factor B de algunos átomos;
  - con Bio.PDB.MMCIF2Dict: registros de _atom_site del primer modelo, residuos del polímero (label_seq_id distinto
    de «.») por cadena y filas de estructura secundaria (_struct_conf y _struct_sheet_range);
  - para el modelo de AlphaFold: pLDDT medio de los Cα (columna B) y fracción de residuos en cada banda
    (≥ 90 muy alta, ≥ 70 alta, ≥ 50 baja, < 50 muy baja), para compararla con las fracciones de la API.
Escribe tests/fixtures/biopython-proteinas.json (con las versiones de Python, Biopython y NumPy).

Uso (desde la raíz del repositorio, con un entorno virtual aparte):
    python3 -m venv /tmp/venv-bio && /tmp/venv-bio/bin/pip install biopython==1.85
    /tmp/venv-bio/bin/python -I scripts/validacion/biopython_proteinas.py
"""
import hashlib
import json
import platform
import re
from pathlib import Path

import numpy
import Bio
from Bio.PDB import MMCIFParser
from Bio.PDB.MMCIF2Dict import MMCIF2Dict

ROOT = Path(__file__).resolve().parents[2]
DATA_TS = ROOT / 'src' / 'data' / 'proteins.ts'
DATA_DIR = ROOT / 'src' / 'data' / 'proteinas'
OUT = ROOT / 'tests' / 'fixtures' / 'biopython-proteinas.json'

# Pares de átomos (cadena, número de residuo del autor, nombre del átomo). Elegidos por su significado biológico.
DISTANCES = {
    '3I40': [
        ('A', 6, 'SG', 'A', 11, 'SG', 'Puente disulfuro A6–A11 (dentro de la cadena A)'),
        ('A', 7, 'SG', 'B', 7, 'SG', 'Puente disulfuro A7–B7 (entre cadenas)'),
        ('A', 20, 'SG', 'B', 19, 'SG', 'Puente disulfuro A20–B19 (entre cadenas)'),
        ('A', 1, 'CA', 'A', 21, 'CA', 'Extremos de la cadena A'),
        ('B', 1, 'CA', 'B', 30, 'CA', 'Extremos de la cadena B'),
        ('A', 14, 'CG', 'A', 6, 'SG', 'Átomo con posiciones alternativas (TYR A14, ocupación 0,50/0,50)'),
    ],
    '2HHB': [
        ('A', 87, 'NE2', 'A', 142, 'FE', 'His proximal α (F8) – hierro del hemo'),
        ('B', 92, 'NE2', 'B', 148, 'FE', 'His proximal β (F8) – hierro del hemo'),
        ('C', 87, 'NE2', 'C', 142, 'FE', 'His proximal α (F8) – hierro del hemo, segunda cadena α'),
        ('A', 142, 'FE', 'B', 148, 'FE', 'Hierro – hierro entre los hemos de α1 y β1'),
        ('A', 1, 'CA', 'C', 1, 'CA', 'Extremos amino de las dos cadenas α'),
    ],
    '2LZM': [
        ('A', 11, 'CA', 'A', 20, 'CA', 'Glu11 – Asp20 (residuos del sitio activo)'),
        ('A', 1, 'CA', 'A', 164, 'CA', 'Extremos de la cadena'),
        ('A', 3, 'CA', 'A', 4, 'CA', 'Cα consecutivos'),
    ],
    '1EMA': [
        ('A', 2, 'CA', 'A', 229, 'CA', 'Primer y último Cα del modelo'),
        ('A', 66, 'OH', 'A', 148, 'ND1', 'Cromóforo (CRO66) – His148'),
        ('A', 66, 'CA2', 'A', 96, 'CA', 'Cromóforo (CRO66) – Arg96'),
    ],
    'AF-Q04671-F1': [
        ('A', 1, 'CA', 'A', 838, 'CA', 'Extremos de la cadena (Met1 – Asn838)'),
        ('A', 300, 'CA', 'A', 600, 'CA', 'Cα 300 – Cα 600'),
        ('A', 400, 'CA', 'A', 401, 'CA', 'Cα consecutivos'),
    ],
}
# Intervalos de distancia al centroide (Å) para resumir la columna B (factor B o pLDDT) de los Cα; se usan en las preguntas.
TREND_BINS = {
    '2LZM': [0, 8, 12, 16, 20, None],
    '2HHB': [0, 8, 12, 16, 20, None],
    'AF-Q04671-F1': [0, 15, 25, 35, 50, None],
}
CENTROID_PROBES = {
    '3I40': [('A', 1), ('B', 30)],
    '2HHB': [('A', 87), ('D', 146)],
    '2LZM': [('A', 1), ('A', 105)],
    '1EMA': [('A', 2), ('A', 148)],
    'AF-Q04671-F1': [('A', 1), ('A', 500)],
}


def read_index():
    text = DATA_TS.read_text(encoding='utf-8')
    block = text[text.index('export const BUNDLED_STRUCTURES'):text.index('export const STRUCTURE_LOADERS')]
    data = json.loads(block[block.index('= [') + 2:block.rindex(']') + 1])
    return data


def band(p):
    return 'muyAlta' if p >= 90 else 'alta' if p >= 70 else 'baja' if p >= 50 else 'muyBaja'


def first(model_list):
    return model_list[0]


def analyze(entry):
    path = DATA_DIR / entry['file']
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    assert digest == entry['sha256'], f"SHA-256 distinto en {entry['file']}"
    structure = MMCIFParser(QUIET=True).get_structure(entry['id'], str(path))
    model = first(list(structure))
    chains = []
    for chain in model:
        res = list(chain)
        chains.append({
            'id': chain.id,
            'standard': sum(1 for r in res if r.id[0] == ' '),
            'hetero': sum(1 for r in res if r.id[0].startswith('H_')),
            'water': sum(1 for r in res if r.id[0] == 'W'),
            'heteroNames': sorted({r.get_resname() for r in res if r.id[0].startswith('H_')}),
            'atoms': sum(1 for _ in chain.get_atoms()),
        })
    d = MMCIF2Dict(str(path))
    models = d['_atom_site.pdbx_PDB_model_num']
    m1 = models[0]
    rows = [i for i, m in enumerate(models) if m == m1]
    poly = {}
    for i in rows:
        if d['_atom_site.label_seq_id'][i] != '.':
            key = (d['_atom_site.auth_seq_id'][i], d['_atom_site.pdbx_PDB_ins_code'][i])
            poly.setdefault(d['_atom_site.auth_asym_id'][i], set()).add(key)
    conf = d.get('_struct_conf.conf_type_id', [])
    ss = {
        'structConfHelix': sum(1 for t in conf if t.startswith('HELX')),
        'structConfStrand': sum(1 for t in conf if t.startswith('STRN')),
        'structConfOther': sum(1 for t in conf if not t.startswith('HELX') and not t.startswith('STRN')),
        'sheetRange': len(d.get('_struct_sheet_range.id', [])),
    }

    def atom(c, n, name):
        residue = next(r for r in model[c] if r.id[1] == n)
        return residue, residue[name]

    distances = []
    for (c1, n1, a1, c2, n2, a2, note) in DISTANCES[entry['id']]:
        r1, x1 = atom(c1, n1, a1)
        r2, x2 = atom(c2, n2, a2)
        distances.append({
            'a': {'chain': c1, 'resSeq': n1, 'resName': r1.get_resname(), 'atom': a1, 'altloc': x1.get_altloc().strip(), 'bFactor': float(x1.get_bfactor())},
            'b': {'chain': c2, 'resSeq': n2, 'resName': r2.get_resname(), 'atom': a2, 'altloc': x2.get_altloc().strip(), 'bFactor': float(x2.get_bfactor())},
            'distance': float(x1 - x2), 'note': note,
        })
    cas = numpy.array([r['CA'].coord for r in model.get_residues() if r.id[0] == ' ' and 'CA' in r], dtype=float)
    centroid = cas.mean(axis=0)
    probes = []
    for (c, n) in CENTROID_PROBES[entry['id']]:
        r, ca = atom(c, n, 'CA')
        probes.append({'chain': c, 'resSeq': n, 'resName': r.get_resname(), 'distance': float(numpy.linalg.norm(ca.coord - centroid)), 'bFactor': float(ca.get_bfactor())})
    trend = None
    if entry['id'] in TREND_BINS:
        edges = TREND_BINS[entry['id']]
        res = [r for r in model.get_residues() if r.id[0] == ' ' and 'CA' in r]
        dist = numpy.array([numpy.linalg.norm(r['CA'].coord - centroid) for r in res])
        bval = numpy.array([r['CA'].get_bfactor() for r in res])
        trend = []
        for lo, hi in zip(edges[:-1], edges[1:]):
            sel = (dist >= lo) & (dist < hi) if hi is not None else (dist >= lo)
            trend.append({'min': lo, 'max': hi, 'n': int(sel.sum()), 'meanB': float(bval[sel].mean())})
        trend = {'bins': trend, 'pearsonR': float(numpy.corrcoef(dist, bval)[0, 1])}
    out = {
        'file': entry['file'], 'sha256': digest, 'bytes': len(raw), 'models': len(structure),
        'atomSiteRecordsModel1': len(rows),
        'atoms': sum(1 for _ in model.get_atoms()),
        'chains': chains,
        'polymerResidues': {k: len(v) for k, v in poly.items()},
        'secondaryStructureRows': ss,
        'caCentroid': [float(x) for x in centroid], 'caCount': int(len(cas)),
        'centroidProbes': probes,
        'distances': distances,
        'centroidTrend': trend,
    }
    if entry['kind'] == 'prediccion':
        plddt = [r['CA'].get_bfactor() for r in model.get_residues() if r.id[0] == ' ' and 'CA' in r]
        counts = {'muyAlta': 0, 'alta': 0, 'baja': 0, 'muyBaja': 0}
        for p in plddt:
            counts[band(p)] += 1
        n = len(plddt)
        out['plddt'] = {
            'residues': n, 'mean': float(numpy.mean(plddt)), 'min': float(min(plddt)), 'max': float(max(plddt)),
            'counts': counts, 'fractions': {k: round(v / n, 3) for k, v in counts.items()},
            'meanFirst150': float(numpy.mean(plddt[:150])), 'meanRest': float(numpy.mean(plddt[150:])),
            'apiFractions': entry['prediction']['fractions'], 'apiGlobalMetric': entry['prediction']['globalMetricValue'],
        }
    return out


def main():
    index = read_index()
    result = {
        'generator': 'scripts/validacion/biopython_proteinas.py',
        'biopython': Bio.__version__, 'numpy': numpy.__version__, 'python': platform.python_version(),
        'note': 'Valores de referencia calculados con Biopython (Bio.PDB.MMCIFParser y MMCIF2Dict) sobre los mmCIF incluidos; no editar a mano. Regenerar con el script.',
        'conventions': {
            'model': 'solo el primer modelo',
            'chainId': 'auth_asym_id', 'resSeq': 'auth_seq_id',
            'altloc': 'cada átomo con posiciones alternativas cuenta una vez; Biopython elige la de mayor ocupación (la primera si empatan)',
            'residueKinds': "standard = registros ATOM (id[0] == ' '), hetero = HETATM que no es agua, water = HOH",
            'plddtBands': 'muy alta ≥ 90, alta ≥ 70, baja ≥ 50, muy baja < 50 (Cα, columna B_iso_or_equiv)',
            'caCentroid': 'promedio de los Cα de los residuos estándar del primer modelo',
        },
        'structures': {e['id']: analyze(e) for e in index},
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    for k, v in result['structures'].items():
        print(k, 'cadenas', [c['id'] for c in v['chains']], 'átomos', v['atoms'], 'registros', v['atomSiteRecordsModel1'],
              'distancias', [round(x['distance'], 3) for x in v['distances']], v.get('plddt', {}).get('fractions'))


if __name__ == '__main__':
    main()
