"""Builds site/data from saved results. Every number on the Evidence section comes from here; nothing is typed by hand.
Run from the project root: python site/tools/build_site_data.py"""
import gzip, hashlib, io, json, re, shutil
from pathlib import Path
import numpy as np, pandas as pd, requests

P = Path('.')
A, B, C, D, E, F, G = (P / 'kaggle_runs' / r / 'senguard_msc' for r in ['a_v1', 'b_v3', 'c_v1', 'd_v2', 'e_v3', 'f_v1', 'g_v2'])
OUT = P / 'site/data'
OUT.mkdir(parents=True, exist_ok=True)
INP = P / 'deliverables/demo/input'

for f in ['adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'bone_marrow_msc_tpm.tsv.gz', 'bone_marrow_msc_entrez_ids.tsv.gz', 'bone_marrow_msc_samples.csv']:
    shutil.copy(INP / f, OUT / f)

marker = P / 'senguard_msc/external/wf-ml-markers-senescence/analysis/transcriptomics_loose5000f_tuned_common_features.csv'
(OUT / 'signature.json').write_text(json.dumps({'sha256': hashlib.sha256(marker.read_bytes()).hexdigest(), 'commit': '0e23fcc926f31fc2206631ff9b64a852fb81fe89'}))

# A real labelling problem from public data: GSE125632, MSC arm only
url = 'https://ftp.ncbi.nlm.nih.gov/geo/series/GSE125nnn/GSE125632/suppl/GSE125632_FPKM_iMSC_manuscript.txt.gz'
target = OUT / 'mislabelled_gse125632_fpkm.tsv.gz'
if not target.exists():
    for attempt in range(6):
        r = requests.get(url, headers={'User-Agent': 'SenGuard-MSC-audit/1.0'}, timeout=180)
        if r.status_code == 200 and len(r.content) > 1000:
            break
    t = pd.read_csv(io.BytesIO(gzip.decompress(r.content)), sep='\t', low_memory=False, on_bad_lines='skip', dtype=str)
    t = t[t.EnsemblID.astype(str).str.startswith('ENSG')].drop_duplicates('EnsemblID')
    cols = [f'Sample_{i}' for i in range(1, 11)]
    t = t[['EnsemblID'] + cols]
    t = t[t[cols].apply(pd.to_numeric, errors='coerce').sum(axis=1) > 0]
    with gzip.open(target, 'wt', encoding='utf-8', compresslevel=9) as f:
        t.to_csv(f, sep='\t', index=False)
sheet = pd.DataFrame({'sample_id': [f'Sample_{i}' for i in range(1, 11)], 'donor': [f'Donor {i}' for i in range(1, 6)] * 2, 'passage': [2] * 5 + [11] * 5})
sheet.to_csv(OUT / 'mislabelled_gse125632_samples.csv', index=False)

clock = json.load(open(E / 'results/drift_clock_models.json'))
keep = {k: v for k, v in clock['models'].items() if k in ('final', 'without_GSE309666', 'without_GSE178514')}
(OUT / 'clock.json').write_text(json.dumps({'genes': clock['genes'], 'ensembl_by_symbol': clock['ensembl_by_symbol'], 'models': {k: [float(f'{x:.5g}') for x in v] for k, v in keep.items()}}, separators=(',', ':')))

vp = json.load(open(F / 'results/virtual_passage_model.json'))
top = pd.Series(vp['beta']['final'], index=vp['genes']).sort_values()
(OUT / 'forecast.json').write_text(json.dumps({'genes': vp['genes'], 'ensembl_by_symbol': vp['ensembl_by_symbol'], 'beta': {k: vp['beta'][k] for k in ['final', 'without_GSE309666', 'without_GSE178514']}, 'signature': vp['signature'], 'rising': top.tail(10).index[::-1].tolist(), 'falling': top.head(10).index.tolist()}, separators=(',', ':')))
prim_reg = None
report = (E / 'reports/AMENDMENT1_RESULTS.md').read_text(encoding='utf-8')
blocks = re.findall(r'\{\n "score".*?\n\}', report, flags=re.S)
prim_reg, prim_ok = json.loads(blocks[0]), json.loads(blocks[1])
h2h = pd.read_csv(E / 'results/ext_head_to_head.csv')
gate = json.load(open(E / 'results/ext_clock_gate.json'))
cl = pd.read_csv(E / 'results/ext_clock_loco.csv')
resp = pd.read_csv(E / 'results/ext_gvhd_response.csv').set_index('score')
lab = pd.read_csv(E / 'results/ext_labelled_checks.csv')
lab48 = lab[lab.cohort == 'GSE48662'].set_index('score')
abs_scale = pd.read_csv(E / 'results/ext_absolute_scale.csv')
medium = pd.read_csv(E / 'results/ext_medium_effect.csv')
w = medium.pivot_table(index=['donor', 'p'], columns='medium', values='s')
med_late = float((w['HPL 0/AB'] - w['FBS']).xs(4.5, level='p').mean())
rt = pd.read_csv(E / 'results/ext_test_retest_seq.csv')
sd = float(np.sqrt((rt.difference ** 2).mean() / 2))
mdc = 1.96 * np.sqrt(2) * sd
rob = pd.read_csv(E / 'results/ext_robustness_summary.csv')
depth = rob[rob.test == 'depth'].sort_values(['cohort', 'median_reads'])
gmp = pd.read_csv(E / 'results/ext_gse269586_units.csv')
units = pd.read_csv(E / 'results/ext_primary_units_integrity_passed.csv')
g137 = units[units.cohort == 'GSE137186']
g233 = units[units.cohort == 'GSE233634']
dev = pd.read_csv(A / 'results/dev_model_summary.csv')
bf = json.load(open(C / 'results/bulkformer_status.json'))
trend = pd.read_csv(B / 'results/external_trends_GSE309666.csv').set_index('score').loc['SenCat published']
phase = pd.read_csv(B / 'results/external_phase_changes_GSE309666.csv').set_index('donor')
leak = pd.read_csv(A / 'results/dev_feature_selection_leakage.csv')
conf = pd.read_csv(D / 'results/g5_conformal_sets.csv')
load = pd.read_csv(E / 'results/ext_cohort_load_log.csv')
fc = json.load(open(P / 'deliverables/tables/forecast_backtest.json'))
vg = json.load(open(F / 'results/virtual_passage_gate.json'))
tg = json.load(open(G / 'results/forecast_test_gate.json'))
tby = pd.read_csv(G / 'results/forecast_test_donors.csv').groupby('cohort').agg(donors=('donor', 'size'), err_forecast=('err_forecast', 'median'), err_carry=('err_carry', 'median'), better=('forecast_better', 'sum'))
long_series = pd.read_csv(G / 'results/forecast_test_long_series.csv')

COHORT_INFO = {
    'GSE309666': ('Adipose', 'Reference; used first', 'Passage 1 to 10'),
    'GSE178514': ('Bone marrow', 'Reference; used first; donors inferred', 'P4, P6, P12'),
    'GSE137186': ('Bone marrow', 'New', 'P1 to P15'),
    'GSE275980': ('Not stated in abstract', 'New', 'P2, P6, P10'),
    'GSE194298': ('Bone marrow', 'New; FBS and hPL', 'p1 and p4/5'),
    'GSE119987': ('Umbilical cord', 'New; array; to replicative senescence', 'P1 to P16'),
    'GSE56362': ('Bone marrow', 'New; array; technical triplicates', 'P3, P5, P7'),
    'GSE233634': ('Umbilical cord', 'New; no donor stated, one unit', 'P3 to P12'),
    'GSE125632': ('Bone marrow', 'Failed identity check; excluded from the headline', 'P2 and P11'),
    'GSE269586': ('Wharton\'s jelly', 'GMP production; short expansion; not pooled', 'Master bank to P3'),
    'GSE48662': ('Bone marrow', 'Irradiated vs control; GVHD groups', 'Not a passage series'),
}
by = pd.read_csv(E / 'results/ext_head_to_head_by_cohort.csv')
sc = by[by.score == 'SenCat published, rank form'].set_index('cohort')
reg_units = pd.read_csv(E / 'results/ext_primary_units.csv')
cohort_rows = []
for acc, (tissue, role, design) in COHORT_INFO.items():
    if acc in ('GSE309666', 'GSE178514'):
        res = f"{int(sc.loc[acc].rising)}/{int(sc.loc[acc].n)}"
    elif acc == 'GSE269586':
        res = f"{int((gmp.slope > 0).sum())}/{len(gmp)}"
    elif acc == 'GSE48662':
        res = 'See findings'
    else:
        u = reg_units[reg_units.cohort == acc]
        res = f"{int((u.slope > 0).sum())}/{len(u)}"
    cohort_rows.append({'accession': acc, 'tissue': tissue, 'role': role, 'design': design, 'rising': res})

g = lambda v, n=2: round(float(v), n)
evidence = {
    'headline': {
        'ok': {k: prim_ok[k] for k in ['donors_rising', 'donors', 'share', 'ci_low', 'ci_high', 'binom_p', 'cohorts_positive', 'cohorts']},
        'registered': {k: prim_reg[k] for k in ['donors_rising', 'donors', 'share', 'ci_low', 'ci_high', 'binom_p', 'cohorts_positive', 'cohorts']},
    },
    'clock': {'rising': int((cl.slope > 0).sum()), 'n': len(cl), 'median_rho': g(gate['median_rho']), 'shuffled': g(gate['shuffled_median_rho']), 'genes': gate['shared_genes'], 'passes': gate['passes']},
    'headToHead': [{'label': r.score.replace(', rank form', ''), 'share': r.share, 'low': r.ci_low, 'high': r.ci_high, 'up': int(r.donors_rising), 'n': int(r.donors), 'rho': g(r.median_rho), 'highlight': r.score.startswith('SenCat')} for r in h2h.itertuples()],
    'cohorts': cohort_rows,
    'facts': {
        'devAuroc': g(dev.mean_auroc.max(), 3), 'devLow': g(dev.ci_low.max(), 3), 'devHigh': g(dev.ci_high.max(), 3), 'leak': g(leak.difference.mean(), 4), 'reproSpearman': 0.99997,
        'irradiatedAuroc': g(lab48.loc['SenCat published', 'auroc']), 'irradiatedRefit': g(lab48.loc['SenCat refit, lineage excluded', 'auroc'], 3), 'irradiatedSenMayo': g(lab48.loc['SenMayo', 'auroc'], 3), 'irradiatedYang': g(lab48.loc['Yang 2023 7 genes', 'auroc'], 3),
        'gvhdP': g(resp.loc['SenCat published', 'one_sided_exact_p'], 3), 'gvhdDiff': g(resp.loc['SenCat published', 'G2_minus_G1'], 3),
        'gmpRising': int((gmp.slope > 0).sum()), 'gmpN': len(gmp), 'gmpSlope': g(gmp.slope.mean()),
        'absMin': g(abs_scale.mean_score.min(), 1), 'absMax': g(abs_scale.mean_score.max(), 1), 'absN': len(abs_scale), 'mediumLate': g(med_late, 1),
        'retestA': g(rt.difference.min()), 'retestB': g(rt.difference.max()), 'mdc': g(mdc, 1),
        'depth3m': g(depth[depth.cohort == 'GSE137186'].query('median_reads > 3e6').slope_ratio.iloc[0]), 'depth1m': g(depth[depth.cohort == 'GSE137186'].query('median_reads > 1.2e6').slope_ratio.iloc[0]), 'depth1mB': g(depth[depth.cohort == 'GSE275980'].query('median_reads > 1.1e6').slope_ratio.iloc[0]), 'depth02': g(depth[depth.cohort == 'GSE137186'].query('median_reads > 2.4e5').slope_ratio.iloc[0]), 'depth02B': g(depth[depth.cohort == 'GSE275980'].query('median_reads > 2.3e5').slope_ratio.iloc[0]),
        'g137rising': int((g137.slope > 0).sum()), 'g137n': len(g137), 'g233slope': g(g233.slope.iloc[0]), 'donorE': g(phase.loc['E', 'final'], 1), 'arrestedLow': g(phase.loc[['A', 'B', 'C'], 'final'].min(), 1), 'arrestedHigh': g(phase.loc[['A', 'B', 'C'], 'final'].max(), 1), 'donorD': g(phase.loc['D', 'final'], 1),
        'bfAuroc': g(bf['dev_mean_auroc']['mean'], 3), 'bfLow': g(bf['dev_mean_auroc']['ci'][0], 3), 'bfHigh': g(bf['dev_mean_auroc']['ci'][1], 3), 'bfGb': g(bf['steps']['extraction']['peak_gpu_gb'], 1),
        'confCov': g(conf.covered.mean(), 3),
        'testBeat': int(round(tg['share_better'] * tg['donors'])), 'testN': tg['donors'], 'testP': g(tg['binom_better_p'], 3), 'testErr': g(tg['median_err_forecast'], 3), 'testCarry': g(tg['median_err_carry'], 3), 'testNeg': g(tg['negative_control_share'], 2), 'testRange': g(tg['range80'], 2), 'testRose': tg['actual_rose'],
        'tieErr': g(tby.loc['GSE139073', 'err_forecast'], 3), 'tieCarry': g(tby.loc['GSE139073', 'err_carry'], 3), 'midErrMax': g((long_series.forecast - long_series.actual).abs().max(), 3),
        'vpRmse': g(vg['share_rmse_better'], 2), 'vpCohorts': vg['cohorts_better'], 'vpN': vg['cohorts'], 'vpPersonal': g(vg['personal_share_better'], 2), 'vpPersist': g(vg['rate_persistence_spearman'], 2),
        'forecastBetter': g(fc['share_better'], 3), 'forecastDonors': fc['donors'], 'forecastDirection': fc['direction_right'], 'forecastError': g(fc['median_error_forecast'], 1),
    },
    'forecastCohorts': [{'cohort': k, 'donors': int(r.donors), 'better': int(r.better), 'err_forecast': g(r.err_forecast, 3), 'err_carry': g(r.err_carry, 3)} for k, r in tby.iterrows()],
    'guidance': {'minimumChange': f'In re-sequenced samples the score differed by {g(rt.difference.min())} and {g(rt.difference.max())}, so treat changes under about {g(mdc, 1)} as possibly technical. This rests on two pairs from one cohort.'},
}
(OUT / 'evidence.json').write_text(json.dumps(evidence, indent=1), encoding='utf-8')
print(json.dumps(evidence['headline'], indent=0)); print(evidence['clock']); print(json.dumps(evidence['facts'])); print(evidence['guidance']); print(pd.DataFrame(cohort_rows).to_string(index=False))
print({p.name: p.stat().st_size for p in OUT.iterdir()})
