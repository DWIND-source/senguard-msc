# Virtual passage results

Gate: {
 "donors": 30,
 "share_rmse_better": 0.5333333333333333,
 "cohorts_better": 4,
 "cohorts": 8,
 "share_score_better": 0.8,
 "median_corr_change": 0.2969183979829918,
 "negative_control_share": 0.2771428571428571,
 "median_rmse_reduction": 0.010419243832535452,
 "median_err_score_model": 0.06832494902363173,
 "median_err_score_carry": 0.09828212991038535,
 "personal_share_better": 0.46153846153846156,
 "personal_donors": 26,
 "rate_persistence_spearman": 0.09163959785156152,
 "population_better_than_carry_later_step": 0.5769230769230769,
 "passes": false,
 "personal_passes": false
}

By cohort:
           donors  rmse_carry  rmse_model   corr  better  score_better  err_carry  err_model
cohort                                                                                      
GSE119987       4       0.102       0.093  0.424       2             2      0.082      0.064
GSE137186       4       0.116       0.137  0.224       0             2      0.066      0.102
GSE178514       3       0.081       0.081  0.257       0             3      0.080      0.001
GSE194298       4       0.087       0.087  0.190       1             3      0.081      0.050
GSE233634       1       0.113       0.146 -0.307       0             0      0.022      0.134
GSE275980       3       0.147       0.143  0.321       3             3      0.159      0.037
GSE309666       5       0.168       0.147  0.519       5             5      0.267      0.143
GSE56362        6       0.227       0.224  0.237       5             6      0.106      0.070

By distance:
          n    rmse  score_err  score_err_p90
dt_bin                                       
under 1   6  0.2240     0.0699         0.3031
1 to 2   12  0.1047     0.0366         0.1313
over 2   12  0.1308     0.0766         0.1461
