"""Shared code for SenGuard-MSC notebooks 01-05.

Conventions: expression frames are samples x genes. Fold-dependent fitting always happens on training
samples only. Nothing here reads the external MSC cohorts unless a caller passes them in.
"""
import hashlib
import json
import os
import re
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from joblib import Parallel, delayed
from scipy import stats
from sklearn.base import BaseEstimator, TransformerMixin, clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, balanced_accuracy_score, brier_score_loss, f1_score, roc_auc_score
from sklearn.model_selection import GridSearchCV, LeaveOneGroupOut
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC, LinearSVC

SEED = 42
DEV = 'GSE284666'
ASC = 'GSE309666'
BM = 'GSE178514'


def project_root():
    if os.environ.get('SENGUARD_ROOT'):
        return Path(os.environ['SENGUARD_ROOT'])
    if Path('/kaggle/working/senguard_msc').is_dir():
        return Path('/kaggle/working/senguard_msc')
    cwd = Path.cwd()
    return (cwd.parent if cwd.name == 'notebooks' else cwd) / 'senguard_msc'


ROOT = project_root()
PROC, RESULTS, FIGS, REPORTS, MANIFESTS, EXT, CKPT = (ROOT / 'data/processed', ROOT / 'results', ROOT / 'figures', ROOT / 'reports',
                                                      ROOT / 'manifests', ROOT / 'external', ROOT / 'checkpoints')


def require(*paths):
    missing = [str(p) for p in paths if not Path(p).exists()]
    if missing:
        raise FileNotFoundError('Required input missing; run the earlier notebook first:\n  ' + '\n  '.join(missing))


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def output_manifest(paths):
    rows = [{'path': str(p), 'bytes': Path(p).stat().st_size, 'sha256': sha256(p)} for p in paths]
    return pd.DataFrame(rows)


# ------------------------------------------------------------------------------------------- loading
def load_as_deposited(acc):
    """Returns (expr samples x genes indexed by gene_id, annotation frame indexed by gene_id). No transformation."""
    path = PROC / f'{acc}_matrix_as_deposited.tsv.gz'
    require(path)
    df = pd.read_csv(path, sep='\t', dtype={'gene_id': str, 'entrez': str}, low_memory=False)
    ann_cols = [c for c in df.columns if not c.startswith('GSM')]
    ann = df[ann_cols].set_index('gene_id', drop=False)
    expr = df.set_index('gene_id')[[c for c in df.columns if c.startswith('GSM')]].T
    return expr.astype(float), ann


def load_manifest():
    path = MANIFESTS / 'sample_manifest.csv'
    require(path)
    return pd.read_csv(path, low_memory=False).set_index('sample_id')


def dev_labels(manifest=None):
    """SenCat labels follow the authors' assemble_anndata.py: P and EV are controls, every other treatment is senescence-induced."""
    m = load_manifest() if manifest is None else manifest
    s = m[m.study_accession == DEV].copy()
    s['y'] = s.label_candidate.str.startswith('senescence_induced').astype(int)
    if s.label_candidate.eq('unclassified').any():
        raise ValueError('Unclassified SenCat treatment present')
    return s


def strip_version(ids):
    return pd.Index(ids).str.replace(r'\.\d+$', '', regex=True)


# ------------------------------------------------------------------------------------------- normalization
def mor_reference(counts):
    """DESeq2 median-of-ratios reference: log geometric mean over genes non-zero in every reference sample."""
    with np.errstate(divide='ignore'):
        logs = np.log(counts.to_numpy(dtype=float))
    means = pd.Series(logs.mean(axis=0), index=counts.columns)
    return means[np.isfinite(means)]


def mor_size_factors(counts, reference):
    """Each sample's median log ratio to the reference. Zero counts in a new sample are excluded from its median."""
    shared = counts.columns.intersection(reference.index)
    x = counts[shared].to_numpy(dtype=float)
    with np.errstate(divide='ignore'):
        logs = np.log(x)
    ratios = logs - reference[shared].to_numpy()
    ratios[~np.isfinite(ratios)] = np.nan
    return pd.Series(np.exp(np.nanmedian(ratios, axis=1)), index=counts.index)


