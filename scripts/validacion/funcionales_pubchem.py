#!/usr/bin/env python3
"""
Descarga reproducible de los datos de las prácticas de funciones orgánicas oxigenadas, nitrogenadas y reacciones orgánicas
(grupos-oxigenados, grupos-nitrogenados, reacciones-organicas). Todo sale de consultas reales a PubChem (NCBI); nada se escribe a mano.

  1) Biblioteca (LIBRERIA): nombre en inglés → CID con PUG REST /compound/name/<nombre>/cids/TXT (primer CID); se VERIFICA la fórmula de
     Hill esperada (si no coincide, el script se detiene).
       propiedades  /compound/cid/<CID>/property/MolecularFormula,MolecularWeight,SMILES,ConnectivitySMILES,IUPACName,Title/JSON
       confórmero   /compound/cid/<CID>/SDF?record_type=3d  (404 → «sin 3D»: nunca se dibuja a mano). Se guarda el bloque molfile
                    (hasta «M  END») con el SHA-256 del archivo COMPLETO descargado y el del bloque guardado.
       PUG View     /rest/pug_view/data/compound/<CID>/JSON?heading=<…> para Boiling Point, Melting Point, Solubility, Dissociation
                    Constants, Heat of Combustion y Density. Regla de selección FIJA: 1.º Hazardous Substances Data Bank (HSDB) citando el
                    «CRC Handbook of Chemistry and Physics»; 2.º otra entrada legible de HSDB; 3.º la primera entrada legible de otra base.
                    Excepciones documentadas: el calor de combustión SOLO se acepta de HSDB citando el CRC Handbook (entalpía estándar a
                    25 °C); la solubilidad prefiere el texto «In water, …» de HSDB; el pKa solo se toma si el texto dice «pKa» o «pKb»
                    (o es un número solo con referencia de Serjeant/Perrin/Riddick en HSDB/DrugBank). Se guarda el texto literal, la obra
                    citada, la base de origen, la URL de PUG View y la fecha.
  2) Validación del motor de nomenclatura de funciones (NOMENCLATURA): SMILES escrito a mano → PubChem
       POST /compound/smiles/property/IUPACName,MolecularFormula,SMILES,Title/JSON
     El IUPACName de PubChem lo calcula LexiChem TK (OpenEye); se guarda tal cual con la fecha.

Salidas (generadas; no editar a mano):
  src/data/quimica/funcionales-moleculas.json      biblioteca (formato común del kit + propiedades experimentales con fuente)
  tests/fixtures/funcionales-nomenclatura.json     SMILES → CID, IUPACName (LexiChem) para las pruebas del motor

Uso: python3 -I scripts/validacion/funcionales_pubchem.py   (≤ 4 solicitudes por segundo, política de uso de PubChem)
     FUNC_CACHE=<directorio> guarda/reutiliza las respuestas crudas (solo para depurar; la salida registra la fecha de la consulta).
"""
import hashlib, json, os, re, sys, time, urllib.parse, urllib.request, urllib.error, datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
REST = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound'
UA = {'User-Agent': 'laboratorio-virtual-ciencias (scripts/validacion/funcionales_pubchem.py)'}
FECHA = datetime.date.today().isoformat()
CACHE = os.environ.get('FUNC_CACHE')
_last = [0.0]


def get(url, data=None):
    key = None
    if CACHE:
        os.makedirs(CACHE, exist_ok=True)
        key = os.path.join(CACHE, hashlib.sha1((url + (data.decode() if data else '')).encode()).hexdigest())
        if os.path.exists(key):
            with open(key, encoding='utf-8') as f:
                st, txt = f.read().split('\n', 1)
                return int(st), txt
    for i in range(5):
        wait = _last[0] + 0.26 - time.time()
        if wait > 0: time.sleep(wait)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                out = (r.status, r.read().decode('utf-8'))
                break
        except urllib.error.HTTPError as e:
            if e.code in (429, 503, 504): time.sleep(2 * (i + 1)); continue
            out = (e.code, e.read().decode('utf-8', 'replace'))
            break
        except Exception:
            time.sleep(2 * (i + 1))
    else:
        raise SystemExit(f'PubChem no respondió: {url}')
    if key:
        with open(key, 'w', encoding='utf-8') as f: f.write(f'{out[0]}\n{out[1]}')
    return out


