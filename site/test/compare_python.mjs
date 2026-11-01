// Checks that the browser core reproduces the frozen Python scores and refuses the same bad inputs.
// Usage: node site/test/compare_python.mjs   (from the project root)
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { analyze, applyClock, forecast, guessSheet, idType, parseSampleSheet, parseTable, symbolsToEnsembl } from '../js/core.js';

const IN = 'site/data/';
const text = (f) => (f.endsWith('.gz') ? gunzipSync(readFileSync(f)).toString('utf8') : readFileSync(f, 'utf8'));
// The authors' weights are not redistributed here, so the test downloads them at the pinned commit
const markerUrl = 'https://raw.githubusercontent.com/maragkakislab/wf-ml-markers-senescence/0e23fcc926f31fc2206631ff9b64a852fb81fe89/analysis/transcriptomics_loose5000f_tuned_common_features.csv';
const markerCsv = await (await fetch(markerUrl)).text();
const markers = new Map(markerCsv.trim().split(/\r?\n/).slice(1).map((l) => { const p = l.split(','); return [p[0], Number(p[p.length - 1])]; }));
const frozen = new Map();
for (const l of text('deliverables/tables/external_predictions.csv').trim().split(/\r?\n/).slice(1)) {
  const p = l.split(',');
  if (p[4] === 'SenCat published') frozen.set(p[0], Number(p[5]));
}

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };
const run = (tableFile, sheetFile, scale, transform) => {
  const { samples } = parseSampleSheet(text(IN + sheetFile));
  let t = text(IN + tableFile);
  if (transform) t = transform(t, samples);
  return analyze(parseTable(t, samples), samples, scale, markers, { nDraws: 200 });
};

