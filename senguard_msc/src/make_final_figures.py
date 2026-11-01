"""Rebuilds publication figures from saved CSV results; fits nothing. Usage: python make_final_figures.py PROJECT_ROOT"""
import sys
from pathlib import Path
import numpy as np, pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.ticker import MaxNLocator

PROJ = Path(sys.argv[1])
A, B, D = (PROJ / 'kaggle_runs/a_v1/senguard_msc', PROJ / 'kaggle_runs/b_v3/senguard_msc', PROJ / 'kaggle_runs/d_v2/senguard_msc')
OUT = PROJ / 'deliverables/figures'
OUT.mkdir(parents=True, exist_ok=True)
PAL = {'blue': '#2a78d6', 'orange': '#eb6834', 'aqua': '#1baf7a', 'ink': '#0b0b0b', 'ink2': '#52514e', 'muted': '#8a897f', 'grid': '#e6e5df', 'surface': '#fcfcfb'}
plt.rcParams.update({'figure.dpi': 110, 'savefig.dpi': 300, 'figure.facecolor': PAL['surface'], 'axes.facecolor': PAL['surface'], 'savefig.facecolor': PAL['surface'], 'axes.edgecolor': PAL['muted'],
                     'axes.linewidth': 0.8, 'axes.grid': True, 'grid.color': PAL['grid'], 'grid.linewidth': 0.8, 'axes.axisbelow': True, 'axes.spines.top': False, 'axes.spines.right': False,
                     'font.size': 10, 'axes.titlesize': 11, 'axes.titleweight': 'bold', 'axes.titlelocation': 'left', 'axes.labelcolor': PAL['ink2'], 'xtick.color': PAL['ink2'], 'ytick.color': PAL['ink2'],
                     'text.color': PAL['ink'], 'lines.linewidth': 2, 'legend.frameon': False, 'font.family': 'DejaVu Sans'})

# Figure 1: development performance
wide = pd.read_csv(A / 'results/dev_auroc_by_cell_type.csv', index_col=0)
summ = pd.read_csv(A / 'results/dev_model_summary.csv').set_index('model')
simple = pd.read_csv(A / 'results/dev_simple_scores.csv')
names = {'logreg_l1': 'L1 logistic', 'elastic_net': 'Elastic net', 'linear_svm': 'Linear SVM', 'rbf_svm': 'RBF SVM', 'random_forest': 'Random forest', 'xgboost': 'XGBoost'}
order = list(names)
fig, axes = plt.subplots(1, 2, figsize=(11, 4.6), gridspec_kw={'width_ratios': [1.1, 1]})
ax = axes[0]
for yy, m in zip(np.arange(len(order))[::-1], order):
    v = wide[m]
    other = v.drop(['BMMSC', 'prAD', 'BJ'])
    ax.scatter(other, np.full(len(other), yy), s=26, color=PAL['muted'], linewidths=0, zorder=2, label='Other 11 cell types' if yy == len(order) - 1 else None)
    ax.scatter([v['BJ']], [yy], s=50, color=PAL['aqua'], edgecolors=PAL['surface'], linewidths=1.5, zorder=3, label='BJ fibroblasts held out' if yy == len(order) - 1 else None)
    ax.scatter([v['BMMSC']], [yy + 0.2], s=50, color=PAL['blue'], edgecolors=PAL['surface'], linewidths=1.5, zorder=3, label='BMMSC held out' if yy == len(order) - 1 else None)
    ax.scatter([v['prAD']], [yy - 0.2], s=50, color=PAL['orange'], edgecolors=PAL['surface'], linewidths=1.5, zorder=3, label='Preadipocytes held out' if yy == len(order) - 1 else None)
    s = summ.loc[m]
    ax.plot([s.ci_low, s.ci_high], [yy - 0.38, yy - 0.38], color=PAL['ink'], lw=2, solid_capstyle='round')
    ax.scatter([s.mean_auroc], [yy - 0.38], s=30, color=PAL['ink'], zorder=4, label='Mean, 95% CI over cell types' if yy == len(order) - 1 else None)
