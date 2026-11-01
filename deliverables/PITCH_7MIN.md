# 7-minute pitch and demo, 5-minute Q&A

Track 3 asks for Problem → Solution → Technology → Evidence → Implementation. All numbers below are measured results from this project.

Live demo: https://dwind-source.github.io/senguard-msc/  
Direct links for stage: add `?demo=adipose`, `?demo=logged`, `?demo=mislabelled` or `?demo=entrez` to the address. Add `&still=1` to skip the opening animation, or `&view=space` to open in expression space.

## Script
**0:00-1:00 Problem.** MSC therapies are expanded in culture to make more doses, and expansion can push cells toward senescence. A lab wants to know: if I keep expanding this culture, where is it heading? Today's scores only describe the sample in hand, and give them the wrong table and they still return a number that looks fine.

**1:00-1:40 Solution.** SenGuard-MSC takes RNA-seq from a culture. From one early sample it forecasts how a senescence signature moves at later passages. From a series it builds a data twin and compares forecast with measurement. It refuses data it can't score validly, and data never leaves the lab's machine.

**1:40-3:30 Live demo.**
1. **Early sample only.** Give it passage 1 alone. Type a target passage and read the forecast.
2. **Forecast vs measured.** Open the adipose cohort, held out of training. The orange line is the forecast from passage 1. Press play and the measured samples appear. Say what the screen shows: it beat assuming no change, and it still undershot the real rise.
3. **Real labelling error.** This one is a public dataset exactly as deposited on GEO. Y-linked expression contradicts its donor labels, and the tool stops. We found this while building it: this cohort first dragged our headline number down, and the check independent of any score showed why.

**3:30-4:10 Technology.** A drift model learned across 8 cohorts makes the forecast, working on gene ranks. We reproduced the published signature from raw counts, and added a culture-drift clock as a second readout. Guard thresholds come from measurement: we thinned reads, dropped genes and used technical replicates. The browser and Python pipelines agree to 13 decimal places, and tests run automatically on each change.

**4:10-5:50 Evidence.** Show the Evidence section.
- Plans were fixed and hashed before each test.
- Forecast, frozen, then tested on 17 donors in cohorts we had never touched: closer than assuming no change in 13, in all 3 cohorts. Shuffled labels won 33%.
- The signature rose in 19 of 22 donors in other new cohorts. Including the failed cohort: 21 of 27.
- Then what went against us, stated plainly:
  - Three forecasting ideas failed, including gene-by-gene prediction, and they aren't in the tool.
  - The forecast's p-value is close to the line, and one cohort was nearly a tie.
  - No link to clinical response in 8 GVHD lots, and the score rises while published potency is retained.

  So this forecasts a signature. It isn't a potency test, and the tool says so.

**5:50-6:40 Implementation.** A lab sequences one early passage, records the forecast, and later compares it with what it measures. It sits beside existing checks in process development, and it isn't a release test. It needs no install or server, works offline, and exports reports. The next step is a pilot: serial passages of one product with RNA-seq, SA-beta-gal and growth data on every sample. That tests whether the forecast is useful for a real decision. [Add a partner here only if one is confirmed.]

**6:40-7:00 Close.** Anyone can open it now and load real data. It tells you where the signature is heading, shows how right it was, and refuses when the data can't support an answer.

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
| Is it a copy of the cells? | No, and RNA-seq can't support that. It's a digital counterpart of a culture's expression that forecasts one signature and checks itself against later measurement. |
| How good is the forecast? | Closer than assuming no change in 13 of 17 never-used donors, median error 0.010 vs 0.040. It can undershoot, as the adipose example shows, and its 80% range of 0.14 is wide. Read it as a direction and rough size. |
| All test donors rose. Isn't that easy? | Yes, partly, and it hasn't been tested on cultures that don't rise. The test was whether it beat assuming no change, which is the fair baseline. A pilot needs to include stable cultures. |
| Can you predict when a culture stops growing? | No. Too few lineages have a growth endpoint, and early rate didn't predict later rate. It's the first thing a pilot should collect. |
