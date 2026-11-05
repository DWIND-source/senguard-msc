import { renderAtlas, selectAtlasSample, forecastChart, slopeChart } from './atlas.js';
import { analyze, applyClock, forecast, guessSheet, idType, parseDelimited, parseSampleSheet, parseTable, symbolsToEnsembl } from './core.js';
import { donorPanel, histogram, tooltipLayer } from './charts.js';
import { renderEvidence } from './evidence.js';
import { t } from './i18n.js';
import { donorFlag, flagChip, readingLine, renderImmune, renderPanel, renderProcess, FIXED_FLAG_NOTE } from './insights.js';

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
  forecast: () => t('Orange is the forecast from each donor\'s earliest sample. Blue spheres are what was measured. Press play to reveal them.', 'Màu cam là dự báo từ mẫu sớm nhất của mỗi người hiến. Quả cầu xanh là giá trị thực đo. Bấm phát để hiện dần.'),
  landscape: () => t('Each sphere is a measured sample. Height is its SenCat score, and each lane is one donor. Drag to rotate; click a sphere.', 'Mỗi quả cầu là một mẫu thực đo. Độ cao là điểm SenCat, mỗi làn là một người hiến. Kéo để xoay; bấm vào quả cầu để xem.'),
  space: () => t('The same samples, placed by their measured expression (PCA of the 500 most variable genes). Lines join each donor in passage order.', 'Cùng các mẫu đó, xếp theo biểu hiện gene thực đo (PCA của 500 gene biến thiên nhiều nhất). Đường nối các mẫu cùng người hiến theo thứ tự passage.'),
};
let currentView = 'forecast', lastRender = null, evidence = null, insights = null, panel = null;
const CHECK_SHORT = { samples: 'Samples', ids: 'Gene ids', dups: 'Duplicates', numeric: 'Numeric', negative: 'Untransformed', logged: 'Untransformed', scale: 'Scale', coverage: 'Coverage', depth: 'Depth', identity: 'Identity', design: 'Design' };
const ICON = { ok: '✓', warn: '!', stop: '✕' };

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const say = (msg) => { $('status').textContent = msg; };
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
    setHead(t('Your data', 'Dữ liệu của bạn'), t('Choose two files', 'Chọn hai tệp'), t('They are read in this browser and never uploaded.', 'Tệp được đọc ngay trong trình duyệt và không bao giờ được tải lên.'));
    $('reading-line').textContent = '';
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
  lastRender = { res, label, drift, fc: lastFc };
  renderCurrent(true);
  say(t(`Done in ${((performance.now() - t0) / 1000).toFixed(1)} s, in this browser.`, `Xong trong ${((performance.now() - t0) / 1000).toFixed(1)} giây, ngay trong trình duyệt.`));
}

function renderCurrent(withStage) {
  if (!lastRender) return;
  const { res, label, drift, fc } = lastRender;
  if (res.status === 'REFUSED') renderRefusal(res, label);
  else if (res.status === 'FORECAST_ONLY') renderForecastOnly(res, label, fc, withStage);
  else renderReport(res, label, drift, fc, withStage);
}

const mdc = () => evidence?.facts?.mdc ?? NaN;

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
  if (first >= 0) show(first); else $('rail-detail').textContent = t(`All ${items.length} checks passed.`, `Đạt cả ${items.length} bước kiểm tra.`);
}

function renderRefusal(res, label) {
  const stops = res.checks.filter((c) => c.status === 'stop');
  if (!current || current !== res) renderRail(res.checks);
  $('refusal').hidden = false;
  $('timeline').hidden = true;
  $('view-note').textContent = '';
  $('refusal-title').textContent = t(`Not scored: ${stops[0]?.label ?? 'input'}`, `Không chấm điểm: ${stops[0]?.label ?? 'dữ liệu'}`);
  $('refusal-body').textContent = stops[0]?.detail ?? '';
  twin?.clear();
  setHead(label, t('Refused', 'Từ chối'), t(`${stops.length} of ${res.checks.length} checks stopped this input.`, `${stops.length}/${res.checks.length} bước kiểm tra đã chặn dữ liệu này.`));
  $('donors').innerHTML = '';
  $('reading-line').textContent = '';
  $('record').innerHTML = `<h4>${t('What to fix', 'Cần sửa gì')}</h4>${stops.map((c) => `<p class="fix"><b>${esc(c.label)}</b>${esc(c.detail)}</p>`).join('')}<small>${t('Correct the input and run it again. Nothing was scored, so there is no partial result to reuse.', 'Sửa dữ liệu rồi chạy lại. Chưa có gì được chấm điểm nên không có kết quả dở dang để dùng lại.')}</small>`;
  $('results').innerHTML = '';
}

