"""Technical tests for the prototype, using real public cohorts. Run from the project root. Writes demo reports and a results table."""
import json, sys
from pathlib import Path
import numpy as np, pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parent))
import senguard as sg
import senguard_qc as qc

OUT = sg.ROOT.parent / 'deliverables/demo'
OUT.mkdir(parents=True, exist_ok=True)
G3 = pd.read_csv(sg.ROOT.parent / 'deliverables/tables/external_predictions.csv')
G3 = G3[G3.score_name == 'SenCat published'].set_index('sample_id').score
m = pd.read_csv(sg.MANIFESTS / 'sample_manifest.csv', low_memory=False)
asc_s = m[(m.study_accession == sg.ASC)][['sample_id', 'donor', 'passage']]
bm_s = m[(m.study_accession == sg.BM) & (m.use_in_mrna_analysis)].assign(donor=lambda d: d.candidate_biological_id.astype(int).astype(str))[['sample_id', 'donor', 'passage']]
asc_t = pd.read_csv(sg.PROC / f'{sg.ASC}_matrix_as_deposited.tsv.gz', sep='\t', dtype={'gene_id': str}, low_memory=False).drop(columns=['ensembl', 'entrez', 'symbol'])
bm_tpm = pd.read_csv(sg.PROC / f'{sg.BM}_tpm_ensembl.tsv.gz', sep='\t', dtype={'gene_id': str})
bm_raw = pd.read_csv(sg.PROC / f'{sg.BM}_matrix_as_deposited.tsv.gz', sep='\t', dtype={'gene_id': str}, low_memory=False).drop(columns=['ensembl', 'entrez', 'symbol'])

rows = []
def case(name, table, samples, scale, expect, needle=None, report=None):
    res = qc.run(table, samples, scale, n_null=50)
    ok = res['status'] == expect and (needle is None or any(needle in r for r in res['refusals']))
    detail = res['refusals'][0] if res['refusals'] else f"{res['donors_rising']}/{res['donors']} donors rising, mean slope {res['mean_slope']:+.3f}"
    rows.append({'case': name, 'expected': expect, 'got': res['status'], 'pass': bool(ok), 'detail': detail})
    if report:
        (OUT / report).write_text(qc.render(res, name), encoding='utf-8')
    return res

a = case('AD-MSC real cohort, counts', asc_t, asc_s, 'counts', 'REPORT', report='report_GSE309666_AD_MSC.html')
b = case('BM-MSC real cohort, TPM', bm_tpm, bm_s, 'tpm', 'REPORT', report='report_GSE178514_BM_MSC.html')
for label, r in [('AD-MSC', a), ('BM-MSC', b)]:
    got = pd.Series(r['scores'])
    diff = float((got - G3.reindex(got.index)).abs().max())
    rows.append({'case': f'{label} scores match the frozen G3 scores', 'expected': 'max difference under 1e-3', 'got': f'{diff:.6f}', 'pass': diff < 1e-3, 'detail': ''})
case('Entrez ids, not Ensembl', bm_raw, bm_s, 'fpkm', 'REFUSED', 'not Ensembl', report='report_refused_wrong_ids.html')
logged = asc_t.copy(); num = [c for c in logged.columns if c.startswith('GSM')]; logged[num] = np.log1p(logged[num])
case('Already log-transformed table', logged, asc_s, 'counts', 'REFUSED', 'log-transformed', report='report_refused_logged.html')
neg = asc_t.copy(); neg[num] = neg[num] - 1.0
case('Negative values', neg, asc_s, 'counts', 'REFUSED', 'Negative')
rng = np.random.default_rng(sg.SEED)
case('Half of the genes missing', asc_t.sample(frac=0.5, random_state=sg.SEED), asc_s, 'counts', 'REFUSED', 'coverage')
tpmish = asc_t.copy(); tpmish[num] = tpmish[num].div(tpmish[num].sum()) * 1e6
case('TPM table declared as counts', tpmish, asc_s, 'counts', 'REFUSED', 'TPM')
case('Counts declared as TPM', asc_t, asc_s, 'tpm', 'REFUSED', 'Declared TPM')
one = asc_s[asc_s.passage == 1]
case('One passage per donor', asc_t, one, 'counts', 'REFUSED', 'distinct passages')
case('Sample missing from table', asc_t, pd.concat([asc_s, pd.DataFrame([{'sample_id': 'GSM0', 'donor': 'A', 'passage': 2}])]), 'counts', 'REFUSED', 'no column')
two = asc_s[(asc_s.donor != 'A') | (asc_s.passage < 7)]
r = case('One donor under 3 passages: others still assessed', asc_t, two, 'counts', 'REPORT')
rows.append({'case': 'Short donor reported as not assessed', 'expected': 'warning names donor A', 'got': str(any('Not assessed' in w and "'A'" in w for w in r['warnings'])), 'pass': any('Not assessed' in w and "'A'" in w for w in r['warnings']), 'detail': ''})

t = pd.DataFrame(rows)
t.to_csv(OUT / 'prototype_test_results.csv', index=False)
print(t.to_string(index=False, max_colwidth=78))
print(f"\nPassed {int(t['pass'].sum())} of {len(t)}")
sys.exit(0 if t['pass'].all() else 1)
