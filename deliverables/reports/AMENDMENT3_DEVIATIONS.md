# Deviations from amendments 2 and 3

- The score forecast was singled out for an independent test after notebook 07 showed it passing one criterion while the full gene-level gate failed. The independent cohorts, the frozen model and the gate were then fixed before those cohorts were scored, and that test is what supports the claim.
- Kernel G version 1 failed on three parsing problems: GSE39035's symbol column is named GeneName, GSE139073's header is one field shorter than its rows, and one type error in the negative control. These were fixed and the kernel rerun. Version 1's only scored cohort, GSE9593, gave the same result in version 2. Model, cohorts and gate didn't change.
- Very small errors in GSE9593 were checked: no test cohort is in training, and errors at mid passages in the long series reached 0.034, so the near-zero values at the last passage are coincidence and not leakage.
