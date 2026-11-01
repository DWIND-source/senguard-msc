import { analyze, applyClock, parseSampleSheet, parseTable } from './core.js';
import { donorPanel, histogram, tooltipLayer } from './charts.js';
import { renderEvidence } from './evidence.js';

const SIGNATURE = {
  url: 'https://raw.githubusercontent.com/maragkakislab/wf-ml-markers-senescence/0e23fcc926f31fc2206631ff9b64a852fb81fe89/analysis/transcriptomics_loose5000f_tuned_common_features.csv',
  commit: '0e23fcc',
};
const SCENARIOS = {
  adipose: { label: 'Adipose MSC, GSE309666', table: 'data/adipose_msc_counts.tsv.gz', sheet: 'data/adipose_msc_samples.csv', scale: 'counts', clock: 'without_GSE309666' },
  marrow: { label: 'Bone-marrow MSC, GSE178514', table: 'data/bone_marrow_msc_tpm.tsv.gz', sheet: 'data/bone_marrow_msc_samples.csv', scale: 'tpm', clock: 'without_GSE178514' },
  mislabelled: { label: 'GSE125632, as deposited', table: 'data/mislabelled_gse125632_fpkm.tsv.gz', sheet: 'data/mislabelled_gse125632_samples.csv', scale: 'fpkm' },
  logged: { label: 'Adipose MSC, log-transformed on purpose', table: 'data/adipose_msc_counts.tsv.gz', sheet: 'data/adipose_msc_samples.csv', scale: 'counts', transform: 'log1p' },
  entrez: { label: 'Bone-marrow MSC table with Entrez ids', table: 'data/bone_marrow_msc_entrez_ids.tsv.gz', sheet: 'data/bone_marrow_msc_samples.csv', scale: 'fpkm' },
};
const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const results = $('results');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const say = (t) => { statusEl.textContent = t; };
let markers = null, clock = null, signatureInfo = '', guidance = null, last = null;

async function ungzip(buf) {
  const head = new Uint8Array(buf.slice(0, 2));
  if (head[0] !== 0x1f || head[1] !== 0x8b) return new TextDecoder().decode(buf);
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}
async function sha256(buf) {
  if (!crypto.subtle) return null;
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function fetchBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} returned HTTP ${r.status}`);
  return r.arrayBuffer();
}
async function loadSignature() {
  const expected = (await (await fetch('data/signature.json')).json()).sha256;
  const buf = await fetchBuffer(SIGNATURE.url);
  const got = await sha256(buf);
  if (got && got !== expected) throw new Error('The signature file does not match its recorded checksum, so nothing will be scored.');
  const text = new TextDecoder().decode(buf);
  const lines = text.trim().split(/\r?\n/).slice(1);
  markers = new Map(lines.map((l) => { const p = l.split(','); return [p[0], Number(p[p.length - 1])]; }));
  signatureInfo = `${markers.size.toLocaleString('en-US')} genes, authors' commit ${SIGNATURE.commit}${got ? `, SHA-256 verified (${got.slice(0, 12)}...)` : ''}`;
}

function logTransform(text) {
  return text.split('\n').map((line, i) => {
    if (i === 0 || !line) return line;
    return line.split('\t').map((c, j) => { const v = Number(c); return j === 0 || !Number.isFinite(v) ? c : Math.log1p(v).toFixed(4); }).join('\t');
  }).join('\n');
}

function pressed(name) {
  document.querySelectorAll('.scenario').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.scenario === name)));
  $('upload').hidden = name !== 'upload';
}

async function runScenario(name) {
  pressed(name);
  if (name === 'upload') { results.innerHTML = ''; say('Choose your files. They are read in this browser and never uploaded.'); return; }
  const s = SCENARIOS[name];
  say(`Loading ${s.label}...`);
  try {
    const [tb, sb] = await Promise.all([fetchBuffer(s.table), fetchBuffer(s.sheet)]);
    let text = await ungzip(tb);
    if (s.transform === 'log1p') text = logTransform(text);
    const sheet = new TextDecoder().decode(sb);
    await compute(text, sheet, s.scale, s.label, s.clock ?? 'final');
  } catch (e) { say(`Could not load this example: ${e.message}`); }
}

