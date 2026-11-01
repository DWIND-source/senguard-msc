"""SenGuard-MSC prototype: within-donor senescence-signature report for a passage series of MSC.

Research prototype, not a release test. It checks the input, refuses what it cannot score validly, and reports
within-donor trends. It gives no pass/fail call, because no threshold has been validated.

Usage:
  python senguard_qc.py --expr table.tsv --samples samples.csv --scale counts --out report.html
samples.csv columns: sample_id, donor, passage. Table: first column Ensembl gene id, one column per sample.
"""
import argparse, base64, html, io, json, sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np, pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import senguard as sg

MIN_PASSAGES = 3
MIN_WEIGHT_COVERAGE = 0.90
NULL_DRAWS = 200
DEPTH_WARN, DEPTH_STOP = 3e6, 0.25e6   # from thinning two public cohorts (notebook 06)
Y_GENE, Y_HIGH, Y_LOW = 'ENSG00000129824', 2.5, 1.0   # RPS4Y1; this check caught mislabelled pairing in GSE125632
DISCLAIMER = 'Research prototype. Not a release test. Says nothing about potency, immune function or clinical safety.'


def read_inputs(expr_path, samples_path):
    samples = pd.read_csv(samples_path, dtype={'sample_id': str, 'donor': str})
    sep = ',' if str(expr_path).lower().endswith(('.csv', '.csv.gz')) else '\t'
    table = pd.read_csv(expr_path, sep=sep, low_memory=False)
    table = table.rename(columns={table.columns[0]: 'gene_id'})
    return table, samples


def check_inputs(table, samples, scale, markers):
    """Returns (expr samples x genes or None, refusals, warnings, facts). Each check exists because of a failure seen in real public data."""
    refuse, warn, facts = [], [], {}
    need = {'sample_id', 'donor', 'passage'}
    if not need <= set(samples.columns):
        return None, [f'Sample sheet needs columns {sorted(need)}.'], warn, facts
    absent = [s for s in samples.sample_id if s not in table.columns]
    if absent:
        return None, [f'{len(absent)} samples in the sheet have no column in the table, for example {absent[:3]}.'], warn, facts
    ids = table.gene_id.astype(str)
    ens_share = float(ids.str.match(r'^ENSG\d+').mean())
    facts['ensembl_id_share'] = round(ens_share, 3)
    if ens_share < 0.5:
        refuse.append('Gene ids are not Ensembl. Map them first; ids are never guessed.')
        return None, refuse, warn, facts
    keep = ids.str.match(r'^ENSG\d+').to_numpy()
    expr = table.loc[keep, samples.sample_id].apply(pd.to_numeric, errors='coerce')
    expr.index = ids[keep].str.replace(r'\.\d+$', '', regex=True).to_numpy()
    if expr.index.duplicated().any():
        warn.append(f'{int(expr.index.duplicated().sum())} duplicate gene ids; the first occurrence is kept.')
        expr = expr[~expr.index.duplicated()]
    expr = expr.T
    v = expr.to_numpy(dtype=float)
    if np.isnan(v).mean() > 0.01:
        refuse.append('More than 1% of values are missing or not numeric.')
    if np.nanmin(v) < 0:
        refuse.append('Negative values found: the table looks already transformed. Provide untransformed values.')
    if np.nanmax(v) < 50:
        refuse.append(f'Largest value is {np.nanmax(v):.1f}, which looks log-transformed. The score applies log1p once, so a logged table would be logged twice.')
    sums = np.nansum(v, axis=1)
    nz = v[v > 0]
    int_share = float(np.mean(np.isclose(nz, np.round(nz), atol=1e-6))) if nz.size else 0.0
    facts.update(samples=len(expr), genes=expr.shape[1], median_column_sum=float(np.median(sums)), integer_share_nonzero=round(int_share, 3))
    if scale == 'counts' and abs(np.median(sums) - 1e6) / 1e6 < 0.05:
        refuse.append('Declared counts, but column sums are about 1e6, as in TPM. Declare the right scale.')
    if scale == 'tpm' and not 0.5e6 < np.median(sums) < 1.1e6:
        refuse.append(f'Declared TPM, but the median column sum is {np.median(sums):,.0f}.')
    if scale == 'fpkm':
        warn.append('FPKM input is rescaled to TPM. Trends within a donor can be read; absolute values are not comparable with count-based cohorts.')
    if scale == 'counts' and int_share < 0.999:
        warn.append(f'Only {int_share:.0%} of non-zero counts are integers, as expected for estimated counts such as Salmon. Confirm this is not FPKM or TPM.')
    present = markers.index.isin(expr.columns)
    cover = float(markers.coef.abs()[present].sum() / markers.coef.abs().sum())
    facts['signature_weight_coverage'] = round(cover, 4)
    if cover < MIN_WEIGHT_COVERAGE:
        refuse.append(f'Signature coverage is {cover:.1%} of total weight, under the {MIN_WEIGHT_COVERAGE:.0%} minimum.')
    if scale == 'counts':
        low = float(np.nanmin(sums))
        if low < DEPTH_STOP:
            refuse.append(f'The shallowest sample has {low:,.0f} counts. Below {DEPTH_STOP:,.0f}, thinning tests lost most of the trend.')
        elif low < DEPTH_WARN:
            warn.append(f'The shallowest sample has {low:,.0f} counts. Thinning tests lost over 10% of the slope below {DEPTH_WARN:,.0f}.')
    if Y_GENE in expr.columns:
        y = np.log1p(expr[Y_GENE]).groupby(samples.set_index('sample_id').donor.reindex(expr.index))
        bad = [str(d) for d, g in y if g.max() > Y_HIGH and g.min() < Y_LOW]
        if bad:
            refuse.append(f"These donor labels mix Y-positive and Y-negative samples: {', '.join(bad)}. One person can't show both, so check the sample labels.")
    else:
        warn.append('RPS4Y1 is not in the table, so donor identity could not be checked.')
    counts = samples.groupby('donor').passage.nunique()
    facts['passages_per_donor'] = {str(k): int(x) for k, x in counts.items()}
    short = counts[counts < MIN_PASSAGES]
    if len(short) == len(counts):
        refuse.append(f'No donor has at least {MIN_PASSAGES} distinct passages, so no within-donor trend can be estimated.')
    elif len(short):
        warn.append(f'Not assessed, under {MIN_PASSAGES} passages: donors {list(short.index)}.')
    if samples.groupby('donor').apply(lambda g: g.passage.duplicated().any(), include_groups=False).any():
        warn.append('Some donors have repeated passages; they are kept as separate points.')
    return expr, refuse, warn, facts