def author_gene_filter(counts):
    """Filter in normalize_counts.py: non-zero in more than 5% of samples and total count above 380."""
    x = counts.to_numpy(dtype=float)
    keep = ((x != 0).sum(axis=0) > 0.05 * x.shape[0]) & (x.sum(axis=0) > 380)
    return counts.loc[:, keep]


def mor_normalize(counts, reference=None):
    ref = mor_reference(counts) if reference is None else reference
    sf = mor_size_factors(counts, ref)
    return counts.div(sf, axis=0), sf, ref


def tpm_from_fpkm(fpkm):
    """Exact FPKM to TPM rescaling within the table. The denominator is whatever genes the table holds."""
    return fpkm.div(fpkm.sum(axis=1), axis=0) * 1e6


def scale_to_million(x):
    return x.div(x.sum(axis=1), axis=0) * 1e6


# ------------------------------------------------------------------------------------------- scores
def load_sencat_markers():
    path = EXT / 'wf-ml-markers-senescence/analysis/transcriptomics_loose5000f_tuned_common_features.csv'
    require(path)
    return pd.read_csv(path).set_index('converted_alias')


def load_husi_weights():
    path = EXT / 'HUSI/sc/SenOCLR_features.csv'
    require(path)
    return pd.read_csv(path).drop_duplicates('Gene').set_index('Gene')


def weighted_log1p_score(norm, coef):
    """marker_classifier.py: log1p once, then X @ coef with no intercept; absent markers are skipped."""
    shared = [g for g in coef.index if g in norm.columns]
    return pd.Series(np.log1p(norm[shared].to_numpy(dtype=float)) @ coef.loc[shared].to_numpy(dtype=float), index=norm.index), len(shared)


def husi_raw(expr_by_symbol, weights):
    """hUSI before the authors' per-cohort min-max step: per-sample Spearman with the OCLR weight vector."""
    shared = [g for g in weights.index if g in expr_by_symbol.columns]
    w = stats.rankdata(weights.loc[shared, 'Weight'].to_numpy())
    x = expr_by_symbol[shared].to_numpy(dtype=float)
    ranks = np.apply_along_axis(stats.rankdata, 1, x)
    w_c, r_c = w - w.mean(), ranks - ranks.mean(axis=1, keepdims=True)
    r = (r_c @ w_c) / (np.linalg.norm(r_c, axis=1) * np.linalg.norm(w_c))
    return pd.Series(r, index=expr_by_symbol.index), len(shared)


def minmax(s):
    return (s - s.min()) / (s.max() - s.min())


def read_gmt(path, names=None):
    out = {}
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            parts = line.rstrip('\n').split('\t')
            if len(parts) > 2 and (names is None or parts[0] in names):
                out[parts[0]] = sorted({g for g in parts[2:] if g})
    return out


def load_gene_sets():
    h = read_gmt(EXT / 'HUSI/Data/h.all.v2023.1.Hs.symbols.gmt')
    extra = read_gmt(EXT / 'HUSI/Data/gene_50signatures_merge.gmt', {'SenMayo', 'CellAge', 'SASP'})
    return h, extra


def rank_set_score(expr_by_symbol, genes):
    """Rank-based single-sample score, scaled to 0-1. Depends on one sample only, so no reference is fitted."""
    shared = [g for g in genes if g in expr_by_symbol.columns]
    if not shared:
        return pd.Series(np.nan, index=expr_by_symbol.index), 0
    ranks = expr_by_symbol.rank(axis=1, pct=True)
    return ranks[shared].mean(axis=1), len(shared)


def to_symbols(expr, ann, sym_col='symbol'):
    """Collapses to symbols by keeping the highest-mean gene per symbol (recorded choice, annotation only)."""
    sym = ann[sym_col].reindex(expr.columns)
    keep = sym.notna() & (sym.astype(str) != 'nan')
    x = expr.loc[:, keep]
    order = x.mean(axis=0).sort_values(ascending=False).index
    s = sym.loc[order]
    first = order[~s.duplicated().to_numpy()]
    out = x[first].copy()
    out.columns = sym.loc[first].to_numpy()
    return out


