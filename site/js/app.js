import { analyze, applyClock, parseSampleSheet, parseTable } from './core.js';
import { donorPanel, histogram, tooltipLayer } from './charts.js';
import { renderEvidence } from './evidence.js';

const SIGNATURE = {
  url: 'https://raw.githubusercontent.com/maragkakislab/wf-ml-markers-senescence/0e23fcc926f31fc2206631ff9b64a852fb81fe89/analysis/transcriptomics_loose5000f_tuned_common_features.csv',
  commit: '0e23fcc',
};
const SCENARIOS = {
  adipose: { label: 'Adipose MSC · GSE309666', table: 'data/adipose_msc_counts.tsv.gz', sheet: 'data/adipose_msc_samples.csv', scale: 'counts', clock: 'without_GSE309666', geo: true },
  marrow: { label: 'Bone-marrow MSC · GSE178514', table: 'data/bone_marrow_msc_tpm.tsv.gz', sheet: 'data/bone_marrow_msc_samples.csv', scale: 'tpm', clock: 'without_GSE178514', geo: true },
  mislabelled: { label: 'GSE125632, as deposited', table: 'data/mislabelled_gse125632_fpkm.tsv.gz', sheet: 'data/mislabelled_gse125632_samples.csv', scale: 'fpkm' },
  logged: { label: 'Adipose MSC, log-transformed on purpose', table: 'data/adipose_msc_counts.tsv.gz', sheet: 'data/adipose_msc_samples.csv', scale: 'counts', transform: 'log1p' },
  entrez: { label: 'Bone-marrow table with Entrez ids', table: 'data/bone_marrow_msc_entrez_ids.tsv.gz', sheet: 'data/bone_marrow_msc_samples.csv', scale: 'fpkm' },
};
const VIEW_NOTES = {
  landscape: 'Each sphere is a measured sample. Height is its SenCat score, and each lane is one donor. Drag to rotate; click a sphere.',
  space: 'The same samples, placed by their measured expression (PCA of the 500 most variable genes). Lines join each donor in passage order.',
};
const CHECK_SHORT = { samples: 'Samples', ids: 'Gene ids', dups: 'Duplicates', numeric: 'Numeric', negative: 'Untransformed', logged: 'Untransformed', scale: 'Scale', coverage: 'Coverage', depth: 'Depth', identity: 'Identity', design: 'Design' };
const ICON = { ok: '✓', warn: '!', stop: '✕' };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const say = (t) => { $('status').textContent = t; };
const signed = (v, d = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
let markers = null, clock = null, signatureInfo = '', guidance = null, last = null, twin = null, timer = null, currentGeo = false, current = null;

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
  const lines = new TextDecoder().decode(buf).trim().split(/\r?\n/).slice(1);
  markers = new Map(lines.map((l) => { const p = l.split(','); return [p[0], Number(p[p.length - 1])]; }));
  signatureInfo = `${markers.size.toLocaleString('en-US')} genes, authors' commit ${SIGNATURE.commit}${got ? `, SHA-256 verified (${got.slice(0, 10)}...)` : ''}`;
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
function setHead(eyebrow, headline, sub) {
  $('in-label').textContent = eyebrow;
  $('in-headline').textContent = headline;
  $('in-sub').textContent = sub;
}

async function runScenario(name) {
  pressed(name);
  stopPlay();
  if (name === 'upload') {
    setHead('Your data', 'Choose two files', 'They are read in this browser and never uploaded.');
    say('');
    return;
  }
  const s = SCENARIOS[name];
  setHead(s.label, 'Loading...', '');
  say('');
  try {
    const [tb, sb] = await Promise.all([fetchBuffer(s.table), fetchBuffer(s.sheet)]);
    let text = await ungzip(tb);
    if (s.transform === 'log1p') text = logTransform(text);
    await compute(text, new TextDecoder().decode(sb), s.scale, s.label, s.clock ?? 'final', !!s.geo);
  } catch (e) { setHead(s.label, 'Could not load', e.message); }
}

async function compute(tableText, sheetText, scale, label, clockModel = 'final', geo = false) {
  if (!markers) { setHead(label, 'Signature not loaded', 'Nothing can be scored. Check the connection and reload.'); return; }
  say('Checking and scoring...');
  await new Promise((r) => setTimeout(r, 20));
  const t0 = performance.now();
  const sheet = parseSampleSheet(sheetText);
  if (sheet.error) { renderRefusal({ checks: [{ id: 'samples', status: 'stop', label: 'Sample sheet', detail: sheet.error }] }, label); return; }
  const table = parseTable(tableText, sheet.samples);
  const res = analyze(table, sheet.samples, scale, markers);
  const drift = res.status === 'REPORT' && clock ? applyClock(table, sheet.samples, clock, clockModel) : null;
  last = { res, drift, label, scale, when: new Date().toISOString() };
  currentGeo = geo;
  current = res;
  renderRail(res.checks);
  if (res.status === 'REFUSED') renderRefusal(res, label); else renderReport(res, label, drift);
  say(`Done in ${((performance.now() - t0) / 1000).toFixed(1)} s, in this browser. Signature: ${signatureInfo}.`);
}

function renderRail(checks) {
  const rail = $('rail');
  const seen = new Set();
  const items = checks.filter((c) => { const k = CHECK_SHORT[c.id] ?? c.label; if (seen.has(k) && c.status === 'ok') return false; seen.add(k); return true; });
  rail.innerHTML = items.map((c, i) => `<li class="pending" data-i="${i}"><button type="button"><span class="dot">${ICON[c.status]}</span>${esc(CHECK_SHORT[c.id] ?? c.label)}</button></li>`).join('');
  const lis = [...rail.children];
  const show = (i) => {
    lis.forEach((l, j) => l.setAttribute('aria-current', String(i === j)));
    $('rail-detail').textContent = `${items[i].label}: ${items[i].detail}`;
  };
  lis.forEach((l, i) => l.querySelector('button').addEventListener('click', () => show(i)));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  lis.forEach((l, i) => setTimeout(() => { l.classList.remove('pending'); l.classList.add(items[i].status); }, reduce ? 0 : 70 * i));
  const stop = items.findIndex((c) => c.status === 'stop');
  const warn = items.findIndex((c) => c.status === 'warn');
  const first = stop >= 0 ? stop : warn;
  if (first >= 0) show(first); else $('rail-detail').textContent = `All ${items.length} checks passed.`;
}

function renderRefusal(res, label) {
  const stops = res.checks.filter((c) => c.status === 'stop');
  if (!current || current !== res) renderRail(res.checks);
  $('refusal').hidden = false;
  $('timeline').hidden = true;
  $('view-note').textContent = '';
  $('refusal-title').textContent = `Not scored: ${stops[0]?.label ?? 'input'}`;
  $('refusal-body').textContent = stops[0]?.detail ?? '';
  twin?.clear();
  setHead(label, 'Refused', `${stops.length} of ${res.checks.length} checks stopped this input.`);
  $('donors').innerHTML = '';
  $('record').innerHTML = `<h4>What to fix</h4>${stops.map((c) => `<p class="fix"><b>${esc(c.label)}</b>${esc(c.detail)}</p>`).join('')}<small>Correct the input and run it again. Nothing was scored, so there is no partial result to reuse.</small>`;
  $('results').innerHTML = `<div class="card wide"><h3>All input checks</h3>${checksHtml(res.checks)}</div>`;
}

const PILL = { ok: '✓ pass', warn: '! caution', stop: '✕ stop' };
const checksHtml = (checks) => `<ul class="checks">${checks.map((c) => `<li class="check"><span class="pill ${c.status}">${PILL[c.status]}</span><div><b>${esc(c.label)}</b><span class="d">${esc(c.detail)}</span></div></li>`).join('')}</ul>`;

function renderReport(r, label, drift) {
  $('refusal').hidden = true;
  $('timeline').hidden = false;
  setHead(label, `Score rose in ${r.donorsRising} of ${r.trends.length} donors`, `Mean slope ${signed(r.meanSlope)} per passage. No pass or fail call is made, because no threshold has been validated.`);
  buildDonorChips(r);
  renderDetails(r, drift);
  if (twin) {
    const passages = twin.setData(r);
    window.__passages = passages;
    const slider = $('slider');
    slider.min = 0;
    slider.max = passages.length - 1;
    slider.value = passages.length - 1;
    slider.oninput = () => { stopPlay(); twin.setPassage(passages[+slider.value]); };
    setViewButtons('landscape');
    $('slider-out').textContent = `P${passages[passages.length - 1]}`;
    const end = r.trends[0].points[r.trends[0].points.length - 1];
    twin.selectById(end.id);
    const params = new URLSearchParams(location.search);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !params.has('still')) startPlay(true);
    if (params.get('view') === 'space') { twin.setView('space'); setViewButtons('space'); }
  } else if (r.trends.length) {
    showRecord({ ...r.trends[0].points[r.trends[0].points.length - 1], donor: r.trends[0].donor });
  }
}

