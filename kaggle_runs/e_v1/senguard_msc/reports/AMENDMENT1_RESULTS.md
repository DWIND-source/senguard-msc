# Amendment 1: extended MSC evaluation

Amendment SHA256: ec0e7a44bd0e09b48b9074631c0ebcb6e5db7e25310692c578a90a9dfac4c75f. Cohort load log: results/ext_cohort_load_log.csv.

## Primary: published SenCat score, new pooled cohorts [measured]
{
 "score": "SenCat published",
 "donors_rising": 16,
 "donors": 22,
 "share": 0.7272727272727273,
 "ci_low": 0.4977787987335407,
 "ci_high": 0.892710751629603,
 "binom_p": 0.052478790283203125,
 "median_rho": 0.7999999999999999,
 "cohorts_positive": 4,
 "cohorts": 6,
 "cohort_signflip_p": 0.15625
}

## Sensitivity [measured]
                             analysis  donors_rising  donors  binom_p  median_rho  cohorts_positive  cohorts  cohort_signflip_p
                 Rank form everywhere             16      22   0.0525      0.8727                 4        6             0.1562
Refit without BMMSC and preadipocytes             18      22   0.0043      0.7545                 4        6             0.1250
                   Excluding GSE56362             16      22   0.0525      0.8000                 4        6             0.1562
                  Excluding GSE233634             16      21   0.0266      0.8000                 4        5             0.1250
                 RNA-seq cohorts only             11      17   0.3323      0.9000                 3        5             0.3125

## Head-to-head [measured]
                      score  donors_rising  donors  share  ci_low  ci_high  binom_p  median_rho  cohorts_positive  cohorts  cohort_signflip_p excluded_as_circular
                     CDKN2A             25      30 0.8333  0.6528   0.9436   0.0003      0.9231                 7        8             0.0156                    -
                       hUSI             22      27 0.8148  0.6192   0.9370   0.0015      0.9000                 5        7             0.0938            GSE178514
SenCat published, rank form             24      30 0.8000  0.6143   0.9229   0.0014      1.0000                 6        8             0.0391                    -
                    SenMayo             24      30 0.8000  0.6143   0.9229   0.0014      0.8000                 7        8             0.0234                    -
       AD-MSC 40 biomarkers             20      25 0.8000  0.5930   0.9317   0.0041      0.8000                 5        7             0.1875            GSE309666
           LMNB1 (inverted)             24      30 0.8000  0.6143   0.9229   0.0014      0.8000                 6        8             0.1172                    -
                        IL6             24      30 0.8000  0.6143   0.9229   0.0014      0.4000                 7        8             0.0156                    -
          Yang 2023 7 genes             21      27 0.7778  0.5774   0.9138   0.0059      0.9000                 6        7             0.0312            GSE178514
    Hallmark E2F (inverted)             23      30 0.7667  0.5772   0.9007   0.0052      0.8000                 6        8             0.1562                    -
    Hallmark G2M (inverted)             23      30 0.7667  0.5772   0.9007   0.0052      0.8000                 6        8             0.2031                    -
                     CDKN1A             23      30 0.7667  0.5772   0.9007   0.0052      0.4406                 5        8             0.0625                    -
                      GDF15             16      30 0.5333  0.3433   0.7166   0.8555      0.4895                 5        8             0.6562                    -

## Random-signature comparison by cohort [measured]
   cohort  observed_mean_slope  null_mean  null_sd       z  empirical_p
GSE309666               1.9242     0.0102   0.0590 32.4194        0.002
GSE178514               0.6247    -0.0014   0.0301 20.7883        0.002
GSE137186               0.2304     0.0063   0.0196 11.4484        0.002
GSE275980               0.9078     0.0010   0.0501 18.0893        0.002
GSE125632              -0.2129     0.0004   0.0255 -8.3574        0.002
GSE194298               0.6058    -0.0071   0.0863  7.1033        0.002
GSE233634              -0.1043     0.0085   0.0437 -2.5843        0.016
GSE119987               0.6969    -0.0058   0.0396 17.7547        0.002
GSE269586               1.4149     0.0033   0.0506 27.8908        0.002

## Labelled checks [measured]
   cohort                     contrast                          score  n_pos  n_neg  auroc
 GSE48662        irradiated vs control               SenCat published      4      4  1.000
 GSE48662        irradiated vs control SenCat refit, lineage excluded      4      4  0.938
 GSE48662        irradiated vs control    SenCat published, rank form      4      4  1.000
 GSE48662        irradiated vs control                           hUSI      4      4  0.938
 GSE48662        irradiated vs control                        SenMayo      4      4  0.625
 GSE48662        irradiated vs control              Yang 2023 7 genes      4      4  0.500
 GSE48662        irradiated vs control        Hallmark E2F (inverted)      4      4  1.000
 GSE48662        irradiated vs control        Hallmark G2M (inverted)      4      4  1.000
 GSE48662        irradiated vs control           AD-MSC 40 biomarkers      4      4  0.938
 GSE48662        irradiated vs control                         CDKN2A      4      4  0.750
 GSE48662        irradiated vs control                         CDKN1A      4      4  1.000
 GSE48662        irradiated vs control                            IL6      4      4  0.438
 GSE48662        irradiated vs control                          GDF15      4      4  1.000
 GSE48662        irradiated vs control               LMNB1 (inverted)      4      4  0.250
