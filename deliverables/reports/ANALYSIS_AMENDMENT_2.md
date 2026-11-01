# Analysis protocol amendment 2: virtual passage

Fixed on 2026-11-01, before any prediction below was evaluated. It follows a failed per-donor forecast (deliverables/tables/forecast_backtest.json), so the idea of learning across cohorts was chosen after seeing that failure.

## Question
From one early sample of a culture, predict its within-sample gene ranks at a later passage.

## Models
- Carry-forward: no change. This is the baseline to beat.
- Population drift: a per-gene drift rate learned from other cohorts, multiplied by the change in log2(passage + 1).
- Personal drift: population drift scaled by how fast this donor moved between its first two passages.

## Validation
Leave one cohort out. Cohorts: GSE309666, GSE178514, GSE137186, GSE275980, GSE194298, GSE233634, GSE119987, GSE56362. GSE125632 is excluded because it failed the identity check. Unit: donor (medium arms averaged). Earliest available passage predicts last available passage.

## Gate for the interface
Population drift enters the interface only if all of these hold:
1. Gene-level RMSE beats carry-forward in at least 70% of held-out donors.
2. It wins in at least 6 of the 8 cohorts, by median error.
3. Predicted SenCat rank score has lower absolute error than carry-forward in at least 70% of held-out donors.
4. Median correlation between predicted and actual change across genes is at least 0.3.
5. Negative control: drift learned from passages shuffled within donors beats carry-forward in at most 60% of donors on RMSE, on average.

Personal drift is used only if it beats population drift in at least 60% of donors with 3 or more passages, on the later step.

## What this does not claim
It predicts transcript ranks. It does not predict potency, growth arrest, safety or cell behaviour. Remaining expansion capacity is examined only descriptively, because too few lineages have a growth endpoint.