function buildDonorChips(r) {
  const box = $('donors');
  box.innerHTML = `<button type="button" aria-pressed="true" data-d="">All</button>${r.trends.map((t) => `<button type="button" aria-pressed="false" data-d="${esc(t.donor)}">${esc(t.donor)}</button>`).join('')}`;
  box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const d = b.dataset.d || null;
    twin?.setFocus(d);
    if (d) {
      const t = r.trends.find((x) => x.donor === d);
      twin ? twin.selectById(t.points[t.points.length - 1].id) : showRecord({ ...t.points[t.points.length - 1], donor: d });
    }
  }));
}

function showRecord(p) {
  if (!p || !current?.records) { $('record').innerHTML = ''; return; }
  const rec = current.records[p.id];
  const t = current.trends.find((x) => x.donor === p.donor);
  const base = t?.points[0];
  const change = base ? p.score - base.score : 0;
  const maxV = Math.max(1, ...Object.values(current.records).flatMap((x) => Object.values(x.genes).filter(Number.isFinite)));
  const genes = Object.entries(rec.genes).filter(([, v]) => Number.isFinite(v));
  const baseRec = base ? current.records[base.id] : null;
  const link = currentGeo && /^GSM/.test(p.id) ? `<a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${esc(p.id)}">${esc(p.id)}</a>` : `<span style="font:500 12.5px var(--mono)">${esc(p.id)}</span>`;
  $('record').innerHTML = `<h4>Sample record</h4>${link}
    <div class="meta">
      <div><b>${esc(p.donor)}</b><span>Donor</span></div><div><b>P${p.passage}</b><span>Passage</span></div>
      <div><b>${p.score.toFixed(2)}</b><span>SenCat score</span></div><div><b>${signed(change)}</b><span>Since P${base?.passage}</span></div>
    </div>
    <div class="genes" role="list" aria-label="Measured transcripts">${genes.map(([g, v]) => { const d = baseRec ? v - baseRec.genes[g] : 0; return `<span role="listitem">${g}</span><span class="bar"><i style="width:${(100 * v) / maxV}%"></i></span><span class="n">${v.toFixed(1)} ${d >= 0.05 ? '↑' : d <= -0.05 ? '↓' : '·'}</span>`; }).join('')}</div>
    <small>Measured transcripts, log1p scale. Arrows compare with this donor's first passage. Score is model inference. Not a senescence call.</small>`;
}

