// This view is deliberately a single, labelled equilibration snapshot.
// Production results will be released only after all replicas have been checked.
const $ = (id) => document.getElementById(id);

async function readPreview() {
  const response = await fetch('data/md/preview.json.gz');
  if (!response.ok) throw new Error(`Structure file returned HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const head = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
  const text = head[0] === 0x1f && head[1] === 0x8b
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes);
  const data = JSON.parse(text);
  if (data.status !== 'equilibration_preview' || data.frames !== 1 || data.coords.length !== data.natoms * 3) {
    throw new Error('Structure metadata is inconsistent');
  }
  return data;
}

async function initialize() {
  const host = $('md-canvas');
  try {
    const data = await readPreview();
    $('md-source-hash').textContent = data.sourceSha256;
    $('md-snapshot-info').textContent = `${data.nca} residues · ${data.waterMolecules.toLocaleString('en-US')} waters · ${data.ionCount} ions`;
    $('md-source-status').textContent = data.description;
    const { MoleculeStage } = await import('./molecule.js');
    const stage = new MoleculeStage(host, { onFrame: () => {} });
    // Empty RMSF means no flexibility estimate; the preview exposes no flexibility view.
    stage.setData({ ...data, coords: new Float32Array(data.coords), rmsf: [] });
    stage.setWater({ oxygen: new Float32Array(data.oxygen), ions: new Float32Array(data.ions) });
    window.__mol = stage;
    $('md-loading').hidden = true;
    $('md-preview-controls').hidden = false;
    const notes = {
      chain: 'Blue: CDK6. Orange: p16. Drag to rotate; scroll or pinch to zoom.',
      interface: 'Highlighted residues have C-alpha atoms within 10 Å across chains in this frame. Sticks mark selected interface residues.',
      water: 'Water and ions from the same equilibration frame, wrapped around the complex using its periodic simulation cell.',
    };
    for (const button of document.querySelectorAll('#md-preview-views button')) {
      button.addEventListener('click', () => {
        stage.setMode(button.dataset.mode);
        document.querySelectorAll('#md-preview-views button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        $('md-preview-note').textContent = notes[button.dataset.mode];
      });
    }
    const rotate = $('md-rotate');
    const syncRotate = () => {
      rotate.setAttribute('aria-pressed', String(stage.controls.autoRotate));
      rotate.textContent = stage.controls.autoRotate ? 'Pause rotation' : 'Rotate view';
    };
    rotate.addEventListener('click', () => { stage.controls.autoRotate = !stage.controls.autoRotate; stage.wake(5); syncRotate(); });
    stage.controls.addEventListener('start', syncRotate);
    syncRotate();
    $('md-preview-note').textContent = notes.chain;
  } catch (error) {
    $('md-loading').textContent = `The 3D preview could not load. ${error.message}. You can still download the source coordinates below.`;
    $('md-loading').setAttribute('role', 'status');
  }
}

const section = $('molecular');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); initialize(); }
  }, { rootMargin: '300px' });
  observer.observe(section);
} else initialize();
