# 7-minute pitch and demo, 5-minute Q&A

Track 3 asks for Problem → Solution → Technology → Evidence → Implementation. All numbers below are measured results from this project.

Live demo: https://dwind-source.github.io/senguard-msc/  
Direct links for stage: add `?demo=adipose`, `?demo=logged`, `?demo=mislabelled` or `?demo=entrez` to the address.

## Script
**0:00-1:00 Problem.** MSC therapies are expanded in culture to make more doses, and expansion can push cells toward senescence. New transcriptomic senescence scores keep appearing, but they are dangerous in a specific way: give one the wrong table and it still returns a number that looks fine.

**1:00-1:40 Solution.** SenGuard-MSC checks the data first, refuses what it can't score validly, and reports how a published senescence signature moves within each donor. It runs in the browser, so data never leaves the lab's machine. It deliberately gives no pass or fail, because no threshold has been validated.

**1:40-3:30 Live demo.**
1. **Adipose MSC.** Every check, then 5 of 5 donors rising, the trajectories, and the random-signature control.
2. **Already-logged table.** It refuses, and explains that the table would otherwise be logged twice.
3. **Real labelling error.** This one is a public dataset exactly as deposited on GEO. Y-linked expression contradicts its donor labels, and the tool stops. We found this while building it: this cohort first dragged our headline number down, and the check independent of any score showed why.

**3:30-4:10 Technology.** We reproduced the published signature from raw counts. We added a culture-drift clock, a ridge model trained across cohorts, as a second readout. Guard thresholds come from measurement: we thinned reads, dropped genes and used technical replicates. The browser and Python pipelines agree to 13 decimal places, and tests run automatically on each change.

**4:10-5:50 Evidence.** Show the Evidence section.
- Plans were written and hashed before scoring.
- New cohorts: 19 of 22 donors rising, p < 0.001. Including the failed cohort: 21 of 27, p = 0.006.
- Clock: 35 of 35 donors rising, each cohort held out.
- Then what went against us, stated plainly:
  - No signature clearly wins; CDKN2A alone does about as well.
  - No link to clinical response in 8 GVHD lots.
  - The score rises even in short GMP expansion, and while published potency is retained.

  So this isn't a potency test, and the tool says so.

**5:50-6:40 Implementation.** It sits beside existing checks in process development. It is not a release test. Absolute scores differed by about 17 units across labs, so any threshold has to be set locally. The next step is a pilot: serial passages of one product with RNA-seq, SA-beta-gal and growth data on every sample. That is the data needed to test a threshold. [Add a partner here only if one is confirmed.]

**6:40-7:00 Close.** Anyone can open it now, on real data. It tells you what the data supports, and refuses when the data can't support an answer.

## Before going on stage
- Open the page once while online. The signature is fetched from the authors' repository, so test the venue network, and keep the saved reports in `demo/` plus a screen recording as a fallback.
- Practice the three demo steps with the direct links above.

## Likely jury questions
| Question | Honest answer |
|---|---|
| Does this predict potency? | No. We tested one clinical-response cohort and found no link, and in another the score rose while function was retained. |
| What's your accuracy? | On induced senescence with cell types held out, AUROC 0.98, an easy contrast. Irradiated vs control MSC, 1.0 with only 4 vs 4. Passage series have no per-sample labels, so we report trends. |
| Isn't passage already enough? | Possibly. Passage and score move together, and we can't yet show added value. The pilot tests that. The tool also catches data errors, which passage can't do. |
| Why use a signature if CDKN2A alone does as well? | On direction, it's about equal. We report that. A single gene is more exposed to technical noise, which we haven't tested head to head. That's an open question. |
| The clock got 35 of 35. Isn't that overfit? | Each cohort was held out, and shuffled labels gave a median rho of 0.13. It first failed its preset gate with the mislabelled cohort included, and we report that. It only estimates passage-like drift, which is why it isn't our claim of senescence. |
| You excluded a cohort that hurt your result. | We show both numbers. The exclusion comes from sex-linked genes, independent of any score, and we state it wasn't planned. |
| p = 0.0625 in one cohort isn't significant. | With five donors it can't go lower. Pooling donors across cohorts is what gives power. |
| What does it cost? | Compute is negligible. RNA-seq cost and turnaround haven't been measured in a lab. |
| Who is your user? | MSC process-development labs. We have yet to validate this with one. [Update if a partner is confirmed.] |
| What about regulation? | No regulatory work has been done. It's a research tool at this stage. |
