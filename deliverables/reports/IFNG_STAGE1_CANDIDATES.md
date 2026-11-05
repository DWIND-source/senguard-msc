# IFN-γ response: stage 1 dataset search (for review)

Status: stage 1 only. Nothing has been downloaded or scored. Stage 2 (a pre-specified analysis plan, then an exploratory
IFN-γ response index kept separate from SenCat) starts only after these candidates are approved.

Search, 2026-11-05: GEO DataSets (`mesenchymal AND (IFN-gamma OR interferon gamma OR IFNg OR IFNG) AND gse[ETYP] AND human[orgn]`,
104 series, 74 sequencing series screened by title and design), BioStudies/ArrayExpress (MSC + IFN/licensing terms), and the
literature. Series records were read from GEO's SOFT text; doses and assays for GSE291956 were checked in the full text (PMC12356719).

## What stage 2 needs

MSC RNA-seq before and after IFN-γ from the same donors, ideally IFN-γ alone (not a cytokine cocktail), at least 3 donors,
and a functional readout (T-cell or PBMC suppression, IDO activity) on the same lots.

## Candidates

| Accession | Cells | Donors | IFN-γ dose and time | Same-donor pairs | Functional / lab readouts | Fit |
|---|---|---|---|---|---|---|
| [GSE291956](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE291956) ([Galera 2025, Stem Cell Rev Rep](https://doi.org/10.1007/s12015-025-10906-8)) | Adipose MSC, 10% pooled hPL | 3 | 25 ng/mL, 24 h before harvest or continuous | Yes: untreated, IFN-γ 24 h and continuous IFN-γ for each donor at P0 to P7 (73 samples) | PBMC co-culture suppression (CFSE) in early and late passages; cumulative population doublings per passage; morphology | **Best fit.** IFN-γ alone, paired, functional assay, and growth data for the cell-bank question too |
| [E-MTAB-14215](https://www.ebi.ac.uk/biostudies/arrayexpress/studies/E-MTAB-14215) | Adipose MSC, P1, 5% hPL | Not confirmed (sample table not retrieved) | 20 ng/mL, 48 h, with rapamycin or vehicle | Yes, stimulated vs unstimulated | None stated | Good if it has 3 or more donors; needs the SDRF checked |
| [GSE348230](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE348230) | Adipose MSC (ATCC PCS-500-011) | 1 lot | 50 ng/mL, 10 h; also trained 24 h, rested 10 days, restimulated 10 h | 3 replicates per condition | None (IDO1, CXCL11 expression) | Single donor: useful for timing and "memory", not for donor differences |
| [GSE165811](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE165811) ([Zhang 2021, Cell Death Dis](https://doi.org/10.1038/s41419-021-03644-5)) | Umbilical-cord MSC | 3 strains paired (3 replicates); 32 donors unstimulated | IFN-γ **plus TNF-α** ("2IF"); dose not in the GEO record | Yes, for 3 strains | In vitro and in vivo immunomodulation across 32 donors (unstimulated) | Strong functional data, but IFN-γ is combined with TNF-α |
| [GSE197302](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE197302) | Bone-marrow MIAMI cells, 1 line | 1 | 500 U, with tamoxifen or chloroquine | 3 replicates | Immunoregulatory capacity reported in the paper | One line; lncRNA focus |
| [GSE115149](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE115149) ([Jitschin 2019, Leukemia](https://doi.org/10.1038/s41375-018-0376-6)) | Bone-marrow MSC, single-cell | 1 | 10 ng/mL IFN-γ + 15 ng/mL TNF-α, 24 h | Yes | T-cell suppression in the paper | One donor, single-cell, cocktail |
| [GSE244404](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE244404), [GSE269628](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE269628) | Gingival MSC | 2 and 3 | IL-1β 1 + TNF-α 10 + IFN-γ 100 ng/mL, 24 and 72 h | Yes | Proliferation, colony formation; no immune assay | Cocktail; no immune readout |
| [GSE224190](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE224190) | Umbilical-cord MSC | 3 replicates | IL-1β + TNF-α + IFN-γ | Yes | In vivo model in the paper | Cocktail; probably one line |
| [GSE122091](https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE122091) | Embryonic-stem-cell-derived MSC | Not donor-based | IFN-γ, 1 and 3 days | 3 replicates | None | Microarray; not donor material |
| [E-MTAB-16267](https://www.ebi.ac.uk/biostudies/arrayexpress/studies/E-MTAB-16267) | Adipose stromal cells, type 2 diabetes vs healthy | About 15 | IFN-γ + TNF-α, 48 h | Yes | Functional work in the paper | Microarray; cocktail |

## Recommendation

1. Use **GSE291956** as the primary stage-2 dataset. It is the only candidate with IFN-γ alone, several donors, same-donor
   pairs and a suppression assay. Its limits: 3 donors, and the PBMC results may be reported per condition rather than per lot
   (check the supplementary data before planning).
2. Check **E-MTAB-14215** for its donor count. If it has 3 or more donors it is a second, independent IFN-γ-only set.
3. Keep GSE165811 as a sensitivity set for IFN-γ + TNF-α, labelled as such. Do not pool cocktail and IFN-γ-only data.

With 3 to 6 donors, stage 2 can at best describe a transcriptional IFN-γ response. It cannot support a prediction of immune
function unless per-lot functional values are available; the page wording follows that.

## Morphology

[Klinker et al., PNAS 2017](https://pubmed.ncbi.nlm.nih.gov/28283659/) and
[Liu et al., Commun Biol 2026](https://doi.org/10.1038/s42003-026-09833-2) predict immunosuppression from images after IFN-γ.
GSE291956 also recorded morphology, so it is the natural first dataset if an image module is added. No image data are used yet.
