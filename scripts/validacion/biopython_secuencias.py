#!/usr/bin/env python3
"""Valores de referencia de Biopython para la práctica «secuencias» (programa v2, sección 10.1).

Lee las secuencias de ejemplo directamente de src/models/sequences.ts (para que la referencia use exactamente las
mismas cadenas que el laboratorio), calcula con Biopython traducciones (tablas 1, 2 y 11), reversos complementarios,
%GC y puntajes de alineamiento global y local con PairwiseAligner, y escribe tests/fixtures/biopython-secuencias.json.

Uso (desde la raíz del repositorio, con un entorno virtual aparte):
    python3 -m venv /tmp/venv-bio && /tmp/venv-bio/bin/pip install biopython==1.85
    /tmp/venv-bio/bin/python -I scripts/validacion/biopython_secuencias.py            # genera el JSON
    /tmp/venv-bio/bin/python -I scripts/validacion/biopython_secuencias.py --verificar-red
        # además vuelve a descargar cada ejemplo de su URL de origen (NCBI E-utilities / UniProt REST)
        # y comprueba que la secuencia sea idéntica (respeta < 3 solicitudes por segundo).
"""
import json
import re
import sys
import time
import platform
import urllib.request
from pathlib import Path

import Bio
from Bio import Align
from Bio.Align import substitution_matrices
from Bio.Data import CodonTable
from Bio.Seq import Seq
from Bio.SeqUtils import gc_fraction

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'src' / 'models' / 'sequences.ts'
OUT = ROOT / 'tests' / 'fixtures' / 'biopython-secuencias.json'


def read_examples():
    text = SRC.read_text(encoding='utf-8')
    block = text[text.index('export const SEQUENCE_EXAMPLES'):text.index('export function findExample')]
    examples = {}
    for chunk in block.split("\n  {\n")[1:]:
        ex_id = re.search(r"id: '([^']+)'", chunk).group(1)
        kind = re.search(r"kind: '([^']+)'", chunk).group(1)
        table = int(re.search(r"\btable: (\d+)", chunk).group(1))
        seq = re.search(r"sequence: '([A-Z*]+)'", chunk).group(1)
        url = re.search(r"sourceUrl: ([^,]+),", chunk).group(1).strip()
        cds = re.search(r"cds: \{ start: (\d+), end: (\d+)", chunk)
        examples[ex_id] = {
            'kind': kind, 'table': table, 'sequence': seq, 'url': url,
            'cds': [int(cds.group(1)), int(cds.group(2))] if cds else None,
        }
    efetch = re.search(r"const EFETCH = '([^']+)'", text).group(1)
    for ex in examples.values():
        u = ex['url']
        ex['url'] = efetch + u[len('`${EFETCH}'):-1] if u.startswith('`${EFETCH}') else u.strip("'")
    return examples


def fetch_fasta(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'laboratorio-virtual-ciencias/validacion'})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read().decode('utf-8')
    return ''.join(l.strip() for l in body.splitlines() if l and not l.startswith('>')).upper()


def table_dump(tid):
    t = CodonTable.unambiguous_dna_by_id[tid]
    codons = {}
    for a in 'TCAG':
        for b in 'TCAG':
            for c in 'TCAG':
                k = a + b + c
                codons[k] = '*' if k in t.stop_codons else t.forward_table[k]
    return {'codons': codons, 'starts': sorted(t.start_codons), 'stops': sorted(t.stop_codons)}


def run_alignment(case, seqs):
    a, b = seqs[case['a']], seqs[case['b']]
    al = Align.PairwiseAligner(mode=case['mode'])
    if case['matrix'] == 'blosum62':
        al.substitution_matrix = substitution_matrices.load('BLOSUM62')
    else:
        al.match_score = case['match']
        al.mismatch_score = case['mismatch']
    al.open_gap_score = -case['gapOpen']
    al.extend_gap_score = -case['gapExtend']
    alignments = al.align(a, b)
    try:
        n_opt = len(alignments)
    except OverflowError:
        n_opt = 10 ** 9
    out = dict(case)
    out['score'] = alignments.score
    out['optimalCount'] = min(n_opt, 10 ** 9)
    if n_opt == 1:
        best = alignments[0]
        counts = best.counts()
        coords = best.coordinates
        out['alignedA'] = best[0]
        out['alignedB'] = best[1]
        out['identities'] = counts.identities
        out['mismatches'] = counts.mismatches
        out['gaps'] = counts.gaps
        out['startA'] = int(coords[0][0]) + 1
        out['endA'] = int(coords[0][-1])
        out['startB'] = int(coords[1][0]) + 1
        out['endB'] = int(coords[1][-1])
    return out


