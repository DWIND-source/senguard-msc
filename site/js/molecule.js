// Molecular stage. Coordinates come from recorded GROMACS frames, never procedural motion.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

const CDK6 = new THREE.Color('#7fb4f0');
const P16 = new THREE.Color('#ff9a62');
const LOW = new THREE.Color('#1f4f8f');
const HIGH = new THREE.Color('#f4f8ff');
const RADIAL = 8;
const SUB = 3;

// Tube through C-alpha atoms, rebuilt in place for each frame. Radius can follow per-residue flexibility.
class Tube {
  constructor(start, count) {
    this.start = start;
    this.count = count;
    this.rings = (count - 1) * SUB + 1;
    const nv = this.rings * RADIAL;
    this.pos = new Float32Array(nv * 3);
    this.nor = new Float32Array(nv * 3);
    this.col = new Float32Array(nv * 3);
    const idx = [];
    for (let r = 0; r < this.rings - 1; r++) {
      for (let k = 0; k < RADIAL; k++) {
        const a = r * RADIAL + k, b = r * RADIAL + ((k + 1) % RADIAL);
        idx.push(a, a + RADIAL, b, b, a + RADIAL, b + RADIAL);
      }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setIndex(idx);
    this.path = new Float32Array(this.rings * 3);
    this.radius = new Float32Array(this.rings);
  }

  update(ca, radiusAt) {
    const n = this.count, s = this.start, p = this.path;
    const get = (i, c) => ca[(s + Math.max(0, Math.min(n - 1, i))) * 3 + c];
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < SUB; j++) {
        const t = j / SUB, t2 = t * t, t3 = t2 * t, o = (i * SUB + j) * 3;
        for (let c = 0; c < 3; c++) {
          const a = get(i - 1, c), b = get(i, c), d = get(i + 1, c), e = get(i + 2, c);
          p[o + c] = 0.5 * (2 * b + (d - a) * t + (2 * a - 5 * b + 4 * d - e) * t2 + (3 * b - a - 3 * d + e) * t3);
        }
      }
    }
    for (let c = 0; c < 3; c++) p[(this.rings - 1) * 3 + c] = get(n - 1, c);
    const tan = new THREE.Vector3(), u = new THREE.Vector3(1, 0, 0), v = new THREE.Vector3(), nrm = new THREE.Vector3();
    const R = this.rings;
    for (let r = 0; r < R; r++) {
      const a = Math.max(0, r - 1) * 3, b = Math.min(R - 1, r + 1) * 3;
      tan.set(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]).normalize();
      u.addScaledVector(tan, -u.dot(tan));
      if (u.lengthSq() < 1e-4) u.set(tan.y, -tan.x, 0.3);
      u.normalize();
      v.crossVectors(tan, u);
      const rad = radiusAt(r / SUB);
      for (let k = 0; k < RADIAL; k++) {
        const th = (k / RADIAL) * Math.PI * 2, cs = Math.cos(th), sn = Math.sin(th);
        nrm.set(u.x * cs + v.x * sn, u.y * cs + v.y * sn, u.z * cs + v.z * sn);
        const o = (r * RADIAL + k) * 3;
        this.pos[o] = p[r * 3] + nrm.x * rad;
        this.pos[o + 1] = p[r * 3 + 1] + nrm.y * rad;
        this.pos[o + 2] = p[r * 3 + 2] + nrm.z * rad;
        this.nor[o] = nrm.x; this.nor[o + 1] = nrm.y; this.nor[o + 2] = nrm.z;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }

  paint(colorAt) {
    const c = new THREE.Color();
    for (let r = 0; r < this.rings; r++) {
      colorAt(r / SUB, c);
      for (let k = 0; k < RADIAL; k++) {
        const o = (r * RADIAL + k) * 3;
        this.col[o] = c.r; this.col[o + 1] = c.g; this.col[o + 2] = c.b;
      }
    }
    this.geo.attributes.color.needsUpdate = true;
  }
}

