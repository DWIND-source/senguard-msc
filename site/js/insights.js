// Plain-language sections: culture-option comparisons, per-donor flags, the IFN-γ research direction and the candidate qPCR panel.
// Every number comes from data/insights.json, data/panel.json or data/evidence.json, which are built from measured tables.
import { t } from './i18n.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const signed = (v, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;
const doi = (id, label) => `<a href="https://doi.org/${id}">${label}</a>`;
const REF = {
  kumari: doi('10.3389/fcell.2021.645593', 'Kumari & Jat 2021'),
  hallmark: doi('10.1016/j.cels.2015.12.004', 'MSigDB Hallmark, Liberzon 2015'),
  davalos: doi('10.1083/jcb.201206006', 'Davalos 2013'),
  ou: doi('10.1073/pnas.1607152113', 'Ou 2016'),
  lee: doi('10.1111/j.1474-9726.2006.00199.x', 'Lee 2006'),
  wagner: doi('10.1371/journal.pone.0002213', 'Wagner 2008'),
  estrada: doi('10.1038/cdd.2011.172', 'Estrada, Cell Death Differ'),
  klinker: '<a href="https://pubmed.ncbi.nlm.nih.gov/28283659/">Klinker et al., PNAS 2017</a>',
  liu: doi('10.1038/s42003-026-09833-2', 'Liu et al., Communications Biology 2026'),
};
const C = { up: '#d9602b', down: '#2a78d6', flat: '#8a897f', grid: '#e6e5df', fbs: '#d9602b', hpl: '#238b8d' };

// ---------- per-donor flag and the one-line reading, shared with the culture twin ----------

export const FIXED_FLAG_NOTE = () => t('This flag does not decide whether to keep or discard a culture.', 'Cờ này không quyết định giữ hay loại bỏ một mẻ nuôi cấy.');

export function donorFlag(points, mdc) {
  if (!points || points.length < 2 || !Number.isFinite(mdc)) return { kind: 'na', label: t('Cannot assess', 'Không đánh giá được'), detail: t('Not enough samples from this donor to compare with its earliest sample.', 'Không đủ mẫu của người hiến này để so với mẫu sớm nhất.') };
  const change = points[points.length - 1].score - points[0].score;
  if (Math.abs(change) < mdc) return { kind: 'noise', change, label: t('Within technical noise', 'Trong nhiễu kỹ thuật'), detail: t(`Change ${signed(change)} since the earliest sample is under about ${mdc}.`, `Thay đổi ${signed(change)} so với mẫu sớm nhất, dưới khoảng ${mdc}.`) };
  return { kind: 'review', change, label: t('Review recommended', 'Nên xem xét'), detail: t(`Change ${signed(change)} since the earliest sample exceeds about ${mdc}. Compare with population doubling time, SA-β-gal staining and the checks your lab already uses.`, `Thay đổi ${signed(change)} so với mẫu sớm nhất, vượt khoảng ${mdc}. Hãy đối chiếu thời gian nhân đôi quần thể, nhuộm SA-β-gal và các chỉ tiêu lab đang dùng.`) };
}

export const flagChip = (f) => `<span class="flag flag-${f.kind}" title="${esc(f.detail)}">${esc(f.label)}</span>`;

export function readingLine(donor, points, rho, mdc) {
  if (!points || points.length < 2) return t(`Donor ${donor}: only one sample, so there is no change to read yet.`, `Người hiến ${donor}: chỉ có một mẫu nên chưa có thay đổi để đọc.`);
  const a = points[0], b = points[points.length - 1], change = b.score - a.score;
  const span = t(`from passage ${a.passage} to passage ${b.passage}`, `từ passage ${a.passage} đến passage ${b.passage}`);
  if (Math.abs(change) < mdc) return t(`Donor ${donor}: the aging score stayed within technical noise ${span} (${signed(change)}).`, `Người hiến ${donor}: điểm lão hóa nằm trong nhiễu kỹ thuật ${span} (${signed(change)}).`);
  if (change > 0) {
    const how = rho >= 0.8 ? t('rose steadily', 'tăng đều') : t('rose overall, with ups and downs', 'tăng nhìn chung, có lên xuống');
    return t(`Donor ${donor}: the aging score ${how} ${span} (${signed(change)}). This matches the usual pattern in culture and does not by itself mean the cells are unusable.`,
      `Người hiến ${donor}: điểm lão hóa ${how} ${span} (${signed(change)}). Đây là diễn biến thường gặp khi nuôi cấy và tự nó không có nghĩa tế bào không dùng được.`);
  }
  return t(`Donor ${donor}: the aging score fell ${span} (${signed(change)}). This is less common in culture; check for changes in medium or handling. It does not by itself mean the cells are better.`,
    `Người hiến ${donor}: điểm lão hóa giảm ${span} (${signed(change)}). Điều này ít gặp khi nuôi cấy; hãy kiểm tra thay đổi về môi trường hoặc thao tác. Tự nó không có nghĩa tế bào tốt hơn.`);
}

// ---------- charts ----------