function renderDetails(r, drift) {
  const lo = Math.min(...r.trends.flatMap((t) => t.points.map((p) => p.score)));
  const hi = Math.max(...r.trends.flatMap((t) => t.points.map((p) => p.score)));
  const pad = (hi - lo) * 0.08 || 1;
  const floorNote = r.signFlipP <= r.signFlipFloor + 1e-9 ? ', the smallest possible with this many donors' : '';
  const mdc = guidance?.minimumChange;
  $('results').innerHTML = `
    <div class="card wide"><h3>Trajectories by donor <span class="tag">model inference on measured expression</span></h3>
      <div class="panels">${r.trends.map((t) => `<div class="panel"><h4>Donor ${esc(t.donor)}</h4><small>${signed(t.slope)} per passage</small>${donorPanel(t, lo - pad, hi + pad)}</div>`).join('')}</div>
      <p class="note">Exact sign-flip p = ${r.signFlipP.toFixed(4)}${floorNote}.</p>
      <details><summary>Show the table</summary><div class="table-wrap"><table><thead><tr><th>Donor</th><th>Passages</th><th class="num">Points</th><th class="num">Slope per passage</th><th class="num">Last minus first</th><th class="num">Spearman rho</th></tr></thead><tbody>
      ${r.trends.map((t) => `<tr><td>${esc(t.donor)}</td><td>${t.first} to ${t.last}</td><td class="num">${t.points.length}</td><td class="num">${t.slope.toFixed(2)}</td><td class="num">${t.change.toFixed(2)}</td><td class="num">${t.rho.toFixed(2)}</td></tr>`).join('')}
      </tbody></table></div></details></div>
    <div class="card"><h3>Could a random signature do this?</h3>${histogram(r.random.draws, r.meanSlope)}
      <p class="note">${r.random.n} random gene sets of the same size and weights: mean ${r.random.mean.toFixed(3)}, SD ${r.random.sd.toFixed(3)}. This signature sits at z = ${r.random.z.toFixed(1)}, empirical p = ${r.random.p.toFixed(3)}, a figure limited by the number of draws.</p></div>
    <div class="card">${driftHtml(drift)}</div>
    <div class="card"><h3>How to read this</h3><ul class="reading">
      <li>Passage and donor come from your sheet. Scores are inference.</li>
      <li>Read each donor against itself. Absolute scores aren't comparable across labs or media.</li>
      ${mdc ? `<li>${esc(mdc)}</li>` : ''}
      <li>A rising score doesn't mean a lot has failed, and a flat one doesn't mean it is fine.</li>
      <li>This says nothing about potency, immune function or clinical safety.</li></ul>
      <div class="actions"><button type="button" class="secondary" id="dl">Download report (.json)</button><button type="button" class="secondary" id="print">Print</button></div></div>
    <div class="card"><h3>All input checks</h3>${checksHtml(r.checks)}</div>`;
  $('dl').onclick = download;
  $('print').onclick = () => window.print();
}

