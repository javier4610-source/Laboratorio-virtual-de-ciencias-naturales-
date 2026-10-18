/**
 * Conjunto curado de genes de la práctica «Rastreo génico» (programa v2, sección 10.2).
 *
 * ARCHIVO GENERADO por scripts/validacion/genes_fetch.mjs --emit el 2026-10-18 con consultas reales a NCBI E-utilities
 * (Gene, Nucleotide, Protein, ClinVar), UniProt REST y RCSB Data API. No editar a mano: volver a generar y validar
 * (el informe de la comparación automatizada está en docs/v2/validacion-genes.md).
 * Cada sección declara su fuente (URL del registro y de la API) y la fecha de consulta.
 * Las citas de UniProt son textuales (en inglés) y se acortan a oraciones completas; sus códigos ECO son los del registro.
 * Sin dependencias: el script de validación importa este archivo directamente con Node.
 */
export interface Source { db: string; url: string; api: string; retrieved: string }
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
}

export const GENES_RETRIEVED = '2026-10-18';

export const GENES: GeneRecord[] = [
  {
    key: "HBB",
    gene: {
      geneId: 3043,
      symbol: "HBB",
      description: "hemoglobin subunit beta",
      organism: "Homo sapiens",
      taxId: 9606,
      chromosome: "11",
      mapLocation: "11p15.4",
      genomic: {
        accession: "NC_000011.10",
        start: 5225464,
        end: 5227071,
        strand: "-",
        exonCount: 3
      },
      source: {
        db: "NCBI Gene",
        url: "https://www.ncbi.nlm.nih.gov/gene/3043",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=3043&retmode=json",
        retrieved: "2026-10-18"
      }
    },
    genomicExons: [
      {
        n: 1,
        geneStart: 1,
        geneEnd: 142,
        chrStart: 5226930,
        chrEnd: 5227071,
        length: 142
      },
      {
        n: 2,
        geneStart: 273,
        geneEnd: 495,
        chrStart: 5226577,
        chrEnd: 5226799,
        length: 223
      },
      {
        n: 3,
        geneStart: 1346,
        geneEnd: 1608,
        chrStart: 5225464,
        chrEnd: 5225726,
        length: 263
      }
    ],
    cdsBlocks: [
      {
        geneStart: 51,
        geneEnd: 142
      },
      {
        geneStart: 273,
        geneEnd: 495
      },
      {
        geneStart: 1346,
        geneEnd: 1474
      }
    ],
    regulatory: [
      {
        regClass: "enhancer",
        geneStart: 482,
        geneEnd: 1398,
        partial: false,
        note: "0.9 kb EcoRI-BamHI fragment spanning intron 2; region deleted in the H2beta-IVS2 construct",
        function: "required for LCR activity by 5'HS3 along with the beta 3' enhancer in beta-gamma hybrid transgenes; increases inducibility of the beta-globin gene in transfected MEL cells",
        evidence: {
          text: "deletion mutation evidence",
          code: "ECO:0005510",
          pmids: [
            "3432265"
          ]
        }
      },
      {
        regClass: "enhancer",
        geneStart: 482,
        geneEnd: 1608,
        partial: true,
        note: "1.7 kb BamHI-PstI transgene fragment that includes intron 2 and exon 3 of the beta gene",
        function: "activates an A-gamma-globin marker transgene in fetal liver and shows an additive effect with the beta 3' enhancer",
        evidence: {
          text: "transgenic organism evidence",
          code: "ECO:0001131",
          pmids: [
            "3478680"
          ]
        }
      },
      {
        regClass: "transcriptional_cis_regulatory_region",
        geneStart: 701,
        geneEnd: 715,
        partial: false,
        note: "triplex-forming bases of the beta-globin (L) tfRNA (5'-UUUUUUUUCUUCUCC-3' on minus strand)",
        function: "forms DNA-RNA triplex with 5'HS2 of the HBB-LCR, resulting in reduced expression of the espilon- and gamma-globin genes in transfected K562 cells, and the gamma- and beta-globin genes in transfected HUDEP-2 cells",
        evidence: {
          text: "cell transfection experiment evidence",
          code: "ECO:0005606",
          pmids: [
            "30867287"
          ]
        }
      }
    ],
    genomicSource: {
      db: "NCBI Nucleotide (RefSeq, tabla de características)",
      url: "https://www.ncbi.nlm.nih.gov/nuccore/NC_000011.10?from=5225464&to=5227071",
      api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_000011.10&seq_start=5225464&seq_stop=5228071&strand=2&rettype=ft&retmode=text",
      retrieved: "2026-10-18"
    },
    mrna: {
      accession: "NM_000518.5",
      length: 628,
      refseqStatus: "REVIEWED",
      mane: true,
      evidenceCodes: [
        "ECO:0000332",
        "ECO:0000348"
      ],
      exons: [
        {
          n: 1,
          start: 1,
          end: 142,
          length: 142,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 2,
          start: 143,
          end: 365,
          length: 223,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 3,
          start: 366,
          end: 628,
          length: 263,
          inference: "alignment:Splign:2.1.0"
        }
      ],
      cds: {
        start: 51,
        end: 494
      },
      source: {
        db: "NCBI Nucleotide (RefSeq)",
        url: "https://www.ncbi.nlm.nih.gov/nuccore/NM_000518.5",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NM_000518.5&rettype=gb&retmode=text",
        retrieved: "2026-10-18"
      }
    },
    cds: "ATGGTGCATCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGTGGTGAGGCCCTGGGCAGGCTGCTGGTGGTCTACCCTTGGACCCAGAGGTTCTTTGAGTCCTTTGGGGATCTGTCCACTCCTGATGCTGTTATGGGCAACCCTAAGGTGAAGGCTCATGGCAAGAAAGTGCTCGGTGCCTTTAGTGATGGCCTGGCTCACCTGGACAACCTCAAGGGCACCTTTGCCACACTGAGTGAGCTGCACTGTGACAAGCTGCACGTGGATCCTGAGAACTTCAGGCTCCTGGGCAACGTGCTGGTCTGTGTGCTGGCCCATCACTTTGGCAAAGAATTCACCCCACCAGTGCAGGCTGCCTATCAGAAAGTGGTGGCTGGTGTGGCTAATGCCCTGGCCCACAAGTATCACTAA",
    protein: {
      accession: "NP_000509.1",
      length: 147,
      sequence: "MVHLTPEEKSAVTALWGKVNVDEVGGEALGRLLVVYPWTQRFFESFGDLSTPDAVMGNPKVKAHGKKVLGAFSDGLAHLDNLKGTFATLSELHCDKLHVDPENFRLLGNVLVCVLAHHFGKEFTPPVQAAYQKVVAGVANALAHKYH",
      source: {
        db: "NCBI Protein (RefSeq)",
        url: "https://www.ncbi.nlm.nih.gov/protein/NP_000509.1",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=protein&id=NP_000509.1&rettype=fasta&retmode=text",
        retrieved: "2026-10-18"
      }
    },
    uniprot: {
      accession: "P68871",
      reviewed: true,
      entryType: "UniProtKB reviewed (Swiss-Prot)",
      entryVersion: 219,
      lastAnnotationUpdate: "2026-09-02",
      proteinName: "Hemoglobin subunit beta",
      proteinExistence: "1: Evidence at protein level",
      ec: [],
      length: 147,
      sameSequenceAsRefSeq: true,
      function: {
        quote: "Involved in oxygen transport from the lung to the various peripheral tissues",
        shortened: false,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "28066926"
          }
        ]
      },
      catalytic: [],
      subunit: {
        quote: "Heterotetramer of two alpha chains and two beta chains in adult hemoglobin A (HbA).",
        shortened: true,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "11747442"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "24100324"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "6539334"
          }
        ]
      },
      tissue: {
        quote: "Red blood cells",
        shortened: false,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "6539334"
          }
        ]
      },
      induction: null,
      interactions: [
        {
          partner: "P69905",
          gene: "HBA2",
          experiments: 32,
          intact: [
            "EBI-715554",
            "EBI-714680"
          ]
        },
        {
          partner: "P02008",
          gene: "HBZ",
          experiments: 7,
          intact: [
            "EBI-715554",
            "EBI-719843"
          ]
        },
        {
          partner: "Q6B0K9",
          gene: "HBM",
          experiments: 3,
          intact: [
            "EBI-715554",
            "EBI-12805802"
          ]
        }
      ],
      pathways: [
        {
          db: "Reactome",
          id: "R-HSA-1237044",
          name: "Erythrocytes take up carbon dioxide and release oxygen"
        },
        {
          db: "Reactome",
          id: "R-HSA-1247673",
          name: "Erythrocytes take up oxygen and release carbon dioxide"
        },
        {
          db: "Reactome",
          id: "R-HSA-2168880",
          name: "Scavenging of heme from plasma"
        },
        {
          db: "Reactome",
          id: "R-HSA-6798695",
          name: "Neutrophil degranulation"
        }
      ],
      pathwayTotal: 10,
      otherPathwayXrefs: [
        "KEGG:hsa:3043"
      ],
      diseases: [
        {
          name: "Heinz body anemias",
          acronym: "HEIBAN",
          mim: "140700",
          note: "The disease may be caused by variants affecting the gene represented in this entry",
          evidence: [
            "ECO:0000269"
          ]
        },
        {
          name: "Beta-thalassemia",
          acronym: "B-THAL",
          mim: "613985",
          note: "The disease is caused by variants affecting the gene represented in this entry",
          evidence: [
            "ECO:0000269"
          ]
        },
        {
          name: "Sickle cell disease",
          acronym: "SKCA",
          mim: "603903",
          note: "The disease is caused by variants affecting the gene represented in this entry",
          evidence: [
            "ECO:0000269"
          ]
        },
        {
          name: "Beta-thalassemia, dominant, inclusion body type",
          acronym: "B-THALIB",
          mim: "603902",
          note: "The disease is caused by variants affecting the gene represented in this entry",
          evidence: [
            "ECO:0000269"
          ]
        }
      ],
      polymorphism: {
        quote: "Genetic variations in HBB are involved in resistance to malaria [MIM:611162].",
        shortened: true,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "11001883"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "12149194"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "16001361"
          }
        ]
      },
      pdbTotal: 348,
      alphafold: "P68871",
      source: {
        db: "UniProtKB",
        url: "https://www.uniprot.org/uniprotkb/P68871/entry",
        api: "https://rest.uniprot.org/uniprotkb/P68871.json",
        retrieved: "2026-10-18"
      }
    },
    structure: {
      pdb: "2HHB",
      title: "THE CRYSTAL STRUCTURE OF HUMAN DEOXYHAEMOGLOBIN AT 1.74 ANGSTROMS RESOLUTION",
      method: "X-RAY DIFFRACTION",
      resolution: 1.74,
      released: "1984-07-18",
      chainsUniProt: "B/D=2-147",
      doi: null,
      source: {
        db: "RCSB PDB (Data API)",
        url: "https://www.rcsb.org/structure/2HHB",
        api: "https://data.rcsb.org/rest/v1/core/entry/2HHB",
        retrieved: "2026-10-18"
      }
    },
    variants: [
      {
        clinvarId: 15333,
        accession: "VCV000015333",
        title: "NM_000518.5(HBB):c.20A>T (p.Glu7Val)",
        transcript: "NM_000518.5",
        hgvsC: "c.20A>T",
        hgvsP: "p.Glu7Val",
        type: "single nucleotide variant",
        classification: "Pathogenic",
        dbSNP: "rs334",
        reviewStatus: "criteria provided, multiple submitters, no conflicts",
        traits: [
          "Beta-thalassemia HBB/LCRB",
          "Dominant beta-thalassemia",
          "Erythrocytosis, familial, 6",
          "Fetal hemoglobin quantitative trait locus 1",
          "HBB-related disorder",
          "Hb SS disease",
          "Heinz body anemia",
          "Hereditary persistence of fetal hemoglobin",
          "Inborn genetic diseases",
          "METHEMOGLOBINEMIA, BETA TYPE",
          "Malaria, susceptibility to",
          "See cases",
          "Sickle cell-hemoglobin C disease",
          "alpha Thalassemia",
          "beta Thalassemia",
          "not provided"
        ],
        source: {
          db: "ClinVar",
          url: "https://www.ncbi.nlm.nih.gov/clinvar/variation/15333/",
          api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=15333%2C15402%2C36308&retmode=json",
          retrieved: "2026-10-18"
        }
      },
      {
        clinvarId: 15402,
        accession: "VCV000015402",
        title: "NM_000518.5(HBB):c.118C>T (p.Gln40Ter)",
        transcript: "NM_000518.5",
        hgvsC: "c.118C>T",
        hgvsP: "p.Gln40Ter",
        type: "single nucleotide variant",
        classification: "Pathogenic",
        dbSNP: "rs11549407",
        reviewStatus: "criteria provided, multiple submitters, no conflicts",
        traits: [
          "Beta-thalassemia HBB/LCRB",
          "Dominant beta-thalassemia",
          "Erythrocytosis, familial, 6",
          "HBB-related disorder",
          "Hb SS disease",
          "Heinz body anemia",
          "Hereditary persistence of fetal hemoglobin",
          "Inborn genetic diseases",
          "METHEMOGLOBINEMIA, BETA TYPE",
          "Malaria, susceptibility to",
          "alpha Thalassemia",
          "beta Thalassemia",
          "not provided"
        ],
        source: {
          db: "ClinVar",
          url: "https://www.ncbi.nlm.nih.gov/clinvar/variation/15402/",
          api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=15333%2C15402%2C36308&retmode=json",
          retrieved: "2026-10-18"
        }
      },
      {
        clinvarId: 36308,
        accession: "VCV000036308",
        title: "NM_000518.5(HBB):c.27dup (p.Ser10fs)",
        transcript: "NM_000518.5",
        hgvsC: "c.27dup",
        hgvsP: "p.Ser10fs",
        type: "Duplication",
        classification: "Pathogenic",
        dbSNP: "rs35699606",
        reviewStatus: "criteria provided, multiple submitters, no conflicts",
        traits: [
          "Beta-thalassemia HBB/LCRB",
          "Dominant beta-thalassemia",
          "Erythrocytosis, familial, 6",
          "HBB-related disorder",
          "Hb SS disease",
          "Heinz body anemia",
          "Hereditary persistence of fetal hemoglobin",
          "Inborn genetic diseases",
          "METHEMOGLOBINEMIA, BETA TYPE",
          "Malaria, susceptibility to",
          "beta Thalassemia",
          "not provided"
        ],
        source: {
          db: "ClinVar",
          url: "https://www.ncbi.nlm.nih.gov/clinvar/variation/36308/",
          api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=15333%2C15402%2C36308&retmode=json",
          retrieved: "2026-10-18"
        }
      }
    ]
  },
  {
    key: "INS",
    gene: {
      geneId: 3630,
      symbol: "INS",
      description: "insulin",
      organism: "Homo sapiens",
      taxId: 9606,
      chromosome: "11",
      mapLocation: "11p15.5",
      genomic: {
        accession: "NC_000011.10",
        start: 2159779,
        end: 2161209,
        strand: "-",
        exonCount: 3
      },
      source: {
        db: "NCBI Gene",
        url: "https://www.ncbi.nlm.nih.gov/gene/3630",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=3630&retmode=json",
        retrieved: "2026-10-18"
      }
    },
    genomicExons: [
      {
        n: 1,
        geneStart: 1,
        geneEnd: 42,
        chrStart: 2161168,
        chrEnd: 2161209,
        length: 42
      },
      {
        n: 2,
        geneStart: 222,
        geneEnd: 425,
        chrStart: 2160785,
        chrEnd: 2160988,
        length: 204
      },
      {
        n: 3,
        geneStart: 1213,
        geneEnd: 1431,
        chrStart: 2159779,
        chrEnd: 2159997,
        length: 219
      }
    ],
    cdsBlocks: [
      {
        geneStart: 239,
        geneEnd: 425
      },
      {
        geneStart: 1213,
        geneEnd: 1358
      }
    ],
    regulatory: [],
    genomicSource: {
      db: "NCBI Nucleotide (RefSeq, tabla de características)",
      url: "https://www.ncbi.nlm.nih.gov/nuccore/NC_000011.10?from=2159779&to=2161209",
      api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_000011.10&seq_start=2159779&seq_stop=2162209&strand=2&rettype=ft&retmode=text",
      retrieved: "2026-10-18"
    },
    mrna: {
      accession: "NM_000207.3",
      length: 465,
      refseqStatus: "REVIEWED",
      mane: true,
      evidenceCodes: [
        "ECO:0000332",
        "ECO:0000348"
      ],
      exons: [
        {
          n: 1,
          start: 1,
          end: 42,
          length: 42,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 2,
          start: 43,
          end: 246,
          length: 204,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 3,
          start: 247,
          end: 465,
          length: 219,
          inference: "alignment:Splign:2.1.0"
        }
      ],
      cds: {
        start: 60,
        end: 392
      },
      source: {
        db: "NCBI Nucleotide (RefSeq)",
        url: "https://www.ncbi.nlm.nih.gov/nuccore/NM_000207.3",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NM_000207.3&rettype=gb&retmode=text",
        retrieved: "2026-10-18"
      }
    },
    cds: "ATGGCCCTGTGGATGCGCCTCCTGCCCCTGCTGGCGCTGCTGGCCCTCTGGGGACCTGACCCAGCCGCAGCCTTTGTGAACCAACACCTGTGCGGCTCACACCTGGTGGAAGCTCTCTACCTAGTGTGCGGGGAACGAGGCTTCTTCTACACACCCAAGACCCGCCGGGAGGCAGAGGACCTGCAGGTGGGGCAGGTGGAGCTGGGCGGGGGCCCTGGTGCAGGCAGCCTGCAGCCCTTGGCCCTGGAGGGGTCCCTGCAGAAGCGTGGCATTGTGGAACAATGCTGTACCAGCATCTGCTCCCTCTACCAGCTGGAGAACTACTGCAACTAG",
    protein: {
      accession: "NP_000198.1",
      length: 110,
      sequence: "MALWMRLLPLLALLALWGPDPAAAFVNQHLCGSHLVEALYLVCGERGFFYTPKTRREAEDLQVGQVELGGGPGAGSLQPLALEGSLQKRGIVEQCCTSICSLYQLENYCN",
      source: {
        db: "NCBI Protein (RefSeq)",
        url: "https://www.ncbi.nlm.nih.gov/protein/NP_000198.1",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=protein&id=NP_000198.1&rettype=fasta&retmode=text",
        retrieved: "2026-10-18"
      }
    },
    uniprot: {
      accession: "P01308",
      reviewed: true,
      entryType: "UniProtKB reviewed (Swiss-Prot)",
      entryVersion: 284,
      lastAnnotationUpdate: "2026-09-02",
      proteinName: "Insulin",
      proteinExistence: "1: Evidence at protein level",
      ec: [],
      length: 110,
      sameSequenceAsRefSeq: true,
      function: {
        quote: "Insulin decreases blood glucose concentration.",
        shortened: true,
        evidence: []
      },
      catalytic: [],
      subunit: {
        quote: "Heterodimer of a B chain and an A chain linked by two disulfide bonds (PubMed:25423173)",
        shortened: false,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "25423173"
          }
        ]
      },
      tissue: {
        quote: "Expressed by pancreatic beta-cells (at protein level)",
        shortened: false,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "36309486"
          }
        ]
      },
      induction: null,
      interactions: [
        {
          partner: "P01308",
          gene: "INS",
          experiments: 19,
          intact: [
            "EBI-7090529",
            "EBI-7090529"
          ]
        },
        {
          partner: "P06213-2",
          gene: "INSR",
          experiments: 6,
          intact: [
            "EBI-7090529",
            "EBI-9984921"
          ]
        },
        {
          partner: "Q6UY14-3",
          gene: "ADAMTSL4",
          experiments: 3,
          intact: [
            "EBI-7090529",
            "EBI-10173507"
          ]
        }
      ],
      pathways: [
        {
          db: "Reactome",
          id: "R-HSA-210745",
          name: "Regulation of gene expression in beta cells"
        },
        {
          db: "Reactome",
          id: "R-HSA-264876",
          name: "Insulin processing"
        },
        {
          db: "Reactome",
          id: "R-HSA-422085",
          name: "Synthesis, secretion, and deacylation of Ghrelin"
        },
        {
          db: "Reactome",
          id: "R-HSA-422356",
          name: "Regulation of insulin secretion"
        }
      ],
      pathwayTotal: 14,
      otherPathwayXrefs: [
        "KEGG:hsa:3630",
        "BioCyc:MetaCyc:MONOMER-16190"
      ],
      diseases: [
        {
          name: "Hyperproinsulinemia",
          acronym: "HPRI",
          mim: "616214",
          note: "The disease is caused by variants affecting the gene represented in this entry",
          evidence: [
            "ECO:0000269"
          ]
        },
        {
          name: "Type 1 diabetes mellitus 2",
          acronym: "T1D2",
          mim: "125852",
          note: "The disease is caused by variants affecting the gene represented in this entry",
          evidence: [
            "ECO:0000269"
          ]
        },
        {
          name: "Diabetes mellitus, permanent neonatal, 4",
          acronym: "PNDM4",
          mim: "618858",
          note: "The disease is caused by variants affecting the gene represented in this entry",
          evidence: [
            "ECO:0000269"
          ]
        },
        {
          name: "Maturity-onset diabetes of the young 10",
          acronym: "MODY10",
          mim: "613370",
          note: "The disease is caused by variants affecting the gene represented in this entry",
          evidence: [
            "ECO:0000269"
          ]
        }
      ],
      polymorphism: null,
      pdbTotal: 382,
      alphafold: "P01308",
      source: {
        db: "UniProtKB",
        url: "https://www.uniprot.org/uniprotkb/P01308/entry",
        api: "https://rest.uniprot.org/uniprotkb/P01308.json",
        retrieved: "2026-10-18"
      }
    },
    structure: {
      pdb: "3I40",
      title: "Human insulin",
      method: "X-RAY DIFFRACTION",
      resolution: 1.85,
      released: "2010-01-05",
      chainsUniProt: "A=90-110, B=25-53",
      doi: null,
      source: {
        db: "RCSB PDB (Data API)",
        url: "https://www.rcsb.org/structure/3I40",
        api: "https://data.rcsb.org/rest/v1/core/entry/3I40",
        retrieved: "2026-10-18"
      }
    },
    variants: []
  },
  {
    key: "LCT",
    gene: {
      geneId: 3938,
      symbol: "LCT",
      description: "lactase",
      organism: "Homo sapiens",
      taxId: 9606,
      chromosome: "2",
      mapLocation: "2q21.3",
      genomic: {
        accession: "NC_000002.12",
        start: 135787850,
        end: 135837184,
        strand: "-",
        exonCount: 17
      },
      source: {
        db: "NCBI Gene",
        url: "https://www.ncbi.nlm.nih.gov/gene/3938",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=3938&retmode=json",
        retrieved: "2026-10-18"
      }
    },
    genomicExons: [
      {
        n: 1,
        geneStart: 1,
        geneEnd: 655,
        chrStart: 135836530,
        chrEnd: 135837184,
        length: 655
      },
      {
        n: 2,
        geneStart: 3995,
        geneEnd: 4074,
        chrStart: 135833111,
        chrEnd: 135833190,
        length: 80
      },
      {
        n: 3,
        geneStart: 7509,
        geneEnd: 7592,
        chrStart: 135829593,
        chrEnd: 135829676,
        length: 84
      },
      {
        n: 4,
        geneStart: 13182,
        geneEnd: 13284,
        chrStart: 135823901,
        chrEnd: 135824003,
        length: 103
      },
      {
        n: 5,
        geneStart: 15087,
        geneEnd: 15165,
        chrStart: 135822020,
        chrEnd: 135822098,
        length: 79
      },
      {
        n: 6,
        geneStart: 19124,
        geneEnd: 19844,
        chrStart: 135817341,
        chrEnd: 135818061,
        length: 721
      },
      {
        n: 7,
        geneStart: 24229,
        geneEnd: 24874,
        chrStart: 135812311,
        chrEnd: 135812956,
        length: 646
      },
      {
        n: 8,
        geneStart: 27192,
        geneEnd: 28742,
        chrStart: 135808443,
        chrEnd: 135809993,
        length: 1551
      },
      {
        n: 9,
        geneStart: 29789,
        geneEnd: 30057,
        chrStart: 135807128,
        chrEnd: 135807396,
        length: 269
      },
      {
        n: 10,
        geneStart: 32128,
        geneEnd: 32418,
        chrStart: 135804767,
        chrEnd: 135805057,
        length: 291
      },
      {
        n: 11,
        geneStart: 33057,
        geneEnd: 33255,
        chrStart: 135803930,
        chrEnd: 135804128,
        length: 199
      },
      {
        n: 12,
        geneStart: 36376,
        geneEnd: 36578,
        chrStart: 135800607,
        chrEnd: 135800809,
        length: 203
      },
      {
        n: 13,
        geneStart: 39047,
        geneEnd: 39156,
        chrStart: 135798029,
        chrEnd: 135798138,
        length: 110
      },
      {
        n: 14,
        geneStart: 42410,
        geneEnd: 42544,
        chrStart: 135794641,
        chrEnd: 135794775,
        length: 135
      },
      {
        n: 15,
        geneStart: 46304,
        geneEnd: 46527,
        chrStart: 135790658,
        chrEnd: 135790881,
        length: 224
      },
      {
        n: 16,
        geneStart: 47387,
        geneEnd: 47614,
        chrStart: 135789571,
        chrEnd: 135789798,
        length: 228
      },
      {
        n: 17,
        geneStart: 48641,
        geneEnd: 49335,
        chrStart: 135787850,
        chrEnd: 135788544,
        length: 695
      }
    ],
    cdsBlocks: [
      {
        geneStart: 16,
        geneEnd: 655
      },
      {
        geneStart: 3995,
        geneEnd: 4074
      },
      {
        geneStart: 7509,
        geneEnd: 7592
      },
      {
        geneStart: 13182,
        geneEnd: 13284
      },
      {
        geneStart: 15087,
        geneEnd: 15165
      },
      {
        geneStart: 19124,
        geneEnd: 19844
      },
      {
        geneStart: 24229,
        geneEnd: 24874
      },
      {
        geneStart: 27192,
        geneEnd: 28742
      },
      {
        geneStart: 29789,
        geneEnd: 30057
      },
      {
        geneStart: 32128,
        geneEnd: 32418
      },
      {
        geneStart: 33057,
        geneEnd: 33255
      },
      {
        geneStart: 36376,
        geneEnd: 36578
      },
      {
        geneStart: 39047,
        geneEnd: 39156
      },
      {
        geneStart: 42410,
        geneEnd: 42544
      },
      {
        geneStart: 46304,
        geneEnd: 46527
      },
      {
        geneStart: 47387,
        geneEnd: 47614
      },
      {
        geneStart: 48641,
        geneEnd: 48861
      }
    ],
    regulatory: [],
    genomicSource: {
      db: "NCBI Nucleotide (RefSeq, tabla de características)",
      url: "https://www.ncbi.nlm.nih.gov/nuccore/NC_000002.12?from=135787850&to=135837184",
      api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_000002.12&seq_start=135787850&seq_stop=135838184&strand=2&rettype=ft&retmode=text",
      retrieved: "2026-10-18"
    },
    mrna: {
      accession: "NM_002299.4",
      length: 6273,
      refseqStatus: "REVIEWED",
      mane: true,
      evidenceCodes: [
        "ECO:0000332",
        "ECO:0006172"
      ],
      exons: [
        {
          n: 1,
          start: 1,
          end: 655,
          length: 655,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 2,
          start: 656,
          end: 735,
          length: 80,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 3,
          start: 736,
          end: 819,
          length: 84,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 4,
          start: 820,
          end: 922,
          length: 103,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 5,
          start: 923,
          end: 1001,
          length: 79,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 6,
          start: 1002,
          end: 1722,
          length: 721,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 7,
          start: 1723,
          end: 2368,
          length: 646,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 8,
          start: 2369,
          end: 3919,
          length: 1551,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 9,
          start: 3920,
          end: 4188,
          length: 269,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 10,
          start: 4189,
          end: 4479,
          length: 291,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 11,
          start: 4480,
          end: 4678,
          length: 199,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 12,
          start: 4679,
          end: 4881,
          length: 203,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 13,
          start: 4882,
          end: 4991,
          length: 110,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 14,
          start: 4992,
          end: 5126,
          length: 135,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 15,
          start: 5127,
          end: 5350,
          length: 224,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 16,
          start: 5351,
          end: 5578,
          length: 228,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 17,
          start: 5579,
          end: 6273,
          length: 695,
          inference: "alignment:Splign:2.1.0"
        }
      ],
      cds: {
        start: 16,
        end: 5799
      },
      source: {
        db: "NCBI Nucleotide (RefSeq)",
        url: "https://www.ncbi.nlm.nih.gov/nuccore/NM_002299.4",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NM_002299.4&rettype=gb&retmode=text",
        retrieved: "2026-10-18"
      }
    },
    cds: "ATGGAGCTGTCTTGGCATGTAGTCTTTATTGCCCTGCTAAGTTTTTCATGCTGGGGGTCAGACTGGGAGTCTGATAGAAATTTCATTTCCACCGCTGGTCCTCTAACCAATGACTTGCTGCACAACCTGAGTGGTCTCCTGGGAGACCAGAGTTCTAACTTTGTAGCAGGGGACAAAGACATGTATGTTTGTCACCAGCCACTGCCCACTTTCCTGCCAGAATACTTCAGCAGTCTCCATGCCAGTCAGATCACCCATTATAAGGTATTTCTGTCATGGGCACAGCTCCTCCCAGCAGGAAGCACCCAGAATCCAGACGAGAAAACAGTGCAGTGCTACCGGCGACTCCTCAAGGCCCTCAAGACTGCACGGCTTCAGCCCATGGTCATCCTGCACCACCAGACCCTCCCTGCCAGCACCCTCCGGAGAACCGAAGCCTTTGCTGACCTCTTCGCCGACTATGCCACATTCGCCTTCCACTCCTTCGGGGACCTAGTTGGGATCTGGTTCACCTTCAGTGACTTGGAGGAAGTGATCAAGGAGCTTCCCCACCAGGAATCAAGAGCGTCACAACTCCAGACCCTCAGTGATGCCCACAGAAAAGCCTATGAGATTTACCACGAAAGCTATGCTTTTCAGGGCGGAAAACTCTCTGTTGTCCTGCGAGCTGAAGATATCCCGGAGCTCCTGCTAGAACCACCCATATCTGCGCTTGCCCAGGACACGGTCGATTTCCTCTCTCTTGATTTGTCTTATGAATGCCAAAATGAGGCAAGTCTGCGGCAGAAGCTGAGTAAATTGCAGACCATTGAGCCAAAAGTGAAAGTTTTCATCTTCAACCTAAAACTCCCAGACTGCCCCTCCACCATGAAGAACCCAGCCAGTCTGCTCTTCAGCCTTTTTGAAGCCATAAATAAAGACCAAGTGCTCACCATTGGGTTTGATATTAATGAGTTTCTGAGTTGTTCATCAAGTTCCAAGAAAAGCATGTCTTGTTCTCTGACTGGCAGCCTGGCCCTTCAGCCTGACCAGCAGCAGGACCACGAGACCACGGACTCCTCTCCTGCCTCTGCCTATCAGAGAATCTGGGAAGCATTTGCCAATCAGTCCAGGGCGGAAAGGGATGCCTTCCTGCAGGATACTTTCCCTGAAGGCTTCCTCTGGGGTGCCTCCACAGGAGCCTTTAACGTGGAAGGAGGCTGGGCCGAGGGTGGGAGAGGGGTGAGCATCTGGGATCCACGCAGGCCCCTGAACACCACTGAGGGCCAAGCGACGCTGGAGGTGGCCAGCGACAGTTACCACAAGGTAGCCTCTGACGTCGCCCTGCTTTGCGGCCTCCGGGCTCAGGTGTACAAGTTCTCCATCTCCTGGTCCCGGATCTTCCCCATGGGGCACGGGAGCAGCCCCAGCCTCCCAGGCGTTGCCTACTACAACAAGCTGATTGACAGGCTACAGGATGCGGGCATCGAGCCCATGGCCACGCTGTTCCACTGGGACCTGCCTCAGGCCCTGCAGGATCATGGTGGATGGCAGAATGAGAGCGTGGTGGATGCCTTCCTGGACTATGCGGCCTTCTGCTTCTCCACATTTGGGGACCGTGTGAAGCTGTGGGTGACCTTCCATGAGCCGTGGGTGATGAGCTACGCAGGCTATGGCACCGGCCAGCACCCTCCCGGCATCTCTGACCCAGGAGTGGCCTCTTTTAAGGTGGCTCACTTGGTCCTCAAGGCTCATGCCAGAACTTGGCACCACTACAACAGCCATCATCGCCCACAGCAGCAGGGGCACGTGGGCATTGTGCTGAACTCAGACTGGGCAGAACCCCTGTCTCCAGAGAGGCCTGAGGACCTGAGAGCCTCTGAGCGCTTCTTGCACTTCATGCTGGGCTGGTTTGCACACCCCGTCTTTGTGGATGGAGACTACCCAGCCACCCTGAGGACCCAGATCCAACAGATGAACAGACAGTGCTCCCATCCTGTGGCTCAACTCCCCGAGTTCACAGAGGCAGAGAAGCAGCTCCTGAAAGGCTCTGCTGATTTTCTGGGTCTGTCGCATTACACCTCCCGCCTCATCAGCAACGCCCCACAAAACACCTGCATCCCTAGCTATGATACCATTGGAGGCTTCTCCCAACACGTGAACCATGTGTGGCCCCAGACCTCATCCTCTTGGATTCGTGTGGTGCCCTGGGGGATAAGGAGGCTGTTGCAGTTTGTATCCCTGGAATACACAAGAGGAAAAGTTCCAATATACCTTGCCGGGAATGGCATGCCCATAGGGGAAAGTGAAAATCTCTTTGATGATTCCTTAAGAGTAGACTACTTCAATCAATATATCAATGAGGTGCTCAAGGCTATCAAGGAAGACTCTGTGGATGTTCGTTCCTACATTGCTCGTTCCCTCATTGATGGCTTCGAAGGCCCTTCTGGTTACAGCCAGCGGTTTGGCCTGCACCACGTCAACTTCAGCGACAGCAGCAAGTCAAGGACTCCCAGGAAATCTGCCTACTTTTTCACTAGCATCATAGAAAAGAACGGTTTCCTCACCAAGGGGGCAAAAAGACTGCTACCACCTAATACAGTAAACCTCCCCTCCAAAGTCAGAGCCTTCACTTTTCCATCTGAGGTGCCCTCCAAGGCTAAAGTCGTTTGGGAAAAGTTCTCCAGCCAACCCAAGTTCGAAAGAGATTTGTTCTACCACGGGACGTTTCGGGATGACTTTCTGTGGGGCGTGTCCTCTTCCGCTTATCAGATTGAAGGCGCGTGGGATGCCGATGGCAAAGGCCCCAGCATCTGGGATAACTTTACCCACACACCAGGGAGCAATGTGAAAGACAATGCCACTGGAGACATCGCCTGTGACAGCTATCACCAGCTGGATGCCGATCTGAATATGCTCCGAGCTTTGAAGGTGAAGGCCTACCGCTTCTCTATCTCCTGGTCTCGGATTTTCCCAACTGGGAGAAACAGCTCTATCAACAGTCATGGGGTTGATTATTACAACAGGCTGATCAATGGCTTGGTGGCAAGCAACATCTTTCCCATGGTGACATTGTTCCATTGGGACCTGCCCCAGGCCCTCCAGGATATCGGAGGCTGGGAGAATCCTGCCTTGATTGACTTGTTTGACAGCTACGCAGACTTTTGTTTCCAGACCTTTGGTGATAGAGTCAAGTTTTGGATGACTTTTAATGAGCCCATGTACCTGGCATGGCTAGGTTATGGCTCAGGGGAATTTCCCCCAGGGGTGAAGGACCCAGGCTGGGCACCATATAGGATAGCCCACGCCGTCATCAAAGCCCATGCCAGAGTCTATCACACGTACGATGAGAAATACAGGCAGGAGCAGAAGGGGGTCATCTCGCTGAGCCTCAGTACACACTGGGCAGAGCCCAAGTCACCAGGGGTCCCCAGAGATGTGGAAGCCGCTGACCGAATGCTGCAGTTCTCCCTGGGCTGGTTTGCTCACCCCATTTTTAGAAACGGAGACTATCCTGACACCATGAAGTGGAAAGTGGGGAACAGGAGTGAACTGCAGCACTTAGCCACCTCCCGCCTGCCAAGCTTCACTGAGGAAGAGAAGAGGTTCATCAGGGCGACGGCCGACGTCTTCTGCCTCAACACGTACTACTCCAGAATCGTGCAGCACAAAACACCCAGGCTAAACCCACCCTCCTACGAAGACGACCAGGAGATGGCTGAGGAGGAGGACCCTTCGTGGCCTTCCACGGCAATGAACAGAGCTGCGCCCTGGGGGACGCGAAGGCTGCTGAACTGGATCAAGGAAGAGTATGGTGACATCCCCATTTACATCACCGAAAACGGAGTGGGGCTGACCAATCCGAACACGGAGGATACTGATAGGATATTTTACCACAAAACCTACATCAATGAGGCTTTGAAAGCCTACAGGCTCGATGGTATAGACCTTCGAGGGTATGTCGCCTGGTCTCTGATGGACAACTTTGAGTGGCTAAATGGCTACACGGTCAAGTTTGGACTGTACCATGTTGATTTCAACAACACGAACAGGCCTCGCACAGCAAGAGCCTCCGCCAGGTACTACACAGAGGTCATTACCAACAACGGCATGCCACTGGCCAGGGAGGATGAGTTTCTGTACGGACGGTTTCCTGAGGGCTTCATCTGGAGTGCAGCTTCTGCTGCATATCAGATTGAAGGTGCGTGGAGAGCAGATGGCAAAGGACTCAGCATTTGGGACACGTTTTCTCACACACCACTGAGGGTTGAGAACGATGCCATTGGAGACGTGGCCTGTGACAGTTATCACAAGATTGCTGAGGATCTGGTCACCCTGCAGAACCTGGGCGTGTCCCACTACCGTTTTTCCATCTCCTGGTCTCGCATCCTCCCTGATGGAACCACCAGGTACATCAATGAAGCGGGCCTGAACTACTACGTGAGGCTCATCGATACACTGCTGGCCGCCAGCATCCAGCCCCAGGTGACCATTTACCACTGGGACCTACCACAGACGCTCCAAGATGTAGGAGGCTGGGAGAATGAGACCATCGTGCAGCGGTTTAAGGAGTATGCAGATGTGCTCTTCCAGAGGCTGGGAGACAAGGTGAAGTTTTGGATCACGCTGAATGAGCCCTTTGTCATTGCTTACCAGGGCTATGGCTACGGAACAGCAGCTCCAGGAGTCTCCAATAGGCCTGGCACTGCCCCCTACATTGTTGGCCACAATCTAATAAAGGCTCATGCTGAGGCCTGGCATCTGTACAACGATGTGTACCGCGCCAGTCAAGGTGGCGTGATTTCCATCACCATCAGCAGTGACTGGGCTGAACCCAGAGATCCCTCTAACCAGGAGGATGTGGAGGCAGCCAGGAGATATGTTCAGTTCATGGGAGGCTGGTTTGCACATCCTATTTTCAAGAATGGAGATTACAATGAGGTGATGAAGACGCGGATCCGTGACAGGAGCTTGGCTGCAGGCCTCAACAAGTCTCGGCTGCCAGAATTTACAGAGAGTGAGAAGAGGAGGATCAACGGCACCTATGACTTTTTTGGGTTCAATCACTACACCACTGTCCTCGCCTACAACCTCAACTATGCCACTGCCATCTCTTCTTTTGATGCAGACAGAGGAGTTGCTTCCATCGCAGATCGCTCGTGGCCAGACTCTGGCTCCTTCTGGCTGAAGATGACGCCTTTTGGCTTCAGGAGGATCCTGAACTGGTTAAAGGAGGAATACAATGACCCTCCAATTTATGTCACAGAGAATGGAGTGTCCCAGCGGGAAGAAACAGACCTCAATGACACTGCAAGGATCTACTACCTTCGGACTTACATCAATGAGGCCCTCAAAGCTGTGCAGGACAAGGTGGACCTTCGAGGATACACAGTTTGGAGTGCGATGGACAATTTTGAGTGGGCCACAGGCTTTTCAGAGAGATTTGGTCTGCATTTTGTGAACTACAGTGACCCTTCTCTGCCAAGGATCCCCAAAGCATCAGCGAAGTTCTACGCCTCTGTGGTCCGATGCAATGGCTTCCCTGACCCCGCTACAGGGCCTCACGCTTGTCTCCACCAGCCAGATGCTGGACCCACCATCAGCCCCGTGAGACAGGAGGAGGTGCAGTTCCTGGGGCTAATGCTCGGCACCACAGAAGCACAGACAGCTTTGTACGTTCTCTTTTCTCTTGTGCTTCTTGGAGTCTGTGGCTTGGCATTTCTGTCATACAAGTACTGCAAGCGCTCTAAGCAAGGGAAAACACAACGAAGCCAACAGGAATTGAGCCCGGTGTCTTCATTCTGA",
    protein: {
      accession: "NP_002290.2",
      length: 1927,
      sequence: "MELSWHVVFIALLSFSCWGSDWESDRNFISTAGPLTNDLLHNLSGLLGDQSSNFVAGDKDMYVCHQPLPTFLPEYFSSLHASQITHYKVFLSWAQLLPAGSTQNPDEKTVQCYRRLLKALKTARLQPMVILHHQTLPASTLRRTEAFADLFADYATFAFHSFGDLVGIWFTFSDLEEVIKELPHQESRASQLQTLSDAHRKAYEIYHESYAFQGGKLSVVLRAEDIPELLLEPPISALAQDTVDFLSLDLSYECQNEASLRQKLSKLQTIEPKVKVFIFNLKLPDCPSTMKNPASLLFSLFEAINKDQVLTIGFDINEFLSCSSSSKKSMSCSLTGSLALQPDQQQDHETTDSSPASAYQRIWEAFANQSRAERDAFLQDTFPEGFLWGASTGAFNVEGGWAEGGRGVSIWDPRRPLNTTEGQATLEVASDSYHKVASDVALLCGLRAQVYKFSISWSRIFPMGHGSSPSLPGVAYYNKLIDRLQDAGIEPMATLFHWDLPQALQDHGGWQNESVVDAFLDYAAFCFSTFGDRVKLWVTFHEPWVMSYAGYGTGQHPPGISDPGVASFKVAHLVLKAHARTWHHYNSHHRPQQQGHVGIVLNSDWAEPLSPERPEDLRASERFLHFMLGWFAHPVFVDGDYPATLRTQIQQMNRQCSHPVAQLPEFTEAEKQLLKGSADFLGLSHYTSRLISNAPQNTCIPSYDTIGGFSQHVNHVWPQTSSSWIRVVPWGIRRLLQFVSLEYTRGKVPIYLAGNGMPIGESENLFDDSLRVDYFNQYINEVLKAIKEDSVDVRSYIARSLIDGFEGPSGYSQRFGLHHVNFSDSSKSRTPRKSAYFFTSIIEKNGFLTKGAKRLLPPNTVNLPSKVRAFTFPSEVPSKAKVVWEKFSSQPKFERDLFYHGTFRDDFLWGVSSSAYQIEGAWDADGKGPSIWDNFTHTPGSNVKDNATGDIACDSYHQLDADLNMLRALKVKAYRFSISWSRIFPTGRNSSINSHGVDYYNRLINGLVASNIFPMVTLFHWDLPQALQDIGGWENPALIDLFDSYADFCFQTFGDRVKFWMTFNEPMYLAWLGYGSGEFPPGVKDPGWAPYRIAHAVIKAHARVYHTYDEKYRQEQKGVISLSLSTHWAEPKSPGVPRDVEAADRMLQFSLGWFAHPIFRNGDYPDTMKWKVGNRSELQHLATSRLPSFTEEEKRFIRATADVFCLNTYYSRIVQHKTPRLNPPSYEDDQEMAEEEDPSWPSTAMNRAAPWGTRRLLNWIKEEYGDIPIYITENGVGLTNPNTEDTDRIFYHKTYINEALKAYRLDGIDLRGYVAWSLMDNFEWLNGYTVKFGLYHVDFNNTNRPRTARASARYYTEVITNNGMPLAREDEFLYGRFPEGFIWSAASAAYQIEGAWRADGKGLSIWDTFSHTPLRVENDAIGDVACDSYHKIAEDLVTLQNLGVSHYRFSISWSRILPDGTTRYINEAGLNYYVRLIDTLLAASIQPQVTIYHWDLPQTLQDVGGWENETIVQRFKEYADVLFQRLGDKVKFWITLNEPFVIAYQGYGYGTAAPGVSNRPGTAPYIVGHNLIKAHAEAWHLYNDVYRASQGGVISITISSDWAEPRDPSNQEDVEAARRYVQFMGGWFAHPIFKNGDYNEVMKTRIRDRSLAAGLNKSRLPEFTESEKRRINGTYDFFGFNHYTTVLAYNLNYATAISSFDADRGVASIADRSWPDSGSFWLKMTPFGFRRILNWLKEEYNDPPIYVTENGVSQREETDLNDTARIYYLRTYINEALKAVQDKVDLRGYTVWSAMDNFEWATGFSERFGLHFVNYSDPSLPRIPKASAKFYASVVRCNGFPDPATGPHACLHQPDAGPTISPVRQEEVQFLGLMLGTTEAQTALYVLFSLVLLGVCGLAFLSYKYCKRSKQGKTQRSQQELSPVSSF",
      source: {
        db: "NCBI Protein (RefSeq)",
        url: "https://www.ncbi.nlm.nih.gov/protein/NP_002290.2",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=protein&id=NP_002290.2&rettype=fasta&retmode=text",
        retrieved: "2026-10-18"
      }
    },
    uniprot: {
      accession: "P09848",
      reviewed: true,
      entryType: "UniProtKB reviewed (Swiss-Prot)",
      entryVersion: 220,
      lastAnnotationUpdate: "2026-09-02",
      proteinName: "Lactase/phlorizin hydrolase",
      proteinExistence: "1: Evidence at protein level",
      ec: [],
      length: 1927,
      sameSequenceAsRefSeq: true,
      function: {
        quote: "Broad specificity glycosidase of the intestinal brush border membrane that hydrolyzes lactose, the main sugar in mammalian milk, to produce D-glucose and D-galactose (PubMed:12594539, PubMed:16400612, PubMed:3929764, PubMed:9762914).",
        shortened: true,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "12594539"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "16400612"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "3929764"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "9762914"
          }
        ]
      },
      catalytic: [
        {
          reaction: "lactose + H2O = beta-D-galactose + D-glucose",
          ec: "3.2.1.108",
          rhea: "RHEA:10076",
          evidence: [
            "ECO:0000269"
          ]
        },
        {
          reaction: "phlorizin + H2O = phloretin + beta-D-glucose",
          ec: null,
          rhea: "RHEA:69639",
          evidence: [
            "ECO:0000269"
          ]
        }
      ],
      subunit: {
        quote: "Homodimer",
        shortened: false,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "3929764"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "9593732"
          }
        ]
      },
      tissue: {
        quote: "Specifically expressed in small intestine",
        shortened: false,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "2460343"
          }
        ]
      },
      induction: null,
      interactions: [],
      pathways: [
        {
          db: "Reactome",
          id: "R-HSA-189085",
          name: "Digestion of dietary carbohydrate"
        },
        {
          db: "Reactome",
          id: "R-HSA-5659898",
          name: "Intestinal saccharidase deficiencies"
        }
      ],
      pathwayTotal: 2,
      otherPathwayXrefs: [
        "KEGG:hsa:3938",
        "BioCyc:MetaCyc:HS03945-MONOMER"
      ],
      diseases: [
        {
          name: "Congenital lactase deficiency",
          acronym: "COLACD",
          mim: "223000",
          note: "The disease is caused by variants affecting the gene represented in this entry",
          evidence: [
            "ECO:0000269"
          ]
        }
      ],
      polymorphism: null,
      pdbTotal: 0,
      alphafold: "P09848",
      source: {
        db: "UniProtKB",
        url: "https://www.uniprot.org/uniprotkb/P09848/entry",
        api: "https://rest.uniprot.org/uniprotkb/P09848.json",
        retrieved: "2026-10-18"
      }
    },
    structure: null,
    variants: [
      {
        clinvarId: 7685,
        accession: "VCV000007685",
        title: "NM_002299.2(LCT):c.-13907C>T",
        transcript: "NM_002299.2",
        hgvsC: "c.-13907C>T",
        hgvsP: null,
        type: "single nucleotide variant",
        classification: "association",
        dbSNP: "rs4988235",
        reviewStatus: "no assertion criteria provided",
        traits: [
          "LACTASE PERSISTENCE"
        ],
        source: {
          db: "ClinVar",
          url: "https://www.ncbi.nlm.nih.gov/clinvar/variation/7685/",
          api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&id=7685&retmode=json",
          retrieved: "2026-10-18"
        }
      }
    ]
  },
  {
    key: "OCA2",
    gene: {
      geneId: 4948,
      symbol: "OCA2",
      description: "OCA2 melanosomal transmembrane protein",
      organism: "Homo sapiens",
      taxId: 9606,
      chromosome: "15",
      mapLocation: "15q12-q13.1",
      genomic: {
        accession: "NC_000015.10",
        start: 27719008,
        end: 28099315,
        strand: "-",
        exonCount: 30
      },
      source: {
        db: "NCBI Gene",
        url: "https://www.ncbi.nlm.nih.gov/gene/4948",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=4948&retmode=json",
        retrieved: "2026-10-18"
      }
    },
    genomicExons: [
      {
        n: 1,
        geneStart: 1,
        geneEnd: 92,
        chrStart: 28099224,
        chrEnd: 28099315,
        length: 92
      },
      {
        n: 2,
        geneStart: 17421,
        geneEnd: 17668,
        chrStart: 28081648,
        chrEnd: 28081895,
        length: 248
      },
      {
        n: 3,
        geneStart: 67153,
        geneEnd: 67251,
        chrStart: 28032065,
        chrEnd: 28032163,
        length: 99
      },
      {
        n: 4,
        geneStart: 71257,
        geneEnd: 71445,
        chrStart: 28027871,
        chrEnd: 28028059,
        length: 189
      },
      {
        n: 5,
        geneStart: 74414,
        geneEnd: 74471,
        chrStart: 28024845,
        chrEnd: 28024902,
        length: 58
      },
      {
        n: 6,
        geneStart: 76743,
        geneEnd: 76815,
        chrStart: 28022501,
        chrEnd: 28022573,
        length: 73
      },
      {
        n: 7,
        geneStart: 80759,
        geneEnd: 80919,
        chrStart: 28018397,
        chrEnd: 28018557,
        length: 161
      },
      {
        n: 8,
        geneStart: 83130,
        geneEnd: 83212,
        chrStart: 28016104,
        chrEnd: 28016186,
        length: 83
      },
      {
        n: 9,
        geneStart: 84387,
        geneEnd: 84540,
        chrStart: 28014776,
        chrEnd: 28014929,
        length: 154
      },
      {
        n: 10,
        geneStart: 108669,
        geneEnd: 108740,
        chrStart: 27990576,
        chrEnd: 27990647,
        length: 72
      },
      {
        n: 11,
        geneStart: 109650,
        geneEnd: 109715,
        chrStart: 27989601,
        chrEnd: 27989666,
        length: 66
      },
      {
        n: 12,
        geneStart: 112673,
        geneEnd: 112729,
        chrStart: 27986587,
        chrEnd: 27986643,
        length: 57
      },
      {
        n: 13,
        geneStart: 114128,
        geneEnd: 114252,
        chrStart: 27985064,
        chrEnd: 27985188,
        length: 125
      },
      {
        n: 14,
        geneStart: 115833,
        geneEnd: 115971,
        chrStart: 27983345,
        chrEnd: 27983483,
        length: 139
      },
      {
        n: 15,
        geneStart: 132494,
        geneEnd: 132626,
        chrStart: 27966690,
        chrEnd: 27966822,
        length: 133
      },
      {
        n: 16,
        geneStart: 141581,
        geneEnd: 141728,
        chrStart: 27957588,
        chrEnd: 27957735,
        length: 148
      },
      {
        n: 17,
        geneStart: 144101,
        geneEnd: 144158,
        chrStart: 27955158,
        chrEnd: 27955215,
        length: 58
      },
      {
        n: 18,
        geneStart: 147424,
        geneEnd: 147532,
        chrStart: 27951784,
        chrEnd: 27951892,
        length: 109
      },
      {
        n: 19,
        geneStart: 173062,
        geneEnd: 173189,
        chrStart: 27926127,
        chrEnd: 27926254,
        length: 128
      },
      {
        n: 20,
        geneStart: 227394,
        geneEnd: 227453,
        chrStart: 27871863,
        chrEnd: 27871922,
        length: 60
      },
      {
        n: 21,
        geneStart: 228058,
        geneEnd: 228162,
        chrStart: 27871154,
        chrEnd: 27871258,
        length: 105
      },
      {
        n: 22,
        geneStart: 247841,
        geneEnd: 247934,
        chrStart: 27851382,
        chrEnd: 27851475,
        length: 94
      },
      {
        n: 23,
        geneStart: 254264,
        geneEnd: 254357,
        chrStart: 27844959,
        chrEnd: 27845052,
        length: 94
      },
      {
        n: 24,
        geneStart: 343844,
        geneEnd: 344441,
        chrStart: 27754875,
        chrEnd: 27755472,
        length: 598
      }
    ],
    cdsBlocks: [
      {
        geneStart: 17442,
        geneEnd: 17668
      },
      {
        geneStart: 67153,
        geneEnd: 67251
      },
      {
        geneStart: 71257,
        geneEnd: 71445
      },
      {
        geneStart: 74414,
        geneEnd: 74471
      },
      {
        geneStart: 76743,
        geneEnd: 76815
      },
      {
        geneStart: 80759,
        geneEnd: 80919
      },
      {
        geneStart: 83130,
        geneEnd: 83212
      },
      {
        geneStart: 84387,
        geneEnd: 84540
      },
      {
        geneStart: 108669,
        geneEnd: 108740
      },
      {
        geneStart: 109650,
        geneEnd: 109715
      },
      {
        geneStart: 112673,
        geneEnd: 112729
      },
      {
        geneStart: 114128,
        geneEnd: 114252
      },
      {
        geneStart: 115833,
        geneEnd: 115971
      },
      {
        geneStart: 132494,
        geneEnd: 132626
      },
      {
        geneStart: 141581,
        geneEnd: 141728
      },
      {
        geneStart: 144101,
        geneEnd: 144158
      },
      {
        geneStart: 147424,
        geneEnd: 147532
      },
      {
        geneStart: 173062,
        geneEnd: 173189
      },
      {
        geneStart: 227394,
        geneEnd: 227453
      },
      {
        geneStart: 228058,
        geneEnd: 228162
      },
      {
        geneStart: 247841,
        geneEnd: 247934
      },
      {
        geneStart: 254264,
        geneEnd: 254357
      },
      {
        geneStart: 343844,
        geneEnd: 343928
      }
    ],
    regulatory: [
      {
        regClass: "enhancer",
        geneStart: 54,
        geneEnd: 706,
        partial: false,
        note: "H3K4me1 hESC enhancer chr15:28343756-28344408 (GRCh37/hg19 assembly coordinates)",
        function: "activates a minimal SCP1, AML or CMV promoter by ChIP-STARR-seq in naive and primed H9 embryonic stem cells {active_cell/tissue: H9 hESC(naive and primed)}",
        evidence: {
          text: "reporter gene assay evidence",
          code: "ECO:0000049",
          pmids: [
            "30033119"
          ]
        }
      }
    ],
    genomicSource: {
      db: "NCBI Nucleotide (RefSeq, tabla de características)",
      url: "https://www.ncbi.nlm.nih.gov/nuccore/NC_000015.10?from=27719008&to=28099315",
      api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_000015.10&seq_start=27719008&seq_stop=28100315&strand=2&rettype=ft&retmode=text",
      retrieved: "2026-10-18"
    },
    mrna: {
      accession: "NM_000275.3",
      length: 3143,
      refseqStatus: "REVIEWED",
      mane: true,
      evidenceCodes: [
        "ECO:0000332",
        "ECO:0006172"
      ],
      exons: [
        {
          n: 1,
          start: 1,
          end: 92,
          length: 92,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 2,
          start: 93,
          end: 340,
          length: 248,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 3,
          start: 341,
          end: 439,
          length: 99,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 4,
          start: 440,
          end: 628,
          length: 189,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 5,
          start: 629,
          end: 686,
          length: 58,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 6,
          start: 687,
          end: 759,
          length: 73,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 7,
          start: 760,
          end: 920,
          length: 161,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 8,
          start: 921,
          end: 1003,
          length: 83,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 9,
          start: 1004,
          end: 1157,
          length: 154,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 10,
          start: 1158,
          end: 1229,
          length: 72,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 11,
          start: 1230,
          end: 1295,
          length: 66,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 12,
          start: 1296,
          end: 1352,
          length: 57,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 13,
          start: 1353,
          end: 1477,
          length: 125,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 14,
          start: 1478,
          end: 1616,
          length: 139,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 15,
          start: 1617,
          end: 1749,
          length: 133,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 16,
          start: 1750,
          end: 1897,
          length: 148,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 17,
          start: 1898,
          end: 1955,
          length: 58,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 18,
          start: 1956,
          end: 2064,
          length: 109,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 19,
          start: 2065,
          end: 2192,
          length: 128,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 20,
          start: 2193,
          end: 2252,
          length: 60,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 21,
          start: 2253,
          end: 2357,
          length: 105,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 22,
          start: 2358,
          end: 2451,
          length: 94,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 23,
          start: 2452,
          end: 2545,
          length: 94,
          inference: "alignment:Splign:2.1.0"
        },
        {
          n: 24,
          start: 2546,
          end: 3143,
          length: 598,
          inference: "alignment:Splign:2.1.0"
        }
      ],
      cds: {
        start: 114,
        end: 2630
      },
      source: {
        db: "NCBI Nucleotide (RefSeq)",
        url: "https://www.ncbi.nlm.nih.gov/nuccore/NM_000275.3",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NM_000275.3&rettype=gb&retmode=text",
        retrieved: "2026-10-18"
      }
    },
    cds: "ATGCATCTGGAGGGCAGAGACGGCAGGCGGTACCCCGGCGCGCCGGCGGTGGAGCTCCTGCAGACGTCCGTGCCCAGCGGACTCGCTGAACTTGTGGCCGGCAAGCGCAGGCTTCCTCGGGGAGCCGGTGGAGCTGACCCCTCGCACTCCTGCCCCAGGGGGGCTGCCGGGCAGAGCTCTTGGGCTCCTGCAGGCCAGGAGTTTGCTTCATTCCTCACAAAAGGGAGGTCTCACTCTTCTTTGCCCCAGATGTCCAGCTCCAGGTCTAAAGATTCCTGCTTTACAGAAAACACTCCTTTGCTGAGGAATTCCTTACAGGAGAAAGGGTCACGGTGCATACCTGTTTACCATCCAGAGTTCATCACTGCTGAAGAGTCTTGGGAAGACAGCTCTGCTGACTGGGAGCGAAGATACCTGCTAAGCAGGGAGGTGTCTGGTCTGTCTGCATCTGCCTCCTCCGAGAAGGGAGACCTTCTGGACAGCCCGCACATCCGACTCCGTCTTTCCAAGCTGAGGCGCTGTGTGCAGTGGCTGAAAGTCATGGGCCTGTTTGCCTTTGTGGTGCTGTGTTCTATTTTGTTCAGCCTATATCCGGATCAAGGAAAGCTCTGGCAGCTGTTGGCCTTATCACCGCTGGAGAACTACTCCGTGAACCTTAGCAGCCACGTGGACTCCACGCTGCTGCAGGTGGACCTGGCAGGGGCCCTAGTGGCCAGTGGGCCGAGTCGTCCTGGGAGGGAAGAGCACATCGTGGTGGAGCTGACCCAGGCTGACGCTTTGGGCTCCAGGTGGCGGCGGCCACAGCAGGTCACTCACAACTGGACGGTGTATTTAAATCCGAGGAGAAGCGAGCACTCAGTGATGAGCAGGACCTTTGAGGTACTGACCAGAGAGACGGTGTCCATCAGCATCCGGGCCTCCCTGCAGCAGACCCAGGCTGTCCCTCTTTTGATGGCTCATCAGTACCTCCGCGGAAGTGTAGAAACCCAGGTGACCATCGCGACGGCCATCCTCGCGGGCGTCTACGCGCTGATCATATTTGAGATCGTGCACAGAACTCTGGCGGCCATGCTGGGTTCCCTTGCAGCACTGGCAGCACTGGCTGTGATTGGCGATAGACCCAGCCTGACCCATGTGGTGGAGTGGATTGATTTTGAGACGCTGGCCCTGCTGTTTGGCATGATGATCTTAGTAGCCATATTTTCAGAAACGGGATTTTTCGATTATTGTGCTGTAAAGGCATACCGGCTCTCCCGGGGACGGGTGTGGGCCATGATCATCATGCTCTGTCTCATCGCGGCCGTCCTCTCTGCCTTCTTGGACAACGTCACCACCATGCTCCTCTTCACGCCTGTGACCATAAGGTTGTGTGAGGTGCTCAACCTTGATCCAAGACAAGTCCTGATTGCAGAAGTGATCTTCACAAACATTGGAGGAGCTGCCACTGCCATCGGGGACCCTCCAAATGTCATTATTGTTTCCAACCAAGAGCTGAGGAAGATGGGCCTGGACTTTGCCGGATTCACTGCACACATGTTCATTGGGATTTGCCTTGTTCTCCTGGTCTGCTTTCCGCTCCTCAGACTCCTTTACTGGAACAGAAAGCTTTATAACAAGGAACCCAGTGAGATTGTTGAACTGAAGCACGAGATTCACGTCTGGCGCCTGACTGCTCAGCGCATCAGCCCGGCCAGCCGCGAGGAGACAGCTGTGCGCCGCCTGCTGCTGGGGAAGGTGCTGGCACTGGAGCACCTGCTCGCCCGGAGGCTGCACACCTTCCACAGACAGATCTCACAGGAGGACAAAAATTGGGAGACCAATATCCAAGAACTCCAAAAAAAGCATAGGATATCTGACGGGATTCTGCTCGCCAAATGCCTGACAGTGTTGGGATTTGTTATCTTCATGTTTTTCCTCAATTCGTTTGTCCCTGGCATTCATCTTGATCTTGGATGGATTGCTATTCTGGGTGCCATCTGGTTGCTAATTTTAGCTGATATTCATGATTTTGAGATAATTCTACACAGAGTGGAATGGGCAACCCTTCTGTTTTTTGCAGCGCTCTTTGTTCTGATGGAGGCATTGGCACATCTCCACTTAATAGAATATGTTGGAGAACAAACTGCTTTGCTAATAAAGATGGTCCCAGAGGAGCAGCGCCTCATAGCCGCCATTGTCCTGGTGGTGTGGGTCTCAGCCCTGGCGTCGTCCCTGATTGACAACATCCCGTTCACTGCTACCATGATTCCCGTGCTCCTGAACCTGAGCCACGACCCTGAGGTTGGCCTGCCCGCACCGCCGCTCATGTATGCCCTGGCCTTCGGTGCTTGCCTGGGAGGTAACGGGACACTGATTGGCGCGTCGGCAAACGTCGTGTGTGCAGGGATTGCAGAACAGCATGGATATGGGTTCTCCTTCATGGAATTTTTCAGGCTGGGCTTCCCAATGATGGTTGTGTCCTGCACTGTTGGGATGTGTTATCTCCTTGTGGCTCATGTGGTGGTGGGATGGAATTAA",
    protein: {
      accession: "NP_000266.2",
      length: 838,
      sequence: "MHLEGRDGRRYPGAPAVELLQTSVPSGLAELVAGKRRLPRGAGGADPSHSCPRGAAGQSSWAPAGQEFASFLTKGRSHSSLPQMSSSRSKDSCFTENTPLLRNSLQEKGSRCIPVYHPEFITAEESWEDSSADWERRYLLSREVSGLSASASSEKGDLLDSPHIRLRLSKLRRCVQWLKVMGLFAFVVLCSILFSLYPDQGKLWQLLALSPLENYSVNLSSHVDSTLLQVDLAGALVASGPSRPGREEHIVVELTQADALGSRWRRPQQVTHNWTVYLNPRRSEHSVMSRTFEVLTRETVSISIRASLQQTQAVPLLMAHQYLRGSVETQVTIATAILAGVYALIIFEIVHRTLAAMLGSLAALAALAVIGDRPSLTHVVEWIDFETLALLFGMMILVAIFSETGFFDYCAVKAYRLSRGRVWAMIIMLCLIAAVLSAFLDNVTTMLLFTPVTIRLCEVLNLDPRQVLIAEVIFTNIGGAATAIGDPPNVIIVSNQELRKMGLDFAGFTAHMFIGICLVLLVCFPLLRLLYWNRKLYNKEPSEIVELKHEIHVWRLTAQRISPASREETAVRRLLLGKVLALEHLLARRLHTFHRQISQEDKNWETNIQELQKKHRISDGILLAKCLTVLGFVIFMFFLNSFVPGIHLDLGWIAILGAIWLLILADIHDFEIILHRVEWATLLFFAALFVLMEALAHLHLIEYVGEQTALLIKMVPEEQRLIAAIVLVVWVSALASSLIDNIPFTATMIPVLLNLSHDPEVGLPAPPLMYALAFGACLGGNGTLIGASANVVCAGIAEQHGYGFSFMEFFRLGFPMMVVSCTVGMCYLLVAHVVVGWN",
      source: {
        db: "NCBI Protein (RefSeq)",
        url: "https://www.ncbi.nlm.nih.gov/protein/NP_000266.2",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=protein&id=NP_000266.2&rettype=fasta&retmode=text",
        retrieved: "2026-10-18"
      }
    },
    uniprot: {
      accession: "Q04671",
      reviewed: true,
      entryType: "UniProtKB reviewed (Swiss-Prot)",
      entryVersion: 228,
      lastAnnotationUpdate: "2026-09-02",
      proteinName: "P protein",
      proteinExistence: "1: Evidence at protein level",
      ec: [],
      length: 838,
      sameSequenceAsRefSeq: true,
      function: {
        quote: "Contributes to a melanosome-specific anion (chloride) current that modulates melanosomal pH for optimal tyrosinase activity required for melanogenesis and the melanosome maturation (PubMed:11310796, PubMed:15262401, PubMed:22234890, PubMed:25513726).",
        shortened: true,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "11310796"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "15262401"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "22234890"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "25513726"
          }
        ]
      },
      catalytic: [
        {
          reaction: "chloride(in) = chloride(out)",
          ec: null,
          rhea: "RHEA:29823",
          evidence: [
            "ECO:0000305"
          ]
        }
      ],
      subunit: null,
      tissue: {
        quote: "Expressed in melanocytes and retinal pigment epithelium",
        shortened: false,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "25513726"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "32966160"
          }
        ]
      },
      induction: {
        quote: "Expression is under the control of an enhancer element that is encoded in an intron of the close-by HERC2 gene.",
        shortened: true,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "18172690"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "18252222"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "22234890"
          }
        ]
      },
      interactions: [],
      pathways: [
        {
          db: "Reactome",
          id: "R-HSA-5662702",
          name: "Melanin biosynthesis"
        }
      ],
      pathwayTotal: 1,
      otherPathwayXrefs: [
        "KEGG:hsa:4948"
      ],
      diseases: [
        {
          name: "Albinism, oculocutaneous, 2",
          acronym: "OCA2",
          mim: "203200",
          note: "The disease is caused by variants affecting the gene represented in this entry",
          evidence: [
            "ECO:0000269"
          ]
        }
      ],
      polymorphism: {
        quote: "Genetic variants in OCA2 define the skin/hair/eye pigmentation variation locus 1 (SHEP1) [MIM:227220]; also known as skin/hair/eye pigmentation type 1, blue/nonblue eyes or skin/hair/eye pigmentation type 1, blue/brown eyes or skin/hair/eye pigmentation type 1, blond/brown hair or eye color, brown/blue or eye color, blue/nonblue or eye color type 3 (EYCL3) or brown eye color type 2 (BEY2) or hair color type 3 (HCL3).",
        shortened: true,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "17236130"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "17952075"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "18172690"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "18252221"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "18252222"
          }
        ]
      },
      pdbTotal: 0,
      alphafold: "Q04671",
      source: {
        db: "UniProtKB",
        url: "https://www.uniprot.org/uniprotkb/Q04671/entry",
        api: "https://rest.uniprot.org/uniprotkb/Q04671.json",
        retrieved: "2026-10-18"
      }
    },
    structure: null,
    variants: []
  },
  {
    key: "lacZ",
    gene: {
      geneId: 945006,
      symbol: "lacZ",
      description: "beta-galactosidase",
      organism: "Escherichia coli str. K-12 substr. MG1655",
      taxId: 511145,
      chromosome: null,
      mapLocation: null,
      genomic: {
        accession: "NC_000913.3",
        start: 363231,
        end: 366305,
        strand: "-",
        exonCount: null
      },
      source: {
        db: "NCBI Gene",
        url: "https://www.ncbi.nlm.nih.gov/gene/945006",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=945006&retmode=json",
        retrieved: "2026-10-18"
      }
    },
    genomicExons: [
      {
        n: 1,
        geneStart: 1,
        geneEnd: 3075,
        chrStart: 363231,
        chrEnd: 366305,
        length: 3075
      }
    ],
    cdsBlocks: [
      {
        geneStart: 1,
        geneEnd: 3075
      }
    ],
    regulatory: [],
    genomicSource: {
      db: "NCBI Nucleotide (RefSeq, tabla de características)",
      url: "https://www.ncbi.nlm.nih.gov/nuccore/NC_000913.3?from=363231&to=366305",
      api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_000913.3&seq_start=363231&seq_stop=366605&strand=2&rettype=ft&retmode=text",
      retrieved: "2026-10-18"
    },
    mrna: null,
    cds: "ATGACCATGATTACGGATTCACTGGCCGTCGTTTTACAACGTCGTGACTGGGAAAACCCTGGCGTTACCCAACTTAATCGCCTTGCAGCACATCCCCCTTTCGCCAGCTGGCGTAATAGCGAAGAGGCCCGCACCGATCGCCCTTCCCAACAGTTGCGCAGCCTGAATGGCGAATGGCGCTTTGCCTGGTTTCCGGCACCAGAAGCGGTGCCGGAAAGCTGGCTGGAGTGCGATCTTCCTGAGGCCGATACTGTCGTCGTCCCCTCAAACTGGCAGATGCACGGTTACGATGCGCCCATCTACACCAACGTGACCTATCCCATTACGGTCAATCCGCCGTTTGTTCCCACGGAGAATCCGACGGGTTGTTACTCGCTCACATTTAATGTTGATGAAAGCTGGCTACAGGAAGGCCAGACGCGAATTATTTTTGATGGCGTTAACTCGGCGTTTCATCTGTGGTGCAACGGGCGCTGGGTCGGTTACGGCCAGGACAGTCGTTTGCCGTCTGAATTTGACCTGAGCGCATTTTTACGCGCCGGAGAAAACCGCCTCGCGGTGATGGTGCTGCGCTGGAGTGACGGCAGTTATCTGGAAGATCAGGATATGTGGCGGATGAGCGGCATTTTCCGTGACGTCTCGTTGCTGCATAAACCGACTACACAAATCAGCGATTTCCATGTTGCCACTCGCTTTAATGATGATTTCAGCCGCGCTGTACTGGAGGCTGAAGTTCAGATGTGCGGCGAGTTGCGTGACTACCTACGGGTAACAGTTTCTTTATGGCAGGGTGAAACGCAGGTCGCCAGCGGCACCGCGCCTTTCGGCGGTGAAATTATCGATGAGCGTGGTGGTTATGCCGATCGCGTCACACTACGTCTGAACGTCGAAAACCCGAAACTGTGGAGCGCCGAAATCCCGAATCTCTATCGTGCGGTGGTTGAACTGCACACCGCCGACGGCACGCTGATTGAAGCAGAAGCCTGCGATGTCGGTTTCCGCGAGGTGCGGATTGAAAATGGTCTGCTGCTGCTGAACGGCAAGCCGTTGCTGATTCGAGGCGTTAACCGTCACGAGCATCATCCTCTGCATGGTCAGGTCATGGATGAGCAGACGATGGTGCAGGATATCCTGCTGATGAAGCAGAACAACTTTAACGCCGTGCGCTGTTCGCATTATCCGAACCATCCGCTGTGGTACACGCTGTGCGACCGCTACGGCCTGTATGTGGTGGATGAAGCCAATATTGAAACCCACGGCATGGTGCCAATGAATCGTCTGACCGATGATCCGCGCTGGCTACCGGCGATGAGCGAACGCGTAACGCGAATGGTGCAGCGCGATCGTAATCACCCGAGTGTGATCATCTGGTCGCTGGGGAATGAATCAGGCCACGGCGCTAATCACGACGCGCTGTATCGCTGGATCAAATCTGTCGATCCTTCCCGCCCGGTGCAGTATGAAGGCGGCGGAGCCGACACCACGGCCACCGATATTATTTGCCCGATGTACGCGCGCGTGGATGAAGACCAGCCCTTCCCGGCTGTGCCGAAATGGTCCATCAAAAAATGGCTTTCGCTACCTGGAGAGACGCGCCCGCTGATCCTTTGCGAATACGCCCACGCGATGGGTAACAGTCTTGGCGGTTTCGCTAAATACTGGCAGGCGTTTCGTCAGTATCCCCGTTTACAGGGCGGCTTCGTCTGGGACTGGGTGGATCAGTCGCTGATTAAATATGATGAAAACGGCAACCCGTGGTCGGCTTACGGCGGTGATTTTGGCGATACGCCGAACGATCGCCAGTTCTGTATGAACGGTCTGGTCTTTGCCGACCGCACGCCGCATCCAGCGCTGACGGAAGCAAAACACCAGCAGCAGTTTTTCCAGTTCCGTTTATCCGGGCAAACCATCGAAGTGACCAGCGAATACCTGTTCCGTCATAGCGATAACGAGCTCCTGCACTGGATGGTGGCGCTGGATGGTAAGCCGCTGGCAAGCGGTGAAGTGCCTCTGGATGTCGCTCCACAAGGTAAACAGTTGATTGAACTGCCTGAACTACCGCAGCCGGAGAGCGCCGGGCAACTCTGGCTCACAGTACGCGTAGTGCAACCGAACGCGACCGCATGGTCAGAAGCCGGGCACATCAGCGCCTGGCAGCAGTGGCGTCTGGCGGAAAACCTCAGTGTGACGCTCCCCGCCGCGTCCCACGCCATCCCGCATCTGACCACCAGCGAAATGGATTTTTGCATCGAGCTGGGTAATAAGCGTTGGCAATTTAACCGCCAGTCAGGCTTTCTTTCACAGATGTGGATTGGCGATAAAAAACAACTGCTGACGCCGCTGCGCGATCAGTTCACCCGTGCACCGCTGGATAACGACATTGGCGTAAGTGAAGCGACCCGCATTGACCCTAACGCCTGGGTCGAACGCTGGAAGGCGGCGGGCCATTACCAGGCCGAAGCAGCGTTGTTGCAGTGCACGGCAGATACACTTGCTGATGCGGTGCTGATTACGACCGCTCACGCGTGGCAGCATCAGGGGAAAACCTTATTTATCAGCCGGAAAACCTACCGGATTGATGGTAGTGGTCAAATGGCGATTACCGTTGATGTTGAAGTGGCGAGCGATACACCGCATCCGGCGCGGATTGGCCTGAACTGCCAGCTGGCGCAGGTAGCAGAGCGGGTAAACTGGCTCGGATTAGGGCCGCAAGAAAACTATCCCGACCGCCTTACTGCCGCCTGTTTTGACCGCTGGGATCTGCCATTGTCAGACATGTATACCCCGTACGTCTTCCCGAGCGAAAACGGTCTGCGCTGCGGGACGCGCGAATTGAATTATGGCCCACACCAGTGGCGCGGCGACTTCCAGTTCAACATCAGCCGCTACAGTCAACAGCAACTGATGGAAACCAGCCATCGCCATCTGCTGCACGCGGAAGAAGGCACATGGCTGAATATCGACGGTTTCCATATGGGGATTGGTGGCGACGACTCCTGGAGCCCGTCAGTATCGGCGGAATTCCAGCTGAGCGCCGGTCGCTACCATTACCAGTTGGTCTGGTGTCAAAAATAA",
    protein: {
      accession: "NP_414878.1",
      length: 1024,
      sequence: "MTMITDSLAVVLQRRDWENPGVTQLNRLAAHPPFASWRNSEEARTDRPSQQLRSLNGEWRFAWFPAPEAVPESWLECDLPEADTVVVPSNWQMHGYDAPIYTNVTYPITVNPPFVPTENPTGCYSLTFNVDESWLQEGQTRIIFDGVNSAFHLWCNGRWVGYGQDSRLPSEFDLSAFLRAGENRLAVMVLRWSDGSYLEDQDMWRMSGIFRDVSLLHKPTTQISDFHVATRFNDDFSRAVLEAEVQMCGELRDYLRVTVSLWQGETQVASGTAPFGGEIIDERGGYADRVTLRLNVENPKLWSAEIPNLYRAVVELHTADGTLIEAEACDVGFREVRIENGLLLLNGKPLLIRGVNRHEHHPLHGQVMDEQTMVQDILLMKQNNFNAVRCSHYPNHPLWYTLCDRYGLYVVDEANIETHGMVPMNRLTDDPRWLPAMSERVTRMVQRDRNHPSVIIWSLGNESGHGANHDALYRWIKSVDPSRPVQYEGGGADTTATDIICPMYARVDEDQPFPAVPKWSIKKWLSLPGETRPLILCEYAHAMGNSLGGFAKYWQAFRQYPRLQGGFVWDWVDQSLIKYDENGNPWSAYGGDFGDTPNDRQFCMNGLVFADRTPHPALTEAKHQQQFFQFRLSGQTIEVTSEYLFRHSDNELLHWMVALDGKPLASGEVPLDVAPQGKQLIELPELPQPESAGQLWLTVRVVQPNATAWSEAGHISAWQQWRLAENLSVTLPAASHAIPHLTTSEMDFCIELGNKRWQFNRQSGFLSQMWIGDKKQLLTPLRDQFTRAPLDNDIGVSEATRIDPNAWVERWKAAGHYQAEAALLQCTADTLADAVLITTAHAWQHQGKTLFISRKTYRIDGSGQMAITVDVEVASDTPHPARIGLNCQLAQVAERVNWLGLGPQENYPDRLTAACFDRWDLPLSDMYTPYVFPSENGLRCGTRELNYGPHQWRGDFQFNISRYSQQQLMETSHRHLLHAEEGTWLNIDGFHMGIGGDDSWSPSVSAEFQLSAGRYHYQLVWCQK",
      source: {
        db: "NCBI Protein (RefSeq)",
        url: "https://www.ncbi.nlm.nih.gov/protein/NP_414878.1",
        api: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=protein&id=NP_414878.1&rettype=fasta&retmode=text",
        retrieved: "2026-10-18"
      }
    },
    uniprot: {
      accession: "P00722",
      reviewed: true,
      entryType: "UniProtKB reviewed (Swiss-Prot)",
      entryVersion: 230,
      lastAnnotationUpdate: "2026-09-02",
      proteinName: "Beta-galactosidase",
      proteinExistence: "1: Evidence at protein level",
      ec: [
        "3.2.1.23"
      ],
      length: 1024,
      sameSequenceAsRefSeq: true,
      function: null,
      catalytic: [
        {
          reaction: "Hydrolysis of terminal non-reducing beta-D-galactose residues in beta-D-galactosides.",
          ec: "3.2.1.23",
          rhea: null,
          evidence: []
        }
      ],
      subunit: {
        quote: "Homotetramer",
        shortened: false,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "11045615"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "11732897"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "14621996"
          },
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "8008071"
          }
        ]
      },
      tissue: null,
      induction: {
        quote: "By allolactose",
        shortened: false,
        evidence: [
          {
            code: "ECO:0000269",
            source: "PubMed",
            id: "4562709"
          }
        ]
      },
      interactions: [
        {
          partner: "P00722",
          gene: "lacZ",
          experiments: 3,
          intact: [
            "EBI-369998",
            "EBI-369998"
          ]
        }
      ],
      pathways: [],
      pathwayTotal: 0,
      otherPathwayXrefs: [
        "KEGG:ecj:JW0335",
        "KEGG:eco:b0344",
        "BioCyc:EcoCyc:BETAGALACTOSID-MONOMER",
        "BioCyc:MetaCyc:BETAGALACTOSID-MONOMER"
      ],
      diseases: [],
      polymorphism: null,
      pdbTotal: 81,
      alphafold: "P00722",
      source: {
        db: "UniProtKB",
        url: "https://www.uniprot.org/uniprotkb/P00722/entry",
        api: "https://rest.uniprot.org/uniprotkb/P00722.json",
        retrieved: "2026-10-18"
      }
    },
    structure: {
      pdb: "1DP0",
      title: "E. COLI BETA-GALACTOSIDASE AT 1.7 ANGSTROM",
      method: "X-RAY DIFFRACTION",
      resolution: 1.7,
      released: "2001-02-21",
      chainsUniProt: "A/B/C/D=10-1024",
      doi: null,
      source: {
        db: "RCSB PDB (Data API)",
        url: "https://www.rcsb.org/structure/1DP0",
        api: "https://data.rcsb.org/rest/v1/core/entry/1DP0",
        retrieved: "2026-10-18"
      }
    },
    variants: []
  }
];

