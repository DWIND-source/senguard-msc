# Analysis amendment 4: molecular dynamics of the p16INK4a-CDK6 complex

Written and committed before any production simulation was run.
Only the build and speed test (kernel H) had run at the time of writing.

## Why this exists

SenGuard scores RNA. CDKN2A, the gene for p16INK4a, rose in 27 of 30 donors in our cohorts.
This amendment adds a physical view of what p16 does: it binds CDK6 and blocks the kinase.

It does not add evidence for the SenGuard score. No sample, donor or culture enters this simulation, and no result here changes a score, a forecast or a check.

## Question

Can this simulation setup separate p16 variants with known functional effects?
If it cannot, the structure view is a visual explanation only, and we will say so.

## Systems

Starting model: CDK6-p16INK4a crystal structure PDB 1BI7, 3.4 A (Russo et al., Nature 1998).

- CDK6 residues 10-301 and p16 residues 10-134, capped with ACE and NME. Disordered termini are left out.
- CDK6 residues 49-71 are missing from 1BI7. They are grafted from CDK6 in PDB 1BLX (CDK6-p19INK4d, 1.9 A), after fitting on the flanking C-alpha atoms.
- The graft is a model, not an observation. Its junctions start stretched (71-72 at 2.43 A) and are relaxed by energy minimisation.

| System | Change in p16 | Class in Kimura et al., eLife 2022 | At the interface in 1BI7 |
|---|---|---|---|
| WT | none | reference | |
| R24P | Arg24 to Pro | pathogenic benchmark | yes, contacts CDK6 Asp104 and Gln149 |
| D84N | Asp84 to Asn | likely pathogenic benchmark | yes, salt bridge to CDK6 Arg31 |
| H123Q | His123 to Gln | benign benchmark | yes, contacts CDK6 Ser155 |

Classes come from a cell proliferation assay, not from a binding assay. A variant can lose function without losing binding, so a null here would not contradict that assay.

## Simulation

- GROMACS 2026.3 (conda-forge CUDA build), AMBER99SB-ILDN, TIP3P, 0.15 M NaCl, rhombic dodecahedron with 1.0 nm padding, about 60,000 atoms.
- Minimisation, then 200 ps NVT and 500 ps NPT with heavy-atom position restraints.
- Production: 310 K (V-rescale), 1 bar (C-rescale), 4 fs step with hydrogen mass repartitioning, PME, 1.0 nm cut-offs. Protein coordinates saved every 50 ps.
- 3 replicas per system with separate velocity seeds (seed = 2026 + 100 x system index + replica, order WT, R24P, D84N, H123Q).
- Target: 25 ns per replica, 300 ns in total. The length comes from the GPU quota, measured at about 155 ns/day per GPU.
- If the quota ends early, all replicas are cut to the same shortest length, and that length is reported. Under 15 ns per replica, the gate below is reported as not tested.

## Analysis

The last 50% of each replica is the analysis window.

Primary readout: MM/GBSA binding energy (gmx_MMPBSA, single trajectory, igb=5, 0.15 M salt, one frame every 250 ps), as a per-replica mean.

Gate, with the replica as the unit:

1. R24P and D84N: all 3 replicas are each weaker than all 3 WT replicas. Exact one-sided permutation p = 0.05, the smallest possible with 3 against 3.
2. H123Q: not fully separated from WT in the weaker direction, and its mean shift is smaller than the shift of each pathogenic variant.

The gate passes only if 1 and 2 both hold. Whatever the outcome, it will be published on the site.

Secondary readouts, descriptive only, no gate: fraction of starting interface contacts kept, interface hydrogen bonds, CDK6 Arg31 to p16 Asp84 distance, RMSD, RMSF, radius of gyration, SASA, total hydrogen bonds, per-residue energy, PCA, free energy landscape on RMSD and Rg, and residue cross-correlation.

RMSD is fitted on C-alpha atoms and excludes the graft, CDK6 49-71.

## What we already expect to limit this

- 25 ns is short. Unbinding will not be sampled, so this reports the bound state only and gives no rates.
- MM/GBSA energies are relative and not binding constants. Entropy is left out.
- R24P and D84N both remove a charge at the interface, and H123Q does not. MM/GBSA may separate them partly for that simple reason, so a pass would show the setup reads a charge loss and would not show that it predicts function.
- 3.4 A is a low resolution starting model, and the grafted segment comes from a different complex.
- Three replicas allow a direction and nothing stronger.
- Free energy landscapes from 25 ns describe sampling in these runs and are not equilibrium free energies.
- A forcefield-specific bias is possible. Only one forcefield is run.
