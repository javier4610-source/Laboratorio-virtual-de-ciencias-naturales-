#!/usr/bin/env python3
"""Descarga el conjunto curado de estructuras de la práctica «proteinas» (programa v2, sección 10.4) y genera
src/data/proteins.ts con su procedencia (URL, fecha, SHA-256, tamaño y metadatos de RCSB PDB / AlphaFold DB).

Solo usa la biblioteca estándar. Los archivos de coordenadas se guardan SIN MODIFICAR en src/data/proteinas/.
De la PAE (error de alineamiento predicho) de AlphaFold solo se guarda un RESUMEN por bloques (promedio de cada
bloque de residuos), porque el archivo completo pesa ~1,9 MB; el resumen se rotula como tal en la interfaz.

Uso (desde la raíz del repositorio):
    python3 -I scripts/validacion/proteinas_fetch.py            # descarga, verifica y regenera src/data/proteins.ts
    python3 -I scripts/validacion/proteinas_fetch.py --fecha 2026-10-18

Nota: el servidor de archivos de AlphaFold DB (alphafold.ebi.ac.uk/files) respondió 403 a la cabecera User-Agent
por defecto de curl/urllib el 2026-10-18 y 200 a una cabecera de navegador; los navegadores no tienen ese problema.
"""
import hashlib
import json
import math
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / 'src' / 'data' / 'proteinas'
OUT_TS = ROOT / 'src' / 'data' / 'proteins.ts'
UA = 'Mozilla/5.0 (X11; Linux x86_64) laboratorio-virtual-ciencias/validacion'

# Conjunto curado: identificadores elegidos a mano y verificados con las API (nunca inventados).
EXPERIMENTAL = [
    {'id': '3I40', 'key': 'insulina', 'name': 'Insulina humana', 'rastreo': 'INS'},
    {'id': '2HHB', 'key': 'hemoglobina', 'name': 'Hemoglobina humana (desoxi)', 'rastreo': 'HBB'},
    {'id': '2LZM', 'key': 'lisozima', 'name': 'Lisozima del bacteriófago T4', 'rastreo': None},
    {'id': '1EMA', 'key': 'gfp', 'name': 'Proteína verde fluorescente (GFP)', 'rastreo': None},
]
PREDICTED = [
    {'acc': 'Q04671', 'key': 'oca2', 'name': 'Proteína P de OCA2 (humana)', 'rastreo': 'OCA2'},
]
PAE_BLOCKS = 40


def get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read()
    time.sleep(0.4)  # espaciar solicitudes
    return body if binary else body.decode('utf-8')


def sha256(b):
    return hashlib.sha256(b).hexdigest()


def day(iso):
    return iso[:10] if iso else None


def pae_blocks(matrix, nblocks):
    n = len(matrix)
    size = math.ceil(n / nblocks)
    k = math.ceil(n / size)
    out = []
    for bi in range(k):
        row = []
        for bj in range(k):
            s, c = 0.0, 0
            for i in range(bi * size, min(n, (bi + 1) * size)):
                r = matrix[i]
                for j in range(bj * size, min(n, (bj + 1) * size)):
                    s += r[j]
                    c += 1
            row.append(round(s / c, 1))
        out.append(row)
    return size, out


