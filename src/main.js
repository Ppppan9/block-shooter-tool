import { refVolume, refQueues, randomVolume, volumeFromImage, makeLevel, initState, removeVoxel, coords, idx, availCount, SLOTS, COLS, COLORS } from './level.js';
import { GROUPS, DEFS, loadSettings, saveSettings, migrate, exportJSON, APP_ID } from './settings.js';
import { mk, drawBackground, drawDisclaimer, drawResult, drawEnd } from './render2d.js';
import { Sfx } from './audio.js';
import { DEFAULT_HAND } from './default_hand.js';
import { create3D, IS3D, colorHex, makeShooter, geos } from './three/scene3d.js';
import * as THREE from 'three';
import { createWorld, DW, DH, SH } from './world.js';
import { createAERecorder } from './ae/recorder.js';
import { export3D } from './export3d/export3d.js';
import { buildSprites } from './ae/sprites3d.js';

let S = loadSettings(); let r3d = null;
const cv = document.getElementById('stage'); let ctx = cv.getContext('2d');
const sfx = new Sfx();
const now = () => window.__vclock != null ? window.__vclock : performance.now(); // 测试用虚拟时钟（逐帧对比）
const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
const easeIO = t => { t = clamp01(t); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const easeOut = t => 1 - Math.pow(1 - clamp01(t), 3);
const status = t => { document.getElementById('status').textContent = t; };
let L, st, Wd, A = {}, G, finishedAt = 0, failedAt = 0, autoRunning = false, autoToken = 0, lastT = 0, ballSeq = 0, debSeq = 0, shotSfxT = [];
const hand = { x: 820, y: 1450, press: 0, pressT0: null, img: null, visible: false, follow: null };
const ripples = [];
const view = () => { const k = cv.width / DW; return { k, oy: (cv.height - DH * k) / 2 }; };
const rnd = (() => { let s = 12345; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; })();

// ---------- 关卡 ----------
const shapeCache = { src: null, img: null };
const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function imageVolume() {
  if (!S.shapeImg) return null;
  if (shapeCache.src !== S.shapeImg) { shapeCache.src = S.shapeImg; shapeCache.img = null; const im = new Image(); im.onload = () => { shapeCache.img = im; newGame(); }; im.src = S.shapeImg; return null; }
  if (!shapeCache.img) return null;
  const im = shapeCache.img, W = S.shapeW, H = Math.max(1, Math.round(W * im.height / im.width)), c = mk(W, H), g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(im, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  let pal = COLORS.map(n => [n, hexRGB(colorHex(S, n))]);
  if (S.shapePalette === 'auto') pal = quantize(px, S.shapeColors, S.shapeThreshold).map((rgb, i) => { const nm = 'img' + i; S['col_' + nm] = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join(''); return [nm, rgb]; });
  shapeCache.gen = (shapeCache.gen || 0) + 1;
  return volumeFromImage(px, W, H, { W, H, D: S.shapeDepth, threshold: S.shapeThreshold, palette: pal });
}
function quantize(px, k, th) { // k-means（不透明像素），确定性初始化
  const pts = []; for (let i = 0; i < px.length; i += 4) if (px[i + 3] / 255 > th) pts.push([px[i], px[i + 1], px[i + 2]]);
  if (!pts.length) return [[128, 128, 128]];
  let C = [pts[0]]; while (C.length < k) { let best = null, bd = -1; for (const p of pts) { const d = Math.min(...C.map(c => (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2)); if (d > bd) { bd = d; best = p; } } if (bd < 400) break; C.push(best); }
  for (let it = 0; it < 12; it++) { const sum = C.map(() => [0, 0, 0, 0]); for (const p of pts) { let bi = 0, bd = 1e18; C.forEach((c, i) => { const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2; if (d < bd) { bd = d; bi = i; } }); const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; } C = C.map((c, i) => sum[i][3] ? sum[i].slice(0, 3).map(v => Math.round(v / sum[i][3])) : c); }
  return C;
}
function newGame() {
  autoToken++; autoRunning = false; updAutoBtn();
  let vol = null;
  if (S.level === 'image') vol = imageVolume(); else if (S.level === 'random') vol = randomVolume({ W: S.randW, H: S.randH, D: S.randD, colors: S.randColors, seed: S.seed });
  if (!vol && S.level === 'image' && S.shapeImg) { if (L) return; }
  const isRef = !vol; if (!vol) vol = refVolume({ D: S.refDepth });
  const Wtmp = createWorld(S, vol);
  const Lnew = isRef && S.refPrefs ? refQueues(vol, { maxAmmo: S.maxAmmo }) : makeLevel(vol, { maxAmmo: S.maxAmmo, ammoStep: S.ammoStep, parallel: S.autoParallel, seed: S.level === 'image' ? S.shapeSeed : S.seed, prefs: isRef && S.refPrefs ? ['black', 'green', 'purple', 'yellow', 'green', 'black'] : null, worldOf: Wtmp.vox, slotX: Wtmp.slots.map(s => s[0]) });
  if (!Lnew) { status('关卡生成失败'); return; }
  startLevel(Lnew);
}
function startLevel(Lnew) {
  L = Lnew; st = initState(L); finishedAt = 0; failedAt = 0; window.__finished = false; window.__failed = false; lastT = now();
  G = { shooters: [], queues: L.queues.map(() => []), slots: new Array(SLOTS).fill(null), balls: [], pops: [], debris: [], planIdx: 0, shots: 0 };
  L.queues.forEach((q, c) => q.forEach((s, r) => { const sh = { id: G.shooters.length, plan: s, color: s.color, ammo: s.ammo, left: s.ammo, col: c, state: 'queue', row: r, rowFrom: r, rowT: -1e9, slot: -1, t0: 0, fireNext: 0, recoilT: -1e9, pressT: -1e9, inFlight: 0, yaw: 0, aimYaw: 0, turretYaw: 0 }; G.shooters.push(sh); G.queues[c].push(sh); }));
  rebuild();
  if (aeActive()) { aeRec.start(); updateAEButtons(); }
  status(`方块 ${L.voxels} 个（${L.W}×${L.H}×${L.D}），炮台 ${L.plan.length} 个，颜色 ${L.palette.join('/')}`);
}
function rebuild() {
  cv.width = S.canvasW; cv.height = S.canvasH;
  const k = view().k * Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  Wd = createWorld(S, L);
  A = {};
  const full = (id, fn) => { const c = mk(DW * k, DH * k); fn(c); A[id] = { c, w: DW, h: DH, ax: 0, ay: 0 }; };
  full('background', c => drawBackground(c, S, k));
  full('disclaimer', c => { const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); drawDisclaimer(g, S); });
  full('end_card', c => { const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); drawEnd(g, S, 1); });
  full('result_win', c => { const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); drawResult(g, S, true); });
  full('result_lose', c => { const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); drawResult(g, S, false); });
  try { r3d = r3d || create3D(); r3d.setup(S, L, Wd); } catch (e) { console.warn('3D 渲染不可用', e); r3d = null; }
  const hi = hand.img; if (hi) A.hand = { c: hi, w: hi.width, h: hi.height, ax: S.handAnchorX * hi.width, ay: S.handAnchorY * hi.height };
}

