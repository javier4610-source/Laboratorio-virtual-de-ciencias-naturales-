#!/usr/bin/env python3
"""Modelo y valores de referencia de COBRApy para la práctica «metabolismo» (programa v2, sección 10.7).

1. Exporta el modelo E. coli core que viene DENTRO del paquete cobra (archivo cobra/data/textbook.xml.gz, id «e_coli_core»;
   se carga con cobra.io.load_model("textbook"), que no usa la red) a un JSON compacto: src/data/ecoli_core.json.
   (cobra.io.load_model("e_coli_core") descargaría el modelo de BiGG, inaccesible desde el entorno donde se generó.)
2. Resuelve con COBRApy (optlang + GLPK) los casos de validación y escribe tests/fixtures/cobra-fba.json:
   glucosa aerobia y anaerobia, todas las fuentes de carbono con intercambio en el modelo (aerobio y anaerobio),
   series de oxígeno y de captación de glucosa, eliminación de cada gen y de cada reacción, genes esenciales
   (cobra.flux_analysis.find_essential_genes, umbral por defecto 1 % del óptimo) y FVA al 100 % y al 99 % del óptimo.

Uso (desde la raíz del repositorio, con un entorno virtual aparte):
    python3 -m venv /tmp/venv-cobra && /tmp/venv-cobra/bin/pip install cobra==0.32.1
    /tmp/venv-cobra/bin/python -I scripts/validacion/cobra_fba.py
"""
import gzip
import warnings
import hashlib
import json
import math
import platform
from datetime import date
from pathlib import Path

import cobra
import optlang
import swiglpk
from cobra.flux_analysis import find_essential_genes, flux_variability_analysis

ROOT = Path(__file__).resolve().parents[2]
OUT_MODEL = ROOT / 'src' / 'data' / 'ecoli_core.json'
OUT_FIX = ROOT / 'tests' / 'fixtures' / 'cobra-fba.json'

BIOMASS = 'Biomass_Ecoli_core'
# Intercambios de compuestos con carbono presentes en el modelo (todos los EX_ salvo CO2, H+, H2O, NH4+, O2 y fosfato).
CARBON = ['glc__D', 'fru', 'ac', 'succ', 'pyr', 'mal__L', 'fum', 'akg', 'lac__D', 'glu__L', 'gln__L', 'etoh', 'acald', 'for']
KEY_EXCHANGES = ['EX_glc__D_e', 'EX_fru_e', 'EX_o2_e', 'EX_co2_e', 'EX_ac_e', 'EX_etoh_e', 'EX_for_e', 'EX_lac__D_e',
                 'EX_succ_e', 'EX_nh4_e', 'EX_pi_e', 'EX_h_e', 'EX_h2o_e']
UNLIMITED_O2 = 1000.0


