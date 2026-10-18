#!/usr/bin/env node
/**
 * Rastreo génico (práctica `rastreo`, programa v2, sección 10.2): descarga y validación del conjunto curado de genes.
 *
 * Uso (requiere red; Node ≥ 22.18 para importar el .ts con «type stripping»):
 *   NODE_USE_ENV_PROXY=1 node scripts/validacion/genes_fetch.mjs --emit      # descarga y escribe src/data/genes.ts
 *   NODE_USE_ENV_PROXY=1 node scripts/validacion/genes_fetch.mjs             # vuelve a descargar y COMPARA con lo guardado
 *   ... --report docs/v2/validacion-genes.md                                 # además escribe el informe en Markdown
 *
 * Fuentes (consultas reales, sin claves): NCBI E-utilities (gene, nuccore, protein, clinvar), UniProt REST y RCSB Data API.
 * NCBI pide no más de 3 solicitudes por segundo sin clave: el script espera 400 ms entre llamadas a E-utilities.
 *
 * La validación implementa el criterio del prompt (10.2): «Los datos de la ficha coinciden con los registros originales
 * (comparación automatizada sobre el conjunto curado); los enlaces resuelven; los cambios de aminoácido de variantes de
 * ejemplo coinciden con la traducción de referencia».
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_FILE = resolve(ROOT, 'src/data/genes.ts');
const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const TODAY = new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ Conjunto curado (decisiones del equipo docente) */
// Cada gen: ID de NCBI Gene, transcrito de referencia (MANE Select cuando existe), proteína RefSeq, entrada UniProt revisada,
// entrada PDB elegida (solo si UniProt la referencia), ventana corriente arriba para buscar regiones reguladoras anotadas,
// número de oraciones de la función que se citan y variantes de ClinVar de ejemplo.
const CURATED = [
  { key: 'HBB', geneId: 3043, mrna: 'NM_000518.5', protein: 'NP_000509.1', uniprot: 'P68871', pdb: '2HHB', upstream: 1000, functionSentences: 1, variants: [15333, 15402, 36308] },
  { key: 'INS', geneId: 3630, mrna: 'NM_000207.3', protein: 'NP_000198.1', uniprot: 'P01308', pdb: '3I40', upstream: 1000, functionSentences: 1, variants: [] },
  { key: 'LCT', geneId: 3938, mrna: 'NM_002299.4', protein: 'NP_002290.2', uniprot: 'P09848', pdb: null, upstream: 1000, functionSentences: 1, variants: [7685] },
  { key: 'OCA2', geneId: 4948, mrna: 'NM_000275.3', protein: 'NP_000266.2', uniprot: 'Q04671', pdb: null, upstream: 1000, functionSentences: 1, variants: [] },
  { key: 'lacZ', geneId: 945006, mrna: null, protein: 'NP_414878.1', uniprot: 'P00722', pdb: '1DP0', upstream: 300, functionSentences: 1, variants: [] },
];
// Clases de región reguladora que interesan para la etapa «región reguladora» (transcripción), no las de replicación.
const REG_CLASSES = new Set(['promoter', 'TATA_box', 'CAAT_signal', 'GC_signal', 'enhancer', 'silencer', 'transcriptional_cis_regulatory_region', 'locus_control_region', 'response_element', 'insulator', 'enhancer_blocking_element']);
const REG_RANK = { promoter: 0, TATA_box: 0, CAAT_signal: 0, GC_signal: 0, enhancer: 1, transcriptional_cis_regulatory_region: 1, locus_control_region: 1, silencer: 2, response_element: 2 };
const MAX_REG = 5;
const REG_DOWNSTREAM = 1000;
const MAX_INTERACTIONS = 3;
const MAX_PATHWAYS = 4;

/* ------------------------------------------------------------------ Red */
let lastNcbi = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, { ncbi = false, json = false, tries = 4 } = {}) {
  for (let t = 1; ; t++) {
    if (ncbi) { const w = 400 - (Date.now() - lastNcbi); if (w > 0) await sleep(w); lastNcbi = Date.now(); }
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'laboratorio-virtual-ciencias/rastreo (educativo)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
      return json ? await r.json() : await r.text();
    } catch (e) {
      if (t >= tries) throw e;
      await sleep(1500 * t);
    }
  }
}
const eutil = (path, params) => `${EUTILS}/${path}?${new URLSearchParams(params).toString()}`;

/* ------------------------------------------------------------------ Analizadores */
/** Tabla de características de NCBI (rettype=ft). */
export function parseFeatureTable(text) {
  const feats = [];
  let cur = null;
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('>')) continue;
    const p = line.split('\t');
    if (p[0] !== '' && p.length >= 2) {
      const s = Number(p[0].replace(/[<>]/g, '')), e = Number(p[1].replace(/[<>]/g, ''));
      const partial = /[<>]/.test(p[0] + p[1]);
      if (p[2]) { cur = { key: p[2].trim(), intervals: [[s, e]], partial, quals: {} }; feats.push(cur); }
      else if (cur) { cur.intervals.push([s, e]); cur.partial ||= partial; }
    } else if (cur && p.length >= 4 && p[3]) {
      const k = p[3], v = (p[4] ?? '').trim();
      (cur.quals[k] ||= []).push(v);
    }
  }
  return feats;
}

