# G1 data audit: SenGuard-MSC

**Status: CONDITIONAL** (G0: PASS) · run 2026-11-01T10:42:47Z · notebook 00_environment_and_data_audit v1.0.0 · seed 42 · runtime: kaggle

Evidence tags: `[measured]` this run · `[GEO]` metadata text · `[published]` literature checked in this run · `[inference]` our reasoning.

## Decision
**Proposed, pending your review of this run:** train and reproduce on GSE284666 (induced condition vs control, leave-one-cell-type-out). The MSC cohorts carry no assay-confirmed per-sample senescence label in their deposits, so the primary MSC endpoint should be within-donor senescence-signature trajectory (GSE309666) with GSE178514 as supporting evidence, reporting no AUROC against passage.

Label definitions and model architecture are not locked by this document.

## Feasibility by study
| study | context | samples | independent_donors | passages_or_conditions | senescence_evidence | file | matrix | supervised_training | cannot_conclude |
|---|---|---|---|---|---|---|---|---|---|
| GSE284666 (SenCat) | 14 primary cell types incl. BMMSC and preadipocytes; total-RNA NovaSeq; induced senescence | 190 | not provided; group by cell_line (14) | proliferating and vector controls vs senescence paradigms | [GEO] treatment per sample; [published] paradigm-level BrdU and SA-beta-gal confirmation. PMC full text, references removed; term counts {'SA_beta_gal': 5, 'p16_CDKN2A': 7, 'p21_CDKN1A': 11, 'BrdU_EdU': 4, 'suffix_393_411_413': 0} | 41,850,880 bytes, validated | 60,605 genes x 190 samples; ids ensembl; integer counts | Yes, as induced condition vs control, with leave-one-cell-type-out | Donor-independent performance; replicative senescence; potency. Published coefficients were fit with BMMSC in the data, so transport to BM-MSC is not cell-type independent unless BMMSC is held out and refit. |
| GSE309666 (AD-MSC) | polyA DNBSEQ; human platelet lysate culture | 18 | 5 stated in GEO | p1, p3, p6 (D, E), final p7-p10; donor B has p7 and p8 | [published] growth cessation at final passage for donors A-C only; D and E stopped at p10. PMC full text, references removed; term counts {'SA_beta_gal': 0, 'p16_CDKN2A': 0, 'p21_CDKN1A': 0, 'BrdU_EdU': 0, 'suffix_393_411_413': 1} | 1,611,287 bytes, validated | 78,458 genes x 18 samples; ids ensembl; non-integer, unequal column sums: estimated counts or FPKM; not separable from distribution alone | No. Passage is not a label; use within-donor trajectories | Per-sample senescent status; assay concordance; potency or safety. Its 40 published biomarkers came from this cohort, so testing them here is circular. |
| GSE178514 (BM-MSC) | rRNA-depleted total RNA; BGISEQ-500 per GEO; FBS culture | 9 | [published] three donors; GEO does not map them to its 3 title suffixes, see identity test | P4, P6, P12 x 3 | [published] SA-beta-gal by passage, P4-P12, reported at group level in the prior paper, not per sequenced sample. Prior paper: PMC full text, references removed; term counts {'SA_beta_gal': 7, 'p16_CDKN2A': 0, 'p21_CDKN1A': 0, 'BrdU_EdU': 5, 'suffix_393_411_413': 0} | 393,751 bytes, validated | 20,438 genes x 9 samples; ids entrez_like; non-integer, unequal column sums: estimated counts or FPKM; not separable from distribution alone | No. n=9 with no per-sample assay label; trajectory only | Donor-level inference unless pairing is confirmed; count-based statistics on an FPKM table; per-sample senescent status. |