async function compute(tableText, sheetText, scale, label, clockModel = 'final') {
  if (!markers) { say('The signature has not loaded, so nothing can be scored. Check the connection and reload.'); return; }
  say('Checking and scoring...');
  await new Promise((r) => setTimeout(r, 20));
  const t0 = performance.now();
  const sheet = parseSampleSheet(sheetText);
  if (sheet.error) { renderRefusal({ checks: [{ status: 'stop', label: 'Sample sheet', detail: sheet.error }] }, label); say(''); return; }
  const table = parseTable(tableText, sheet.samples);
  const res = analyze(table, sheet.samples, scale, markers);
  const drift = res.status === 'REPORT' && clock ? applyClock(table, sheet.samples, clock, clockModel) : null;
  last = { res, drift, label, scale, when: new Date().toISOString() };
  if (res.status === 'REFUSED') renderRefusal(res, label); else renderReport(res, label, drift);
  say(`Finished in ${((performance.now() - t0) / 1000).toFixed(1)} s, in this browser. Signature: ${signatureInfo}.`);
}

const PILL = { ok: '✓ pass', warn: '! caution', stop: '✕ stop' };
const checksHtml = (checks) => `<ul class="checks">${checks.map((c) => `<li class="check ${c.status}"><span class="pill ${c.status}">${PILL[c.status]}</span><div><b>${esc(c.label)}</b><span class="d">${esc(c.detail)}</span></div></li>`).join('')}</ul>`;

function renderRefusal(res, label) {
  const stops = res.checks.filter((c) => c.status === 'stop');
  results.innerHTML = `<div class="verdict stopped"><b>✕ Not scored: ${esc(label)}</b><p>${esc(stops[0]?.detail ?? '')} A number from this input would look valid and be wrong, so none is given.</p></div>
    <h3>Input checks</h3>${checksHtml(res.checks)}`;
}

function renderReport(r, label, drift) {
  const lo = Math.min(...r.trends.flatMap((t) => t.points.map((p) => p.score)));
  const hi = Math.max(...r.trends.flatMap((t) => t.points.map((p) => p.score)));
  const pad = (hi - lo) * 0.08 || 1;
  const yMin = lo - pad, yMax = hi + pad;
  const floorNote = r.signFlipP <= r.signFlipFloor + 1e-9 ? ', the smallest possible with this many donors' : '';
  const mdc = guidance?.minimumChange;
  results.innerHTML = `
    <div class="verdict"><b>Score rose in ${r.donorsRising} of ${r.trends.length} donors: ${esc(label)}</b>
      <p>Mean slope ${r.meanSlope >= 0 ? '+' : ''}${r.meanSlope.toFixed(2)} per passage. Exact sign-flip p = ${r.signFlipP.toFixed(4)}${floorNote}. No pass or fail call is made, because no threshold has been validated.</p></div>
    <h3>Input checks</h3>${checksHtml(r.checks)}
    <h3>Within-donor trajectories <span class="tag">model inference on measured expression</span></h3>
    <div class="panels">${r.trends.map((t) => `<div class="panel"><h4>Donor ${esc(t.donor)}</h4><small>${t.slope >= 0 ? '+' : ''}${t.slope.toFixed(2)} per passage</small>${donorPanel(t, yMin, yMax)}</div>`).join('')}</div>
    <details><summary>Show the table</summary><div class="table-wrap"><table><thead><tr><th>Donor</th><th>Passages</th><th class="num">Points</th><th class="num">Slope per passage</th><th class="num">Last minus first</th><th class="num">Spearman rho</th></tr></thead><tbody>
      ${r.trends.map((t) => `<tr><td>${esc(t.donor)}</td><td>${t.first} to ${t.last}</td><td class="num">${t.points.length}</td><td class="num">${t.slope.toFixed(2)}</td><td class="num">${t.change.toFixed(2)}</td><td class="num">${t.rho.toFixed(2)}</td></tr>`).join('')}
    </tbody></table></div></details>
    ${driftHtml(drift)}
    <div class="two">
      <div><h3>Could a random signature do this?</h3>${histogram(r.random.draws, r.meanSlope)}
        <p class="note">${r.random.n} random gene sets of the same size and weights: mean ${r.random.mean.toFixed(3)}, SD ${r.random.sd.toFixed(3)}. This signature sits at z = ${r.random.z.toFixed(1)}, empirical p = ${r.random.p.toFixed(3)}, a figure limited by the number of draws.</p></div>
      <div><h3>How to read this</h3><ul class="reading">
        <li>Passage and donor come from your sheet. Scores are inference.</li>
        <li>Read each donor against itself. Absolute scores aren't comparable across labs or media.</li>
        ${mdc ? `<li>${esc(mdc)}</li>` : ''}
        <li>A rising score doesn't mean a lot has failed, and a flat one doesn't mean it is fine.</li>
        <li>This says nothing about potency, immune function or clinical safety.</li></ul>
        <div class="actions"><button type="button" class="secondary" id="dl">Download report (.json)</button><button type="button" class="secondary" id="print">Print</button></div></div>
    </div>`;
  $('dl').onclick = download;
  $('print').onclick = () => window.print();
}