# ---------------------------------------------------------------- biblioteca
# [id, nombre en español, búsqueda en inglés, fórmula de Hill esperada, grupo]
LIBRERIA = [
    # alcanos de comparación
    ['metano', 'Metano', 'methane', 'CH4', 'alcano'], ['etano', 'Etano', 'ethane', 'C2H6', 'alcano'],
    ['propano', 'Propano', 'propane', 'C3H8', 'alcano'], ['butano', 'Butano', 'butane', 'C4H10', 'alcano'],
    ['pentano', 'Pentano', 'pentane', 'C5H12', 'alcano'], ['hexano', 'Hexano', 'hexane', 'C6H14', 'alcano'],
    ['heptano', 'Heptano', 'heptane', 'C7H16', 'alcano'], ['octano', 'Octano', 'octane', 'C8H18', 'alcano'],
    # alcoholes
    ['metanol', 'Metanol', 'methanol', 'CH4O', 'alcohol'], ['etanol', 'Etanol', 'ethanol', 'C2H6O', 'alcohol'],
    ['propan-1-ol', 'Propan-1-ol', '1-propanol', 'C3H8O', 'alcohol'], ['butan-1-ol', 'Butan-1-ol', '1-butanol', 'C4H10O', 'alcohol'],
    ['pentan-1-ol', 'Pentan-1-ol', '1-pentanol', 'C5H12O', 'alcohol'], ['hexan-1-ol', 'Hexan-1-ol', '1-hexanol', 'C6H14O', 'alcohol'],
    ['heptan-1-ol', 'Heptan-1-ol', '1-heptanol', 'C7H16O', 'alcohol'], ['octan-1-ol', 'Octan-1-ol', '1-octanol', 'C8H18O', 'alcohol'],
    ['propan-2-ol', 'Propan-2-ol (isopropanol)', '2-propanol', 'C3H8O', 'alcohol'], ['butan-2-ol', 'Butan-2-ol', '2-butanol', 'C4H10O', 'alcohol'],
    ['2-metilpropan-1-ol', '2-Metilpropan-1-ol', 'isobutanol', 'C4H10O', 'alcohol'],
    ['2-metilpropan-2-ol', '2-Metilpropan-2-ol (terc-butanol)', 'tert-butanol', 'C4H10O', 'alcohol'],
    ['ciclohexanol', 'Ciclohexanol', 'cyclohexanol', 'C6H12O', 'alcohol'], ['etano-1,2-diol', 'Etano-1,2-diol (etilenglicol)', 'ethylene glycol', 'C2H6O2', 'alcohol'],
    ['glicerol', 'Propano-1,2,3-triol (glicerol)', 'glycerol', 'C3H8O3', 'alcohol'], ['fenilmetanol', 'Fenilmetanol (alcohol bencílico)', 'benzyl alcohol', 'C7H8O', 'alcohol'],
    # fenoles
    ['fenol', 'Fenol', 'phenol', 'C6H6O', 'fenol'], ['4-metilfenol', '4-Metilfenol (p-cresol)', 'p-cresol', 'C7H8O', 'fenol'],
    ['4-nitrofenol', '4-Nitrofenol', '4-nitrophenol', 'C6H5NO3', 'fenol'], ['4-clorofenol', '4-Clorofenol', '4-chlorophenol', 'C6H5ClO', 'fenol'],
    # éteres
    ['metoximetano', 'Metoximetano (éter dimetílico)', 'dimethyl ether', 'C2H6O', 'eter'], ['metoxietano', 'Metoxietano', 'methyl ethyl ether', 'C3H8O', 'eter'],
    ['etoxietano', 'Etoxietano (éter dietílico)', 'diethyl ether', 'C4H10O', 'eter'], ['1-metoxipropano', '1-Metoxipropano', '1-methoxypropane', 'C4H10O', 'eter'],
    ['metoxibenceno', 'Metoxibenceno (anisol)', 'anisole', 'C7H8O', 'eter'],
    # aldehídos
    ['metanal', 'Metanal (formaldehído)', 'formaldehyde', 'CH2O', 'aldehido'], ['etanal', 'Etanal (acetaldehído)', 'acetaldehyde', 'C2H4O', 'aldehido'],
    ['propanal', 'Propanal', 'propanal', 'C3H6O', 'aldehido'], ['butanal', 'Butanal', 'butanal', 'C4H8O', 'aldehido'],
    ['pentanal', 'Pentanal', 'pentanal', 'C5H10O', 'aldehido'], ['benzaldehido', 'Benzaldehído', 'benzaldehyde', 'C7H6O', 'aldehido'],
    # cetonas
    ['propanona', 'Propan-2-ona (acetona)', 'acetone', 'C3H6O', 'cetona'], ['butanona', 'Butan-2-ona', '2-butanone', 'C4H8O', 'cetona'],
    ['pentan-2-ona', 'Pentan-2-ona', '2-pentanone', 'C5H10O', 'cetona'], ['pentan-3-ona', 'Pentan-3-ona', '3-pentanone', 'C5H10O', 'cetona'],
    ['ciclohexanona', 'Ciclohexanona', 'cyclohexanone', 'C6H10O', 'cetona'], ['acetofenona', '1-Feniletan-1-ona (acetofenona)', 'acetophenone', 'C8H8O', 'cetona'],
    # ácidos carboxílicos
    ['acido-metanoico', 'Ácido metanoico (fórmico)', 'formic acid', 'CH2O2', 'acido'], ['acido-etanoico', 'Ácido etanoico (acético)', 'acetic acid', 'C2H4O2', 'acido'],
    ['acido-propanoico', 'Ácido propanoico', 'propionic acid', 'C3H6O2', 'acido'], ['acido-butanoico', 'Ácido butanoico', 'butyric acid', 'C4H8O2', 'acido'],
    ['acido-pentanoico', 'Ácido pentanoico', 'valeric acid', 'C5H10O2', 'acido'], ['acido-hexanoico', 'Ácido hexanoico', 'hexanoic acid', 'C6H12O2', 'acido'],
    ['acido-benzoico', 'Ácido benzoico', 'benzoic acid', 'C7H6O2', 'acido'], ['acido-cloroacetico', 'Ácido cloroacético', 'chloroacetic acid', 'C2H3ClO2', 'acido'],
    ['acido-dicloroacetico', 'Ácido dicloroacético', 'dichloroacetic acid', 'C2H2Cl2O2', 'acido'],
    ['acido-tricloroacetico', 'Ácido tricloroacético', 'trichloroacetic acid', 'C2HCl3O2', 'acido'],
    ['acido-lactico', 'Ácido 2-hidroxipropanoico (láctico)', 'lactic acid', 'C3H6O3', 'acido'],
    ['acido-salicilico', 'Ácido 2-hidroxibenzoico (salicílico)', 'salicylic acid', 'C7H6O3', 'acido'],
    # ésteres
    ['metanoato-de-metilo', 'Metanoato de metilo (formiato de metilo)', 'methyl formate', 'C2H4O2', 'ester'],
    ['acetato-de-metilo', 'Acetato de metilo', 'methyl acetate', 'C3H6O2', 'ester'], ['acetato-de-etilo', 'Acetato de etilo', 'ethyl acetate', 'C4H8O2', 'ester'],
    ['butanoato-de-etilo', 'Butanoato de etilo', 'ethyl butyrate', 'C6H12O2', 'ester'],
    ['acetato-de-isoamilo', 'Acetato de 3-metilbutilo (acetato de isoamilo)', 'isoamyl acetate', 'C7H14O2', 'ester'],
    ['benzoato-de-metilo', 'Benzoato de metilo', 'methyl benzoate', 'C8H8O2', 'ester'],
    ['salicilato-de-metilo', '2-Hidroxibenzoato de metilo (salicilato de metilo)', 'methyl salicylate', 'C8H8O3', 'ester'],
    ['aspirina', 'Ácido 2-(acetiloxi)benzoico (ácido acetilsalicílico)', 'aspirin', 'C9H8O4', 'ester'],
    ['triacetina', 'Triacetato de glicerilo (triacetina)', 'triacetin', 'C9H14O6', 'ester'],
    # aminas
    ['amoniaco', 'Amoníaco', 'ammonia', 'H3N', 'amina'], ['metanamina', 'Metanamina (metilamina)', 'methylamine', 'CH5N', 'amina'],
    ['etanamina', 'Etanamina (etilamina)', 'ethylamine', 'C2H7N', 'amina'], ['propan-1-amina', 'Propan-1-amina (propilamina)', 'propylamine', 'C3H9N', 'amina'],
    ['butan-1-amina', 'Butan-1-amina', 'butylamine', 'C4H11N', 'amina'],
    ['dimetilamina', 'N-Metilmetanamina (dimetilamina)', 'dimethylamine', 'C2H7N', 'amina'],
    ['trimetilamina', 'N,N-Dimetilmetanamina (trimetilamina)', 'trimethylamine', 'C3H9N', 'amina'],
    ['n-metiletanamina', 'N-Metiletanamina', 'N-methylethylamine', 'C3H9N', 'amina'],
    ['dietilamina', 'N-Etiletanamina (dietilamina)', 'diethylamine', 'C4H11N', 'amina'],
    ['trietilamina', 'N,N-Dietiletanamina (trietilamina)', 'triethylamine', 'C6H15N', 'amina'],
    ['anilina', 'Anilina (bencenamina)', 'aniline', 'C6H7N', 'amina'], ['4-metilanilina', '4-Metilanilina (p-toluidina)', 'p-toluidine', 'C7H9N', 'amina'],
    ['4-nitroanilina', '4-Nitroanilina', '4-nitroaniline', 'C6H6N2O2', 'amina'], ['ciclohexanamina', 'Ciclohexanamina', 'cyclohexylamine', 'C6H13N', 'amina'],
    ['fenilmetanamina', 'Fenilmetanamina (bencilamina)', 'benzylamine', 'C7H9N', 'amina'],
    # amidas y moléculas biológicas
    ['formamida', 'Formamida', 'formamide', 'CH3NO', 'amida'], ['acetamida', 'Acetamida (etanamida)', 'acetamide', 'C2H5NO', 'amida'],
    ['propanamida', 'Propanamida', 'propanamide', 'C3H7NO', 'amida'], ['n-metilacetamida', 'N-Metilacetamida', 'N-methylacetamide', 'C3H7NO', 'amida'],
    ['dmf', 'N,N-Dimetilformamida', 'N,N-dimethylformamide', 'C3H7NO', 'amida'], ['benzamida', 'Benzamida', 'benzamide', 'C7H7NO', 'amida'],
    ['urea', 'Urea', 'urea', 'CH4N2O', 'amida'], ['paracetamol', 'N-(4-Hidroxifenil)acetamida (paracetamol)', 'acetaminophen', 'C8H9NO2', 'amida'],
    ['glicina', 'Glicina (ácido aminoacético)', 'glycine', 'C2H5NO2', 'aminoacido'], ['alanina', 'L-Alanina', 'L-alanine', 'C3H7NO2', 'aminoacido'],
    ['glicilglicina', 'Glicilglicina (dipéptido)', 'glycylglycine', 'C4H8N2O3', 'aminoacido'],
    # especies de las reacciones (y datos de combustión para la ley de Hess)
    ['hidrogeno', 'Hidrógeno (H₂)', 'hydrogen', 'H2', 'reactivo'], ['monoxido-de-carbono', 'Monóxido de carbono', 'carbon monoxide', 'CO', 'reactivo'],
    ['eteno', 'Eteno (etileno)', 'ethylene', 'C2H4', 'reactivo'], ['propeno', 'Propeno', 'propene', 'C3H6', 'reactivo'],
    ['bromo', 'Bromo (Br₂)', 'bromine', 'Br2', 'reactivo'], ['clorometano', 'Clorometano', 'chloromethane', 'CH3Cl', 'reactivo'],
    ['1,2-dibromoetano', '1,2-Dibromoetano', '1,2-dibromoethane', 'C2H4Br2', 'reactivo'], ['2-bromopropano', '2-Bromopropano', '2-bromopropane', 'C3H7Br', 'reactivo'],
    ['1-bromopropano', '1-Bromopropano', '1-bromopropane', 'C3H7Br', 'reactivo'], ['benceno', 'Benceno', 'benzene', 'C6H6', 'reactivo'],
    ['ciclohexeno', 'Ciclohexeno', 'cyclohexene', 'C6H10', 'reactivo'], ['ciclohexano', 'Ciclohexano', 'cyclohexane', 'C6H12', 'reactivo'],
    ['nitrobenceno', 'Nitrobenceno', 'nitrobenzene', 'C6H5NO2', 'reactivo'], ['glucosa', 'D-Glucosa', 'D-glucose', 'C6H12O6', 'reactivo'],
]

