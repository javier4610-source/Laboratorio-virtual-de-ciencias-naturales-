#!/usr/bin/env python3
"""
Descarga reproducible de los datos de las prácticas de química orgánica (hidrocarburos, aromáticos y nomenclatura).

Todo sale de consultas reales a PubChem (NCBI); nada se escribe a mano:
  1) Moléculas de las prácticas (LIBRERIA): nombre en inglés → CID con PUG REST
       /compound/name/<nombre>/cids/TXT  (primer CID); se verifica la fórmula de Hill esperada (si no coincide, el script se detiene)
     propiedades /compound/cid/<CID>/property/MolecularFormula,SMILES,ConnectivitySMILES,IUPACName,Title/JSON
     confórmero 3D /compound/cid/<CID>/SDF?record_type=3d (texto sin modificar y su SHA-256; 404 → «sin 3D», nunca se dibuja a mano)
     propiedades experimentales con su fuente vía PUG View /rest/pug_view/data/compound/<CID>/JSON?heading=<Boiling Point|Melting Point|Density|Heat of Combustion>
       Regla de selección (fija y documentada): 1.º HSDB con referencia al «CRC Handbook of Chemistry and Physics»; 2.º cualquier otra
       entrada de HSDB que se pueda leer; 3.º la primera entrada legible de otra fuente. Para el calor de combustión SOLO se aceptan
       HSDB citando el CRC Handbook o Riddick et al. (Techniques of Chemistry), que dan entalpías estándar; si no hay, queda «sin dato». Se guarda el texto literal, la referencia citada,
       la base de datos de origen, la URL de PUG View y la fecha.
  2) Validación del motor de nomenclatura (NOMENCLATURA): SMILES escrito por el docente/desarrollador → PubChem
       POST /compound/smiles/property/IUPACName,MolecularFormula,SMILES,ConnectivitySMILES,Title/JSON (smiles=<SMILES>)
     El IUPACName de PubChem lo calcula el programa LexiChem TK (OpenEye); se guarda tal cual con la fecha.
     Para la mayoría también se baja el confórmero 3D (solo el bloque molfile, sin las propiedades PUBCHEM_*, para pesar menos;
     se guarda el SHA-256 del archivo COMPLETO descargado y el del bloque recortado).

Salidas (generadas; no editar a mano):
  src/data/quimica/organica-moleculas.json        biblioteca de las prácticas (formato de src/data/quimica/molecules3d.ts + propiedades)
  src/data/quimica/organica-nomenclatura.json     confórmeros 3D de las estructuras de validación (constructor de moléculas)
  tests/fixtures/pubchem-nomenclatura.json        SMILES → CID, IUPACName (LexiChem) para las pruebas del motor de nomenclatura

Uso: python3 -I scripts/validacion/organica_pubchem.py            (≤ 4 solicitudes por segundo, política de uso de PubChem)
"""
import hashlib, json, os, re, sys, time, urllib.parse, urllib.request, urllib.error, datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
REST = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound'
UA = {'User-Agent': 'laboratorio-virtual-ciencias (scripts/validacion/organica_pubchem.py)'}
FECHA = datetime.date.today().isoformat()
_last = [0.0]

def get(url, data=None):
    for i in range(4):
        wait = _last[0] + 0.26 - time.time()
        if wait > 0: time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, r.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            if e.code in (429, 503, 504): time.sleep(2 * (i + 1)); continue
            return e.code, e.read().decode('utf-8', 'replace')
        except Exception:
            time.sleep(2 * (i + 1))
    raise SystemExit(f'PubChem no respondió: {url}')

