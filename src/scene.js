import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const FOV = 34;
const DPR_CAP = 2;
/* 导航条高度：取景时把它当作画面上方的安全区，产品不会钻到导航底下 */
const NAV_INSET = 72;

/* One pose per page section. The film position is the fractional section
   index, so the choreography always lines up with the copy no matter how
   tall the sections render. */
const SECTIONS = [
  { az: -30, el: 7, zoom: 1.46, pan: 0.09, focus: [0, 0, 0], explode: 0, fold: 0 },
  { az: 24, el: 12, zoom: 1.95, pan: 0.058, focus: [0, 0.012, 0], explode: 1, fold: 0 },
  { az: -8, el: 4, zoom: 1.45, pan: -0.1, focus: [0, 0.004, 0], explode: 0, fold: 1 },
  { az: 34, el: 6, zoom: 0.8, pan: 0, focus: [0.075, 0, 0], explode: 0, fold: 0 },
  { az: -28, el: 7, zoom: 1.4, pan: 0.086, focus: [0, 0, 0], explode: 0, fold: 0 },
];

/* Per part explode: world direction and distance in metres. */
const EXPLODE = {
  Headband: [[0, 1, 0], 0.062],
  HeadbandPad: [[0, 1, 0], 0.084],
  Slider_L: [[0, 1, 0], 0.038],
  Slider_R: [[0, 1, 0], 0.038],
  Hinge_L: [[0, 1, 0], 0.028],
  Hinge_R: [[0, 1, 0], 0.028],
  Yoke_L: [[0, 1, 0], 0.016],
  Yoke_R: [[0, 1, 0], 0.016],
  CupMount_L: [[0, 1, 0], 0.008],
  CupMount_R: [[0, 1, 0], 0.008],
  Cushion_L: [[1, 0, 0], 0.032],
  Cushion_R: [[-1, 0, 0], 0.032],
  Grille_L: [[-1, 0, 0], 0.03],
  Grille_R: [[1, 0, 0], 0.03],
  Button_L: [[0, -1, 0], 0.022],
  Button_R: [[0, -1, 0], 0.022],
  Jack_L: [[0, -1, 0], 0.028],
  Jack_R: [[0, -1, 0], 0.028],
};

const FINISHES = {
  graphite: { alu: 0x3a3e42, plastic: 0x1d1f22, steel: 0xb9b5ad, leather: 0x1b1b1d },
  bone: { alu: 0xd6d1c6, plastic: 0xe8e3d8, steel: 0xb4ae9f, leather: 0xd2cabb },
  steel: { alu: 0x9aa0a4, plastic: 0x262a2e, steel: 0xd4d6d8, leather: 0x2b2d2f },
  ember: { alu: 0xa8461c, plastic: 0x9e3f1a, steel: 0xbcb8b0, leather: 0x2a1d17 },
};

