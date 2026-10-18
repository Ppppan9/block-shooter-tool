// 导出 3D 动画（glTF 2.0 .glb + Blender 脚本 + 音频 + timeline.json）：直接复用页面 three.js 场景的模型（src/three/scene3d.js：
// 品红圆角底座、白色槽位、圆角体素方块、履带炮台、小球、碎屑），由 AE 记录的同一份时间轴逐帧驱动（按 3D 帧率烘焙关键帧）。
// 层级：block_root（缩放 0.1：场景单位 → 米）→ static_scene（底座 / 槽位）+ voxels（每个方块一个节点 vox_<色>_i_j_k，消除时缩放到 0）
//   + dynamic_3d（<id>_vis 显示/隐藏 STEP 缩放 → <id> 位置/旋转/缩放 → 子网格 track_L/track_R/hull/turret/barrel/label；label 下每个数字一个平面 num_<n>，STEP 缩放切换）；
// 2D 叠加层（背景、免责声明、通关文字、手、结束页）= 挂在相机下的贴图平面（HUD），与网页画面同位置同大小。
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { makeZip } from '../ae/zip.js';
import { create3D, IS3D, geos, mat, colorHex, numberTexture } from '../three/scene3d.js';
import { itemsAt } from '../three/frames.js';
import { DW, DH } from '../world.js';
import PY_TEXT from './blender_import.py';
import README_TEXT from './README_3D.md';

