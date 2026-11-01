# G2: baselines on development data

Status: see the summary below. Data: GSE284666, 190 samples, 126 senescence-induced, 14 cell types. Validation unit: cell type. No donor information exists, so nothing here is donor-independent.

## Published score reproduction [measured]
- Coefficient refit vs published: 4988/5000 shared features, Spearman 1.000, sign agreement 0.998.
- The authors' exact input table is not in GEO, so an exact match was not expected.
- Published score mean within-cell-type AUROC 1.000: self-consistency only, because those weights were fit on these samples.

## Feature-selection leakage [measured]
As published 0.9844 vs clean 0.9838; mean difference 0.0006.

## Benchmark, nested leave-one-cell-type-out [measured]
        model  mean_auroc  ci_low  ci_high  min_auroc worst_type  mean_auprc  balanced_acc  ba_ci_low  ba_ci_high  macro_f1  BMMSC_auroc  prAD_auroc
    logreg_l1       0.982   0.946      1.0      0.750         BJ       0.994         0.872      0.765       0.964     0.840          1.0         1.0
  elastic_net       0.982   0.946      1.0      0.750         BJ       0.994         0.899      0.804       0.980     0.879          1.0         1.0
   linear_svm       0.982   0.946      1.0      0.750         BJ       0.994         0.899      0.796       0.982     0.875          1.0         1.0
      rbf_svm       0.982   0.946      1.0      0.750         BJ       0.994         0.890      0.788       0.975     0.864          1.0         1.0
random_forest       0.982   0.946      1.0      0.750         BJ       0.994         0.890      0.786       0.980     0.863          1.0         1.0
      xgboost       0.982   0.945      1.0      0.742         BJ       0.993         0.899      0.812       0.973     0.881          1.0         1.0

Chosen under the protocol rule: logreg_l1, params {'clf__C': 0.1, 'sel__k': 500}.

## Scores that fit nothing on SenCat [measured]
                              score  mean_within_type_auroc  ci_low  ci_high  min_type_auroc  pooled_auroc  BMMSC  prAD
SenCat published (self-consistency)                   1.000   1.000    1.000           1.000         1.000  1.000   1.0
                           hUSI raw                   1.000   1.000    1.000           1.000         0.978  1.000   1.0
                            SenMayo                   1.000   1.000    1.000           1.000         0.794  1.000   1.0
                   LMNB1 (inverted)                   0.998   0.995    1.000           0.977         0.952  1.000   1.0
                                p21                   0.997   0.990    1.000           0.953         0.931  1.000   1.0
            Hallmark G2M (inverted)                   0.980   0.941    1.000           0.727         0.974  1.000   1.0
                              GDF15                   0.978   0.955    1.000           0.875         0.834  1.000   1.0
            Hallmark E2F (inverted)                   0.967   0.900    1.000           0.531         0.955  1.000   1.0
                                IL6                   0.803   0.643    0.939           0.000         0.615  1.000   0.0
                                p16                   0.771   0.598    0.915           0.000         0.607  0.469   1.0

## Confounding
Variance by PC is in results/dev_confounding_pca.csv. Dose and duration differ by cell type, and paradigms are not crossed with cell type. Replicates sit within a cell line, so per-sample counts overstate independent evidence.