def experimental(entry, fecha):
    pid = entry['id']
    file_url = f'https://files.rcsb.org/download/{pid}.cif'
    meta_url = f'https://data.rcsb.org/rest/v1/core/entry/{pid}'
    raw = get(file_url, binary=True)
    (DATA_DIR / f'{pid}.cif').write_bytes(raw)
    meta = json.loads(get(meta_url))
    entities = []
    for eid in meta['rcsb_entry_container_identifiers'].get('polymer_entity_ids', []):
        pe = json.loads(get(f'https://data.rcsb.org/rest/v1/core/polymer_entity/{pid}/{eid}'))
        ids = pe['rcsb_polymer_entity_container_identifiers']
        entities.append({
            'description': pe['rcsb_polymer_entity'].get('pdbx_description'),
            'chains': ids.get('auth_asym_ids', []),
            'uniprot': ids.get('uniprot_ids') or [],
            'organism': [o.get('scientific_name') for o in pe.get('rcsb_entity_source_organism', [])],
        })
    cit = meta.get('rcsb_primary_citation', {})
    citation = (f"{'; '.join(cit.get('rcsb_authors', []))} ({cit.get('year')}). {(cit.get('title') or '').rstrip('.')}. "
                f"{cit.get('rcsb_journal_abbrev')} {cit.get('journal_volume')}, {cit.get('page_first')}–{cit.get('page_last')}.")
    acc = meta['rcsb_accession_info']
    info = meta['rcsb_entry_info']
    return {
        'key': entry['key'], 'id': pid, 'kind': 'experimental', 'name': entry['name'], 'file': f'{pid}.cif',
        'sourceUrl': file_url, 'pageUrl': f'https://www.rcsb.org/structure/{pid}', 'retrieved': fecha,
        'sha256': sha256(raw), 'bytes': len(raw), 'rastreoGene': entry['rastreo'],
        'experimental': {
            'metadataUrl': meta_url,
            'title': meta['struct']['title'],
            'method': meta['exptl'][0]['method'],
            'resolution': (info.get('resolution_combined') or [None])[0],
            'depositDate': day(acc.get('deposit_date')),
            'releaseDate': day(acc.get('initial_release_date')),
            'revisionDate': day(acc.get('revision_date')),
            'depositedAtoms': info.get('deposited_atom_count'),
            'entities': entities,
            'ligands': info.get('nonpolymer_bound_components') or [],
            'citation': citation,
            'license': 'CC0 1.0 (política de uso de RCSB PDB / wwPDB)',
        },
    }


def predicted(entry, fecha):
    acc = entry['acc']
    api_url = f'https://alphafold.ebi.ac.uk/api/prediction/{acc}'
    api = json.loads(get(api_url))
    rec = next(r for r in api if r.get('modelEntityId') == f'AF-{acc}-F1')
    raw = get(rec['cifUrl'], binary=True)
    name = rec['cifUrl'].rsplit('/', 1)[-1]
    (DATA_DIR / name).write_bytes(raw)
    pae_raw = get(rec['paeDocUrl'], binary=True)
    pae_doc = json.loads(pae_raw)
    pae = pae_doc[0] if isinstance(pae_doc, list) else pae_doc
    matrix = pae['predicted_aligned_error']
    size, blocks = pae_blocks(matrix, PAE_BLOCKS)
    return {
        'key': entry['key'], 'id': rec['modelEntityId'], 'kind': 'prediccion', 'name': entry['name'], 'file': name,
        'sourceUrl': rec['cifUrl'], 'pageUrl': f'https://alphafold.ebi.ac.uk/entry/{acc}', 'retrieved': fecha,
        'sha256': sha256(raw), 'bytes': len(raw), 'rastreoGene': entry['rastreo'],
        'prediction': {
            'apiUrl': api_url, 'uniprot': acc, 'entryId': rec['modelEntityId'], 'toolUsed': rec.get('toolUsed'),
            'providerId': rec.get('providerId'), 'version': rec.get('latestVersion'),
            'modelCreatedDate': day(rec.get('modelCreatedDate')), 'sequenceVersionDate': day(rec.get('sequenceVersionDate')),
            'globalMetricValue': rec.get('globalMetricValue'),
            'fractions': {
                'veryHigh': rec.get('fractionPlddtVeryHigh'), 'confident': rec.get('fractionPlddtConfident'),
                'low': rec.get('fractionPlddtLow'), 'veryLow': rec.get('fractionPlddtVeryLow'),
            },
            'gene': rec.get('gene'), 'description': rec.get('uniprotDescription'), 'organism': rec.get('organismScientificName'),
            'sequenceLength': rec.get('sequenceEnd'), 'paeUrl': rec['paeDocUrl'], 'paeImageUrl': rec.get('paeImageUrl'),
            'license': 'CC BY 4.0 (declarado en el propio archivo: _pdbx_data_usage)',
            'pae': {
                'sourceSha256': sha256(pae_raw), 'sourceBytes': len(pae_raw), 'n': len(matrix), 'blockSize': size,
                'max': pae.get('max_predicted_aligned_error'), 'blocks': blocks,
            },
        },
    }