# ---------------------------------------------------------------- moléculas de las prácticas
# [id, nombre en español, búsqueda en inglés (o «smiles:<SMILES isomérico>»), fórmula de Hill esperada, grupos]
LIBRERIA = [
    # alcanos lineales C1–C10
    ['metano', 'Metano', 'methane', 'CH4', 'alcano'], ['etano', 'Etano', 'ethane', 'C2H6', 'alcano'],
    ['propano', 'Propano', 'propane', 'C3H8', 'alcano'], ['butano', 'Butano', 'butane', 'C4H10', 'alcano'],
    ['pentano', 'Pentano', 'pentane', 'C5H12', 'alcano'], ['hexano', 'Hexano', 'hexane', 'C6H14', 'alcano'],
    ['heptano', 'Heptano', 'heptane', 'C7H16', 'alcano'], ['octano', 'Octano', 'octane', 'C8H18', 'alcano'],
    ['nonano', 'Nonano', 'nonane', 'C9H20', 'alcano'], ['decano', 'Decano', 'decane', 'C10H22', 'alcano'],
    # isómeros ramificados
    ['isobutano', '2-Metilpropano (isobutano)', 'isobutane', 'C4H10', 'isomero'],
    ['isopentano', '2-Metilbutano (isopentano)', '2-methylbutane', 'C5H12', 'isomero'],
    ['neopentano', '2,2-Dimetilpropano (neopentano)', 'neopentane', 'C5H12', 'isomero'],
    ['2-metilpentano', '2-Metilpentano', '2-methylpentane', 'C6H14', 'isomero'],
    ['3-metilpentano', '3-Metilpentano', '3-methylpentane', 'C6H14', 'isomero'],
    ['2,2-dimetilbutano', '2,2-Dimetilbutano', '2,2-dimethylbutane', 'C6H14', 'isomero'],
    ['2,3-dimetilbutano', '2,3-Dimetilbutano', '2,3-dimethylbutane', 'C6H14', 'isomero'],
    ['isooctano', '2,2,4-Trimetilpentano (isooctano)', '2,2,4-trimethylpentane', 'C8H18', 'isomero'],
    # alquenos (but-1-eno … dec-1-eno) e isómeros geométricos
    ['eteno', 'Eteno (etileno)', 'ethylene', 'C2H4', 'alqueno'], ['propeno', 'Propeno (propileno)', 'propene', 'C3H6', 'alqueno'],
    ['but-1-eno', 'But-1-eno', '1-butene', 'C4H8', 'alqueno'], ['pent-1-eno', 'Pent-1-eno', '1-pentene', 'C5H10', 'alqueno'],
    ['hex-1-eno', 'Hex-1-eno', '1-hexene', 'C6H12', 'alqueno'], ['hept-1-eno', 'Hept-1-eno', '1-heptene', 'C7H14', 'alqueno'],
    ['oct-1-eno', 'Oct-1-eno', '1-octene', 'C8H16', 'alqueno'], ['non-1-eno', 'Non-1-eno', '1-nonene', 'C9H18', 'alqueno'],
    ['dec-1-eno', 'Dec-1-eno', '1-decene', 'C10H20', 'alqueno'],
    ['cis-but-2-eno', '(Z)-But-2-eno (cis-but-2-eno)', 'cis-2-butene', 'C4H8', 'geometrico'],
    ['trans-but-2-eno', '(E)-But-2-eno (trans-but-2-eno)', 'trans-2-butene', 'C4H8', 'geometrico'],
    ['isobuteno', '2-Metilpropeno (isobutileno)', 'isobutylene', 'C4H8', 'isomero'],
    ['buta-1,3-dieno', 'Buta-1,3-dieno', '1,3-butadiene', 'C4H6', 'alqueno'],
    # alquinos
    ['etino', 'Etino (acetileno)', 'acetylene', 'C2H2', 'alquino'], ['propino', 'Propino', 'propyne', 'C3H4', 'alquino'],
    ['but-1-ino', 'But-1-ino', '1-butyne', 'C4H6', 'alquino'], ['but-2-ino', 'But-2-ino', '2-butyne', 'C4H6', 'alquino'],
    ['pent-1-ino', 'Pent-1-ino', '1-pentyne', 'C5H8', 'alquino'], ['hex-1-ino', 'Hex-1-ino', '1-hexyne', 'C6H10', 'alquino'],
    ['hept-1-ino', 'Hept-1-ino', '1-heptyne', 'C7H12', 'alquino'], ['oct-1-ino', 'Oct-1-ino', '1-octyne', 'C8H14', 'alquino'],
    ['non-1-ino', 'Non-1-ino', '1-nonyne', 'C9H16', 'alquino'], ['dec-1-ino', 'Dec-1-ino', '1-decyne', 'C10H18', 'alquino'],
    # cíclicos de comparación
    ['ciclohexano', 'Ciclohexano', 'cyclohexane', 'C6H12', 'ciclico'], ['ciclohexeno', 'Ciclohexeno', 'cyclohexene', 'C6H10', 'ciclico'],
    ['ciclohexa-1,3-dieno', 'Ciclohexa-1,3-dieno', '1,3-cyclohexadiene', 'C6H8', 'ciclico'],
    # productos de reacciones de hidrocarburos
    ['clorometano', 'Clorometano', 'chloromethane', 'CH3Cl', 'producto'], ['diclorometano', 'Diclorometano', 'dichloromethane', 'CH2Cl2', 'producto'],
    ['1,2-dibromoetano', '1,2-Dibromoetano', '1,2-dibromoethane', 'C2H4Br2', 'producto'], ['bromoetano', 'Bromoetano', 'bromoethane', 'C2H5Br', 'producto'],
    ['2-bromopropano', '2-Bromopropano', '2-bromopropane', 'C3H7Br', 'producto'], ['1-bromopropano', '1-Bromopropano', '1-bromopropane', 'C3H7Br', 'producto'],
    ['bromo', 'Bromo (dibromo)', 'bromine', 'Br2', 'reactivo'],
    # aromáticos
    ['benceno', 'Benceno', 'benzene', 'C6H6', 'aromatico'], ['tolueno', 'Tolueno (metilbenceno)', 'toluene', 'C7H8', 'aromatico'],
    ['o-xileno', 'o-Xileno (1,2-dimetilbenceno)', 'o-xylene', 'C8H10', 'aromatico'], ['m-xileno', 'm-Xileno (1,3-dimetilbenceno)', 'm-xylene', 'C8H10', 'aromatico'],
    ['p-xileno', 'p-Xileno (1,4-dimetilbenceno)', 'p-xylene', 'C8H10', 'aromatico'], ['etilbenceno', 'Etilbenceno', 'ethylbenzene', 'C8H10', 'aromatico'],
    ['estireno', 'Estireno (etenilbenceno)', 'styrene', 'C8H8', 'aromatico'], ['naftaleno', 'Naftaleno', 'naphthalene', 'C10H8', 'aromatico'],
    ['antraceno', 'Antraceno', 'anthracene', 'C14H10', 'aromatico'],
    ['fenol', 'Fenol', 'phenol', 'C6H6O', 'aromatico'], ['clorobenceno', 'Clorobenceno', 'chlorobenzene', 'C6H5Cl', 'aromatico'],
    ['bromobenceno', 'Bromobenceno', 'bromobenzene', 'C6H5Br', 'aromatico'], ['nitrobenceno', 'Nitrobenceno', 'nitrobenzene', 'C6H5NO2', 'aromatico'],
    ['1,3,5-trimetilbenceno', '1,3,5-Trimetilbenceno (mesitileno)', 'mesitylene', 'C9H12', 'aromatico'],
    ['piridina', 'Piridina', 'pyridine', 'C5H5N', 'huckel'],
    ['ciclooctatetraeno', 'Ciclooctatetraeno', 'cyclooctatetraene', 'C8H8', 'huckel'],
    ['ciclobutadieno', 'Ciclobutadieno', 'cyclobutadiene', 'C4H4', 'huckel'],
    ['ciclopentadieno', 'Ciclopenta-1,3-dieno', 'cyclopentadiene', 'C5H6', 'huckel'],
    ['ciclopentadienuro', 'Anión ciclopentadienuro', 'smiles:[CH-]1C=CC=C1', 'C5H5-', 'huckel'],
    ['tropilio', 'Catión tropilio (cicloheptatrienilio)', 'smiles:[CH+]1C=CC=CC=C1', 'C7H7+', 'huckel'],
    ['furano', 'Furano', 'furan', 'C4H4O', 'huckel'], ['pirrol', 'Pirrol', 'pyrrole', 'C4H5N', 'huckel'],
    ['acido-nitrico', 'Ácido nítrico', 'nitric acid', 'HNO3', 'reactivo'],
]

