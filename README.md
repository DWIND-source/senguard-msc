# SenGuard-MSC

A web tool for labs expanding mesenchymal stromal cells (MSC). From one early RNA-seq sample it forecasts how a published senescence signature moves at later passages. From a series it builds a 3D data twin and compares forecast with measurement, donor by donor. It refuses to answer when the data can't support one.

**Live demo: https://dwind-source.github.io/senguard-msc/**

For research use. Built for AMIM 2026, Track 3. **Not a release test.** It does not measure potency, immune function, growth arrest or clinical safety, and it makes no pass or fail call. It hasn't yet been used by a lab.

## What it does
- Checks gene identifiers, data scale, transformation, signature coverage, sequencing depth, donor identity and passage design, and stops when a check fails.
- Forecasts the SenCat signature at any later passage from one early sample.
- Scores the published signature and a culture-drift clock, and reports each donor against itself.
- Shows every sample in 3D: forecast against measured, by score and by expression, with a record for each sample.
- Accepts Ensembl ids or gene symbols, builds the sample sheet from column names, exports CSV and JSON, and works offline after the first visit.
- Compares the result with random signatures.
- Links a gene-expression heatmap, sample PCA, gene trajectories and passage dot plots. Forecast curves and drift bars replace the primary numeric tables; exact values and full validation remain expandable.
- Runs entirely in the browser. Uploaded data never leaves your machine.
- Shows a real p16–CDK6 equilibration frame in 3D, including the interface and solvent. Production MD comparisons are pending; the preview is independent of RNA scores.

## Main results
All from public GEO data. Plans were written and hashed before scoring.

| Question | Result |
|---|---|
| Published weights reproduced from public counts | Spearman 0.99997 |
| Score rises with passage, new cohorts passing the identity check | 19/22 donors, p < 0.001 |
| The same, as planned, with a cohort that failed the check | 21/27 donors, p = 0.006 |
| **Frozen forecast vs assuming no change, 3 never-used cohorts** | **Closer in 13/17 donors, p = 0.049; median error 0.010 vs 0.040** |
| Gene-by-gene forecast and per-donor rates | Failed their gates; left out |
| Drift clock, each cohort held out | 35/35 donors rising |
| One signature clearly better than the others | No; CDKN2A alone matches it on direction |
| Higher score in GVHD non-responders | Not supported, p = 0.63, 8 lots |

The forecast can undershoot, and every test donor rose, so it is untested on stable cultures. The score also rose during short GMP expansion and while published potency was retained, and absolute values differ widely across labs and media. See [limitations](deliverables/LIMITATIONS.md).

## Repository
| Path | Contents |
|---|---|
| `site/` | The web app; `site/js/core.js` is the analysis core |
| `site/test/` | Tests comparing the browser core with Python results |
| `senguard_msc/src/` | Python library, command-line tool and tests |
| `notebooks/`, `kaggle/` | Analysis notebooks and the Kaggle kernels that ran them |
| `kaggle_runs/` | Saved results of those runs |
| `deliverables/` | Abstract, pitch, methods, limitations, figures, tables, protocols |

## Run it
```
node site/test/compare_python.mjs          # numeric tests, from the repository root
python site/test/e2e.py http://127.0.0.1:8000   # drives each user flow in Edge; needs playwright
python site/test/md_preview.py http://127.0.0.1:8000  # structure, controls, mobile and missing-data checks
python -m http.server --directory site     # local copy of the app
```

## Reproducing the analysis
The kernels in `kaggle/` run in the order A, then B and C, E, then D, F, G. They download GEO data and author repositories themselves. Seed 42.

## Data and licences
Code is under the MIT licence, see `LICENSE`. Files in `site/data` are subsets of public GEO series, credited to their submitters. SenCat weights aren't redistributed: the app downloads them from [the authors' repository](https://github.com/maragkakislab/wf-ml-markers-senescence) at a pinned commit and verifies a checksum. Please cite SenCat (Anerillas et al., Molecular Cell 2026) and the GEO series listed in the app.
