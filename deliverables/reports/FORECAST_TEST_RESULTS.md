# Score forecast: independent test

Gate: {
 "donors": 17,
 "cohorts_loaded": 3,
 "share_better": 0.7647058823529411,
 "cohorts_better": 3,
 "negative_control_share": 0.32941176470588235,
 "range80": 0.142547643668227,
 "coverage": 1.0,
 "median_err_forecast": 0.010196683486605518,
 "median_err_carry": 0.0400589937286539,
 "actual_rose": 17,
 "binom_better_p": 0.049041748046875,
 "passes": true
}

By cohort:
           donors  err_forecast  err_carry  better  in_range  rose
cohort                                                            
GSE139073       6         0.026      0.029       3         6     6
GSE39035        8         0.009      0.043       7         8     8
GSE9593         3         0.000      0.090       3         3     3

By donor:
   cohort  donor  from   to  score_start  score_actual  score_forecast  err_forecast  err_carry  genes  signature_genes  forecast_better  in_range  actual_rose
 GSE39035    164   4.0  8.0        0.011         0.069           0.060         0.010      0.058   7654             3614             True      True         True
 GSE39035    172   4.0  8.0        0.042         0.082           0.089         0.007      0.040   7654             3614             True      True         True
 GSE39035    194   4.0  8.0        0.026         0.078           0.073         0.005      0.052   7654             3614             True      True         True
 GSE39035    271   4.0  8.0       -0.002         0.052           0.047         0.005      0.053   7654             3614             True      True         True
 GSE39035     88   4.0  8.0        0.021         0.039           0.068         0.029      0.018   7654             3614            False      True         True
 GSE39035     89   4.0  8.0        0.035         0.071           0.082         0.010      0.037   7654             3614             True      True         True
 GSE39035     91   4.0  8.0        0.049         0.078           0.096         0.018      0.028   7654             3614             True      True         True
 GSE39035     92   4.0  8.0        0.006         0.052           0.055         0.003      0.045   7654             3614             True      True         True
GSE139073  BM126   3.0  6.0       -0.144        -0.112          -0.090         0.022      0.031   7845             3695             True      True         True
GSE139073  BM127   3.0  6.0       -0.149        -0.118          -0.094         0.024      0.031   7845             3695             True      True         True
GSE139073  BM285   3.0  6.0       -0.090        -0.090          -0.036         0.054      0.000   7845             3695            False      True         True
GSE139073  BM293   3.0  6.0       -0.110        -0.084          -0.056         0.028      0.027   7845             3695            False      True         True
GSE139073  BM324   3.0  6.0       -0.110        -0.087          -0.057         0.030      0.023   7845             3695            False      True         True
GSE139073  BM784   3.0  6.0       -0.137        -0.096          -0.083         0.013      0.040   7845             3695             True      True         True
  GSE9593 donor1   2.0 11.0        0.032         0.150           0.150         0.000      0.118   7845             3695             True      True         True
  GSE9593 donor2   2.0  7.0        0.061         0.145           0.145         0.000      0.084   7845             3695             True      True         True
  GSE9593 donor3   2.0  8.0        0.064         0.154           0.149         0.005      0.090   7845             3695             True      True         True
