// Culture twin stage. Every sphere is a measured sample and every position comes from data; nothing is simulated.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

const LOW = new THREE.Color('#2f6db5');
const HIGH = new THREE.Color('#bfe0ff');
const PICK = new THREE.Color('#ff9a62');
const GHOST = new THREE.Color('#ff9a62');
const INK = '#dbe6f3';
const MUTE = '#8ea2b8';

function textSprite(text, { size = 26, color = INK, weight = 500 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `${weight} ${size * 2}px "IBM Plex Sans", system-ui, sans-serif`;
  ctx.font = font;
  c.width = Math.ceil(ctx.measureText(text).width) + 16;
  c.height = size * 2 + 16;
  const g = c.getContext('2d');
  g.font = font;
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.fillText(text, 8, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const h = 0.0165 * size;
  s.scale.set((h * c.width) / c.height, h, 1);
  return s;
}

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class CultureTwin {
  constructor(host, { onSelect, onPassage } = {}) {
    this.host = host;
    this.onSelect = onSelect;
    this.onPassage = onPassage;
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#0e1a2b', 22, 46);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.home = new THREE.Vector3(13.4, 9.4, 16.8);
    this.camera.position.copy(this.home);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.75, 0.2);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 42;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.enablePan = false;
    this.controls.autoRotate = !this.reduce;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; this.moved = true; this.wake(60); });
    this.controls.addEventListener('change', () => this.wake(2));
    this.scene.add(new THREE.AmbientLight('#9db8d8', 1.5));
    const key = new THREE.DirectionalLight('#ffffff', 2.4);
    key.position.set(6, 12, 8);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#6fa8ff', 1.2);
    rim.position.set(-8, 3, -8);
    this.scene.add(rim);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.sphereGeo = new THREE.SphereGeometry(0.17, 28, 20);
    this.segGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 12);
    this.segGeo.rotateX(Math.PI / 2);
    this.floor();
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 12, 48), new THREE.MeshBasicMaterial({ color: PICK }));
    this.ring.visible = false;
    this.scene.add(this.ring);
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.nodes = [];
    this.segments = [];
    this.view = 'landscape';
    this.tween = null;
    this.active = 120;
    this.onScreen = true;
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) this.pick(e, true);
    });
    el.addEventListener('pointermove', (e) => this.pick(e, false));
    el.addEventListener('pointerleave', () => { this.hover(null); });
    new ResizeObserver(() => this.resize()).observe(host);
    new IntersectionObserver(([en]) => { this.onScreen = en.isIntersecting; if (en.isIntersecting) this.wake(30); }).observe(host);
    this.resize();
    const loop = (t) => { requestAnimationFrame(loop); this.frame(t); };
    requestAnimationFrame(loop);
  }

  floor() {
    const grid = new THREE.GridHelper(14, 14, '#31475f', '#1f3147');
    grid.material.transparent = true;
    grid.material.opacity = 0.75;
    this.scene.add(grid);
  }

  wake(n = 30) { this.active = Math.max(this.active, n); }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    if (!this.moved) {   // narrow screens need more distance to fit the same scene
      const k = Math.max(1, 1.12 / (w / h));
      this.camera.position.copy(this.home).sub(this.controls.target).multiplyScalar(k).add(this.controls.target);
    }
    this.camera.updateProjectionMatrix();
    this.wake(10);
  }

  clear() {
    this.world.traverse((o) => { if (o.material?.map) o.material.map.dispose(); if (o.material && o !== this.world) o.material.dispose?.(); });
    this.world.clear();
    this.nodes = [];
    this.segments = [];
    this.axes = null;
    this.selected = null;
    this.ring.visible = false;
    this.focusDonor = null;
    this.wake(20);
  }

  // result: trends and expression space; fc: forecast from each donor's earliest sample
  setData(result, fc) {
    this.clear();
    const trends = result.trends;
    const all = trends.flatMap((t) => t.points);
    const [lo, hi] = [Math.min(...all.map((p) => p.score)), Math.max(...all.map((p) => p.score))];
    const passages = [...new Set(all.map((p) => p.passage))].sort((a, b) => a - b);
    this.passages = passages;
    const [p0, p1] = [passages[0], passages[passages.length - 1]];
    const lane = (i) => (trends.length === 1 ? 0 : -3.4 + (6.8 * i) / (trends.length - 1));
    const coords = result.state?.coords ?? {};
    const maxAbs = Math.max(1e-9, ...Object.values(coords).flat().map(Math.abs));
    const toSpace = (id) => { const c = coords[id] ?? [0, 0, 0]; const k = 4.6 / maxAbs; return new THREE.Vector3(c[0] * k, 2.6 + c[1] * k * 0.8, c[2] * k); };
    trends.forEach((t, i) => {
      let prev = null;
      t.points.forEach((p) => {
        const heat = (p.score - lo) / (hi - lo || 1);
        const color = LOW.clone().lerp(HIGH, heat);
        const land = new THREE.Vector3(-5.6 + (11.2 * (p.passage - p0)) / (p1 - p0 || 1), 0.25 + 5 * heat, lane(i));
        const mesh = new THREE.Mesh(this.sphereGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1, emissive: color, emissiveIntensity: 0.32, transparent: true }));
        const node = { mesh, point: p, donor: t.donor, land, space: toSpace(p.id), fore: land.clone(), shown: 0, target: 1, passage: p.passage };
        mesh.userData.node = node;
        mesh.position.copy(land);
        this.world.add(mesh);
        const stem = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#3f5a78', transparent: true, opacity: 0.55 }));
        this.world.add(stem);
        node.stem = stem;
        this.nodes.push(node);
        if (prev) {
          const seg = new THREE.Mesh(this.segGeo, new THREE.MeshStandardMaterial({ color: prev.mesh.material.color.clone().lerp(color, 0.5), roughness: 0.45, transparent: true, emissive: color, emissiveIntensity: 0.14 }));
          this.world.add(seg);
          this.segments.push({ mesh: seg, a: prev, b: node, donor: t.donor });
        }
        prev = node;
      });
    });
    this.buildAxes({ trends, lane, p0, p1, passages, lo, hi, varExplained: result.state?.varExplained ?? [] });
    this.buildForecast(fc, trends, lane);
    this.view = 'landscape';
    this.fromKey = 'land';
    this.toKey = 'land';
    this.mix = 1;
    this.applyView();
    this.setPassage(p1, false);
    this.controls.autoRotate = !this.reduce;
    this.wake(120);
    return passages;
  }

  buildAxes({ trends, lane, p0, p1, passages, lo, hi, varExplained }) {
    const land = new THREE.Group(), space = new THREE.Group();
    const shown = passages.length <= 8 ? passages : passages.filter((_, i) => i % Math.ceil(passages.length / 8) === 0);
    shown.forEach((p) => {
      const s = textSprite(`P${p}`, { color: MUTE, size: 24 });
      s.position.set(-5.6 + (11.2 * (p - p0)) / (p1 - p0 || 1), 0.05, 4.55);
      land.add(s);
    });
    const title = textSprite('Passage', { size: 28, weight: 600 });
    title.position.set(0, 0.05, 5.5);
    land.add(title);
    trends.forEach((t, i) => {
      const s = textSprite(String(t.donor), { size: 26, weight: 600 });
      s.position.set(-6.9, 0.25, lane(i));
      land.add(s);
    });
    [[0, lo], [0.5, (lo + hi) / 2], [1, hi]].forEach(([f, v]) => {
      const s = textSprite(v.toFixed(1), { color: MUTE, size: 24 });
      s.position.set(-6.75, 0.25 + 5 * f, -4.6);
      land.add(s);
    });
    const yTitle = textSprite('SenCat score', { size: 28, weight: 600 });
    yTitle.position.set(-6.2, 5.95, -4.6);
    land.add(yTitle);
    const post = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-6.2, 0, -4.6), new THREE.Vector3(-6.2, 5.3, -4.6)]), new THREE.LineBasicMaterial({ color: '#4d6885' }));
    land.add(post);
    const axisLine = (a, b) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: '#4d6885' }));
    const O = new THREE.Vector3(0, 2.6, 0);
    const pct = (i) => (varExplained[i] != null ? ` (${Math.round(varExplained[i] * 100)}%)` : '');
    [[new THREE.Vector3(5.6, 0, 0), `PC1${pct(0)}`], [new THREE.Vector3(0, 3.1, 0), `PC2${pct(1)}`], [new THREE.Vector3(0, 0, 5.6), `PC3${pct(2)}`]].forEach(([d, label]) => {
      space.add(axisLine(O.clone().sub(d), O.clone().add(d)));
      const s = textSprite(label, { size: 28, weight: 600 });
      s.position.copy(O).add(d.clone().multiplyScalar(1.08));
      space.add(s);
    });
    this.nodesDonorLabels = [];
    this.axes = { land, space };
    this.world.add(land, space);
  }

  buildForecast(fc, trends, lane) {
    this.ghost = new THREE.Group();
    this.world.add(this.ghost);
    this.axes.fore = new THREE.Group();
    this.world.add(this.axes.fore);
    if (!fc || fc.skipped) { this.hasForecast = false; return; }
    this.hasForecast = true;
    const vals = fc.donors.flatMap((d) => [...d.curve.map((c) => c.score), ...d.actual.map((a) => a.score)]);
    const [lo, hi] = [Math.min(...vals), Math.max(...vals)];
    const top = Math.max(...fc.donors.flatMap((d) => d.curve.map((c) => c.passage)));
    const start = Math.min(...fc.donors.map((d) => d.startPassage));
    const sx = (p) => -5.6 + (11.2 * (p - start)) / (top - start || 1);
    const sy = (v) => 0.25 + 5 * ((v - lo) / (hi - lo || 1));
    const laneOf = new Map(trends.map((t, i) => [t.donor, lane(i)]));
    const ghostGeo = new THREE.SphereGeometry(0.075, 14, 10);
    const ghostMat = new THREE.MeshBasicMaterial({ color: GHOST, transparent: true, opacity: 0.85 });
    fc.donors.forEach((d) => {
      const z = laneOf.get(d.donor) ?? 0;
      const pts = d.curve.map((c) => new THREE.Vector3(sx(c.passage), sy(c.score), z));
      this.ghost.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: GHOST, transparent: true, opacity: 0.75 })));
      pts.forEach((pt) => { const m = new THREE.Mesh(ghostGeo, ghostMat); m.position.copy(pt); this.ghost.add(m); });
      for (const a of d.actual) {
        const n = this.nodes.find((x) => x.point.id === a.id);
        if (n) n.fore = new THREE.Vector3(sx(a.passage), sy(a.score), z);
      }
    });
    const ax = this.axes.fore;
    const ticks = [...new Set([start, ...[5, 10, 15].filter((p) => p > start && p <= top), top])];
    ticks.forEach((p) => { const s = textSprite(`P${p}`, { color: MUTE, size: 24 }); s.position.set(sx(p), 0.05, 4.55); ax.add(s); });
    const title = textSprite('Passage', { size: 28, weight: 600 });
    title.position.set(0, 0.05, 5.5);
    ax.add(title);
    trends.forEach((t, i) => { const s = textSprite(String(t.donor), { size: 26, weight: 600 }); s.position.set(-6.9, 0.25, lane(i)); ax.add(s); });
    [[0, lo], [0.5, (lo + hi) / 2], [1, hi]].forEach(([f, v]) => { const s = textSprite(v.toFixed(2), { color: MUTE, size: 24 }); s.position.set(-6.75, 0.25 + 5 * f, -4.6); ax.add(s); });
    const yt = textSprite('SenCat rank score', { size: 28, weight: 600 });
    yt.position.set(-5.9, 5.95, -4.6);
    ax.add(yt);
    ax.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-6.2, 0, -4.6), new THREE.Vector3(-6.2, 5.3, -4.6)]), new THREE.LineBasicMaterial({ color: '#4d6885' })));
  }

  applyView() {
    if (!this.axes) return;
    const m = this.mix;
    const v = new THREE.Vector3();
    for (const n of this.nodes) {
      v.copy(n[this.fromKey]).lerp(n[this.toKey], m);
      n.mesh.position.copy(v);
      const s = Math.max(n.shown, 0.0001);
      n.mesh.scale.setScalar(s);
      n.mesh.visible = n.shown > 0.01;
      const pos = n.stem.geometry.attributes.position;
      pos.setXYZ(0, v.x, v.y, v.z);
      pos.setXYZ(1, v.x, 0, v.z);
      pos.needsUpdate = true;
      const stemK = this.toKey === 'space' ? 1 - m : this.fromKey === 'space' ? m : 1;
      n.stem.material.opacity = 0.55 * stemK * n.shown * (this.dim(n.donor) ? 0.25 : 1);
      n.stem.visible = stemK > 0.02 && n.mesh.visible;
      const op = this.dim(n.donor) ? 0.16 : 1;
      n.mesh.material.opacity = op;
    }
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (const s of this.segments) {
      a.copy(s.a.mesh.position);
      b.copy(s.b.mesh.position);
      const k = Math.min(s.a.shown, s.b.shown);
      s.mesh.visible = k > 0.01;
      if (!s.mesh.visible) continue;
      b.lerp(a, 1 - k);
      s.mesh.position.copy(a).add(b).multiplyScalar(0.5);
      s.mesh.lookAt(b);
      s.mesh.scale.set(1, 1, a.distanceTo(b));
      s.mesh.material.opacity = this.dim(s.donor) ? 0.12 : 0.92;
    }
    const onKey = m >= 0.5 ? this.toKey : this.fromKey;
    this.axes.land.visible = onKey === 'land';
    this.axes.space.visible = onKey === 'space';
    this.axes.fore.visible = onKey === 'fore';
    this.ghost.visible = onKey === 'fore';
    if (this.ghost.visible) this.ghost.children.forEach((c) => { if (c.isLine) c.material.opacity = this.focusDonor ? 0.35 : 0.75; });
    if (this.selected) { this.ring.position.copy(this.selected.mesh.position); this.ring.visible = this.selected.mesh.visible; }
  }

  dim(donor) { return this.focusDonor != null && donor !== this.focusDonor; }

  setFocus(donor) { this.focusDonor = donor; this.applyView(); this.wake(10); }

  setView(view) {
    if (view === this.view) return;
    const key = { landscape: 'land', space: 'space', forecast: 'fore' }[view];
    this.fromKey = this.toKey;
    this.toKey = key;
    this.view = view;
    if (this.reduce) { this.mix = 1; this.applyView(); this.wake(5); return; }
    this.mix = 0;
    this.tween = { from: 0, to: 1, start: performance.now(), dur: 1100 };
    this.wake(90);
  }

  setPassage(p, animate = true) {
    this.upTo = p;
    for (const n of this.nodes) n.target = n.passage <= p ? 1 : 0;
    if (!animate || this.reduce) { for (const n of this.nodes) n.shown = n.target; this.applyView(); }
    this.wake(60);
    this.onPassage?.(p);
  }

  select(node) {
    this.selected = node;
    this.ring.visible = !!node;
    if (node) this.ring.position.copy(node.mesh.position);
    this.onSelect?.(node ? { ...node.point, donor: node.donor } : null);
    this.wake(10);
  }

  selectById(id) { this.select(this.nodes.find((n) => n.point.id === id) ?? null); }

  hover(node) {
    const tip = document.getElementById('tip');
    this.renderer.domElement.style.cursor = node ? 'pointer' : 'grab';
    if (!tip) return;
    if (!node) { tip.hidden = true; return; }
    tip.textContent = `Donor ${node.donor}, passage ${node.passage}: score ${node.point.score.toFixed(2)}`;
    tip.hidden = false;
  }

  pick(e, click) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray.intersectObjects(this.nodes.filter((n) => n.mesh.visible).map((n) => n.mesh))[0];
    const node = hit?.object.userData.node ?? null;
    if (click) { if (node) { this.select(node); this.controls.autoRotate = false; } return; }
    this.hover(node);
    if (node) {
      const tip = document.getElementById('tip');
      if (tip) { tip.style.left = `${Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8)}px`; tip.style.top = `${e.clientY + 14}px`; }
    }
  }

  frame(now) {
    if (document.hidden || !this.onScreen) return;
    const auto = this.controls.autoRotate && this.nodes.length;
    let changed = false;
    const dt = Math.min(500, now - (this.lastNow ?? now));   // time-based, so slow machines animate at the same speed
    this.lastNow = now;
    const ease = 1 - Math.exp(-dt / 110);
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.dur);
      this.mix = this.tween.from + (this.tween.to - this.tween.from) * easeInOut(t);
      changed = true;
      if (t >= 1) this.tween = null;
    }
    for (const n of this.nodes) {
      if (Math.abs(n.shown - n.target) > 0.002) { n.shown += (n.target - n.shown) * ease; changed = true; } else if (n.shown !== n.target) { n.shown = n.target; changed = true; }
    }
    if (changed) { this.applyView(); this.wake(2); }
    if (this.ring.visible) this.ring.lookAt(this.camera.position);
    if (auto || this.active > 0) {
      this.controls.update();
      for (const s of this.world.children) s.updateMatrixWorld?.();
      this.renderer.render(this.scene, this.camera);
      if (this.active > 0) this.active--;
    }
  }
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
