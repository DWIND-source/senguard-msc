// Keeps the app usable offline once it has been opened, including on a venue network that drops.
const CACHE = 'senguard-v9';
const CORE = ['./', './index.html', './css/app.css', './js/app.js', './js/core.js', './js/charts.js', './js/evidence.js', './js/twin.js', './vendor/three.module.min.js', './vendor/OrbitControls.js', './icon.svg', './manifest.webmanifest',
  './data/evidence.json', './data/clock.json', './data/forecast.json', './data/signature.json', './data/symbol_to_ensembl.json.gz', './data/adipose_msc_counts.tsv.gz', './data/adipose_msc_samples.csv', './data/bone_marrow_msc_tpm.tsv.gz', './data/bone_marrow_msc_samples.csv', './data/bone_marrow_msc_entrez_ids.tsv.gz', './data/mislabelled_gse125632_fpkm.tsv.gz', './data/mislabelled_gse125632_samples.csv'];
CORE.push('./js/atlas.js', './js/md-preview.js', './js/molecule.js', './data/md/preview.json.gz', './js/i18n.js', './js/insights.js', './data/insights.json', './data/panel.json');
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const cacheable = url.origin === location.origin || url.hostname === 'raw.githubusercontent.com' || url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com');
  if (!cacheable) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: url.origin === location.origin })));
});
