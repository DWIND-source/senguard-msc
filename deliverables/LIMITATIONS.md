# Limitations

## What these data cannot show
- **Senescence is not potency.** Nothing here supports a claim about T-cell suppression, immune function, therapeutic effect or clinical safety.
- **No MSC sample has a per-sample senescence assay.** The result is a trend against passage, not accuracy against truth. GSE178514's SA-beta-gal data come from a related paper at group level, not per sequenced sample.
- **Passage is entangled with time in culture.** Sequencing batch per sample is unknown in both MSC cohorts, so batch or culture drift could contribute to a passage trend.
- **The score may not track growth arrest.** Donor E reached 12.7 at passage 10 without reported arrest, close to arrested donors A-C (12.5-13.1), while donor D reached 7.6. With five donors this is descriptive.

## What the extended evaluation showed against the score
- **It moves early.** It rose in 9 of 11 donors during short GMP expansion of a product reported as transcriptomically stable, so it partly reflects culture adaptation.
- **It isn't potency.** It rose in 3 of 4 donors of GSE137186, where the authors report that immunoregulatory function was maintained, and showed no link to GVHD response in 8 lots (one-sided p = 0.63).
- **It doesn't always rise.** GSE233634 fell overall, and 3 of 22 donors in the headline analysis fell.
- **It isn't uniquely good.** CDKN2A, IL6 and SenMayo matched it on donors rising (27/30), with overlapping intervals. Passage direction is an easy test that many genes pass.
- **Absolute values do not travel.** Earliest-passage means ranged from -5.6 to 11.4 across count-based cohorts, and medium shifted scores by 3.5 at the same donor and passage.
- **RNA-seq alone is weaker.** New RNA-seq cohorts passing the identity check gave 9 of 12 donors (p = 0.15); arrays contribute much of the pooled power, in a rank form and with lower signature coverage.

## The twin is a record, not a simulation
It shows measured samples and inference from them. It doesn't model cell behaviour and it doesn't forecast: a next-passage forecast was tested and failed its preset rule (better than carrying the last value forward in 63% of donors, against 70% required).

## Choices made after seeing results
Excluding GSE125632 was not planned. The identity check is independent of any score, but it ran after the cohort's result was seen, so both numbers are always reported. The clock's gate was first failed with that cohort included.

## Sample size
- Five donors and three inferred donors: the exact sign-flip test cannot go below p = 0.0625 and 0.25. Each donor has only 3-4 points, so per-donor rho is coarse.
- Development replicates sit inside a cell line, so sample counts overstate independent evidence. Dose and duration vary by cell type, and paradigms are not crossed with cell type.

## Independence
- **Published SenCat weights were fit with BMMSC in the data.** Refit weights excluding BMMSC and preadipocytes are the cell-type-independent version.
- **hUSI was trained on GSE178514** (9 rows labelled P4/P6 proliferating and P12 senescent), so its GSE178514 result is circular.
- **The 40 AD-MSC biomarkers were derived from GSE309666**, so only GSE178514 tests them independently.
- **BulkFormer pretraining includes ARCHS4.** Overlap with these cohorts was not verified, so independence isn't claimed. GSE178514 was skipped because coverage was 83.5%, under the 90% recommended.
- **GSE178514 is not new to MSC signature work.** Yang et al. 2023 used it as a discovery set.

## Technical
- GSE178514 is an FPKM mRNA table, so the score's absolute value isn't comparable with SenCat or AD-MSC. Its PCA nearest neighbour is PBMC for all 9 samples, which we read as a scale artifact and not biology.
- Donor identity in GSE178514 is inferred from title suffixes, sex-linked expression and an identity test, and no source states the mapping. Its `generation` field conflicts with passage.
- Culture systems (platelet lysate vs FBS) and libraries (polyA vs rRNA-depleted) differ across cohorts.
- All 18 AD-MSC samples show the same sex-linked pattern (exploratory), so results may not extend to male donors.
- SenMayo's rank score depends on the gene universe: mean AUROC was 1.00 with filtered normalized genes and 0.974 with all genes.

## Development ceiling
Mean AUROC near 1 reflects an easy contrast between strongly induced senescence and proliferating controls, so it can't rank methods. BJ RasV12 is the exception: gene models and proliferation scores reach AUROC 0 on it when that cell type is held out, while hUSI and SenMayo reach 1.0. Conformal coverage was 0.895 overall but 0.50 for BJ, where all 8 controls were called senescent-like.

## Scope of the novelty claim
The literature search was not systematic, so no "first" claim is made.