# ---------------------------------------------------------------- validación de nomenclatura: [SMILES, clase]
NOMENCLATURA = [
    # alcoholes
    ['CO', 'alcohol'], ['CCO', 'alcohol'], ['CCCO', 'alcohol'], ['CC(C)O', 'alcohol'], ['CCCCO', 'alcohol'], ['CCC(C)O', 'alcohol'],
    ['CC(C)CO', 'alcohol'], ['CC(C)(C)O', 'alcohol'], ['CCCCCO', 'alcohol'], ['CCCC(C)O', 'alcohol'], ['CCC(O)CC', 'alcohol'],
    ['CC(C)CCO', 'alcohol'], ['CCCCCCO', 'alcohol'], ['CCCCCCCO', 'alcohol'], ['CCCCCCCCO', 'alcohol'], ['OCCO', 'alcohol'],
    ['CC(O)CO', 'alcohol'], ['OCC(O)CO', 'alcohol'], ['OC1CCCCC1', 'alcohol'], ['CC1CCCCC1O', 'alcohol'], ['C=CCO', 'alcohol'],
    ['C#CCO', 'alcohol'], ['OCc1ccccc1', 'alcohol'], ['OCCc1ccccc1', 'alcohol'], ['ClCCO', 'alcohol'], ['CCC(C)(C)O', 'alcohol'],
    ['CC(O)C(C)O', 'alcohol'], ['OCCCCO', 'alcohol'], ['OC1CCCC1', 'alcohol'], ['CC(C)(O)C(C)(C)O', 'alcohol'],
    # fenoles
    ['Oc1ccccc1', 'fenol'], ['Cc1ccc(O)cc1', 'fenol'], ['Cc1ccccc1O', 'fenol'], ['Oc1ccc(cc1)[N+](=O)[O-]', 'fenol'], ['Oc1ccc(Cl)cc1', 'fenol'],
    ['Oc1ccccc1O', 'fenol'], ['Oc1cccc(O)c1', 'fenol'], ['Oc1ccc(O)cc1', 'fenol'], ['Oc1ccc(Br)cc1Br', 'fenol'],
    # éteres
    ['COC', 'eter'], ['CCOC', 'eter'], ['CCOCC', 'eter'], ['CCCOC', 'eter'], ['CCCCOCCCC', 'eter'], ['COc1ccccc1', 'eter'],
    ['CCOc1ccccc1', 'eter'], ['COCCO', 'eter'], ['CC(C)OC(C)C', 'eter'], ['COC(C)(C)C', 'eter'], ['c1ccc(Oc2ccccc2)cc1', 'eter'],
    # aldehídos
    ['C=O', 'aldehido'], ['CC=O', 'aldehido'], ['CCC=O', 'aldehido'], ['CCCC=O', 'aldehido'], ['CC(C)C=O', 'aldehido'], ['CCCCC=O', 'aldehido'],
    ['CCCCCC=O', 'aldehido'], ['O=Cc1ccccc1', 'aldehido'], ['C=CC=O', 'aldehido'], ['CC=CC=O', 'aldehido'], ['O=CC1CCCCC1', 'aldehido'],
    ['OCC=O', 'aldehido'], ['O=CCCC=O', 'aldehido'], ['COc1ccc(C=O)cc1', 'aldehido'], ['CC(C=O)Cl', 'aldehido'],
    # cetonas
    ['CC(C)=O', 'cetona'], ['CCC(C)=O', 'cetona'], ['CCCC(C)=O', 'cetona'], ['CCC(=O)CC', 'cetona'], ['CC(C)C(C)=O', 'cetona'], ['O=C1CCCCC1', 'cetona'],
    ['CC(=O)c1ccccc1', 'cetona'], ['O=C(c1ccccc1)c1ccccc1', 'cetona'], ['CC(=O)C(C)=O', 'cetona'], ['CC(=O)CC(C)=O', 'cetona'], ['C=CC(C)=O', 'cetona'],
    ['CC1CCCC(=O)C1', 'cetona'], ['O=C1CCCC1', 'cetona'], ['CC(=O)CO', 'cetona'], ['CC(=O)CCl', 'cetona'], ['CCCCCC(C)=O', 'cetona'],
    # ácidos carboxílicos
    ['OC=O', 'acido'], ['CC(O)=O', 'acido'], ['CCC(O)=O', 'acido'], ['CCCC(O)=O', 'acido'], ['CC(C)C(O)=O', 'acido'], ['CCCCC(O)=O', 'acido'],
    ['CCCCCC(O)=O', 'acido'], ['OC(=O)c1ccccc1', 'acido'], ['OC(=O)CCl', 'acido'], ['OC(=O)C(Cl)Cl', 'acido'], ['OC(=O)C(Cl)(Cl)Cl', 'acido'],
    ['CC(O)C(O)=O', 'acido'], ['OC(=O)C(O)=O', 'acido'], ['OC(=O)CC(O)=O', 'acido'], ['OC(=O)CCCCC(O)=O', 'acido'], ['C=CC(O)=O', 'acido'],
    ['OC(=O)c1ccccc1O', 'acido'], ['OC(=O)Cc1ccccc1', 'acido'], ['OC(=O)C1CCCCC1', 'acido'], ['CC(=O)C(O)=O', 'acido'], ['OCC(O)=O', 'acido'],
    ['OC(=O)c1ccc(cc1)C(O)=O', 'acido'], ['CCCCCCCCCCCCCCCCCC(O)=O', 'acido'], ['OC(=O)c1ccc(cc1)[N+](=O)[O-]', 'acido'], ['CC(Br)C(O)=O', 'acido'],
    # ésteres
    ['COC=O', 'ester'], ['COC(C)=O', 'ester'], ['CCOC(C)=O', 'ester'], ['CCCOC(C)=O', 'ester'], ['CC(C)OC(C)=O', 'ester'], ['CC(C)CCOC(C)=O', 'ester'],
    ['CCOC(=O)CC', 'ester'], ['CCCC(=O)OCC', 'ester'], ['CCCC(=O)OC', 'ester'], ['COC(=O)c1ccccc1', 'ester'], ['CCOC(=O)c1ccccc1', 'ester'],
    ['CC(=O)Oc1ccccc1', 'ester'], ['COC(=O)c1ccccc1O', 'ester'], ['CC(=O)OCc1ccccc1', 'ester'], ['C=CC(=O)OC', 'ester'], ['CC(=O)Oc1ccccc1C(O)=O', 'ester'],
    ['CCCCOC(C)=O', 'ester'], ['CCOC=O', 'ester'], ['COC(=O)C1CCCCC1', 'ester'],
    # aminas
    ['CN', 'amina'], ['CCN', 'amina'], ['CCCN', 'amina'], ['CCCCN', 'amina'], ['CC(C)N', 'amina'], ['CNC', 'amina'], ['CN(C)C', 'amina'],
    ['CCNCC', 'amina'], ['CCN(CC)CC', 'amina'], ['CCNC', 'amina'], ['CCCNC', 'amina'], ['Nc1ccccc1', 'amina'], ['CNc1ccccc1', 'amina'],
    ['CN(C)c1ccccc1', 'amina'], ['Cc1ccc(N)cc1', 'amina'], ['Nc1ccc(cc1)[N+](=O)[O-]', 'amina'], ['NC1CCCCC1', 'amina'], ['NCc1ccccc1', 'amina'],
    ['NCCN', 'amina'], ['NCCO', 'amina'], ['c1ccc(Nc2ccccc2)cc1', 'amina'], ['NCCCCCN', 'amina'], ['CC(C)(C)N', 'amina'], ['CCN(C)C', 'amina'],
    ['Nc1ccc(Cl)cc1', 'amina'], ['CC(N)CC', 'amina'],
    # amidas y aminoácidos
    ['NC=O', 'amida'], ['CC(N)=O', 'amida'], ['CCC(N)=O', 'amida'], ['CNC(C)=O', 'amida'], ['CN(C)C=O', 'amida'], ['CN(C)C(C)=O', 'amida'],
    ['NC(=O)c1ccccc1', 'amida'], ['CC(=O)Nc1ccccc1', 'amida'], ['CC(=O)Nc1ccc(O)cc1', 'amida'], ['NC(N)=O', 'amida'], ['CCCC(N)=O', 'amida'],
    ['CNC=O', 'amida'], ['NC(=O)C1CCCCC1', 'amida'], ['NC(=O)CCl', 'amida'], ['CCNC(=O)CC', 'amida'],
    ['NCC(O)=O', 'aminoacido'], ['CC(N)C(O)=O', 'aminoacido'], ['NCC(=O)NCC(O)=O', 'aminoacido'], ['CC(C)C(N)C(O)=O', 'aminoacido'],
    ['OCC(N)C(O)=O', 'aminoacido'], ['NC(Cc1ccccc1)C(O)=O', 'aminoacido'],
    # halógenos y nitro (sin grupo principal)
    ['CC[N+]([O-])=O', 'otro'], ['ClC(Cl)Cl', 'otro'], ['CCBr', 'otro'], ['[O-][N+](=O)c1ccccc1', 'otro'],
]