function renderForecastOnly(r, label, fc, withStage = true) {
  if (!fc || fc.skipped) { renderRefusal({ checks: [...r.checks, { id: 'forecast', status: 'stop', label: 'Forecast', detail: fc?.skipped ?? 'The forecast model did not load.' }] }, label); return; }
  $('refusal').hidden = true;
  $('timeline').hidden = false;
  r.trends = fc.donors.map((d) => ({ donor: d.donor, points: d.actual.map((a) => ({ id: a.id, passage: a.passage, score: a.score })), first: d.startPassage, last: d.startPassage, slope: 0, rho: NaN, change: 0 }));
  const p10 = fc.donors.map((d) => d.predictAt(10) - d.startScore);
  const mean10 = signed(p10.reduce((a, b) => a + b, 0) / p10.length);
  setHead(label, t(`Forecast for ${fc.donors.length} donors`, `Dự báo cho ${fc.donors.length} người hiến`), t(`By passage 10 the signature is forecast to rise by ${mean10} on average. This is a forecast from one sample, not a measurement.`, `Đến passage 10, chữ ký được dự báo tăng trung bình ${mean10}. Đây là dự báo từ một mẫu, không phải số đo.`));
  buildDonorChips(r);
  $('results').innerHTML = `<div class="card wide">${forecastHtml(fc)}</div>`;
  wirePlanner(fc);
  if (withStage) showStage(r, fc, 'forecast');
  $('reading-line').innerHTML = `${flagChip(donorFlag(null, mdc()))} ${t('Each donor has one sample, so the donor flag cannot be assessed. The forecast uses a different scale and is not flagged.', 'Mỗi người hiến chỉ có một mẫu nên không đánh giá được cờ. Dự báo dùng thang đo khác và không gắn cờ.')}`;
  $('record').innerHTML = `<h4>${t('What you can do with this', 'Bạn có thể làm gì với kết quả này')}</h4><p class="fix">${t('Plan an expansion, then sequence a later passage and load both. The twin will compare the forecast with what you measured.', 'Lên kế hoạch nhân rộng, sau đó giải trình tự một passage sau và tải cả hai. Mô phỏng sẽ so dự báo với số đo thực.')}</p>`;
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
  if (fc.skipped) return `<h3>${t('Forecast', 'Dự báo')}</h3><p class="note">${t('Not run.', 'Không chạy.')} ${esc(fc.skipped)}</p>`;
  const trained = fc.model === 'final' ? t('The model was trained on 8 public cohorts.', 'Mô hình được huấn luyện trên 8 cohort công khai.') : t('For this example, the model was trained without this cohort, so these are genuine held-out forecasts.', 'Với ví dụ này, mô hình được huấn luyện không dùng cohort này, nên đây là dự báo thật trên dữ liệu chưa thấy.');
  const compare = fc.tested ? `<p class="note">${t(`At each donor's last measured passage, the forecast was closer than assuming no change in <b>${fc.beat} of ${fc.tested}</b> donors.`, `Tại passage đo cuối của mỗi người hiến, dự báo sát hơn giả định "không đổi" ở <b>${fc.beat}/${fc.tested}</b> người hiến.`)}</p>` : '';
  return `<h3>${t('Forecast from the earliest sample', 'Dự báo từ mẫu sớm nhất')} <span class="tag">${t('model inference', 'suy luận mô hình')}</span></h3>
    <p class="note">${trained} ${t("It forecasts the SenCat rank score, a measure of how closely a sample's gene ranks match the signature. Read it as a change from the starting value. This rank score is on a different scale from the measured SenCat score, so the donor flags do not apply to it.", 'Mô hình dự báo điểm hạng SenCat (rank score), đo mức thứ hạng gene của mẫu khớp với chữ ký. Hãy đọc như mức thay đổi so với giá trị ban đầu. Điểm hạng có thang khác với điểm SenCat thực đo, nên cờ theo người hiến không áp dụng.')}</p>
    <div class="planner"><label for="plan-p">${t('If this culture is expanded to passage', 'Nếu mẻ nuôi cấy được nhân rộng đến passage')}</label><input type="number" id="plan-p" min="1" max="30" step="1" value="10"></div>
    <div id="forecast-chart"></div>
    <details><summary>${t('Exact values and validation details', 'Giá trị chi tiết và kiểm chứng')}</summary><div class="table-wrap"><table><thead><tr><th>${t('Donor', 'Người hiến')}</th><th>${t('From', 'Từ')}</th><th class="num">${t('Start', 'Ban đầu')}</th><th class="num">${t('Forecast', 'Dự báo')}</th><th class="num">${t('Change', 'Thay đổi')}</th>${fc.tested ? `<th class="num">${t('Measured at last passage', 'Thực đo ở passage cuối')}</th><th class="num">${t('Forecast there', 'Dự báo tại đó')}</th><th class="num">${t('No-change error', 'Sai số "không đổi"')}</th><th class="num">${t('Forecast error', 'Sai số dự báo')}</th>` : ''}</tr></thead><tbody id="plan-rows"></tbody></table></div>
    ${compare}</details>
    <div class="drift-lists"><div><b>${t('Expected to fall with passage', 'Dự kiến giảm theo passage')}</b><span>${esc(fcModel.falling.join(' '))}</span></div><div><b>${t('Expected to rise with passage', 'Dự kiến tăng theo passage')}</b><span>${esc(fcModel.rising.join(' '))}</span></div></div>`;
}

