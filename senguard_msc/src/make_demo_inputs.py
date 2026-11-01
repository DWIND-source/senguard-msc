"""Writes demo inputs from real public cohorts. Run from the project root."""
import sys
from pathlib import Path
import numpy as np, pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parent))
import senguard as sg

IN = sg.ROOT.parent / 'deliverables/demo/input'
IN.mkdir(parents=True, exist_ok=True)
m = pd.read_csv(sg.MANIFESTS / 'sample_manifest.csv', low_memory=False)
asc = pd.read_csv(sg.PROC / f'{sg.ASC}_matrix_as_deposited.tsv.gz', sep='\t', dtype={'gene_id': str}, low_memory=False).drop(columns=['ensembl', 'entrez', 'symbol'])
asc.to_csv(IN / 'adipose_msc_counts.tsv.gz', sep='\t', index=False)
m[m.study_accession == sg.ASC][['sample_id', 'donor', 'passage']].to_csv(IN / 'adipose_msc_samples.csv', index=False)
num = [c for c in asc.columns if c.startswith('GSM')]
logged = asc.copy()
logged[num] = np.log1p(logged[num])
logged.to_csv(IN / 'adipose_msc_already_logged.tsv.gz', sep='\t', index=False)
bm = m[(m.study_accession == sg.BM) & m.use_in_mrna_analysis].assign(donor=lambda d: d.candidate_biological_id.astype(int).astype(str))
bm[['sample_id', 'donor', 'passage']].to_csv(IN / 'bone_marrow_msc_samples.csv', index=False)
pd.read_csv(sg.PROC / f'{sg.BM}_matrix_as_deposited.tsv.gz', sep='\t', dtype={'gene_id': str}, low_memory=False).drop(columns=['ensembl', 'entrez', 'symbol']).to_csv(IN / 'bone_marrow_msc_entrez_ids.tsv.gz', sep='\t', index=False)
pd.read_csv(sg.PROC / f'{sg.BM}_tpm_ensembl.tsv.gz', sep='\t', dtype={'gene_id': str}).to_csv(IN / 'bone_marrow_msc_tpm.tsv.gz', sep='\t', index=False)
print(sorted(p.name for p in IN.iterdir()))
