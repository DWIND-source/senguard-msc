# SenGuard-MSC analysis protocol

Fixed on 2026-11-01, before any senescence score was computed on an MSC cohort.
It follows G1 and the endpoint the project lead approved.

## Endpoints
1. Development (GSE284666): induced senescence vs control, 14 cell types. Unit of held-out validation: cell type.
2. Primary MSC endpoint (GSE309666): within-donor change in the published SenCat score across passage.
3. Supporting MSC evidence (GSE178514): same statistic in three putative donors, FPKM-derived.
4. Labelled MSC check: the BMMSC cell type held out of development folds. This is one cell line, so it is a case, not a population estimate.

Passage is not a label. No AUROC, accuracy or calibration is computed against passage.

## Model selection rule (development data only)
- Metric: mean over held-out cell types of the within-cell-type AUROC from nested leave-one-cell-type-out.
- All fold-dependent steps (reference, gene filters, feature selection, tuning, threshold) use training cell types only.
- Choice: highest mean. Any candidate within 0.01 of the best counts as tied, and the simplest wins, in the order
  logreg_l1, elastic_net, linear_svm, rbf_svm, random_forest, xgboost.
- Weights and models are saved with hashes before notebook 03 loads MSC scores.

## External statistics
- Per donor: slope of score per passage (primary), Spearman rho, last minus first passage.
- Across donors: mean slope with an exact two-sided sign-flip test. Five donors give a smallest possible p of 0.0625 and three give 0.25,
  so no conventional significance is reachable by design; effect sizes and direction are the result.
- Competitive null: 1,000 draws shuffling weights among the same genes, and 1,000 draws of random expressed genes. Two-sided empirical p.
- Primary score: published SenCat weights. All other scores (hUSI, SenMayo, Hallmark proliferation, refit models, panels) are secondary and reported without selection.
- Independence: refit weights that exclude BMMSC, and exclude BMMSC plus preadipocytes, are the cell-type-independent sensitivity analysis.

## Handling
- External samples are never removed on score grounds; GSM9271440 (donor B p7) stays in, with a sensitivity analysis excluding it.
- Thresholds are never applied to external cohorts, because no labels exist to justify them. Model outputs there are decision values, not probabilities.
- Null and negative results get reported the same way as positive ones.
