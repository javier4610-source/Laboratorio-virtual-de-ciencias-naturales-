# Validación automática del conjunto curado de genes (práctica `rastreo`)

- Datos guardados: `src/data/genes.ts` (consulta del 2026-10-18).
- Nueva consulta y comparación: 2026-10-18, con `NODE_USE_ENV_PROXY=1 node scripts/validacion/genes_fetch.mjs --report docs/v2/validacion-genes.md`.
- Criterio (prompt v2, 10.2): los datos de la ficha coinciden con los registros originales (comparación automatizada sobre el conjunto curado), los enlaces resuelven y los cambios de aminoácido de las variantes de ejemplo coinciden con la traducción de referencia (esto último, además, en `tests/unit/geneTrace.test.ts`).
- Se comparan todos los campos guardados con los que se reconstruyen desde los registros vivos (se ignora solo la fecha de consulta).

## Resumen por gen

| Gen | Organismo | NCBI Gene | ARNm | Proteína | UniProt | Campos distintos | Comprobaciones internas | Enlaces |
|---|---|---|---|---|---|---|---|---|
| HBB | *Homo sapiens* (taxón 9606) | 3043 | NM_000518.5 | NP_000509.1 | P68871 (revisada) | 0 ✔ | 8/8 | 9/13 (4 no verificables) |
| INS | *Homo sapiens* (taxón 9606) | 3630 | NM_000207.3 | NP_000198.1 | P01308 (revisada) | 0 ✔ | 6/6 | 6/10 (4 no verificables) |
| LCT | *Homo sapiens* (taxón 9606) | 3938 | NM_002299.4 | NP_002290.2 | P09848 (revisada) | 0 ✔ | 6/6 | 6/8 (2 no verificables) |
| OCA2 | *Homo sapiens* (taxón 9606) | 4948 | NM_000275.3 | NP_000266.2 | Q04671 (revisada) | 0 ✔ | 6/6 | 5/6 (1 no verificables) |
| lacZ | *Escherichia coli str. K-12 substr. MG1655* (taxón 511145) | 945006 | — | NP_414878.1 | P00722 (revisada) | 0 ✔ | 4/4 | 5/5 |
| ECO | Ontología de evidencias releases/2026-07-10 | — | — | — | — | 0 ✔ | 9 códigos | — |

**Resultado global:** APROBADO (67 de 67 verificaciones correctas).

**No verificado:** 11 enlaces no se pudieron abrir desde este entorno (el proxy de salida rechaza la conexión al dominio; ver la tabla de cada gen). No se cuentan como aprobados ni como fallidos: deben revisarse desde otra red. Los identificadores provienen de las referencias cruzadas de UniProt.

## HBB — hemoglobin subunit beta

- Genoma: NC_000011.10:5225464-5227071 (hebra -), 11p15.4; exones: 3.
- ARNm NM_000518.5: 628 nt, estado RefSeq REVIEWED, MANE Select; CDS 51..494.
- Proteína NP_000509.1: 147 aa; UniProt P68871 (UniProtKB reviewed (Swiss-Prot), versión 219).
- PDB 2HHB: X-RAY DIFFRACTION, 1.74 Å.
- ClinVar 15333 (VCV000015333): NM_000518.5(HBB):c.20A>T (p.Glu7Val) — Pathogenic (criteria provided, multiple submitters, no conflicts; Beta-thalassemia HBB/LCRB, Dominant beta-thalassemia, Erythrocytosis, familial, 6, Fetal hemoglobin quantitative trait locus 1, HBB-related disorder, Hb SS disease, Heinz body anemia, Hereditary persistence of fetal hemoglobin, Inborn genetic diseases, METHEMOGLOBINEMIA, BETA TYPE, Malaria, susceptibility to, See cases, Sickle cell-hemoglobin C disease, alpha Thalassemia, beta Thalassemia, not provided).
- ClinVar 15402 (VCV000015402): NM_000518.5(HBB):c.118C>T (p.Gln40Ter) — Pathogenic (criteria provided, multiple submitters, no conflicts; Beta-thalassemia HBB/LCRB, Dominant beta-thalassemia, Erythrocytosis, familial, 6, HBB-related disorder, Hb SS disease, Heinz body anemia, Hereditary persistence of fetal hemoglobin, Inborn genetic diseases, METHEMOGLOBINEMIA, BETA TYPE, Malaria, susceptibility to, alpha Thalassemia, beta Thalassemia, not provided).
- ClinVar 36308 (VCV000036308): NM_000518.5(HBB):c.27dup (p.Ser10fs) — Pathogenic (criteria provided, multiple submitters, no conflicts; Beta-thalassemia HBB/LCRB, Dominant beta-thalassemia, Erythrocytosis, familial, 6, HBB-related disorder, Hb SS disease, Heinz body anemia, Hereditary persistence of fetal hemoglobin, Inborn genetic diseases, METHEMOGLOBINEMIA, BETA TYPE, Malaria, susceptibility to, beta Thalassemia, not provided).

