// SenGuard-MSC analysis core. Pure functions with no DOM, shared by the browser app and the Node tests.
// Mirrors senguard_msc/src/senguard_qc.py. test/compare_python.mjs checks that both give the same numbers.

export const LIMITS = { minPassages: 3, minWeightCoverage: 0.9, nullDraws: 200, depthWarn: 3e6, depthStop: 0.25e6, yHigh: 2.5, yLow: 1.0 };
const Y_GENE = 'ENSG00000129824'; // RPS4Y1

export function parseDelimited(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (!lines.length) throw new Error('The file is empty.');
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const clean = (s) => s.replace(/^"|"$/g, '').trim();
  const header = lines[0].split(sep).map(clean);
  const rows = lines.slice(1).map((l) => l.split(sep));
  return { header, rows, sep, clean };
}

export function parseSampleSheet(text) {
  const { header, rows, clean } = parseDelimited(text);
  const lower = header.map((h) => h.toLowerCase());
  const idx = { sample: lower.indexOf('sample_id'), donor: lower.indexOf('donor'), passage: lower.indexOf('passage') };
  if (idx.sample < 0 || idx.donor < 0 || idx.passage < 0) return { error: 'Sample sheet needs columns sample_id, donor, passage.' };
  return { samples: rows.map((r) => ({ id: clean(r[idx.sample]), donor: clean(r[idx.donor]), passage: Number(clean(r[idx.passage])) })) };
}

export function parseTable(text, samples) {
  const { header, rows, clean } = parseDelimited(text);
  const absent = samples.filter((s) => !header.includes(s.id)).map((s) => s.id);
  if (absent.length) return { refuse: `${absent.length} samples in the sheet have no column in the table, for example ${absent.slice(0, 3).join(', ')}.` };
  const cols = samples.map((s) => header.indexOf(s.id));
  const genes = [];
  const seen = new Set();
  const values = samples.map(() => []);
  let ens = 0, nonNumeric = 0, total = 0, dup = 0;
  for (const r of rows) {
    const raw = clean(r[0] ?? '');
    if (!/^ENSG\d+/.test(raw)) continue;
    ens++;
    const id = raw.replace(/\.\d+$/, '');
    if (seen.has(id)) { dup++; continue; }
    seen.add(id);
    genes.push(id);
    cols.forEach((c, j) => {
      const v = Number(r[c]);
      total++;
      if (r[c] === undefined || r[c] === '' || !Number.isFinite(v)) { nonNumeric++; values[j].push(NaN); } else values[j].push(v);
    });
  }
  return { genes, values: values.map((v) => Float64Array.from(v)), ensShare: rows.length ? ens / rows.length : 0, nonNumericShare: total ? nonNumeric / total : 1, duplicates: dup, rowCount: rows.length };
}