def r6(x):
    """Redondeo a 12 cifras significativas para un JSON estable (las comparaciones usan tolerancia 1e-6 relativa)."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    return float(f'{x:.12g}')


def set_condition(model, carbon='glc__D', uptake=10.0, o2=UNLIMITED_O2):
    for c in CARBON:
        model.reactions.get_by_id(f'EX_{c}_e').lower_bound = 0.0
    model.reactions.get_by_id(f'EX_{carbon}_e').lower_bound = -uptake
    model.reactions.EX_o2_e.lower_bound = -o2


def solve(model):
    sol = model.optimize()
    if sol.status != 'optimal':
        return {'status': sol.status, 'growth': None}
    out = {'status': 'optimal', 'growth': r6(sol.objective_value)}
    out['exchanges'] = {r: r6(sol.fluxes[r]) for r in KEY_EXCHANGES}
    fva = flux_variability_analysis(model, reaction_list=KEY_EXCHANGES, fraction_of_optimum=1.0)
    out['exchangeRanges'] = {r: [r6(fva.loc[r, 'minimum']), r6(fva.loc[r, 'maximum'])] for r in KEY_EXCHANGES}
    return out


def export_model(model, sha):
    mets = [[m.id, m.name, m.formula or '', m.compartment] for m in model.metabolites]
    genes = [[g.id, g.name] for g in model.genes]
    rxns = []
    for r in model.reactions:
        rxns.append({
            'id': r.id, 'name': r.name, 'lb': r.lower_bound, 'ub': r.upper_bound, 'gpr': r.gene_reaction_rule,
            'subsystem': r.subsystem or '',
            'mets': {m.id: c for m, c in sorted(r.metabolites.items(), key=lambda kv: kv[0].id)},
        })
    return {
        'meta': {
            'generator': 'scripts/validacion/cobra_fba.py',
            'exported': date.today().isoformat(),
            'modelId': model.id,
            'source': {
                'package': 'cobra', 'version': cobra.__version__, 'file': 'cobra/data/textbook.xml.gz',
                'sha256Gz': sha, 'loadCall': 'cobra.io.load_model("textbook")', 'format': 'SBML nivel 3 versión 1 con fbc versión 2',
                'packageLicense': 'LGPL-2.0-or-later OR GPL-2.0-or-later (metadatos del paquete cobra; el archivo del modelo no declara licencia propia)',
            },
            'objective': BIOMASS,
            'units': 'mmol/gDW/h (flujos); h⁻¹ (biomasa)',
            'note': 'El archivo SBML no trae anotación de cita, notas ni subsistemas; los subsistemas quedan vacíos. '
                    'Límites originales del archivo: EX_glc__D_e ≥ −10 y ATPM ≥ 8,39 mmol/gDW/h; los demás ±1000 o 0..1000.',
            'counts': {'reactions': len(rxns), 'metabolites': len(mets), 'genes': len(genes)},
        },
        'metabolites': mets,
        'genes': genes,
        'reactions': rxns,
    }


def main():
    warnings.filterwarnings('ignore', message="Solver status is 'infeasible'")
    gz = Path(cobra.__file__).resolve().parent / 'data' / 'textbook.xml.gz'
    sha = hashlib.sha256(gz.read_bytes()).hexdigest()
    with gzip.open(gz, 'rt', encoding='utf-8') as fh:
        head = fh.read(400)
    assert 'id="e_coli_core"' in head
    model = cobra.io.load_model('textbook')
    model.solver = 'glpk'

    OUT_MODEL.write_text(json.dumps(export_model(model, sha), ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')

    fix = {
        'generator': 'scripts/validacion/cobra_fba.py',
        'cobra': cobra.__version__, 'optlang': optlang.__version__, 'swiglpk': getattr(swiglpk, '__version__', 'desconocida'),
        'glpk': swiglpk.glp_version(), 'solver': 'glpk (optlang.glpk_interface)', 'python': platform.python_version(),
        'modelId': model.id, 'modelFile': 'cobra/data/textbook.xml.gz', 'modelSha256Gz': sha,
        'note': 'Valores de referencia calculados con COBRApy; no editar a mano. Regenerar con el script. '
                'growth = null cuando el problema no es factible (p. ej., no se puede cubrir el mantenimiento ATPM ≥ 8,39).',
        'conditions': [],
    }

    def cond(label, **kw):
        with model:
            set_condition(model, **kw)
            res = solve(model)
        fix['conditions'].append({'label': label, 'carbon': kw.get('carbon', 'glc__D'), 'uptake': kw.get('uptake', 10.0),
                                  'o2': kw.get('o2', UNLIMITED_O2), **res})

    cond('glucosa aerobia')
    cond('glucosa anaerobia', o2=0.0)
    for c in CARBON:
        cond(f'{c} aerobio', carbon=c, uptake=10.0)
        cond(f'{c} anaerobio', carbon=c, uptake=10.0, o2=0.0)
    for o2 in range(0, 31):
        cond(f'serie O2 {o2}', o2=float(o2))
    for up in [0, 1, 2, 4, 6, 8, 12, 15, 20]:
        cond(f'serie glucosa {up}', uptake=float(up))

    # Eliminación de genes y reacciones
    def growth_now():
        v = model.slim_optimize(error_value=float('nan'))
        return None if math.isnan(v) else r6(v)

    for o2, tag in [(UNLIMITED_O2, 'aerobio'), (0.0, 'anaerobio')]:
        with model:
            set_condition(model, o2=o2)
            wt = model.slim_optimize()
            ko = {}
            for g in model.genes:
                with model:
                    g.knock_out()
                    ko[g.id] = growth_now()
            ess = sorted(g.id for g in find_essential_genes(model))
            fix[f'geneKnockouts_{tag}'] = {'wildType': r6(wt), 'growth': ko, 'essential': ess,
                                            'threshold': '0,01 × crecimiento óptimo (por defecto de find_essential_genes)'}
    with model:
        set_condition(model)
        rko = {}
        for r in model.reactions:
            with model:
                r.knock_out()
                rko[r.id] = growth_now()
        fix['reactionKnockouts_aerobio'] = rko

    # FVA de todas las reacciones
    for o2, tag in [(UNLIMITED_O2, 'aerobio'), (0.0, 'anaerobio')]:
        for frac in (1.0, 0.99):
            with model:
                set_condition(model, o2=o2)
                fva = flux_variability_analysis(model, fraction_of_optimum=frac)
            fix[f'fva_{tag}_{int(frac * 100)}'] = {r: [r6(fva.loc[r, 'minimum']), r6(fva.loc[r, 'maximum'])] for r in fva.index}

    OUT_FIX.write_text(json.dumps(fix, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    a = fix['conditions'][0]['growth']; b = fix['conditions'][1]['growth']
    print(f'cobra {cobra.__version__}, GLPK {swiglpk.glp_version()}: aerobio {a} h-1, anaerobio {b} h-1;',
          f'{len(fix["conditions"])} condiciones; esenciales aerobio {len(fix["geneKnockouts_aerobio"]["essential"])}')


if __name__ == '__main__':
    main()
