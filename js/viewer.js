/* 云旅游 · 3D 云游查看器（展厅版）
 *
 * 学自 model-x-studio / su7-replica 的做法：
 *   1. RoomEnvironment + PMREM 程序化环境光（材质反射的来源）
 *   2. 真实阴影（DirectionalLight + PCFSoft，autoUpdate=false 手动刷新）
 *   3. 展厅影调（深底 + 雾 + ACESFilmic）
 *   4. 圆形展台 + 亮边 + 地面 + 暗格
 *
 * three.js 本地内置（./assets/vendor/three/），无 CDN 依赖。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.getElementById('stage');
const loadingEl = document.getElementById('loading');
const errEl = document.getElementById('err');
const metaEl = document.getElementById('meta');
const titleEl = document.getElementById('modelTitle');
const subEl = document.getElementById('modelSub');
const hudTitleEl = document.getElementById('hudTitle');

if (stage) {
  const BG = 0x0a0d12;

  /* ---------- 渲染器 ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;      // 只在需要时刷新（模型不动的场景，省很多开销）
  renderer.setClearColor(BG, 1);
  stage.appendChild(renderer.domElement);

  /* ---------- 场景 / 相机 ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 20, 60);

  const camera = new THREE.PerspectiveCamera(37, 1, 0.05, 5000);
  camera.position.set(80, 60, 100);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.7;
  controls.maxPolarAngle = Math.PI * 0.495;   // 不许钻到地面以下
  controls.minPolarAngle = 0.12;

  /* ---------- 环境光：程序化生成，不需要 HDR 文件 ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRT = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  /* ---------- 灯光 ---------- */
  scene.add(new THREE.HemisphereLight(0xd8e9ff, 0x2a3038, 0.55));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
  keyLight.position.set(-6, 12, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0006;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);
  scene.add(keyLight.target);

  const rimLight = new THREE.DirectionalLight(0xa6c7eb, 1.7);
  rimLight.position.set(6, 6, -8);
  scene.add(rimLight);

  const warmLight = new THREE.PointLight(0xffd6ad, 2.2, 60, 2);
  warmLight.position.set(5, 1.4, 7);
  scene.add(warmLight);

  /* ---------- 展台（随模型尺寸重建） ---------- */
  const stageGroup = new THREE.Group();
  scene.add(stageGroup);

  function clearStage() {
    while (stageGroup.children.length) {
      const o = stageGroup.children.pop();
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    }
  }

  function buildStage(size) {
    clearStage();
    const r = Math.max(size.x, size.z) * 0.5 || 1;
    const plinthH = r * 0.14;

    // 圆形台座
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x2b333d, metalness: 0.55, roughness: 0.42,
    });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.55, r * 1.62, plinthH, 96), plinthMat);
    plinth.position.y = -plinthH / 2;
    plinth.receiveShadow = true;
    stageGroup.add(plinth);

    // 两圈亮边
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x9fb6c9, metalness: 0.85, roughness: 0.28 });
    [r * 1.50, r * 1.585].forEach((rad) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, Math.max(r * 0.006, 0.002), 6, 160), rimMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.002;
      stageGroup.add(ring);
    });

    // 地面
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 60, r * 60),
      new THREE.MeshStandardMaterial({ color: 0x1a2027, metalness: 0.15, roughness: 0.85 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -plinthH;
    floor.receiveShadow = true;
    stageGroup.add(floor);

    // 暗格
    const grid = new THREE.GridHelper(r * 40, 40, 0x3d4956, 0x2a323b);
    grid.position.y = -plinthH + 0.002;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    stageGroup.add(grid);

    // 主光的阴影范围跟着模型缩放
    const cam = keyLight.shadow.camera;
    const ext = r * 2.2;
    cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext;
    cam.near = Math.max(r * 0.1, 0.01);
    cam.far = r * 24;
    cam.updateProjectionMatrix();
    keyLight.position.set(-r * 1.6, r * 3.0, r * 1.6);
    keyLight.target.position.set(0, 0, 0);
    keyLight.target.updateMatrixWorld();

    rimLight.position.set(r * 1.7, r * 1.6, -r * 2.1);
    warmLight.position.set(r * 1.3, r * 0.35, r * 1.8);
    warmLight.distance = r * 16;

    return r;
  }

  /* ---------- 尺寸 ---------- */
  function resize() {
    const w = Math.max(1, stage.clientWidth);
    const h = Math.max(1, stage.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);

  /* ---------- 模型 ---------- */
  const loader = new GLTFLoader();
  let model = null;
  let wireMeshes = [];
  let wireOn = false;
  let loadSeq = 0;
  let plinthH = 0;

  function disposeCurrent() {
    if (model) {
      scene.remove(model);
      model.traverse((o) => {
        if (!o.isMesh) return;
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m) return;
          Object.keys(m).forEach((k) => { const v = m[k]; if (v && v.isTexture) v.dispose(); });
          m.dispose();
        });
      });
      model = null;
    }
    clearStage();
    wireMeshes = [];
    wireOn = false;
    const bw = document.getElementById('btnWire');
    if (bw) bw.classList.remove('on');
  }

  function fitCamera(size) {
    const r = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    const dist = r / Math.tan((camera.fov * Math.PI) / 180 / 2) * 1.52;
    camera.near = Math.max(dist / 400, 0.005);
    camera.far = dist * 400;
    camera.position.set(dist * 0.62, dist * 0.46, dist * 0.86);
    camera.updateProjectionMatrix();
    controls.minDistance = r * 0.9;
    controls.maxDistance = r * 9;
    controls.target.set(0, size.y * 0.46, 0);
    controls.update();

    if (scene.fog) {
      scene.fog.near = dist * 1.1;
      scene.fog.far = dist * 4.5;
    }
  }

  function countTris() {
    let n = 0;
    wireMeshes.forEach((m) => {
      const g = m.geometry;
      if (g && g.index) n += g.index.count / 3;
      else if (g && g.attributes.position) n += g.attributes.position.count / 3;
    });
    return Math.round(n);
  }

  function setTitle(title, sub) {
    if (titleEl && title) titleEl.textContent = title;
    if (subEl && sub) subEl.textContent = sub;
    if (hudTitleEl && title) hudTitleEl.textContent = '🏛️ ' + title;
    if (title) document.title = '3D 云游 · ' + title + ' | 云旅游';
  }

  function loadModel(url) {
    const seq = ++loadSeq;
    disposeCurrent();
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (loadingEl) { loadingEl.textContent = '正在加载 3D 模型…'; loadingEl.classList.remove('hide'); }
    if (metaEl) metaEl.innerHTML = '';

    loader.load(url, (gltf) => {
      if (seq !== loadSeq) return;
      if (loadingEl) loadingEl.classList.add('hide');
      try {
        model = gltf.scene;

        // 居中 + 落地
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        scene.add(model);
        const box2 = new THREE.Box3().setFromObject(model);
        model.position.y -= box2.min.y;
        const size = box2.getSize(new THREE.Vector3());

        // 材质：吃环境光 + 参与阴影
        model.traverse((o) => {
          if (!o.isMesh) return;
          wireMeshes.push(o);
          o.castShadow = true;
          o.receiveShadow = true;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (m && m.isMeshStandardMaterial) {
              m.envMapIntensity = 1.25;
              if (m.metalness === undefined) m.metalness = 0.1;
            }
          });
        });

        const r = buildStage(size);
        plinthH = r * 0.14;
        fitCamera(size);

        // 阴影只需算一次（灯不动、模型不动，只有相机绕圈）
        renderer.shadowMap.needsUpdate = true;

        if (metaEl) {
          metaEl.innerHTML =
            '尺寸 ' + size.x.toFixed(2) + ' × ' + size.y.toFixed(2) + ' × ' + size.z.toFixed(2) +
            '<br>三角面 ' + countTris().toLocaleString();
        }
      } catch (e) {
        console.error(e);
        if (errEl) { errEl.style.display = 'flex'; errEl.textContent = '模型解析出错：' + e.message; }
      }
    },
    (xhr) => {
      if (seq !== loadSeq) return;
      if (loadingEl && xhr.total) {
        loadingEl.textContent = '正在加载 3D 模型… ' + Math.round((xhr.loaded / xhr.total) * 100) + '%';
      }
    },
    (e) => {
      if (seq !== loadSeq) return;
      if (errEl) {
        errEl.style.display = 'flex';
        errEl.textContent = '加载失败：' + (e && e.message ? e.message : e) +
          '\n\n请通过本地服务器访问（http://…），不要用 file:// 直接打开。';
      }
      if (loadingEl) loadingEl.classList.add('hide');
    });
  }

  /* ---------- 标签切换 ---------- */
  const tabs = Array.prototype.slice.call(document.querySelectorAll('.vtab'));
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('active')) return;
      tabs.forEach((t) => {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      setTitle(tab.dataset.title, tab.dataset.sub);
      loadModel(tab.dataset.model);
    });
  });

  /* ---------- 控件 ---------- */
  const btnRotate = document.getElementById('btnRotate');
  if (btnRotate) btnRotate.onclick = () => {
    controls.autoRotate = !controls.autoRotate;
    btnRotate.classList.toggle('on', controls.autoRotate);
  };

  const btnWire = document.getElementById('btnWire');
  if (btnWire) btnWire.onclick = () => {
    wireOn = !wireOn;
    wireMeshes.forEach((m) => { if (m.material) m.material.wireframe = wireOn; });
    btnWire.classList.toggle('on', wireOn);
  };

  const btnReset = document.getElementById('btnReset');
  if (btnReset) btnReset.onclick = () => {
    if (model) fitCamera(new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()));
  };

  /* ---------- 启动 ---------- */
  const first = tabs.find((t) => t.classList.contains('active')) || tabs[0];
  loadModel(first ? first.dataset.model : 'assets/models/temple-lux3d-g1.glb');

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}
