# G3: external MSC evaluation

Scores frozen in notebook 02 (frozen 2026-11-01T11:33:23.190183+00:00), hashes verified at load. No labels exist for these cohorts, so no classification metric was computed.

## Primary: published SenCat score, GSE309666 [measured]
Mean slope +1.927 per passage; 5/5 donors positive; median rho 1.00; exact sign-flip p 0.0625 (smallest possible 0.0625).

## Supporting: GSE178514 [measured]
Mean slope +0.624 per passage; 3/3 ids positive; median rho 1.00; exact sign-flip p 0.2500 (smallest possible 0.25).

## Competitive null [measured]
   cohort                      score    null  observed_mean_slope  null_mean  null_sd  empirical_two_sided_p       z
GSE309666           SenCat published weights               1.9266     0.0159   0.0658                  0.001 29.0427
GSE309666           SenCat published   genes               1.9266    -0.0006   0.0871                  0.001 22.1385
GSE309666 SenCat refit no_BMMSC_prAD weights               1.8283     0.0174   0.0674                  0.001 26.8792
GSE309666 SenCat refit no_BMMSC_prAD   genes               1.8283     0.0033   0.0868                  0.001 21.0166
GSE178514           SenCat published weights               0.6239     0.0043   0.0303                  0.001 20.4814
GSE178514           SenCat published   genes               0.6239    -0.0025   0.0321                  0.001 19.5184
GSE178514      SenCat refit no_BMMSC weights               0.6062     0.0038   0.0298                  0.001 20.2125
GSE178514      SenCat refit no_BMMSC   genes               0.6062    -0.0020   0.0319                  0.001 19.0604

## All scores [measured]
AD-MSC:
                                                    score  mean_slope  donors_positive  donors  median_rho  sign_flip_p  mean_last_minus_first  standardized_slope
                                         SenCat published       1.927                5       5         1.0        0.062                 14.331               0.311
                                       SenCat refit all14       1.915                5       5         1.0        0.062                 14.243               0.311
                                    SenCat refit no_BMMSC       1.881                5       5         1.0        0.062                 13.976               0.310
                               SenCat refit no_BMMSC_prAD       1.828                5       5         1.0        0.062                 13.713               0.310
                       SenCat published, no E2F/G2M genes       1.458                5       5         1.0        0.062                 11.022               0.306
                                                 hUSI raw       0.029                5       5         1.0        0.062                  0.218               0.311
                                                  SenMayo       0.012                5       5         1.0        0.062                  0.097               0.289
                                  Hallmark E2F (inverted)       0.040                5       5         1.0        0.062                  0.290               0.303
                                  Hallmark G2M (inverted)       0.036                5       5         1.0        0.062                  0.256               0.301
                     AD-MSC 40 biomarkers (up minus down)       0.160                5       5         1.0        0.062                  1.170               0.312
                                        CDKN2A transcript       0.182                5       5         1.0        0.062                  1.411               0.299
                                        CDKN1A transcript       0.147                5       5         0.6        0.062                  0.907               0.250
                                           IL6 transcript       0.198                5       5         0.4        0.062                  1.793               0.192
                                         GDF15 transcript       0.265                5       5         1.0        0.062                  1.963               0.278
                              LMNB1 transcript (inverted)       0.580                5       5         1.0        0.062                  4.005               0.301
Frozen logreg_l1, target lineage excluded, decision value       0.673                5       5         1.0        0.062                  4.880               0.308

BM-MSC:
                                                    score  mean_slope  donors_positive  donors  median_rho  sign_flip_p  mean_last_minus_first  standardized_slope
                                         SenCat published       0.624                3       3         1.0         0.25                  4.928               0.204
                                       SenCat refit all14       0.620                3       3         1.0         0.25                  4.891               0.204
                                    SenCat refit no_BMMSC       0.606                3       3         1.0         0.25                  4.785               0.202
                               SenCat refit no_BMMSC_prAD       0.624                3       3         1.0         0.25                  4.908               0.205
                       SenCat published, no E2F/G2M genes       0.577                3       3         1.0         0.25                  4.613               0.203
                                                 hUSI raw       0.005                3       3         1.0         0.25                  0.042               0.254
                                                  SenMayo       0.003                3       3         1.0         0.25                  0.022               0.216
                                  Hallmark E2F (inverted)       0.002                2       3         0.5         0.50                  0.011               0.104
                                  Hallmark G2M (inverted)       0.001                2       3         0.5         0.75                  0.004               0.060
                     AD-MSC 40 biomarkers (up minus down)       0.017                3       3         1.0         0.25                  0.132               0.225
                                        CDKN2A transcript       0.020                2       3         0.5         0.75                  0.117               0.068
                                        CDKN1A transcript       0.006                1       3        -0.5         1.00                  0.005               0.037
                                           IL6 transcript       0.040                2       3         0.5         0.50                  0.470               0.076
                                         GDF15 transcript      -0.009                2       3         0.5         1.00                 -0.053              -0.033
                              LMNB1 transcript (inverted)       0.077                3       3         0.5         0.25                  0.567               0.203
Frozen logreg_l1, target lineage excluded, decision value       0.154                3       3         1.0         0.25                  1.184               0.233

## Sensitivity [measured]
                                        analysis  mean_slope  donors_positive  donors
                  GSE309666 excluding GSM9271440       1.945                5       5
         GSE309666 as deposited, no size factors       2.135                5       5
              GSE309666 scaled to 1e6 per sample       1.807                5       5
GSE309666 size factors from the SenCat reference       2.422                5       5
                     GSE178514 FPKM as deposited       0.572                3       3

## Domain shift [measured]
   cohort  genes_shared  median_nn_distance  dev_held_out_type_p95  share_beyond_p95                      nearest_cell_types  spearman_gene_means_vs_BMMSC  spearman_gene_means_vs_prAD
GSE309666          4758              46.554                 96.701               0.0 {'Myoblasts': 11, 'BMMSC': 6, 'NHO': 1}                          0.77                        0.764
GSE178514          4758              66.982                 96.701               0.0                            {'PBMCs': 9}                          0.63                        0.597

## Limits
- Passage and donor are observations; every score is inference. Growth-arrest status exists only per donor at final passage, and D and E are censored at passage 10.
- Published weights were fit with BMMSC in the data. The refit no_BMMSC and no_BMMSC_prAD rows are the cell-type-independent versions.
- hUSI training metadata lists 9 rows from GSE178514, so hUSI on GSE178514 is NOT an independent test. It lists 0 rows from GSE309666 and 0 from GSE284666, and 54 MSC-related rows overall.
- GSE178514 is FPKM and its donor mapping is inferred. Culture systems differ (platelet lysate vs FBS), and so do library types (polyA vs rRNA-depleted).
- The 40 AD-MSC biomarkers came from GSE309666, so their result there is circular; GSE178514 is their only independent test here.
- No conclusion on potency, immune function or clinical safety follows from these data.