// ---------- 规则 / 动画 ----------
const slotPos = i => Wd.slots[i];
// 炮台模型真实包围盒（不含数字标签；底面中心为原点）——小球碰撞与穿模测试共用
function shooterBox() { const key = Wd.SH.w + '|geom'; if (shooterBox.k !== key) { const m = makeShooter(S, 'green', Wd); if (m.userData.label && m.userData.label.parent) m.userData.label.parent.remove(m.userData.label); if (m.userData.body) m.userData.body.rotation.set(0, 0, 0); if (m.userData.upper) m.userData.upper.rotation.set(0, 0, 0); m.updateMatrixWorld(true); const parts = []; const boxOf = (mesh) => { // 只用几何体 AABB，不含描边子网格
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox(); const q = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld); return q; };
    let b = new THREE.Box3(); m.traverse(c => { if (!c.isMesh || c.name.endsWith('_outline') || !/^(track_L|track_R|hull|turret|barrel)$/.test(c.name)) return; const q = boxOf(c); b.union(q); parts.push({ name: c.name, x0: q.min.x, x1: q.max.x, y0: q.min.y, y1: q.max.y, z0: q.min.z, z1: q.max.z }); }); shooterBox.k = key; shooterBox.v = { x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z, parts }; } return shooterBox.v; }
function bobYOf(sh, t) { // 呼吸相位按 id 错开；仅槽位 + 队首行（row===0）使用
  return S.bobAmp * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t / Math.max(1, S.bobPeriod)) + sh.id * 2.399963));
}
function shooterWorld(sh, t) { // 炮台底面中心世界坐标 + 缩放 + yaw；bobY 仅视觉
  const [qx, qz] = Wd.queuePos(sh.col, 0);
  // 备选列：仅最前排（row===0，贴近粉边）呼吸；后排静止（参考红圈仅前两行）
  if (sh.state === 'queue') { const p = easeIO((t - sh.rowT) / S.advanceDur), r = sh.rowFrom + (sh.row - sh.rowFrom) * p, q = Wd.queuePos(sh.col, r); return { x: q[0], y: 0, z: q[1], s: 1, bobY: sh.row === 0 ? bobYOf(sh, t) : 0, yaw: 0, turretYaw: 0 }; }
  if (sh.state === 'jump') { const p = clamp01((t - sh.t0) / S.jumpDur), e = easeIO((p - 0.2) / 0.6), [sx, sz] = slotPos(sh.slot); return { x: qx + (sx - qx) * e, y: Math.min(1, Math.sin(Math.PI * p) * 1.6) * S.jumpHeight, z: qz + (sz - qz) * e, s: 1, yaw: sh.yaw || 0, turretYaw: sh.turretYaw || 0 }; }
  const [sx, sz] = slotPos(sh.slot);
  // 槽位行也呼吸（与队首构成画面前两行）
  if (sh.state === 'slot') { const rp = (t - sh.recoilT) / 90, rc = rp >= 0 && rp < 1 ? Math.sin(Math.PI * rp) * S.recoil : 0, land = (t - sh.t0) / 160, sq = land < 1 ? 1 - 0.12 * Math.sin(Math.PI * land) : 1; return { x: sx, y: 0, z: sz + rc, s: 1, sy: sq, bobY: bobYOf(sh, t), yaw: sh.yaw || 0, turretYaw: sh.turretYaw || 0 }; }
  if (sh.state === 'leave') { const p = clamp01((t - sh.t0) / S.leaveDur); return { x: sx, y: Math.sin(Math.PI * Math.min(1, p * 1.6)) * 0.8, z: sz, s: Math.max(0.001, 1 - easeIO(p)), yaw: sh.yaw || 0, turretYaw: sh.turretYaw || 0 }; }
  return null;
}
function frontOf(c) { return G.queues[c].find(s => s.state === 'queue') || null; }
function tapShooter(sh) {
  if (!sh || sh.state !== 'queue' || G.queues[sh.col][0] !== sh || finishedAt) return false;
  sh.pressT = now();
  const si = G.slots.indexOf(null); if (si < 0) { sfx.play('error', S); return false; } // 槽位已满
  G.slots[si] = sh; sh.slot = si; sh.state = 'jump'; sh.t0 = now(); G.taps = (G.taps || 0) + 1; sfx.play('pop', S);
  const q = G.queues[sh.col]; q.shift(); q.forEach((o, r) => { o.rowFrom = o.state === 'queue' ? currentRow(o) : r + 1; o.row = r; o.rowT = now() + S.jumpDur * 0.25; }); // 后排等队首起跳后再前移（不撞上）
  return true;
}
function currentRow(o) { const p = easeIO((now() - o.rowT) / S.advanceDur); return o.rowFrom + (o.row - o.rowFrom) * p; }
// 目标：外露同色未预定，按离炮口距离排序，取前若干个中第一个“弹道不穿方块”的
const FACES = [[0, 1, 0], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, 0, -1]];
function hitPoint(n, from) {
  const [i, j, k] = coords(L, n), c = Wd.vox(n); let best = null, bs = -1e9;
  for (const f of FACES) { const a = i + f[0], b = j + f[1], kk = k - f[2]; const open = b >= L.H || kk < 0 || a < 0 || a >= L.W || (kk < L.D && st.vox[idx(L, a, b, kk)] === 0); if (!open || kk >= L.D) continue;
    const dx = from[0] - c[0], dy = from[1] - c[1], dz = from[2] - c[2], sc = (f[0] * dx + f[1] * dy + f[2] * dz) / Math.hypot(dx, dy, dz) + (f[1] ? 0.15 : 0) + (f[2] === 1 ? 0.35 : 0); if (sc > bs) { bs = sc; best = f; } }
  if (!best) best = [0, 1, 0]; const off = Wd.vs / 2 + S.ballR + 0.02;
  return { p: [c[0] + best[0] * off, c[1] + best[1] * off, c[2] + best[2] * off], nrm: best };
}
function ballPath(p0, p1, arc = S.ballArc, ctrl = null) {
  if (ctrl && ctrl.length === 2) { const [c1, c2] = ctrl; return u => { const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u; return [0, 1, 2].map(k => a * p0[k] + b * c1[k] + c * c2[k] + d * p1[k]); }; } // 三次：先升高越过方块，再沿外露面法线方向落入
  const mid = ctrl || [(p0[0] + p1[0]) / 2, Math.max(p0[1], p1[1]) + arc, (p0[2] + p1[2]) / 2]; return u => { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u; return [a * p0[0] + b * mid[0] + c * p1[0], a * p0[1] + b * mid[1] + c * p1[1], a * p0[2] + b * mid[2] + c * p1[2]]; }; }