ax.set_yticks(np.arange(len(order))[::-1], [names[m] for m in order]); ax.set_xlabel('AUROC on the held-out cell type'); ax.set_title('A. Nested leave-one-cell-type-out'); ax.set_ylim(-0.8, len(order) - 0.4); ax.grid(axis='y', visible=False)
ax.legend(loc='center', bbox_to_anchor=(0.46, 0.5), fontsize=8, handletextpad=0.3)
ax = axes[1]
show = simple[~simple.score.str.contains('self-consistency')].copy()
show['score'] = show.score.replace({'p21': 'CDKN1A (p21) transcript', 'p16': 'CDKN2A (p16) transcript', 'IL6': 'IL6 transcript', 'GDF15': 'GDF15 transcript', 'LMNB1 (inverted)': 'LMNB1 transcript (inverted)'})
show = show.sort_values('mean_within_type_auroc')
yy = np.arange(len(show))
ax.hlines(yy, show.ci_low, show.ci_high, color=PAL['blue'], lw=2)
ax.scatter(show.mean_within_type_auroc, yy, s=40, color=PAL['blue'], zorder=3, edgecolors=PAL['surface'], linewidths=1.5)
ax.axvline(0.5, color=PAL['muted'], lw=1, ls=(0, (3, 3)))
ax.set_yticks(yy, show.score, fontsize=8.5); ax.set_xlabel('Mean within-cell-type AUROC, 95% CI'); ax.set_title('B. Fixed scores, nothing fitted on SenCat'); ax.grid(axis='y', visible=False)
fig.tight_layout(); fig.savefig(OUT / 'fig1_development_performance.png'); plt.close(fig)

# Figure 2: within-donor trajectories
p = pd.read_csv(B / 'results/external_predictions.csv')
p = p[p.score_name == 'SenCat published']
fig, axes = plt.subplots(2, 5, figsize=(13, 5.6), gridspec_kw={'hspace': 0.5, 'wspace': 0.12})
def panels(axs, cohort, prefix):
    g = p[p.study_accession == cohort]
    for ax, (d, t) in zip(axs, g.groupby('subject')):
        t = t.sort_values('passage')
        ax.plot(t.passage, t.score, color=PAL['blue'], marker='o', ms=6, mec=PAL['surface'], mew=1.5)
        sl = np.polyfit(t.passage, t.score, 1)[0]
        ax.set_title(f'{prefix} {d}', fontsize=10); ax.text(0.04, 0.9, f'slope {sl:+.2f} per passage', transform=ax.transAxes, fontsize=8.5, color=PAL['ink2'])
        ax.set_xlabel('Passage'); ax.xaxis.set_major_locator(MaxNLocator(integer=True)); ax.grid(axis='x', visible=False)
for ax in axes[0][1:]:
    ax.sharey(axes[0][0]); ax.tick_params(labelleft=False)
panels(axes[0], 'GSE309666', 'AD-MSC donor')
axes[0][0].set_ylabel('SenCat score')
for ax in axes[1][1:3]:
    ax.sharey(axes[1][0]); ax.tick_params(labelleft=False)
panels(axes[1][:3], 'GSE178514', 'BM-MSC id')
axes[1][0].set_ylabel('SenCat score')
for ax in axes[1][3:]:
    ax.axis('off')
axes[1][3].text(0, 0.85, 'Scores are model inference on measured expression.\nPassage is not a senescence label.\nBM-MSC comes from FPKM, so its values are not\ncomparable with AD-MSC. Its ids are inferred donors.', fontsize=9.5, color=PAL['ink2'], va='top')
fig.savefig(OUT / 'fig2_donor_trajectories.png', bbox_inches='tight'); plt.close(fig)

# Figure 3: direction across scores, flagging non-independent cells
m = pd.read_csv(B / 'results/external_rho_heatmap_data.csv', index_col=0)
m = m.rename(index=lambda s: 'Frozen L1 logistic, target lineage excluded' if s.startswith('Frozen') else s)
cmap = LinearSegmentedColormap.from_list('div', [PAL['blue'], PAL['grid'], PAL['orange']])
fig, ax = plt.subplots(figsize=(9.5, 0.36 * len(m) + 1.8))
im = ax.imshow(m.to_numpy(dtype=float), cmap=cmap, vmin=-1, vmax=1, aspect='auto')
ax.set_xticks(range(m.shape[1]), m.columns, rotation=45, ha='right', fontsize=8.5); ax.set_yticks(range(m.shape[0]), m.index, fontsize=8.5); ax.grid(False)
for s in ax.spines.values():
    s.set_visible(False)
