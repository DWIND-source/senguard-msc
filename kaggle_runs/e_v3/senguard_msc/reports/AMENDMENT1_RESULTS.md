# Amendment 1: extended MSC evaluation

Amendment SHA256: ec0e7a44bd0e09b48b9074631c0ebcb6e5db7e25310692c578a90a9dfac4c75f. Cohort load log: results/ext_cohort_load_log.csv.

## Primary as registered, with parsing fixes [measured]
{
 "score": "SenCat published",
 "donors_rising": 21,
 "donors": 27,
 "share": 0.7777777777777778,
 "ci_low": 0.5774169399556212,
 "ci_high": 0.9137830600524457,
 "binom_p": 0.005924612283706665,
 "median_rho": 0.8999999999999999,
 "cohorts_positive": 5,
 "cohorts": 7,
 "cohort_signflip_p": 0.078125
}

## Primary, cohorts passing the identity check [measured]
{
 "score": "SenCat published",
 "donors_rising": 19,
 "donors": 22,
 "share": 0.8636363636363636,
 "ci_low": 0.6508779027425919,
 "ci_high": 0.9709441488712534,
 "binom_p": 0.0008554458618164062,
 "median_rho": 0.8999999999999999,
 "cohorts_positive": 5,
 "cohorts": 6,
 "cohort_signflip_p": 0.0625
}

## Identity check [measured]
                units  inconsistent  lowest_max_y  highest_min_y
cohort                                                          
GSE125632           5             2          0.00           0.01
GSE125632_iMSC      5             3          0.01           0.02
GSE137186           4             0          7.29           6.82
GSE178514           3             0          0.61           6.25
GSE194298           4             0          8.91           8.65
GSE233634           1             0          1.61           0.00
GSE269586          11             0          3.53           6.96
GSE275980           3             0          0.00           6.89

## Sensitivity [measured]
                                                     analysis  donors_rising  donors  binom_p  median_rho  cohorts_positive  cohorts  cohort_signflip_p
                            As registered, all pooled cohorts             21      27   0.0059      0.9000                 5        7             0.0781
                                       Passing identity check             19      22   0.0009      0.9000                 5        6             0.0625
Passing identity check, refit without BMMSC and preadipocytes             21      22   0.0000      0.9000                 5        6             0.0625
                            Passing identity check, rank form             19      22   0.0009      1.0000                 5        6             0.0625
                         Passing identity check, RNA-seq only              9      12   0.1460      0.9000                 3        4             0.2500
                                         Rank form everywhere             21      27   0.0059      1.0000                 5        7             0.0781
                        Refit without BMMSC and preadipocytes             23      27   0.0003      0.9000                 5        7             0.0625
                                           Excluding GSE56362             15      21   0.0784      0.7727                 4        6             0.1562
                                          Excluding GSE233634             21      26   0.0025      1.0000                 5        6             0.0625
                                         RNA-seq cohorts only             11      17   0.3323      0.9000                 3        5             0.3125

## Head-to-head [measured]
                      score  donors_rising  donors  share  ci_low  ci_high  binom_p  median_rho  cohorts_positive  cohorts  cohort_signflip_p excluded_as_circular
                       hUSI             25      27 0.9259  0.7571   0.9909   0.0000      1.0000                 6        7             0.0469            GSE178514
SenCat published, rank form             27      30 0.9000  0.7347   0.9789   0.0000      1.0000                 7        8             0.0156                    -
                     CDKN2A             27      30 0.9000  0.7347   0.9789   0.0000      0.9266                 8        8             0.0078                    -
                    SenMayo             27      30 0.9000  0.7347   0.9789   0.0000      0.8000                 8        8             0.0078                    -
                        IL6             27      30 0.9000  0.7347   0.9789   0.0000      0.5000                 8        8             0.0078                    -
          Yang 2023 7 genes             24      27 0.8889  0.7084   0.9765   0.0000      0.8000                 7        7             0.0156            GSE178514
       AD-MSC 40 biomarkers             22      25 0.8800  0.6878   0.9745   0.0002      0.8000                 6        7             0.0625            GSE309666
           LMNB1 (inverted)             26      30 0.8667  0.6928   0.9624   0.0001      0.8000                 7        8             0.0625                    -
                     CDKN1A             26      30 0.8667  0.6928   0.9624   0.0001      0.5000                 6        8             0.0312                    -
    Hallmark E2F (inverted)             25      30 0.8333  0.6528   0.9436   0.0003      0.8000                 7        8             0.0703                    -
    Hallmark G2M (inverted)             24      30 0.8000  0.6143   0.9229   0.0014      0.7000                 7        8             0.0781                    -
                      GDF15             18      30 0.6000  0.4060   0.7734   0.3616      0.5000                 5        8             0.4609                    -

