import { analyze, applyClock, forecast, guessSheet, idType, parseDelimited, parseSampleSheet, parseTable, symbolsToEnsembl } from './core.js';
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
  early: { label: 'Adipose MSC, passage 1 only · GSE309666', table: 'data/adipose_msc_counts.tsv.gz', sheet: 'data/adipose_msc_samples.csv', scale: 'counts', clock: 'without_GSE309666', geo: true, onlyPassage: 1 },
  logged: { label: 'Adipose MSC, log-transformed on purpose', table: 'data/adipose_msc_counts.tsv.gz', sheet: 'data/adipose_msc_samples.csv', scale: 'counts', transform: 'log1p' },
  entrez: { label: 'Bone-marrow table with Entrez ids', table: 'data/bone_marrow_msc_entrez_ids.tsv.gz', sheet: 'data/bone_marrow_msc_samples.csv', scale: 'fpkm' },
};
const VIEW_NOTES = {
  forecast: 'Orange is the forecast from each donor\'s earliest sample. Blue spheres are what was measured. Press play to reveal them.',
  landscape: 'Each sphere is a measured sample. Height is its SenCat score, and each lane is one donor. Drag to rotate; click a sphere.',
  space: 'The same samples, placed by their measured expression (PCA of the 500 most variable genes). Lines join each donor in passage order.',
};
const CHECK_SHORT = { samples: 'Samples', ids: 'Gene ids', dups: 'Duplicates', numeric: 'Numeric', negative: 'Untransformed', logged: 'Untransformed', scale: 'Scale', coverage: 'Coverage', depth: 'Depth', identity: 'Identity', design: 'Design' };
const ICON = { ok: '✓', warn: '!', stop: '✕' };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const say = (t) => { $('status').textContent = t; };
const signed = (v, d = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
let markers = null, clock = null, fcModel = null, lastFc = null, signatureInfo = '', guidance = null, last = null, twin = null, timer = null, currentGeo = false, current = null;

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
    let sheetText = new TextDecoder().decode(sb);
    if (s.onlyPassage !== undefined) {
      const lines = sheetText.trim().split(/\r?\n/);
      const col = lines[0].split(',').indexOf('passage');
      sheetText = [lines[0], ...lines.slice(1).filter((l) => Number(l.split(',')[col]) === s.onlyPassage)].join('\n');
    }
    await compute(text, sheetText, s.scale, s.label, s.clock ?? 'final', !!s.geo);
  } catch (e) { setHead(s.label, 'Could not load', e.message); }
}

async function compute(tableTextIn, sheetText, scale, label, clockModel = 'final', geo = false) {
  if (!markers) { setHead(label, 'Signature not loaded', 'Nothing can be scored. Check the connection and reload.'); return; }
  say('Checking and scoring...');
  await new Promise((r) => setTimeout(r, 20));
  const t0 = performance.now();
  let tableText = tableTextIn;
  let symbolNote = null;
  if (idType(tableText) === 'symbol') {
    const map = JSON.parse(await ungzip(await fetchBuffer('data/symbol_to_ensembl.json.gz')));
    const conv = symbolsToEnsembl(tableText, map);
    if (conv.share >= 0.5) {
      tableText = conv.text;
      symbolNote = { id: 'symbols', status: conv.share >= 0.8 ? 'ok' : 'warn', label: 'Gene symbols converted', detail: `${(100 * conv.share).toFixed(1)}% of gene symbols were matched to Ensembl (release 113 annotation).` };
    }
  }
  const sheet = parseSampleSheet(sheetText);
  if (sheet.error) { renderRefusal({ checks: [{ id: 'samples', status: 'stop', label: 'Sample sheet', detail: sheet.error }] }, label); return; }
  const table = parseTable(tableText, sheet.samples);
  const res = analyze(table, sheet.samples, scale, markers, { allowForecastOnly: true });
  if (symbolNote) res.checks.unshift(symbolNote);
  const drift = res.status === 'REPORT' && clock ? applyClock(table, sheet.samples, clock, clockModel) : null;
  lastFc = res.status !== 'REFUSED' && fcModel ? forecast(table, sheet.samples, fcModel, clockModel) : null;
  last = { res, drift, fc: lastFc, label, scale, when: new Date().toISOString() };
  currentGeo = geo;
  current = res;
  renderRail(res.checks);
  if (res.status === 'REFUSED') renderRefusal(res, label);
  else if (res.status === 'FORECAST_ONLY') renderForecastOnly(res, label, lastFc);
  else renderReport(res, label, drift, lastFc);
  say(`Done in ${((performance.now() - t0) / 1000).toFixed(1)} s, in this browser.`);
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
  $('results').innerHTML = '';
}

