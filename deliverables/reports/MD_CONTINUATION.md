# Molecular simulation continuation — 2 November 2026

The previous Claude2 session stopped while kernels I/J were running and the
MM/GBSA smoke test X was being debugged. The production protocol remains
`ANALYSIS_AMENDMENT_4_MD.md`, committed as `f665d2c` before production.

## Published preview

The molecular view uses one **WT NPT equilibration frame**, from kernel H's
`systems/wt/npt.gro`. It is not production playback, not a variant comparison,
and does not imply that the pre-registered gate passed. Camera rotation is
labelled as rotation. No RMSD, RMSF or binding energies are invented.

`site/tools/build_md_preview.py` rebuilds the compressed coordinate artifact
from the GRO and the two chain topology files. The artifact includes the source
SHA-256 and coordinate transformations. CDK6 and p16 in the raw GRO occupy
different periodic images. A rigid lattice translation reunites the chains;
solvent is wrapped into the same simulation cell. Internal coordinates are
unchanged. The preview highlights C-alpha pairs within 10 angstrom for visual
orientation, not a quantitative heavy-atom contact analysis.

Checked locally: 38/38 numeric comparisons with frozen Python results, 27/27
existing browser checks, plus molecular rendering, controls, mobile layout,
reduced-motion preference, provenance and missing-file behavior. Screenshots
are in `deliverables/qa/md_preview/`.

## Smoke-test corrections

- X v3: group names were applied to hard-coded indices 19 and 20, whereas the
  newly created groups were 17 and 18. Rename the generated residue groups by
  their actual names and require both CDK6 and P16 to exist.
- X v4: the raw equilibration coordinates placed the chains in different
  periodic images; the decomposition contact scan found no interface. X v5
  runs `gmx trjconv -pbc cluster` and supplies the reconstructed protein PDB as
  the MM/GBSA reference and the corresponding XTC as its trajectory.
- MM/GBSA failure now propagates instead of being hidden behind a shell `tail`
  pipeline. A completion marker requires an actual DELTA TOTAL result.

This follows the [GROMACS trjconv documentation](https://manual.gromacs.org/current/onlinehelp/gmx-trjconv.html)
and the [gmx_MMPBSA decomposition workflow](https://valdes-tresanco-ms.github.io/gmx_MMPBSA/1.7.0/examples/Decomposition_analysis/).

## Work still required

1. Confirm the corrected X test succeeds; this tests the software setup only.
2. Wait for I/J, then inspect every replica's logs, checkpoints and trajectory
   duration. A completed Kaggle job is not proof that every worker succeeded.
3. Resume missing/short runs if needed, keeping checkpoints and original seeds.
4. Trim all 12 runs to their common duration. Use the last half for analysis;
   below 15 ns per replica, mark the gate untested as specified in the protocol.
5. Reconstruct periodic images consistently before interface/energy analysis;
   do not interpret a coordinate-wrapping artifact as dissociation.
6. Compute and audit MM/GBSA and secondary readouts, then export real data for
   the existing draft `site/js/md.js`. That draft is not wired into the live
   page. The current molecular renderer does not yet implement its FEL API.
7. Test and publish the production view, including failed or untested gates.

At takeover the uncommitted I/J notebook edits already existed. They are
preserved; no production jobs were restarted during the preview work.