# ---------------------------------------------------------------- utilidades de PUG View
NUM = r'(?<![\d.,])[-−–]?\d+(?:\.\d+)?'
RANGE = r'(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)'


def view(cid, heading):
    url = f'{VIEW}/{cid}/JSON?heading={urllib.parse.quote(heading)}'
    st, txt = get(url)
    if st != 200: return url, []
    d = json.loads(txt)
    refs = {r['ReferenceNumber']: r for r in d['Record'].get('Reference', [])}
    out = []

    def walk(s):
        for x in s.get('Section', []):
            for info in x.get('Information', []):
                v = info.get('Value', {})
                text = ' '.join(m.get('String', '') for m in v.get('StringWithMarkup', [])).strip()
                if not text and 'Number' in v:
                    text = ' '.join(str(n) for n in v['Number']) + (' ' + v.get('Unit', '') if v.get('Unit') else '')
                if not text: continue
                ref = refs.get(info.get('ReferenceNumber'), {})
                out.append({'text': text, 'cita': (info.get('Reference') or [''])[0], 'base': ref.get('SourceName', '')})
            walk(x)
    walk(d['Record'])
    return url, out


def rank(entries, accept):
    """Regla fija: HSDB con CRC → otra HSDB → otra base; dentro de cada nivel, el orden de PubChem."""
    tiers = [[], [], []]
    for e in entries:
        p = accept(e)
        if p is None: continue
        hsdb = 'Hazardous Substances' in e['base']
        crc = 'CRC Handbook' in e['cita']
        tiers[0 if hsdb and crc else 1 if hsdb else 2].append((e, p))
    def off(p):
        T = p.get('temperatura') if isinstance(p, dict) else None
        return 0 if T is None or 15 <= T <= 30 else 1
    for k, t in enumerate(tiers):
        if t:
            t = sorted(t, key=lambda x: off(x[1]))  # orden estable: a igualdad, el de PubChem
            return k + 1, t[0][0], t[0][1]
    return None


