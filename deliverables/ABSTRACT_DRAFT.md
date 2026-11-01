# Draft abstract, Track 3: MedTech Innovation

Status: draft for author review. The track text gives no abstract format or word limit, so check those. Development stage: working software with retrospective validation on public data, not yet used by a lab. Live demo: https://dwind-source.github.io/senguard-msc/

**Title:** SenGuard-MSC: forecasting a senescence signature before expanding mesenchymal stromal cell cultures

**Problem.** Mesenchymal stromal cell (MSC) products are expanded to increase doses, and expansion may induce senescence. Labs need to know where a culture is heading, but published transcriptomic scores only describe the sample in hand, are easy to misapply, and return a plausible number even from invalid input.

**Solution.** SenGuard-MSC is a web tool that takes RNA-seq counts from a culture. From one early sample it forecasts how a published senescence signature moves at later passages. From a series, it builds a 3D data twin, compares forecast with measurement donor by donor, and gives a record for each sample. It first checks gene identifiers, scale, transformation, coverage, depth, donor identity and passage design, and refuses input it can't score validly. Data stays in the browser, and it works offline after the first visit.

**Technology.** A per-gene drift model learned across 8 MSC cohorts forecasts the SenCat signature from within-sample gene ranks. Guard thresholds came from measurement. Browser and Python pipelines agree numerically, with automated tests including a real-browser test of each user flow.

**Evidence.** Analysis plans were fixed and hashed before each test. Frozen first, the forecast was then tested on 17 donors in 3 never-used cohorts: it was closer than assuming no change in 13 (76%, p=0.049), median error 0.010 vs 0.040, and in all 3 cohorts, against 33% with shuffled training labels. The signature rose in 19/22 donors in other new cohorts (p<0.001), or 21/27 including one that failed the identity check. Gene-by-gene forecasting and per-donor rates failed their tests and were left out. No signature clearly beat single transcripts such as CDKN2A, and there was no link with clinical response in eight GVHD lots (p=0.63). The check caught a labelling inconsistency in a public dataset.

**Implementation.** The intended use is a research readout during process development, not a release test. It doesn't measure potency, immune function, growth arrest or safety. A proposed pilot would sequence one early passage, record the forecast, and then compare it with RNA-seq, SA-beta-gal and growth data at later passages, which would test its value prospectively for the first time.