**Comparación con el registro vivo:** todos los campos coinciden.

| Comprobación interna | Resultado | Detalle |
|---|---|---|
| El CDS traducido (código estándar) es igual a la proteína RefSeq y termina en un codón de terminación | ✔ | 444 nt → 147 aa + * |
| La secuencia de UniProt es idéntica a la proteína RefSeq | ✔ | P68871 147 aa; NP_000509.1 147 aa |
| Los exones del ARNm son contiguos y suman la longitud del registro | ✔ | 3 exones, 628 nt |
| Las longitudes de los exones en el ARNm coinciden con las del genoma | ✔ | 142, 223, 263 |
| NCBI Gene informa al menos tantos exones como tiene el transcrito elegido (Gene cuenta todos los transcritos) | ✔ | Gene: 3; transcrito: 3 |
| Los bloques del CDS en el genoma suman la longitud del CDS | ✔ | 444 nt |
| c.20A>T: la base de referencia coincide con el CDS | ✔ | CDS[20] = A |
| c.118C>T: la base de referencia coincide con el CDS | ✔ | CDS[118] = C |

| Enlace | Estado HTTP |
|---|---|
| https://www.ncbi.nlm.nih.gov/gene/3043 | 200 |
| https://www.ncbi.nlm.nih.gov/nuccore/NC_000011.10?from=5225464&to=5227071 | 200 |
| https://www.ncbi.nlm.nih.gov/protein/NP_000509.1 | 200 |
| https://www.uniprot.org/uniprotkb/P68871/entry | 200 |
| https://www.ncbi.nlm.nih.gov/nuccore/NM_000518.5 | 200 |
| https://www.rcsb.org/structure/2HHB | 200 |
| https://www.ncbi.nlm.nih.gov/clinvar/variation/15333/ | 200 |
| https://www.ncbi.nlm.nih.gov/clinvar/variation/15402/ | 200 |
| https://www.ncbi.nlm.nih.gov/clinvar/variation/36308/ | 200 |
| https://reactome.org/content/detail/R-HSA-1237044 | no verificado (error: 0) |
| https://reactome.org/content/detail/R-HSA-1247673 | no verificado (error: 0) |
| https://reactome.org/content/detail/R-HSA-2168880 | no verificado (error: 0) |
| https://reactome.org/content/detail/R-HSA-6798695 | no verificado (error: 0) |

## INS — insulin

- Genoma: NC_000011.10:2159779-2161209 (hebra -), 11p15.5; exones: 3.
- ARNm NM_000207.3: 465 nt, estado RefSeq REVIEWED, MANE Select; CDS 60..392.
- Proteína NP_000198.1: 110 aa; UniProt P01308 (UniProtKB reviewed (Swiss-Prot), versión 284).
- PDB 3I40: X-RAY DIFFRACTION, 1.85 Å.

**Comparación con el registro vivo:** todos los campos coinciden.