## Random-signature comparison by cohort [measured]
   cohort  observed_mean_slope  null_mean  null_sd       z  empirical_p
GSE309666               1.9242     0.0102   0.0590 32.4194        0.002
GSE178514               0.6247    -0.0014   0.0301 20.7883        0.002
GSE137186               0.2304     0.0063   0.0196 11.4484        0.002
GSE275980               0.9078     0.0010   0.0501 18.0893        0.002
GSE194298               0.6058    -0.0071   0.0863  7.1033        0.002
GSE233634              -0.1043     0.0085   0.0437 -2.5843        0.016
GSE119987               0.6969    -0.0058   0.0396 17.7547        0.002
 GSE56362               0.5814     0.0111   0.0321 17.7431        0.002
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
              SenCat published       -0.006              0.625            0.400
SenCat refit, lineage excluded       -0.008              0.679            0.400
   SenCat published, rank form       -0.006              0.625            0.400
                          hUSI        0.005              0.393            0.600
                       SenMayo       -0.019              0.964            0.133
             Yang 2023 7 genes       -0.006              0.589            0.333
       Hallmark E2F (inverted)        0.013              0.357            0.533
       Hallmark G2M (inverted)        0.011              0.411            0.533
          AD-MSC 40 biomarkers        0.004              0.500            0.533
                        CDKN2A        0.027              0.161            0.733
                        CDKN1A        0.047              0.268            0.600
                           IL6        0.019              0.411            0.467
                         GDF15        0.013              0.339            0.600
              LMNB1 (inverted)       -0.004              0.554            0.467

## Drift clock [measured]
           rising  n  median_rho  mae_log2   alpha
cohort                                            
GSE119987       5  5       0.809     0.414  1000.0
GSE137186       4  4       1.000     0.669     0.1
GSE178514       3  3       1.000     0.172  1000.0
GSE194298       8  8         NaN     0.267     0.1
GSE233634       1  1       0.400     0.397     0.1
GSE275980       3  3       1.000     0.545   100.0
GSE309666       5  5       1.000     0.409     0.1
GSE56362        6  6       1.000     0.600     0.1

Gate: {"median_rho": 1.0, "share_rising": 1.0, "shuffled_median_rho": 0.13006993006993003, "shuffled_runs": [0.39999999999999997, 0.5, -0.39999999999999997, 0.39999999999999997, -0.23636363636363636, -0.27272727272727276, 0.39999999999999997, -0.1398601398601399, -0.5, 0.5], "sencat_rank_median_rho": 1.0, "sencat_rank_share_rising": 0.9, "passes": true, "final_alpha": 0.1, "shared_genes": 7845}

## Robustness [measured]
   cohort    test  level  median_reads  share_donors_rising  slope_ratio  r_with_full
GSE137186   depth  0.005      61280.50                0.750       -0.052        0.776
GSE137186   depth  0.010     122491.00                0.500        0.227        0.977
GSE137186   depth  0.020     245213.00                0.625        0.400        0.990
GSE137186   depth  0.050     612811.25                0.750        0.654        0.989
GSE137186   depth  0.100    1224834.25                0.750        0.791        0.994
GSE137186   depth  0.250    3062044.50                0.750        0.906        0.998
GSE137186   depth  0.500    6125530.50                0.750        0.937        0.999
GSE137186 dropout  0.050           NaN                0.762        0.959        0.999
GSE137186 dropout  0.100           NaN                0.788        0.879        0.999
GSE137186 dropout  0.200           NaN                0.750        0.801        0.997
GSE137186 dropout  0.300           NaN                0.762        0.696        0.993
GSE137186 dropout  0.500           NaN                0.750        0.511        0.991
GSE137186 dropout  0.700           NaN                0.788        0.304        0.977
GSE275980   depth  0.005     118029.50                1.000        0.053        0.902
GSE275980   depth  0.010     236066.50                1.000        0.232        0.995
GSE275980   depth  0.020     472223.00                1.000        0.539        0.997
GSE275980   depth  0.050    1181070.00                1.000        0.873        0.997
GSE275980   depth  0.100    2362052.50                1.000        0.997        0.998
GSE275980   depth  0.250    5904885.00                1.000        1.015        0.999
GSE275980   depth  0.500   11808524.50                1.000        0.994        0.999
GSE275980 dropout  0.050           NaN                1.000        0.947        1.000
GSE275980 dropout  0.100           NaN                1.000        0.892        1.000
GSE275980 dropout  0.200           NaN                1.000        0.814        0.999
GSE275980 dropout  0.300           NaN                1.000        0.703        0.999
GSE275980 dropout  0.500           NaN                1.000        0.503        0.998
GSE275980 dropout  0.700           NaN                1.000        0.316        0.992