# ------------------------------------------------------------------------------------------- author pipeline
def author_feature_prefilter(norm, allowed_missing_samples=40, quantile=0.7):
    x = norm.to_numpy(dtype=float)
    keep = (x != 0).sum(axis=0) >= x.shape[0] - min(x.shape[0], allowed_missing_samples)
    kept = norm.loc[:, keep]
    totals = kept.sum(axis=0)
    return kept.loc[:, totals > totals.quantile(quantile)]


def _author_fit_loco(xlog, y, groups, cols):
    coefs = {}
    for g in np.unique(groups):
        tr = groups != g
        m = LogisticRegression(solver='liblinear').fit(xlog[cols].to_numpy()[tr], y[tr])
        coefs[g] = m.coef_[0]
    return coefs


def author_pipeline(norm, y, groups, k=5000, allowed_missing_samples=40, quantile=0.7):
    """ml_classifier.py at config 'loose5000f': selection on all samples given, then mean coefficient over leave-one-group-out fits."""
    y, groups = np.asarray(y), np.asarray(groups)
    pre = author_feature_prefilter(norm, allowed_missing_samples, quantile)
    xlog = np.log1p(pre)
    k = min(k, xlog.shape[1])
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        sel = SelectKBest(f_classif, k=k).fit(xlog.to_numpy(), y)
    cols = xlog.columns[sel.get_support(indices=True)]
    coefs = _author_fit_loco(xlog, y, groups, cols)
    return pd.Series(np.mean(list(coefs.values()), axis=0), index=cols, name='coef'), coefs


# ------------------------------------------------------------------------------------------- models
class ToArrayVariance(BaseEstimator, TransformerMixin):
    """Drops zero-variance columns so f_classif stays defined inside a fold."""

    def fit(self, X, y=None):
        self.keep_ = np.asarray(X).std(axis=0) > 0
        return self

    def transform(self, X):
        return np.asarray(X)[:, self.keep_]


def model_grid(xgb_device='cpu'):
    from xgboost import XGBClassifier
    base = lambda clf, scale=True: Pipeline([('var', ToArrayVariance()), ('sel', SelectKBest(f_classif)), ('scale', StandardScaler() if scale else 'passthrough'), ('clf', clf)])
    return {
        'logreg_l1': (base(LogisticRegression(solver='liblinear', penalty='l1', max_iter=2000, random_state=SEED)),
                      {'sel__k': [500, 2000], 'clf__C': [0.01, 0.1, 1.0]}),
        'elastic_net': (base(LogisticRegression(solver='saga', penalty='elasticnet', max_iter=3000, random_state=SEED)),
                        {'sel__k': [2000], 'clf__C': [0.01, 0.1], 'clf__l1_ratio': [0.2, 0.8]}),
        'linear_svm': (base(LinearSVC(max_iter=20000, random_state=SEED)), {'sel__k': [500, 2000], 'clf__C': [0.0001, 0.001, 0.01]}),
        'rbf_svm': (base(SVC(kernel='rbf', gamma='scale', random_state=SEED)), {'sel__k': [500, 2000], 'clf__C': [1.0, 10.0]}),
        'random_forest': (base(RandomForestClassifier(n_estimators=500, max_features='sqrt', n_jobs=1, random_state=SEED), scale=False),
                          {'sel__k': [2000], 'clf__min_samples_leaf': [1, 3]}),
        'xgboost': (base(XGBClassifier(n_estimators=200, learning_rate=0.05, subsample=0.8, colsample_bytree=0.5, tree_method='hist', device=xgb_device,
                                       n_jobs=1, random_state=SEED, eval_metric='logloss'), scale=False),
                    {'sel__k': [2000], 'clf__max_depth': [2, 3]}),
    }


def decision_values(model, X):
    if hasattr(model, 'decision_function'):
        return model.decision_function(X)
    return model.predict_proba(X)[:, 1]