## Sources
| accession | route | samples_parsed | samples_listed_in_series | expected_at_authoring | title | pubmed | public | retrieved |
|---|---|---|---|---|---|---|---|---|
| GSE284666 | family_soft:https | 190 | 190 | 190 | SenCat: Redefining human cell senescence through multiomic profiling of multiple senescent cell types | 42276073 | Public on Jun 15 2026 | 2026-11-01 |
| GSE309666 | family_soft:https | 18 | 18 | 18 | Assessing Senescence in ASC Product and Discovery of Potential Biomarkers | 41791726 | Public on Mar 11 2026 | 2026-11-01 |
| GSE178514 | family_soft:https | 18 | 18 | 18 | Effects of Long-term Culture on the Biological Characteristics and ceRNA Network-associated RNA Profiles of Human Bone Marrow-derived Mesenchymal Stem Cells | 37831180 | Public on Jun 21 2021 | 2026-11-01 |

## Files
| file | route | bytes | declared_bytes | sha256 |
|---|---|---|---|---|
| GSE284666_RAW.tar | curl | 41850880 | 41850880 | 69a29d9fb01169e8f4058defbba2f8ddb4b61854d907f422e3b6bd63242d7f24 |
| GSE309666_salmon_gene_counts.tsv.gz | https | 1611287 | 1611287 | fe1b7491fb7ff91038712d60e4b463ddda86e6d8fdb5efee36b78adef7e2eed1 |
| GSE178514_AllGeneFPKM_mRNA.txt.gz | ftp | 393751 | 393751 | 545a1c6431304a79799c7a43453c8aa479fafe92eca468e5db69bb50a1db5ef5 |

## Measured matrix properties
| accession | n_genes | n_samples | gene_id_type | duplicate_gene_ids | na_share | integer_share_nonzero | min | max | median_col_sum | col_sum_cv | zero_share | scale_inferred |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GSE309666 | 78458 | 18 | ensembl | 0 | 0.0 | 0.6843 | 0.0 | 2304668.482 | 20736309.446500003 | 0.0191 | 0.6842 | non-integer, unequal column sums: estimated counts or FPKM; not separable from distribution alone |
| GSE178514 | 20438 | 9 | entrez_like | 0 | 0.0 | 0.0077 | 0.0 | 14014.79 | 330247.70999999996 | 0.0586 | 0.1112 | non-integer, unequal column sums: estimated counts or FPKM; not separable from distribution alone |
| GSE284666 | 60605 | 190 | ensembl | 0 | 0.0 | 1.0 | 0.0 | 30901523.0 | 164802364.5 | 0.144 | 0.583 | integer counts |

## Reconciliation
- **GSE309666:** `{"geo_records": 18, "counts_from_geo": {"p1": 5, "p3": 5, "p6": 2, "final": 5}, "paper_design": {"p1": 5, "p3": 5, "p6": 2, "final": 5}, "records_outside_paper_design": [{"sample_id": "GSM9271440", "donor": "B", "passage": 7.0, "title": "adipose stromal cells, passage 7, donor B"}], "final_passage_by_donor": {"D": 10, "B": 8, "E": 10, "C": 9, "A": 7}, "resolution": "[inference] GSM9271440 (donor B, p7) is the 18th record: GEO holds this donor's p7 and its final passage, while the paper's design counts only the final one. Paper statement checked in this run: True. The paper does not name this sample, so this is not an author-stated exclusion. Retained and flagged."}`
- **GSE178514:** `{"gsm_records": 18, "mrna_records": 9, "mirna_records": 9, "mrna_generation_conflicts": 6, "generation_tracks_suffix": true}`

## Identity test, exploratory
`{"GSE309666_positive_control": {"n_samples": 18, "n_genes": 2000, "within_minus_between_spearman": 0.4061, "perm_p": 0.0001, "n_perm": 9999}, "GSE178514_suffix": {"n_samples": 9, "n_genes": 2000, "within_minus_between_spearman": 0.9311, "perm_p": 0.0284, "n_perm": 9999}, "GSE178514_sex_by_suffix": {"393": {"Y-low (XIST not in table)": 3}, "411": {"Y-low (XIST not in table)": 3}, "413": {"Y-high (XIST not in table)": 3}}}`

Shared identity cannot separate donor from batch.