function driftHtml(d) {
  if (!d) return '<h3>Culture-drift clock</h3><p class="note">Not available.</p>';
  if (d.skipped) return `<h3>Culture-drift clock</h3><p class="note">Not run. ${esc(d.skipped)}</p>`;
  const trained = d.model === 'final' ? 'The model was trained on the public cohorts listed under Evidence.' : 'For this example, the model was trained without this cohort.';
  return `<h3>Culture-drift clock <span class="tag">${d.model === 'final' ? 'trained model' : 'trained model, cohort held out'}</span></h3>
    <p class="note">Rose in ${d.rising} of ${d.trends.length} donors. ${trained} It estimates passage-like drift, and is not a senescence or potency measure.</p>
    <div class="table-wrap"><table><thead><tr><th>Donor</th><th class="num">Slope per passage</th><th class="num">Spearman rho</th></tr></thead><tbody>
    ${d.trends.map((t) => `<tr><td>${esc(t.donor)}</td><td class="num">${t.slope.toFixed(3)}</td><td class="num">${t.rho.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`;
}

function download() {
  const { res, drift, label, scale, when } = last;
  const copy = { tool: 'SenGuard-MSC research prototype', label, scale, when, signature: signatureInfo, status: res.status, driftClock: drift && !drift.skipped ? { model: drift.model, trends: drift.trends } : null, checks: res.checks, trends: res.trends, scores: res.scores, records: res.records, stateSpace: res.state, meanSlope: res.meanSlope, donorsRising: res.donorsRising, signFlipP: res.signFlipP, random: { ...res.random, draws: undefined }, disclaimer: 'Not a release test. Says nothing about potency, immune function or clinical safety.' };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 1)], { type: 'application/json' }));
  a.download = 'senguard_msc_report.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function stopPlay() {
  if (timer) clearInterval(timer);
  timer = null;
  $('play').innerHTML = '&#9654;';
  $('play').setAttribute('aria-label', 'Play through passages');
}
function startPlay(fromStart = false) {
  const passages = window.__passages;
  if (!twin || !passages?.length) return;
  stopPlay();
  const slider = $('slider');
  let i = fromStart || +slider.value >= passages.length - 1 ? 0 : +slider.value;
  const tick = () => {
    slider.value = i;
    twin.setPassage(passages[i]);
    if (i >= passages.length - 1) { stopPlay(); return; }
    i += 1;
  };
  tick();
  $('play').innerHTML = '&#10074;&#10074;';
  $('play').setAttribute('aria-label', 'Pause');
  timer = setInterval(tick, 900);
}
function setViewButtons(view) {
  $('v-land').setAttribute('aria-pressed', String(view === 'landscape'));
  $('v-space').setAttribute('aria-pressed', String(view === 'space'));
  $('view-note').textContent = VIEW_NOTES[view];
}

$('upload').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const text = await ungzip(await $('f-table').files[0].arrayBuffer());
    const sheet = await ungzip(await $('f-sheet').files[0].arrayBuffer());
    await compute(text, sheet, $('f-scale').value, $('f-table').files[0].name, 'final', false);
  } catch (err) { setHead('Your data', 'Could not read these files', err.message); }
});
document.querySelectorAll('.scenario').forEach((b) => b.addEventListener('click', () => runScenario(b.dataset.scenario)));
$('v-land').addEventListener('click', () => { twin?.setView('landscape'); setViewButtons('landscape'); });
$('v-space').addEventListener('click', () => { twin?.setView('space'); setViewButtons('space'); });
$('play').addEventListener('click', () => (timer ? stopPlay() : startPlay()));
tooltipLayer($('tip'));

function renderHero(ev) {
  const { ok } = ev.headline;
  $('hero-stats').innerHTML = [
    [`${ok.donors_rising}/${ok.donors}`, 'donors in new cohorts with a rising score'],
    [`${ev.clock.rising}/${ev.clock.n}`, 'held-out donors rising on the drift clock'],
    ['8', 'input checks before any number appears'],
  ].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
}

(async () => {
  try {
    const { CultureTwin, webglAvailable } = await import('./twin.js');
    if (webglAvailable()) twin = new CultureTwin($('canvas'), { onSelect: (p) => showRecord(p), onPassage: (p) => { $('slider-out').textContent = `P${p}`; } });
    else $('no-webgl').hidden = false;
  } catch (e) { $('no-webgl').hidden = false; console.error(e); }
  try {
    const ev = await (await fetch('data/evidence.json')).json();
    guidance = ev.guidance ?? null;
    renderHero(ev);
    renderEvidence($('evidence-body'), ev);
    clock = await (await fetch('data/clock.json')).json();
  } catch (e) { $('evidence-body').innerHTML = `<p class="status">Could not load the evidence summary: ${esc(e.message)}</p>`; }
  try {
    await loadSignature();
    const asked = new URLSearchParams(location.search).get('demo');
    await runScenario(asked && (SCENARIOS[asked] || asked === 'upload') ? asked : 'adipose');
  } catch (e) { setHead('Signature', 'Could not load', `Nothing can be scored: ${e.message}`); }
})();
