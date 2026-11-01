import { shareDots } from './charts.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const fmtP = (p) => (p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(p < 0.01 ? 4 : 3)}`);

export function renderEvidence(el, ev) {
  const { ok, registered } = ev.headline;
  const f = ev.facts;
  const c = ev.clock;
  const finding = (tag, title, body) => `<div class="finding"><h4>${title} <span class="tag">${tag}</span></h4><p>${body}</p></div>`;
  el.innerHTML = `
    <div class="tiles">
      <div class="tile"><b>${ok.donors_rising}/${ok.donors}</b><span>donors in new cohorts with a rising score (${pct(ok.share)}, 95% CI ${pct(ok.ci_low)} to ${pct(ok.ci_high)}, ${fmtP(ok.binom_p)})</span></div>
      <div class="tile"><b>${registered.donors_rising}/${registered.donors}</b><span>the same as planned, with one cohort that failed the identity check (${fmtP(registered.binom_p)})</span></div>
      <div class="tile"><b>${c.rising}/${c.n}</b><span>held-out donors rising on the drift clock. It estimates passage-like drift, not senescence.</span></div>
      <div class="tile"><b>p = ${f.gvhdP}</b><span>for higher scores in GVHD non-responders. The clinical-response hypothesis was not supported.</span></div>
    </div>
    <p class="note">The analysis plan was written and hashed before these cohorts were scored. Cohorts differ in tissue, medium and platform. Passage is not a senescence label, so these are trends and not accuracy.</p>

    <div class="evidence-chart"><h3>Signatures compared head to head <span class="tag">measured</span></h3>
      ${shareDots(ev.headToHead)}
      <p class="note">No signature clearly wins: confidence intervals overlap, and a single transcript such as CDKN2A matches the published signature on this measure. Results on a score's own training cohort are left out of its count.</p>
      <details><summary>Show the table</summary><div class="table-wrap"><table><thead><tr><th>Signature</th><th class="num">Donors rising</th><th class="num">Share</th><th class="num">95% CI</th><th class="num">Median rho</th></tr></thead><tbody>
      ${ev.headToHead.map((r) => `<tr><td>${r.label}</td><td class="num">${r.up}/${r.n}</td><td class="num">${pct(r.share)}</td><td class="num">${pct(r.low)} to ${pct(r.high)}</td><td class="num">${r.rho}</td></tr>`).join('')}
      </tbody></table></div></details>
    </div>

    <div class="columns">
      <div class="col-card for"><h3><i>+</i>What holds up</h3>
        ${finding('measured', 'Reproduced from public counts', `Published coefficients were recovered with Spearman ${f.reproSpearman}.`)}
        ${finding('measured', 'Induced senescence is detected in MSC', `Irradiated vs control bone-marrow MSC: AUROC ${f.irradiatedAuroc} (4 vs 4), and ${f.irradiatedRefit} with weights trained without MSC lineages. SenMayo reached ${f.irradiatedSenMayo} and the 7-gene passage signature ${f.irradiatedYang}.`)}
        ${finding('measured', 'The guards catch real errors', `GSE125632 lists one male donor, but Y-linked expression contradicts its donor pairing. Try "Real labelling error" above. The check doesn't depend on any score.`)}
        ${finding('measured', 'Guard thresholds are measured', `Thinning reads kept ${pct(f.depth3m)} of the slope at 3 million reads, ${pct(f.depth1m)} and ${pct(f.depth1mB)} at 1.2 million, and ${pct(f.depth02)} and ${pct(f.depth02B)} at 0.25 million. Re-sequenced samples differed by ${f.retestA} and ${f.retestB}.`)}
      </div>
      <div class="col-card against"><h3><i>&minus;</i>What goes against it</h3>
        ${finding('measured', 'No link to clinical response', `In the GVHD lots of GSE48662 (5 responders, 3 non-responders) the score wasn't higher in non-responders (${fmtP(f.gvhdP)}). Eight lots can't rule a link out, and they give no support for one.`)}
        ${finding('measured + published', 'A rising score is not lost potency', `In GSE137186 the score rose in ${f.g137rising} of ${f.g137n} donors up to passage 15, while the authors report that trophic and immunoregulatory function was maintained.`)}
        ${finding('measured', 'It moves early in culture', `In GMP production of Wharton's jelly MSC, reported as transcriptomically stable, it rose in ${f.gmpRising} of ${f.gmpN} donors from master bank to passage 2 or 3. It partly reflects adaptation to culture.`)}
        ${finding('measured', 'Absolute scores do not travel', `Earliest-passage means ran from ${f.absMin} to ${f.absMax} across count-based cohorts, and platelet lysate scored ${Math.abs(f.mediumLate)} lower than FBS for the same donor at passage 4 to 5. So the twin reads each donor against itself and offers no threshold.`)}
        ${finding('measured', 'Not every series rises', `Serum-free GSE233634 fell overall (slope ${f.g233slope} per passage). Adipose donor E reached ${f.donorE} without reported arrest, in the range of arrested donors (${f.arrestedLow} to ${f.arrestedHigh}), while donor D reached ${f.donorD}.`)}
        ${finding('measured', 'Forecasting did not pass', `Extrapolating a donor's earlier passages beat carrying the last value forward in ${pct(f.forecastBetter)} of ${f.forecastDonors} donors, under the 70% we required. Direction was right in ${f.forecastDirection}, but size errors were large (median ${f.forecastError}), so the twin shows no forecast.`)}
        ${finding('measured', 'Complex models added nothing measurable', `Six regularized models tied at AUROC ${f.devAuroc} (${f.devLow} to ${f.devHigh}) on held-out cell types, an easy contrast. BulkFormer embeddings reached ${f.bfAuroc} (${f.bfLow} to ${f.bfHigh}), with overlapping intervals.`)}
        ${finding('measured', 'One score was trained on a test cohort', `hUSI's training metadata lists 9 samples of GSE178514, labelled by passage, so its result there is excluded above.`)}
      </div>
    </div>

    <div class="evidence-chart"><h3>Cohorts</h3>
      <div class="table-wrap"><table><thead><tr><th>GEO series</th><th>Tissue</th><th>Passages</th><th>Role</th><th class="num">Rising</th></tr></thead><tbody>
      ${ev.cohorts.map((r) => `<tr><td><a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${r.accession}">${r.accession}</a></td><td>${r.tissue}</td><td>${r.design}</td><td>${r.role}</td><td class="num">${r.rising}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`;
}