PROPS = [('tEb', 'Boiling Point'), ('tFus', 'Melting Point'), ('densidad', 'Density'), ('dHc', 'Heat of Combustion')]

def num(s):
    return float(s.replace(',', ''))

def parse_temp(text):
    """Devuelve °C a partir del texto literal (°C, °F o K). Rangos «a to b» → promedio. None si no se puede leer con seguridad."""
    t = text.replace('deg', '°').replace('º', '°')
    m = re.match(r'^\s*(-?\d[\d,]*\.?\d*)\s*(?:to|-)\s*(-?\d[\d,]*\.?\d*)\s*°\s*([CFK])', t)
    if m:
        a, b, u = num(m.group(1)), num(m.group(2)), m.group(3)
        v = (a + b) / 2
    else:
        m = re.match(r'^\s*(-?\d[\d,]*\.?\d*)\s*°\s*([CFK])\b', t) or re.match(r'^\s*(-?\d[\d,]*\.?\d*)\s*(K)\b', t)
        if not m: return None
        v, u = num(m.group(1)), m.group(2)
    if u == 'F': v = (v - 32) * 5 / 9
    if u == 'K': v = v - 273.15
    return round(v, 2)

def parse_density(text):
    m = re.match(r'^\s*(\d*\.\d+|\d+)\s*(?:g/cu\s*cm|g/cm3|g/cm\^3|g/mL)?\s*(?:at|@)\s*(-?\d+\.?\d*)\s*°\s*C', text)
    if m: return float(m.group(1)), float(m.group(2))
    return None