GSE125632 P11 labelled senescent vs P2               SenCat published      5      5  0.360
GSE125632 P11 labelled senescent vs P2 SenCat refit, lineage excluded      5      5  0.320
GSE125632 P11 labelled senescent vs P2    SenCat published, rank form      5      5  0.440
GSE125632 P11 labelled senescent vs P2                           hUSI      5      5  0.480
GSE125632 P11 labelled senescent vs P2                        SenMayo      5      5  0.360
GSE125632 P11 labelled senescent vs P2              Yang 2023 7 genes      5      5  0.440
GSE125632 P11 labelled senescent vs P2        Hallmark E2F (inverted)      5      5  0.360
GSE125632 P11 labelled senescent vs P2        Hallmark G2M (inverted)      5      5  0.280
GSE125632 P11 labelled senescent vs P2           AD-MSC 40 biomarkers      5      5  0.280
GSE125632 P11 labelled senescent vs P2                         CDKN2A      5      5  0.520
GSE125632 P11 labelled senescent vs P2                         CDKN1A      5      5  0.400
GSE125632 P11 labelled senescent vs P2                            IL6      5      5  0.360
GSE125632 P11 labelled senescent vs P2                          GDF15      5      5  0.520
GSE125632 P11 labelled senescent vs P2               LMNB1 (inverted)      5      5  0.320

## GVHD response [measured, hypothesis-generating]
                         score  G2_minus_G1  one_sided_exact_p  auroc_G2_higher
              SenCat published          NaN                0.0              NaN
SenCat refit, lineage excluded          NaN                0.0              NaN
   SenCat published, rank form          NaN                0.0              NaN
                          hUSI          NaN                0.0              NaN
                       SenMayo          NaN                0.0              NaN
             Yang 2023 7 genes          NaN                0.0              NaN
       Hallmark E2F (inverted)          NaN                0.0              NaN
       Hallmark G2M (inverted)          NaN                0.0              NaN
          AD-MSC 40 biomarkers          NaN                0.0              NaN
                        CDKN2A          NaN                0.0              NaN
                        CDKN1A          NaN                0.0              NaN
                           IL6          NaN                0.0              NaN
                         GDF15          NaN                0.0              NaN
              LMNB1 (inverted)          NaN                0.0              NaN

## Drift clock [measured]
           rising  n  median_rho  mae_log2   alpha
cohort                                            
GSE119987       5  5       0.909     0.349  1000.0
GSE125632       2  5         NaN     1.454     0.1
GSE137186       3  4       0.600     0.860     0.1
GSE178514       3  3       1.000     0.285     0.1
GSE194298       8  8         NaN     0.405     0.1
GSE233634       1  1       0.400     0.382     0.1
GSE275980       3  3       1.000     0.477     0.1
GSE309666       5  5       1.000     0.376     0.1

Gate: {"median_rho": 1.0, "share_rising": 0.8823529411764706, "shuffled_median_rho": -0.05734265734265735, "shuffled_runs": [0.39999999999999997, -0.19999999999999998, -0.4545454545454546, -0.027972027972027972, 0.33636363636363636, 0.5, -0.39090909090909093, -0.6000000000000001, -0.07272727272727274, -0.04195804195804196], "sencat_rank_median_rho": 1.0, "sencat_rank_share_rising": 0.8, "passes": false, "final_alpha": 0.1, "shared_genes": 8090}

## Robustness [measured]
   test  level  median_reads  share_donors_rising  slope_ratio  r_with_full
  depth  0.005      61280.50                0.750       -0.052        0.776
  depth  0.010     122491.00                0.500        0.227        0.977
  depth  0.020     245213.00                0.625        0.400        0.990
  depth  0.050     612811.25                0.750        0.654        0.989
  depth  0.100    1224834.25                0.750        0.791        0.994
  depth  0.250    3062044.50                0.750        0.906        0.998
  depth  0.500    6125530.50                0.750        0.937        0.999
dropout  0.050           NaN                0.762        0.959        0.999
dropout  0.100           NaN                0.788        0.879        0.999
dropout  0.200           NaN                0.750        0.801        0.997
dropout  0.300           NaN                0.762        0.696        0.993
dropout  0.500           NaN                0.750        0.511        0.991
dropout  0.700           NaN                0.788        0.304        0.977