| Comprobación interna | Resultado | Detalle |
|---|---|---|
| El CDS traducido (código estándar) es igual a la proteína RefSeq y termina en un codón de terminación | ✔ | 333 nt → 110 aa + * |
| La secuencia de UniProt es idéntica a la proteína RefSeq | ✔ | P01308 110 aa; NP_000198.1 110 aa |
| Los exones del ARNm son contiguos y suman la longitud del registro | ✔ | 3 exones, 465 nt |
| Las longitudes de los exones en el ARNm coinciden con las del genoma | ✔ | 42, 204, 219 |
| NCBI Gene informa al menos tantos exones como tiene el transcrito elegido (Gene cuenta todos los transcritos) | ✔ | Gene: 3; transcrito: 3 |
| Los bloques del CDS en el genoma suman la longitud del CDS | ✔ | 333 nt |

| Enlace | Estado HTTP |
|---|---|
| https://www.ncbi.nlm.nih.gov/gene/3630 | 200 |
| https://www.ncbi.nlm.nih.gov/nuccore/NC_000011.10?from=2159779&to=2161209 | 200 |
| https://www.ncbi.nlm.nih.gov/protein/NP_000198.1 | 200 |
| https://www.uniprot.org/uniprotkb/P01308/entry | 200 |
| https://www.ncbi.nlm.nih.gov/nuccore/NM_000207.3 | 200 |
| https://www.rcsb.org/structure/3I40 | 200 |
| https://reactome.org/content/detail/R-HSA-210745 | no verificado (error: 0) |
| https://reactome.org/content/detail/R-HSA-264876 | no verificado (error: 0) |
| https://reactome.org/content/detail/R-HSA-422085 | no verificado (error: 0) |
| https://reactome.org/content/detail/R-HSA-422356 | no verificado (error: 0) |

## LCT — lactase

- Genoma: NC_000002.12:135787850-135837184 (hebra -), 2q21.3; exones: 17.
- ARNm NM_002299.4: 6273 nt, estado RefSeq REVIEWED, MANE Select; CDS 16..5799.
- Proteína NP_002290.2: 1927 aa; UniProt P09848 (UniProtKB reviewed (Swiss-Prot), versión 220).
- ClinVar 7685 (VCV000007685): NM_002299.2(LCT):c.-13907C>T — association (no assertion criteria provided; LACTASE PERSISTENCE).

**Comparación con el registro vivo:** todos los campos coinciden.

| Comprobación interna | Resultado | Detalle |
|---|---|---|
| El CDS traducido (código estándar) es igual a la proteína RefSeq y termina en un codón de terminación | ✔ | 5784 nt → 1927 aa + * |
| La secuencia de UniProt es idéntica a la proteína RefSeq | ✔ | P09848 1927 aa; NP_002290.2 1927 aa |
| Los exones del ARNm son contiguos y suman la longitud del registro | ✔ | 17 exones, 6273 nt |
| Las longitudes de los exones en el ARNm coinciden con las del genoma | ✔ | 655, 80, 84, 103, 79, 721, 646, 1551, 269, 291, 199, 203, 110, 135, 224, 228, 695 |
| NCBI Gene informa al menos tantos exones como tiene el transcrito elegido (Gene cuenta todos los transcritos) | ✔ | Gene: 17; transcrito: 17 |
| Los bloques del CDS en el genoma suman la longitud del CDS | ✔ | 5784 nt |

| Enlace | Estado HTTP |
|---|---|
| https://www.ncbi.nlm.nih.gov/gene/3938 | 200 |
| https://www.ncbi.nlm.nih.gov/nuccore/NC_000002.12?from=135787850&to=135837184 | 200 |
| https://www.ncbi.nlm.nih.gov/protein/NP_002290.2 | 200 |
| https://www.uniprot.org/uniprotkb/P09848/entry | 200 |
| https://www.ncbi.nlm.nih.gov/nuccore/NM_002299.4 | 200 |
| https://www.ncbi.nlm.nih.gov/clinvar/variation/7685/ | 200 |
| https://reactome.org/content/detail/R-HSA-189085 | no verificado (error: 0) |
| https://reactome.org/content/detail/R-HSA-5659898 | no verificado (error: 0) |