def parse_hc(text):
    """Calor de combustión → kJ/mol (positivo = energía liberada). Solo se aceptan kJ/mol o kcal/mol con estado declarado o sin él."""
    out = []
    for m in re.finditer(r'(-?\d[\d,]*\.?\d*)\s*(kJ|kcal)\s*/\s*mol(?:e)?\s*(?:\(([^)]*)\))?', text):
        v = abs(num(m.group(1))) * (4.184 if m.group(2) == 'kcal' else 1)
        out.append({'kJmol': round(v, 1), 'estado': (m.group(3) or '').strip()})
    return out

def view(cid, heading):
    url = f'{VIEW}/{cid}/JSON?heading={urllib.parse.quote(heading)}'
    st, txt = get(url)
    if st != 200: return url, []
    d = json.loads(txt)
    refs = {r['ReferenceNumber']: r for r in d['Record'].get('Reference', [])}
    items = []
    def walk(s):
        for x in s.get('Section', []): walk(x)
        for i in s.get('Information', []):
            v = i.get('Value', {})
            if 'StringWithMarkup' in v: t = ' '.join(x.get('String', '') for x in v['StringWithMarkup'])
            elif 'Number' in v: t = f"{v['Number'][0]} {v.get('Unit', '')}".strip()
            else: continue
            r = refs.get(i.get('ReferenceNumber'), {})
            items.append({'texto': t, 'cita': ' '.join(i.get('Reference') or []), 'base': r.get('SourceName', ''), 'registro': r.get('Name', ''), 'urlBase': r.get('URL', '')})
    walk(d['Record'])
    return url, items

def choose(key, items):
    def parsed(it):
        if key in ('tEb', 'tFus'):
            v = parse_temp(it['texto']); return None if v is None else {'valor': v, 'unidad': '°C'}
        if key == 'densidad':
            v = parse_density(it['texto']); return None if v is None else {'valor': v[0], 'unidad': 'g/cm³', 'temperatura': v[1]}
        if key == 'dHc':
            v = parse_hc(it['texto']); return None if not v else {'valor': v[0]['kJmol'], 'unidad': 'kJ/mol', 'estado': v[0]['estado'], 'todos': v}
    hsdb = [i for i in items if i['base'].startswith('Hazardous Substances')]
    if key == 'dHc':
        # Calor de combustión: solo obras de referencia de entalpías estándar (CRC Handbook; Riddick et al., Techniques of
        # Chemistry). Otras fuentes secundarias (enciclopedias técnicas) pueden usar otra convención (p. ej., agua como vapor).
        tiers = [[i for i in hsdb if 'CRC Handbook' in i['cita']], [i for i in hsdb if 'Techniques of Chemistry' in i['cita']]]
    else:
        tiers = [[i for i in hsdb if 'CRC Handbook' in i['cita']], hsdb, items]
    for n, tier in enumerate(tiers, 1):
        for it in tier:
            p = parsed(it)
            if p: return {**p, 'texto': it['texto'], 'cita': it['cita'], 'base': it['base'], 'regla': n}
    return None

def sdf3d(cid):
    url = f'{REST}/compound/cid/{cid}/SDF?record_type=3d'
    st, txt = get(url)
    if st == 404: return url, None
    if st != 200: raise SystemExit(f'SDF {cid}: {st}')
    return url, txt

def molfile(sdf):
    return sdf.split('M  END')[0] + 'M  END\n'

