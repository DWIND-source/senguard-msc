# Analysis protocol amendment 3: independent test of the score forecast

Fixed on 2026-11-01, after notebook 07, before any cohort below was scored.

## Frozen model
virtual_passage_model.json from notebook 07, model "final": per-gene drift across 8 cohorts, 4 significant digits. Forecast of the SenCat rank score at a later passage = rank score of (earliest profile + drift x change in log2(passage + 1)). No refitting.

## Independent cohorts, chosen from GEO metadata alone
- GSE39035: bone marrow, 8 donors, P4 and P8, array.
- GSE139073: bone marrow, 6 donors with both P3 and P6 at rest (BM126, BM127, BM285, BM293, BM324, BM784), RNA-seq. Stimulated samples are not used.
- GSE9593: bone marrow, 3 donors, P2 to P7, P8 or P11, array.
If a cohort can't be parsed, it is reported as failed and the rule applies to what remains, with at least 2 cohorts.

## Gate for the interface
All must hold:
1. Absolute error of the forecast is lower than carry-forward in at least 70% of donors, pooled.
2. Median error is lower in every available cohort except at most one.
3. Negative control: drift learned from passages shuffled within donors beats carry-forward in at most 60% of donors, on average.
4. Prediction range: the 80% range set from leave-one-cohort-out errors in notebook 07 contains the actual score in at least 70% of donors.

## What this claims if it passes
A forecast of how a transcriptomic signature moves with passage. Not senescence confirmation, growth capacity, potency or safety.