def main():
    examples = read_examples()
    if '--verificar-red' in sys.argv:
        for ex_id, ex in examples.items():
            got = fetch_fasta(ex['url'])
            status = 'idéntica' if got == ex['sequence'] else 'DISTINTA'
            print(f"{ex_id}: {len(got)} residuos, {status} ({ex['url']})")
            if got != ex['sequence']:
                sys.exit(1)
            time.sleep(0.5)

    seqs = {k: v['sequence'] for k, v in examples.items()}
    for k, v in examples.items():
        if v['cds']:
            s, e = v['cds']
            seqs[k + ':cds'] = v['sequence'][s - 1:e]
    seqs['gattaca'] = 'GATTACA'
    seqs['gcatgcu'] = 'GCATGCU'
    seqs['afin-a'] = 'ACGTTTACGTGGCA'
    seqs['afin-b'] = 'ACGTACGTGCA'
    seqs['del-a'] = 'TTACGTACGTACGGA'
    seqs['del-b'] = 'ACGTAGTACG'
    seqs['laci-300'] = examples['laci']['sequence'][:300]

    ref_examples = {}
    for k, v in examples.items():
        entry = {'length': len(v['sequence'])}
        if v['kind'] != 'proteina':
            s = Seq(v['sequence'])
            entry['gcPercent'] = gc_fraction(s) * 100
            entry['reverseComplement'] = str(s.reverse_complement())
            entry['translations'] = {str(t): str(s[: len(s) // 3 * 3].translate(table=t)) for t in (1, 2, 11)}
            if v['cds']:
                c = Seq(seqs[k + ':cds'])
                entry['cdsTranslation'] = str(c.translate(table=v['table'], cds=True))
                entry['cdsTable'] = v['table']
        ref_examples[k] = entry

    gc_cases = {s: gc_fraction(s) * 100 for s in ['ACGT', 'GGCC', 'AATT', 'ACTGN', 'ACTGSSSS', 'GGAUCUUCGGAUCU', 'ATGCATGCWWSS', 'GCGCGCAT']}
    rc_cases = {s: str(Seq(s).reverse_complement()) for s in ['ATGRYKMSWBDHVN', 'AACCGGTT', 'ATGCNNA', 'GATTACA']}
    rna_rc = {s: str(Seq(s).reverse_complement_rna()) for s in ['AUGC', 'GAUUACA']}
    amb_codons = ['CTN', 'TAR', 'TAN', 'NNN', 'ATN', 'TRA', 'YTG', 'MGR', 'GCN', 'AGR', 'ATH', 'TGR']
    ambiguous = {str(t): {c: str(Seq(c).translate(table=t)) for c in amb_codons} for t in (1, 2, 11)}

    cases = [
        {'name': 'GATTACA/GCATGCU global lineal', 'a': 'gattaca', 'b': 'gcatgcu', 'mode': 'global', 'matrix': 'simple', 'match': 1, 'mismatch': -1, 'gapOpen': 1, 'gapExtend': 1},
        {'name': 'GATTACA/GCATGCU local', 'a': 'gattaca', 'b': 'gcatgcu', 'mode': 'local', 'matrix': 'simple', 'match': 2, 'mismatch': -1, 'gapOpen': 2, 'gapExtend': 2},
        {'name': 'Huecos afines construidos (global)', 'a': 'afin-a', 'b': 'afin-b', 'mode': 'global', 'matrix': 'simple', 'match': 2, 'mismatch': -1, 'gapOpen': 5, 'gapExtend': 0.5},
        {'name': 'Huecos afines construidos (local)', 'a': 'afin-a', 'b': 'afin-b', 'mode': 'local', 'matrix': 'simple', 'match': 2, 'mismatch': -1, 'gapOpen': 5, 'gapExtend': 0.5},
        {'name': 'CDS HBB/HBD global', 'a': 'hbb-arnm:cds', 'b': 'hbd-arnm:cds', 'mode': 'global', 'matrix': 'simple', 'match': 1, 'mismatch': -1, 'gapOpen': 2, 'gapExtend': 1},
        {'name': 'CDS HBB/HBD global sin huecos baratos', 'a': 'hbb-arnm:cds', 'b': 'hbd-arnm:cds', 'mode': 'global', 'matrix': 'simple', 'match': 1, 'mismatch': -2, 'gapOpen': 5, 'gapExtend': 2},
        {'name': 'Deleción única construida (global)', 'a': 'del-a', 'b': 'del-b', 'mode': 'global', 'matrix': 'simple', 'match': 1, 'mismatch': -1, 'gapOpen': 2, 'gapExtend': 1},
        {'name': 'Deleción única construida (local)', 'a': 'del-a', 'b': 'del-b', 'mode': 'local', 'matrix': 'simple', 'match': 2, 'mismatch': -3, 'gapOpen': 3, 'gapExtend': 1},
        {'name': 'ARNm HBB/HBD local', 'a': 'hbb-arnm', 'b': 'hbd-arnm', 'mode': 'local', 'matrix': 'simple', 'match': 2, 'mismatch': -3, 'gapOpen': 5, 'gapExtend': 2},
        {'name': 'ARNm HBB/HBD global', 'a': 'hbb-arnm', 'b': 'hbd-arnm', 'mode': 'global', 'matrix': 'simple', 'match': 1, 'mismatch': -1, 'gapOpen': 2, 'gapExtend': 1},
        {'name': 'lacI (300 nt)/MT-ATP8 local', 'a': 'laci-300', 'b': 'atp8', 'mode': 'local', 'matrix': 'simple', 'match': 1, 'mismatch': -1, 'gapOpen': 2, 'gapExtend': 1},
        {'name': 'Insulina humana/bovina global BLOSUM62', 'a': 'ins-humana', 'b': 'ins-bovina', 'mode': 'global', 'matrix': 'blosum62', 'match': 0, 'mismatch': 0, 'gapOpen': 11, 'gapExtend': 1},
        {'name': 'Insulina humana/bovina local BLOSUM62', 'a': 'ins-humana', 'b': 'ins-bovina', 'mode': 'local', 'matrix': 'blosum62', 'match': 0, 'mismatch': 0, 'gapOpen': 10, 'gapExtend': 0.5},
        {'name': 'β/α-globina global BLOSUM62', 'a': 'hbb-prot', 'b': 'hba-prot', 'mode': 'global', 'matrix': 'blosum62', 'match': 0, 'mismatch': 0, 'gapOpen': 11, 'gapExtend': 1},
        {'name': 'β/α-globina local BLOSUM62', 'a': 'hbb-prot', 'b': 'hba-prot', 'mode': 'local', 'matrix': 'blosum62', 'match': 0, 'mismatch': 0, 'gapOpen': 11, 'gapExtend': 1},
        {'name': 'β/α-globina global BLOSUM62 huecos 10/0,5', 'a': 'hbb-prot', 'b': 'hba-prot', 'mode': 'global', 'matrix': 'blosum62', 'match': 0, 'mismatch': 0, 'gapOpen': 10, 'gapExtend': 0.5},
    ]
    alignments = [run_alignment(c, seqs) for c in cases]

    m = substitution_matrices.load('BLOSUM62')
    blosum = {'alphabet': m.alphabet, 'rows': [[int(m[a, b]) for b in m.alphabet] for a in m.alphabet]}

    fixture = {
        'generator': 'scripts/validacion/biopython_secuencias.py',
        'biopython': Bio.__version__,
        'python': platform.python_version(),
        'note': 'Valores de referencia calculados con Biopython; no editar a mano. Regenerar con el script.',
        'sequences': seqs,
        'examples': ref_examples,
        'geneticCodes': {str(t): table_dump(t) for t in (1, 2, 11)},
        'gc': gc_cases,
        'reverseComplement': rc_cases,
        'reverseComplementRna': rna_rc,
        'ambiguousCodons': ambiguous,
        'blosum62': blosum,
        'alignments': alignments,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fixture, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'Escrito {OUT.relative_to(ROOT)} con Biopython {Bio.__version__}; {len(alignments)} alineamientos.')
    for a in alignments:
        print(f"  {a['name']}: puntaje {a['score']}, óptimos {a['optimalCount']}")


if __name__ == '__main__':
    main()