def fnum(s):
    return float(s.replace('−', '-').replace('–', '-'))


def temp_c(text):
    """Temperatura en °C de un texto de punto de ebullición/fusión (°C, °F o K). Un intervalo «a–b» da el punto medio."""
    t = text.replace('deg C', '°C').replace('° C', '°C').replace('deg F', '°F').replace('°F', ' °F').replace('°C', ' °C')
    for unit, conv in (('°C', lambda v: v), ('°F', lambda v: (v - 32) * 5 / 9), ('K', lambda v: v - 273.15)):
        u = re.escape(unit) + (r'\b' if unit == 'K' else '')
        m = re.search(RANGE + r'\s*' + u, t)
        if m: return conv((fnum(m.group(1)) + fnum(m.group(2))) / 2)
        m = re.search(rf'({NUM})\s*' + u, t)
        if m: return conv(fnum(m.group(1)))
    return None


def accept_temp(e):
    t = e['text']
    if re.search(r'flash|freez|estimated|calculated|predicted|>|<|greater|less than', t, re.I): return None
    if re.search(r'sublim|mm ?Hg|kPa|torr', t, re.I) and not re.search(r'760 ?mm ?Hg|101\.3 ?kPa|1 ?atm', t, re.I):
        return None
    v = temp_c(t)
    if v is None: return None
    return {'valor': round(v, 2), 'unidad': '°C', **({'nota': 'se descompone'} if re.search(r'decompos', t, re.I) else {})}