function bankChart(bank, mdc) {
  const W = 460, H = 300, L = 64, R = 64, T = 26, B = 40;
  const vals = bank.donors.flatMap((d) => [d.bank, d.later]);
  const lo = Math.min(...vals) - 0.6, hi = Math.max(...vals) + 0.6;
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const x0 = L, x1 = W - R;
  const ticks = [-15, -12, -9, -6, -3, 0].filter((v) => v >= lo && v <= hi);
  const color = (d) => (Math.abs(d.change) < mdc ? C.flat : d.change > 0 ? C.up : C.down);
  // Donor labels at the right end, nudged apart so close values stay readable.
  const labelY = new Map();
  let prev = -Infinity;
  for (const d of [...bank.donors].sort((a, b) => y(a.later) - y(b.later))) { prev = Math.max(y(d.later), prev + 12); labelY.set(d.donor, prev); }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t(`SenCat score at the master cell bank and at passage 2 or 3 for ${bank.n} donors`, `Điểm SenCat tại ngân hàng tế bào gốc và tại passage 2–3 của ${bank.n} người hiến`))}">
    ${ticks.map((v) => `<line x1="${x0}" x2="${x1}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/><text x="${x0 - 30}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
    <text x="${x0}" y="${H - 14}" text-anchor="middle">${t('Master cell bank', 'Ngân hàng gốc')}</text><text x="${x1}" y="${H - 14}" text-anchor="middle">${t('Passage 2–3', 'Passage 2–3')}</text>
    ${bank.donors.map((d) => `<line x1="${x0}" x2="${x1}" y1="${y(d.bank)}" y2="${y(d.later)}" stroke="${color(d)}" stroke-width="2" opacity=".85"/>
      <circle cx="${x0}" cy="${y(d.bank)}" r="5" fill="${color(d)}" stroke="#fff" stroke-width="1.5"/><circle cx="${x1}" cy="${y(d.later)}" r="5" fill="${color(d)}" stroke="#fff" stroke-width="1.5"/>
      <circle cx="${x1}" cy="${y(d.later)}" r="12" fill="transparent" data-tip="${esc(t(`Donor ${d.donor}: ${d.bank} at the bank, ${d.later} at P${d.laterPassage} (${signed(d.change)})`, `Người hiến ${d.donor}: ${d.bank} tại ngân hàng, ${d.later} tại P${d.laterPassage} (${signed(d.change)})`))}"/>
      <text x="${x1 + 10}" y="${labelY.get(d.donor) + 4}" class="lbl">${esc(d.donor)}</text>`).join('')}
    <text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${t('SenCat score', 'Điểm SenCat')}</text></svg>
    <div class="atlas-legend"><span><i style="background:${C.up}"></i>${t('Rose beyond noise', 'Tăng vượt nhiễu')}</span><span><i style="background:${C.flat}"></i>${t('Within noise', 'Trong nhiễu')}</span><span><i style="background:${C.down}"></i>${t('Fell beyond noise', 'Giảm vượt nhiễu')}</span></div>`;
}

function mediumChart(medium) {
  const groups = ['P1', 'P4-5'];
  const donors = [...new Set(medium.rows.map((r) => r.donor))];
  const W = 460, rowH = 26, T = 26, L = 92, R = 26, gap = 18;
  const H = T + groups.length * (donors.length * rowH + gap) + 34;
  const vals = medium.rows.flatMap((r) => [r.fbs, r.hpl]);
  const lo = Math.floor(Math.min(...vals)) - 0.5, hi = Math.ceil(Math.max(...vals)) + 0.5;
  const x = (v) => L + (v - lo) / (hi - lo) * (W - L - R);
  let yy = T;
  const body = groups.map((g) => {
    const head = `<text x="8" y="${yy + 4}" class="lbl" font-weight="600">${g === 'P1' ? t('Passage 1', 'Passage 1') : t('Passage 4–5', 'Passage 4–5')}</text>`;
    yy += 12;
    const rows = donors.map((d) => {
      const r = medium.rows.find((q) => q.donor === d && q.passage === g);
      const cy = yy + rowH / 2; yy += rowH;
      const name = t(d, d.replace('Donor', 'Người hiến'));
      return `<text x="${L - 8}" y="${cy + 4}" text-anchor="end">${esc(name)}</text><line x1="${x(r.fbs)}" x2="${x(r.hpl)}" y1="${cy}" y2="${cy}" stroke="#b8bec7" stroke-width="2"/>
        <circle cx="${x(r.fbs)}" cy="${cy}" r="6" fill="${C.fbs}" stroke="#fff" stroke-width="1.5" data-tip="${esc(`${name} · ${g} · FBS ${r.fbs}`)}"/><circle cx="${x(r.hpl)}" cy="${cy}" r="6" fill="${C.hpl}" stroke="#fff" stroke-width="1.5" data-tip="${esc(`${name} · ${g} · hPL ${r.hpl}`)}"/>`;
    }).join('');
    yy += gap;
    return head + rows;
  }).join('');
  const ticks = [];
  for (let v = Math.ceil(lo / 2) * 2; v <= hi; v += 2) ticks.push(v);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('SenCat score of the same donors grown in FBS or platelet lysate', 'Điểm SenCat của cùng người hiến nuôi trong FBS hoặc platelet lysate'))}">
    ${ticks.map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="${T - 6}" y2="${yy - gap}" stroke="${C.grid}"/><text x="${x(v)}" y="${yy - gap + 16}" text-anchor="middle">${v}</text>`).join('')}
    ${body}<text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">${t('SenCat score', 'Điểm SenCat')}</text></svg>
    <div class="atlas-legend"><span><i style="background:${C.fbs}"></i>FBS</span><span><i style="background:${C.hpl}"></i>${t('Human platelet lysate (hPL)', 'Platelet lysate người (hPL)')}</span></div>`;
}