def props_by_cid(cid):
    st, txt = get(f'{REST}/compound/cid/{cid}/property/MolecularFormula,SMILES,ConnectivitySMILES,IUPACName,Title/JSON')
    if st != 200: raise SystemExit(f'propiedades {cid}: {st}')
    return json.loads(txt)['PropertyTable']['Properties'][0]

def by_smiles(smi):
    data = urllib.parse.urlencode({'smiles': smi}).encode()
    st, txt = get(f'{REST}/compound/smiles/property/MolecularFormula,SMILES,ConnectivitySMILES,IUPACName,Title/JSON', data)
    if st != 200: return None
    p = json.loads(txt)['PropertyTable']['Properties'][0]
    return p if p.get('CID') else None

def hill_with_charge(p):
    return p['MolecularFormula']

def libreria():
    out = []
    for mid, nombre, query, formula, grupo in LIBRERIA:
        if query.startswith('smiles:'):
            p = by_smiles(query[7:])
            if not p: raise SystemExit(f'{mid}: sin CID para {query}')
            cid = p['CID']
        else:
            st, txt = get(f'{REST}/compound/name/{urllib.parse.quote(query)}/cids/TXT')
            if st != 200: raise SystemExit(f'{mid}: sin CID para «{query}» ({st})')
            cid = int(txt.split()[0])
        p = props_by_cid(cid)
        if p['MolecularFormula'] != formula: raise SystemExit(f"{mid}: fórmula {p['MolecularFormula']} ≠ {formula} (CID {cid})")
        url, sdf = sdf3d(cid)
        rec = {'id': mid, 'nombre': nombre, 'nombreIupac': p.get('IUPACName', ''), 'formula': p['MolecularFormula'], 'cid': cid,
               'smiles': p.get('SMILES', ''), 'title': p.get('Title', ''), 'query': query, 'categoria': 'organica', 'grupo': grupo,
               'url': url, 'fecha': FECHA, 'sha256': hashlib.sha256(sdf.encode()).hexdigest() if sdf else None, 'sdf': sdf,
               'fuente': {'url': url, 'fecha': FECHA, 'sha256': hashlib.sha256(sdf.encode()).hexdigest() if sdf else None},
               'propiedades': {}}
        for key, heading in PROPS:
            vurl, items = view(cid, heading)
            ch = choose(key, items)
            rec['propiedades'][key] = None if ch is None else {**ch, 'url': vurl, 'fecha': FECHA}
        print(f"ok {mid:24} CID {cid:<9} {p['MolecularFormula']:9} 3D={'sí' if sdf else 'no'} " +
              ' '.join(f"{k}={(v or {}).get('valor')}" for k, v in rec['propiedades'].items()), flush=True)
        out.append(rec)
    return out

