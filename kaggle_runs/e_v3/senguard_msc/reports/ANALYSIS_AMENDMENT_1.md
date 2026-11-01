# Analysis protocol amendment 1

Fixed on 2026-11-01, after G3 results on GSE309666 and GSE178514 were seen, and before any cohort below was scored.
Inclusion came from GEO metadata only. Published and refit weights stay frozen.

## New cohorts
| Cohort | Tissue | Design | Use |
|---|---|---|---|
| GSE137186 | BM | 4 donors, P1, P5, P10, P15, 2 resequenced samples | Pooled; test-retest; authors report retained immunoregulatory potency |
| GSE275980 | MSC, tissue unstated in the abstract | 3 donors, P2, P6, P10 | Pooled |
| GSE125632 | BM | 5 donors, P2 vs P11 labelled senescent by authors | Pooled; labelled check |
| GSE194298 | BM | 4 donors, p1 vs p4/5, FBS and hPL | Pooled per donor; medium effect |
| GSE119987 | UC | 4 donors to replicative senescence, array, doubling level known | Pooled; early change |
| GSE56362 | BM | Donors at P3, P5, P7 with technical replicates, array | Pooled; test-retest |
| GSE233634 | UC | P3 to P12 in triplicate, no donor stated, counts as one unit | Pooled as one lineage |
| GSE269586 | WJ | GMP production, master bank to P2 or P3 | Not pooled: short-expansion comparison |
| GSE48662 | BM | Irradiated vs control; GVHD responders G1 (5) vs non-responders G2 (3), array | Labelled check; clinical-response question |

## Primary question
Across donors in new pooled cohorts, does the published SenCat score rise with passage? Test: two-sided exact binomial on donors, plus a cohort-level sign-flip test. Log1p weighted score on RNA-seq; rank-weighted form on arrays. Sensitivities: rank form everywhere, weights refit without BMMSC and preadipocytes, excluding GSE56362 (gene-normalized values), and excluding GSE233634.

## Head-to-head
Published SenCat, hUSI, SenMayo, the 7-gene signature of Yang 2023, the 40 AD-MSC biomarkers, Hallmark E2F and G2M (inverted), and CDKN2A, CDKN1A, IL6, GDF15, LMNB1 (inverted) transcripts, all in rank form. Reported: pooled donors rising, median within-donor rho, cohorts with a positive mean. Results on a score's own training cohort are flagged and left out of its pooled count. No single winner is declared unless its lead is clear of the uncertainty.

## Clinical-response question
One directional hypothesis: published SenCat rank score is higher in GVHD non-responders (G2) than responders (G1). Exact permutation, smallest one-sided p 1/56. The outcome will be reported either way, and it would be hypothesis-generating at any p.

## Labelled MSC checks
AUROC is allowed only where the authors define the classes: GSE48662 control vs irradiated, GSE125632 P2 vs P11 senescent. Within-cohort only, with no transported threshold.

## Drift clock (trained model)
Ridge regression of within-donor log2(passage + 1) on within-sample gene ranks, with leave-one-cohort-out validation and all selection inside training cohorts. It estimates passage-like drift and is not a senescence or potency measure. Negative control: passages shuffled within donors in training. It enters the demo only if held-out median within-donor rho is at least 0.8, at least 90% of held-out donors rise, and the shuffled control's median rho stays below 0.3.

## Robustness
Binomial thinning of counts, random gene dropout, technical test-retest, leave-one-sample-out normalization, medium effect, and absolute-score comparability across cohorts. These set guard thresholds in the tool from measurement instead of judgement.