def accept_density(e):
    t = e['text']
    m = re.search(rf'({NUM})\s*g/(?:cu ?cm|cm3|cm³|mL)', t, re.I) or re.match(rf'^\s*({NUM})\s*(?:at|@)', t)
    if not m: return None
    v = fnum(m.group(1))
    if not (0.3 < v < 3): return None
    tm = re.search(rf'(?:at|@)\s*({NUM})\s*°C', t)
    out = {'valor': v, 'unidad': 'g/cm³'}
    if tm: out['temperatura'] = fnum(tm.group(1))
    return out


def sci(s):
    s = s.replace(' ', '')
    m = re.match(r'([\d.]+)(?:[xX×]10([+-−]?\d+))?$', s)
    if not m: return None
    return float(m.group(1)) * (10 ** int(m.group(2).replace('−', '-')) if m.group(2) else 1)


def amount(s):
    """Número con separador de miles («22,000») o notación «4.6X10+4»."""
    s = s.replace(' ', '')
    if re.fullmatch(r'\d{1,3}(?:,\d{3})+(?:\.\d+)?', s): s = s.replace(',', '')
    return sci(s)


def accept_solubility(e):
    t = e['text']
    miscible = re.search(r'miscible with water|water[^.;,]{0,25}miscible|in water,? (?:\S+ )?miscible|^\s*(?:solubility in water: )?miscible\.?\s*$|/miscible/|\(miscible\)', t, re.I)
    if miscible and not re.search(r'immiscible|not miscible|partially miscible', t, re.I):
        if not re.search(r'water', t, re.I) and 'Hazardous Substances' not in e['base']: return None
        return {'tipo': 'miscible'}
    hmdb = 'Human Metabolome' in e['base']
    if not re.search(r'water', t, re.I) and not hmdb:
        return None
    if re.search(r'solubility of water in', t, re.I): return None
    tm = re.search(rf'(?:at|@)\s*({NUM})\s*°C', t)
    temp = fnum(tm.group(1)) if tm else None
    extra = {'temperatura': temp} if temp is not None else {}
    num = r'(\d{1,3}(?:,\d{3})+(?:\.\d+)?|[\d.]+\s*(?:[xX×]\s*10\s*[+-−]?\d+)?)'
    I = re.I
    if (m := re.search(num + r'\s*mg/L', t, I)) and (v := amount(m.group(1))) is not None:
        return {'tipo': 'valor', 'valor': round(v / 1000, 6), 'unidad': 'g/L', **extra}
    if (m := re.search(num + r'\s*mg/mL', t, I)) and (v := amount(m.group(1))) is not None and not re.search(r'to|>|<|greater|less', t, I):
        return {'tipo': 'valor', 'valor': v, 'unidad': 'g/L', **extra}
    if (m := re.search(num + r'\s*g/100\s*(?:mL|g|cc)', t, I)) and (v := amount(m.group(1))) is not None:
        return {'tipo': 'valor', 'valor': round(v * 10, 4), 'unidad': 'g/L', 'aprox': 'g/100 g ≈ ×10 g/L', **extra}
    if m := re.search(rf'g/100\s*ml at ({NUM})\s*°C:\s*([\d.]+)', t, I):
        return {'tipo': 'valor', 'valor': round(float(m.group(2)) * 10, 4), 'unidad': 'g/L', 'aprox': 'g/100 mL ×10', 'temperatura': fnum(m.group(1))}
    if m := re.search(rf'g/l at ({NUM})\s*°C:\s*([\d.]+)', t, I):
        return {'tipo': 'valor', 'valor': float(m.group(2)), 'unidad': 'g/L', 'temperatura': fnum(m.group(1))}
    if m := re.search(rf'in 100 ml water @ ({NUM})\s*°C:\s*([\d.]+)\s*g', t, I):
        return {'tipo': 'valor', 'valor': round(float(m.group(2)) * 10, 4), 'unidad': 'g/L', 'aprox': 'g/100 mL ×10', 'temperatura': fnum(m.group(1))}
    if m := re.search(r'([\d.]+)\s*g\s*/\s*([\d.]+)\s*ml water', t, I):
        return {'tipo': 'valor', 'valor': round(float(m.group(1)) * 1000 / float(m.group(2)), 2), 'unidad': 'g/L', 'aprox': '1 g en V mL de agua ≈ 1000/V g/L', **extra}
    if m := re.search(r'([\d.]+)\s*%\s*\(?\s*w(?:t)?\s*/\s*w', t, I):
        return {'tipo': 'valor', 'valor': round(float(m.group(1)) * 10, 4), 'unidad': 'g/L', 'aprox': '% en masa ≈ ×10 g/L', **extra}
    if m := re.search(r'([\d.]+)\s*g/L', t, I):
        return {'tipo': 'valor', 'valor': float(m.group(1)), 'unidad': 'g/L', **extra}
    return None