# ---------------------------------------------------------------- validación del motor de nomenclatura
# [SMILES de entrada, clase]. Las estructuras se eligieron para cubrir las reglas: cadena principal, ramificaciones y sustituyentes
# compuestos, insaturaciones (incluidas E/Z), anillos, bencenos sustituidos y halógenos.
NOMENCLATURA = [s.split() for s in '''
C alcano|CC alcano|CCC alcano|CCCC alcano|CCCCC alcano|CCCCCC alcano|CCCCCCC alcano|CCCCCCCC alcano|CCCCCCCCC alcano|CCCCCCCCCC alcano
CCCCCCCCCCC alcano|CCCCCCCCCCCC alcano|CCCCCCCCCCCCCCCCCCCC alcano
CC(C)C ramificado|CCC(C)C ramificado|CC(C)(C)C ramificado|CCCC(C)C ramificado|CCC(C)CC ramificado|CCC(C)(C)C ramificado|CC(C)C(C)C ramificado
CCCCC(C)C ramificado|CCCC(C)CC ramificado|CCCC(C)(C)C ramificado|CCC(C)(C)CC ramificado|CC(C)CC(C)C ramificado|CC(C)C(C)(C)C ramificado|CCC(CC)CC ramificado|CC(C)C(C)CC ramificado
CC(C)CC(C)(C)C ramificado|CC(C)(C)C(C)(C)C ramificado|CCC(CC)(CC)CC ramificado|CCC(C)C(CC)C(C)C ramificado|CCCC(C(C)C)CCC ramificado|CCCC(CCC)C(C)(C)C ramificado
CCCCC(CC(C)C)CCCC ramificado|CCC(C)CC(CC)CC ramificado|CC(C)C(C)C(C)C ramificado|CCCCC(CC)CCC ramificado|CCC(C)C(C)CC ramificado|CCCCCC(C)C(C)(C)CC ramificado
CCCC(CC)C(C)CC ramificado|CCCCC(C(C)CC)CCCC ramificado|CCC(C)(CC)C(C)C ramificado|CCCCC(CCC)C(C)CC ramificado
C=C alqueno|CC=C alqueno|CCC=C alqueno|CC=CC alqueno|C/C=C/C alqueno|C/C=C\\C alqueno|CC(C)=C alqueno|CCCC=C alqueno|CC/C=C/C alqueno|CC/C=C\\C alqueno
CC=C(C)C alqueno|CC(C)C=C alqueno|CCC(C)=C alqueno|CCCCC=C alqueno|CC/C=C/CC alqueno|CC(C)=C(C)C alqueno|C=CC=C alqueno|CC(=C)C=C alqueno|C=CCC=C alqueno
C=C=C alqueno|CCCCCCC=C alqueno|CCCCCCCCC=C alqueno|C/C=C/C(C)C alqueno|C/C=C\\C(C)C alqueno|CCC(=C)CC alqueno|CCCC(=C)CC alqueno|C=CC(C)(C)C alqueno
C/C=C/C=C/C alqueno|CC(C)/C=C/C(C)C alqueno|CCC(=CC)CC alqueno|C=CC=CC=C alqueno|CCC(C=C)CCC alqueno
C#C alquino|CC#C alquino|CCC#C alquino|CC#CC alquino|CCCC#C alquino|CCC#CC alquino|CC(C)C#C alquino|CCCCC#C alquino|CCC#CCC alquino
CC(C)C#CC alquino|CC(C)(C)C#C alquino|C=CC#C alquino|C=CCC#C alquino|C/C=C/C#C alquino|C#CCCC#C alquino|CCCCCCC#C alquino|CCC(C#C)CC alquino
C#CC=CC=C alquino|CC#CC(C)C alquino
C1CC1 ciclico|C1CCC1 ciclico|C1CCCC1 ciclico|C1CCCCC1 ciclico|C1CCCCCC1 ciclico|C1CCCCCCC1 ciclico|C1CCCCCCCCC1 ciclico
CC1CCCCC1 ciclico|CCC1CCCC1 ciclico|CC1(C)CCCCC1 ciclico|CC1CCCCC1C ciclico|CC1CCCC(C)C1 ciclico|CC1CCC(C)CC1 ciclico|CCC1CCCC(C)C1 ciclico
CCCC1CC1 ciclico|CC(C)C1CCCCC1 ciclico|CC(C)(C)C1CCCCC1 ciclico|C1CCC=CC1 ciclico|C1CC=CC1 ciclico|CC1=CCCCC1 ciclico|CC1CCCC=C1 ciclico
CC1CCC=CC1 ciclico|C1CC=CC=C1 ciclico|C1C=CCC=C1 ciclico|C1=CC=CC=CC=C1 ciclico|C=C1CCCCC1 ciclico|C=CC1CCCCC1 ciclico|C#CC1CCCCC1 ciclico
C1CCC(CC1)C1CCCCC1 ciclico|CC1=CC=CCC1 ciclico|CC1CCCC1C ciclico|CCCCC1CCCCC1 ciclico|CC1CC1 ciclico
c1ccccc1 aromatico|Cc1ccccc1 aromatico|CCc1ccccc1 aromatico|CCCc1ccccc1 aromatico|CC(C)c1ccccc1 aromatico|CCCCc1ccccc1 aromatico
CC(C)(C)c1ccccc1 aromatico|Cc1ccccc1C aromatico|Cc1cccc(C)c1 aromatico|Cc1ccc(C)cc1 aromatico|Cc1cc(C)cc(C)c1 aromatico|Cc1ccc(C)c(C)c1 aromatico
C=Cc1ccccc1 aromatico|C#Cc1ccccc1 aromatico|CCc1ccc(C)cc1 aromatico|CCc1ccccc1C aromatico|C1CCC(CC1)c1ccccc1 aromatico|C1CC1c1ccccc1 aromatico
CCc1cccc(CC)c1 aromatico|CC(C)c1ccc(C)cc1 aromatico|Cc1ccccc1CC(C)C aromatico|c1ccc2ccccc2c1 aromatico|Cc1c(C)c(C)c(C)c(C)c1C aromatico
CCCc1ccc(CC)cc1 aromatico|CCCCCc1ccccc1 aromatico
Clc1ccccc1 halogeno|Brc1ccccc1 halogeno|Ic1ccccc1 halogeno|Fc1ccccc1 halogeno|Clc1ccccc1Cl halogeno|Clc1ccc(Cl)cc1 halogeno|Clc1ccc(Br)cc1 halogeno
Cc1ccc(Cl)cc1 halogeno|Cc1ccccc1Br halogeno|CCc1cccc(Cl)c1 halogeno|Clc1cc(Cl)cc(Cl)c1 halogeno|Cc1ccc(I)cc1 halogeno
CCl halogeno|ClCCl halogeno|ClC(Cl)Cl halogeno|ClC(Cl)(Cl)Cl halogeno|CCBr halogeno|BrCCBr halogeno|CC(C)Br halogeno|CCCCCl halogeno|CCC(C)Cl halogeno
CC(C)(C)Br halogeno|CC(C)CCl halogeno|CI halogeno|CCC(C)CI halogeno|CC(Br)C(C)Cl halogeno|ClCCBr halogeno|Cl/C=C/Cl halogeno|C=CCl halogeno|C=CCCl halogeno
CC(C)(Cl)CCBr halogeno|FC(F)(F)C(Cl)Br halogeno|CC(Cl)CC(C)C halogeno|ClC1CCCCC1 halogeno|BrC1CCCC1Br halogeno|ClC(Cl)=C(Cl)Cl halogeno
'''.replace('\n', '|').split('|') if s.strip()]

