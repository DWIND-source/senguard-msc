// Small SVG charts. Accent marks, 2px lines, 8px+ markers with a surface ring, recessive grid, hover through data-tip.
const C = { line: '#2a78d6', ref: '#eb6834', mute: '#8a897f', grid: '#e6e5df', surface: '#fcfcfb', ink2: '#52514e' };
const nice = (lo, hi, n = 4) => {
  const step0 = (hi - lo) / n || 1;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
};

export function donorPanel(t, yMin, yMax) {
  const W = 220, H = 150, L = 30, R = 18, T = 8, B = 26;
  const xs = t.points.map((p) => p.passage);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const sx = (v) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
  const sy = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
  const yt = nice(yMin, yMax);
  const xt = [...new Set(xs)];
  const path = t.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.passage).toFixed(1)} ${sy(p.score).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Donor ${t.donor}: score from ${t.points[0].score.toFixed(1)} at passage ${t.first} to ${t.points[t.points.length - 1].score.toFixed(1)} at passage ${t.last}">
    ${yt.map((v) => `<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}" stroke="${C.grid}"/><text x="${L - 5}" y="${sy(v) + 3.5}" text-anchor="end">${v}</text>`).join('')}
    ${xt.map((v) => `<text x="${sx(v)}" y="${H - 11}" text-anchor="middle">P${v}</text>`).join('')}
    <path d="${path}" fill="none" stroke="${C.line}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${t.points.map((p) => `<circle cx="${sx(p.passage)}" cy="${sy(p.score)}" r="4.5" fill="${C.line}" stroke="${C.surface}" stroke-width="2"/><circle cx="${sx(p.passage)}" cy="${sy(p.score)}" r="13" fill="transparent" data-tip="Passage ${p.passage}: score ${p.score.toFixed(2)} (${p.id})"/>`).join('')}
  </svg>`;
}

export function histogram(draws, observed) {
  const W = 460, H = 180, L = 34, R = 12, T = 22, B = 40;
  const lo = Math.min(...draws, observed, 0), hi = Math.max(...draws, observed, 0);
  const pad = (hi - lo) * 0.04 || 1;
  const x0 = lo - pad, x1 = hi + pad;
  const bins = 42, counts = new Array(bins).fill(0);
  for (const d of draws) counts[Math.min(bins - 1, Math.floor(((d - x0) / (x1 - x0)) * bins))]++;
  const ymax = Math.max(...counts);
  const sx = (v) => L + ((v - x0) / (x1 - x0)) * (W - L - R);
  const bw = (W - L - R) / bins;
  const sy = (c) => T + (1 - c / ymax) * (H - T - B);
  const anchor = sx(observed) > W * 0.6 ? 'end' : 'start';
  const off = anchor === 'end' ? -6 : 6;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Random signature slopes cluster near ${(draws.reduce((a, b) => a + b, 0) / draws.length).toFixed(2)}; this signature is ${observed.toFixed(2)}">
    ${nice(0, ymax, 3).map((v) => `<line x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}" stroke="${C.grid}"/><text x="${L - 5}" y="${sy(v) + 3.5}" text-anchor="end">${v}</text>`).join('')}
    ${counts.map((c, i) => (c ? `<rect x="${(L + i * bw + 0.5).toFixed(1)}" y="${sy(c).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${(H - B - sy(c)).toFixed(1)}" fill="${C.mute}" data-tip="${c} random signatures"/>` : '')).join('')}
    ${nice(x0, x1, 5).map((v) => `<text x="${sx(v)}" y="${H - 25}" text-anchor="middle">${v}</text>`).join('')}
    <text x="${(L + W - R) / 2}" y="${H - 5}" text-anchor="middle">Mean within-donor slope per passage</text>
    <line x1="${sx(observed)}" x2="${sx(observed)}" y1="${T - 6}" y2="${H - B}" stroke="${C.ref}" stroke-width="2"/>
    <text x="${sx(observed) + off}" y="${T + 3}" text-anchor="${anchor}" style="fill:#0b0b0b;font-weight:600">This signature ${observed >= 0 ? '+' : ''}${observed.toFixed(2)}</text>
  </svg>`;
}

// Dots with exact CIs on one 0 to 1 scale, for donors rising by signature
export function shareDots(rows) {
  const rowH = 27, L = 215, R = 62, T = 8, W = 720, B = 34;
  const H = T + rows.length * rowH + B;
  const sx = (v) => L + v * (W - L - R);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Share of donors with a rising score, by signature">
    ${ticks.map((v) => `<line x1="${sx(v)}" x2="${sx(v)}" y1="${T}" y2="${H - B}" stroke="${v === 0.5 ? C.mute : C.grid}" ${v === 0.5 ? 'stroke-dasharray="3 3"' : ''}/><text x="${sx(v)}" y="${H - B + 15}" text-anchor="middle">${v * 100}%</text>`).join('')}
    <text x="${sx(0.5)}" y="${H - 3}" text-anchor="middle">Donors with a rising score, exact 95% CI. Dashed line: chance.</text>
    ${rows.map((r, i) => {
      const y = T + i * rowH + rowH / 2;
      return `<text x="${L - 10}" y="${y + 4}" text-anchor="end" style="fill:#0b0b0b;font-size:12.5px;${r.highlight ? 'font-weight:600' : ''}">${r.label}</text>
      <line x1="${sx(r.low)}" x2="${sx(r.high)}" y1="${y}" y2="${y}" stroke="${r.highlight ? C.ref : C.line}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="${sx(r.share)}" cy="${y}" r="5" fill="${r.highlight ? C.ref : C.line}" stroke="${C.surface}" stroke-width="2"/>
      <rect x="${L}" y="${y - rowH / 2}" width="${W - L - R}" height="${rowH}" fill="transparent" data-tip="${r.label}: ${r.up} of ${r.n} donors; 95% CI ${(r.low * 100).toFixed(0)} to ${(r.high * 100).toFixed(0)}%; median rho ${r.rho}"/>
      <text x="${W - R + 8}" y="${y + 4}" style="font-size:12px">${r.up}/${r.n}</text>`;
    }).join('')}
  </svg>`;
}

export function tooltipLayer(tip) {
  document.addEventListener('mousemove', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.getAttribute('data-tip');
    tip.hidden = false;
    const x = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = `${x}px`;
    tip.style.top = `${e.clientY + 14}px`;
  });
}