def accept_pka(e):
    t = e['text']
    tmp = {'temperatura': fnum(x.group(1))} if (x := re.search(rf'({NUM})\s*°C', t)) else {}
    vals = [(m.group(1), fnum(m.group(2))) for m in re.finditer(rf'pKa\s*(\d)?\s*(?:\(\d\))?\s*[=:]?\s*({NUM})', t)]
    if vals:
        conj = bool(re.search(r'conjugate acid|protonated|ammonium', t, re.I))
        out = {'tipo': 'pKa', 'valor': vals[0][1], 'acidoConjugado': conj, **tmp}
        if len(vals) > 1: out['valores'] = [v for _, v in vals]
        return out
    pkb = []
    for seg in t.split(';'):
        if m := re.search(rf'pKb\s*[=:]?\s*({NUM})', seg):
            T = re.search(rf'({NUM})\s*°C', seg)
            pkb.append((fnum(m.group(1)), fnum(T.group(1)) if T else None))
    if pkb:
        v, T = next((x for x in pkb if x[1] == 25), pkb[0])  # se prefiere el valor a 25 °C si el texto da varios
        return {'tipo': 'pKb', 'valor': v, **({'temperatura': T} if T is not None else {})}
    if re.fullmatch(rf'\s*({NUM})\s*(?:\(at 25 °C\))?\s*', t) and re.search(r'SERJEANT|PERRIN|RIDDICK|Serjeant|Perrin|Riddick', e['cita']):
        return {'tipo': 'pKa', 'valor': fnum(re.search(NUM, t).group(0)), 'acidoConjugado': False, **tmp}
    return None


REF_WORKS = r'CRC Handbook|Riddick|Ullmann'


def accept_hc(e):
    """Solo HSDB citando una obra de referencia con entalpías molares estándar (CRC Handbook, Riddick et al., Ullmann)."""
    if 'Hazardous Substances' not in e['base'] or not re.search(REF_WORKS, e['cita']): return None
    t = e['text']
    est = re.search(r'\b(gas|liquid|solid)\b', t, re.I)
    extra = {'estado': {'gas': 'gas', 'liquid': 'líquido', 'solid': 'sólido'}[est.group(1).lower()]} if est else {}
    m = re.search(rf'({NUM})\s*kJ/mol', t)
    if m: return {'valor': abs(fnum(m.group(1).replace(',', ''))), 'unidad': 'kJ/mol', **extra}
    m = re.search(rf'(-?[\d,]+(?:\.\d+)?)\s*kJ/mol', t)
    if m: return {'valor': abs(fnum(m.group(1).replace(',', ''))), 'unidad': 'kJ/mol', **extra}
    m = re.search(rf'({NUM})\s*kcal/mol', t)
    if m: return {'valor': round(abs(fnum(m.group(1))) * 4.184, 1), 'unidad': 'kJ/mol', 'conversion': '1 kcal = 4,184 kJ', **extra}
    return None