const LABELS = [
  { part: "Cushion_L", text: "耳垫", note: "记忆棉", dx: -60, dy: -26, side: "left" },
  { part: "Grille_R", text: "网罩", note: "10 圈", dx: 76, dy: -4, side: "right" },
  { part: "Yoke_R", text: "叉臂", note: "90° 铰链", dx: 78, dy: 46, side: "right" },
  { part: "Headband", text: "头梁", note: "22 mm 行程", dx: 34, dy: -78, side: "right" },
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export function createScene({ canvas, labelHost, onProgress, reduced }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 12);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;

  const key = new THREE.DirectionalLight(0xfff4e8, 2.4);
  key.position.set(0.55, 0.8, 0.62);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.05;
  key.shadow.camera.far = 2.4;
  key.shadow.camera.left = -0.24;
  key.shadow.camera.right = 0.24;
  key.shadow.camera.top = 0.24;
  key.shadow.camera.bottom = -0.24;
  key.shadow.bias = -0.0009;
  key.shadow.radius = 3;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(0x9fd7e8, 3.2);
  rim.position.set(-0.5, 0.35, -0.8);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xffffff, 0.45);
  fill.position.set(-0.7, -0.25, 0.55);
  scene.add(fill);

  const root = new THREE.Group();
  scene.add(root);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShadowMaterial({ opacity: 0.3 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const parts = new Map();
  const base = new Map();
  const materials = { alu: [], plastic: [], steel: [], leather: [] };
  const labelEls = [];
  const size = new THREE.Vector3(0.22, 0.18, 0.09);
  const tmpV = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const camTarget = new THREE.Vector3();

  let fitDist = 0.5;
  let ready = false;
  let film = 0; // target film position, 0 .. SECTIONS.length - 1
  let shown = 0;
  let finish = "graphite";

  function classify(name) {
    if (/Aluminum/i.test(name)) return "alu";
    if (/Steel/i.test(name)) return "steel";
    if (/Leather/i.test(name)) return "leather";
    if (/Plastic/i.test(name)) return "plastic";
    return null;
  }

  function applyFinish(name) {
    const set = FINISHES[name];
    if (!set) return;
    finish = name;
    for (const bucket of Object.keys(materials)) {
      for (const m of materials[bucket]) {
        m.color.setHex(set[bucket]);
        m.envMapIntensity = 1.1;
        if (bucket === "alu" || bucket === "steel") {
          m.metalness = 1;
          m.roughness = bucket === "alu" ? 0.34 : 0.26;
        } else if (bucket === "plastic") {
          m.metalness = 0;
          m.roughness = 0.5;
        } else {
          m.metalness = 0;
          m.roughness = 0.62;
          if ("sheenWeight" in m) m.sheenWeight = 0.2;
        }
        m.needsUpdate = true;
      }
    }
  }

  function loadModel() {
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    const withDraco = new GLTFLoader().setDRACOLoader(draco);
    const plain = new GLTFLoader();
    const load = (path, loader) =>
      new Promise((res, rej) => loader.load(path, res, onProgress, rej));

    return load("/models/nomad.glb", withDraco).catch((err) => {
      console.warn("[nomad] compressed model failed, falling back", err);
      return load("/models/nomad-plain.glb", plain);
    });
  }

  async function init() {
    let gltf;
    try {
      gltf = await loadModel();
    } catch (err) {
      console.error("[nomad] model failed", err);
      return false;
    }

    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          const bucket = classify(m.name || "");
          if (bucket && !materials[bucket].includes(m)) materials[bucket].push(m);
        }
      }
      if (o.name) {
        parts.set(o.name, o);
        base.set(o.name, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
      }
    });

    root.add(model);

    const box = new THREE.Box3().setFromObject(model);
    box.getSize(size);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    floor.position.y = -size.y / 2 - 0.002;

    applyFinish(finish);
    buildLabels();
    resize();
    ready = true;
    return true;
  }

  function buildLabels() {
    for (const item of LABELS) {
      const el = document.createElement("div");
      el.className = "lbl";
      el.innerHTML = `<i></i><span>${item.text}<em>${item.note}</em></span>`;
      labelHost.appendChild(el);
      labelEls.push({ ...item, el });
    }
  }

  function fit() {
    const h = canvas.clientHeight || window.innerHeight;
    const usable = Math.max(0.55, (h - NAV_INSET) / h);
    const aspect = Math.max(0.4, camera.aspect);
    const tan = Math.tan((FOV * Math.PI) / 360);
    const byHeight = (size.y * 1.18) / 2 / (tan * usable);
    const byWidth = (size.x * 1.12) / 2 / (tan * aspect);
    return Math.max(byHeight, byWidth);
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fitDist = fit();
    renderFrame();
  }

  function rotateAbout(obj, baseT, pivot, axis, angle) {
    obj.position.copy(baseT.p);
    obj.quaternion.copy(baseT.q);
    obj.parent.updateWorldMatrix(true, false);

    tmpQ.setFromAxisAngle(axis, angle);
    const parentQ = obj.parent.getWorldQuaternion(new THREE.Quaternion());
    const localQ = parentQ.clone().invert().multiply(tmpQ).multiply(parentQ);
    obj.quaternion.copy(baseT.q).premultiply(localQ);

    const world = obj.getWorldPosition(new THREE.Vector3());
    world.sub(pivot).applyQuaternion(tmpQ).add(pivot);
    obj.position.copy(obj.parent.worldToLocal(world));
    obj.parent.updateWorldMatrix(true, false);
  }

  function applyPose(explode, fold) {
    for (const [name, t] of base) {
      const obj = parts.get(name);
      if (!obj) continue;
      obj.position.copy(t.p);
      obj.quaternion.copy(t.q);
      obj.scale.copy(t.s);
    }

    if (explode > 0.001) {
      for (const [name, [dir, dist]] of Object.entries(EXPLODE)) {
        const obj = parts.get(name);
        const t = base.get(name);
        if (!obj || !t) continue;
        tmpV.set(dir[0], dir[1], dir[2]).normalize().multiplyScalar(dist * explode);
        const parentQ = obj.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
        tmpV.applyQuaternion(parentQ);
        obj.position.copy(t.p).add(tmpV);
      }
    }

    if (fold > 0.001) {
      for (const side of ["L", "R"]) {
        const sliders = parts.get(`Slider_${side}`);
        const st = base.get(`Slider_${side}`);
        if (sliders && st) {
          const up = new THREE.Vector3(0, 1, 0);
          const parentQ = sliders.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
          up.applyQuaternion(parentQ).multiplyScalar(0.02 * fold);
          sliders.position.copy(st.p).add(up);
        }

        const hinge = parts.get(`Hinge_${side}`);
        const ht = base.get(`Hinge_${side}`);
        if (!hinge || !ht) continue;
        const pivot = hinge.getWorldPosition(new THREE.Vector3());
        rotateAbout(hinge, ht, pivot, new THREE.Vector3(0, 1, 0), (side === "L" ? 1 : -1) * 1.55 * fold);
      }
    }

    root.updateWorldMatrix(true, true);
  }

  function currentPose() {
    const n = SECTIONS.length - 1;
    const f = Math.min(Math.max(shown, 0), n);
    const i = Math.min(Math.floor(f), n - 1);
    const t = smooth(f - i);
    const a = SECTIONS[i];
    const b = SECTIONS[i + 1];
    return {
      az: lerp(a.az, b.az, t),
      el: lerp(a.el, b.el, t),
      zoom: lerp(a.zoom, b.zoom, t),
      pan: lerp(a.pan, b.pan, t),
      fx: lerp(a.focus[0], b.focus[0], t),
      fy: lerp(a.focus[1], b.focus[1], t),
      fz: lerp(a.focus[2], b.focus[2], t),
      explode: lerp(a.explode, b.explode, t),
      fold: lerp(a.fold, b.fold, t),
    };
  }

  function placeCamera(pose) {
    const aspect = camera.aspect;
    const h = canvas.clientHeight || window.innerHeight;
    const tan = Math.tan((FOV * Math.PI) / 360);
    /* 窄屏：取消水平偏移，并把产品抬到文案上方 */
    const panFactor = clamp01((aspect - 0.65) / 0.55);
    const lift = aspect < 0.95 ? -0.045 : 0;
    const az = (pose.az * Math.PI) / 180;
    const el = (pose.el * Math.PI) / 180;
    const dist = fitDist * pose.zoom * (aspect < 0.95 ? 1.04 : 1);
    /* 把构图中心从视口中心下移到「导航以下」区域中心 */
    const dropPx = NAV_INSET / 2;
    const dropWorld = (dropPx / (h / 2)) * dist * tan;

    camTarget.set(pose.fx - pose.pan * panFactor, pose.fy + lift + dropWorld, pose.fz);
    camera.position.set(
      camTarget.x + Math.sin(az) * Math.cos(el) * dist,
      camTarget.y + Math.sin(el) * dist,
      camTarget.z + Math.cos(az) * Math.cos(el) * dist,
    );
    camera.lookAt(camTarget);
    camera.updateMatrixWorld();
  }

  function placeLabels() {
    const near = Math.abs(shown - 1) < 0.4;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    for (const l of labelEls) {
      const obj = parts.get(l.part);
      if (!near || !obj) {
        l.el.classList.remove("is-on");
        continue;
      }
      obj.getWorldPosition(tmpV);
      tmpV.project(camera);
      if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.15) {
        l.el.classList.remove("is-on");
        continue;
      }
      const x = (tmpV.x * 0.5 + 0.5) * w + l.dx;
      const y = (-tmpV.y * 0.5 + 0.5) * h + l.dy;
      if (y < NAV_INSET + 16) {
        l.el.classList.remove("is-on");
        continue;
      }
      const shift = l.side === "left" ? "-100%" : "0";
      l.el.style.transform =
        `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(${shift}, -50%)`;
      l.el.classList.add("is-on");
    }
  }

  function renderFrame() {
    const pose = currentPose();
    applyPose(pose.explode, pose.fold);
    placeCamera(pose);
    placeLabels();
    renderer.render(scene, camera);
  }

  function start() {
    const tick = () => {
      requestAnimationFrame(tick);
      if (!ready) return;
      const target = reduced ? 0 : film;
      const next = shown + (target - shown) * 0.11;
      if (Math.abs(next - shown) > 0.0004) {
        shown = next;
        renderFrame();
      }
    };
    requestAnimationFrame(tick);
  }

  return {
    init,
    start,
    resize,
    setFilm(f) {
      film = f;
    },
    setFinish(name) {
      if (!ready) return;
      applyFinish(name);
      renderFrame();
    },
    get finish() {
      return finish;
    },
  };
}