/** Códigos ECO usados en GENES: etiqueta y si descienden de «experimental evidence» (ECO:0000006) en la ontología. */
export const ECO: EcoTable = {
  version: "releases/2026-07-10",
  source: {
    db: "Evidence & Conclusion Ontology (ECO)",
    url: "https://www.evidenceontology.org/",
    api: "https://raw.githubusercontent.com/evidenceontology/evidenceontology/master/eco.obo",
    retrieved: "2026-10-18"
  },
  terms: {
    "ECO:0000049": {
      label: "reporter gene assay evidence",
      primaryId: "ECO:0000049",
      experimental: true,
      roots: [
        "experimental evidence"
      ]
    },
    "ECO:0000269": {
      label: "experimental evidence used in manual assertion",
      primaryId: "ECO:0000269",
      experimental: true,
      roots: [
        "experimental evidence"
      ]
    },
    "ECO:0000305": {
      label: "curator inference used in manual assertion",
      primaryId: "ECO:0000305",
      experimental: false,
      roots: [
        "curator inference"
      ]
    },
    "ECO:0000332": {
      label: "whole transcript splice pattern evidence used in automatic assertion",
      primaryId: "ECO:0000332",
      experimental: false,
      roots: [
        "computational evidence",
        "similarity evidence"
      ]
    },
    "ECO:0000348": {
      label: "full support of intron positions by RNA-sequencing alignment evidence used in automatic assertion",
      primaryId: "ECO:0000348",
      experimental: true,
      roots: [
        "experimental evidence"
      ]
    },
    "ECO:0001131": {
      label: "transgenic organism evidence",
      primaryId: "ECO:0001131",
      experimental: true,
      roots: [
        "experimental evidence"
      ]
    },
    "ECO:0005510": {
      label: "deletion mutation phenotypic evidence",
      primaryId: "ECO:0001038",
      experimental: true,
      roots: [
        "experimental evidence"
      ]
    },
    "ECO:0005606": {
      label: "cell transfection experiment evidence",
      primaryId: "ECO:0005606",
      experimental: true,
      roots: [
        "experimental evidence"
      ]
    },
    "ECO:0006172": {
      label: "mixed support of intron positions by RNA-sequencing alignment evidence",
      primaryId: "ECO:0006172",
      experimental: true,
      roots: [
        "experimental evidence"
      ]
    }
  }
};