function sphereHitsVox(p, r, skip) { // 球与已占方块（圆角忽略，按格子盒）是否相交
  const vs = Wd.vs, ci = Math.floor(p[0] / vs + L.W / 2), cj = Math.floor(p[1] / vs), ck = Math.floor(-p[2] / vs);
  for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) for (let c = ck - 1; c <= ck + 1; c++) {
    if (a < 0 || b < 0 || c < 0 || a >= L.W || b >= L.H || c >= L.D) continue; const n = idx(L, a, b, c); if (n === skip || !st.vox[n]) continue;
    const x0 = (a - L.W / 2) * vs, y0 = b * vs, z1 = -c * vs, z0 = z1 - vs; const qx = Math.max(x0, Math.min(p[0], x0 + vs)), qy = Math.max(y0, Math.min(p[1], y0 + vs)), qz = Math.max(z0, Math.min(p[2], z1));
    if ((qx - p[0]) ** 2 + (qy - p[1]) ** 2 + (qz - p[2]) ** 2 < r * r) return { n, q: [qx, qy, qz] };
  }
  return null;
}
function pickTargetLOS(sh, muz) {
  const c = sh.color, cand = [];
  // 任一面外露的同色未预定方块；选离炮口最近且弹道不穿实心体素的（一发一格）
  for (const m of st.exp[c]) { if (st.claimed[m]) continue; const p = Wd.vox(m), d = (p[0] - muz[0]) ** 2 + (p[1] - muz[1]) ** 2 * 0.6 + (p[2] - muz[2]) ** 2; cand.push([d, m]); }
  if (!cand.length) return null; cand.sort((a, b) => a[0] - b[0]);
  const clear = (path, m) => { const p0 = path(0), p1 = path(0.5), p2 = path(1), len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]), n = Math.max(12, Math.ceil(len / (S.ballR * 0.5))); for (let s = 1; s <= n; s++) if (sphereHitsVox(path(s / n), S.ballR + 0.005, -1)) return false; return true; };
  const top = L.H * Wd.vs;
  // 平射 / 抛物线落到该体素朝向炮口的最优外露面（hitPoint 偏好正面）
  for (const arc of [S.ballArc, S.ballArc * 2 + 2, S.ballArc * 4 + 6, -1, -2, -3, -4]) for (let q = 0; q < Math.min(cand.length, 80); q++) { const m = cand[q][1], hp = hitPoint(m, muz), n = hp.nrm;
    const LOB = { '-1': [3, 3], '-2': [10, 1.5], '-3': [10, 5], '-4': [18, 3] }[arc] || [0, 0], hh = top + LOB[0], dd = Wd.vs * LOB[1], ctrl = arc >= 0 ? null : [[muz[0], hh, muz[2]], [hp.p[0] + n[0] * dd, hh, hp.p[2] + n[2] * dd]];
    const path = ballPath(muz, hp.p, arc, ctrl); if (clear(path, m)) return { m, hp, path }; }
  // 隧道/竖井：剥落后腔内露时，沿法线走出体块再直线飞入（球体 LOS，不穿实心）
  for (let q = 0; q < Math.min(cand.length, 80); q++) { const m = cand[q][1], hp = hitPoint(m, muz), n = hp.nrm; const [i0, j0, k0] = coords(L, m); let a = i0, b = j0, ck = k0, steps = 0, out = false;
    while (steps++ < 80) { a += n[0]; b += n[1]; ck -= n[2]; if (a < 0 || b < 0 || ck < 0 || a >= L.W || b >= L.H || ck >= L.D) { out = true; break; } if (st.vox[idx(L, a, b, ck)]) break; }
    if (!out) continue; const E = [hp.p[0] + n[0] * (steps + 0.5) * Wd.vs, hp.p[1] + n[1] * (steps + 0.5) * Wd.vs, hp.p[2] + n[2] * (steps + 0.5) * Wd.vs];
    for (const lift of [0, 3, 8]) { const dE = Math.hypot(E[0] - muz[0], E[1] - muz[1], E[2] - muz[2]), C = [E[0] + n[0] * dE * 0.5, E[1] + n[1] * dE * 0.5 + lift, E[2] + n[2] * dE * 0.5], A = ballPath(muz, E, 0, C), lB = Math.hypot(E[0] - hp.p[0], E[1] - hp.p[1], E[2] - hp.p[2]), wA = dE / (dE + lB || 1);
      const path = u => u < wA ? A(u / wA) : (v => [E[0] + (hp.p[0] - E[0]) * v, E[1] + (hp.p[1] - E[1]) * v, E[2] + (hp.p[2] - E[2]) * v])((u - wA) / (1 - wA || 1));
      if (clear(path, m)) return { m, hp, path }; } }
  const m = cand[0][1], hp = hitPoint(m, muz); if (window.__dbgBlocked) (window.__blk = window.__blk || []).push({ why: (() => { const hh = top + 10, dd = Wd.vs * 1.5, n2 = hp.nrm, path = ballPath(muz, hp.p, -2, [[muz[0], hh, muz[2]], [hp.p[0] + n2[0] * dd, hh, hp.p[2] + n2[2] * dd]]); for (let q = 1; q <= 200; q++) { const h = sphereHitsVox(path(q / 200), S.ballR + 0.005, -1); if (h) return [q / 200, h.n, coords(L, h.n), path(q / 200).map(x => +x.toFixed(2))]; } return null; })(), n: cand.length, m, c: coords(L, m), nrm: hp.nrm, muz, nb: [[0,1,0],[0,0,-1],[-1,0,0],[1,0,0],[0,0,1]].map(f => { const [i, j, k] = coords(L, m), a = i + f[0], b = j + f[1], c2 = k + f[2]; return a < 0 || b < 0 || c2 < 0 || a >= L.W || b >= L.H || c2 >= L.D ? 'out' : st.vox[idx(L, a, b, c2)]; }) }); return { m, hp, path: ballPath(muz, hp.p, S.ballArc * 8 + 12), blocked: true };
}
function playShot(t) { shotSfxT = shotSfxT.filter(x => t - x < 1000); if (shotSfxT.length < S.sfxShootMax) { shotSfxT.push(t); sfx.play('shoot', S); } }
function step(t) {
  const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t; if (!G) return;
  // 炮台状态
  for (const sh of G.shooters) {
    if (sh.state === 'jump' && t - sh.t0 >= S.jumpDur) { sh.state = 'slot'; sh.t0 = t; sh.fireNext = t + 60; }
    if (sh.state === 'slot') {
      let guard = 0;
      // 车身/炮塔转向目标（参考：射击时上下半身都会 yaw；弹道仍从默认炮口，碰撞盒未随转）
      {
        const turn = (S.aimSpeed * Math.PI / 180) * dt;
        let dy = sh.aimYaw - sh.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        if (Math.abs(dy) <= turn) sh.yaw = sh.aimYaw; else sh.yaw += Math.sign(dy) * turn;
        const lead = (S.turretExtra || 0) * Math.PI / 180 * (Math.abs(dy) > 0.02 ? Math.sign(dy) : 0);
        const tAim = sh.aimYaw + lead;
        let dty = tAim - sh.turretYaw; while (dty > Math.PI) dty -= Math.PI * 2; while (dty < -Math.PI) dty += Math.PI * 2;
        const turnU = turn * 1.4;
        if (Math.abs(dty) <= turnU) sh.turretYaw = tAim; else sh.turretYaw += Math.sign(dty) * turnU;
      }
      while (sh.left > 0 && t >= sh.fireNext && guard++ < 8) {
        const w = shooterWorld(sh, t), muz = Wd.muzzleOf(w.x, w.z, 0), tg = pickTargetLOS(sh, muz);
        if (!tg) { sh.fireNext = t + 50; break; }
        if (tg.blocked && (sh.blockWait = (sh.blockWait || 0) + 1) < 40) { sh.fireNext = t + 50; break; } sh.blockWait = 0;
        sh.aimYaw = Math.atan2(-(tg.hp.p[0] - w.x), -(tg.hp.p[2] - w.z));
        st.claimed[tg.m] = 1; sh.left--; sh.inFlight++; sh.recoilT = sh.fireNext; G.shots++;
        const len = Math.hypot(tg.hp.p[0] - muz[0], tg.hp.p[1] - muz[1], tg.hp.p[2] - muz[2]) + S.ballArc;
        window.__blockedShots = (window.__blockedShots || 0) + (tg.blocked ? 1 : 0); G.balls.push({ id: ++ballSeq, ph: 'fly', t0: sh.fireNext, dur: Math.max(60, len / S.ballSpeed * 1000), path: tg.path, m: tg.m, nrm: tg.hp.nrm, sh, pos: muz.slice(), blocked: !!tg.blocked });
        playShot(t); sh.fireNext += 1000 / S.fireRate;
      }
      if ((sh.left <= 0 || st.left[sh.color] === 0) && sh.inFlight <= 0 && t - sh.recoilT > 120) { sh.state = 'leave'; sh.t0 = t; sfx.play('whoosh', S, { dur: S.leaveDur / 1000 }); }
    }
    if (sh.state === 'leave' && t - sh.t0 >= S.leaveDur) { sh.state = 'gone'; if (G.slots[sh.slot] === sh) G.slots[sh.slot] = null; }
  }
  // 小球
  const g = S.gravity, r = S.ballR;
  for (const b of G.balls) {
    if (b.ph === 'fly') {
      const u = clamp01((t - b.t0) / b.dur); b.pos = b.path(u);
      if (u >= 1) { // 命中：消除方块 + 碎屑 + 弹开
        const col = L.palette[st.vox[b.m] - 1]; removeVoxel(L, st, b.m); b.sh.inFlight--; G.pops.push({ n: b.m, t0: t, c: st.vox[b.m] || 0, color: col }); if (Math.random() < 0.5) sfx.play('hit', S);
        const vp = Wd.vox(b.m), dsp = S.debrisSpread, R = Math.random; for (let q = 0; q < S.debrisCount; q++) G.debris.push({ id: ++debSeq, color: col, p: [vp[0] + (R() - 0.5) * 0.55, vp[1] + (R() - 0.5) * 0.55, vp[2] + (R() - 0.5) * 0.55], v: [b.nrm[0] * 2.8 * dsp + (R() - 0.5) * 4.5 * dsp, (2.8 + R() * 5) * dsp, b.nrm[2] * 2.8 * dsp + (R() - 0.5) * 4.5 * dsp], t0: t, s: S.debrisSize * (0.55 + R() * 0.9), rot: R() * 6 }); // 同色果冻碎屑（Math.random，不消耗物理 rnd）
        const d0 = b.path(0.97), d1 = b.path(1), dir = [d1[0] - d0[0], d1[1] - d0[1], d1[2] - d0[2]], dl = Math.hypot(...dir) || 1, n = b.nrm, dn = (dir[0] * n[0] + dir[1] * n[1] + dir[2] * n[2]) / dl;
        const ref = [dir[0] / dl - 2 * dn * n[0], dir[1] / dl - 2 * dn * n[1], dir[2] / dl - 2 * dn * n[2]], sp = S.bounceSpeed * (0.7 + 0.6 * rnd()), side = (rnd() - 0.5) * 0.9;
        b.ph = 'bounce'; b.tb = t; b.vel = [ref[0] * sp + side * sp, Math.abs(ref[1]) * sp * 0.6 + 2.5, ref[2] * sp + 1.5];
      }
    } else if (b.ph === 'bounce') {
      const sub = 4, h = dt / sub;
      for (let q = 0; q < sub; q++) {
        b.vel[1] -= g * h; const np = [b.pos[0] + b.vel[0] * h, b.pos[1] + b.vel[1] * h, b.pos[2] + b.vel[2] * h];
        const hv = sphereHitsVox(np, r, -1); if (hv) { // 撞到方块：沿穿入方向反弹
          const d = [np[0] - hv.q[0], np[1] - hv.q[1], np[2] - hv.q[2]], dl = Math.hypot(...d) || 1, nn = d.map(x => x / dl), vn = b.vel[0] * nn[0] + b.vel[1] * nn[1] + b.vel[2] * nn[2];
          if (vn < 0) for (let a = 0; a < 3; a++) b.vel[a] -= 1.5 * vn * nn[a]; continue; }
        const onBase = np[0] > Wd.base.x0 && np[0] < Wd.base.x1 && np[2] > Wd.base.z0 && np[2] < Wd.base.z1, floor = (onBase ? Wd.base.y1 : 0) + r;
        if (np[1] < floor && b.vel[1] < 0) { np[1] = floor; b.vel[1] *= -0.45; b.vel[0] *= 0.8; b.vel[2] *= 0.8; }
        for (const sh of G.shooters) { if (sh.state === 'gone') continue; const w = shooterWorld(sh, t); if (!w) continue; const B = shooterBox(), ws = w.s || 1, ex = Math.max(-B.x0, B.x1) * ws + r, ez = Math.max(-B.z0, B.z1) * ws + r, hy = B.y1 * ws * (w.sy ?? 1) + r; const by0 = w.y + B.y0 * ws - r; if (Math.abs(np[0] - w.x) < ex && Math.abs(np[2] - w.z) < ez && np[1] < w.y + hy && np[1] > by0) { // 球在炮台包围盒内：沿最浅方向推出
            const pu = w.y + hy - np[1], pd = np[1] - by0, px = ex - Math.abs(np[0] - w.x), pz = ez - Math.abs(np[2] - w.z), mn = Math.min(pu, pd, px, pz);
            if (mn === pu) { np[1] = w.y + hy; if (b.vel[1] < 0) b.vel[1] *= -0.4; } else if (mn === px) { const sg = Math.sign(np[0] - w.x) || 1; np[0] = w.x + sg * ex; b.vel[0] = sg * Math.abs(b.vel[0]) * 0.5; } else if (mn === pz) { const sg = Math.sign(np[2] - w.z) || 1; np[2] = w.z + sg * ez; b.vel[2] = sg * Math.abs(b.vel[2]) * 0.5; } else { np[1] = by0; if (b.vel[1] > 0) b.vel[1] = 0; } } }
        b.pos = np;
      }
      if (t - b.tb > S.ballLife) b.ph = 'gone';
    }
  }
  G.balls = G.balls.filter(b => b.ph !== 'gone');
  for (const d of G.debris) { d.v[1] -= g * dt; d.p = [d.p[0] + d.v[0] * dt, d.p[1] + d.v[1] * dt, d.p[2] + d.v[2] * dt]; d.rot += dt * 8; }
  G.debris = G.debris.filter(d => t - d.t0 < S.debrisLife);
  G.pops = G.pops.filter(p => t - p.t0 < S.popDur);
  // 胜负
  if (!finishedAt && st.total === 0 && !G.balls.some(b => b.ph === 'fly')) { finishedAt = t; onFinish(); }
  if (!finishedAt && !failedAt && S.loseRule === 'on' && G.slots.every(s => s && s.state === 'slot') && !G.balls.some(b => b.ph === 'fly') && G.slots.every(s => s.left > 0 && st.left[s.color] > 0 && availCount(L, st, s.color) <= 0)) { failedAt = t; sfx.play('error', S); status('槽位已满且都没有可打的方块（失败）——点“↻ 重新开始”'); window.__failed = true; }
}