## OCA2 — OCA2 melanosomal transmembrane protein

- Genoma: NC_000015.10:27719008-28099315 (hebra -), 15q12-q13.1; exones: 24.
- ARNm NM_000275.3: 3143 nt, estado RefSeq REVIEWED, MANE Select; CDS 114..2630.
- Proteína NP_000266.2: 838 aa; UniProt Q04671 (UniProtKB reviewed (Swiss-Prot), versión 228).

**Comparación con el registro vivo:** todos los campos coinciden.

| Comprobación interna | Resultado | Detalle |
|---|---|---|
| El CDS traducido (código estándar) es igual a la proteína RefSeq y termina en un codón de terminación | ✔ | 2517 nt → 838 aa + * |
| La secuencia de UniProt es idéntica a la proteína RefSeq | ✔ | Q04671 838 aa; NP_000266.2 838 aa |
| Los exones del ARNm son contiguos y suman la longitud del registro | ✔ | 24 exones, 3143 nt |
| Las longitudes de los exones en el ARNm coinciden con las del genoma | ✔ | 92, 248, 99, 189, 58, 73, 161, 83, 154, 72, 66, 57, 125, 139, 133, 148, 58, 109, 128, 60, 105, 94, 94, 598 |
| NCBI Gene informa al menos tantos exones como tiene el transcrito elegido (Gene cuenta todos los transcritos) | ✔ | Gene: 30; transcrito: 24 |
| Los bloques del CDS en el genoma suman la longitud del CDS | ✔ | 2517 nt |

| Enlace | Estado HTTP |
|---|---|
| https://www.ncbi.nlm.nih.gov/gene/4948 | 200 |
| https://www.ncbi.nlm.nih.gov/nuccore/NC_000015.10?from=27719008&to=28099315 | 200 |
| https://www.ncbi.nlm.nih.gov/protein/NP_000266.2 | 200 |
| https://www.uniprot.org/uniprotkb/Q04671/entry | 200 |
| https://www.ncbi.nlm.nih.gov/nuccore/NM_000275.3 | 200 |
| https://reactome.org/content/detail/R-HSA-5662702 | no verificado (error: 0) |

## lacZ — beta-galactosidase

- Genoma: NC_000913.3:363231-366305 (hebra -), sin banda citogenética; exones: 1.
- Proteína NP_414878.1: 1024 aa; UniProt P00722 (UniProtKB reviewed (Swiss-Prot), versión 230).
- PDB 1DP0: X-RAY DIFFRACTION, 1.7 Å.

**Comparación con el registro vivo:** todos los campos coinciden.

| Comprobación interna | Resultado | Detalle |
|---|---|---|
| El CDS traducido (código estándar) es igual a la proteína RefSeq y termina en un codón de terminación | ✔ | 3075 nt → 1024 aa + * |
| La secuencia de UniProt es idéntica a la proteína RefSeq | ✔ | P00722 1024 aa; NP_414878.1 1024 aa |
| Gen bacteriano sin intrones: un solo bloque codificante | ✔ | 3075 nt |
| Los bloques del CDS en el genoma suman la longitud del CDS | ✔ | 3075 nt |

| Enlace | Estado HTTP |
|---|---|
| https://www.ncbi.nlm.nih.gov/gene/945006 | 200 |
| https://www.ncbi.nlm.nih.gov/nuccore/NC_000913.3?from=363231&to=366305 | 200 |
| https://www.ncbi.nlm.nih.gov/protein/NP_414878.1 | 200 |
| https://www.uniprot.org/uniprotkb/P00722/entry | 200 |
| https://www.rcsb.org/structure/1DP0 | 200 |

