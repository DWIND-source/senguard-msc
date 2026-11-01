"""Back-test: can a donor's earlier passages forecast its last one? Fits nothing across cohorts. Run from the project root.

Rule fixed before running: the app shows a forecast only if linear extrapolation beats carrying the last value forward
in at least 70% of donors AND its median error is lower in at least 4 of the 5 RNA-seq cohorts tested.
"""
import json
from pathlib import Path
import numpy as np, pandas as pd

T = Path('deliverables/tables')
s = pd.read_csv(T / 'ext_scores_long.csv')
s = s[(s.score_name == 'SenCat published') & s.cohort.isin(['GSE309666', 'GSE178514', 'GSE137186', 'GSE275980', 'GSE233634'])]
s = s.groupby(['cohort', 'subject', 'passage'], as_index=False).score.mean()
rows = []
for (c, d), g in s.groupby(['cohort', 'subject']):
    g = g.sort_values('passage')
    if g.passage.nunique() < 3:
        continue
    x, y = g.passage.to_numpy(float), g.score.to_numpy(float)
    b, a = np.polyfit(x[:-1], y[:-1], 1)
    pred, truth, last = a + b * x[-1], y[-1], y[-2]
    fit = a + b * x[:-1]
    rows.append({'cohort': c, 'donor': d, 'points_used': len(x) - 1, 'from_passage': x[-2], 'to_passage': x[-1], 'steps': x[-1] - x[-2], 'actual': truth, 'forecast': pred, 'carry_forward': last,
                 'error_forecast': abs(pred - truth), 'error_carry': abs(last - truth), 'direction_right': bool(np.sign(pred - last) == np.sign(truth - last))})
r = pd.DataFrame(rows)
r['forecast_better'] = r.error_forecast < r.error_carry
r['error_per_step'] = r.error_forecast / r.steps
r.to_csv(T / 'forecast_backtest.csv', index=False)
by = r.groupby('cohort').agg(donors=('donor', 'size'), median_error_forecast=('error_forecast', 'median'), median_error_carry=('error_carry', 'median'), better=('forecast_better', 'sum'), direction_right=('direction_right', 'sum'), median_error_per_step=('error_per_step', 'median'))
print(r.round(2).to_string(index=False)); print(by.round(2).to_string())
share = float(r.forecast_better.mean())
cohorts_better = int((by.median_error_forecast < by.median_error_carry).sum())
result = {'donors': len(r), 'share_better': share, 'cohorts_better': cohorts_better, 'cohorts': len(by), 'direction_right': int(r.direction_right.sum()), 'median_error_per_step': float(r.error_per_step.median()),
          'median_error_forecast': float(r.error_forecast.median()), 'median_error_carry': float(r.error_carry.median()), 'passes': bool(share >= 0.7 and cohorts_better >= 4)}
json.dump(result, open(T / 'forecast_backtest.json', 'w'), indent=1)
print(result)