function wirePlanner(fc) {
  if (!fc || fc.skipped || !$('plan-p')) return;
  const draw = () => {
    const p = Number($('plan-p').value);
    if (!Number.isFinite(p) || p < 1 || p > 30) return;
    $('forecast-chart').innerHTML = forecastChart(fc, p);
    $('plan-rows').innerHTML = fc.donors.map((d) => {
      const past = p < d.startPassage;
      const f = past ? NaN : d.predictAt(p);
      return `<tr><td>${esc(d.donor)}</td><td>P${d.startPassage}</td><td class="num">${d.startScore.toFixed(3)}</td><td class="num">${past ? '-' : f.toFixed(3)}</td><td class="num">${past ? '-' : signed(f - d.startScore, 3)}</td>${fc.tested ? (d.errForecast === undefined ? '<td class="num">-</td><td class="num">-</td><td class="num">-</td><td class="num">-</td>' : `<td class="num">P${d.lastPassage}: ${d.lastActual.toFixed(3)}</td><td class="num">${d.lastForecast.toFixed(3)}</td><td class="num">${d.errCarry.toFixed(3)}</td><td class="num">${d.errForecast.toFixed(3)}</td>`) : ''}</tr>`;
    }).join('');
  };
  $('plan-p').addEventListener('input', draw);
  draw();
}

function renderReport(r, label, drift, fc, withStage = true) {
  $('refusal').hidden = true;
  $('timeline').hidden = false;
  const fcLine = fc && !fc.skipped && fc.tested ? t(` Forecast from the earliest sample beat assuming no change in ${fc.beat} of ${fc.tested} donors.`, ` Dự báo từ mẫu sớm nhất sát hơn giả định "không đổi" ở ${fc.beat}/${fc.tested} người hiến.`) : '';
  setHead(label, t(`Score rose in ${r.donorsRising} of ${r.trends.length} donors`, `Điểm tăng ở ${r.donorsRising}/${r.trends.length} người hiến`), t(`Mean slope ${signed(r.meanSlope)} per passage.`, `Độ dốc trung bình ${signed(r.meanSlope)} mỗi passage.`) + fcLine);
  buildDonorChips(r);
  renderDetails(r, drift, fc);
  renderAtlas($('expression-atlas'), r, (sample) => {
    if (twin) twin.selectById(sample.id);
    else showRecord({ ...sample, score: r.scores[sample.id] });
  });
  wirePlanner(fc);
  const lastPoint = { ...r.trends[0].points[r.trends[0].points.length - 1], donor: r.trends[0].donor };
  if (twin && withStage) showStage(r, fc, 'forecast');
  else if (twin) { twin.selectById(lastPoint.id); setViewButtons(currentView); }
  else if (r.trends.length) showRecord(lastPoint);
}

// Donors that were loaded but have too few passages to compare with their earliest sample.
function unassessed(r) {
  const seen = new Set(r.trends.map((x) => x.donor));
  return [...new Set((r.sampleMeta ?? []).map((s) => s.donor))].filter((d) => !seen.has(d));
}

function showReading(donor) {
  const tr = current?.trends?.find((x) => x.donor === donor);
  const el = $('reading-line');
  if (!tr || current.status === 'FORECAST_ONLY') return;
  el.innerHTML = `${flagChip(donorFlag(tr.points, mdc()))} ${esc(readingLine(donor, tr.points, tr.rho, mdc()))} <small>${esc(FIXED_FLAG_NOTE())}</small>`;
}