def pick(cid, heading, accept):
    url, entries = view(cid, heading)
    r = rank(entries, accept)
    if not r: return None
    regla, e, parsed = r
    return {**parsed, 'texto': e['text'][:300], 'cita': e['cita'][:300], 'base': e['base'], 'regla': regla, 'url': url, 'fecha': FECHA}


def sha(s):
    return hashlib.sha256(s.encode('utf-8')).hexdigest()


def molfile_block(sdf):
    i = sdf.find('M  END')
    return sdf[:i + 6] + '\n' if i >= 0 else sdf


# ---------------------------------------------------------------- 1) biblioteca
mols = []
for mid, nombre, query, hill, grupo in LIBRERIA:
    st, txt = get(f'{REST}/compound/name/{urllib.parse.quote(query)}/cids/TXT')
    if st != 200: raise SystemExit(f'Sin CID para {query} ({st})')
    cid = int(txt.split()[0])
    st, txt = get(f'{REST}/compound/cid/{cid}/property/MolecularFormula,MolecularWeight,SMILES,ConnectivitySMILES,IUPACName,Title/JSON')
    p = json.loads(txt)['PropertyTable']['Properties'][0]
    if p['MolecularFormula'] != hill: raise SystemExit(f'{query}: fórmula {p["MolecularFormula"]} ≠ {hill} (CID {cid})')
    sdf_url = f'{REST}/compound/cid/{cid}/SDF?record_type=3d'
    st, sdf = get(sdf_url)
    block = molfile_block(sdf) if st == 200 else None
    props = {
        'tEb': pick(cid, 'Boiling Point', accept_temp),
        'tFus': pick(cid, 'Melting Point', accept_temp),
        'densidad': pick(cid, 'Density', accept_density),
        'solubilidad': pick(cid, 'Solubility', accept_solubility),
        'pKa': pick(cid, 'Dissociation Constants', accept_pka),
        'dHc': pick(cid, 'Heat of Combustion', accept_hc),
    }
    rec = {
        'id': mid, 'nombre': nombre, 'nombreIupac': p.get('IUPACName', ''), 'formula': hill, 'cid': cid, 'smiles': p.get('SMILES', ''),
        'smilesConectividad': p.get('ConnectivitySMILES', ''), 'masaMolar': float(p['MolecularWeight']), 'title': p.get('Title', ''),
        'query': query, 'categoria': 'organica', 'grupo': grupo,
        'sdf': block, 'fuente': {'url': sdf_url, 'fecha': FECHA, 'sha256': sha(sdf) if st == 200 else None, 'sha256Bloque': sha(block) if block else None},
        'propiedades': props,
    }
    mols.append(rec)
    got = ', '.join(k for k, v in props.items() if v)
    print(f'{mid:24s} CID {cid:<9d} {hill:10s} 3D {"sí" if block else "NO"}  {got}')

with open(os.path.join(ROOT, 'src/data/quimica/funcionales-moleculas.json'), 'w', encoding='utf-8') as f:
    json.dump({'_generado': f'scripts/validacion/funcionales_pubchem.py el {FECHA} (PubChem PUG REST y PUG View); no editar a mano',
               'moleculas': mols}, f, ensure_ascii=False, separators=(',', ':'))

# ---------------------------------------------------------------- 2) nomenclatura
rows = []
for smi, clase in NOMENCLATURA:
    st, txt = get(f'{REST}/compound/smiles/property/IUPACName,MolecularFormula,SMILES,Title/JSON', data=urllib.parse.urlencode({'smiles': smi}).encode())
    if st != 200: raise SystemExit(f'PubChem no reconoció {smi}: {st} {txt[:200]}')
    p = json.loads(txt)['PropertyTable']['Properties'][0]
    if not p.get('CID'): raise SystemExit(f'{smi}: sin CID')
    rows.append({'smilesEntrada': smi, 'clase': clase, 'cid': p['CID'], 'iupacPubChem': p.get('IUPACName', ''), 'formula': p.get('MolecularFormula', ''),
                 'smiles': p.get('SMILES', ''), 'title': p.get('Title', '')})
    print(f'{smi:40s} {p["CID"]:<10d} {p.get("IUPACName", "")}')
with open(os.path.join(ROOT, 'tests/fixtures/funcionales-nomenclatura.json'), 'w', encoding='utf-8') as f:
    json.dump({'_generado': f'scripts/validacion/funcionales_pubchem.py el {FECHA}; no editar a mano', 'motorIupac': 'PubChem IUPACName (calculado con LexiChem TK de OpenEye)',
               'fecha': FECHA, 'estructuras': rows}, f, ensure_ascii=False, indent=1)
print(f'\n{len(mols)} moléculas, {len(rows)} estructuras de nomenclatura')