HEADER = '''/**
 * Conjunto curado de estructuras 3D de proteínas de la práctica «Estructura 3D de proteínas: experimental y predicha».
 * ARCHIVO GENERADO por scripts/validacion/proteinas_fetch.py el {fecha} con consultas reales a RCSB PDB
 * (files.rcsb.org, data.rcsb.org) y AlphaFold DB (alphafold.ebi.ac.uk/api/prediction). No editar a mano.
 * Los archivos mmCIF de src/data/proteinas/ son las descargas SIN MODIFICAR (su SHA-256 y tamaño están aquí) y se
 * cargan bajo demanda, uno por uno, solo en este laboratorio (importación dinámica `?raw`).
 * La PAE de AlphaFold NO se incluye completa: `pae.blocks` es el promedio de cada bloque de `blockSize` × `blockSize`
 * residuos de la matriz oficial (resumen calculado por el script; se rotula así en la interfaz).
 */
export interface StructureEntity {{ description: string | null; chains: string[]; uniprot: string[]; organism: string[] }}
export interface ExperimentalInfo {{
  metadataUrl: string; title: string; method: string; resolution: number | null; depositDate: string | null; releaseDate: string | null;
  revisionDate: string | null; depositedAtoms: number | null; entities: StructureEntity[]; ligands: string[]; citation: string; license: string;
}}
export interface PaeSummary {{ sourceSha256: string; sourceBytes: number; n: number; blockSize: number; max: number | null; blocks: number[][] }}
export interface PredictionInfo {{
  apiUrl: string; uniprot: string; entryId: string; toolUsed: string | null; providerId: string | null; version: number | null;
  modelCreatedDate: string | null; sequenceVersionDate: string | null; globalMetricValue: number | null;
  fractions: {{ veryHigh: number | null; confident: number | null; low: number | null; veryLow: number | null }};
  gene: string | null; description: string | null; organism: string | null; sequenceLength: number | null;
  paeUrl: string; paeImageUrl: string | null; license: string; pae: PaeSummary | null;
}}
export interface BundledStructure {{
  key: string; id: string; kind: 'experimental' | 'prediccion'; name: string; file: string;
  sourceUrl: string; pageUrl: string; retrieved: string; sha256: string; bytes: number; rastreoGene: string | null;
  experimental?: ExperimentalInfo; prediction?: PredictionInfo;
}}

export const PROTEINS_RETRIEVED = '{fecha}';
'''


def main():
    fecha = '2026-10-18'
    if '--fecha' in sys.argv:
        fecha = sys.argv[sys.argv.index('--fecha') + 1]
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    items = [experimental(e, fecha) for e in EXPERIMENTAL] + [predicted(p, fecha) for p in PREDICTED]
    loaders = '\n'.join(f"  '{it['file']}': () => import('./proteinas/{it['file']}?raw').then((m) => m.default)," for it in items)
    body = HEADER.format(fecha=fecha)
    body += f'\nexport const BUNDLED_STRUCTURES: BundledStructure[] = {json.dumps(items, ensure_ascii=False, indent=2)};\n'
    body += '\n/** Carga diferida del texto mmCIF de cada estructura incluida (un fragmento por archivo). */\n'
    body += f'export const STRUCTURE_LOADERS: Record<string, () => Promise<string>> = {{\n{loaders}\n}};\n'
    OUT_TS.write_text(body, encoding='utf-8')
    total = sum(it['bytes'] for it in items)
    for it in items:
        print(f"{it['id']:14s} {it['bytes']:>8d} B  sha256 {it['sha256']}")
    print(f'Total: {total} B')


if __name__ == '__main__':
    main()