export function median(arr) {
  const a = Array.from(arr).filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return NaN;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function checkInputs(table, samples, scale, markers) {
  const checks = [];
  const add = (id, status, label, detail) => checks.push({ id, status, label, detail });
  if (table.refuse) { add('samples', 'stop', 'Samples match the table', table.refuse); return { checks, refused: true }; }
  add('samples', 'ok', 'Samples match the table', `${samples.length} samples found.`);
  if (table.ensShare < 0.5) {
    add('ids', 'stop', 'Gene identifiers', 'Gene ids are not Ensembl. Map them first; ids are never guessed.');
    return { checks, refused: true, facts: { ensemblShare: table.ensShare } };
  }
  add('ids', 'ok', 'Gene identifiers', `${(100 * table.ensShare).toFixed(0)}% Ensembl; ${table.genes.length.toLocaleString('en-US')} genes.`);
  if (table.duplicates) add('dups', 'warn', 'Duplicate genes', `${table.duplicates} duplicate gene ids; the first occurrence is kept.`);
  if (table.nonNumericShare > 0.01) add('numeric', 'stop', 'Numeric values', 'More than 1% of values are missing or not numeric.');
  let min = Infinity, max = -Infinity, nz = 0, ints = 0;
  const sums = table.values.map((col) => {
    let s = 0;
    for (const v of col) {
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
      s += v;
      if (v > 0) { nz++; if (Math.abs(v - Math.round(v)) <= 1e-6) ints++; }
    }
    return s;
  });
  const medSum = median(sums);
  const intShare = nz ? ints / nz : 0;
  if (min < 0) add('negative', 'stop', 'Untransformed values', 'Negative values found: the table looks already transformed. Provide untransformed values.');
  if (max < 50) add('logged', 'stop', 'Untransformed values', `Largest value is ${max.toFixed(1)}, which looks log-transformed. The score applies log1p once, so a logged table would be logged twice.`);
  else if (min >= 0) add('logged', 'ok', 'Untransformed values', `Values run from ${min} to ${Math.round(max).toLocaleString('en-US')}.`);
  let scaleOk = true;
  if (scale === 'counts' && Math.abs(medSum - 1e6) / 1e6 < 0.05) { add('scale', 'stop', 'Declared scale', 'Declared counts, but column sums are about 1e6, as in TPM. Declare the right scale.'); scaleOk = false; }
  if (scale === 'tpm' && !(medSum > 0.5e6 && medSum < 1.1e6)) { add('scale', 'stop', 'Declared scale', `Declared TPM, but the median column sum is ${Math.round(medSum).toLocaleString('en-US')}.`); scaleOk = false; }
  if (scale === 'fpkm') add('scale', 'warn', 'Declared scale', 'FPKM input is rescaled to TPM. Trends within a donor can be read; absolute values are not comparable with count-based cohorts.');
  else if (scale === 'counts' && intShare < 0.999 && scaleOk) add('scale', 'warn', 'Declared scale', `Only ${(100 * intShare).toFixed(0)}% of non-zero counts are integers, as expected for estimated counts such as Salmon. Confirm this is not FPKM or TPM.`);
  else if (scaleOk) add('scale', 'ok', 'Declared scale', `Consistent with ${scale}; median column sum ${Math.round(medSum).toLocaleString('en-US')}.`);
  const index = new Set(table.genes);
  let wAll = 0, wHave = 0;
  for (const [g, w] of markers) { wAll += Math.abs(w); if (index.has(g)) wHave += Math.abs(w); }
  const cover = wAll ? wHave / wAll : 0;
  if (cover < LIMITS.minWeightCoverage) add('coverage', 'stop', 'Signature coverage', `Signature coverage is ${(100 * cover).toFixed(1)}% of total weight, under the ${(100 * LIMITS.minWeightCoverage).toFixed(0)}% minimum.`);
  else add('coverage', 'ok', 'Signature coverage', `${(100 * cover).toFixed(1)}% of signature weight is present.`);
  // Thinning two cohorts showed slopes lose over 10% below about 3 million counts and most of their size below 0.25 million.
  if (scale === 'counts') {
    const low = Math.min(...sums);
    if (low < LIMITS.depthStop) add('depth', 'stop', 'Sequencing depth', `The shallowest sample has ${Math.round(low).toLocaleString('en-US')} counts. Below ${LIMITS.depthStop.toLocaleString('en-US')}, thinning tests lost most of the trend.`);
    else if (low < LIMITS.depthWarn) add('depth', 'warn', 'Sequencing depth', `The shallowest sample has ${Math.round(low).toLocaleString('en-US')} counts. Thinning tests lost over 10% of the slope below ${LIMITS.depthWarn.toLocaleString('en-US')}.`);
    else add('depth', 'ok', 'Sequencing depth', `The shallowest sample has ${(low / 1e6).toFixed(1)} million counts.`);
  }
  const byDonor = groupDonors(samples);
  // One donor must show one sex-linked pattern. This caught mislabelled pairing in a public cohort, GSE125632.
  const yIdx = table.genes.indexOf(Y_GENE);
  if (yIdx >= 0) {
    const bad = [...byDonor].filter(([, idx]) => {
      const y = idx.map((i) => Math.log1p(table.values[i][yIdx]));
      return Math.max(...y) > LIMITS.yHigh && Math.min(...y) < LIMITS.yLow;
    }).map(([d]) => d);
    if (bad.length) add('identity', 'stop', 'Sample identity', `These donor labels mix Y-positive and Y-negative samples: ${bad.join(', ')}. One person can't show both, so check the sample labels.`);
    else add('identity', 'ok', 'Sample identity', 'Each donor shows one sex-linked pattern (RPS4Y1).');
  } else add('identity', 'warn', 'Sample identity', 'RPS4Y1 is not in the table, so donor identity could not be checked.');
  const short = [...byDonor].filter(([, idx]) => new Set(idx.map((i) => samples[i].passage)).size < LIMITS.minPassages).map(([d]) => d);
  if (short.length === byDonor.size) add('design', 'stop', 'Passage design', `No donor has at least ${LIMITS.minPassages} distinct passages, so no within-donor trend can be estimated.`);
  else if (short.length) add('design', 'warn', 'Passage design', `Not assessed, under ${LIMITS.minPassages} passages: donors ${short.join(', ')}.`);
  else add('design', 'ok', 'Passage design', `${byDonor.size} donors, each with at least ${LIMITS.minPassages} passages.`);
  return { checks, refused: checks.some((c) => c.status === 'stop'), facts: { medianColumnSum: medSum, integerShare: intShare, coverage: cover } };
}

export function groupDonors(samples) {
  const m = new Map();
  samples.forEach((s, i) => { if (!m.has(s.donor)) m.set(s.donor, []); m.get(s.donor).push(i); });
  return m;
}

// authors' normalize_counts.py filter, then DESeq2 median of ratios
export function normalize(table, scale) {
  const n = table.values.length, g = table.genes.length;
  if (scale === 'counts') {
    const keep = [];
    for (let k = 0; k < g; k++) {
      let nonzero = 0, sum = 0;
      for (let j = 0; j < n; j++) { const v = table.values[j][k]; if (v !== 0) nonzero++; sum += v; }
      if (nonzero > 0.05 * n && sum > 380) keep.push(k);
    }
    const ref = [];
    for (const k of keep) {
      let s = 0, ok = true;
      for (let j = 0; j < n; j++) { const v = table.values[j][k]; if (v <= 0) { ok = false; break; } s += Math.log(v); }
      if (ok) ref.push([k, s / n]);
    }
    const sizeFactors = table.values.map((col) => Math.exp(median(ref.map(([k, m]) => Math.log(col[k]) - m))));
    return { genes: keep.map((k) => table.genes[k]), values: table.values.map((col, j) => Float64Array.from(keep, (k) => col[k] / sizeFactors[j])), sizeFactors };
  }
  if (scale === 'fpkm') {
    return { genes: table.genes, values: table.values.map((col) => { let s = 0; for (const v of col) s += v; return col.map((v) => (v / s) * 1e6); }) };
  }
  return { genes: table.genes, values: table.values };
}

export function slope(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  return sxy / sxx;
}

export function ranks(v) {
  const order = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  for (let i = 0; i < order.length;) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[order[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function spearman(a, b) {
  const ra = ranks(a), rb = ranks(b);
  const n = a.length, ma = ra.reduce((x, y) => x + y, 0) / n, mb = rb.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : NaN;
}

// Deterministic generator, so the same input always gives the same report
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function exactSignFlipP(values) {
  const n = values.length;
  const obs = Math.abs(values.reduce((a, b) => a + b, 0) / n);
  let hit = 0;
  const total = 2 ** n;
  for (let mask = 0; mask < total; mask++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += mask & (1 << i) ? values[i] : -values[i];
    if (Math.abs(s / n) >= obs - 1e-12) hit++;
  }
  return hit / total;
}

export function analyze(table, samples, scale, markers, opts = {}) {
  const nDraws = opts.nDraws ?? LIMITS.nullDraws;
  const guard = checkInputs(table, samples, scale, markers);
  const out = { status: guard.refused ? 'REFUSED' : 'REPORT', checks: guard.checks, facts: guard.facts ?? {}, scale };
  if (guard.refused) return out;
  const norm = normalize(table, scale);
  const pos = new Map(norm.genes.map((g, i) => [g, i]));
  const used = [...markers].filter(([g]) => pos.has(g));
  const log1p = (v) => Math.log1p(v);
  const scores = norm.values.map((col) => { let s = 0; for (const [g, w] of used) s += log1p(col[pos.get(g)]) * w; return s; });
  const byDonor = groupDonors(samples);
  const trends = [];
  const eligible = [];
  for (const [donor, idx] of byDonor) {
    if (new Set(idx.map((i) => samples[i].passage)).size < LIMITS.minPassages) continue;
    eligible.push(donor);
    const pts = idx.map((i) => ({ passage: samples[i].passage, score: scores[i], id: samples[i].id })).sort((a, b) => a.passage - b.passage);
    const xs = pts.map((p) => p.passage), ys = pts.map((p) => p.score);
    trends.push({ donor, points: pts, slope: slope(xs, ys), rho: spearman(xs, ys), first: xs[0], last: xs[xs.length - 1], change: ys[ys.length - 1] - ys[0] });
  }
  trends.sort((a, b) => (a.donor < b.donor ? -1 : 1));
  out.trends = trends;
  out.scores = Object.fromEntries(samples.map((s, i) => [s.id, scores[i]]));
  out.markersUsed = used.length;
  out.meanSlope = trends.reduce((a, t) => a + t.slope, 0) / trends.length;
  out.donorsRising = trends.filter((t) => t.slope > 0).length;
  out.signFlipP = exactSignFlipP(trends.map((t) => t.slope));
  out.signFlipFloor = 2 / 2 ** trends.length;
  out.random = randomSignature(norm, samples, used, eligible, nDraws, out.meanSlope);
  return out;
}

// Culture-drift clock: ridge weights over within-sample gene ranks. Estimates passage-like drift, not senescence.
export function applyClock(table, samples, clock, model) {
  const pos = new Map(table.genes.map((g, i) => [g, i]));
  const n = table.values.length;
  const cols = [], coefs = [];
  clock.genes.forEach((sym, gi) => {
    let best = -1, bestMean = -Infinity;
    for (const e of clock.ensembl_by_symbol[sym] ?? []) {
      const k = pos.get(e);
      if (k === undefined) continue;
      let m = 0;
      for (let j = 0; j < n; j++) m += table.values[j][k];
      if (m > bestMean) { bestMean = m; best = k; }
    }
    if (best >= 0) { cols.push(best); coefs.push(clock.models[model][gi]); }
  });
  const coverage = cols.length / clock.genes.length;
  if (coverage < LIMITS.minWeightCoverage) return { skipped: `Only ${(100 * coverage).toFixed(0)}% of clock genes are in this table, under the ${(100 * LIMITS.minWeightCoverage).toFixed(0)}% minimum.` };
  const scores = table.values.map((col) => {
    const r = ranks(cols.map((k) => col[k]));
    let s = 0;
    for (let i = 0; i < r.length; i++) s += coefs[i] * (r[i] / r.length);
    return s;
  });
  const trends = [];
  for (const [donor, idx] of groupDonors(samples)) {
    if (new Set(idx.map((i) => samples[i].passage)).size < LIMITS.minPassages) continue;
    const pts = idx.map((i) => [samples[i].passage, scores[i]]).sort((a, b) => a[0] - b[0]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    trends.push({ donor, slope: slope(xs, ys), rho: spearman(xs, ys), change: ys[ys.length - 1] - ys[0] });
  }
  trends.sort((a, b) => (a.donor < b.donor ? -1 : 1));
  return { coverage, model, trends, rising: trends.filter((t) => t.slope > 0).length, scores: Object.fromEntries(samples.map((s, i) => [s.id, scores[i]])) };
}

// Each gene's mean within-donor slope makes a random signature's slope a weighted sum, so draws cost little.
function randomSignature(norm, samples, used, eligible, nDraws, observed) {
  const inScope = samples.map((s, i) => (eligible.includes(s.donor) ? i : -1)).filter((i) => i >= 0);
  const g = norm.genes.length;
  const universe = [];
  for (let k = 0; k < g; k++) {
    let m = 0;
    for (const j of inScope) m += Math.log1p(norm.values[j][k]);
    if (m / inScope.length > 1) universe.push(k);
  }
  const groups = eligible.map((d) => inScope.filter((j) => samples[j].donor === d));
  const b = new Float64Array(universe.length);
  groups.forEach((idx) => {
    const xs = idx.map((j) => samples[j].passage);
    const mx = xs.reduce((a, c) => a + c, 0) / xs.length;
    const sxx = xs.reduce((a, c) => a + (c - mx) ** 2, 0);
    universe.forEach((k, u) => {
      let sxy = 0;
      idx.forEach((j, q) => { sxy += (xs[q] - mx) * Math.log1p(norm.values[j][k]); });
      b[u] += sxy / sxx / groups.length;
    });
  });
  const rand = mulberry32(42);
  const weights = used.map(([, w]) => w);
  const draws = new Float64Array(nDraws);
  const n = Math.min(weights.length, universe.length);
  const pool = Int32Array.from(universe.keys());
  const w = weights.slice();
  for (let d = 0; d < nDraws; d++) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = i + Math.floor(rand() * (pool.length - i));
      [pool[i], pool[a]] = [pool[a], pool[i]];
      const c = i + Math.floor(rand() * (w.length - i));
      [w[i], w[c]] = [w[c], w[i]];
      s += b[pool[i]] * w[i];
    }
    draws[d] = s;
  }
  const mean = draws.reduce((a, c) => a + c, 0) / nDraws;
  const sd = Math.sqrt(draws.reduce((a, c) => a + (c - mean) ** 2, 0) / nDraws);
  const hits = draws.filter((v) => Math.abs(v) >= Math.abs(observed)).length;
  return { draws: Array.from(draws), mean, sd, z: (observed - mean) / sd, p: (1 + hits) / (1 + nDraws), n: nDraws };
}