ax.set_xticks(np.arange(-.5, m.shape[1]), minor=True); ax.set_yticks(np.arange(-.5, m.shape[0]), minor=True); ax.grid(which='minor', color=PAL['surface'], linewidth=2); ax.tick_params(which='minor', length=0)
circular = [('hUSI raw', [c for c in m.columns if c.startswith('BM')]), ('AD-MSC 40 biomarkers (up minus down)', [c for c in m.columns if c.startswith('AD')])]
flag = {(r, c) for r, cols in circular for c in cols}
for i, r in enumerate(m.index):
    for j, c in enumerate(m.columns):
        v = m.iat[i, j]
        star = '*' if (r, c) in flag else ''
        ax.text(j, i, '' if pd.isna(v) else f'{v:+.1f}{star}', ha='center', va='center', fontsize=7.5, color=PAL['ink'])
cb = fig.colorbar(im, ax=ax, fraction=0.025, pad=0.02); cb.set_label('Spearman rho with passage'); cb.outline.set_visible(False)
ax.set_title('Direction with passage, per donor (3-4 points each, so rho is coarse)')
fig.text(0.01, 0.0, '* Not independent: hUSI was trained on GSE178514, and the 40 biomarkers were derived from GSE309666.', fontsize=8.5, color=PAL['ink2'])
fig.savefig(OUT / 'fig3_direction_by_score.png', bbox_inches='tight'); plt.close(fig)

# Figure 4 needs the null draws, so it comes from the kernel as is
(OUT / 'fig4_competitive_null.png').write_bytes((B / 'figures/fig4_competitive_null.png').read_bytes())

# Figure 5: panel size and feature families
ps = pd.read_csv(D / 'results/g5_panel_summary.csv')
fam = pd.read_csv(D / 'results/g5_ablation_families.csv')
def boot(v, n=5000, seed=42):
    v = np.asarray(v, float)
    r = np.random.default_rng(seed)
    means = v[r.integers(0, len(v), size=(n, len(v)))].mean(axis=1)
    return v.mean(), np.percentile(means, 2.5), np.percentile(means, 97.5)
fig, axes = plt.subplots(1, 2, figsize=(11, 4), gridspec_kw={'width_ratios': [1, 1.15]})
ax = axes[0]
u = ps[ps.method == 'univariate']
for design, color, label, shift in [('LOCO', PAL['blue'], 'Cell type held out', 0.94), ('LOCPO', PAL['orange'], 'Cell type and paradigm held out', 1.06)]:
    g = u[u.design == design].sort_values('k')
    x = g.k * shift
    ax.vlines(x, g.ci_low, g.ci_high, color=color, lw=2)
    ax.plot(x, g.mean_auroc, color=color, marker='o', ms=6, mec=PAL['surface'], mew=1.5, label=label)
ax.set_xscale('log'); ax.set_xticks([10, 20, 30, 100, 500, 2000, 5000], ['10', '20', '30', '100', '500', '2000', '5000']); ax.minorticks_off()
ax.set_xlabel('Genes chosen inside each fold'); ax.set_ylabel('Mean AUROC, 95% CI over cell types'); ax.set_title('A. Panel size'); ax.legend(fontsize=8, loc='lower right'); ax.grid(axis='x', visible=False)
ax = axes[1]
order5 = ['SenMayo (fixed)', 'Hallmark E2F inverted (fixed)', 'Hallmark pathway LR', 'L1 genes (k=2000)', 'L2 genes (k=5000)', 'Late fusion: L2 + pathway + hUSI', 'hUSI raw (fixed)']
s = fam[fam.design == 'LOCPO'].groupby(['candidate', 'cell_type']).auroc.mean().unstack(0)[order5]
for i, c in enumerate(order5):
    mean, lo, hi = boot(s[c])
    ax.plot([lo, hi], [i, i], color=PAL['blue'], lw=2, solid_capstyle='round')
    ax.scatter([mean], [i], s=40, color=PAL['blue'], edgecolors=PAL['surface'], linewidths=1.5, zorder=3)
ax.set_yticks(range(len(order5)), order5, fontsize=8.5); ax.set_xlabel('Mean AUROC, cell type and paradigm held out, 95% CI'); ax.set_title('B. Feature families under the harder test'); ax.grid(axis='y', visible=False)
fig.tight_layout(); fig.savefig(OUT / 'fig5_panels_and_families.png'); plt.close(fig)
print(sorted(x.name for x in OUT.iterdir()))