function buildDonorChips(r) {
  const box = $('donors');
  box.innerHTML = `<button type="button" aria-pressed="true" data-d="">${t('All', 'Tất cả')}</button>${r.trends.map((tr) => `<button type="button" aria-pressed="false" data-d="${esc(tr.donor)}">${esc(tr.donor)}</button>`).join('')}`;
  box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const d = b.dataset.d || null;
    twin?.setFocus(d);
    if (d) {
      const tr = r.trends.find((x) => x.donor === d);
      twin ? twin.selectById(tr.points[tr.points.length - 1].id) : showRecord({ ...tr.points[tr.points.length - 1], donor: d });
    }
  }));
}

function showRecord(p) {
  if (!p || !current?.records) { $('record').innerHTML = ''; return; }
  const rec = current.records[p.id];
  if (!rec) return;
  selectAtlasSample(p.id);
  const tr = current.trends.find((x) => x.donor === p.donor);
  const base = tr?.points[0];
  const change = base ? p.score - base.score : 0;
  const maxV = Math.max(1, ...Object.values(current.records).flatMap((x) => Object.values(x.genes).filter(Number.isFinite)));
  const genes = Object.entries(rec.genes).filter(([, v]) => Number.isFinite(v)).slice(0, 7);
  const baseRec = base ? current.records[base.id] : null;
  const link = currentGeo && /^GSM/.test(p.id) ? `<a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${esc(p.id)}">${esc(p.id)}</a>` : `<span style="font:500 12.5px var(--mono)">${esc(p.id)}</span>`;
  $('record').innerHTML = `<h4>${t('Sample record', 'Hồ sơ mẫu')}</h4>${link}
    <div class="meta">
      <div><b>${esc(p.donor)}</b><span>${t('Donor', 'Người hiến')}</span></div><div><b>P${p.passage}</b><span>Passage</span></div>
      <div><b>${p.score.toFixed(2)}</b><span>${t('SenCat score', 'Điểm SenCat')}</span></div><div><b>${signed(change)}</b><span>${t('Since', 'Từ')} P${base?.passage}</span></div>
    </div>
    <div class="genes" role="list" aria-label="Measured transcripts">${genes.map(([g, v]) => { const d = baseRec ? v - baseRec.genes[g] : 0; return `<span role="listitem">${g}</span><span class="bar"><i style="width:${(100 * v) / maxV}%"></i></span><span class="n">${v.toFixed(1)} ${d >= 0.05 ? '↑' : d <= -0.05 ? '↓' : '·'}</span>`; }).join('')}</div>
    <small>${t("Measured transcripts, log1p scale. Arrows compare with this donor's first passage. Score is model inference.", 'Biểu hiện gene thực đo, thang log1p. Mũi tên so với passage đầu của người hiến này. Điểm số là suy luận mô hình.')}</small>`;
  showReading(p.donor);
}

