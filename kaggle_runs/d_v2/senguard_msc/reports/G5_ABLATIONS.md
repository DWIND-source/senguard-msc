# G5: research extension and ablations

All choices come from development data. MSC results below selected nothing and are exploratory.

## Normalization [measured]
               mean_auroc        ci_low        ci_high       min_auroc      
design               LOCO  LOCPO   LOCO  LOCPO    LOCO LOCPO      LOCO LOCPO
candidate                                                                   
L2 genes, cpm       0.984  0.982  0.953  0.946     1.0   1.0     0.781   0.0
L2 genes, mor       0.982  0.982  0.946  0.946     1.0   1.0     0.750   0.0
L2 genes, none      0.982  0.982  0.946  0.946     1.0   1.0     0.750   0.0
L2 genes, rank      0.982  0.982  0.946  0.946     1.0   1.0     0.750   0.0

## Feature families and fusion [measured]
                                 mean_auroc        ci_low        ci_high       min_auroc       
design                                 LOCO  LOCPO   LOCO  LOCPO    LOCO LOCPO      LOCO  LOCPO
candidate                                                                                      
Hallmark E2F inverted (fixed)         0.967  0.967  0.901  0.901     1.0   1.0     0.539  0.000
Hallmark pathway LR                   0.982  0.978  0.946  0.938     1.0   1.0     0.750  0.000
L1 genes (k=2000)                     0.982  0.982  0.946  0.946     1.0   1.0     0.750  0.000
L2 genes (k=5000)                     0.982  0.982  0.946  0.946     1.0   1.0     0.750  0.000
Late fusion: L2 + pathway + hUSI      0.997  0.989  0.992  0.967     1.0   1.0     0.961  0.375
SenMayo (fixed)                       0.974  0.974  0.939  0.939     1.0   1.0     0.781  0.562
hUSI raw (fixed)                      1.000  1.000  1.000  1.000     1.0   1.0     1.000  1.000

Fusion minus L2 genes, mean over cell types: {'LOCO': 0.0151, 'LOCPO': 0.0067}.

## Panel size [measured]
    method    k design  mean_auroc  ci_low  ci_high  min_auroc  jaccard_across_folds
        l1   10   LOCO       0.982   0.946      1.0      0.750                 0.458
        l1   20   LOCO       0.982   0.946      1.0      0.750                 0.395
        l1   30   LOCO       0.982   0.946      1.0      0.750                 0.409
        l1   10  LOCPO       0.982   0.946      1.0      0.000                   NaN
        l1   20  LOCPO       0.982   0.946      1.0      0.000                   NaN
        l1   30  LOCPO       0.982   0.946      1.0      0.000                   NaN
univariate   10   LOCO       0.972   0.915      1.0      0.602                 0.453
univariate   20   LOCO       0.978   0.935      1.0      0.695                 0.699
univariate   30   LOCO       0.973   0.922      1.0      0.656                 0.763
univariate  100   LOCO       0.982   0.946      1.0      0.750                 0.837
univariate  500   LOCO       0.982   0.946      1.0      0.750                 0.798
univariate 2000   LOCO       0.982   0.946      1.0      0.750                 0.822
univariate 5000   LOCO       0.982   0.946      1.0      0.750                 0.883
univariate   10  LOCPO       0.972   0.916      1.0      0.000                   NaN
univariate   20  LOCPO       0.974   0.923      1.0      0.000                   NaN
univariate   30  LOCPO       0.972   0.917      1.0      0.000                   NaN
univariate  100  LOCPO       0.982   0.946      1.0      0.000                   NaN
univariate  500  LOCPO       0.982   0.946      1.0      0.000                   NaN
univariate 2000  LOCPO       0.982   0.946      1.0      0.000                   NaN
univariate 5000  LOCPO       0.982   0.946      1.0      0.000                   NaN

## Frozen experimental panels
Top genes are in results/g5_panel_ranked.csv. These are hypotheses, not a validated assay, and no cost claim follows.

## Exploratory MSC check of panels
   cohort  panel_size  genes_present  mean_slope  positive  donors  sign_flip_p  standardized_slope
GSE309666          10             10       1.765         5       5        0.062               0.307
GSE309666          20             19       1.861         5       5        0.062               0.312
GSE309666          30             28       2.282         5       5        0.062               0.312
GSE178514          10             10       0.326         3       3        0.250               0.193
GSE178514          20             18       0.501         3       3        0.250               0.225
GSE178514          30             27       0.636         3       3        0.250               0.234

## Conformal sets on held-out cell types [measured]
Overall coverage 0.895 at target 0.90; lowest cell type 0.500. Sets: {'senescent_like': 111, 'control_like': 66, 'both_abstain': 13}. No sets are produced for MSC passage samples.