def normalize(expr, scale):
    if scale == 'counts':
        filtered = sg.author_gene_filter(expr)
        return sg.mor_normalize(filtered)[0]
    if scale == 'fpkm':
        return sg.tpm_from_fpkm(expr)
    return expr


def reference_slopes():
    path = sg.ROOT.parent / 'deliverables/tables/external_predictions.csv'
    if not path.exists():
        return None
    p = pd.read_csv(path)
    p = p[(p.score_name == 'SenCat published') & (p.study_accession == sg.ASC)]
    return sg.per_donor_trend(p.score, p.passage, p.subject).slope_per_passage


def plot_b64(score, samples, eligible):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    sg.set_fig_style()
    n = len(eligible)
    fig, axes = plt.subplots(1, n, figsize=(max(3.2 * n, 4), 2.9), sharey=True, squeeze=False)
    for ax, d in zip(axes[0], eligible):
        g = samples[samples.donor == d].sort_values('passage')
        ax.plot(g.passage, score[g.sample_id], color=sg.PAL['blue'], marker='o', ms=6, mec=sg.PAL['surface'], mew=1.5)
        ax.set_title(f'Donor {d}', fontsize=10); ax.set_xlabel('Passage'); ax.grid(axis='x', visible=False)
    axes[0][0].set_ylabel('SenCat score')
    fig.tight_layout()
    buf = io.BytesIO(); fig.savefig(buf, format='png', dpi=150); plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def run(table, samples, scale, n_null=NULL_DRAWS):
    markers = sg.load_sencat_markers()
    expr, refuse, warn, facts = check_inputs(table, samples, scale, markers)
    out = {'status': 'REFUSED' if refuse else 'REPORT', 'refusals': refuse, 'warnings': warn, 'facts': facts, 'scale': scale, 'run_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
           'signature_sha256': sg.sha256(sg.EXT / 'wf-ml-markers-senescence/analysis/transcriptomics_loose5000f_tuned_common_features.csv')}
    if refuse:
        return out
    samples = samples.copy()
    samples['passage'] = samples.passage.astype(float)
    norm = normalize(expr, scale)
    score, used = sg.weighted_log1p_score(norm, markers.coef)
    counts = samples.groupby('donor').passage.nunique()
    eligible = sorted(counts[counts >= MIN_PASSAGES].index)
    sub = samples[samples.donor.isin(eligible)].set_index('sample_id')
    trend = sg.per_donor_trend(score[sub.index], sub.passage, sub.donor)
    logx = np.log1p(norm.loc[sub.index])
    universe = logx.columns[logx.mean() > 1]
    obs, null, p = sg.competitive_null(logx, markers.coef, sub.passage, sub.donor, n=n_null, mode='genes', universe=universe)
    out.update(markers_used=used, trend=trend.round(4).to_dict('records'), scores={k: round(float(v), 4) for k, v in score.items()}, eligible=eligible,
               mean_slope=float(trend.slope_per_passage.mean()), donors_rising=int((trend.slope_per_passage > 0).sum()), donors=len(trend),
               random_signature={'draws': n_null, 'null_mean': float(null.mean()), 'null_sd': float(null.std()), 'z': float((obs - null.mean()) / null.std()), 'empirical_p': p})
    if scale == 'counts':
        ref = reference_slopes()
        if ref is not None:
            out['reference'] = {'cohort': 'GSE309666, 5 AD-MSC donors', 'slope_min': float(ref.min()), 'slope_max': float(ref.max())}
    out['_score'], out['_samples'] = score, samples
    return out


