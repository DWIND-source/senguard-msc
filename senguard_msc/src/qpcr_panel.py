"""Candidate qPCR panel: exploratory comparison against the RNA-seq SenCat score.

Reads the frozen G5 panels and scores them the way a qPCR panel would be read in a lab: each gene is
log2-transformed, standardized within the cohort, signed by its published SenCat coefficient and averaged.
No weights are fitted on MSC data. CDKN2A alone is scored on the same footing. The reference is the
full published SenCat score from RNA-seq (deliverables/tables/ext_scores_long.csv).

Outputs deliverables/tables/qpcr_panel_genes.csv, qpcr_panel_vs_cdkn2a.csv and site/data/panel.json.
"""
from pathlib import Path
import json

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

P = Path(__file__).resolve().parents[2]
T = P / 'deliverables/tables'
PROC = P / 'senguard_msc/data/processed'
SITE = P / 'site/data'

panels = json.loads((T / 'g5_panels_frozen.json').read_text())
direction = pd.read_csv(T / 'g5_panel_gene_direction_asc.csv').set_index('gene_id')
ranked = pd.read_csv(T / 'g5_panel_ranked.csv').set_index('gene_id')
long = pd.read_csv(T / 'ext_scores_long.csv')
sym = json.loads(__import__('gzip').open(SITE / 'symbol_to_ensembl.json.gz').read())
ens2sym = {v: k for k, v in sym.items()}

PSEUDOGENES = {'ENSG00000259781', 'ENSG00000132967'}  # HMGB1P6, HMGB1P5: primers would also amplify HMGB1


def flag(gid):
    if gid in PSEUDOGENES:
        missing = '' if gid in direction.index else '; no passage-direction data'
        return f'HMGB1 pseudogene; qPCR primers cannot separate it from HMGB1{missing}'
    if gid not in direction.index:
        return 'No passage-direction data in the reference cohort'
    r = direction.loc[gid]
    agree = r.donors_up if r.dev_sign > 0 else r.donors_down
    if agree < 4:
        return f'Inconsistent direction: {int(r.donors_up)} donors up, {int(r.donors_down)} down, expected {"up" if r.dev_sign > 0 else "down"}'
    return ''


genes = []
for gid in panels['20']:
    d = direction.loc[gid] if gid in direction.index else None
    symbol = d.symbol if d is not None else ranked.symbol.get(gid) if isinstance(ranked.symbol.get(gid), str) else ens2sym.get(gid, gid)
    sign = d.dev_sign if d is not None else np.sign(ranked.published_sencat_coef.get(gid, np.nan))
    genes.append({'gene_id': gid, 'symbol': symbol, 'in_panel_10': gid in panels['10'], 'sencat_sign': sign,
                  'donors_up': None if d is None else int(d.donors_up), 'donors_down': None if d is None else int(d.donors_down),
                  'proliferation_set': bool(ranked.is_e2f_g2m.get(gid, False)), 'flag': flag(gid)})
genes = pd.DataFrame(genes)
genes.to_csv(T / 'qpcr_panel_genes.csv', index=False)
ready = genes[genes.flag == ''].gene_id.tolist()

cohorts = {
    'GSE309666': (PROC / 'GSE309666_norm_counts.tsv.gz', SITE / 'adipose_msc_samples.csv'),
    'GSE178514': (PROC / 'GSE178514_tpm_ensembl.tsv.gz', SITE / 'bone_marrow_msc_samples.csv'),
}
cdkn2a = 'ENSG00000147889'
candidates = {'Panel 10 (frozen)': panels['10'], 'Panel 20 (frozen)': panels['20'], f'qPCR-ready panel ({len(ready)} genes)': ready, 'CDKN2A alone': [cdkn2a]}
sign_of = dict(zip(genes.gene_id, genes.sencat_sign)) | {cdkn2a: 1.0}

rows, donor_rows = [], []
for acc, (expr_path, sheet_path) in cohorts.items():
    x = pd.read_csv(expr_path, sep='\t', index_col=0)
    x.index = x.index.str.split('.').str[0]
    meta = pd.read_csv(sheet_path).set_index('sample_id')
    x = np.log2(x[meta.index] + 1)
    ref = long[(long.cohort == acc) & (long.score_name == 'SenCat published')].set_index('sample').score.reindex(meta.index)
    for name, ids in candidates.items():
        have = [g for g in ids if g in x.index]
        z = x.loc[have].sub(x.loc[have].mean(1), axis=0).div(x.loc[have].std(1, ddof=0).replace(0, np.nan), axis=0)
        score = (z.mul([sign_of[g] for g in have], axis=0)).mean(0)
        rhos, same_dir, up = [], 0, 0
        centred_s, centred_r = [], []
        for donor, m in meta.groupby('donor'):
            s, r, p = score[m.index], ref[m.index], m.passage
            slope_s, slope_r = np.polyfit(p, s, 1)[0], np.polyfit(p, r, 1)[0]
            rho = spearmanr(s, r).correlation if len(m) > 2 else np.sign(slope_s * slope_r)
            rhos.append(rho); same_dir += np.sign(slope_s) == np.sign(slope_r); up += slope_s > 0
            centred_s += list(s - s.mean()); centred_r += list(r - r.mean())
            donor_rows.append({'cohort': acc, 'candidate': name, 'donor': donor, 'samples': len(m), 'slope_sign_matches_rnaseq': bool(np.sign(slope_s) == np.sign(slope_r)), 'spearman_with_rnaseq': rho})
        rows.append({'cohort': acc, 'candidate': name, 'genes_present': len(have), 'donors': meta.donor.nunique(),
                     'donors_rising': int(up), 'direction_matches_rnaseq': int(same_dir),
                     'median_within_donor_spearman': float(np.median(rhos)),
                     'within_donor_pearson': float(np.corrcoef(centred_s, centred_r)[0, 1])})

res = pd.DataFrame(rows)
res.to_csv(T / 'qpcr_panel_vs_cdkn2a.csv', index=False)
pd.DataFrame(donor_rows).to_csv(T / 'qpcr_panel_vs_cdkn2a_donors.csv', index=False)
print(genes.to_string(index=False))
print(res.round(3).to_string(index=False))

summary = res.groupby('candidate', sort=False).agg(donors=('donors', 'sum'), rising=('donors_rising', 'sum'), match=('direction_matches_rnaseq', 'sum'), r=('within_donor_pearson', 'mean')).reset_index()
(SITE / 'panel.json').write_text(json.dumps({
    'genes': json.loads(genes.to_json(orient='records')),
    'comparison': json.loads(res.round(3).to_json(orient='records')),
    'summary': json.loads(summary.round(3).to_json(orient='records')),
    'external': json.loads(pd.read_csv(T / 'g5_panels_external_exploratory.csv').round(3).to_json(orient='records')),
}, indent=1), encoding='utf-8')
