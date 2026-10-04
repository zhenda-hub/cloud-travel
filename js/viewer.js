/* 云旅游 · 3D 云游查看器（支持多模型切换）
 * three.js 本地内置（./assets/vendor/three/），无 CDN 依赖。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const stage = document.getElementById('stage');
const loadingEl = document.getElementById('loading');
const errEl = document.getElementById('err');
const metaEl = document.getElementById('meta');
const titleEl = document.getElementById('modelTitle');
const subEl = document.getElementById('modelSub');
const hudTitleEl = document.getElementById('hudTitle');

if (stage) {
  /* ---------- 基础设施 ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();          // 透明背景，露出 CSS 天空渐变
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
  camera.position.set(80, 60, 100);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.1;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xbcd0e6, 1.05));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0); keyLight.position.set(80, 120, 70); scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xcfe2ff, 0.85); fillLight.position.set(-90, 40, -60); scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffe9cc, 1.0); rimLight.position.set(-20, 60, 120); scene.add(rimLight);

  function shadowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(20,50,90,.34)');
    grd.addColorStop(0.55, 'rgba(20,50,90,.13)');
    grd.addColorStop(1, 'rgba(20,50,90,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

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

  /* ---------- 模型状态 ---------- */
  const loader = new GLTFLoader();
  let model = null;
  let shadow = null;
  let wireMeshes = [];
  let wireOn = false;
  let loadSeq = 0;

  function disposeCurrent() {
    if (shadow) {
      scene.remove(shadow);
      if (shadow.geometry) shadow.geometry.dispose();
      if (shadow.material) {
        if (shadow.material.map) shadow.material.map.dispose();
        shadow.material.dispose();
      }
      shadow = null;
    }
    if (model) {
      scene.remove(model);
      model.traverse((o) => {
        if (!o.isMesh) return;
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m) return;
          Object.keys(m).forEach((k) => {
            const v = m[k];
            if (v && v.isTexture) v.dispose();
          });
          m.dispose();
        });
      });
      model = null;
    }
    wireMeshes = [];
    wireOn = false;
    const bw = document.getElementById('btnWire');
    if (bw) bw.classList.remove('on');
  }

  function fitCamera() {
    if (!model) return null;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    const dist = radius / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.7;
    camera.near = dist / 100;
    camera.far = dist * 100;
    camera.position.set(dist * 0.72, dist * 0.52, dist * 0.86);
    camera.updateProjectionMatrix();
    controls.minDistance = radius * 0.9;
    controls.maxDistance = radius * 8;
    controls.target.set(0, size.y * 0.38, 0);
    controls.update();
    return size;
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

  function loadModel(url, title) {
    const seq = ++loadSeq;
    disposeCurrent();
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (loadingEl) {
      loadingEl.textContent = '正在加载 3D 模型…';
      loadingEl.classList.remove('hide');
    }
    if (metaEl) metaEl.innerHTML = '';

    loader.load(
      url,
      (gltf) => {
        if (seq !== loadSeq) return;      // 已被更新的切换取代
        if (loadingEl) loadingEl.classList.add('hide');
        try {
          model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);      // 居中
          scene.add(model);
          const box2 = new THREE.Box3().setFromObject(model);
          model.position.y -= box2.min.y;  // 落地

          model.traverse((o) => { if (o.isMesh) wireMeshes.push(o); });
          const size = fitCamera();

          shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(size.x * 2.1, size.z * 2.1),
            new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false })
          );
          shadow.rotation.x = -Math.PI / 2;
          shadow.position.y = 0.02;
          scene.add(shadow);

          if (metaEl) {
            metaEl.innerHTML =
              '尺寸 ' + size.x.toFixed(1) + ' × ' + size.y.toFixed(1) + ' × ' + size.z.toFixed(1) +
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
      }
    );
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
      loadModel(tab.dataset.model, tab.dataset.title);
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
  if (btnReset) btnReset.onclick = fitCamera;

  /* ---------- 启动 ---------- */
  const first = tabs.find((t) => t.classList.contains('active')) || tabs[0];
  const firstUrl = first ? first.dataset.model : 'assets/models/temple_of_heaven.glb';
  loadModel(firstUrl, first ? first.dataset.title : null);

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}