def render(res, name):
    e = html.escape
    li = lambda xs: ''.join(f'<li>{e(x)}</li>' for x in xs)
    css = (':root{--bg:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--line:#e6e5df;--accent:#2a78d6;--stop:#b3261e}'
           'body{background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,Segoe UI,sans-serif;max-width:900px;margin:0 auto;padding:28px 18px}'
           'h1{font-size:22px;margin:0}h2{font-size:15px;margin:26px 0 6px}.sub{color:var(--ink2);margin:4px 0 16px}'
           '.banner{border-left:4px solid var(--accent);padding:10px 14px;background:#f1f5fb}.stop{border-color:var(--stop);background:#fbf1f0}'
           'table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}td,th{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left}'
           'img{max-width:100%}.tag{color:var(--ink2);font-size:13px}')
    head = f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SenGuard-MSC report: {e(name)}</title><style>{css}</style></head><body>'
    top = f'<h1>SenGuard-MSC report</h1><p class="sub">{e(name)} · declared scale: {e(res["scale"])} · {e(res["run_utc"])}</p>'
    foot = f'<h2>Input facts</h2><p class="tag">{e(json.dumps(res["facts"]))}</p><p class="tag">Signature SHA256: {e(res["signature_sha256"])}</p><p class="tag">{e(DISCLAIMER)}</p></body></html>'
    if res['status'] == 'REFUSED':
        return head + top + f'<div class="banner stop"><b>Not scored.</b> The input cannot be scored validly:<ul>{li(res["refusals"])}</ul></div>' + foot
    rows = ''.join(f'<tr><td>{e(str(r["donor"]))}</td><td>{r["first_passage"]} to {r["last_passage"]}</td><td>{r["n_points"]}</td><td>{r["slope_per_passage"]:+.2f}</td><td>{r["last_minus_first"]:+.2f}</td><td>{"-" if pd.isna(r["spearman_rho"]) else format(r["spearman_rho"], "+.2f")}</td></tr>' for r in res['trend'])
    rs = res['random_signature']
    ref = f'<p>Published reference: slopes in {e(res["reference"]["cohort"])} ranged {res["reference"]["slope_min"]:+.2f} to {res["reference"]["slope_max"]:+.2f} per passage. This is context, not an acceptance range.</p>' if 'reference' in res else '<p class="tag">No reference range is shown, because this scale is not comparable with the count-based reference cohort.</p>'
    warn = f'<h2>Warnings</h2><ul>{li(res["warnings"])}</ul>' if res['warnings'] else ''
    plot = plot_b64(res['_score'], res['_samples'], res['eligible'])
    body = (f'<div class="banner"><b>Score rose in {res["donors_rising"]} of {res["donors"]} donors</b>, mean slope {res["mean_slope"]:+.2f} per passage. No pass or fail call is made, because no threshold has been validated.</div>'
            f'{warn}<h2>Within-donor trajectories <span class="tag">model inference on measured expression</span></h2><img alt="SenCat score by passage for each donor" src="data:image/png;base64,{plot}">'
            f'<table><tr><th>Donor</th><th>Passages</th><th>Points</th><th>Slope per passage</th><th>Last minus first</th><th>Spearman rho</th></tr>{rows}</table>{ref}'
            f'<h2>Could a random signature do this?</h2><p>{rs["draws"]} random gene sets gave a mean slope of {rs["null_mean"]:+.3f} (SD {rs["null_sd"]:.3f}), so this signature sits at z = {rs["z"]:.1f}, empirical p = {rs["empirical_p"]:.3f}. That p is limited by the number of draws.</p>'
            f'<h2>How to read this</h2><ul><li>Passage and donor come from your sheet. Scores are inference.</li><li>A rising score doesn\'t mean a lot has failed, and a flat one doesn\'t mean it is safe.</li><li>In validation, one donor scored high without growth arrest, so the score may partly track time in culture.</li><li>Markers used: {res["markers_used"]}.</li></ul>')
    return head + top + body + foot


def main():
    ap = argparse.ArgumentParser(description='SenGuard-MSC within-donor report (research prototype).')
    ap.add_argument('--expr', required=True); ap.add_argument('--samples', required=True)
    ap.add_argument('--scale', required=True, choices=['counts', 'tpm', 'fpkm'])
    ap.add_argument('--out', required=True); ap.add_argument('--name', default=None)
    a = ap.parse_args()
    table, samples = read_inputs(a.expr, a.samples)
    res = run(table, samples, a.scale)
    Path(a.out).write_text(render(res, a.name or Path(a.expr).name), encoding='utf-8')
    print(res['status'], '->', a.out)
    for r in res['refusals']:
        print('  refused:', r)
    return 0 if res['status'] == 'REPORT' else 2


if __name__ == '__main__':
    sys.exit(main())