// ---------- sections ----------

export function renderProcess(el, ins, ev) {
  const { bank, medium, noise } = ins;
  const within = bank.donors.filter((d) => Math.abs(d.change) < noise.mdc).length;
  const review = bank.n - within;
  const persist = ev?.facts?.vpPersist;
  el.innerHTML = `
    <p class="lede-sm">${t('Use SenGuard-MSC to compare culture options on donor-matched series: which medium, platelet lysate or FBS, and how many passages to allow. It can also be used when lots enter the cell bank, to record a starting profile for later comparison. It supports these decisions; it does not choose a protocol and it does not release or reject batches.',
      'Dùng SenGuard-MSC để so sánh phương án nuôi cấy trên chuỗi mẫu cùng người hiến: dùng môi trường nào, platelet lysate hay FBS, và cho phép tối đa bao nhiêu passage. Công cụ cũng có thể dùng khi lô tế bào vào ngân hàng, để ghi lại hồ sơ ban đầu làm mốc so sánh về sau. Công cụ hỗ trợ ra quyết định; nó không tự chọn quy trình và không duyệt hay loại bỏ lô.')}</p>
    <div class="insight-grid">
      <article class="card"><h3>${t('From cell bank to later passages', 'Từ ngân hàng tế bào đến các passage sau')} <span class="tag">${t('measured', 'thực đo')} · ${bank.cohort}</span></h3>
        ${bankChart(bank, noise.mdc)}
        <p class="note">${t(`In GMP production of Wharton's jelly MSC, the score rose in <b>${bank.rising} of ${bank.n}</b> donors from the master cell bank to passage 2–3, even though the authors reported the product as transcriptionally stable. A rise this early can reflect the cells adapting to culture. On its own it is not a sign of poor quality.`,
          `Trong sản xuất GMP MSC thạch Wharton, điểm tăng ở <b>${bank.rising}/${bank.n}</b> người hiến từ ngân hàng tế bào gốc đến passage 2–3, dù nhóm tác giả báo cáo sản phẩm ổn định về phiên mã. Mức tăng sớm như vậy có thể phản ánh tế bào thích nghi với môi trường nuôi cấy. Tự nó không phải dấu hiệu chất lượng kém.`)}</p>
        <p class="note">${t(`Donor flags here: ${review} "Review recommended", ${within} "Within technical noise".`, `Cờ theo người hiến: ${review} "Nên xem xét", ${within} "Trong nhiễu kỹ thuật".`)} ${FIXED_FLAG_NOTE()}</p></article>

      <article class="card"><h3>${t('What can lower the score?', 'Điều gì có thể làm giảm điểm?')} <span class="tag">${t('observation', 'quan sát')} · ${medium.cohort}</span></h3>
        ${mediumChart(medium)}
        <p class="note">${t(`<b>Observed:</b> in the same ${medium.n} bone-marrow donors, cells grown in human platelet lysate scored on average ${Math.abs(medium.lateDiff)} lower than in FBS at passage 4–5 (lower in ${medium.lowerIn} of ${medium.n}). This is an observation. It does not show that the cells are better.`,
          `<b>Quan sát:</b> ở cùng ${medium.n} người hiến tủy xương, tế bào nuôi trong platelet lysate người có điểm trung bình thấp hơn ${Math.abs(medium.lateDiff)} so với FBS tại passage 4–5 (thấp hơn ở ${medium.lowerIn}/${medium.n}). Đây chỉ là quan sát, chưa chứng minh tế bào tốt hơn.`)}</p>
        <p class="note">${t('<b>Hypotheses from the literature, not tested here:</b>', '<b>Giả thuyết từ tài liệu, chưa kiểm chứng ở đây:</b>')}</p>
        <ul class="reading">
          <li>${t(`Fewer passages: senescence-related changes build up continuously from early passages (${REF.wagner}).`, `Ít passage hơn: các thay đổi liên quan lão hóa tích lũy liên tục từ những passage đầu (${REF.wagner}).`)}</li>
          <li>${t(`Low-oxygen culture: MSC grown at low oxygen showed better growth and genetic stability (${REF.estrada}).`, `Nuôi cấy oxy thấp: MSC nuôi ở nồng độ oxy thấp tăng sinh tốt hơn và ổn định di truyền hơn (${REF.estrada}).`)}</li>
        </ul>
        <p class="note strong">${t('Lowering the score is not a treatment goal. The score describes gene expression; it does not measure potency or safety.', 'Giảm điểm số không phải là mục tiêu điều trị. Điểm mô tả biểu hiện gene; nó không đo hiệu lực hay độ an toàn.')}</p></article>

      <article class="card"><h3>${t('How the donor flags work', 'Cách đọc cờ theo người hiến')}</h3>
        <p class="note">${t("Each donor is compared with its own earliest sample, using the measured SenCat score.", 'Mỗi người hiến được so với mẫu sớm nhất của chính mình, dựa trên điểm SenCat thực đo.')}</p>
        <dl class="flag-list">
          <dt>${flagChip({ kind: 'noise', label: t('Within technical noise', 'Trong nhiễu kỹ thuật'), detail: '' })}</dt><dd>${t(`Change under about ${noise.mdc}.`, `Thay đổi dưới khoảng ${noise.mdc}.`)}</dd>
          <dt>${flagChip({ kind: 'review', label: t('Review recommended', 'Nên xem xét'), detail: '' })}</dt><dd>${t('Change above that. Compare with population doubling time, SA-β-gal staining and the checks your lab already uses.', 'Thay đổi vượt mức đó. Đối chiếu thời gian nhân đôi quần thể, nhuộm SA-β-gal và các chỉ tiêu lab đang dùng.')}</dd>
          <dt>${flagChip({ kind: 'na', label: t('Cannot assess', 'Không đánh giá được'), detail: '' })}</dt><dd>${t('Not enough samples from that donor.', 'Không đủ mẫu của người hiến đó.')}</dd>
        </dl>
        <p class="note">${t(`Where ${noise.mdc} comes from: re-sequencing the same samples changed the score by ${noise.retestA} and ${noise.retestB}. That rests on only ${noise.pairs} sample pairs in one cohort (${noise.cohort}), so treat it as approximate. It applies to the SenCat score only, not to the forecast rank score, which is on a different scale.`,
          `Nguồn của mức ${noise.mdc}: giải trình tự lại cùng mẫu làm điểm thay đổi ${noise.retestA} và ${noise.retestB}. Con số này chỉ dựa trên ${noise.pairs} cặp mẫu trong một cohort (${noise.cohort}), nên chỉ là ước lượng. Mức này chỉ áp dụng cho điểm SenCat, không áp dụng cho điểm hạng (rank score) của dự báo vốn có thang đo khác.`)}</p>
        <p class="note strong">${FIXED_FLAG_NOTE()}</p>
        <details><summary>${t('Why there is no keep-or-discard threshold', 'Vì sao không có ngưỡng giữ hay loại bỏ')}</summary><ul class="reading">
          <li>${t('Absolute scores differ between labs and media, so one cut-off would not travel.', 'Giá trị tuyệt đối khác nhau giữa các lab và môi trường, nên một ngưỡng chung không dùng được ở nơi khác.')}</li>
          <li>${t('The tool has not been validated on real release decisions.', 'Công cụ chưa được kiểm chứng trên quyết định duyệt lô thực tế.')}</li>
          <li>${t(`The forecast cannot tell which donor will drift faster: a donor's early rate did not predict its later rate${Number.isFinite(persist) ? ` (Spearman ${persist})` : ''}.`, `Dự báo không biết người hiến nào sẽ trôi nhanh hơn: tốc độ sớm của một người hiến không dự đoán được tốc độ về sau${Number.isFinite(persist) ? ` (Spearman ${persist})` : ''}.`)}</li>
        </ul></details></article>

      <article class="card"><h3>${t('Cell-bank intake: how many doublings can a lot sustain?', 'Kiểm soát đầu vào ngân hàng: lô chịu được bao nhiêu lần nhân đôi?')} <span class="tag">${t('research direction', 'hướng nghiên cứu')}</span></h3>
        <p class="note">${t('A useful question for a cell bank is whether a lot has enough quality for applications that need many doublings, and how many rounds of culture it can take. That has not been tested yet. Answering it needs series where growth and senescence staining were measured on the same samples as RNA-seq.',
          'Một câu hỏi hữu ích cho ngân hàng tế bào là lô có đủ chất lượng cho các ứng dụng cần nhân đôi nhiều lần không, và chịu được tối đa bao nhiêu lần nuôi cấy. Điều này chưa được kiểm chứng. Để trả lời cần các chuỗi mẫu đo tăng sinh và nhuộm lão hóa trên chính các mẫu đã làm RNA-seq.')}</p>
        <p class="note">${t('Open data found so far:', 'Dữ liệu mở tìm được đến nay:')}</p>
        <ul class="reading">
          <li><a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE291956">GSE291956</a>: ${t('adipose MSC, 3 donors, passage 0 to 7, cumulative population doublings at every passage, with and without IFN-γ.', 'MSC mô mỡ, 3 người hiến, passage 0 đến 7, có số lần nhân đôi tích lũy ở mỗi passage, có và không có IFN-γ.')}</li>
          <li><a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE9593">GSE9593</a>: ${t(`bone-marrow MSC to replicative senescence, microarray; cumulative doublings and SA-β-gal reported in the paper (${REF.wagner}).`, `MSC tủy xương nuôi đến lão hóa sao chép, microarray; số lần nhân đôi tích lũy và SA-β-gal có trong bài báo (${REF.wagner}).`)}</li>
          <li><a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE309666">GSE309666</a>: ${t('adipose MSC, 5 donors; growth arrest recorded for 3 donors at passage 7 to 9.', 'MSC mô mỡ, 5 người hiến; ghi nhận ngừng tăng sinh ở 3 người hiến tại passage 7 đến 9.')}</li>
        </ul>
        <p class="note">${t('Status: not yet analysed. No intake prediction is shown in the tool.', 'Trạng thái: chưa phân tích. Công cụ chưa hiển thị dự đoán đầu vào nào.')}</p></article>
    </div>`;
}

export function renderImmune(el, ev) {
  const gv = ev?.facts?.gvhdP ?? 0.625;
  el.innerHTML = `
    <p class="lede-sm">${t('MSC are given for immune conditions because inflammatory signals such as IFN-γ switch on their immunosuppressive programme ("licensing"). How strongly a lot responds varies between donors and lots. Measuring that response is a research direction for this tool, separate from the senescence score.',
      'MSC được dùng cho các bệnh lý miễn dịch vì tín hiệu viêm như IFN-γ bật chương trình ức chế miễn dịch của chúng ("licensing"). Mức đáp ứng khác nhau giữa người hiến và giữa các lô. Đo mức đáp ứng này là một hướng nghiên cứu của công cụ, tách biệt khỏi điểm lão hóa.')}</p>
    <div class="insight-grid">
      <article class="card"><h3>${t('What the literature shows', 'Tài liệu cho thấy gì')}</h3>
        <ul class="reading">
          <li>${t(`${REF.klinker}: the shape of MSC after IFN-γ stimulation predicted the overall immunosuppressive capacity of MSC lines from different donors and manufacturing conditions.`, `${REF.klinker}: hình thái MSC sau kích thích IFN-γ dự đoán khả năng ức chế miễn dịch tổng thể của các dòng MSC từ nhiều người hiến và điều kiện sản xuất.`)}</li>
          <li>${t(`${REF.liu}: umbilical-cord MSC were treated with IFN-γ at 0 to 50 ng/mL for 24 hours, and a deep-learning model predicted immunomodulatory markers from cell morphology.`, `${REF.liu}: MSC dây rốn được xử lý IFN-γ 0–50 ng/mL trong 24 giờ, và mô hình học sâu dự đoán các chỉ dấu điều hòa miễn dịch từ hình thái tế bào.`)}</li>
        </ul>
        <p class="note strong">${t('Both studies read cell images (morphology). SenGuard-MSC currently reads RNA-seq. A morphology-based prediction module is planned; it is not available yet.', 'Cả hai nghiên cứu đều dùng ảnh tế bào (hình thái). SenGuard-MSC hiện đọc dữ liệu RNA-seq. Mô-đun dự đoán dựa trên hình thái đang được lên kế hoạch; hiện chưa có.')}</p></article>
      <article class="card"><h3>${t('What our own data say', 'Dữ liệu của chúng tôi cho thấy gì')} <span class="tag">${t('measured', 'thực đo')}</span></h3>
        <p class="note">${t(`In 8 clinical GVHD lots (GSE48662; 5 responders, 3 non-responders), the senescence score was not higher in non-responders (p = ${gv}). The senescence score is therefore not a readout of immune function.`, `Ở 8 lô điều trị GVHD (GSE48662; 5 đáp ứng, 3 không đáp ứng), điểm lão hóa không cao hơn ở nhóm không đáp ứng (p = ${gv}). Vì vậy điểm lão hóa không phải là chỉ số đo chức năng miễn dịch.`)}</p>
        <p class="note">${t('Use in autoimmune or immunosuppressive diseases is a research direction only, not a result.', 'Ứng dụng cho bệnh tự miễn hoặc bệnh cần ức chế miễn dịch chỉ là hướng nghiên cứu, không phải kết quả.')}</p></article>
      <article class="card"><h3>${t('Plan, in two stages', 'Kế hoạch hai giai đoạn')}</h3>
        <ol class="reading">
          <li>${t('<b>Stage 1, in progress:</b> find public RNA-seq of MSC before and after IFN-γ from the same donors, ideally with a functional assay. Candidate datasets are under review.', '<b>Giai đoạn 1, đang làm:</b> tìm dữ liệu RNA-seq công khai của MSC trước và sau IFN-γ từ cùng người hiến, ưu tiên có assay chức năng. Các bộ dữ liệu ứng viên đang được duyệt.')}</li>
          <li>${t('<b>Stage 2, only if stage 1 finds suitable data:</b> fix an analysis plan before scoring, then add an exploratory IFN-γ response index. It will be separate from SenCat, will not be called potency, and will appear only when the data contain paired samples before and after stimulation. It will be called a prediction of immune function only after it has been checked against a functional assay.', '<b>Giai đoạn 2, chỉ khi giai đoạn 1 có dữ liệu phù hợp:</b> cố định kế hoạch phân tích trước khi chấm điểm, rồi thêm chỉ số thăm dò về đáp ứng IFN-γ. Chỉ số này tách khỏi SenCat, không gọi là hiệu lực (potency), và chỉ hiển thị khi dữ liệu có cặp mẫu trước và sau kích thích. Chỉ gọi là dự đoán chức năng miễn dịch sau khi đã đối chiếu với assay chức năng.')}</li>
        </ol></article>
    </div>`;
}

const GENES = {
  MDM2: ['E3 ubiquitin ligase that marks p53 for breakdown.', 'Enzyme ubiquitin ligase E3 đánh dấu p53 để phân hủy.', 'Part of the p53–p21 pathway that drives senescence arrest', 'Thuộc con đường p53–p21 gây ngừng phân chia khi lão hóa', 'kumari'],
  ZNFX1: ['Sensor of double-stranded RNA in the antiviral interferon response.', 'Cảm biến RNA sợi đôi trong đáp ứng interferon chống virus.', null, null],
  TOP2A: ['Topoisomerase IIα, needed to separate DNA during cell division.', 'Topoisomerase IIα, cần để tách DNA khi tế bào phân chia.', 'Cell-division gene; falls when cells stop dividing', 'Gene phân bào; giảm khi tế bào ngừng phân chia', 'hallmark'],
  RRM2B: ['p53-inducible subunit of ribonucleotide reductase (p53R2), for DNA repair and mitochondrial DNA.', 'Tiểu đơn vị ribonucleotide reductase do p53 cảm ứng (p53R2), phục vụ sửa chữa DNA và DNA ty thể.', 'p53 target; the p53 pathway drives senescence arrest', 'Đích của p53; con đường p53 gây ngừng phân chia khi lão hóa', 'kumari'],
  SAT1: ['Spermidine/spermine acetyltransferase, the first step of polyamine breakdown.', 'Spermidine/spermine acetyltransferase, bước đầu phân hủy polyamine.', 'Switched on by p53 in stress responses', 'Được p53 kích hoạt trong đáp ứng stress', 'ou'],
  GLA: ['Lysosomal enzyme α-galactosidase A.', 'Enzyme lysosome α-galactosidase A.', 'Senescent cells expand their lysosomes, which is what SA-β-gal staining detects', 'Tế bào lão hóa tăng lysosome, chính là điều nhuộm SA-β-gal phát hiện', 'lee'],
  CCNA2: ['Cyclin A2, drives DNA copying and entry into division.', 'Cyclin A2, thúc đẩy sao chép DNA và bước vào phân bào.', 'Cell-division gene; falls when cells stop dividing', 'Gene phân bào; giảm khi tế bào ngừng phân chia', 'hallmark'],
  GADD45A: ['DNA-damage-inducible growth-arrest gene.', 'Gene gây ngừng tăng trưởng khi DNA tổn thương.', 'p53 target in the senescence arrest pathway', 'Đích của p53 trong con đường ngừng phân chia', 'kumari'],
  BCAP31: ['Membrane protein of the endoplasmic reticulum, for protein export and ER stress.', 'Protein màng lưới nội chất, phục vụ vận chuyển protein và stress lưới nội chất.', null, null],
  ATOX1: ['Copper chaperone with an antioxidant role.', 'Protein vận chuyển đồng, có vai trò chống oxy hóa.', null, null],
  HMGB1: ['Chromatin protein that bends DNA.', 'Protein nhiễm sắc thể làm uốn DNA.', 'Leaves the nucleus and is released by senescent cells, promoting inflammatory secretion', 'Rời nhân và được tế bào lão hóa tiết ra, thúc đẩy tiết chất viêm', 'davalos'],
  HNRNPDL: ['RNA-binding protein in mRNA processing.', 'Protein gắn RNA trong xử lý mRNA.', null, null],
  CLCN3: ['Chloride/proton exchanger in endosomes and lysosomes.', 'Kênh trao đổi chloride/proton ở endosome và lysosome.', null, null],
  HP1BP3: ['Binds heterochromatin protein 1 and compacts chromatin.', 'Gắn protein dị nhiễm sắc HP1 và nén chất nhiễm sắc.', null, null],
  UBQLN1: ['Ubiquilin-1, shuttles proteins to the proteasome and autophagy.', 'Ubiquilin-1, đưa protein đến proteasome và tự thực.', null, null],
  BLOC1S2: ['Subunit of BLOC-1, builds lysosome-related organelles.', 'Tiểu đơn vị BLOC-1, tạo các bào quan liên quan lysosome.', null, null],
  GABARAPL2: ['ATG8-family protein on autophagosome membranes.', 'Protein họ ATG8 trên màng thể tự thực.', null, null],
  CEP192: ['Centrosome protein needed to build the mitotic spindle.', 'Protein trung thể cần để tạo thoi phân bào.', null, null],
  HMGB1P6: ['Pseudogene copy of HMGB1.', 'Giả gene, bản sao của HMGB1.', null, null],
  HMGB1P5: ['Pseudogene copy of HMGB1.', 'Giả gene, bản sao của HMGB1.', null, null],
};

function flagText(f) {
  if (!f) return '';
  if (f.startsWith('HMGB1 pseudogene')) return t('Pseudogene: qPCR primers cannot tell it apart from HMGB1', 'Giả gene: mồi qPCR không phân biệt được với HMGB1') + (f.includes('no passage') ? t('; no passage-direction data', '; không có dữ liệu hướng theo passage') : '');
  const m = f.match(/(\d+) donors up, (\d+) down, expected (\w+)/);
  if (m) return t(`Inconsistent direction (${m[1]} up, ${m[2]} down; expected ${m[3]})`, `Hướng không nhất quán (${m[1]} tăng, ${m[2]} giảm; kỳ vọng ${m[3] === 'up' ? 'tăng' : 'giảm'})`);
  return f;
}

function panelChart(rows) {
  const cands = [...new Set(rows.map((r) => r.candidate))];
  const cohorts = [...new Set(rows.map((r) => r.cohort))];
  const W = 620, L = 196, R = 70, T = 14, bh = 15, gh = cohorts.length * bh + 14;
  const H = T + cands.length * gh + 30;
  const x = (v) => L + Math.max(0, v) * (W - L - R);
  const col = ['#7274b5', '#238b8d'];
  const name = (c) => c.replace('Panel 10 (frozen)', t('10-gene panel', 'Panel 10 gene')).replace('Panel 20 (frozen)', t('20-gene panel', 'Panel 20 gene')).replace(/qPCR-ready panel \((\d+) genes\)/, t('qPCR-ready panel, $1 genes', 'Panel sẵn cho qPCR, $1 gene')).replace('CDKN2A alone', t('CDKN2A alone', 'CDKN2A đơn lẻ'));
  return `<div class="panel-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('Within-donor agreement of each candidate with the RNA-seq SenCat score', 'Mức khớp trong từng người hiến của mỗi ứng viên với điểm SenCat RNA-seq'))}">
    ${[0, 0.25, 0.5, 0.75, 1].map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="${T - 4}" y2="${H - 26}" stroke="${C.grid}"/><text x="${x(v)}" y="${H - 10}" text-anchor="middle">${v}</text>`).join('')}
    ${cands.map((c, i) => {
      const y0 = T + i * gh;
      return `<text x="${L - 10}" y="${y0 + gh / 2}" text-anchor="end" class="lbl">${esc(name(c))}</text>` + cohorts.map((k, j) => {
        const r = rows.find((q) => q.candidate === c && q.cohort === k);
        const y = y0 + j * bh;
        return `<rect x="${L}" y="${y}" width="${x(r.within_donor_pearson) - L}" height="${bh - 3}" rx="2" fill="${col[j % 2]}" data-tip="${esc(`${name(c)} · ${k}: r = ${r.within_donor_pearson}; ${t('direction matches RNA-seq in', 'cùng hướng với RNA-seq ở')} ${r.direction_matches_rnaseq}/${r.donors}`)}"/><text x="${x(r.within_donor_pearson) + 5}" y="${y + bh - 5}" font-size="11">${r.within_donor_pearson.toFixed(2)} · ${r.direction_matches_rnaseq}/${r.donors}</text>`;
      }).join('');
    }).join('')}
  </svg></div><div class="atlas-legend">${cohorts.map((k, j) => `<span><i style="background:${col[j % 2]}"></i>${k === 'GSE309666' ? t('GSE309666, adipose, 5 donors', 'GSE309666, mô mỡ, 5 người hiến') : t('GSE178514, bone marrow, 3 donors', 'GSE178514, tủy xương, 3 người hiến')}</span>`).join('')}<span>${t('Bar: within-donor correlation with RNA-seq SenCat · label: r · donors with the same direction', 'Thanh: tương quan trong từng người hiến với SenCat RNA-seq · nhãn: r · số người hiến cùng hướng')}</span></div>`;
}

