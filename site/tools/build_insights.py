"""Builds site/data/insights.json: the cell-bank and culture-medium examples shown under "Compare culture options".

Both come from measured SenCat scores in deliverables/tables/ext_scores_long.csv. Nothing here is fitted.
Run from the repository root: python site/tools/build_insights.py
"""
from pathlib import Path
import json

import pandas as pd

P = Path(__file__).resolve().parents[2]
T = P / 'deliverables/tables'
OUT = P / 'site/data'
g = lambda v, n=2: round(float(v), n)

long = pd.read_csv(T / 'ext_scores_long.csv')
sc = long[long.score_name == 'SenCat published']
ev = json.loads((OUT / 'evidence.json').read_text(encoding='utf-8'))

# GSE269586: GMP Wharton's jelly MSC, master cell bank (passage 0) against the latest later passage of the same donor
bank = []
for donor, d in sc[sc.cohort == 'GSE269586'].groupby('unit'):
    d = d.sort_values('passage')
    first, last = d.iloc[0], d.iloc[-1]
    bank.append({'donor': str(donor), 'bank': g(first.score), 'later': g(last.score), 'laterPassage': int(last.passage), 'change': g(last.score - first.score)})
gmp = pd.read_csv(T / 'ext_gse269586_units.csv')
assert sum(b['change'] > 0 for b in bank) == int((gmp.slope > 0).sum()), 'bank-to-later direction must match the reported slopes'

# GSE194298: the same bone-marrow donors expanded in FBS or in human platelet lysate (HPL 0/AB)
med = pd.read_csv(T / 'ext_medium_effect.csv')
w = med.pivot_table(index=['donor', 'p'], columns='medium', values='s')
medium = [{'donor': f'Donor {int(d)}', 'passage': 'P1' if p == 1 else 'P4-5', 'fbs': g(r['FBS']), 'hpl': g(r['HPL 0/AB'])} for (d, p), r in w.iterrows()]
late = w.xs(4.5, level='p')
diff = late['HPL 0/AB'] - late['FBS']

insights = {
    'bank': {'cohort': 'GSE269586', 'donors': bank, 'rising': sum(b['change'] > 0 for b in bank), 'n': len(bank)},
    'medium': {'cohort': 'GSE194298', 'rows': medium, 'lateDiff': g(diff.mean(), 1), 'lowerIn': int((diff < 0).sum()), 'n': len(diff)},
    'noise': {'mdc': ev['facts']['mdc'], 'retestA': ev['facts']['retestA'], 'retestB': ev['facts']['retestB'], 'cohort': 'GSE137186', 'pairs': 2},
}
(OUT / 'insights.json').write_text(json.dumps(insights, indent=1), encoding='utf-8')
print(json.dumps({k: {kk: vv for kk, vv in v.items() if kk not in ('donors', 'rows')} for k, v in insights.items()}, indent=1))