export class MoleculeStage {
  constructor(host, { onFrame } = {}) {
    this.host = host;
    this.onFrame = onFrame;
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 1, 1, 900);
    this.camera.position.set(40, 26, 150);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 40;
    this.controls.maxDistance = 340;
    this.controls.autoRotate = !this.reduce;
    this.controls.autoRotateSpeed = 0.5;
    this.controls.addEventListener('start', () => { this.controls.autoRotate = false; this.wake(60); });
    this.controls.addEventListener('change', () => this.wake(2));
    this.scene.add(new THREE.AmbientLight('#b6c9e0', 1.5));
    const key = new THREE.DirectionalLight('#ffffff', 2.3);
    key.position.set(60, 90, 70);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#6fa8ff', 1.1);
    rim.position.set(-70, 20, -60);
    this.scene.add(rim);
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05 });
    this.mode = 'chain';
    this.frame = 0;
    this.playing = false;
    this.alive = 120;
    this.last = 0;
    this.visible = true;
    this.io = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; if (this.visible) this.wake(5); });
    this.io.observe(host);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    this.renderer.domElement.addEventListener('pointermove', () => this.wake(10));
  }

  wake(n = 30) { this.alive = Math.max(this.alive, n); }

  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.wake(5);
  }

  // data: { coords: Float32Array (frames x atoms x 3, Angstrom), natoms, frames, nca, chains: [{start,count}], rmsf: [per CA],
  //         bonds: [[i,j]...], sticks: [{i,color}], interface: [ca indices], markers: [{ca,label}] }
  setData(data) {
    this.data = data;
    if (this.meshes) this.meshes.forEach((m) => { this.world.remove(m); m.geometry.dispose(); });
    this.tubes = data.chains.map((c) => new Tube(c.start, c.count));
    this.meshes = this.tubes.map((t) => {
      const m = new THREE.Mesh(t.geo, this.mat);
      m.frustumCulled = false;
      this.world.add(m);
      return m;
    });
    if (this.sticks) { this.world.remove(this.sticks); this.sticks.geometry.dispose(); this.sticks.material.dispose(); }
    const g = new THREE.BufferGeometry();
    this.stickPos = new Float32Array(data.bonds.length * 6);
    g.setAttribute('position', new THREE.BufferAttribute(this.stickPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.sticks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#ffe08a', linewidth: 1 }));
    this.sticks.frustumCulled = false;
    this.world.add(this.sticks);
    if (this.atoms) { this.world.remove(this.atoms); this.atoms.geometry.dispose(); this.atoms.material.dispose(); this.atoms.dispose(); }
    this.atomGeo = new THREE.SphereGeometry(0.62, 12, 10);
    this.atoms = new THREE.InstancedMesh(this.atomGeo, new THREE.MeshStandardMaterial({ roughness: 0.3 }), data.natoms - data.nca);
    this.atoms.frustumCulled = false;
    const ac = new THREE.Color();
    for (let i = 0; i < data.natoms - data.nca; i++) {
      ac.set(data.sideColors[i]);
      this.atoms.setColorAt(i, ac);
    }
    this.world.add(this.atoms);
    this.paint();
    this.show(Math.min(this.frame, data.frames - 1));
    this.center();
  }

  center() {
    const d = this.data, o = 0;
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < d.nca; i++) { x += d.coords[o + i * 3]; y += d.coords[o + i * 3 + 1]; z += d.coords[o + i * 3 + 2]; }
    this.world.position.set(-x / d.nca, -y / d.nca, -z / d.nca);
    if (this.water) this.water.position.set(0, 0, 0);
  }

  // Water, ions and the cell walls from one real frame of the solvated system
  setWater(w) {
    if (this.water) {
      this.world.remove(this.water);
      this.water.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(w.oxygen, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#7fc4ff', size: 1.15, sizeAttenuation: true, transparent: true, opacity: 0.38, depthWrite: false }));
    pts.frustumCulled = false;
    const ions = new THREE.BufferGeometry();
    ions.setAttribute('position', new THREE.BufferAttribute(w.ions, 3));
    const ip = new THREE.Points(ions, new THREE.PointsMaterial({ color: '#ffe08a', size: 3.2, sizeAttenuation: true }));
    ip.frustumCulled = false;
    this.water = new THREE.Group();
    this.water.add(pts, ip);
    this.water.visible = this.mode === 'water';
    this.world.add(this.water);
    this.wake(10);
  }

  setMode(mode) {
    if (!this.data) return;
    this.mode = mode;
    if (this.water) this.water.visible = mode === 'water';
    this.controls.minDistance = 40;
    if (mode === 'water') this.setFrame(this.data.frames - 1);
    this.camera.position.setLength(mode === 'water' ? 270 : 150);
    this.controls.update();
    this.paint();
    this.show(this.frame);
    this.wake(30);
  }

  paint() {
    if (!this.tubes) return;
    const { rmsf, chains, interface: iface } = this.data;
    const maxF = Math.max(...rmsf) || 1;
    const set = new Set(iface);
    this.tubes.forEach((t, ci) => {
      t.paint((r, c) => {
        const i = Math.round(r) + chains[ci].start;
        if (this.mode === 'flex') c.copy(LOW).lerp(HIGH, Math.min(1, (rmsf[i] ?? 0) / maxF));
        else if (this.mode === 'interface') c.copy(set.has(i) ? (ci ? P16 : CDK6) : (ci ? new THREE.Color('#6f5a4e') : new THREE.Color('#3f556c')));
        else c.copy(ci ? P16 : CDK6);
      });
    });
  }

  show(f) {
    const d = this.data;
    if (!d) return;
    f = Math.max(0, Math.min(d.frames - 1, Math.floor(f)));
    this.frame = f;
    const start = f * d.natoms * 3;
    const ca = d.coords.subarray(start, start + d.natoms * 3);
    const maxF = Math.max(...d.rmsf) || 1;
    this.tubes.forEach((t, ci) => {
      const s = d.chains[ci].start;
      const rf = (x) => {
        if (this.mode !== 'flex') return 0.95;
        const a = Math.floor(x), b = Math.min(d.chains[ci].count - 1, a + 1), w = x - a;
        const v = (d.rmsf[s + a] ?? 0) * (1 - w) + (d.rmsf[s + b] ?? 0) * w;
        return 0.55 + 2.6 * (v / maxF);
      };
      t.update(ca, rf);
    });
    d.bonds.forEach(([a, b], i) => {
      for (let c = 0; c < 3; c++) {
        this.stickPos[i * 6 + c] = ca[a * 3 + c];
        this.stickPos[i * 6 + 3 + c] = ca[b * 3 + c];
      }
    });
    this.sticks.geometry.attributes.position.needsUpdate = true;
    const m = new THREE.Matrix4();
    for (let i = 0; i < d.natoms - d.nca; i++) {
      const j = (d.nca + i) * 3;
      m.makeTranslation(ca[j], ca[j + 1], ca[j + 2]);
      this.atoms.setMatrixAt(i, m);
    }
    this.atoms.instanceMatrix.needsUpdate = true;
    if (this.atoms.instanceColor) this.atoms.instanceColor.needsUpdate = true;
    this.wake(3);
  }

  setFrame(f) {
    this.show(f);
    this.onFrame?.(this.frame);
  }

  play(on) {
    this.playing = on;
    this.last = performance.now();
    if (on && this.mode === 'water') this.setMode('chain');
    this.wake(30);
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) return;
    if (this.playing && this.data && now - this.last > 70) {
      this.last = now;
      const next = this.frame + 1;
      if (next >= this.data.frames) { this.setFrame(0); } else this.setFrame(next);
      this.wake(5);
    }
    if (this.controls.autoRotate) this.alive = Math.max(this.alive, 2);
    if (this.alive <= 0) return;
    this.alive--;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
