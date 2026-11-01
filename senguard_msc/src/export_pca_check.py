"""Reference PCA for the adipose demo cohort, computed with numpy, so the browser's expression space can be tested. Run from the project root."""
import json, sys
from pathlib import Path
import numpy as np, pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parent))
import senguard as sg

t = pd.read_csv('site/data/adipose_msc_counts.tsv.gz', sep='\t', low_memory=False)
samples = pd.read_csv('site/data/adipose_msc_samples.csv')
expr = t.set_index(t.columns[0])[samples.sample_id].T.astype(float)
norm = sg.mor_normalize(sg.author_gene_filter(expr))[0]
x = np.log1p(norm.to_numpy())
m = x.mean(axis=0)
keep = np.flatnonzero(m > 1)
var = x[:, keep].var(axis=0)
order = keep[np.argsort(-var, kind='stable')][:500]
c = x[:, order] - x[:, order].mean(axis=0)
u, s, _ = np.linalg.svd(c, full_matrices=False)
ev = s ** 2
coords = u[:, :3] * s[:3]
out = {'samples': samples.sample_id.tolist(), 'var_explained': (ev[:3] / ev.sum()).tolist(), 'coords': coords.tolist()}
json.dump(out, open('deliverables/tables/pca_check_adipose.json', 'w'))
print('variance explained', np.round(out['var_explained'], 3))