function renderDetails(r, drift, fc) {
  const lo = Math.min(...r.trends.flatMap((t) => t.points.map((p) => p.score)));
  const hi = Math.max(...r.trends.flatMap((t) => t.points.map((p) => p.score)));
  const pad = (hi - lo) * 0.08 || 1;
  const floorNote = r.signFlipP <= r.signFlipFloor + 1e-9 ? t(', the smallest possible with this many donors', ', mức nhỏ nhất có thể với số người hiến này') : '';
  const minChange = guidance?.minimumChange;
  const missing = unassessed(r);
  $('results').innerHTML = `
    <div id="expression-atlas" class="atlas-wide"></div>
    <div class="card wide">${forecastHtml(fc)}</div>
    <div class="card wide"><h3>${t('Trajectories by donor', 'Diễn biến theo người hiến')} <span class="tag">${t('model inference on measured expression', 'suy luận mô hình trên biểu hiện thực đo')}</span></h3>
      <p class="note">${t('Each donor is compared with its own earliest sample. ', 'Mỗi người hiến được so với mẫu sớm nhất của chính mình. ')}<b>${esc(FIXED_FLAG_NOTE())}</b></p>
      <div class="panels">${r.trends.map((tr) => `<div class="panel"><h4>${t('Donor', 'Người hiến')} ${esc(tr.donor)}</h4><small>${signed(tr.slope)} ${t('per passage', 'mỗi passage')}</small> ${flagChip(donorFlag(tr.points, mdc()))}${donorPanel(tr, lo - pad, hi + pad)}<p class="panel-read">${esc(readingLine(tr.donor, tr.points, tr.rho, mdc()))}</p></div>`).join('')}
        ${missing.map((d) => `<div class="panel"><h4>${t('Donor', 'Người hiến')} ${esc(d)}</h4>${flagChip(donorFlag(null, mdc()))}<p class="panel-read">${t('Only one passage was loaded for this donor.', 'Chỉ có một passage được tải cho người hiến này.')}</p></div>`).join('')}</div>
      <details><summary>${t('Statistical details', 'Chi tiết thống kê')}</summary><p class="note">${t('Exact sign-flip', 'Kiểm định sign-flip chính xác')} p = ${r.signFlipP.toFixed(4)}${floorNote}.</p></details>
      <details><summary>${t('Show the table', 'Xem bảng')}</summary><div class="table-wrap"><table><thead><tr><th>${t('Donor', 'Người hiến')}</th><th>Passages</th><th class="num">${t('Points', 'Số điểm')}</th><th class="num">${t('Slope per passage', 'Độ dốc mỗi passage')}</th><th class="num">${t('Last minus first', 'Cuối trừ đầu')}</th><th class="num">Spearman rho</th></tr></thead><tbody>
      ${r.trends.map((tr) => `<tr><td>${esc(tr.donor)}</td><td>${tr.first} ${t('to', 'đến')} ${tr.last}</td><td class="num">${tr.points.length}</td><td class="num">${tr.slope.toFixed(2)}</td><td class="num">${tr.change.toFixed(2)}</td><td class="num">${tr.rho.toFixed(2)}</td></tr>`).join('')}
      </tbody></table></div></details></div>
    <div class="card"><h3>${t('Could a random signature do this?', 'Một chữ ký ngẫu nhiên có làm được vậy không?')}</h3>${histogram(r.random.draws, r.meanSlope)}
      <details><summary>${t('Comparison statistics', 'Thống kê so sánh')}</summary><p class="note">${r.random.n} random gene sets of the same size and weights: mean ${r.random.mean.toFixed(3)}, SD ${r.random.sd.toFixed(3)}. This signature sits at z = ${r.random.z.toFixed(1)}, empirical p = ${r.random.p.toFixed(3)}, a figure limited by the number of draws.</p></details></div>
    <div class="card">${driftHtml(drift)}</div>
    <div class="card wide"><details><summary>${t('Methods and interpretation', 'Phương pháp và cách đọc')}</summary><ul class="reading">
      <li>${t("Read each donor against itself. Absolute scores aren't comparable across labs or media.", 'Đọc mỗi người hiến so với chính mình. Điểm tuyệt đối không so được giữa các lab hay môi trường.')}</li>
      ${minChange ? `<li>${t(esc(minChange), `Ở các mẫu được giải trình tự lại, điểm chênh ${evidence.facts.retestA} và ${evidence.facts.retestB}, nên coi thay đổi dưới khoảng ${mdc()} có thể là do kỹ thuật. Con số này chỉ dựa trên hai cặp mẫu của một cohort.`)}</li>` : ''}
      <li>${t("A forecast isn't a measurement, and a rising score doesn't mean a lot has failed.", 'Dự báo không phải số đo, và điểm tăng không có nghĩa lô đã hỏng.')}</li></ul></details>
      <div class="actions"><button type="button" class="secondary" id="dl-csv">${t('Scores (.csv)', 'Điểm số (.csv)')}</button><button type="button" class="secondary" id="dl">${t('Full report (.json)', 'Báo cáo đầy đủ (.json)')}</button><button type="button" class="secondary" id="print">${t('Print or save as PDF', 'In hoặc lưu PDF')}</button></div></div>`;
  $('dl').onclick = download;
  $('dl-csv').onclick = downloadCsv;
  $('print').onclick = () => window.print();
}