function driftHtml(d) {
  if (!d) return '';
  if (d.skipped) return `<h3>Second readout: culture-drift clock</h3><p class="note">Not run. ${esc(d.skipped)}</p>`;
  const trained = d.model === 'final' ? 'The model was trained on the public cohorts listed under Evidence.' : 'For this example, the model was trained without this cohort.';
  return `<h3>Second readout: culture-drift clock <span class="tag">${d.model === 'final' ? 'trained model' : 'trained model, cohort held out'}</span></h3>
    <p class="note">Rose in ${d.rising} of ${d.trends.length} donors. ${trained} The clock learned how expression changes with passage across other cohorts, so it estimates passage-like drift. It is not a senescence or potency measure.</p>
    <div class="table-wrap"><table><thead><tr><th>Donor</th><th class="num">Slope per passage</th><th class="num">Last minus first</th><th class="num">Spearman rho</th></tr></thead><tbody>
    ${d.trends.map((t) => `<tr><td>${esc(t.donor)}</td><td class="num">${t.slope.toFixed(3)}</td><td class="num">${t.change.toFixed(2)}</td><td class="num">${t.rho.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`;
}

function download() {
  const { res, drift, label, scale, when } = last;
  const copy = { tool: 'SenGuard-MSC research prototype', label, scale, when, signature: signatureInfo, status: res.status, driftClock: drift && !drift.skipped ? { model: drift.model, trends: drift.trends } : null, checks: res.checks, trends: res.trends, scores: res.scores, meanSlope: res.meanSlope, donorsRising: res.donorsRising, signFlipP: res.signFlipP, random: { ...res.random, draws: undefined }, disclaimer: 'Not a release test. Says nothing about potency, immune function or clinical safety.' };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 1)], { type: 'application/json' }));
  a.download = 'senguard_msc_report.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

$('upload').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const tb = await $('f-table').files[0].arrayBuffer();
    const text = await ungzip(tb);
    const sheet = await ungzip(await $('f-sheet').files[0].arrayBuffer());
    await compute(text, sheet, $('f-scale').value, $('f-table').files[0].name, 'final');
  } catch (err) { say(`Could not read these files: ${err.message}`); }
});
document.querySelectorAll('.scenario').forEach((b) => b.addEventListener('click', () => runScenario(b.dataset.scenario)));
tooltipLayer($('tip'));

(async () => {
  try {
    const ev = await (await fetch('data/evidence.json')).json();
    guidance = ev.guidance ?? null;
    clock = await (await fetch('data/clock.json')).json();
    renderEvidence($('evidence-body'), ev);
  } catch (e) { $('evidence-body').innerHTML = `<p class="status">Could not load the evidence summary: ${esc(e.message)}</p>`; }
  try {
    await loadSignature();
    const asked = new URLSearchParams(location.search).get('demo');
    await runScenario(asked && (SCENARIOS[asked] || asked === 'upload') ? asked : 'adipose');
  } catch (e) { say(`The signature could not be loaded, so nothing can be scored: ${e.message}`); }
})();