export function renderPanel(el, panel) {
  const genes = panel.genes;
  const ready = genes.filter((g) => !g.flag).length;
  const get = (cand, coh) => panel.comparison.find((r) => r.candidate.startsWith(cand) && r.cohort === coh);
  const pBM = get('qPCR-ready', 'GSE178514'), cBM = get('CDKN2A', 'GSE178514');
  const rows = genes.map((g) => {
    const info = GENES[g.symbol] ?? [g.symbol, g.symbol, null, null];
    const link = info[2] ? `${t(info[2], info[3])} (${REF[info[4]]})` : t('Not established; selected from data', 'Chưa xác lập; được chọn từ dữ liệu');
    const dir = g.donors_up === null ? '–' : `${g.donors_up}↑ ${g.donors_down}↓`;
    const expect = g.sencat_sign > 0 ? '↑' : '↓';
    return `<tr class="${g.flag ? 'flagged' : ''}"><td><b>${esc(g.symbol)}</b>${g.in_panel_10 ? ' <span class="tag">10</span>' : ''}</td>
      <td>${t(info[0], info[1])} <a href="https://www.ncbi.nlm.nih.gov/gene/?term=${g.gene_id}" title="NCBI Gene">NCBI</a></td><td>${link}</td>
      <td class="num">${dir}<small> (${t('expected', 'kỳ vọng')} ${expect})</small></td><td>${g.flag ? `<span class="flag flag-review">${esc(flagText(g.flag))}</span>` : `<span class="flag flag-noise">${t('Suitable', 'Phù hợp')}</span>`}</td></tr>`;
  }).join('');
  el.innerHTML = `<div class="evidence-chart"><h3>${t('Candidate qPCR panel', 'Panel qPCR ứng viên')} <span class="tag">${t('exploratory', 'thăm dò')}</span></h3>
    <p class="note">${t(`Running RNA-seq on every lot is slow and costly. A qPCR panel of 10 to 20 genes is cheaper, gives results within a day, and is what a lab can use routinely. We condensed the signature into 10- and 20-gene candidate panels and checked them against the RNA-seq SenCat score, which stays the reference. After removing ${genes.length - ready} genes that are unsuitable for qPCR, ${ready} remain.`,
      `Làm RNA-seq cho mọi lô vừa chậm vừa tốn kém. Panel qPCR 10–20 gene rẻ hơn, có kết quả trong ngày và là thứ lab dùng được thường xuyên. Chúng tôi rút chữ ký thành các panel ứng viên 10 và 20 gene và đối chiếu với điểm SenCat từ RNA-seq, vẫn là chuẩn tham chiếu. Sau khi loại ${genes.length - ready} gene không phù hợp cho qPCR, còn lại ${ready} gene.`)}</p>
    ${panelChart(panel.comparison)}
    <p class="note">${t(`Same measure for every candidate: how closely it follows the RNA-seq SenCat score within each donor across passages. In bone marrow (GSE178514), which was not used to choose or flag any gene, the ${ready}-gene panel followed RNA-seq at r = ${pBM.within_donor_pearson.toFixed(2)} and matched its direction in ${pBM.direction_matches_rnaseq} of ${pBM.donors} donors. CDKN2A alone reached r = ${cBM.within_donor_pearson.toFixed(2)} and ${cBM.direction_matches_rnaseq} of ${cBM.donors}. In adipose (GSE309666) every candidate followed closely, but the flags were set using that cohort's directions.`,
      `Cùng một thước đo cho mọi ứng viên: mức bám sát điểm SenCat RNA-seq trong từng người hiến qua các passage. Ở tủy xương (GSE178514), cohort không dùng để chọn hay gắn cờ gene nào, panel ${ready} gene bám RNA-seq với r = ${pBM.within_donor_pearson.toFixed(2)} và cùng hướng ở ${pBM.direction_matches_rnaseq}/${pBM.donors} người hiến. CDKN2A đơn lẻ đạt r = ${cBM.within_donor_pearson.toFixed(2)} và ${cBM.direction_matches_rnaseq}/${cBM.donors}. Ở mô mỡ (GSE309666) mọi ứng viên đều bám sát, nhưng cờ được đặt dựa trên hướng thay đổi của chính cohort này.`)}</p>
    <div class="table-wrap"><table class="gene-table"><thead><tr><th>${t('Gene', 'Gene')}</th><th>${t('Function (source)', 'Chức năng (nguồn)')}</th><th>${t('Link to cell aging', 'Liên hệ với lão hóa tế bào')}</th><th class="num">${t('Donors up / down with passage', 'Số người hiến tăng / giảm theo passage')}</th><th>${t('qPCR design', 'Thiết kế qPCR')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="atlas-caption">${t('"10" marks the 10-gene panel. Direction: adipose MSC, GSE309666, 5 donors, passage 1 to 10; "expected" is the sign of the published SenCat weight. Function summaries follow NCBI Gene.', '"10" đánh dấu panel 10 gene. Hướng: MSC mô mỡ, GSE309666, 5 người hiến, passage 1 đến 10; "kỳ vọng" là dấu của trọng số SenCat đã công bố. Tóm tắt chức năng theo NCBI Gene.')}</p>
    <details><summary>${t('Method and limits', 'Phương pháp và giới hạn')}</summary><ul class="reading">
      <li>${t('Panels were chosen on non-MSC development data (L1 selection across held-out cell types) and frozen before any MSC data were looked at.', 'Các panel được chọn trên dữ liệu phát triển không phải MSC (chọn L1 qua các loại tế bào để riêng) và cố định trước khi xem dữ liệu MSC.')}</li>
      <li>${t('Each panel was scored the way a qPCR panel would be read: log expression, standardized per gene within the cohort, signed by the published SenCat weight and averaged. No weights were fitted on MSC data.', 'Mỗi panel được chấm điểm như cách đọc một panel qPCR: log biểu hiện, chuẩn hóa theo từng gene trong cohort, nhân dấu trọng số SenCat đã công bố rồi lấy trung bình. Không khớp trọng số nào trên dữ liệu MSC.')}</li>
      <li>${t('These values come from RNA-seq measurements of the panel genes, not from real qPCR. Primers have not been designed or tested. Eight donors in two cohorts are too few for firm conclusions.', 'Các giá trị này lấy từ số đo RNA-seq của các gene trong panel, không phải từ qPCR thật. Chưa thiết kế hay thử mồi. Tám người hiến trong hai cohort là quá ít để kết luận chắc chắn.')}</li>
    </ul></details></div>`;
}