## Marker coverage, identifiers only
| marker_set | accession | matched_via | gene_id_type | n_features | n_present | pct_present | pct_abs_weight_present | n_detected_any_sample |
|---|---|---|---|---|---|---|---|---|
| SenCat_transcriptomics | GSE309666 | ensembl | ensembl | 5000 | 4985 | 99.7 | 99.3 | 4970 |
| SenCat_transcriptomics | GSE178514 | ensembl, via NCBI gene_info | entrez_like | 5000 | 4838 | 96.8 | 95.8 | 4838 |
| SenCat_transcriptomics | GSE284666 | ensembl | ensembl | 5000 | 5000 | 100.0 | 100.0 | 5000 |
| hUSI_SenOCLR | GSE309666 | symbol | ensembl | 13346 | 13324 | 99.8 | 99.7 | 12847 |
| hUSI_SenOCLR | GSE178514 | symbol, via NCBI gene_info | entrez_like | 13346 | 12680 | 95.0 | 92.7 | 12680 |
| hUSI_SenOCLR | GSE284666 | symbol, bridged from the GSE309666 annotation | ensembl | 13346 | 13318 | 99.8 | 99.7 | 13296 |

## Open issues
| severity | dataset | message |
|---|---|---|
| NOTE | GSE309666 | 1 samples flagged for review (robust z > 3.5); none removed. |
| CONDITION | GSE309666 | non-integer, unequal column sums: estimated counts or FPKM; not separable from distribution alone. Median column sum 20,736,309, so the GEO phrase 'TPM-like' is not supported if this is far from 1e6. Decide its handling in notebook 01. |
| CONDITION | GSE178514 | non-integer, unequal column sums: estimated counts or FPKM; not separable from distribution alone. The GEO "raw gene counts" note is not supported; do not feed this table to DESeq2. |
| NOTE | GSE284666 | 8 samples flagged for review (robust z > 3.5); none removed. |
| NOTE | GSE309666 | [inference] GSM9271440 (donor B, p7) is the 18th record: GEO holds this donor's p7 and its final passage, while the paper's design counts only the final one. Paper statement checked in this run: True. The paper does not name this sample, so this is not an author-stated exclusion. Retained and flagged. |
| CONDITION | GSE178514 | The generation field conflicts with the title and treatment passage in 6/9 mRNA samples, and tracks the title suffix instead. Passage taken from title and treatment; generation not used. Worth asking the submitters. |
| NOTE | GSE178514 | Instrument conflict inside the record: ['BGISEQ-500 (GPL23227)'] vs an Illumina HiSeq statement in the processing text. |
| NOTE | GSE309666 | All samples share one sex-linked expression pattern ({'XIST-high, Y-low': 18}). Results may not extend to the other sex; exploratory call, not donor records. |
| CONDITION | GSE178514 | Donor identity is unconfirmed. Suffix identity test: effect 0.9311, p=0.0284; positive control effect 0.4061, p=0.0001. Sex-linked pattern by suffix: {'393': {'Y-low (XIST not in table)': 3}, '411': {'Y-low (XIST not in table)': 3}, '413': {'Y-high (XIST not in table)': 3}}. With 3 x 3 samples the smallest reachable p is about 1/36. A strong result supports shared biological identity but cannot prove donor; only the submitters or papers can confirm. |
| NOTE | GSE178514 | 25 of 20438 ids have no current symbol in gene_info. |
| CONDITION | SenCat_transcriptomics | The repo marker file has 5000 features, while the paper's Methods describe a top-1000 selection followed by intersection across 14 models. Confirm in G2 which feature set is the published score before reproducing it. |

## Standing limits
- Senescence is not potency: nothing here supports claims on T-cell suppression, immune function or clinical safety.
- Passage correlates with senescence but is not a binary ground truth.
- Sample count is not donor count.
- No senescence score was computed in this notebook, and no MSC expression value informed any choice in it.
- G2 cautions: `marker_classifier.py` applies log1p itself (avoid double log) and sums coef x expression with no intercept. hUSI min-max scales within a cohort, so report its raw Spearman value when comparing across datasets.