def within_group_auc(estimator, X, y):
    return roc_auc_score(y, decision_values(estimator, X))


def best_threshold(y, score):
    """Threshold maximizing balanced accuracy; ties resolve to the lowest passing value's midpoint."""
    order = np.sort(np.unique(score))
    if len(order) == 1:
        return float(order[0])
    mids = (order[:-1] + order[1:]) / 2
    ba = [balanced_accuracy_score(y, (score >= t).astype(int)) for t in mids]
    return float(mids[int(np.argmax(ba))])


def prefilter_train(counts_train):
    """Fold-local author filters and reference. Returns kept genes plus the reference fitted on the training fold."""
    filtered = author_gene_filter(counts_train)
    norm, _, ref = mor_normalize(filtered)
    pre = author_feature_prefilter(norm)
    return list(pre.columns), ref


def fold_transform(counts, genes, ref):
    sf = mor_size_factors(counts[list(ref.index)], ref)
    return np.log1p(counts[genes].div(sf, axis=0))


def run_outer_fold(name, pipe, grid, counts, y, groups, held):
    """One leave-one-cell-type-out fold: normalization, filters, selection, tuning and threshold are all fit on the training cell types."""
    tr = groups != held
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        genes, ref = prefilter_train(counts.loc[tr])
        Xtr, Xte = fold_transform(counts.loc[tr], genes, ref), fold_transform(counts.loc[~tr], genes, ref)
        logo = list(LeaveOneGroupOut().split(Xtr, y[tr], groups[tr]))
        gs = GridSearchCV(clone(pipe), grid, cv=logo, scoring=within_group_auc, n_jobs=1, refit=True, error_score='raise')
        gs.fit(Xtr.to_numpy(), y[tr])
        oof = np.full(tr.sum(), np.nan)
        for a, b in logo:
            oof[b] = decision_values(clone(gs.best_estimator_).fit(Xtr.to_numpy()[a], y[tr][a]), Xtr.to_numpy()[b])
        thr = best_threshold(y[tr], oof)
        score = decision_values(gs.best_estimator_, Xte.to_numpy())
    return {'model': name, 'held_out': held, 'sample_id': counts.index[~tr].tolist(), 'y': y[~tr].tolist(), 'score': score.tolist(), 'threshold': thr,
            'oof_y': y[tr].tolist(), 'oof_score': oof.tolist(), 'best_params': {k: (v.item() if hasattr(v, 'item') else v) for k, v in gs.best_params_.items()},
            'inner_auc': float(gs.best_score_), 'n_genes_prefilter': len(genes)}


def run_nested_loco(counts, y, groups, grid, n_jobs=-1):
    jobs = [(name, pipe, g, held) for name, (pipe, g) in grid.items() for held in np.unique(groups)]
    return Parallel(n_jobs=n_jobs, verbose=0)(delayed(run_outer_fold)(n, p, g, counts, y, groups, h) for n, p, g, h in jobs)


# ------------------------------------------------------------------------------------------- metrics
def fold_metrics(y, score, thr=None):
    y, score = np.asarray(y), np.asarray(score)
    out = {'n': len(y), 'n_pos': int(y.sum()), 'auroc': roc_auc_score(y, score), 'auprc': average_precision_score(y, score)}
    if thr is not None:
        pred = (score >= thr).astype(int)
        out.update(balanced_acc=balanced_accuracy_score(y, pred), macro_f1=f1_score(y, pred, average='macro', zero_division=0))
    return out


def bootstrap_mean_ci(values, n_boot=5000, seed=SEED):
    """Percentile CI over cell types, the only independent-ish unit in the development set."""
    v = np.asarray(values, dtype=float)
    rng = np.random.default_rng(seed)
    means = v[rng.integers(0, len(v), size=(n_boot, len(v)))].mean(axis=1)
    return float(v.mean()), float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def score_by_group_auc(score, y, groups):
    rows = []
    for g in np.unique(groups):
        i = groups == g
        rows.append({'group': g, **fold_metrics(y[i], score[i])})
    return pd.DataFrame(rows)


