# Methods

Evidence tags: `[measured]` computed in this project's runs · `[published]` taken from a cited paper · `[inference]` our reasoning. No illustrative mock-ups are used.

## Data
| Cohort | Role | Samples | Grouping | Scale |
|---|---|---|---|---|
| GSE284666 (SenCat) | Development | 190 (126 senescence-induced, 64 control) | 14 cell types; no donor data | featureCounts integers |
| GSE309666 | Primary MSC evaluation | 18 | 5 donors from GEO | Salmon-derived, non-integer; column sums about 20.7M, so not TPM |
| GSE178514 | Supporting MSC evaluation | 9 mRNA (9 miRNA records excluded) | 3 ids inferred from title suffixes | FPKM |

The file checksums matched between local and Kaggle downloads. Sample-level records are in `tables/sample_manifest.csv`.

## Labels
Development labels follow the authors' `assemble_anndata.py`: `P` and `EV` are controls and every other treatment is senescence-induced. Passage is never used as a label. GSE309666 has growth-arrest status per donor only: donors A-C at final passage `[published]`, while D and E stopped at passage 10 and are censored.

## Reproducing the published score
Median-of-ratios size factors were implemented directly so that they can be fit within folds. They match PyDESeq2 0.5.4 to 1e-14 `[measured]`. The score is `log1p` applied once, then a weighted sum with no intercept, as in `marker_classifier.py`. The published marker file corresponds to config `loose5000f`, not the top-1000 selection the paper's Methods describe.

## Development benchmark
Nested leave-one-cell-type-out over 14 cell types, for L1 logistic, elastic net, linear SVM, RBF SVM, random forest and XGBoost. The reference, gene filters, feature selection, hyperparameters and threshold all come from training cell types. Uncertainty is a percentile bootstrap over cell types. The selection rule was written down before MSC scoring: highest mean within-type AUROC, with models within 0.01 tied and the simplest chosen.

## Freeze
`reports/ANALYSIS_PROTOCOL.md` and all weights were hashed before MSC scores were computed, and notebook 03 stops if a hash differs. Weights refit without BMMSC, and without BMMSC plus preadipocytes, provide a cell-type-independent sensitivity analysis.

## External evaluation
Per-donor slope of score per passage (primary), Spearman rho, and last minus first passage. Across donors: exact two-sided sign-flip test, whose smallest possible p is 0.0625 with 5 donors and 0.25 with 3. Competitive nulls use 1,000 draws of shuffled weights and 1,000 of random expressed genes. No thresholds, probabilities or classification metrics are applied to MSC samples.

## Extensions
Leave-one-cell-type-and-paradigm-out, normalization and feature-family ablations, panels of 10-30 genes selected inside folds, Mondrian conformal sets on held-out cell types, and frozen BulkFormer embeddings (checkpoint `v1plus-stage1-epoch17-update126055`, batch size 1, SHA256 verified, no fine-tuning).

## Amendment 1: extended evaluation
Written and hashed before any added cohort was scored (`reports/ANALYSIS_AMENDMENT_1.md`), with deviations in `reports/AMENDMENT1_DEVIATIONS.md`. Added GSE137186, GSE275980, GSE125632, GSE194298, GSE119987, GSE56362, GSE233634, GSE269586 and GSE48662. Pooled test: exact binomial on donors and a cohort-level sign-flip. Log1p weighted score on RNA-seq, rank-weighted form on arrays. Identity check on RPS4Y1, independent of any score. Head-to-head in rank form, leaving each score's training cohort out of its count.

## Drift clock
Ridge regression of within-donor log2(passage + 1) on within-sample gene ranks over 7,845 shared genes, validated leaving out each cohort, with strength chosen by inner cohort hold-out. Negative control: passages shuffled within donors. It estimates passage-like drift, not senescence or potency. It entered the demo through a gate set in advance: median rho of at least 0.8, at least 90% of donors rising, shuffled median rho under 0.3.

## Prototype
A browser tool (`site/`) and a Python command-line tool (`senguard_msc/src/senguard_qc.py`). Depth thresholds come from read thinning of two cohorts, and the identity check from the GSE125632 finding. Automated tests compare browser and Python outputs: 28 browser tests and 14 Python tests pass. The tests were written by the project team on retrospective data; no external user has tried the tool.

## Culture twin interface
A 3D view built only from measured data: score against passage by donor, and PCA of the 500 most variable genes (verified against numpy). It doesn't simulate cells.

## Forecast back-test
Each donor's last passage was predicted from its earlier ones, in 16 donors across 5 RNA-seq cohorts (`tables/forecast_backtest.csv`). The rule set beforehand: beat carrying the last value forward in at least 70% of donors and in at least 4 of 5 cohorts. Result: 63% of donors and 4 of 5 cohorts, direction right in 15 of 16, so it failed and the interface shows no forecast.

## Runtime
Kaggle Notebooks with Tesla T4 for kernels A and C, CPU for B and D. Python 3.13.15, scikit-learn 1.6.1, xgboost 3.4.1, torch 2.11.0+cu128. Seed 42. XGBoost ran on GPU, while scikit-learn models ran on CPU; cuML was compared on one fold and was slower for logistic and RBF SVM at this data size.