def nomenclatura():
    fixtures, confs = [], []
    for smi, clase in NOMENCLATURA:
        p = by_smiles(smi)
        if not p:
            print(f'SIN CID {smi}'); fixtures.append({'smilesEntrada': smi, 'clase': clase, 'cid': None}); continue
        cid = p['CID']
        rec = {'smilesEntrada': smi, 'clase': clase, 'cid': cid, 'iupacPubChem': p.get('IUPACName'), 'formula': p['MolecularFormula'],
               'smiles': p.get('SMILES'), 'smilesConectividad': p.get('ConnectivitySMILES'), 'title': p.get('Title')}
        fixtures.append(rec)
        url, sdf = sdf3d(cid)
        if sdf:
            mf = molfile(sdf)
            confs.append({'id': f'cid-{cid}', 'nombre': p.get('Title', ''), 'nombreIupac': p.get('IUPACName', ''), 'formula': p['MolecularFormula'],
                          'cid': cid, 'smiles': p.get('SMILES', ''), 'title': p.get('Title', ''), 'query': f'smiles:{smi}', 'categoria': 'organica',
                          'url': url, 'fecha': FECHA, 'sha256': hashlib.sha256(sdf.encode()).hexdigest(), 'sdfRecortado': True,
                          'sha256Molfile': hashlib.sha256(mf.encode()).hexdigest(), 'sdf': mf,
                          'fuente': {'url': url, 'fecha': FECHA, 'sha256': hashlib.sha256(sdf.encode()).hexdigest()}})
        print(f"{cid:<9} {smi:28} {p.get('IUPACName')}  3D={'sí' if sdf else 'no'}", flush=True)
    return fixtures, confs

def dump(path, obj, meta):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        json.dump({'_generado': meta, **obj}, f, ensure_ascii=False, indent=0 if 'fixtures' in path else None, separators=(',', ':') if 'fixtures' not in path else None)
        f.write('\n')
    print('→', path, os.path.getsize(full), 'bytes')

if __name__ == '__main__':
    parts = sys.argv[1:] or ['libreria', 'nomenclatura']
    meta = f'scripts/validacion/organica_pubchem.py el {FECHA} (PubChem PUG REST y PUG View); no editar a mano'
    if 'libreria' in parts:
        dump('src/data/quimica/organica-moleculas.json', {'moleculas': libreria()}, meta)
    if 'nomenclatura' in parts:
        fx, cf = nomenclatura()
        dump('tests/fixtures/pubchem-nomenclatura.json', {'motorIupac': 'PubChem IUPACName (calculado con LexiChem TK de OpenEye)', 'fecha': FECHA, 'estructuras': fx}, meta)
        dump('src/data/quimica/organica-nomenclatura.json', {'conformeros': cf}, meta)
