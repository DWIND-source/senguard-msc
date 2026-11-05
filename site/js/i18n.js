// English / Vietnamese switch. Static text carries data-i18n keys; English stays in the HTML and Vietnamese lives here.
// Dynamic text calls t(english, vietnamese). Changing language fires a 'langchange' event so views can redraw.
const KEY = 'senguard-lang';
let current = 'en';
try { if (localStorage.getItem(KEY) === 'vi') current = 'vi'; } catch { /* storage blocked: stay in English */ }
const browser = typeof document !== 'undefined';
const asked = browser ? new URLSearchParams(location.search).get('lang') : null;
if (asked === 'vi' || asked === 'en') current = asked;

export const lang = () => current;
export const t = (en, vi) => (current === 'vi' ? vi : en);

const VI = {
  navTwin: 'Mô phỏng nuôi cấy', navAtlas: 'Bản đồ biểu hiện', navProcess: 'So sánh nuôi cấy', navImmune: 'Đáp ứng IFN-γ', navMolecular: 'Cấu trúc phân tử', navEvidence: 'Kiểm chứng', navMethod: 'Cách hoạt động', navCode: 'Mã nguồn',
  heroKicker: 'Nuôi cấy MSC · bản đồ biểu hiện gene · cấu trúc phân tử',
  heroTitle: 'Theo dõi nuôi cấy MSC từ ngân hàng tế bào trở đi, đến từng gene.',
  heroLede: 'Theo dõi, đánh giá và so sánh các mẻ nuôi cấy MSC từ ngân hàng tế bào đến các lần cấy chuyển sau. Heatmap biểu hiện gene, bản đồ mẫu và đường biến đổi theo passage nằm trong một giao diện liên kết, giúp nhóm nghiên cứu so sánh điều kiện nuôi cấy như môi trường, chất bổ sung huyết thanh và số passage tối đa. Tải một chuỗi mẫu để theo dõi từng người hiến, hoặc một mẫu sớm để xem dự báo. Dữ liệu của bạn chỉ nằm trong trình duyệt này.',
  sencatWhatH: 'Điểm SenCat là gì?',
  sencatWhat: 'SenCat là một chữ ký biểu hiện gene đã công bố, mô tả tình trạng lão hóa tế bào (senescence): tế bào ngừng phân chia lâu dài, tích lũy dần khi nuôi cấy kéo dài. Chữ ký được xây dựng từ nhiều loại tế bào người lão hóa và bình thường (<a href="https://doi.org/10.1016/j.molcel.2026.05.017">Anerillas và cs., Mol Cell 2026</a>). Điểm số cân các gene tăng hoặc giảm ở tế bào lão hóa. Hãy đọc điểm theo thời gian trong cùng một người hiến: điểm cao hơn nghĩa là hồ sơ gene giống lão hóa hơn, không có nghĩa lô hỏng.',
  heroAtlas: 'Xem bản đồ biểu hiện →', heroProcess: 'So sánh phương án nuôi cấy →',
  scAdipose: 'MSC mô mỡ', scAdiposeS: 'GSE309666 · 5 người hiến', scMarrow: 'MSC tủy xương', scMarrowS: 'GSE178514 · 3 người hiến (suy luận)', scEarly: 'Chỉ mẫu sớm', scEarlyS: 'Chỉ passage 1, dự báo phần còn lại',
  scLogged: 'Đã lấy log sẵn', scBadS: 'Dữ liệu sai, cố ý', scEntrez: 'Sai mã gene', scMislabel: 'Lỗi ghi nhãn thật', scMislabelS: 'GSE125632, như trên GEO', scUpload: 'Dùng dữ liệu của tôi', scUploadS: 'Chỉ nằm trong trình duyệt',
  upTable: '1. Bảng biểu hiện gene', upTableS: 'Cột đầu là mã Ensembl hoặc tên gene, mỗi mẫu một cột. .tsv, .csv hoặc .gz', upScale: '2. Đơn vị dữ liệu', upScaleS: 'Chỉ giá trị chưa biến đổi', upSheet: 'Bảng mô tả mẫu (không bắt buộc)', upSheetS: 'Các cột sample_id, donor, passage, hoặc điền bảng bên dưới',
  upTell: '3. Thông tin từng mẫu', upUse: 'Dùng', upColumn: 'Cột', upDonor: 'Người hiến', upPassage: 'Passage', upRun: 'Kiểm tra và dựng mô phỏng', upExample: 'Bảng mẫu',
  vFore: 'Dự báo và thực đo', vLand: 'Địa hình điểm số', vSpace: 'Không gian biểu hiện', scaleLow: 'Thấp', scaleHigh: 'Điểm cao',
  refusalFoot: 'Dữ liệu này sẽ cho ra con số trông hợp lệ nhưng sai, nên mô phỏng không được dựng.', noWebgl: 'Trình duyệt này không hỗ trợ 3D. Mọi kết quả nằm trong các biểu đồ bên dưới.',
  processKicker: 'Phát triển quy trình và so sánh lô', processH: 'So sánh phương án nuôi cấy, từ ngân hàng tế bào trở đi',
  immuneKicker: 'Hướng nghiên cứu · không thuộc điểm số', immuneH: 'Đáp ứng miễn dịch với IFN-γ',
  molKicker: 'Từ biểu hiện gene đến cấu trúc phân tử', molH: 'Khám phá phức hợp p16–CDK6',
  molBackground: '<b>Chỉ để tham khảo: hình 3D của một protein liên quan đến lão hóa tế bào. Hình này không được tính từ dữ liệu của bạn.</b>',
  molNote: 'p16 do gene CDKN2A mã hóa, một trong các chỉ dấu được nghiên cứu ở đây. Mô hình phân tử độc lập này minh họa phức hợp; nó không đại diện cho mẫu tải lên và không thay đổi dự báo.',
  mdComplex: 'Phức hợp', mdInterface: 'Mặt tiếp xúc', mdWater: 'Nước và ion', mdRotate: 'Xoay hình', mdEyebrow: 'Khung cân bằng đã ghi · WT', mdPreviewH: 'Xem trước cấu trúc',
  mdSource: 'Một khung thật từ quá trình dựng và cân bằng bằng GROMACS.', mdPendingH: 'Đang chờ phân tích chính thức',
  mdPending: 'Dự kiến so sánh WT, R24P, D84N và H123Q, mỗi loại ba lần lặp. Chưa có kết quả RMSD, độ linh động và năng lượng liên kết trong bản xem trước này.',
  mdModelSource: 'Mô hình và nguồn', mdDownload: 'Tải tọa độ', mdProtocol: 'Kế hoạch phân tích',
  evidenceH: 'Kiểm chứng', methodH: 'Cách hoạt động',
  m1: 'Kiểm tra', m1p: 'Tên gene, định dạng số, độ phủ, độ sâu giải trình tự, danh tính người hiến và thiết kế nghiên cứu. Mỗi bước kiểm tra có mặt vì một lỗi thật đã gặp trong dữ liệu công khai.',
  m2: 'Chuẩn hóa', m2p: 'Đưa các mẫu giải trình tự với độ sâu khác nhau về cùng mặt bằng (median of ratios, đối chiếu với PyDESeq2). FPKM được quy đổi sang TPM.',
  m3: 'Chấm điểm', m3p: 'Áp dụng trọng số gene <a href="https://doi.org/10.1016/j.molcel.2026.05.017">SenCat</a> đã công bố, lấy đúng phiên bản cố định và kiểm tra checksum khi tải.',
  m4: 'Theo dõi từng người hiến', m4p: 'So mỗi người hiến với mẫu sớm nhất của chính người đó. Điểm từ các phòng lab hay môi trường khác nhau không bao giờ bị gộp vào một thang tuyệt đối.',
  m5: 'Dự báo và đối chứng', m5p: 'Mô hình trôi học từ nhiều cohort dự báo các passage sau. Bộ gene ngẫu nhiên và một "đồng hồ" giữ riêng đóng vai trò đối chứng.',
  glossH: 'Thuật ngữ dùng trên trang',
  gloss: `<dt>MSC</dt><dd>Tế bào gốc trung mô (mesenchymal stromal cells), nuôi cấy từ tủy xương, mô mỡ, dây rốn hoặc mô khác.</dd>
    <dt>Passage (P)</dt><dd>Một lần cấy chuyển tế bào sang bình mới. P3 nghĩa là tế bào đã được cấy chuyển ba lần.</dd>
    <dt>Người hiến (donor)</dt><dd>Người cho tế bào. Mỗi người hiến được so với chính mình.</dd>
    <dt>Ngân hàng tế bào</dt><dd>Kho tế bào sớm được trữ đông (ngân hàng gốc hoặc ngân hàng làm việc), dùng để nuôi cấy các mẻ sau.</dd>
    <dt>Lão hóa tế bào (senescence)</dt><dd>Tế bào ngừng phân chia lâu dài, tích lũy theo tuổi và theo số lần nuôi cấy.</dd>
    <dt>RNA-seq</dt><dd>Giải trình tự đo mức hoạt động (biểu hiện) của toàn bộ gene cùng lúc. Đây là phương pháp tham chiếu ở đây.</dd>
    <dt>qPCR</dt><dd>Xét nghiệm nhanh và rẻ hơn, đo một nhóm nhỏ gene được chọn.</dd>
    <dt>Z-score (màu heatmap)</dt><dd>Mức một mẫu lệch khỏi trung bình của gene đó trong các mẫu đang hiển thị, tính theo độ lệch chuẩn.</dd>
    <dt>Dự báo</dt><dd>Ước tính của mô hình cho các passage sau từ một mẫu sớm. Không phải số đo thực.</dd>`,
};

export function applyStatic() {
  document.documentElement.lang = current;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
    el.innerHTML = current === 'vi' ? VI[el.dataset.i18n] ?? el.dataset.en : el.dataset.en;
  });
  const btn = document.getElementById('lang-toggle');
  if (btn) {
    btn.textContent = current === 'vi' ? 'English' : 'Tiếng Việt';
    btn.lang = current === 'vi' ? 'en' : 'vi';
    btn.setAttribute('aria-label', current === 'vi' ? 'View in English' : 'Xem bằng tiếng Việt');
  }
}

export function setLang(next) {
  current = next;
  try { localStorage.setItem(KEY, next); } catch { /* not remembered, still switches */ }
  applyStatic();
  document.dispatchEvent(new CustomEvent('langchange', { detail: next }));
}

if (browser) {
  applyStatic();
  document.getElementById('lang-toggle')?.addEventListener('click', () => setLang(current === 'vi' ? 'en' : 'vi'));
}