# ------------------------------------------------------------------------------------------- external trajectories
def slope_per_passage(passage, score):
    return float(np.polyfit(np.asarray(passage, float), np.asarray(score, float), 1)[0])


def per_donor_trend(score, passage, donor):
    """Per-donor slope per passage, Spearman, last minus first. Requires at least 3 passages for Spearman."""
    df = pd.DataFrame({'score': score, 'passage': passage, 'donor': donor}).dropna()
    rows = []
    for d, g in df.groupby('donor'):
        g = g.sort_values('passage')
        rho = stats.spearmanr(g.passage, g.score).statistic if len(g) >= 3 else np.nan
        rows.append({'donor': d, 'n_points': len(g), 'first_passage': int(g.passage.iloc[0]), 'last_passage': int(g.passage.iloc[-1]),
                     'slope_per_passage': slope_per_passage(g.passage, g.score), 'spearman_rho': rho, 'last_minus_first': g.score.iloc[-1] - g.score.iloc[0]})
    return pd.DataFrame(rows)


def exact_sign_flip_p(values):
    """Two-sided exact sign-flip test on the mean. With n donors the smallest reachable p is 2 / 2**n."""
    v = np.asarray(values, float)
    obs = abs(v.mean())
    grid = np.array(np.meshgrid(*[[-1, 1]] * len(v))).reshape(len(v), -1).T
    return float(np.mean(np.abs((grid * v).mean(axis=1)) >= obs - 1e-12))


def competitive_null(norm_log, coef, passage, donor, n=1000, seed=SEED, mode='weights', universe=None):
    """Mean per-donor slope for random signatures. 'weights' shuffles weights among the same genes; 'genes' draws random expressed genes."""
    rng = np.random.default_rng(seed)
    shared = [g for g in coef.index if g in norm_log.columns]
    w = coef.loc[shared].to_numpy(dtype=float)
    donors = np.asarray(donor)
    p = np.asarray(passage, float)
    groups = [np.flatnonzero(donors == d) for d in np.unique(donors)]
    def mean_slope(mat, weights):
        s = mat @ weights
        return np.mean([np.polyfit(p[i], s[i], 1)[0] for i in groups])
    x = norm_log[shared].to_numpy(dtype=float)
    obs = mean_slope(x, w)
    null = np.zeros(n)
    if mode == 'weights':
        for i in range(n):
            null[i] = mean_slope(x, rng.permutation(w))
    else:
        pool = list(norm_log.columns if universe is None else universe)
        xp = norm_log[pool].to_numpy(dtype=float)
        for i in range(n):
            null[i] = mean_slope(xp[:, rng.choice(len(pool), len(shared), replace=False)], rng.permutation(w))
    return float(obs), null, float((1 + np.sum(np.abs(null) >= abs(obs))) / (1 + n))


# ------------------------------------------------------------------------------------------- figures
PAL = {'blue': '#2a78d6', 'orange': '#eb6834', 'aqua': '#1baf7a', 'ink': '#0b0b0b', 'ink2': '#52514e', 'muted': '#8a897f', 'grid': '#e6e5df', 'surface': '#fcfcfb'}


def set_fig_style():
    import matplotlib as mpl
    mpl.rcParams.update({'figure.dpi': 110, 'savefig.dpi': 300, 'figure.facecolor': PAL['surface'], 'axes.facecolor': PAL['surface'], 'savefig.facecolor': PAL['surface'],
                         'axes.edgecolor': PAL['muted'], 'axes.linewidth': 0.8, 'axes.grid': True, 'grid.color': PAL['grid'], 'grid.linewidth': 0.8, 'axes.axisbelow': True,
                         'axes.spines.top': False, 'axes.spines.right': False, 'font.size': 10, 'axes.titlesize': 11, 'axes.titleweight': 'bold', 'axes.titlelocation': 'left',
                         'axes.labelcolor': PAL['ink2'], 'xtick.color': PAL['ink2'], 'ytick.color': PAL['ink2'], 'text.color': PAL['ink'], 'lines.linewidth': 2,
                         'legend.frameon': False, 'font.family': 'DejaVu Sans'})
