# Deviations from amendment 1

The first run of this analysis (kernel E version 1) exposed four problems. Each was fixed and everything was rerun. Results of the first run stay in kaggle_runs/e_v1.

1. **GSE48662 G2 samples were not parsed.** Their titles use a hyphen (MSC-G2-1). The first run's response table was empty and meaningless.
2. **GSE56362 failed to load.** Its platform labels symbols GENE_NAME. Fixed, so this registered cohort is now included.
3. **GSE119987 counted F2 twice.** F2.2 is a second culture of donor F2, and the series states 4 donors. First run: 16 of 22 donors rising.
4. **GSE125632 failed a sample identity check that does not depend on any score.** GEO lists donor 3 as the only male, but Y-linked expression sits in samples 5, 6, 13, 15 and 16, so its donor pairing is contradicted. The check itself was not registered in advance; it came from a planned column-order check that returned 65% agreement. This cohort is therefore reported both ways, and its within-donor units are not used in the head-to-head or the clock. In the first run the clock failed its gate with this cohort included (88% of held-out donors rising against the 90% required).

Results below come after these fixes. The scores, weights and tests are unchanged.