// ---------- 场景（每帧元素列表；页面 3D / AE / 3D 导出同源）----------
// item: {id, asset, x, y, sx, sy, rot, op, z, w:[世界], ws, num, numOp}
const ppuRef = () => { const a = Wd.proj(0, 0, 6), b = Wd.proj(1, 0, 6); return Math.hypot(b[0] - a[0], b[1] - a[1]); };
function scene(t) {
  const out = [], add = (id, asset, x, y, o = {}) => { const it = { id, asset, x, y, sx: o.sx ?? 1, sy: o.sy ?? o.sx ?? 1, rot: o.rot || 0, op: o.op ?? 1, z: o.z ?? 0, ...o.extra }; out.push(it); return it; };
  const K0 = ppuRef();
  const at3 = (id, asset, w, ws, z, extra = {}) => { const p = Wd.proj(w[0], w[1], w[2]), a = Wd.proj(w[0] - 0.5, w[1], w[2]), b = Wd.proj(w[0] + 0.5, w[1], w[2]), k = Math.hypot(b[0] - a[0], b[1] - a[1]) / K0; return add(id, asset, p[0], p[1], { sx: ws * k * (extra.wsx ?? 1), sy: ws * k * (extra.wsy ?? 1), z: z ?? (10 + (1 - p[2]) * 1e3), extra: { w: w.slice(), ws, ...extra } }); };
  add('background', 'background', 0, 0, { z: 0 });
  for (let i = 0; i < SLOTS; i++) { const [x, zz] = Wd.slots[i]; at3('slot_' + (i + 1), 'slot', [x, 0.04, zz], 1, 2); }
  const RX = 0.9655, RZ = -0.2599; // 相机右向量（水平）
  const labPx = (lp, w, ws) => { const q = Wd.proj(w.x + RX, w.y + SH.h * 1.18 * ws * (w.sy ?? 1), w.z + 0.1 + RZ); const ppu = Math.hypot(q[0] - lp[0], q[1] - lp[1]); return 0.95 * 46 / 64 * ppu * ws / 24; };
  for (const sh of G.shooters) {
    if (sh.state === 'gone') continue; const w = shooterWorld(sh, t); if (!w) continue;
    const pp = (t - sh.pressT) / 160, pr = pp >= 0 && pp < 1 ? 1 - S.pressScale * Math.sin(Math.PI * pp) : 1;
    if (sh.state === 'queue' && sh.row > 16) continue; // 画面外
    const front = sh.state !== 'queue' || G.queues[sh.col][0] === sh;
    const wy = w.y + (w.bobY || 0), ws = w.s * pr, lp = Wd.proj(w.x, wy + SH.h * 1.18 * ws * (w.sy ?? 1), w.z + 0.1);
    at3('shooter_' + String(sh.id + 1).padStart(3, '0'), 'shooter_' + L.palette[sh.color], [w.x, wy, w.z], ws, undefined, { num: sh.left, numOp: front ? 1 : S.numBackOpacity, wsy: w.sy ?? 1, lx: lp[0], ly: lp[1], lsx: labPx(lp, w, ws), bodyYaw: w.yaw || 0, turretYaw: w.turretYaw || 0 });
  }
  for (const b of G.balls) { const life = b.ph === 'bounce' ? clamp01((S.ballLife - (t - b.tb)) / 200) : 1; at3('ball_' + b.id, 'ball', b.pos, life); }
  for (const d of G.debris) { const p = clamp01((t - d.t0) / S.debrisLife); at3('debris_' + d.id, 'debris_' + d.color, d.p, d.s * (1 - p), undefined, { rx: d.rot, ry: d.rot * 0.7 }); }
  if (S.discShow) add('disclaimer', 'disclaimer', 0, 0, { z: 90 });
  if (finishedAt && t - finishedAt > 300) add('result_win', 'result_win', 0, 0, { z: 92, op: clamp01((t - finishedAt - 300) / 300) });
  if (failedAt) add('result_lose', 'result_lose', 0, 0, { z: 92, op: clamp01((t - failedAt) / 300) });
  const ea = endAlpha(t); if (ea > 0) add('end_card', 'end_card', 0, 0, { z: 95, op: ea });
  const hs = handState(); if (hs) add('hand', 'hand', hs.x, hs.y, { sx: hs.s * (S.handFlip ? -1 : 1), sy: hs.s, rot: S.handRotation * Math.PI / 180, z: 100 });
  out.sort((a, b) => a.z - b.z);
  return out;
}
// 体素渲染列表：每色 [格子号, 缩放]（外露方块 + 正在缩小消失的方块）
function voxGroups(t) {
  // 外露方块 + 紧贴其内侧的一层（圆角缝隙处不会透出底座 / 背景）；按状态版本缓存
  if (!voxGroups.c || voxGroups.c.st !== st || voxGroups.c.ver !== (st.ver || 0)) {
    const seen = new Uint8Array(st.vox.length), base = L.palette.map(() => []), W = L.W, WH = L.W * L.H;
    const push = n => { if (seen[n] || !st.vox[n]) return; seen[n] = 1; base[st.vox[n] - 1].push([n, 1]); };
    for (let c = 0; c < L.palette.length; c++) for (const n of st.exp[c]) { push(n); const [i, j, k] = coords(L, n); if (j > 0) push(n - W); if (k < L.D - 1) push(n + WH); if (i > 0) push(n - 1); if (i < W - 1) push(n + 1); }
    voxGroups.c = { st, ver: st.ver || 0, base };
  }
  const gr = voxGroups.c.base.map(l => l.slice());
  for (const p of G.pops) {
    const c = L.palette.indexOf(p.color); if (c < 0) continue;
    const u = clamp01((t - p.t0) / Math.max(1, S.popDur)), j = S.jellyPop ?? 1;
    let sx, sy, sz;
    if (u < 0.32) { // 命中先压扁（果冻挤压）
      const k = Math.sin(Math.PI * (u / 0.32)); sy = 1 - 0.42 * j * k; sx = sz = 1 + 0.28 * j * k;
    } else { // 再拉长弹开并缩小消失
      const k = (u - 0.32) / 0.68, fade = Math.max(0.001, 1 - easeOut(k)), stretch = Math.sin(Math.PI * Math.min(1, k * 1.15));
      sy = (1 + 0.55 * j * stretch) * fade; sx = sz = (1 - 0.2 * j * stretch) * fade;
    }
    gr[c].push([p.n, sx, sy, sz]);
  }
  return gr;
}
function drawScene(items, g, k) {
  for (const it of items) {
    const a = A[it.asset]; if (!a || it.op <= 0) continue;
    g.setTransform(k, 0, 0, k, 0, view().oy); g.translate(it.x, it.y); if (it.rot) g.rotate(it.rot); g.scale(it.sx, it.sy);
    g.globalAlpha = Math.min(1, it.op); g.drawImage(a.c, -a.ax, -a.ay, a.w, a.h);
  }
  g.globalAlpha = 1;
}
function draw(t) {
  const v = view(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  const items = scene(t); draw.items = items;
  drawScene(items.filter(it => it.z < 1), ctx, v.k);
  if (r3d && !window.__no3d) { const img = r3d.render({ items, vox: voxGroups(t) }, S, Math.round(DW * v.k), Math.round(DH * v.k)); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(img, 0, v.oy, DW * v.k, DH * v.k); }
  drawScene(items.filter(it => it.z >= 1 && !IS3D(it.asset)), ctx, v.k);
  ctx.setTransform(v.k, 0, 0, v.k, 0, v.oy);
  ripples.forEach(r => { const p = (t - r.t0) / 350; if (p > 1) return; ctx.beginPath(); ctx.arc(r.x, r.y, 10 + 30 * p, 0, 7); ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`; ctx.lineWidth = 3; ctx.stroke(); });
  while (ripples.length && t - ripples[0].t0 > 400) ripples.shift();
}
function endAlpha(t) { return finishedAt && S.endCard && t - finishedAt > S.endDelay ? Math.min(1, (t - finishedAt - S.endDelay) / 400) : 0; }
function handScaleOf() { return hand.img ? S.handSize * DW / hand.img.width : 1; }
const handHiddenByEnd = () => !S.endCardHand && endAlpha(now()) > 0;
function handState() { if (!S.handShow || !hand.img || !hand.visible || handHiddenByEnd()) return null; return { x: hand.x, y: hand.y, s: handScaleOf() * (1 - S.pressDepth * hand.press) }; }
// 手指出现在画面上时隐藏系统鼠标（与麻将/打螺丝/咖啡统一：hideCursor）
function handCursorHidden() { return !!(S.hideCursor && S.handShow && hand.img && !handHiddenByEnd() && (!autoRunning || hand.visible)); }
function updateCursor() { const c = handCursorHidden() ? 'none' : 'pointer'; if (cv.style.cursor !== c) cv.style.cursor = c; }

// ---------- 交互 ----------
function shooterScreen(sh) { const w = shooterWorld(sh, now()); const p = Wd.proj(w.x, SH.h * 0.75, w.z); return [p[0], p[1]]; }
function hitShooter(x, y) { // 屏幕点 → 炮台中部高度平面 → 最近的队首炮台
  const p = Wd.un(x, y, SH.h * 0.6); let best = null, bd = 1e9;
  for (let c = 0; c < COLS; c++) { const sh = G.queues[c][0]; if (!sh) continue; const w = shooterWorld(sh, now()), d = Math.hypot((p.x - w.x) / (SH.w * 0.6), (p.z - w.z) / (SH.d * 0.7)); if (d < 1 && d < bd) { bd = d; best = sh; } }
  return best;
}
function tapAt(x, y) { sfx.resume(); if (S.tapRipple) ripples.push({ x, y, t0: now() }); if (finishedAt) return false; return tapShooter(hitShooter(x, y)); }
function evtPos(e) { const r = cv.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * cv.width, py = (e.clientY - r.top) / r.height * cv.height; const v = view(); return { x: px / v.k, y: (py - v.oy) / v.k }; }
let pointerDown = false;
cv.addEventListener('pointerdown', e => { if (autoRunning) return; sfx.resume(); const p = evtPos(e); hand.x = p.x; hand.y = p.y; hand.visible = true; pointerDown = true; hand.follow = 1; if (S.pressEnabled) hand.pressT0 = now(); try { cv.setPointerCapture(e.pointerId); } catch (_) { } tapAt(p.x, p.y); });
cv.addEventListener('pointermove', e => { if (autoRunning) return; const p = evtPos(e); hand.x = p.x; hand.y = p.y; hand.visible = true; });
cv.addEventListener('pointerup', () => { if (autoRunning) return; pointerDown = false; hand.follow = null; hand.pressT0 = null; });
cv.addEventListener('pointercancel', () => { pointerDown = false; hand.follow = null; });
cv.addEventListener('pointerleave', () => { if (!autoRunning && !pointerDown) hand.visible = false; });
function updPress(t) { if (!S.pressEnabled || hand.pressT0 == null) { hand.press = 0; return; } const p = (t - hand.pressT0) / 180; hand.press = p < 0 || p > 1 ? (hand.follow ? 1 : 0) : (hand.follow && p > 0.5 ? 1 : Math.sin(Math.PI * p)); }

// ---------- 自动通关（手指按计划顺序点击队首炮台）----------
const wait = (ms, tok) => new Promise((res, rej) => { const t0 = now(), f = () => { if (tok !== autoToken) return rej('stop'); if (now() - t0 >= ms / S.autoSpeed) return res(); requestAnimationFrame(f); }; f(); });
const rr = (a, b) => a + Math.random() * Math.max(0, b - a);
const frame = () => new Promise(r => requestAnimationFrame(r));
async function moveHand(tx, ty, tok) {
  const x0 = hand.x, y0 = hand.y, dur = rr(S.moveMin, S.moveMax) / S.autoSpeed, t0 = now();
  const cx = (x0 + tx) / 2 + (Math.random() - 0.3) * 60, cy = (y0 + ty) / 2 + 40 + Math.random() * 40;
  while (true) { if (tok !== autoToken) throw 'stop'; const p = Math.min(1, (now() - t0) / dur), e = easeIO(p); hand.x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * tx; hand.y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * ty; if (p >= 1) return; await frame(); }
}
// 下一个要点的炮台：计划顺序（生成器保证可解）；条件：同时射击数 < autoParallel、槽位有空、且该色“外露未预定”≥ 它的弹药（否则等前面的打完）
function nextAuto() {
  if (L.dynamic) return nextAutoDynamic();
  const pend = G.shooters.filter(s => s.state === 'queue').sort((a, b) => a.plan.id - b.plan.id); const nx = pend[0]; if (!nx) return null;
  const active = G.slots.filter(s => s && s.state !== 'leave').length, free = G.slots.indexOf(null) >= 0;
  if (!free || active >= S.autoParallel) return { wait: true };
  if (G.queues[nx.col][0] !== nx) return { wait: true };
  const outst = G.slots.filter(s => s && s.color === nx.color).reduce((a, s) => a + s.left, 0);
  if (availCount(L, st, nx.color, outst) < nx.ammo) return active > 0 ? { wait: true } : nextAutoDynamic(); // 外露可打不足：有槽内炮台则等；否则退回按外露动态选
  return { sh: nx };
}
function nextAutoDynamic() {
  // 参考开局：黄（第 4 列）→ 黑（第 1 列）→ 绿（第 2 列）依次进槽（0.4 / 1.2 / 2.0 s），之后按外露可打数动态选择
  if (S.refOpening && G.taps < 3) { const c = [3, 0, 1][G.taps], sh = G.queues[c][0]; if (sh && G.slots.indexOf(null) >= 0) return { sh }; }
  const active = G.slots.filter(s => s && s.state !== 'leave').length; if (G.slots.indexOf(null) < 0 || active >= S.autoParallel) return { wait: true };
  let best = null, ba = 0; for (let c = 0; c < COLS; c++) { const sh = G.queues[c][0]; if (!sh) continue; const out = G.slots.filter(s => s && s.color === sh.color).reduce((a, s) => a + s.left, 0), a = availCount(L, st, sh.color, out); if (a > ba) { ba = a; best = sh; } }
  if (!best) return G.shooters.some(s => s.state === 'queue') ? { wait: true } : null; return { sh: best };
}
async function autoSolve() {
  if (autoRunning) { autoToken++; autoRunning = false; hand.visible = false; hand.follow = null; updAutoBtn(); return; }
  if (finishedAt || failedAt) newGame();
  const tok = ++autoToken; autoRunning = true; updAutoBtn(); sfx.resume();
  hand.x = 640; hand.y = 1150; hand.visible = true;
  if (S.autoRec && !rec) startRec();
  try {
    await wait(S.autoStartDelay, tok);
    while (!finishedAt && !failedAt) {
      const nx = nextAuto();
      if (!nx) { await frame(); if (G.shooters.every(s => s.state !== 'queue')) { while (!finishedAt && !failedAt) { if (tok !== autoToken) throw 'stop'; await frame(); } break; } continue; }
      if (nx.wait) { if (S.handRest && Math.hypot(hand.x - 600, hand.y - 1080) > 30 && !moveHand.resting) { moveHand.resting = true; await moveHand(600 + rr(-20, 20), 1080 + rr(-20, 20), tok); } await frame(); continue; }
      moveHand.resting = false;
      const sh = nx.sh, [x, y] = shooterScreen(sh), j = S.jitter;
      await moveHand(x + (Math.random() - 0.5) * j, y + (Math.random() - 0.5) * j, tok);
      if (S.pressEnabled) hand.pressT0 = now();
      await wait(60, tok);
      if (G.queues[sh.col][0] === sh) tapShooter(sh);
      await wait(rr(S.delayMin, S.delayMax) + (Math.random() < S.thinkChance ? Math.random() * S.thinkMax : 0), tok);
    }
  } catch (e) { if (e !== 'stop') console.error(e); }
  if (tok === autoToken) { autoRunning = false; updAutoBtn(); }
}
function onFinish() { status('通关！'); window.__finished = true; sfx.play('chime', S); if (rec && S.autoStop) setTimeout(stopRec, S.tailSec * 1000 + (S.endCard ? S.endDelay : 0)); }
function updAutoBtn() { const b = document.getElementById('btnAuto'); if (b) { b.textContent = autoRunning ? '■ 停止' : '▶ 自动通关'; b.classList.toggle('on', autoRunning); } }

// ---------- 录制（仅“⏺ 开始录制”按钮或 autoRec）----------
let rec = null, recChunks = [], recT0 = 0;
function pickMime() {
  const mp4 = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4'], webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const list = S.recFormat === 'webm' ? webm : S.recFormat === 'mp4' ? mp4 : mp4.concat(webm);
  return list.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}
function startRec() {
  if (!window.MediaRecorder) { status('浏览器不支持录制'); return; }
  sfx.ensure();
  const vs = cv.captureStream(S.recFps), tracks = [...vs.getVideoTracks()];
  if (sfx.recDest) tracks.push(...sfx.recDest.stream.getAudioTracks());
  const mime = pickMime();
  rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime || undefined, videoBitsPerSecond: S.recBitrate * 1e6 });
  recChunks = []; rec.ondataavailable = e => e.data.size && recChunks.push(e.data);
  rec.onstop = () => {
    const type = rec.mimeType || mime || 'video/webm', ext = type.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(recChunks, { type }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `block_shooter_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`; a.textContent = `⬇ ${a.download} (${(blob.size / 1e6).toFixed(1)}MB)`;
    document.getElementById('recList').prepend(a); window.__lastRec = { size: blob.size, type }; rec = null; updRecBtn();
    if (aeByRec && aeActive()) aeStopAndExport().catch(e => console.error(e));
    aeByRec = false;
  };
  rec.start(250); recT0 = now(); updRecBtn(); aeByRec = false; if (S.aeWithRec && !aeActive()) { recStart(); aeByRec = true; }
}
function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); }
function updRecBtn() { const b = document.getElementById('btnRec'); b.textContent = rec ? '■ 停止录制' : '⏺ 开始录制'; b.classList.toggle('on', !!rec); }

// ---------- AE / 3D 导出 ----------
const aeRec = createAERecorder({ sfx, now, sprites: r => buildSprites(r.S, r.L, r.Wd), env: () => ({ L, st, S, A, Wd, G, items: draw.items || [], voxBase: voxGroups.c && voxGroups.c.base, canvas: cv, handImg: hand.img, r3d }) });
let recClosed = false, aeLastRec = null, aeByRec = false;
function recStart() { aeRec.start(); recClosed = false; updateAEButtons(); toast('开始记录 AE 时间轴'); }
function aeActive() { return !!aeRec.rec && !recClosed; }
function aeStop() { const r = aeRec.rec; recClosed = true; updateAEButtons(); if (r && r.frames > 1) aeLastRec = r; return r && r.frames > 1 ? r : null; }
async function aeStopAndExport() { const r = aeStop(); if (!r) { toast('没有记录到内容'); return null; } return doExportAE(true, r); }
const curRec = () => aeActive() ? aeRec.rec : aeLastRec && aeLastRec.L === L ? aeLastRec : null;
function updateAEButtons() { const b = document.getElementById('btn_aeToggle'); if (!b) return; b.textContent = aeActive() ? `■ 停止并导出（${((now() - (aeRec.rec.t0 || now())) / 1000).toFixed(1)}s）` : '● 开始记录'; b.classList.toggle('on', aeActive()); }
const PANEL_ACTIONS = { aeToggle: () => aeActive() ? aeStopAndExport() : recStart(), aeExport: () => doExportAE(), export3d: () => doExport3D() };
function recTailDone(t) { return finishedAt && t - finishedAt > (S.endCard ? S.endDelay + 400 : 0) + Math.max(800, S.tailSec * 1000); }
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.textContent = `⬇ ${name} (${(blob.size / 1e6).toFixed(1)}MB)`; document.getElementById('recList').prepend(a); a.click(); }
async function doExportAE(save = true, r0 = curRec()) {
  if (!r0) { toast('请先用“● 开始记录”记录一段（自动通关或手动游玩）'); return null; }
  status('正在生成 AE 工程…'); const r = await aeRec.exportZip(r0); window.__aeLast = r;
  if (save) download(r.blob, r.name); status(`AE 工程：${r.stats.layers} 图层，${r.stats.keys} 关键帧`); return r;
}
async function doExport3D(save = true, r0 = curRec()) {
  if (!r0) { toast('请先用“● 开始记录”记录一段（自动通关或手动游玩）'); return null; }
  status('正在生成 3D 动画…'); const ae = await aeRec.exportZip(r0, { aeFps: String(+S.export3dFps || 30), aeSize: 'canvas', aeSampling: 'bake', aeNames: 'en', aeAudio: 'both' });
  const r = await export3D({ S: { ...r0.S, export3dFps: S.export3dFps, export3dHand: S.export3dHand, endCardHand: S.endCardHand }, ae, rec: r0, A, Wd: r0.Wd || Wd });
  window.__e3dLast = r; if (save) download(r.blob, r.name); status(`3D 动画：${r.stats.nodes} 节点，${r.duration.toFixed(2)}s`); return r;
}

// ---------- 主循环 ----------
function loop(t) {
  updateCursor();
  if (window.__vclock != null) { requestAnimationFrame(loop); return; } // 虚拟时钟：由 __game.renderAt 驱动
  step(t); updPress(t); draw(t);
  if (aeActive()) { if (recTailDone(t)) aeStop(); else aeRec.sample(t); if (t - (loop.aeBtnT || 0) > 250) { loop.aeBtnT = t; updateAEButtons(); } }
  document.getElementById('recInfo').textContent = rec ? `录制中 ${((t - recT0) / 1000).toFixed(1)}s` : '';
  requestAnimationFrame(loop);
}

// ---------- 设置面板 ----------
const NEWGAME_KEYS = /^(level|seed|refDepth|rand|maxAmmo|ammoStep|refPrefs|shape|autoParallel)/;
function applyChange(k) {
  if (k === 'shapeImg' && S.shapeImg) S.level = 'image';
  saveSettings(S);
  if (k === 'handImage' || k === 'handAnchorX' || k === 'handAnchorY') loadHand();
  if (NEWGAME_KEYS.test(k)) newGame(); else if (L && (/^(canvas|bg|col_|base|slot|vox|outline|cam3d|light3d|mat3d|tankRough|voxRough|ballR|ballGlow|ballHalo|disc|text|win|lose|endTitle)/.test(k))) rebuild();
}
function loadHand() { const done2 = im => { hand.img = im; if (L) rebuild(); }; const im = new Image(); im.onload = () => done2(im); im.onerror = () => done2(null); /* 默认 = 麻将工具同款手指 PNG */ im.src = S.handImage || DEFAULT_HAND; }
function buildPanel() {
  const body = document.getElementById('panelBody'); body.innerHTML = '';
  GROUPS.forEach(([title, items], gi) => {
    const det = document.createElement('details'); if (gi < 1) det.open = true; det.innerHTML = `<summary>${title}</summary>`;
    items.forEach(([k, label, type, def, a, b, step2]) => {
      const row = document.createElement('div'); row.className = 'row'; row.innerHTML = `<label title="${k}">${label}</label>`;
      if (type === 'range') {
        const r = document.createElement('input'); r.type = 'range'; r.min = a; r.max = b; r.step = step2; r.value = S[k];
        const n = document.createElement('input'); n.type = 'number'; n.className = 'val'; n.step = step2; n.value = S[k];
        r.oninput = () => { S[k] = +r.value; n.value = r.value; applyChange(k); }; n.onchange = () => { S[k] = +n.value; r.value = n.value; applyChange(k); };
        row.append(r, n);
      } else if (type === 'color') { const c = document.createElement('input'); c.type = 'color'; c.value = S[k]; c.oninput = () => { S[k] = c.value; applyChange(k); }; row.append(c); }
      else if (type === 'bool') { row.classList.add('t-switch'); const l = document.createElement('label'); l.className = 'switch'; l.innerHTML = `<input type="checkbox" class="switch-input" id="chk_${k}" ${S[k] ? 'checked' : ''}><span class="slider"></span>`; l.querySelector('input').onchange = e => { S[k] = e.target.checked; applyChange(k); }; row.append(l); }
      else if (type === 'select') { const s = document.createElement('select'); a.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.append(o); }); s.value = S[k]; s.onchange = () => { S[k] = s.value; applyChange(k); }; row.append(s); }
      else if (type === 'text') { const t = document.createElement('input'); t.type = 'text'; t.value = S[k]; t.oninput = () => { S[k] = t.value; applyChange(k); }; row.append(t); }
      else if (type === 'button') { const bt = document.createElement('button'); bt.id = 'btn' + k; bt.textContent = a; bt.onclick = () => Promise.resolve(PANEL_ACTIONS[def] && PANEL_ACTIONS[def]()).catch(e => { status('导出失败：' + e.message); console.error(e); }); row.append(bt); }
      else if (type === 'file') {
        const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/png,image/webp,image/*'; f.id = 'file_' + k;
        f.onchange = () => { const file = f.files[0]; if (!file) return; const fr = new FileReader(); fr.onload = () => { S[k] = fr.result; applyChange(k); if (k === 'shapeImg') buildPanel(); }; fr.readAsDataURL(file); };
        const x = document.createElement('button'); x.textContent = k === 'handImage' ? '清除已上传手指' : '清除'; if (k === 'handImage') x.id = 'btnClearHand'; x.onclick = () => { S[k] = ''; f.value = ''; applyChange(k); };
        row.append(f, x);
      }
      det.append(row);
    });
    if (title.startsWith('手指')) det.insertAdjacentHTML('beforeend', '<div class="tip">默认手指 = 麻将工具同款手图（旋转/翻转/大小/指尖锚点同麻将默认值）。上传透明背景 PNG 可替换，用锚点 X/Y 标定指尖位置。</div>');
    if (title.startsWith('导入')) det.insertAdjacentHTML('beforeend', '<div class="tip">任意带透明通道的 PNG/WebP：缩放到“体素列数”宽，每个像素 → 一根沿深度方向的体素柱（alpha ≤ 阈值 = 无方块），颜色量化后生成对应颜色的炮台；生成器保证可解（每个炮台弹药 ≤ 当时可打的同色外露方块数）。</div>');
    body.append(det);
  });
}
let toastT = 0;
function toast(t, dur = 1600) { const el = document.getElementById('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); if (dur > 0) toastT = setTimeout(() => el.classList.remove('show'), dur); }
document.getElementById('btnAuto').onclick = autoSolve;
document.getElementById('btnNew').onclick = newGame;
document.getElementById('btnSeed').onclick = () => { S.seed = 1 + Math.floor(Math.random() * 9999); if (S.level === 'reference') S.level = 'random'; if (S.level === 'image') S.shapeSeed = S.seed; saveSettings(S); buildPanel(); newGame(); };
document.getElementById('btnShape').onclick = () => document.getElementById('file_shapeImg').click();
document.getElementById('btnRec').onclick = () => rec ? stopRec() : startRec();
document.getElementById('btnShot').onclick = () => { const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = 'block_shooter_shot.png'; a.click(); };
document.getElementById('btnExport').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportJSON(S)], { type: 'application/json' })); a.download = 'block-shooter-tool-settings.json'; a.click(); };
document.getElementById('btnImport').onclick = () => document.getElementById('importFile').click();
document.getElementById('importFile').onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { const j = JSON.parse(t); S = migrate(j); saveSettings(S); buildPanel(); loadHand(); newGame(); toast('已导入设置'); }).catch(() => toast('导入失败')); };
document.getElementById('btnReset').onclick = () => { if (!confirm('恢复全部默认设置？')) return; S = { ...DEFS }; saveSettings(S); buildPanel(); loadHand(); newGame(); };
window.__game = { renderAt: t => { window.__vclock = t; step(t); updPress(t); draw(t); if (aeActive()) aeRec.sample(t); }, get items() { return draw.items || []; }, get world() { return Wd; }, get G() { return G; }, create3D, autoSolve, newGame, tapShooter, tapAt, hitShooter, shooterScreen, scene: () => scene(now()), voxGroups: () => voxGroups(now()), doExportAE, doExport3D, aeRec, aeStart: () => recStart(), aeStop: () => aeStop(), aeActive: () => aeActive(), get aeLastRec() { return aeLastRec; }, get mediaRec() { return rec; }, startRec, stopRec, get S() { return S; }, get r3d() { return r3d; }, set(k, v) { S[k] = v; applyChange(k); buildPanel(); }, get st() { return st; }, get L() { return L; }, get hand() { return hand; }, view: () => view(), shooterWorld: (sh, t) => shooterWorld(sh, t), shooterBox: () => shooterBox(), voxGeoSize: () => { const g = geos(S).vox; g.computeBoundingBox(); const b = g.boundingBox; return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]; }, shooterParts: () => { const m = makeShooter(S, 'green', Wd), out = []; m.traverse(c => { if (['track_L', 'track_R', 'hull', 'turret', 'barrel', 'label'].includes(c.name)) out.push(c.name); }); return out; }, get shapeGen() { return shapeCache.gen || 0; }, get autoRunning() { return autoRunning; }, nextAuto, loadLevel: Lx => { autoToken++; autoRunning = false; startLevel(Lx); }, migrate, APP_ID, sphereHitsVox: (p, r, s) => sphereHitsVox(p, r, s) };
buildPanel(); loadHand(); newGame();
requestAnimationFrame(loop);
