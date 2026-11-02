// All panels are derived from the same measured, normalized sample records.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PALETTE = ['#238b8d', '#ef8354', '#7274b5', '#cc5092', '#b59a30', '#4f91cb', '#65944a', '#9c6451'];
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const finite = Number.isFinite;
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
export function heatColor(z) {
  if (!finite(z)) return '#e5e7eb';
  const mid = [249, 247, 242];
  return mix(mid, z < 0 ? [49, 91, 160] : [188, 49, 66], Math.min(1, Math.abs(z) / 2.5));
}
const passageColor = (p, lo, hi) => mix([240, 192, 73], [126, 48, 121], (p - lo) / (hi - lo || 1));
const ticks = (lo, hi, n = 4) => Array.from({length:n+1}, (_, i) => lo + (hi-lo)*i/n);
const fmt = (v) => Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
const shell = (w, h, label, content) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${content}</svg>`;

export function atlasData(report) {
  const samples = (report.sampleMeta ?? report.trends.flatMap((d) => d.points.map((p) => ({...p, donor:d.donor})))).map((s) => ({...s, genes:report.records[s.id]?.genes ?? {}}));
  const genes = [...new Set(samples.flatMap((s) => Object.keys(s.genes)))];
  const stats = Object.fromEntries(genes.map((g) => {
    const values = samples.map((s) => s.genes[g]).filter(finite), m = mean(values);
    return [g, {mean:m, sd:Math.sqrt(mean(values.map((v) => (v-m)**2)))}];
  }));
  const z = (g, value) => !finite(value) ? null : stats[g].sd > 1e-12 ? (value-stats[g].mean)/stats[g].sd : 0;
  return {samples, genes, stats, z};
}

export function selectAtlasSample(id) {
  const root = document.getElementById('expression-atlas');
  if (root) root.dataset.selectedSample = id;
  const status = document.getElementById('atlas-selection');
  const point = [...document.querySelectorAll('#atlas-pca .atlas-point')].find((el) => el.dataset.sample === id);
  if (status) status.textContent = `Selected: ${point?.getAttribute('aria-label') ?? id}`;
  document.querySelectorAll('#expression-atlas [data-sample]').forEach((el) => el.classList.toggle('atlas-selected', el.dataset.sample === id));
}

function heatmap(data, samples, genes, selected) {
  const L=93, T=55, cw=25, rh=20, W=Math.max(560,L+samples.length*cw+12), H=T+genes.length*rh+85;
  const lo=Math.min(...samples.map((s)=>s.passage)), hi=Math.max(...samples.map((s)=>s.passage));
  const body=genes.map((g, row) => `<text x="${L-10}" y="${T+row*rh+14}" text-anchor="end" class="atlas-gene ${g===selected?'active':''}" data-gene="${esc(g)}" role="button" tabindex="0" aria-label="Plot ${esc(g)}">${esc(g)}</text>` + samples.map((s,col)=>{
    const v=s.genes[g], z=data.z(g,v), tip=`${g} · ${s.id} · donor ${s.donor} · P${s.passage}\nlog1p expression: ${finite(v)?v.toFixed(3):'missing'} · row z-score: ${z===null?'missing':z.toFixed(2)}`;
    return `<rect x="${L+col*cw}" y="${T+row*rh}" width="${cw-1}" height="${rh-1}" fill="${heatColor(z)}" data-tip="${esc(tip)}" data-sample="${esc(s.id)}" data-gene="${esc(g)}"><title>${esc(tip)}</title></rect>`;
  }).join('')).join('');
  return shell(W,H,'Gene expression heatmap: rows are genes, columns are measured samples',`
    <text x="${L-10}" y="25" text-anchor="end">Passage</text>
    ${samples.map((s,i)=>`<rect x="${L+i*cw}" y="13" width="${cw-1}" height="23" fill="${passageColor(s.passage,lo,hi)}"/><text x="${L+i*cw+cw/2}" y="29" text-anchor="middle" fill="${s.passage>(lo+hi)/2?'#fff':'#29282d'}">${s.passage}</text><text transform="translate(${L+i*cw+15} ${T+genes.length*rh+8}) rotate(55)" text-anchor="start">${esc(s.donor)} · P${s.passage}</text>`).join('')}
    ${body}`);
}

function scatter(report, data) {
  const W=510,H=360,L=53,R=22,T=20,B=48;
  const points=data.samples.filter((s)=>report.state?.coords?.[s.id]).map((s)=>({...s,xy:report.state.coords[s.id]}));
  if (!points.length) return '<p class="note">PCA is unavailable for these samples.</p>';
  let x0=Math.min(...points.map(s=>s.xy[0])),x1=Math.max(...points.map(s=>s.xy[0])),y0=Math.min(...points.map(s=>s.xy[1])),y1=Math.max(...points.map(s=>s.xy[1]));
  const px=(x1-x0)*.13||1,py=(y1-y0)*.13||1;x0-=px;x1+=px;y0-=py;y1+=py;
  const x=v=>L+(v-x0)/(x1-x0)*(W-L-R), y=v=>T+(1-(v-y0)/(y1-y0))*(H-T-B);
  const lo=Math.min(...points.map(s=>s.passage)),hi=Math.max(...points.map(s=>s.passage));
  const donors=[...new Set(points.map(s=>s.donor))].sort((a,b)=>String(a).localeCompare(String(b)));
  return shell(W,H,'Measured sample PCA, colored by passage',`
    ${ticks(x0,x1).map(v=>`<line x1="${x(v)}" x2="${x(v)}" y1="${T}" y2="${H-B}" stroke="#e7e9ed"/><text x="${x(v)}" y="${H-B+18}" text-anchor="middle">${fmt(v)}</text>`).join('')}
    ${ticks(y0,y1).map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#e7e9ed"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`).join('')}
    ${donors.map(d=>`<path d="${points.filter(s=>s.donor===d).sort((a,b)=>a.passage-b.passage).map((s,i)=>`${i?'L':'M'}${x(s.xy[0])} ${y(s.xy[1])}`).join(' ')}" fill="none" stroke="#afb6c2" stroke-width="1.3"/>`).join('')}
    ${points.map(s=>`<circle class="atlas-point" cx="${x(s.xy[0])}" cy="${y(s.xy[1])}" r="7" fill="${passageColor(s.passage,lo,hi)}" stroke="white" stroke-width="2" tabindex="0" role="button" aria-label="${esc(s.id)}, donor ${esc(s.donor)}, passage ${s.passage}" data-sample="${esc(s.id)}" data-tip="${esc(`${s.id} · donor ${s.donor} · P${s.passage}`)}"><title>${esc(s.id)} · P${s.passage}</title></circle>`).join('')}
    <text x="${(L+W-R)/2}" y="${H-7}" text-anchor="middle">PC1 · ${(report.state.varExplained[0]*100).toFixed(1)}% variance</text>
    <text transform="translate(13 ${(T+H-B)/2}) rotate(-90)" text-anchor="middle">PC2 · ${(report.state.varExplained[1]*100).toFixed(1)}%</text>`);
}

function geneCurve(data, gene) {
  const W=510,H=290,L=48,R=22,T=18,B=40;
  const points=data.samples.filter(s=>finite(s.genes[gene]));
  if (!points.length) return '<p>No measured values for this gene.</p>';
  const x0=Math.min(...points.map(s=>s.passage)), x1=Math.max(...points.map(s=>s.passage));
  const y0=Math.min(...points.map(s=>s.genes[gene])), y1=Math.max(...points.map(s=>s.genes[gene]));
  const pad=(y1-y0)*.14||.5, lo=Math.max(0,y0-pad),hi=y1+pad;
  const x=v=>L+(v-x0)/(x1-x0||1)*(W-L-R),y=v=>T+(1-(v-lo)/(hi-lo))*(H-T-B);
  const donors=[...new Set(points.map(s=>s.donor))].sort((a,b)=>String(a).localeCompare(String(b)));
  return shell(W,H,`${gene} measured expression by passage and donor`,`
    ${ticks(lo,hi).map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#e7e9ed"/><text x="${L-7}" y="${y(v)+4}" text-anchor="end">${fmt(v)}</text>`).join('')}
    ${[...new Set(points.map(s=>s.passage))].sort((a,b)=>a-b).map(v=>`<text x="${x(v)}" y="${H-20}" text-anchor="middle">P${v}</text>`).join('')}
    ${donors.map((d,k)=>{const p=points.filter(s=>s.donor===d).sort((a,b)=>a.passage-b.passage);return `<path d="${p.map((s,i)=>`${i?'L':'M'}${x(s.passage)} ${y(s.genes[gene])}`).join(' ')}" fill="none" stroke="${PALETTE[k%PALETTE.length]}" stroke-width="1.8" opacity=".8"/>${p.map(s=>`<circle cx="${x(s.passage)}" cy="${y(s.genes[gene])}" r="4.5" fill="${PALETTE[k%PALETTE.length]}" stroke="white" data-sample="${esc(s.id)}" data-tip="${esc(`${s.id} · ${gene}: ${s.genes[gene].toFixed(3)} · donor ${d}`)}"/>`).join('')}`;}).join('')}
    <text transform="translate(12 ${(T+H-B)/2}) rotate(-90)" text-anchor="middle">Normalized expression · log1p</text>`)+`<div class="atlas-legend">${donors.map((d,i)=>`<span><i style="background:${PALETTE[i%PALETTE.length]}"></i>Donor ${esc(d)}</span>`).join('')}</div>`;
}

function bubble(data, genes) {
  const passages=[...new Set(data.samples.map(s=>s.passage))].sort((a,b)=>a-b);
  const L=48,T=22,cw=36,rh=36,W=L+genes.length*cw+18,H=T+passages.length*rh+94;
  const maxN=Math.max(...passages.map(p=>data.samples.filter(s=>s.passage===p).length));
  return shell(W,H,'Mean expression by passage: dot color is row-standardized expression, dot area is sample count',`
    ${passages.map((p,i)=>`<text x="${L-10}" y="${T+i*rh+5}" text-anchor="end">P${p}</text><line x1="${L}" x2="${W-12}" y1="${T+i*rh}" y2="${T+i*rh}" stroke="#eef0f3"/>${genes.map((g,j)=>{const v=data.samples.filter(s=>s.passage===p).map(s=>s.genes[g]).filter(finite);const z=v.length?data.z(g,mean(v)):null;return `<circle cx="${L+j*cw+cw/2}" cy="${T+i*rh}" r="${v.length?12*Math.sqrt(v.length/maxN):2}" fill="${heatColor(z)}" stroke="#d9dee5" stroke-width=".5" data-tip="${esc(`${g} ? P${p} ? ${v.length} samples ? mean log1p ${v.length?mean(v).toFixed(3):'missing'}`)}"/>`;}).join('')}`).join('')}
    ${genes.map((g,j)=>`<text transform="translate(${L+j*cw+cw/2} ${T+passages.length*rh-8}) rotate(55)" text-anchor="start">${esc(g)}</text>`).join('')}`);
}

export function renderAtlas(root, report, onSample) {
  const data=atlasData(report);
  if (!data.samples.length || !data.genes.length) {root.innerHTML='<p class="note">No marker-expression records available.</p>';return;}
  let gene=data.genes.includes('CDKN2A')?'CDKN2A':data.genes[0], order='passage';
  root.innerHTML=`<div class="atlas-heading"><div><p class="kicker">Measured expression</p><h2>Expression atlas</h2><p>Explore ${data.samples.length} samples across ${data.genes.length} selected genes. Choose a gene or a sample to explore its trajectory.</p><p id="atlas-selection" class="atlas-selection" aria-live="polite"></p></div><label>Order samples <select id="atlas-order"><option value="passage">By passage</option><option value="donor">By donor</option></select></label></div>
    <div class="atlas-grid"><article class="atlas-card atlas-heat"><h3><span class="panel-letter">A</span> Gene expression heatmap</h3><div class="atlas-scale"><span>Lower</span><i></i><span>Higher</span><small>Row z-score · −2.5 to +2.5</small></div><div class="atlas-scroll" id="atlas-heatmap"></div><p class="atlas-caption">Each column is one measured sample. Colors are standardized within each gene; extreme colors saturate at ±2.5. Gray indicates missing data.</p></article>
    <div class="atlas-stack"><article class="atlas-card"><h3><span class="panel-letter">B</span> Sample landscape <span class="tag">PCA</span></h3><div id="atlas-pca">${scatter(report,data)}</div><div class="atlas-passage-scale"><span>Earlier passage</span><i></i><span>Later passage</span></div><p class="atlas-caption">One dot per bulk RNA-seq sample. Lines connect the same donor.</p></article>
    <article class="atlas-card"><div class="atlas-card-head"><h3><span class="panel-letter">C</span> Gene trajectory</h3><select id="atlas-gene" aria-label="Gene trajectory">${data.genes.map(g=>`<option ${g===gene?'selected':''}>${esc(g)}</option>`).join('')}</select></div><div id="atlas-curve"></div></article></div>
    <article class="atlas-card atlas-wide"><h3><span class="panel-letter">D</span> Passage expression profile</h3><div class="atlas-scroll" id="atlas-bubble"></div><p class="atlas-caption">Color: mean log1p expression standardized using each gene’s sample mean and SD. Dot area: number of measured samples at that passage, not cell percentage.</p></article></div>`;
  const draw=()=>{const samples=[...data.samples].sort((a,b)=>order==='passage'?a.passage-b.passage||String(a.donor).localeCompare(String(b.donor)):String(a.donor).localeCompare(String(b.donor))||a.passage-b.passage);root.querySelector('#atlas-heatmap').innerHTML=heatmap(data,samples,data.genes,gene);root.querySelector('#atlas-curve').innerHTML=geneCurve(data,gene);if(root.dataset.selectedSample)selectAtlasSample(root.dataset.selectedSample);};
  root.querySelector('#atlas-bubble').innerHTML=bubble(data,data.genes);
  root.querySelector('#atlas-order').onchange=e=>{order=e.target.value;draw();};
  root.querySelector('#atlas-gene').onchange=e=>{gene=e.target.value;draw();};
  const activate=e=>{const target=e.target.closest('[data-sample], [data-gene]');if(!target)return;const id=target.dataset.sample;if(target.dataset.gene){gene=target.dataset.gene;root.querySelector('#atlas-gene').value=gene;draw();}if(id){selectAtlasSample(id);onSample?.(data.samples.find(s=>s.id===id));}};
  root.addEventListener('click',activate);
  root.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){if(e.target.closest('[data-sample], [data-gene]')){e.preventDefault();activate(e);}}});
  draw();
}

export function forecastChart(fc, target=10) {
  const W=940,H=290,L=56,R=22,T=20,B=43;
  const donors=fc.donors, x0=Math.min(...donors.map(d=>d.startPassage)),x1=Math.max(target,...donors.flatMap(d=>d.actual.map(p=>p.passage)),x0+1);
  const curves=donors.map(d=>Array.from({length:Math.ceil(x1-d.startPassage)+1},(_,i)=>({passage:d.startPassage+i,score:d.predictAt(d.startPassage+i)})));
  const values=donors.flatMap((d,i)=>[...d.actual,...curves[i]]).map(p=>p.score).filter(finite),lo=Math.min(...values),hi=Math.max(...values),pad=(hi-lo)*.15||.05;
  const x=v=>L+(v-x0)/(x1-x0)*(W-L-R),y=v=>T+(1-(v-lo+pad)/(hi-lo+2*pad))*(H-T-B);
  return shell(W,H,'Forecast curves and measured rank scores by donor',`
    ${ticks(lo-pad,hi+pad).map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#e7e9ed"/><text x="${L-7}" y="${y(v)+4}" text-anchor="end">${v.toFixed(2)}</text>`).join('')}
    ${ticks(x0,x1,5).map(v=>`<text x="${x(v)}" y="${H-24}" text-anchor="middle">${fmt(v)}</text>`).join('')}
    <line x1="${x(target)}" x2="${x(target)}" y1="${T}" y2="${H-B}" stroke="#798799" stroke-dasharray="3 4"/>
    ${donors.map((d,i)=>`<path d="${curves[i].map((p,j)=>`${j?'L':'M'}${x(p.passage)} ${y(p.score)}`).join(' ')}" fill="none" stroke="${PALETTE[i%PALETTE.length]}" stroke-width="2" stroke-dasharray="5 4"/>${d.actual.map(p=>`<circle cx="${x(p.passage)}" cy="${y(p.score)}" r="5" fill="${PALETTE[i%PALETTE.length]}" stroke="white" stroke-width="1.5" data-tip="${esc(`Measured · donor ${d.donor} · P${p.passage} · rank score ${p.score.toFixed(3)}`)}"/>`).join('')}`).join('')}
    <text x="${W/2}" y="${H-4}" text-anchor="middle">Passage</text><text transform="translate(13 ${H/2}) rotate(-90)" text-anchor="middle">SenCat rank score</text>`)+`<div class="atlas-legend">${donors.map((d,i)=>`<span><i style="background:${PALETTE[i%PALETTE.length]}"></i>${esc(d.donor)}</span>`).join('')}<span>● Measured</span><span>┄ Forecast</span></div>`;
}

export function slopeChart(trends) {
  const W=450,L=80,R=55,T=12,H=trends.length*33+40,lo=Math.min(0,...trends.map(t=>t.slope)),hi=Math.max(0,...trends.map(t=>t.slope));
  const x=v=>L+(v-lo)/(hi-lo||1)*(W-L-R);
  return shell(W,H,'Culture-drift slope by donor',`<line x1="${x(0)}" x2="${x(0)}" y1="0" y2="${H-24}" stroke="#abb3bf"/>${trends.map((t,i)=>`<text x="${L-9}" y="${T+i*33+14}" text-anchor="end">${esc(t.donor)}</text><rect x="${Math.min(x(0),x(t.slope))}" y="${T+i*33}" width="${Math.max(1,Math.abs(x(t.slope)-x(0)))}" height="21" rx="3" fill="${PALETTE[i%PALETTE.length]}" data-tip="${esc(`Donor ${t.donor}: ${t.slope.toFixed(3)} per passage; Spearman ${t.rho.toFixed(2)}`)}"/><text x="${x(t.slope)+6}" y="${T+i*33+15}">${t.slope.toFixed(2)}</text>`).join('')}<text x="${W/2}" y="${H-5}" text-anchor="middle">Drift slope per passage</text>`);
}