for (const [label, table, sheet, scale, slopeExpect, donors] of [
  ['Adipose MSC', 'adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'counts', 1.927, 5],
  ['Bone-marrow MSC', 'bone_marrow_msc_tpm.tsv.gz', 'bone_marrow_msc_samples.csv', 'tpm', 0.624, 3],
]) {
  const r = run(table, sheet, scale);
  check(`${label}: scored`, r.status === 'REPORT', r.status);
  let worst = 0;
  for (const [id, s] of Object.entries(r.scores)) worst = Math.max(worst, Math.abs(s - frozen.get(id)));
  check(`${label}: scores match frozen Python`, worst < 1e-3, `max difference ${worst.toExponential(2)}`);
  check(`${label}: mean slope`, Math.abs(r.meanSlope - slopeExpect) < 1e-3, r.meanSlope.toFixed(4));
  check(`${label}: all donors rising`, r.donorsRising === donors, `${r.donorsRising}/${donors}`);
  check(`${label}: random signature z large`, r.random.z > 10, `z=${r.random.z.toFixed(1)} p=${r.random.p.toFixed(4)}`);
}

const refused = (name, r, needle) => check(`Refuses: ${name}`, r.status === 'REFUSED' && r.checks.some((c) => c.status === 'stop' && c.detail.includes(needle)), r.checks.filter((c) => c.status === 'stop').map((c) => c.detail)[0]?.slice(0, 80) ?? r.status);
const log1pTable = (t) => t.split('\n').map((l, i) => (i === 0 || !l ? l : l.split('\t').map((c, j) => { const v = Number(c); return j === 0 || !Number.isFinite(v) ? c : String(Math.log1p(v)); }).join('\t'))).join('\n');
refused('already logged', run('adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'counts', log1pTable), 'log-transformed');
refused('labelling error in GSE125632', run('mislabelled_gse125632_fpkm.tsv.gz', 'mislabelled_gse125632_samples.csv', 'fpkm'), 'Y-positive');
const thin = (d) => (t) => t.split('\n').map((l, i) => (i === 0 || !l ? l : l.split('\t').map((c, j) => (j === 0 ? c : String(Math.round(Number(c) / d)))).join('\t'))).join('\n');
refused('extremely shallow sequencing', run('adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'counts', thin(200)), 'thinning');
const shallow = run('adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'counts', thin(10));
check('Warns on shallow sequencing', shallow.status === 'REPORT' && shallow.checks.some((c) => c.id === 'depth' && c.status === 'warn'), shallow.checks.find((c) => c.id === 'depth')?.detail.slice(0, 70));
refused('Entrez ids', run('bone_marrow_msc_entrez_ids.tsv.gz', 'bone_marrow_msc_samples.csv', 'fpkm'), 'not Ensembl');
refused('counts declared as TPM', run('adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'tpm'), 'Declared TPM');
refused('half the genes missing', run('adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'counts', (t) => t.split('\n').filter((_, i) => i === 0 || i % 2).join('\n')), 'coverage');
const neg = (t) => t.split('\n').map((l, i) => (i === 0 || !l ? l : l.split('\t').map((c, j) => (j < 2 ? c : String(Number(c) - 1))).join('\t'))).join('\n');
refused('negative values', run('adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'counts', neg), 'Negative');
const one = parseSampleSheet(text(IN + 'adipose_msc_samples.csv')).samples.filter((s) => s.passage === 1);
refused('one passage per donor', analyze(parseTable(text(IN + 'adipose_msc_counts.tsv.gz'), one), one, 'counts', markers), 'distinct passages');
const ghost = [...parseSampleSheet(text(IN + 'adipose_msc_samples.csv')).samples, { id: 'GSM0', donor: 'A', passage: 2 }];
refused('sample not in table', analyze(parseTable(text(IN + 'adipose_msc_counts.tsv.gz'), ghost), ghost, 'counts', markers), 'no column');

const a = run('adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'counts');
const b = run('adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'counts');
check('Same input gives the same report', JSON.stringify(a.random.draws) === JSON.stringify(b.random.draws));

const clock = JSON.parse(readFileSync('site/data/clock.json', 'utf8'));
const loco = new Map(text('deliverables/tables/ext_clock_loco.csv').trim().split(/\r?\n/).slice(1).map((l) => { const p = l.split(','); return [`${p[0]}|${p[1]}`, Number(p[4])]; }));
for (const [label, acc, table, sheet, model] of [['Adipose MSC', 'GSE309666', 'adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'without_GSE309666'], ['Bone-marrow MSC', 'GSE178514', 'bone_marrow_msc_tpm.tsv.gz', 'bone_marrow_msc_samples.csv', 'without_GSE178514']]) {
  const { samples } = parseSampleSheet(text(IN + sheet));
  const c = applyClock(parseTable(text(IN + table), samples), samples, clock, model);
  let worst = 0;
  for (const t of c.trends) worst = Math.max(worst, Math.abs(t.slope - loco.get(`${acc}|${t.donor}`)));
  check(`${label}: clock slopes match held-out Python`, worst < 2e-3, `max difference ${worst.toExponential(2)}; coverage ${(c.coverage * 100).toFixed(1)}%`);
  check(`${label}: clock rises in all donors`, c.rising === c.trends.length, `${c.rising}/${c.trends.length}`);
}

const symMap = JSON.parse(gunzipSync(readFileSync('site/data/symbol_to_ensembl.json.gz')).toString('utf8'));
const ens2sym = Object.fromEntries(Object.entries(symMap).map(([s, e]) => [e, s]));
const adText = text(IN + 'adipose_msc_counts.tsv.gz');
const asSymbols = adText.split('\n').map((l, i) => { if (i === 0 || !l) return l; const at = l.indexOf('\t'); const e = l.slice(0, at); return (ens2sym[e] ?? e) + l.slice(at); }).join('\n');
check('Detects gene symbols', idType(asSymbols) === 'symbol', idType(asSymbols));
check('Detects Ensembl and numeric ids', idType(adText) === 'ensembl' && idType(text(IN + 'bone_marrow_msc_entrez_ids.tsv.gz')) === 'numeric');
const conv = symbolsToEnsembl(asSymbols, symMap);
const adSheet = parseSampleSheet(text(IN + 'adipose_msc_samples.csv')).samples;
const fromSym = analyze(parseTable(conv.text, adSheet), adSheet, 'counts', markers);
const direct = analyze(parseTable(adText, adSheet), adSheet, 'counts', markers);
let symWorst = 0;
for (const id of Object.keys(direct.scores)) symWorst = Math.max(symWorst, Math.abs(direct.scores[id] - fromSym.scores[id]));
check('Symbol table gives the same scores as the Ensembl table', symWorst < 1e-9 && fromSym.status === 'REPORT', `max difference ${symWorst.toExponential(2)}; ${(conv.share * 100).toFixed(1)}% of ids mapped`);
const guess = guessSheet(['id', 'D_p1', 'D_p10', 'P2-C1', 'PN241_p5', 'Passage 3 donor A', 'P4393', 'GSM123', 'name'], ['x', '1', '2', '3', '4', '5', '6', '7', 'abc']);
const g = Object.fromEntries(guess.map((r) => [r.id, r]));
check('Guesses sample sheets only when clear', g.D_p10?.donor === 'D' && g.D_p10?.passage === 10 && g['P2-C1']?.donor === 'C1' && g['P2-C1']?.passage === 2 && g.PN241_p5?.donor === 'PN241' && g.P4393?.donor === '' && g.GSM123?.passage === '' && !g.name, JSON.stringify(g.PN241_p5));

const fcModel = JSON.parse(readFileSync('site/data/forecast.json', 'utf8'));
const fcCsv = text('deliverables/tables/virtual_passage_units.csv').trim().split(/\r?\n/);
const fh = fcCsv[0].split(',');
const fcRows = fcCsv.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [fh[i], v])));
for (const [label, acc, table, sheet, model] of [['Adipose MSC', 'GSE309666', 'adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'without_GSE309666'], ['Bone-marrow MSC', 'GSE178514', 'bone_marrow_msc_tpm.tsv.gz', 'bone_marrow_msc_samples.csv', 'without_GSE178514']]) {
  const { samples } = parseSampleSheet(text(IN + sheet));
  const fc = forecast(parseTable(text(IN + table), samples), samples, fcModel, model);
  let worstF = 0, worstT = 0;
  for (const d of fc.donors) {
    const r = fcRows.find((x) => x.cohort === acc && x.unit === d.donor);
    worstF = Math.max(worstF, Math.abs(d.lastForecast - Number(r.score_model)));
    worstT = Math.max(worstT, Math.abs(d.lastActual - Number(r.score_true)));
  }
  check(`${label}: held-out forecast matches Python`, worstF < 3e-3, `max difference ${worstF.toExponential(2)}`);
  check(`${label}: actual rank score matches Python`, worstT < 3e-3, `max difference ${worstT.toExponential(2)}; forecast beat no-change in ${fc.beat}/${fc.tested}`);
}
const earlySheet = parseSampleSheet(text(IN + 'adipose_msc_samples.csv')).samples.filter((s) => s.passage === 1);
const earlyTable = parseTable(text(IN + 'adipose_msc_counts.tsv.gz'), earlySheet);
const early = analyze(earlyTable, earlySheet, 'counts', markers, { allowForecastOnly: true });
const earlyFc = forecast(earlyTable, earlySheet, fcModel, 'without_GSE309666');
check('One early sample per donor gives a forecast', early.status === 'FORECAST_ONLY' && earlyFc.donors.length === 5 && earlyFc.donors.every((d) => d.predictAt(10) > d.startScore), `${early.status}; ${earlyFc.donors.length} donors`);
const stillBad = analyze(parseTable(text(IN + 'mislabelled_gse125632_fpkm.tsv.gz'), parseSampleSheet(text(IN + 'mislabelled_gse125632_samples.csv')).samples), parseSampleSheet(text(IN + 'mislabelled_gse125632_samples.csv')).samples, 'fpkm', markers, { allowForecastOnly: true });
check('Forecast mode does not bypass the identity check', stillBad.status === 'REFUSED', stillBad.status);

const pca = JSON.parse(readFileSync('deliverables/tables/pca_check_adipose.json', 'utf8'));
const adipose = run('adipose_msc_counts.tsv.gz', 'adipose_msc_samples.csv', 'counts');
const evr = Math.max(...adipose.state.varExplained.map((v, i) => Math.abs(v - pca.var_explained[i])));
check('Expression space: variance explained matches numpy', evr < 1e-6, `max difference ${evr.toExponential(2)}`);
let worstPc = 0;
pca.samples.forEach((id, i) => { for (let c = 0; c < 3; c++) worstPc = Math.max(worstPc, Math.abs(Math.abs(adipose.state.coords[id][c]) - Math.abs(pca.coords[i][c]))); });
check('Expression space: coordinates match numpy', worstPc < 1e-5, `max difference ${worstPc.toExponential(2)}`);
const rec = adipose.records[pca.samples[0]];
check('Sample records hold measured transcripts', Object.keys(rec.genes).length >= 5 && Object.values(rec.genes).every(Number.isFinite), Object.keys(rec.genes).join(' '));

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} passed`);
process.exit(failed ? 1 : 0);
