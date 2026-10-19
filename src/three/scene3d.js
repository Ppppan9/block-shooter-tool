// three.js 页面实时 3D（离线打包）：体素（InstancedMesh 圆角方块，只渲染外露方块）、品红底座、槽位、炮台（履带×2 + 车身 + 炮塔 + 炮管 + 数字）、小球、碎屑。
// 页面渲染与 3D 导出 / AE 3D 外观共用同一套模型构造函数（makeShooter / voxGeo / ballGeo …）。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DW, DH } from '../world.js';
export const PALETTE = { purple: '#7a12c4', green: '#b4f02a', black: '#3a3a40', yellow: '#ffb320', red: '#f03a3a', blue: '#2f7cf0', orange: '#ff7a1a', pink: '#ff6ad0' };
export const colorHex = (S, n) => S['col_' + n] || PALETTE[n] || '#888888';
const IS3D_RE = /^(shooter|ball|debris|slot|num)/;
export const IS3D = a => IS3D_RE.test(a || '');
let shared = null;
export function geos(S) {
  if (shared && shared.key === S.voxRound + '|' + S.voxGap) return shared;
  const g = 1 - S.voxGap, r = Math.min(0.45 * g, S.voxRound);
  // 方块：更高细分圆角（参考果冻/软糖）；球：高细分珍珠白珠
  shared = { key: S.voxRound + '|' + S.voxGap, vox: new RoundedBoxGeometry(g, g, g, 4, r), ball: new THREE.SphereGeometry(1, 28, 20), debris: new RoundedBoxGeometry(1, 1, 1, 2, 0.2), slot: new THREE.CylinderGeometry(1, 1, 0.08, 40) };
  return shared;
}
const matCache = new Map();
export function mat(S, hex, o = {}) { const key = hex + JSON.stringify(o) + S.mat3dRough + '|g' + (o.glow || 0); if (!matCache.has(key)) { const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: o.rough ?? S.mat3dRough, metalness: 0, ...o.extra }); if (o.glow) { m.emissive = new THREE.Color(hex); m.emissiveIntensity = o.glow; } m.name = o.name || ('mat_' + hex.slice(1)); matCache.set(key, m); } return matCache.get(key); }
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x121018, side: THREE.BackSide }); outlineMat.name = 'mat_outline';
function withOutline(mesh, S) { if (!S.outline3d) return mesh; const o = new THREE.Mesh(mesh.geometry, outlineMat); o.name = mesh.name + '_outline'; o.scale.setScalar(1 + S.outline3d / Math.max(0.3, Math.min(mesh.scale.x, mesh.scale.y, mesh.scale.z) || 1) * 0.09); mesh.add(o); return mesh; }
const shade = (hex, f) => { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); };
// 数字贴图（白字 + 深色描边，参考）
const numTex = new Map();
export function numberCanvas(n, color = '#ffffff') { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.font = 'bold 46px "Arial Black","Microsoft YaHei",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = 10; g.strokeStyle = '#151318'; g.strokeText(String(n), 64, 34); g.fillStyle = color; g.fillText(String(n), 64, 34); return c; }
export function numberTexture(n) { if (!numTex.has(n)) { const t = new THREE.CanvasTexture(numberCanvas(n)); t.colorSpace = THREE.SRGBColorSpace; t.name = 'num_' + n; numTex.set(n, t); } return numTex.get(n); }
// 炮台：6 个元素（左履带、右履带、车身、炮塔、炮管、数字牌）——参考放大核对
export function makeShooter(S, color, Wd) {
  const hex = colorHex(S, color), dark = shade(hex, 0.78), { w, d, h } = Wd.SH, G = new THREE.Group(); G.name = 'shooter_' + color;
  const body = new THREE.Group(); body.name = 'body'; const upper = new THREE.Group(); upper.name = 'upper';
  const rb = (W2, H2, D2, r) => new RoundedBoxGeometry(W2, H2, D2, 2, r);
  const tankR = S.tankRough ?? S.mat3dRough ?? 0.72; // 半哑光玩具塑料
  // 参考：下半身(履带+车身)与上半身(炮塔+炮管+数字)可独立 yaw —— 射击时两者都会转向目标
  const trackG = rb(w * 0.24, h * 0.46, d, 0.2);
  for (const sx of [-1, 1]) { const t = new THREE.Mesh(trackG, mat(S, dark, { rough: tankR })); t.name = sx < 0 ? 'track_L' : 'track_R'; t.position.set(sx * w * 0.38, h * 0.23, 0); body.add(withOutline(t, S)); }
  const hull = new THREE.Mesh(rb(w * 0.66, h * 0.5, d * 0.92, 0.22), mat(S, hex, { rough: tankR })); hull.name = 'hull'; hull.position.set(0, h * 0.42, 0.0); body.add(withOutline(hull, S));
  const tur = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(S, hex, { rough: tankR })); tur.name = 'turret'; tur.scale.set(w * 0.36, h * 0.5, d * 0.4); tur.position.set(0, h * 0.62, 0.08); upper.add(withOutline(tur, S));
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, d * 0.42, 16), mat(S, hex, { rough: tankR })); bar.name = 'barrel'; bar.rotation.x = -Math.PI / 2 + 0.6; bar.position.set(0, h * 0.86, -d * 0.25); upper.add(withOutline(bar, S));
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), new THREE.MeshBasicMaterial({ map: numberTexture(200), transparent: true, depthWrite: false, depthTest: false })); lab.name = 'label'; lab.renderOrder = 5; lab.position.set(0, h * 1.18, 0.1); upper.add(lab);
  G.add(body, upper); G.userData.body = body; G.userData.upper = upper; G.userData.label = lab; G.userData.color = color;
  return G;
}
// 白球：参考亮白抛光珍珠/大理石 —— 高光体积 + Fresnel rim + 软 bloom 光晕
export function makeBall(S) {
  const g = new THREE.Group(); g.name = 'ball';
  const glow = S.ballGlow || 0;
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.1, metalness: 0.12,
    transparent: false, depthWrite: true,
    emissive: new THREE.Color(0xfff6ff), emissiveIntensity: 0.18 + glow * 0.55,
  }); coreMat.name = 'mat_ball';
  const core = new THREE.Mesh(geos(S).ball, coreMat); core.name = 'ball_core'; g.add(core);
  // 外层软 Fresnel rim（略大于核，边缘亮一圈）
  const rim = new THREE.Mesh(geos(S).ball, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 + glow * 0.18, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  rim.name = 'ball_rim'; rim.scale.setScalar(1.06); rim.renderOrder = 1; g.add(rim);
  // 内高光核（体积感）
  const highlight = new THREE.Mesh(geos(S).ball, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 + glow * 0.1, depthWrite: false, toneMapped: false }));
  highlight.name = 'ball_hi'; highlight.scale.setScalar(0.55); highlight.position.set(-0.18, 0.28, 0.15); highlight.renderOrder = 2; g.add(highlight);
  if (S.ballHalo > 1 && S.ballHaloOp > 0) {
    const halo = new THREE.Mesh(geos(S).ball, new THREE.MeshBasicMaterial({ color: 0xfff4ff, transparent: true, opacity: S.ballHaloOp, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    halo.name = 'ball_halo'; halo.scale.setScalar(S.ballHalo); halo.renderOrder = 0; g.add(halo);
  }
  return g;
}
export function create3D(opt = {}) {
  let renderer = null, scene, camera, sun, hemi, Wd, S0, L0, voxMesh, voxIdx = [], base, slotMeshes = [], cap = 0;
  const pool = new Map(); const statics = new THREE.Group();
  function setup(S, L, W2) {
    S0 = S; L0 = L; Wd = W2; scene = new THREE.Scene(); camera = Wd.cam; pool.clear();
    // 顶亮侧暗：半球地面偏冷紫灰 → 缝/侧面有 AO 感；主光高仰角勾顶面高光
    hemi = new THREE.HemisphereLight(0xfff5ff, 0x4a3d5c, S.light3dAmbient); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, S.light3dSun); const a = S.light3dAzim * Math.PI / 180, e = S.light3dElev * Math.PI / 180; sun.position.set(Math.sin(a) * Math.cos(e) * 100, Math.sin(e) * 100, Math.cos(a) * Math.cos(e) * 100); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0xd8c8ff, S.light3dSun * 0.22); fill.position.set(-40, 35, 60); scene.add(fill);
    statics.clear(); scene.add(statics);
    // 底座：品红圆角托板
    const b = Wd.base, bw = b.x1 - b.x0, bd = b.z1 - b.z0;
    base = new THREE.Mesh(new RoundedBoxGeometry(bw, b.y1 - b.y0, bd, 3, Math.min(S.baseRadius, (b.y1 - b.y0) / 2 - 0.01)), mat(S, S.baseColor, { name: 'mat_base' })); base.name = 'base'; base.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); statics.add(base);
    // 槽位：白色圆盘
    slotMeshes = Wd.slots.map(([x, z], i) => { const m = new THREE.Mesh(geos(S).slot, mat(S, S.slotColor, { name: 'mat_slot', rough: 0.5 })); m.name = 'slot_' + (i + 1); m.scale.set(S.slotR, 1, S.slotR * 0.92); m.position.set(x, 0.04, z); statics.add(m); return m; });
    // 体素：每色一个 InstancedMesh（只放外露 / 正在消除的方块）
    voxMesh = L.palette.map((p, c) => { const m = new THREE.InstancedMesh(geos(S).vox, mat(S, colorHex(S, p), { name: 'mat_vox_' + p, rough: S.voxRough ?? 0.52 }), 16); m.name = 'voxels_' + p; m.count = 0; m.frustumCulled = false; scene.add(m); return m; });
    cap = 0;
    if (opt.exportMode) voxMesh.forEach(m => scene.remove(m));
  }
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V3 = new THREE.Vector3(), SC = new THREE.Vector3();
  // frame = { vox: [ [n, sx, sy?, sz?, ox?, oy?, oz?] ... ]；消除果冻缩放 + 邻块挤动位移 }
  function setVoxels(groups) {
    groups.forEach((list, c) => { let m = voxMesh[c]; if (list.length > m.instanceMatrix.count) { const nm = new THREE.InstancedMesh(m.geometry, m.material, Math.ceil(list.length * 1.3) + 16); nm.name = m.name; nm.frustumCulled = false; scene.remove(m); m.dispose(); scene.add(nm); voxMesh[c] = m = nm; }
      for (let q = 0; q < list.length; q++) { const row = list[q], n = row[0], sx = row[1] ?? 1, sy = row[2] ?? sx, sz = row[3] ?? sx, ox = row[4] || 0, oy = row[5] || 0, oz = row[6] || 0, p = Wd.vox(n); V3.set(p[0] + ox, p[1] + oy, p[2] + oz); SC.set(Wd.vs * sx, Wd.vs * sy, Wd.vs * sz); M4.compose(V3, Q.identity(), SC); m.setMatrixAt(q, M4); }
      m.count = list.length; m.instanceMatrix.needsUpdate = true; });
  }
  function getObj(it) {
    let o = pool.get(it.id);
    if (o && o.asset !== it.asset) { scene.remove(o.obj); pool.delete(it.id); o = null; }
    if (!o) {
      let obj; const k = it.asset;
      if (k.startsWith('shooter_')) obj = makeShooter(S0, k.slice(8), Wd);
      else if (k === 'ball') { obj = makeBall(S0); }
      else if (k.startsWith('debris_')) { obj = new THREE.Mesh(geos(S0).debris, mat(S0, colorHex(S0, k.slice(7)), { name: 'mat_debris_' + k.slice(7) })); obj.name = 'debris'; }
      else return null;
      o = { obj, asset: k, used: false }; pool.set(it.id, o); scene.add(obj);
    }
    return o;
  }
  function apply(items, S) {
    for (const o of pool.values()) o.used = false;
    for (const it of items) {
      if (!IS3D(it.asset) || !it.w) continue; const o = getObj(it); if (!o) continue; o.used = true; const ob = o.obj;
      ob.position.set(it.w[0], it.w[1], it.w[2]); ob.rotation.set(it.rx || 0, 0, it.rz || 0);
      // 射击转向：下半身 body.ry、上半身 upper.ry（参考：履带车身与炮塔都会跟着转）
      if (ob.userData.body) ob.userData.body.rotation.y = it.bodyYaw ?? it.ry ?? 0;
      if (ob.userData.upper) ob.userData.upper.rotation.y = it.turretYaw ?? it.bodyYaw ?? it.ry ?? 0;
      else if (it.ry) ob.rotation.y = it.ry;
      const s = it.ws ?? 1; if (it.asset === 'ball') ob.scale.setScalar(S.ballR * s); else if (it.asset.startsWith('debris')) ob.scale.setScalar(s); else ob.scale.set(s * (it.wsx ?? 1), s * (it.wsy ?? 1), s * (it.wsz ?? 1));
      if (ob.userData.label) { const lab = ob.userData.label, n = it.num; if (lab.userData.n !== n) { lab.material.map = numberTexture(n); lab.material.needsUpdate = true; lab.userData.n = n; } lab.material.opacity = it.numOp ?? 1; lab.visible = n != null && (it.numOp ?? 1) > 0.01; lab.quaternion.copy(camera.quaternion); ob.updateMatrixWorld(); const pq = new THREE.Quaternion(); ob.getWorldQuaternion(pq); lab.quaternion.premultiply(pq.invert()); }
      ob.visible = (it.op ?? 1) > 0.01;
    }
    for (const [id, o] of pool) { o.obj.visible = o.used && o.obj.visible; if (!o.used && !opt.exportMode) { scene.remove(o.obj); pool.delete(id); } }
  }
  function render(frame, S, w, h) {
    if (!renderer) { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0); }
    if (renderer.domElement.width !== w || renderer.domElement.height !== h) renderer.setSize(w, h, false);
    if (frame.vox) setVoxels(frame.vox);
    apply(frame.items, S);
    renderer.render(scene, camera); return renderer.domElement;
  }
  return { setup, render, apply, setVoxels, pool, statics, get scene() { return scene; }, get camera() { return camera; }, get sun() { return sun; }, get voxMesh() { return voxMesh; }, get renderer() { return renderer; } };
}