function renderForecastOnly(r, label, fc) {
  if (!fc || fc.skipped) { renderRefusal({ checks: [...r.checks, { id: 'forecast', status: 'stop', label: 'Forecast', detail: fc?.skipped ?? 'The forecast model did not load.' }] }, label); return; }
  $('refusal').hidden = true;
  $('timeline').hidden = false;
  r.trends = fc.donors.map((d) => ({ donor: d.donor, points: d.actual.map((a) => ({ id: a.id, passage: a.passage, score: a.score })), first: d.startPassage, last: d.startPassage, slope: 0, rho: NaN, change: 0 }));
  const p10 = fc.donors.map((d) => d.predictAt(10) - d.startScore);
  setHead(label, `Forecast for ${fc.donors.length} donors`, `By passage 10 the signature is forecast to rise by ${signed(p10.reduce((a, b) => a + b, 0) / p10.length)} on average. This is a forecast from one sample, not a measurement.`);
  buildDonorChips(r);
  $('results').innerHTML = `<div class="card wide">${forecastHtml(fc)}</div>`;
  wirePlanner(fc);
  showStage(r, fc, 'forecast');
  $('record').innerHTML = '<h4>What you can do with this</h4><p class="fix">Plan an expansion, then sequence a later passage and load both. The twin will compare the forecast with what you measured.</p>';
}

function showStage(r, fc, view) {
  if (!twin) return;
  const passages = twin.setData(r, fc);
  window.__passages = passages;
  const slider = $('slider');
  slider.min = 0;
  slider.max = Math.max(passages.length - 1, 0);
  slider.value = passages.length - 1;
  slider.oninput = () => { stopPlay(); twin.setPassage(passages[+slider.value]); };
  $('slider-out').textContent = `P${passages[passages.length - 1]}`;
  const params = new URLSearchParams(location.search);
  const asked = params.get('view');
  const want = ['forecast', 'landscape', 'space'].includes(asked) ? asked : view;
  const usable = twin.hasForecast ? want : 'landscape';
  $('v-fore').hidden = !twin.hasForecast;
  $('v-land').hidden = r.status === 'FORECAST_ONLY';
  $('v-space').hidden = r.status === 'FORECAST_ONLY';
  twin.setView(usable);
  setViewButtons(usable);
  const end = r.trends[0].points[r.trends[0].points.length - 1];
  twin.selectById(end.id);
  if (r.status !== 'FORECAST_ONLY' && !matchMedia('(prefers-reduced-motion: reduce)').matches && !params.has('still')) startPlay(true);
}

function forecastHtml(fc) {
  if (!fc) return '<h3>Forecast</h3><p class="note">The forecast model did not load.</p>';
  if (fc.skipped) return `<h3>Forecast</h3><p class="note">Not run. ${esc(fc.skipped)}</p>`;
  const trained = fc.model === 'final' ? 'The model was trained on 8 public cohorts.' : 'For this example, the model was trained without this cohort, so these are genuine held-out forecasts.';
  const compare = fc.tested ? `<p class="note">At each donor's last measured passage, the forecast was closer than assuming no change in <b>${fc.beat} of ${fc.tested}</b> donors.</p>` : '';
  return `<h3>Forecast from the earliest sample <span class="tag">model inference</span></h3>
    <p class="note">${trained} It forecasts the SenCat rank score, a measure of how closely a sample's gene ranks match the signature. Read it as a change from the starting value.</p>
    <div class="planner"><label for="plan-p">If this culture is expanded to passage</label><input type="number" id="plan-p" min="1" max="30" step="1" value="10"></div>
    <div class="table-wrap"><table><thead><tr><th>Donor</th><th>From</th><th class="num">Start</th><th class="num">Forecast</th><th class="num">Change</th>${fc.tested ? '<th class="num">Measured at last passage</th><th class="num">Forecast there</th><th class="num">No-change error</th><th class="num">Forecast error</th>' : ''}</tr></thead><tbody id="plan-rows"></tbody></table></div>
    ${compare}
    <div class="drift-lists"><div><b>Expected to fall with passage</b><span>${esc(fcModel.falling.join(' '))}</span></div><div><b>Expected to rise with passage</b><span>${esc(fcModel.rising.join(' '))}</span></div></div>`;
}