function driftHtml(d) {
  const title = t('Culture-drift clock', 'Đồng hồ trôi nuôi cấy');
  if (!d) return `<h3>${title}</h3><p class="note">${t('Not available.', 'Không có.')}</p>`;
  if (d.skipped) return `<h3>${title}</h3><p class="note">${t('Not run.', 'Không chạy.')} ${esc(d.skipped)}</p>`;
  const trained = d.model === 'final' ? t('The model was trained on the public cohorts listed under Evidence.', 'Mô hình được huấn luyện trên các cohort công khai liệt kê ở mục Kiểm chứng.') : t('For this example, the model was trained without this cohort.', 'Với ví dụ này, mô hình được huấn luyện không dùng cohort này.');
  return `<h3>${title} <span class="tag">${d.model === 'final' ? t('trained model', 'mô hình đã huấn luyện') : t('trained model, cohort held out', 'mô hình đã huấn luyện, giữ riêng cohort')}</span></h3>
    ${slopeChart(d.trends)}<details><summary>${t('Clock values and methods', 'Giá trị và phương pháp')}</summary><p class="note">${trained} ${t('It estimates passage-like drift.', 'Nó ước tính mức trôi tương đương passage.')}</p>
    <div class="table-wrap"><table><thead><tr><th>${t('Donor', 'Người hiến')}</th><th class="num">${t('Slope per passage', 'Độ dốc mỗi passage')}</th><th class="num">Spearman rho</th></tr></thead><tbody>
    ${d.trends.map((tr) => `<tr><td>${esc(tr.donor)}</td><td class="num">${tr.slope.toFixed(3)}</td><td class="num">${tr.rho.toFixed(2)}</td></tr>`).join('')}</tbody></table></div></details>`;
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
  for (const tr of res.trends) for (const p of tr.points) rows.push([tr.donor, p.passage, p.id, p.score.toFixed(4), (p.score - tr.points[0].score).toFixed(4), drift?.scores?.[p.id]?.toFixed(4) ?? ''].join(','));
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
  currentView = view;
  $('v-fore').setAttribute('aria-pressed', String(view === 'forecast'));
  $('v-land').setAttribute('aria-pressed', String(view === 'landscape'));
  $('v-space').setAttribute('aria-pressed', String(view === 'space'));
  $('view-note').textContent = VIEW_NOTES[view]();
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
    $('sheet-note').textContent = t(`${guess.length} sample columns found; filled in ${filled} from their names. Check them, and fill in the rest.`, `Tìm thấy ${guess.length} cột mẫu; đã điền ${filled} cột từ tên cột. Hãy kiểm tra và điền phần còn lại.`);
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
      if (built.gaps.length) { const few = built.gaps.slice(0, 3).join(', '), more = built.gaps.length - 3; setHead(t('Your data', 'Dữ liệu của bạn'), t('A few samples need details', 'Một vài mẫu cần thêm thông tin'), t(`Add a donor and passage for ${few}${more > 0 ? ` and ${more} more` : ''}, or untick them.`, `Thêm người hiến và passage cho ${few}${more > 0 ? ` và ${more} mẫu khác` : ''}, hoặc bỏ chọn chúng.`)); return; }
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
    [`${ok.donors_rising}/${ok.donors}`, t('donors in new cohorts with a rising score', 'người hiến ở cohort mới có điểm tăng')],
    [`${ev.facts.testBeat}/${ev.facts.testN}`, t('never-used donors where the forecast beat assuming no change', 'người hiến chưa từng dùng, dự báo sát hơn giả định "không đổi"')],
    ['8', t('input checks before any number appears', 'bước kiểm tra dữ liệu trước khi hiện bất kỳ con số nào')],
  ].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
}

function renderSections() {
  if (evidence) { renderHero(evidence); renderEvidence($('evidence-body'), evidence); renderImmune($('immune-body'), evidence); }
  if (insights) renderProcess($('process-body'), insights, evidence);
  if (panel) renderPanel($('panel-body'), panel);
}

document.addEventListener('langchange', () => {
  renderSections();
  if (lastRender) renderRail(lastRender.res.checks);
  renderCurrent(false);
  if (!lastRender && document.querySelector('.scenario[aria-pressed="true"]')?.dataset.scenario === 'upload') runScenario('upload');
});

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
    evidence = ev;
    guidance = ev.guidance ?? null;
    [insights, panel] = await Promise.all([fetch('data/insights.json').then((r) => r.json()), fetch('data/panel.json').then((r) => r.json())]);
    renderSections();
    clock = await (await fetch('data/clock.json')).json();
    fcModel = await (await fetch('data/forecast.json')).json();
  } catch (e) { $('evidence-body').innerHTML = `<p class="status">Could not load the evidence summary: ${esc(e.message)}</p>`; }
  try {
    await loadSignature();
    const asked = new URLSearchParams(location.search).get('demo');
    await runScenario(asked && (SCENARIOS[asked] || asked === 'upload') ? asked : 'adipose');
  } catch (e) { setHead('Signature', 'Could not load', `Nothing can be scored: ${e.message}`); }
})();
