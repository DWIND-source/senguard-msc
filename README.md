# SenGuard-MSC

Tracks a published senescence signature across passages of mesenchymal stromal cell (MSC) cultures, donor by donor, and refuses to answer when the data can't support one.

**Live demo: https://dwind-source.github.io/senguard-msc/**

Research prototype for AMIM 2026, Track 3. **Not a release test.** It does not measure potency, immune function or clinical safety, and it makes no pass or fail call.

## What it does
- Checks gene identifiers, data scale, transformation, signature coverage, sequencing depth, donor identity and passage design, and stops when a check fails.
- Scores the published SenCat signature and a culture-drift clock, and reports each donor against itself.
- Compares the result with random signatures.
- Runs entirely in the browser. Uploaded data never leaves your machine.

## Main results
All from public GEO data. Plans were written and hashed before scoring.

| Question | Result |
|---|---|
| Published weights reproduced from public counts | Spearman 0.99997 |
| Score rises with passage, new cohorts passing the identity check | 19/22 donors, p < 0.001 |
| The same, as registered, with a cohort that failed the check | 21/27 donors, p = 0.006 |
| Drift clock, each cohort held out | 35/35 donors rising |
| One signature clearly better than the others | No; CDKN2A alone matches it on direction |
| Higher score in GVHD non-responders | Not supported, p = 0.63, 8 lots |

The score also rose during short GMP expansion and while published potency was retained, and absolute values differ widely across labs and media. See [limitations](deliverables/LIMITATIONS.md).

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
node site/test/compare_python.mjs          # tests, from the repository root
python -m http.server --directory site     # local copy of the app
```

## Reproducing the analysis
The kernels in `kaggle/` run in the order A, then B and C, E, then D. They download GEO data and author repositories themselves. Seed 42.

## Data and licences
Code is under the MIT licence, see `LICENSE`. Files in `site/data` are subsets of public GEO series, credited to their submitters. SenCat weights aren't redistributed: the app downloads them from [the authors' repository](https://github.com/maragkakislab/wf-ml-markers-senescence) at a pinned commit and verifies a checksum. Please cite SenCat (Anerillas et al., Molecular Cell 2026) and the GEO series listed in the app.
