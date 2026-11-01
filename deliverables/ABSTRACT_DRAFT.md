# Draft abstract, Track 3: MedTech Innovation

Status: draft for author review. The track text gives no abstract format or word limit, so check those. Development stage: working prototype with preliminary retrospective validation. Live demo: https://dwind-source.github.io/senguard-msc/

**Title:** SenGuard-MSC: a guarded browser tool for tracking senescence signatures across passages of mesenchymal stromal cell cultures

**Problem.** Mesenchymal stromal cell (MSC) products are expanded to increase doses, and expansion may induce senescence. Transcriptomic senescence scores are published, but they are easy to misapply, rarely tested on independent MSC cohorts, and yield a plausible number even from invalid input.

**Solution.** SenGuard-MSC builds a 3D data twin of a culture series from its measured expression. It takes an expression table and sample sheet, checks gene identifiers, data scale, transformation, signature coverage, sequencing depth, donor identity and passage design, refuses input it cannot score validly, and reports within-donor trends. It runs entirely in the browser, so data stays on the user's machine. It makes no pass/fail call, because no threshold has been validated.

**Technology.** The tool applies the published SenCat signature with verified normalization, plus a culture-drift clock we trained on within-donor gene ranks. Guard thresholds were set from measurement: read thinning, gene dropout and technical replicates. Browser and Python pipelines agree within 1e-13 on scores.

**Evidence.** Analysis plans were written and hashed before scoring. Published weights were reproduced from public counts (Spearman 0.99997). In previously unscored MSC cohorts, the score rose in 19/22 donors (86%, 95% CI 65-97%, p<0.001), or 21/27 (78%, p=0.006) when including a cohort that failed the identity check. The drift clock rose in 35/35 donors when each cohort was held out. No signature clearly outperformed others, including single transcripts such as CDKN2A. The score did not differ by clinical response in eight GVHD lots (p=0.63), rose during short GMP expansion, and rose while published potency was retained, so it should not be read as potency. Absolute scores differed widely across labs and media. A next-passage forecast failed its preset back-test and was left out. The identity check exposed a labelling inconsistency in one public dataset.

**Implementation.** The intended use is a research readout during process development, not a release test. A proposed pilot would pair RNA-seq with SA-beta-gal and growth data on every sample across serial passages, allowing thresholds to be tested for the first time. It does not measure potency, immune function or safety.