export const PX = 0.1;
const r5 = x => Math.round(x * 1e5) / 1e5;
const safe = s => s.replace(/[^A-Za-z0-9_]/g, '_');
const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
export async function export3D({ S, ae, rec, A, Wd }) {
  const fps = +S.export3dFps || 30, D = ae.timeline.meta.duration, NF = Math.round(D * fps);
  const files = ae.fileList, fileMap = new Map(files.map(f => [f.name, f.data]));
  const times = []; for (let f = 0; f <= NF; f++) times.push(r5(f / fps));
  const segs = ae.segs.filter(g => !(g.id === 'hand' && S.export3dHand === false));
  const L = rec.L;
  // ---- 3D 部分：页面同一套模型（exportMode：方块逐个节点）----
  const R = create3D({ exportMode: true }); R.setup(S, L, Wd);
  const root = new THREE.Group(); root.name = 'block_root'; root.scale.setScalar(PX);
  const statics = R.statics; statics.name = 'static_scene'; root.add(statics);
  const dyn = new THREE.Group(); dyn.name = 'dynamic_3d'; root.add(dyn);
  const voxG = new THREE.Group(); voxG.name = 'voxels'; root.add(voxG);
  const tracks = [], stats = { nodes: 0, voxels: 0, voxelsPopped: 0, shooters: 0, balls: 0, debris: 0, numbers: 0, quads: 0, meshes3d: 0, hand: 0 };
  function reduce(V, n) { const T2 = [], V2 = [], same = (i, j) => { for (let k = 0; k < n; k++) if (Math.abs(V[i * n + k] - V[j * n + k]) > 1e-6) return false; return true; }; for (let i = 0; i < times.length; i++) { if (i > 0 && i < times.length - 1 && same(i, i - 1) && same(i, i + 1)) continue; T2.push(times[i]); for (let k = 0; k < n; k++) V2.push(V[i * n + k]); } if (T2.length === 1) { T2.push(D); for (let k = 0; k < n; k++) V2.push(V2[k]); } return { T: T2, V: V2 }; }
  function addTrack(name, prop, V, n, interp = THREE.InterpolateLinear, force = false) { const r = reduce(V, n); if (!force && r.T.length === 2 && r.V.slice(0, n).every((x, k) => Math.abs(x - r.V[n + k]) < 1e-9) && prop !== 'scale') return; const C = prop === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack; tracks.push(new C(name + '.' + prop, r.T, r.V, interp)); }
  const nodes = [];
  // ---- 方块：与 AE 相同的集合（记录期间可见 / 被消除的方块），每个一个网格节点 ----
  { const popAt = new Map(ae.vox.pops.map(p => [p[0], p[1]])), set = S.aeVoxels === 'all' ? null : ae.vox.seen, popD = Math.max(1 / fps, (S.popDur || 110) / 1000), vg = geos(S).vox, mats = new Map();
    for (let n = 0; n < ae.vox.vox0.length; n++) { const v = ae.vox.vox0[n]; if (!v || (set && !set.has(n) && !popAt.has(n))) continue;
      const col = L.palette[v - 1]; if (!mats.has(col)) mats.set(col, mat(S, colorHex(S, col), { name: 'pbr_vox_' + col }));
      const i = n % L.W, j = Math.floor(n / L.W) % L.H, k = Math.floor(n / (L.W * L.H)), nm = `vox_${col}_${i}_${j}_${k}`, p = Wd.vox(n);
      const m = new THREE.Mesh(vg, mats.get(col)); m.name = nm; m.position.set(p[0], p[1], p[2]); m.scale.setScalar(Wd.vs); voxG.add(m); stats.voxels++; stats.nodes++;
      const tp = popAt.get(n); let out = D;
      if (tp != null) { stats.voxelsPopped++; out = Math.min(D, tp + popD); const sv = []; times.forEach(t => { const s = Wd.vs * (t < tp ? 1 : Math.max(0, 1 - easeOut((t - tp) / popD))); sv.push(s, s, s); }); addTrack(nm, 'scale', sv, 3, undefined, true); }
      nodes.push({ name: nm, kind: 'vox', mode: '3d', in: 0, out: r5(out), cell: [i, j, k], color: col });
    } }
  // ---- 动态 3D 元素（炮台 / 小球 / 碎屑）：逐帧 apply 页面同一套对象 ----
  const rec3 = new Map(), numMat = new Map(), numGeo = new THREE.PlaneGeometry(1.9, 0.95);
  const numPlane = (lab, n) => { let c = lab.userData.planes || (lab.userData.planes = new Map()); if (!c.has(n)) { if (!numMat.has(n)) numMat.set(n, new THREE.MeshBasicMaterial({ map: numberTexture(n), transparent: true, depthWrite: false, name: 'mat_num_' + n })); const q = new THREE.Mesh(numGeo, numMat.get(n)); q.name = lab.parent.name + '_num_' + n; q.userData.init = 0; q.scale.setScalar(0); lab.add(q); c.set(n, q); stats.numbers++; } return c.get(n); };
  for (let f = 0; f <= NF; f++) {
    const items = itemsAt(segs, times[f], fps);
    R.apply(items, S);
    for (const [id, o] of R.pool) {
      let r = rec3.get(id); if (!r) { r = { obj: o.obj, vis: new Array(f).fill(0), tr: new Map() }; rec3.set(id, r); o.obj.name = safe(id); }
      r.vis.push(o.used ? 1 : 0);
      const lab = o.obj.userData.label; if (lab) { const n = lab.userData.n; if (o.used && n != null) numPlane(lab, n); if (lab.userData.planes) for (const [m, q] of lab.userData.planes) q.scale.setScalar(o.used && lab.visible && m === n ? 1 : 0); }
      const nodes2 = [o.obj]; o.obj.traverse(c => { if (c !== o.obj) nodes2.push(c); });
      for (const n of nodes2) { let t = r.tr.get(n); if (!t) { t = { p: [], q: [], s: [] }; for (let k = 0; k < f; k++) { t.p.push(...n.position.toArray()); t.q.push(...n.quaternion.toArray()); if (n.userData.init != null) t.s.push(0, 0, 0); else t.s.push(...n.scale.toArray()); } r.tr.set(n, t); } t.p.push(...n.position.toArray()); t.q.push(...n.quaternion.toArray()); t.s.push(...n.scale.toArray()); }
    }
  }
  const anchorMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, name: 'mat_label_anchor' });
  for (const [id, r] of rec3) {
    const vis = new THREE.Group(); vis.name = safe(id) + '_vis'; dyn.add(vis); vis.add(r.obj); r.obj.visible = true;
    const vv = []; r.vis.forEach(v => vv.push(v, v, v)); addTrack(vis.name, 'scale', vv, 3, THREE.InterpolateDiscrete);
    { let ui = 0; r.obj.traverse(c => { if (c === r.obj) return; if (!c.name) c.name = r.obj.name + '_n' + (ui++); else if (!c.name.startsWith(r.obj.name)) c.name = r.obj.name + '_' + c.name; }); }
    for (const [n, t] of r.tr) { if (!n.name) n.name = safe(id); const interp = n.userData.init != null ? THREE.InterpolateDiscrete : THREE.InterpolateLinear; addTrack(n.name, 'position', t.p, 3); addTrack(n.name, 'quaternion', t.q, 4); addTrack(n.name, 'scale', t.s, 3, interp); }
    const lab = r.obj.userData.label; if (lab) { lab.material = anchorMat; lab.visible = true; }
    r.obj.traverse(c => { if (c.isMesh && c.material && c.material.name !== 'mat_label_anchor' && !c.material.name.startsWith('mat_num_')) stats.meshes3d++; });
    const fi = r.vis.indexOf(1), la = r.vis.lastIndexOf(1), kind = id.split('_')[0];
    stats.nodes++; if (kind === 'shooter') stats.shooters++; else if (kind === 'ball') stats.balls++; else if (kind === 'debris') stats.debris++;
    nodes.push({ name: safe(id), kind, mode: '3d', in: r5(Math.max(0, fi) / fps), out: r5((la + 1) / fps) });
  }
  // 3D 模型材质统一 pbr_ 前缀（Blender 脚本只把 mat_*（2D 叠加层 / 数字）改为自发光）
  root.traverse(c => { if (c.isMesh) for (const m of [].concat(c.material)) if (m.name && m.name.startsWith('mat_') && m.name !== 'mat_label_anchor' && !m.name.startsWith('mat_num_') && !m.name.startsWith('mat_hud')) m.name = 'pbr_' + m.name.slice(4); else if (!m.name) m.name = 'pbr_' + (c.name || 'mesh'); });
  // ---- 相机（与页面 3D 渲染同 FOV / 位置 / 朝向）+ 灯光 ----
  const cam = R.camera.clone(); cam.name = 'camera_persp'; const camD = R.camera.position.distanceTo(new THREE.Vector3(S.cam3dTX, S.cam3dTY, S.cam3dTZ));
  cam.near = 0.5; cam.far = camD * 5; // 单位：场景（root 缩放后 → 米 = ×0.1）
  cam.position.copy(R.camera.position); cam.quaternion.copy(R.camera.quaternion); root.add(cam);
  const sun = new THREE.DirectionalLight(0xffffff, S.light3dSun); sun.name = 'sun_light'; sun.position.copy(R.sun.position); root.add(sun); sun.add(sun.target); sun.target.position.set(0, 0, -1); sun.lookAt(new THREE.Vector3(0, 0, 0));
  // ---- HUD：2D 叠加层（与页面一致），相机局部坐标；背景放在场景之后 ----
  const tanH = Math.tan(cam.fov * Math.PI / 360), texCache = new Map();
  const tex = key => { if (texCache.has(key)) return texCache.get(key); const a = A[key]; let c = a.c; if (!(c instanceof HTMLCanvasElement)) { const cc = document.createElement('canvas'); cc.width = c.width; cc.height = c.height; cc.getContext('2d').drawImage(c, 0, 0); c = cc; } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.name = key; texCache.set(key, t); return t; };
  const opacity = {}, used = new Map();
  segs.forEach((g, si) => {
    if (IS3D(g.asset) || !A[g.asset] || g.asset === 'base' || g.asset.startsWith('vox_')) return;
    const a = A[g.asset], key = g.asset; let nm = safe(g.id); const n0 = (used.get(nm) || 0) + 1; used.set(nm, n0); if (n0 > 1) nm += '_s' + n0;
    const d = g.id === 'background' ? camD * 3 : 40 - Math.min(30, g.z / 4) - si * 1e-3, pxs = 2 * d * tanH / DH; // 每设计像素在该距离处的世界尺寸
    const s = g.s, tin = s[0][0], tout = s[s.length - 1][0] + 1 / fps, opVar = s.some(e => Math.abs(e[6] - s[0][6]) > 1e-3);
    const m = new THREE.MeshBasicMaterial({ map: tex(key), transparent: true, depthWrite: false, opacity: opVar ? 1 : s[0][6] }); m.name = 'mat_hud_' + nm;
    const geo = new THREE.PlaneGeometry(a.w, a.h); geo.translate(a.w / 2 - a.ax, -(a.h / 2 - a.ay), 0);
    const vis = new THREE.Group(); vis.name = nm + '_vis'; cam.add(vis); const node = new THREE.Group(); node.name = nm; vis.add(node); const q = new THREE.Mesh(geo, m); q.name = nm + '_q'; node.add(q); stats.quads++;
    let j = 0; const at = t => { while (j < s.length - 2 && s[j + 1][0] <= t) j++; if (t < s[j][0]) j = 0; const p = s[j], q2 = s[j + 1] || p, u = q2[0] > p[0] ? Math.min(1, Math.max(0, (t - p[0]) / (q2[0] - p[0]))) : 0; return p.map((x, i) => x + (q2[i] - x) * u); };
    const pv = [], sv = [], qv = [], vv = [], op = [], qq = new THREE.Quaternion(), ax = new THREE.Vector3(0, 0, 1);
    times.forEach(t => { const e = at(Math.min(Math.max(t, tin), s[s.length - 1][0])), on = t >= tin - 1e-6 && t < tout - 1e-6 ? 1 : 0; pv.push((e[1] - DW / 2) * pxs, (DH / 2 - e[2]) * pxs, -d); sv.push(e[3] * pxs, e[4] * pxs, 1); qq.setFromAxisAngle(ax, -e[5]); qv.push(qq.x, qq.y, qq.z, qq.w); vv.push(on, on, on); op.push(Math.round(e[6] * 1000) / 1000); });
    addTrack(nm, 'position', pv, 3, undefined, true); addTrack(nm, 'scale', sv, 3, undefined, true); if (s.some(e => e[5])) addTrack(nm, 'quaternion', qv, 4); addTrack(vis.name, 'scale', vv, 3, THREE.InterpolateDiscrete, true);
    node.position.fromArray(pv, 0); node.scale.fromArray(sv, 0);
    if (opVar) { const r = reduce(op, 1); opacity[nm + '_q'] = r.T.map((t, i) => [t, r.V[i]]); }
    if (g.id === 'hand') stats.hand = 1; stats.nodes++;
    nodes.push({ name: nm + '_q', node: nm, kind: g.id.split('_')[0], mode: 'hud', asset: key, in: r5(tin), out: r5(Math.min(D, tout)) });
  });
  const scn = new THREE.Scene(); scn.name = 'block_scene'; scn.add(root);
  const clip = new THREE.AnimationClip('block_shooter', D, tracks);
  const glb = await new GLTFExporter().parseAsync(scn, { binary: true, animations: [clip], onlyVisible: false, trs: true });
  const tl = ae.timeline, assetById = new Map(tl.assets.map(a => [a.id, a])), sfxC = tl.comps.find(c => c.id === 'sfx'), mixA = tl.assets.find(a => a.id === 'mix');
  const audio = []; if (sfxC) for (const l of sfxC.layers) { const a = assetById.get(l.src.asset); if (a) audio.push({ file: a.file, t: l.start || 0, name: l.name }); }
  const scene3d = {
    tool: 'block-shooter-tool', format: 'export3d/2', fps, frames: NF + 1, frameStart: 0, frameEnd: NF, duration: D, width: DW, height: DH, models: 'page-three.js',
    units: { px: PX, note: 'block_root 缩放 0.1（页面 3D 场景单位 → 米）；Y 轴向上；相机与页面 3D 渲染一致（透视，拟合参考视频）' },
    camera: { name: cam.name, type: 'perspective', yfov: cam.fov, aspect: DW / DH, position: R.camera.position.toArray().map(x => r5(x * PX)), target: [S.cam3dTX, S.cam3dTY, S.cam3dTZ].map(x => r5(x * PX)), distance: r5(camD * PX), near: r5(cam.near * PX), far: r5(cam.far * PX) },
    lights: { sun: { name: sun.name, intensity: S.light3dSun, elev: S.light3dElev, azim: S.light3dAzim }, ambient: { intensity: S.light3dAmbient, sky: '#ffffff', ground: '#6a5a80' } },
    visibility: '*_vis 节点 scale=1 显示 / 0 隐藏（STEP）；vox_* 节点消除时缩放到 0；label 下 *_num_<n> 平面 STEP 缩放切换数字', opacity, nodes, audio, mix: mixA ? { file: mixA.file, t: 0 } : null, stats: { ...stats, tracks: tracks.length },
    voxelGrid: { W: L.W, H: L.H, D: L.D, size: r5(Wd.vs * PX), palette: L.palette },
  };
  const enc = new TextEncoder();
  const out = [{ name: 'scene.glb', data: new Uint8Array(glb) }, { name: 'scene3d.json', data: enc.encode(JSON.stringify(scene3d)) }, { name: 'timeline.json', data: fileMap.get('timeline.json') }, { name: 'blender_import.py', data: enc.encode(PY_TEXT) }, { name: 'README_3D.md', data: enc.encode(README_TEXT) }, ...files.filter(f => f.name.startsWith('audio/'))];
  const d = new Date(), p2 = x => String(x).padStart(2, '0'), stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  return { blob: makeZip(out), name: `block-shooter-tool_3d_export_${stamp}.zip`, stats: scene3d.stats, duration: D, fps, glbSize: glb.byteLength };
}