function wirePlanner(fc) {
  if (!fc || fc.skipped || !$('plan-p')) return;
  const draw = () => {
    const p = Number($('plan-p').value);
    $('plan-rows').innerHTML = fc.donors.map((d) => {
      const past = p < d.startPassage;
      const f = past ? NaN : d.predictAt(p);
      return `<tr><td>${esc(d.donor)}</td><td>P${d.startPassage}</td><td class="num">${d.startScore.toFixed(3)}</td><td class="num">${past ? '-' : f.toFixed(3)}</td><td class="num">${past ? '-' : signed(f - d.startScore, 3)}</td>${fc.tested ? (d.errForecast === undefined ? '<td class="num">-</td><td class="num">-</td><td class="num">-</td><td class="num">-</td>' : `<td class="num">P${d.lastPassage}: ${d.lastActual.toFixed(3)}</td><td class="num">${d.lastForecast.toFixed(3)}</td><td class="num">${d.errCarry.toFixed(3)}</td><td class="num">${d.errForecast.toFixed(3)}</td>`) : ''}</tr>`;
    }).join('');
  };
  $('plan-p').addEventListener('input', draw);
  draw();
}

function renderReport(r, label, drift, fc) {
  $('refusal').hidden = true;
  $('timeline').hidden = false;
  const fcLine = fc && !fc.skipped && fc.tested ? ` Forecast from the earliest sample beat assuming no change in ${fc.beat} of ${fc.tested} donors.` : '';
  setHead(label, `Score rose in ${r.donorsRising} of ${r.trends.length} donors`, `Mean slope ${signed(r.meanSlope)} per passage.${fcLine} No pass or fail call is made.`);
  buildDonorChips(r);
  renderDetails(r, drift, fc);
  wirePlanner(fc);
  if (twin) {
    showStage(r, fc, 'forecast');
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

function renderDetails(r, drift, fc) {
  const lo = Math.min(...r.trends.flatMap((t) => t.points.map((p) => p.score)));
  const hi = Math.max(...r.trends.flatMap((t) => t.points.map((p) => p.score)));
  const pad = (hi - lo) * 0.08 || 1;
  const floorNote = r.signFlipP <= r.signFlipFloor + 1e-9 ? ', the smallest possible with this many donors' : '';
  const mdc = guidance?.minimumChange;
  $('results').innerHTML = `
    <div class="card wide">${forecastHtml(fc)}</div>
    <div class="card wide"><h3>Trajectories by donor <span class="tag">model inference on measured expression</span></h3>
      <div class="panels">${r.trends.map((t) => `<div class="panel"><h4>Donor ${esc(t.donor)}</h4><small>${signed(t.slope)} per passage</small>${donorPanel(t, lo - pad, hi + pad)}</div>`).join('')}</div>
      <p class="note">Exact sign-flip p = ${r.signFlipP.toFixed(4)}${floorNote}.</p>
      <details><summary>Show the table</summary><div class="table-wrap"><table><thead><tr><th>Donor</th><th>Passages</th><th class="num">Points</th><th class="num">Slope per passage</th><th class="num">Last minus first</th><th class="num">Spearman rho</th></tr></thead><tbody>
      ${r.trends.map((t) => `<tr><td>${esc(t.donor)}</td><td>${t.first} to ${t.last}</td><td class="num">${t.points.length}</td><td class="num">${t.slope.toFixed(2)}</td><td class="num">${t.change.toFixed(2)}</td><td class="num">${t.rho.toFixed(2)}</td></tr>`).join('')}
      </tbody></table></div></details></div>
    <div class="card"><h3>Could a random signature do this?</h3>${histogram(r.random.draws, r.meanSlope)}
      <p class="note">${r.random.n} random gene sets of the same size and weights: mean ${r.random.mean.toFixed(3)}, SD ${r.random.sd.toFixed(3)}. This signature sits at z = ${r.random.z.toFixed(1)}, empirical p = ${r.random.p.toFixed(3)}, a figure limited by the number of draws.</p></div>
    <div class="card">${driftHtml(drift)}</div>
    <div class="card wide"><h3>How to read this</h3><ul class="reading">
      <li>Read each donor against itself. Absolute scores aren't comparable across labs or media.</li>
      ${mdc ? `<li>${esc(mdc)}</li>` : ''}
      <li>A forecast isn't a measurement, and a rising score doesn't mean a lot has failed.</li></ul>
      <div class="actions"><button type="button" class="secondary" id="dl-csv">Scores (.csv)</button><button type="button" class="secondary" id="dl">Full report (.json)</button><button type="button" class="secondary" id="print">Print or save as PDF</button></div></div>`;
  $('dl').onclick = download;
  $('dl-csv').onclick = downloadCsv;
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

function saveFile(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function downloadCsv() {
  const { res, drift } = last;
  const rows = ['donor,passage,sample_id,sencat_score,change_since_first_passage,drift_clock'];
  for (const t of res.trends) for (const p of t.points) rows.push([t.donor, p.passage, p.id, p.score.toFixed(4), (p.score - t.points[0].score).toFixed(4), drift?.scores?.[p.id]?.toFixed(4) ?? ''].join(','));
  saveFile('senguard_msc_scores.csv', `${rows.join('\n')}\n`, 'text/csv');
}

function download() {
  const { res, drift, fc, label, scale, when } = last;
  const copy = { tool: 'SenGuard-MSC, for research use', label, scale, when, signature: signatureInfo, status: res.status, forecast: fc && !fc.skipped ? { model: fc.model, beat: fc.beat, tested: fc.tested, donors: fc.donors.map(({ predictAt, ...d }) => d) } : null, driftClock: drift && !drift.skipped ? { model: drift.model, trends: drift.trends } : null, checks: res.checks, trends: res.trends, scores: res.scores, records: res.records, stateSpace: res.state, meanSlope: res.meanSlope, donorsRising: res.donorsRising, signFlipP: res.signFlipP, random: { ...res.random, draws: undefined }, disclaimer: 'Not a release test. Says nothing about potency, immune function or clinical safety.' };
  saveFile('senguard_msc_report.json', JSON.stringify(copy, null, 1), 'application/json');
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
  $('v-fore').setAttribute('aria-pressed', String(view === 'forecast'));
  $('v-land').setAttribute('aria-pressed', String(view === 'landscape'));
  $('v-space').setAttribute('aria-pressed', String(view === 'space'));
  $('view-note').textContent = VIEW_NOTES[view];
}

let uploaded = null;
$('f-table').addEventListener('change', async () => {
  const f = $('f-table').files[0];
  if (!f) return;
  try {
    uploaded = await ungzip(await f.arrayBuffer());
    const { header, rows, clean } = parseDelimited(uploaded.slice(0, 200000));
    const guess = guessSheet(header, rows[0]?.map(clean));
    $('sheet-rows').innerHTML = guess.map((g, i) => `<tr><td><input type="checkbox" id="s-use-${i}" checked aria-label="Use ${esc(g.id)}"></td><td class="name">${esc(g.id)}</td><td><input type="text" id="s-donor-${i}" value="${esc(g.donor)}" aria-label="Donor for ${esc(g.id)}"></td><td><input type="number" min="0" step="any" id="s-pass-${i}" value="${g.passage}" aria-label="Passage for ${esc(g.id)}"></td></tr>`).join('');
    $('sheet-rows').dataset.ids = JSON.stringify(guess.map((g) => g.id));
    const filled = guess.filter((g) => g.donor !== '').length;
    $('sheet-note').textContent = `${guess.length} sample columns found; filled in ${filled} from their names. Check them, and fill in the rest.`;
    $('sheet-box').hidden = false;
  } catch (err) { setHead('Your data', 'Could not read this table', err.message); }
});
function sheetFromForm() {
  const ids = JSON.parse($('sheet-rows').dataset.ids ?? '[]');
  const rows = [];
  const gaps = [];
  ids.forEach((id, i) => {
    if (!$(`s-use-${i}`).checked) return;
    const donor = $(`s-donor-${i}`).value.trim(), passage = $(`s-pass-${i}`).value.trim();
    if (!donor || passage === '') gaps.push(id);
    rows.push(`${id},${donor.replace(/,/g, ' ')},${passage}`);
  });
  return { text: `sample_id,donor,passage\n${rows.join('\n')}`, gaps };
}
$('upload').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    if (!uploaded) uploaded = await ungzip(await $('f-table').files[0].arrayBuffer());
    let sheet;
    if ($('f-sheet').files[0]) sheet = await ungzip(await $('f-sheet').files[0].arrayBuffer());
    else {
      const built = sheetFromForm();
      if (built.gaps.length) { setHead('Your data', 'A few samples need details', `Add a donor and passage for ${built.gaps.slice(0, 3).join(', ')}${built.gaps.length > 3 ? ` and ${built.gaps.length - 3} more` : ''}, or untick them.`); return; }
      sheet = built.text;
    }
    await compute(uploaded, sheet, $('f-scale').value, $('f-table').files[0].name, 'final', false);
  } catch (err) { setHead('Your data', 'Could not read these files', err.message); }
});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
document.querySelectorAll('.scenario').forEach((b) => b.addEventListener('click', () => runScenario(b.dataset.scenario)));
$('v-fore').addEventListener('click', () => { twin?.setView('forecast'); setViewButtons('forecast'); });
$('v-land').addEventListener('click', () => { twin?.setView('landscape'); setViewButtons('landscape'); });
$('v-space').addEventListener('click', () => { twin?.setView('space'); setViewButtons('space'); });
$('play').addEventListener('click', () => (timer ? stopPlay() : startPlay()));
tooltipLayer($('tip'));

function renderHero(ev) {
  const { ok } = ev.headline;
  $('hero-stats').innerHTML = [
    [`${ok.donors_rising}/${ok.donors}`, 'donors in new cohorts with a rising score'],
    [`${ev.facts.testBeat}/${ev.facts.testN}`, 'never-used donors where the forecast beat assuming no change'],
    ['8', 'input checks before any number appears'],
  ].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
}

(async () => {
  try {
    const { CultureTwin, webglAvailable } = await import('./twin.js');
    if (webglAvailable()) {
      twin = new CultureTwin($('canvas'), { onSelect: (p) => showRecord(p), onPassage: (p) => { $('slider-out').textContent = `P${p}`; } });
      window.__twin = twin;
    } else $('no-webgl').hidden = false;
  } catch (e) { $('no-webgl').hidden = false; console.error(e); }
  try {
    const ev = await (await fetch('data/evidence.json')).json();
    guidance = ev.guidance ?? null;
    renderHero(ev);
    renderEvidence($('evidence-body'), ev);
    clock = await (await fetch('data/clock.json')).json();
    fcModel = await (await fetch('data/forecast.json')).json();
  } catch (e) { $('evidence-body').innerHTML = `<p class="status">Could not load the evidence summary: ${esc(e.message)}</p>`; }
  try {
    await loadSignature();
    const asked = new URLSearchParams(location.search).get('demo');
    await runScenario(asked && (SCENARIOS[asked] || asked === 'upload') ? asked : 'adipose');
  } catch (e) { setHead('Signature', 'Could not load', `Nothing can be scored: ${e.message}`); }
})();