/** Registro GenBank en texto plano: cabecera, comentario, características y secuencia. */
export function parseGenBank(text) {
  const out = { length: 0, version: '', keywords: '', comment: '', features: [], sequence: '' };
  const locus = text.match(/^LOCUS\s+\S+\s+(\d+) bp/m); if (locus) out.length = Number(locus[1]);
  const ver = text.match(/^VERSION\s+(\S+)/m); if (ver) out.version = ver[1];
  const kw = text.match(/^KEYWORDS\s+([\s\S]*?)\n(?=\S)/m); if (kw) out.keywords = kw[1].replace(/\s+/g, ' ').trim();
  const cm = text.match(/^COMMENT\s+([\s\S]*?)\n(?=[A-Z])/m); if (cm) out.comment = cm[1].replace(/\n\s{12}/g, '\n');
  const fs = text.indexOf('\nFEATURES'), og = text.indexOf('\nORIGIN');
  const block = text.slice(fs, og).split('\n').slice(2);
  let cur = null, q = null;
  for (const line of block) {
    if (/^ {5}\S/.test(line)) {
      cur = { key: line.slice(5, 21).trim(), location: line.slice(21).trim(), quals: {} }; out.features.push(cur); q = null;
    } else if (/^ {21}\//.test(line) && cur) {
      const m = line.slice(21).match(/^\/([^=]+)(?:=(.*))?$/);
      q = m[1]; (cur.quals[q] ||= []).push((m[2] ?? '').replace(/^"/, ''));
    } else if (/^ {21}/.test(line) && cur) {
      if (q) { const a = cur.quals[q]; a[a.length - 1] += (q === 'translation' ? '' : ' ') + line.slice(21).trim(); }
      else cur.location += line.slice(21).trim();
    }
  }
  for (const f of out.features) for (const k of Object.keys(f.quals)) f.quals[k] = f.quals[k].map((v) => v.replace(/"$/, ''));
  out.sequence = text.slice(og + 1).split('\n').slice(1).join('').replace(/[^a-z]/gi, '').toUpperCase();
  return out;
}

/** Intervalos de una localización GenBank simple: 51..494, join(1..142,273..495), complement(...). */
function intervals(loc) {
  return [...loc.matchAll(/<?(\d+)\.\.>?(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

function fasta(text) { return text.split('\n').filter((l) => !l.startsWith('>')).join('').trim().toUpperCase(); }

/** Código genético estándar (tabla 1 del NCBI), para la comprobación del script. */
const AA = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG', B = 'TCAG';
function translateDna(cds) {
  let p = '';
  for (let i = 0; i + 3 <= cds.length; i += 3) {
    const c = cds.slice(i, i + 3);
    p += AA[B.indexOf(c[0]) * 16 + B.indexOf(c[1]) * 4 + B.indexOf(c[2])];
  }
  return p;
}

/** Cita fiel y acortada de un comentario de UniProt: primeras oraciones completas y sus evidencias. */
function excerpt(textObj, sentences) {
  if (!textObj) return null;
  const full = textObj.value;
  const parts = full.match(/[^.]+?(?:\([^)]*\))?[^.]*?(?:\.(?=\s+[A-Z(])|\.?$)/g) ?? [full];
  let quote = parts.slice(0, sentences).join('').trim();
  if (!quote.endsWith('.')) quote += full.length > quote.length ? '.' : '';
  const ev = textObj.evidences ?? [];
  const cited = new Set([...quote.matchAll(/PubMed:(\d+)/g)].map((m) => m[1]));
  const bySim = /By similarity/.test(quote);
  let evidence = ev;
  if (cited.size || bySim) evidence = ev.filter((e) => (e.source === 'PubMed' && cited.has(e.id)) || (bySim && e.evidenceCode === 'ECO:0000250'));
  return {
    quote, shortened: quote.replace(/\.$/, '').length < full.replace(/\.$/, '').length,
    evidence: evidence.map((e) => ({ code: e.evidenceCode, source: e.source ?? null, id: e.id ?? null })),
  };
}

/* ------------------------------------------------------------------ Construcción del registro de un gen */
async function buildGene(c) {
  const src = (db, url, api) => ({ db, url, api, retrieved: TODAY });

  // 1. NCBI Gene
  const gApi = eutil('esummary.fcgi', { db: 'gene', id: c.geneId, retmode: 'json' });
  const g = (await get(gApi, { ncbi: true, json: true })).result[String(c.geneId)];
  const gi = g.genomicinfo[0];
  const minus = gi.chrstart > gi.chrstop;
  const chrStart = Math.min(gi.chrstart, gi.chrstop) + 1, chrEnd = Math.max(gi.chrstart, gi.chrstop) + 1; // esummary usa base 0
  const gene = {
    geneId: c.geneId, symbol: g.name, description: g.description,
    organism: g.organism.scientificname, taxId: g.organism.taxid,
    chromosome: g.chromosome || null, mapLocation: g.maplocation || null,
    genomic: { accession: gi.chraccver, start: chrStart, end: chrEnd, strand: minus ? '-' : '+', exonCount: gi.exoncount === '' ? null : Number(gi.exoncount) },
    source: src('NCBI Gene', `https://www.ncbi.nlm.nih.gov/gene/${c.geneId}`, gApi),
  };

  // 2. Región genómica (orientación del gen) con la ventana corriente arriba: exones del transcrito y regiones reguladoras.
  const wStart = minus ? chrStart : chrStart - c.upstream, wEnd = minus ? chrEnd + c.upstream : chrEnd;
  const ftApi = eutil('efetch.fcgi', { db: 'nuccore', id: gi.chraccver, seq_start: wStart, seq_stop: wEnd, strand: minus ? 2 : 1, rettype: 'ft', retmode: 'text' });
  const feats = parseFeatureTable(await get(ftApi, { ncbi: true }));
  const off = c.upstream; // en la ventana, el inicio del gen está en off + 1
  const toChr = (w) => (minus ? wEnd - w + 1 : wStart + w - 1);
  // 1 = primera base del gen; −1 = base inmediatamente anterior (convención de los promotores, sin posición 0).
  const rel = (w) => { const r = w - off; return r <= 0 ? r - 1 : r; };
  let tx = null;
  if (c.mrna) tx = feats.find((f) => f.key === 'mRNA' && (f.quals.transcript_id ?? []).some((t) => t.includes(c.mrna)));
  const cdsFeat = feats.find((f) => f.key === 'CDS' && (f.quals.protein_id ?? []).some((t) => t.includes(c.protein)));
  if (!cdsFeat) throw new Error(`${c.key}: no se encontró el CDS de ${c.protein} en ${gi.chraccver}`);
  const blocks = (tx ?? cdsFeat).intervals;
  const genomicExons = blocks.map(([s, e], i) => ({ n: i + 1, geneStart: rel(s), geneEnd: rel(e), chrStart: Math.min(toChr(s), toChr(e)), chrEnd: Math.max(toChr(s), toChr(e)), length: e - s + 1 }));
  const regulatory = feats
    .filter((f) => f.key === 'regulatory' && REG_CLASSES.has((f.quals.regulatory_class ?? [''])[0]) && (f.quals.experiment ?? []).length)
    .map((f) => {
      const [s, e] = f.intervals[0];
      const exp = f.quals.experiment[0];
      const m = exp.match(/^(?:EXISTENCE:)?(.*?)\s*\[(ECO:\d+)\](?:\[PMID:([^\]]+)\])?/);
      return {
        regClass: f.quals.regulatory_class[0], geneStart: rel(Math.min(s, e)), geneEnd: rel(Math.max(s, e)), partial: f.partial,
        note: (f.quals.note ?? [null])[0], function: (f.quals.function ?? [null])[0],
        evidence: { text: m ? m[1] : exp, code: m ? m[2] : null, pmids: m && m[3] ? m[3].split(/,\s*/).map((x) => x.replace('PMID:', '')) : [] },
      };
    })
    .filter((r) => r.geneEnd >= -c.upstream && r.geneStart <= REG_DOWNSTREAM) // ventana: corriente arriba y primer kb del gen
    // Prioridad: elementos del promotor, luego potenciadores y regiones cis, luego el resto; a igual clase, el más cercano al inicio.
    .sort((a, b) => (REG_RANK[a.regClass] ?? 3) - (REG_RANK[b.regClass] ?? 3) || Math.abs(a.geneStart) - Math.abs(b.geneStart) || a.geneEnd - b.geneEnd)
    .slice(0, MAX_REG)
    .sort((a, b) => a.geneStart - b.geneStart || a.geneEnd - b.geneEnd);
  const genomicSource = src('NCBI Nucleotide (RefSeq, tabla de características)', `https://www.ncbi.nlm.nih.gov/nuccore/${gi.chraccver}?from=${chrStart}&to=${chrEnd}`, ftApi);

  // 3. Transcrito (ARNm RefSeq) o, en bacterias, la secuencia del CDS en el genoma
  let mrna = null, cds;
  if (c.mrna) {
    const mApi = eutil('efetch.fcgi', { db: 'nuccore', id: c.mrna, rettype: 'gb', retmode: 'text' });
    const gb = parseGenBank(await get(mApi, { ncbi: true }));
    const exons = gb.features.filter((f) => f.key === 'exon').map((f, i) => { const [s, e] = intervals(f.location)[0]; return { n: i + 1, start: s, end: e, length: e - s + 1, inference: (f.quals.inference ?? [null])[0] }; });
    const cf = gb.features.find((f) => f.key === 'CDS');
    const [cs, ce] = intervals(cf.location)[0];
    const status = (gb.comment.match(/^(REVIEWED|VALIDATED|PROVISIONAL|PREDICTED|INFERRED|MODEL) REFSEQ/m) ?? [null, null])[1];
    const evData = (gb.comment.match(/##Evidence-Data-START##([\s\S]*?)##Evidence-Data-END##/) ?? [null, ''])[1];
    const eco = [...new Set([...evData.matchAll(/ECO:\d+/g)].map((m) => m[0]))];
    mrna = {
      accession: gb.version, length: gb.length, refseqStatus: status, mane: /MANE Select/.test(gb.keywords),
      evidenceCodes: eco, exons, cds: { start: cs, end: ce },
      source: src('NCBI Nucleotide (RefSeq)', `https://www.ncbi.nlm.nih.gov/nuccore/${gb.version}`, mApi),
    };
    cds = gb.sequence.slice(cs - 1, ce);
  } else {
    const [s, e] = cdsFeat.intervals[0];
    const sApi = eutil('efetch.fcgi', { db: 'nuccore', id: gi.chraccver, seq_start: Math.min(toChr(s), toChr(e)), seq_stop: Math.max(toChr(s), toChr(e)), strand: minus ? 2 : 1, rettype: 'fasta', retmode: 'text' });
    cds = fasta(await get(sApi, { ncbi: true }));
  }
  const cdsBlocks = cdsFeat.intervals.map(([s, e]) => ({ geneStart: rel(s), geneEnd: rel(e) }));

  // 4. Proteína RefSeq
  const pApi = eutil('efetch.fcgi', { db: 'protein', id: c.protein, rettype: 'fasta', retmode: 'text' });
  const pSeq = fasta(await get(pApi, { ncbi: true }));
  const protein = { accession: c.protein, length: pSeq.length, sequence: pSeq, source: src('NCBI Protein (RefSeq)', `https://www.ncbi.nlm.nih.gov/protein/${c.protein}`, pApi) };

  // 5. UniProt
  const uApi = `https://rest.uniprot.org/uniprotkb/${c.uniprot}.json`;
  const u = await get(uApi, { json: true });
  const com = (t) => (u.comments ?? []).filter((x) => x.commentType === t);
  const xr = (db) => (u.uniProtKBCrossReferences ?? []).filter((x) => x.database === db);
  const prop = (x, k) => (x.properties ?? []).find((p) => p.key === k)?.value ?? null;
  const fn = com('FUNCTION')[0]?.texts?.[0];
  const uniprot = {
    accession: u.primaryAccession, reviewed: u.entryType === 'UniProtKB reviewed (Swiss-Prot)', entryType: u.entryType,
    entryVersion: u.entryAudit.entryVersion, lastAnnotationUpdate: u.entryAudit.lastAnnotationUpdateDate,
    proteinName: u.proteinDescription?.recommendedName?.fullName?.value ?? null, proteinExistence: u.proteinExistence ?? null,
    ec: (u.proteinDescription?.recommendedName?.ecNumbers ?? []).map((e) => e.value),
    length: u.sequence.length, sameSequenceAsRefSeq: u.sequence.value === pSeq,
    function: fn ? excerpt(fn, c.functionSentences) : null,
    catalytic: com('CATALYTIC ACTIVITY').slice(0, 2).map((x) => ({ reaction: x.reaction.name, ec: x.reaction.ecNumber ?? null, rhea: (x.reaction.reactionCrossReferences ?? []).find((r) => r.database === 'Rhea')?.id ?? null, evidence: [...new Set((x.reaction.evidences ?? []).map((e) => e.evidenceCode))] })),
    subunit: excerpt(com('SUBUNIT')[0]?.texts?.[0], 1),
    tissue: excerpt(com('TISSUE SPECIFICITY')[0]?.texts?.[0], 1),
    induction: excerpt(com('INDUCTION')[0]?.texts?.[0], 1),
    interactions: (com('INTERACTION')[0]?.interactions ?? [])
      .map((i) => ({ partner: i.interactantTwo.uniProtKBAccession ?? null, gene: i.interactantTwo.geneName ?? null, experiments: i.numberOfExperiments, intact: [i.interactantOne.intActId ?? null, i.interactantTwo.intActId ?? null] }))
      .filter((i) => i.partner && i.gene)
      .sort((a, b) => b.experiments - a.experiments || a.gene.localeCompare(b.gene))
      .slice(0, MAX_INTERACTIONS),
    pathways: xr('Reactome').slice(0, MAX_PATHWAYS).map((x) => ({ db: 'Reactome', id: x.id, name: prop(x, 'PathwayName') })),
    pathwayTotal: xr('Reactome').length,
    otherPathwayXrefs: [...xr('KEGG'), ...xr('BioCyc')].map((x) => `${x.database}:${x.id}`),
    diseases: com('DISEASE').map((d) => ({ name: d.disease.diseaseId, acronym: d.disease.acronym ?? null, mim: d.disease.diseaseCrossReference?.id ?? null, note: d.note?.texts?.[0]?.value ?? null, evidence: [...new Set((d.disease.evidences ?? []).map((e) => e.evidenceCode))] })),
    polymorphism: excerpt(com('POLYMORPHISM')[0]?.texts?.[0], 1),
    pdbTotal: xr('PDB').length,
    alphafold: xr('AlphaFoldDB')[0]?.id ?? null,
    source: src('UniProtKB', `https://www.uniprot.org/uniprotkb/${u.primaryAccession}/entry`, uApi),
  };

  // 6. Estructura experimental (solo si UniProt referencia la entrada elegida)
  let structure = null;
  if (c.pdb) {
    const x = xr('PDB').find((p) => p.id === c.pdb);
    if (!x) throw new Error(`${c.key}: UniProt no referencia la entrada PDB ${c.pdb}`);
    const rApi = `https://data.rcsb.org/rest/v1/core/entry/${c.pdb}`;
    const r = await get(rApi, { json: true });
    structure = {
      pdb: c.pdb, title: r.struct?.title ?? null, method: r.exptl?.[0]?.method ?? null,
      resolution: r.rcsb_entry_info?.resolution_combined?.[0] ?? null, released: (r.rcsb_accession_info?.initial_release_date ?? '').slice(0, 10) || null,
      chainsUniProt: prop(x, 'Chains'), doi: r.rcsb_primary_citation?.pdbx_database_id_doi ?? null,
      source: src('RCSB PDB (Data API)', `https://www.rcsb.org/structure/${c.pdb}`, rApi),
    };
  }

  // 7. Variantes (ClinVar)
  const variants = [];
  if (c.variants.length) {
    const vApi = eutil('esummary.fcgi', { db: 'clinvar', id: c.variants.join(','), retmode: 'json' });
    const v = (await get(vApi, { ncbi: true, json: true })).result;
    for (const id of c.variants) {
      const r = v[String(id)];
      const m = r.title.match(/^(\S+?)\(([^)]+)\):(c\.\S+)(?: \((p\.[^)]+)\))?/);
      const rs = (r.variation_set?.[0]?.variation_xrefs ?? []).find((x) => x.db_source === 'dbSNP')?.db_id ?? null;
      variants.push({
        clinvarId: id, accession: r.accession, title: r.title, transcript: m?.[1] ?? null, hgvsC: m?.[3] ?? null, hgvsP: m?.[4] ?? null,
        type: r.obj_type ?? r.variation_set?.[0]?.variant_type ?? null, classification: r.germline_classification?.description ?? null,
        dbSNP: rs ? `rs${rs}` : null, reviewStatus: r.germline_classification?.review_status ?? null,
        traits: [...new Set((r.germline_classification?.trait_set ?? []).map((t) => t.trait_name))].sort(),
        source: src('ClinVar', `https://www.ncbi.nlm.nih.gov/clinvar/variation/${id}/`, vApi),
      });
    }
  }

  return { key: c.key, gene, genomicExons, cdsBlocks, regulatory, genomicSource, mrna, cds, protein, uniprot, structure, variants };
}

/* ------------------------------------------------------------------ Ontología de evidencias (ECO) */
const ECO_URL = 'https://raw.githubusercontent.com/evidenceontology/evidenceontology/master/eco.obo';
const ECO_ROOTS = { 'ECO:0000006': 'experimental evidence', 'ECO:0007672': 'computational evidence', 'ECO:0000041': 'similarity evidence', 'ECO:0000205': 'curator inference', 'ECO:0000204': 'author statement' };

/** Etiqueta y clase (¿desciende de «experimental evidence», ECO:0000006?) de cada código ECO usado en el conjunto. */
async function ecoTerms(records) {
  const obo = await get(ECO_URL);
  const terms = {}, alt = {};
  let cur = null;
  for (const line of obo.split('\n')) {
    if (line === '[Term]') { cur = { isA: [] }; continue; }
    if (line.startsWith('[')) { cur = null; continue; }
    if (!cur) continue;
    if (line.startsWith('id: ')) { cur.id = line.slice(4).trim(); terms[cur.id] = cur; }
    else if (line.startsWith('name: ')) cur.name = line.slice(6).trim();
    else if (line.startsWith('alt_id: ')) alt[line.slice(8).trim()] = cur;
    else if (line.startsWith('is_a: ')) cur.isA.push(line.slice(6).split(' ')[0]);
  }
  const version = (obo.match(/^data-version: (.*)$/m) ?? [null, null])[1];
  const ancestors = (id, seen = new Set()) => { for (const p of terms[id]?.isA ?? []) if (!seen.has(p)) { seen.add(p); ancestors(p, seen); } return seen; };
  const codes = new Set(JSON.stringify(records).match(/ECO:\d{7}/g));
  const out = {};
  for (const code of [...codes].sort()) {
    const t = terms[code] ?? alt[code];
    if (!t) throw new Error(`Código ECO desconocido: ${code}`);
    const anc = ancestors(t.id);
    out[code] = { label: t.name, primaryId: t.id, experimental: anc.has('ECO:0000006') || t.id === 'ECO:0000006', roots: Object.keys(ECO_ROOTS).filter((r) => anc.has(r)).map((r) => ECO_ROOTS[r]) };
  }
  return { version, source: { db: 'Evidence & Conclusion Ontology (ECO)', url: 'https://www.evidenceontology.org/', api: ECO_URL, retrieved: TODAY }, terms: out };
}

/* ------------------------------------------------------------------ Escritura de src/data/genes.ts */
const TYPES = `export interface Source { db: string; url: string; api: string; retrieved: string }
export interface Evidence { code: string; source: string | null; id: string | null }
export interface Excerpt { quote: string; shortened: boolean; evidence: Evidence[] }
export interface EcoTerm { label: string; primaryId: string; experimental: boolean; roots: string[] }
export interface EcoTable { version: string | null; source: Source; terms: Record<string, EcoTerm> }
export interface GeneRecord {
  key: string;
  gene: { geneId: number; symbol: string; description: string; organism: string; taxId: number; chromosome: string | null; mapLocation: string | null;
    genomic: { accession: string; start: number; end: number; strand: '+' | '-'; exonCount: number | null }; source: Source };
  /** Exones (o el CDS en bacterias) sobre la región genómica: coordenadas relativas al gen (1 = primera base) y del cromosoma. */
  genomicExons: { n: number; geneStart: number; geneEnd: number; chrStart: number; chrEnd: number; length: number }[];
  cdsBlocks: { geneStart: number; geneEnd: number }[];
  /** Regiones reguladoras de la transcripción anotadas con evidencia experimental (RefSeq Functional Elements). Coordenadas ≤ 0: corriente arriba. */
  regulatory: { regClass: string; geneStart: number; geneEnd: number; partial: boolean; note: string | null; function: string | null; evidence: { text: string; code: string | null; pmids: string[] } }[];
  genomicSource: Source;
  mrna: null | { accession: string; length: number; refseqStatus: string | null; mane: boolean; evidenceCodes: string[];
    exons: { n: number; start: number; end: number; length: number; inference: string | null }[]; cds: { start: number; end: number }; source: Source };
  /** Región codificante (hebra codificante, 5′→3′) incluido el codón de terminación. */
  cds: string;
  protein: { accession: string; length: number; sequence: string; source: Source };
  uniprot: { accession: string; reviewed: boolean; entryType: string; entryVersion: number; lastAnnotationUpdate: string; proteinName: string | null; proteinExistence: string | null; ec: string[];
    length: number; sameSequenceAsRefSeq: boolean; function: Excerpt | null;
    catalytic: { reaction: string; ec: string | null; rhea: string | null; evidence: string[] }[];
    subunit: Excerpt | null; tissue: Excerpt | null; induction: Excerpt | null;
    interactions: { partner: string; gene: string; experiments: number; intact: (string | null)[] }[];
    pathways: { db: string; id: string; name: string | null }[]; pathwayTotal: number; otherPathwayXrefs: string[];
    diseases: { name: string; acronym: string | null; mim: string | null; note: string | null; evidence: string[] }[];
    polymorphism: Excerpt | null; pdbTotal: number; alphafold: string | null; source: Source };
  structure: null | { pdb: string; title: string | null; method: string | null; resolution: number | null; released: string | null; chainsUniProt: string | null; doi: string | null; source: Source };
  variants: { clinvarId: number; accession: string; title: string; transcript: string | null; hgvsC: string | null; hgvsP: string | null; type: string | null;
    classification: string | null; dbSNP: string | null; reviewStatus: string | null; traits: string[]; source: Source }[];
}`;

function emit(records, eco) {
  const body = `/**
 * Conjunto curado de genes de la práctica «Rastreo génico» (programa v2, sección 10.2).
 *
 * ARCHIVO GENERADO por scripts/validacion/genes_fetch.mjs --emit el ${TODAY} con consultas reales a NCBI E-utilities
 * (Gene, Nucleotide, Protein, ClinVar), UniProt REST y RCSB Data API. No editar a mano: volver a generar y validar
 * (el informe de la comparación automatizada está en docs/v2/validacion-genes.md).
 * Cada sección declara su fuente (URL del registro y de la API) y la fecha de consulta.
 * Las citas de UniProt son textuales (en inglés) y se acortan a oraciones completas; sus códigos ECO son los del registro.
 * Sin dependencias: el script de validación importa este archivo directamente con Node.
 */
${TYPES}

export const GENES_RETRIEVED = '${TODAY}';

export const GENES: GeneRecord[] = ${JSON.stringify(records, null, 2).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, '$1:')};

/** Códigos ECO usados en GENES: etiqueta y si descienden de «experimental evidence» (ECO:0000006) en la ontología. */
export const ECO: EcoTable = ${JSON.stringify(eco, null, 2).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, '$1:')};
`;
  writeFileSync(DATA_FILE, body);
}

/* ------------------------------------------------------------------ Comparación */
function diff(a, b, path = '', out = []) {
  if (path.endsWith('.retrieved')) return out;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) { out.push({ path, stored: a, live: b }); return out; }
  if (a && typeof a === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) diff(a[k], b[k], `${path}.${k}`, out);
  } else if (a !== b) out.push({ path, stored: a, live: b });
  return out;
}

const short = (v) => { const s = JSON.stringify(v); return s && s.length > 80 ? s.slice(0, 77) + '…' : s; };

async function checkLink(url) {
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'laboratorio-virtual-ciencias/rastreo (educativo)' } });
    return r.status;
  } catch (e) { return `error: ${e.cause?.code ?? e.message}`; }
}

function linksOf(rec) {
  const L = [rec.gene.source.url, rec.genomicSource.url, rec.protein.source.url, rec.uniprot.source.url];
  if (rec.mrna) L.push(rec.mrna.source.url);
  if (rec.structure) L.push(rec.structure.source.url);
  for (const v of rec.variants) L.push(v.source.url);
  for (const p of rec.uniprot.pathways) L.push(`https://reactome.org/content/detail/${p.id}`);
  return L;
}

/** Comprobaciones internas de coherencia (independientes de la comparación con la red). */
function selfChecks(rec) {
  const checks = [];
  const ok = (name, pass, detail) => checks.push({ name, pass, detail });
  const prot = translateDna(rec.cds);
  ok('El CDS traducido (código estándar) es igual a la proteína RefSeq y termina en un codón de terminación', prot === rec.protein.sequence + '*', `${rec.cds.length} nt → ${prot.length - 1} aa + *`);
  ok('La secuencia de UniProt es idéntica a la proteína RefSeq', rec.uniprot.sameSequenceAsRefSeq && rec.uniprot.length === rec.protein.length, `${rec.uniprot.accession} ${rec.uniprot.length} aa; ${rec.protein.accession} ${rec.protein.length} aa`);
  if (rec.mrna) {
    const ex = rec.mrna.exons;
    const contiguous = ex.every((e, i) => e.start === (i === 0 ? 1 : ex[i - 1].end + 1));
    ok('Los exones del ARNm son contiguos y suman la longitud del registro', contiguous && ex[ex.length - 1].end === rec.mrna.length, `${ex.length} exones, ${rec.mrna.length} nt`);
    ok('Las longitudes de los exones en el ARNm coinciden con las del genoma', ex.length === rec.genomicExons.length && ex.every((e, i) => e.length === rec.genomicExons[i].length), `${rec.genomicExons.map((e) => e.length).join(', ')}`);
    ok('NCBI Gene informa al menos tantos exones como tiene el transcrito elegido (Gene cuenta todos los transcritos)', rec.gene.genomic.exonCount >= ex.length, `Gene: ${rec.gene.genomic.exonCount}; transcrito: ${ex.length}`);
  } else {
    ok('Gen bacteriano sin intrones: un solo bloque codificante', rec.genomicExons.length === 1, `${rec.genomicExons[0].length} nt`);
  }
  const cdsLen = rec.cdsBlocks.reduce((s, b) => s + b.geneEnd - b.geneStart + 1, 0);
  ok('Los bloques del CDS en el genoma suman la longitud del CDS', cdsLen === rec.cds.length, `${cdsLen} nt`);
  for (const v of rec.variants) {
    const m = v.hgvsC?.match(/^c\.(\d+)([ACGT])>([ACGT])$/);
    if (m) ok(`${v.hgvsC}: la base de referencia coincide con el CDS`, rec.cds[Number(m[1]) - 1] === m[2], `CDS[${m[1]}] = ${rec.cds[Number(m[1]) - 1]}`);
  }
  return checks;
}

/* ------------------------------------------------------------------ Principal */
async function main() {
  const args = process.argv.slice(2);
  const doEmit = args.includes('--emit');
  const ri = args.indexOf('--report');
  const reportPath = ri >= 0 ? resolve(ROOT, args[ri + 1]) : null;

  const live = [];
  for (const c of CURATED) { process.stderr.write(`Descargando ${c.key}…\n`); live.push(await buildGene(c)); }
  const ecoLive = await ecoTerms(live);
  if (doEmit) { emit(live, ecoLive); console.log(`Escrito ${DATA_FILE} (${live.length} genes, ${TODAY}).`); }

  const { GENES, GENES_RETRIEVED, ECO } = await import(pathToFileURL(DATA_FILE).href + `?t=${Date.now()}`);
  const lines = [];
  let fails = 0, total = 0, unverifiedTotal = 0;
  const P = (s) => lines.push(s);
  P('# Validación automática del conjunto curado de genes (práctica `rastreo`)');
  P('');
  P(`- Datos guardados: \`src/data/genes.ts\` (consulta del ${GENES_RETRIEVED}).`);
  P(`- Nueva consulta y comparación: ${TODAY}, con \`NODE_USE_ENV_PROXY=1 node scripts/validacion/genes_fetch.mjs --report docs/v2/validacion-genes.md\`.`);
  P('- Criterio (prompt v2, 10.2): los datos de la ficha coinciden con los registros originales (comparación automatizada sobre el conjunto curado), los enlaces resuelven y los cambios de aminoácido de las variantes de ejemplo coinciden con la traducción de referencia (esto último, además, en `tests/unit/geneTrace.test.ts`).');
  P('- Se comparan todos los campos guardados con los que se reconstruyen desde los registros vivos (se ignora solo la fecha de consulta).');
  P('');
  P('## Resumen por gen');
  P('');
  P('| Gen | Organismo | NCBI Gene | ARNm | Proteína | UniProt | Campos distintos | Comprobaciones internas | Enlaces |');
  P('|---|---|---|---|---|---|---|---|---|');
  const details = [];
  for (const rec of live) {
    const stored = GENES.find((g) => g.key === rec.key);
    const d = stored ? diff(stored, rec, rec.key) : [{ path: rec.key, stored: undefined, live: 'gen no guardado' }];
    const checks = selfChecks(stored ?? rec);
    const links = [];
    for (const url of linksOf(stored ?? rec)) links.push({ url, status: await checkLink(url) });
    const badLinks = links.filter((l) => typeof l.status === 'number' && l.status !== 200);
    const unverified = links.filter((l) => typeof l.status !== 'number');
    unverifiedTotal += unverified.length;
    const badChecks = checks.filter((x) => !x.pass);
    total += 1 + checks.length + links.length - unverified.length;
    fails += (d.length ? 1 : 0) + badChecks.length + badLinks.length;
    P(`| ${rec.gene.symbol} | *${rec.gene.organism}* (taxón ${rec.gene.taxId}) | ${rec.gene.geneId} | ${rec.mrna?.accession ?? '—'} | ${rec.protein.accession} | ${rec.uniprot.accession}${rec.uniprot.reviewed ? ' (revisada)' : ''} | ${d.length === 0 ? '0 ✔' : `${d.length} ✘`} | ${checks.length - badChecks.length}/${checks.length} | ${links.length - badLinks.length - unverified.length}/${links.length}${unverified.length ? ` (${unverified.length} no verificables)` : ''} |`);
    details.push({ rec, d, checks, links });
  }
  const ecoDiff = diff(ECO, ecoLive, 'ECO');
  total += 1; if (ecoDiff.length) fails += 1;
  P(`| ECO | Ontología de evidencias ${ecoLive.version} | — | — | — | — | ${ecoDiff.length === 0 ? '0 ✔' : `${ecoDiff.length} ✘`} | ${Object.keys(ecoLive.terms).length} códigos | — |`);
  for (const x of ecoDiff.slice(0, 10)) P(`| | \`${x.path}\` | | | | | guardado ${short(x.stored)} · vivo ${short(x.live)} | | |`);
  P('');
  P(`**Resultado global:** ${fails === 0 ? 'APROBADO' : 'CON DIFERENCIAS'} (${total - fails} de ${total} verificaciones correctas).`);
  if (unverifiedTotal) P(`\n**No verificado:** ${unverifiedTotal} enlaces no se pudieron abrir desde este entorno (el proxy de salida rechaza la conexión al dominio; ver la tabla de cada gen). No se cuentan como aprobados ni como fallidos: deben revisarse desde otra red. Los identificadores provienen de las referencias cruzadas de UniProt.`);
  P('');
  for (const { rec, d, checks, links } of details) {
    P(`## ${rec.gene.symbol} — ${rec.gene.description}`);
    P('');
    P(`- Genoma: ${rec.gene.genomic.accession}:${rec.gene.genomic.start}-${rec.gene.genomic.end} (hebra ${rec.gene.genomic.strand}), ${rec.gene.mapLocation ?? 'sin banda citogenética'}; exones: ${rec.genomicExons.length}.`);
    if (rec.mrna) P(`- ARNm ${rec.mrna.accession}: ${rec.mrna.length} nt, estado RefSeq ${rec.mrna.refseqStatus}${rec.mrna.mane ? ', MANE Select' : ''}; CDS ${rec.mrna.cds.start}..${rec.mrna.cds.end}.`);
    P(`- Proteína ${rec.protein.accession}: ${rec.protein.length} aa; UniProt ${rec.uniprot.accession} (${rec.uniprot.entryType}, versión ${rec.uniprot.entryVersion}).`);
    if (rec.structure) P(`- PDB ${rec.structure.pdb}: ${rec.structure.method}, ${rec.structure.resolution ?? '—'} Å.`);
    for (const v of rec.variants) P(`- ClinVar ${v.clinvarId} (${v.accession}): ${v.title} — ${v.classification} (${v.reviewStatus}; ${v.traits.join(', ')}).`);
    P('');
    P(d.length === 0 ? '**Comparación con el registro vivo:** todos los campos coinciden.' : '**Comparación con el registro vivo:** diferencias encontradas:');
    for (const x of d.slice(0, 30)) P(`- \`${x.path}\`: guardado ${short(x.stored)} · vivo ${short(x.live)}`);
    P('');
    P('| Comprobación interna | Resultado | Detalle |');
    P('|---|---|---|');
    for (const c of checks) P(`| ${c.name} | ${c.pass ? '✔' : '✘'} | ${c.detail} |`);
    P('');
    P('| Enlace | Estado HTTP |');
    P('|---|---|');
    for (const l of links) P(`| ${l.url} | ${typeof l.status === 'number' ? l.status : `no verificado (${l.status})`} |`);
    P('');
  }
  const report = lines.join('\n') + '\n';
  if (reportPath) { mkdirSync(dirname(reportPath), { recursive: true }); writeFileSync(reportPath, report); console.log(`Informe: ${reportPath}`); }
  else console.log(report);
  console.log(`Verificaciones: ${total - fails}/${total} correctas.`);
  process.exitCode = fails === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exit(2); });
