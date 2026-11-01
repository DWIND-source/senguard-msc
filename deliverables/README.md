# SenGuard-MSC

Cross-dataset evaluation of senescence-associated transcriptomic signatures in mesenchymal stromal cells, for AMIM 2026.

## Gate status
| Gate | Status | Note |
|---|---|---|
| G0 Environment | PASS | Tesla T4 x2 on Kaggle |
| G1 Data audit | CONDITIONAL | No blockers; 5 open conditions in `reports/G1_DATA_AUDIT.md` |
| G2 Baselines | PASS | Published weights reproduced; six models tied |
| G3 MSC evaluation | PASS, trend-only | No labels exist, so no classification metric |
| G4 BulkFormer | PASS, one cohort skipped | GSE178514 under the coverage target |
| G5 Ablations | PASS | Includes null results |
| Amendment 1 | DONE, with deviations | 19/22 donors in new cohorts passing the identity check; 21/27 as registered |
| G6 Deliverables | DRAFT | Live demo; 25 browser and 14 Python tests pass; pilot partner and author review pending |

## Contents
- `ABSTRACT_DRAFT.md`, `PITCH_7MIN.md`, `TRACK3_ASSESSMENT.md`, `METHODS.md`, `LIMITATIONS.md`
- `demo/`: saved prototype reports and test results; the tool is `../senguard_msc/src/senguard_qc.py`
- `figures/`: five figures, rebuilt with `senguard_msc/src/make_final_figures.py`
- `tables/`: sample-level predictions, fold assignments, metrics, manifests
- `reports/`: per-gate reports and the analysis protocol
- Kernel logs with printed outputs: `../kaggle_runs/*/senguard-msc-*.log`

## Reproducing
Kernels live in `../kaggle/`, and run in the order A, then B and C, then D. Each is private on the owning Kaggle account and needs Internet on. Kernel A downloads GEO data and clones author repositories at the commits recorded in `tables/environment_report.json`. Seed 42.

Canonical results are in `../kaggle_runs/`. `../senguard_msc/results/` holds partial output from an interrupted local run and should not be cited.

## Sources
GEO: GSE284666, GSE309666, GSE178514. Code: maragkakislab/wf-ml-markers-senescence, WJPina/HUSI, KangBoming/bulkformer-latest. Papers: PMID 42276073, 41791726, 37831180, 34631285.
