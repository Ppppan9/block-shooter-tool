// 方块射击：体素关卡 + 规则（纯逻辑，无渲染）。参考视频逐帧分析见 ref/ANALYSIS.md
// 坐标：i = x 列（0..W-1，左→右），j = 层（0..H-1，下→上），k = 深度（0 = 正面/最靠近炮台，D-1 = 最远）
// 规则（参考核实）：点击某列队首炮台 → 跳到最左空槽位（共 5 个）；槽位里的炮台只打“同色且朝向炮台正面外露”的方块
// （可打 = k===0 或 (i,j,k-1) 空；顶/侧/背腔仅用于渲染外露面，不算射击目标；每发只打一格、不 cascading），每发一颗小球，弹药计数 −1，命中即消除；弹药打光 → 炮台离场、槽位空出；暂时没有可打目标 → 原地等待。
// 胜利：方块全部消除。失败（参考未出现，按同类玩法补）：5 个槽位全满且没有任何炮台能射击、也没有飞行中的球。
export const COLORS = ['purple', 'green', 'black', 'yellow', 'red', 'blue', 'orange', 'pink'];
export const SLOTS = 5, COLS = 6;
export const idx = (L, i, j, k) => (k * L.H + j) * L.W + i;
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// 参考关卡：31×12×46，紫色外壳；顶面绿色菱形（中心 k=15，半对角 x 12.3 / z 13.75，内部向下收窄成“漏斗/树”），正面中线 1 格宽绿色竖条；
// 中线（菱形后角之后）顶层黑色、下面黄色的竖直夹层
export function refVolume(o = {}) {
  // H=12 对齐 fit_camera / 参考紫壳 12 层；顶层同 j，无零星凸起（避免绿菱形顶面高低错落）
  const W = o.W || 31, H = o.H || 12, D = o.D || 46, L = { W, H, D, vox: new Uint8Array(W * H * D), palette: ['purple', 'green', 'black', 'yellow'] };
  const cx = (W - 1) / 2, kc = 15, rx = 12.3, rz = 13.75, top = H - 1;
  for (let k = 0; k < D; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let c = 0; const di = Math.abs(i - cx), dk = Math.abs(k - kc), dd = di / rx + dk / rz;
    if (j <= top) c = 1; // 紫
    const shrink = Math.pow((top - j) / Math.max(1, top), 0.8); // 漏斗：越往下越窄
    if (j <= top && dd <= 1 - shrink * 0.95) c = 2;
    if (j <= top && di < 0.5 && k <= kc) c = 2; // 正面竖条 / 夹层（绿）
    if (di < 0.5 && k > kc && j <= top && (k > kc + rz * 0.98 || j >= top - 1)) c = j === top ? 3 : (k > kc + rz * 0.98 || j < top - 1 ? 4 : 3); // 中线黑（顶层）/ 黄夹层
    L.vox[idx(L, i, j, k)] = c;
  }
  return L;
}
export const colorOf = (L, v) => L.palette[v - 1];
export function exposedAt(L, vox, i, j, k) {
  const { W, H, D } = L, e = (a, b, c) => vox[idx(L, a, b, c)] === 0;
  return j === H - 1 || e(i, j + 1, k) || k === 0 || e(i, j, k - 1) || i === 0 || e(i - 1, j, k) || i === W - 1 || e(i + 1, j, k) || (k < D - 1 && e(i, j, k + 1));
}
// 可打目标：仅「朝向炮台/槽位」的正面外露（k===0 或 k-1 为空）。顶面/侧面/背腔内露只用于渲染（exposedAt），不算射击目标。
export function shootableAt(L, vox, i, j, k) {
  return k === 0 || vox[idx(L, i, j, k - 1)] === 0;
}
export function isShootable(L, st, m) {
  if (!st.vox[m] || st.claimed[m]) return false;
  const [i, j, k] = coords(L, m);
  return shootableAt(L, st.vox, i, j, k);
}
/** @deprecated alias — use shootableAt */
export const frontExposedAt = shootableAt;
/** @deprecated alias — use isShootable */
export const isFrontTarget = isShootable;
// 状态：外露集合按颜色维护（增量更新；meshing 用全 exposedAt，射击另用 shootableAt）
export function initState(L) {
  const st = { vox: L.vox.slice(), exp: L.palette.map(() => new Set()), left: L.palette.map(() => 0), claimed: new Uint8Array(L.vox.length), total: 0 };
  const { W, H, D } = L;
  for (let k = 0; k < D; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const n = idx(L, i, j, k), v = st.vox[n]; if (!v) continue; st.left[v - 1]++; st.total++; if (exposedAt(L, st.vox, i, j, k)) st.exp[v - 1].add(n); }
  return st;
}
export const coords = (L, n) => { const i = n % L.W, j = Math.floor(n / L.W) % L.H, k = Math.floor(n / (L.W * L.H)); return [i, j, k]; };
export function removeVoxel(L, st, n) {
  const v = st.vox[n]; if (!v) return false; st.vox[n] = 0; st.ver = (st.ver || 0) + 1; st.exp[v - 1].delete(n); st.left[v - 1]--; st.total--; st.claimed[n] = 0;
  const [i, j, k] = coords(L, n);
  for (const [a, b, c] of [[i + 1, j, k], [i - 1, j, k], [i, j + 1, k], [i, j - 1, k], [i, j, k + 1], [i, j, k - 1]]) {
    if (a < 0 || b < 0 || c < 0 || a >= L.W || b >= L.H || c >= L.D) continue; const m = idx(L, a, b, c), w = st.vox[m]; if (w && !st.exp[w - 1].has(m) && exposedAt(L, st.vox, a, b, c)) st.exp[w - 1].add(m);
  }
  return true;
}
// 可打目标数 = 正面朝向炮台外露且未被飞行中的球预定（不含仅顶/侧/背外露）
export function availCount(L, st, c, outstanding = 0) { let n = 0; for (const m of st.exp[c]) if (isShootable(L, st, m)) n++; return n - outstanding; }
// 选目标：正面可打、同色、未预定；稳定序 (k,j,i) 优先浅层，再近炮口（生成器与模拟一致）
export function pickTarget(L, st, c, wx, wz, wy = 0, worldOf) {
  let best = -1, bd = 1e18;
  for (const m of st.exp[c]) {
    if (!isShootable(L, st, m)) continue;
    const [i, j, k] = coords(L, m), p = worldOf(m);
    const d = k * 1e9 + j * 1e5 + i * 100 + ((p[0] - wx) ** 2 + (p[1] - wy) ** 2 * 0.6 + (p[2] - wz) ** 2) * 1e-3;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}
export const roundAmmo = (a, step = 10) => a >= step ? Math.floor(a / step) * step : a;
// 生成炮台序列（保证可解）：每个新炮台的弹药 ≤ 该色当前“正面可打且未被预支”的方块数——正面外露只增不减。
export function planShooters(L, o = {}) {
  const maxAmmo = o.maxAmmo || 200, K = o.parallel || 3, step = o.ammoStep || 10, st = initState(L), worldOf = o.worldOf || (m => { const [i, j, k] = coords(L, m); return [i, j, -k]; });
  const plan = [], active = [], outst = L.palette.map(() => 0); let guard = 0;
  while (st.total > 0 && guard++ < 1e6) {
    while (active.length < K) {
      let bc = -1, ba = 0; for (let c = 0; c < L.palette.length; c++) { const a = availCount(L, st, c, outst[c]); if (a > ba) { ba = a; bc = c; } }
      if (bc < 0) break; const ammo = Math.min(maxAmmo, roundAmmo(ba, step)); const s = { color: bc, ammo, id: plan.length }; plan.push(s); active.push({ s, left: ammo, x: (o.slotX || [0])[active.length % (o.slotX || [0]).length] }); outst[bc] += ammo;
    }
    if (!active.length) return null; // 不应发生
    for (let q = active.length - 1; q >= 0; q--) { const a = active[q], m = pickTarget(L, st, a.s.color, a.x, 8, 0, worldOf); if (m < 0) return null; removeVoxel(L, st, m); a.left--; outst[a.s.color]--; if (!a.left) active.splice(q, 1); }
  }
  return plan;
}
// 把炮台序列分到 6 列队列（保持序列内顺序 → 按序列逐个点队首即可）。prefs：每列偏好颜色（参考：黑/绿/紫/黄/绿/黑）
export function distribute(plan, cols = COLS, seed = 1, prefs = null) {
  const Q = Array.from({ length: cols }, () => []), r = rng(seed);
  for (const s of plan) {
    let cand = prefs ? Q.map((_, c) => c).filter(c => prefs[c] === s.color) : []; if (!cand.length) cand = Q.map((_, c) => c);
    const minL = Math.min(...cand.map(c => Q[c].length)); const pool = cand.filter(c => Q[c].length <= minL + (prefs ? 99 : 1)); const c = pool[Math.floor(r() * pool.length)];
    // 同色多列时选较短的那列
    const c2 = prefs ? cand.reduce((a, b) => Q[b].length < Q[a].length ? b : a, cand[0]) : c; Q[c2].push(s);
  }
  return Q;
}
// 透明图片 → 体素（像素 → 正面视图的一根“体素柱”，alpha = 无方块；颜色按调色板就近匹配）
export function volumeFromImage(px, w, h, o = {}) {
  const W = o.W || 31, H = o.H || Math.max(4, Math.round(W * h / w)), D = o.D || 4, th = o.threshold ?? 0.5, pal = o.palette;
  const L = { W, H, D, vox: new Uint8Array(W * H * D), palette: pal.map(p => p[0]) };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = Math.min(w - 1, Math.floor((i + 0.5) / W * w)), y = Math.min(h - 1, Math.floor((H - 1 - j + 0.5) / H * h)), q = (y * w + x) * 4;
    if (px[q + 3] / 255 <= th) continue;
    let best = 0, bd = 1e18; pal.forEach((p, c) => { const d = (px[q] - p[1][0]) ** 2 + (px[q + 1] - p[1][1]) ** 2 + (px[q + 2] - p[1][2]) ** 2; if (d < bd) { bd = d; best = c; } });
    for (let k = 0; k < D; k++) L.vox[idx(L, i, j, k)] = best + 1;
  }
  // 悬空像素也保留（方块不受重力），去掉未使用颜色
  const used = new Set(L.vox); const map = new Map(); const pal2 = []; L.palette.forEach((p, c) => { if (used.has(c + 1)) { map.set(c + 1, pal2.length + 1); pal2.push(p); } });
  for (let n = 0; n < L.vox.length; n++) if (L.vox[n]) L.vox[n] = map.get(L.vox[n]);
  L.palette = pal2; return L;
}
export function randomVolume(o = {}) {
  const W = o.W || 15, H = o.H || 8, D = o.D || 6, nc = o.colors || 3, r = rng(o.seed || 1), L = { W, H, D, vox: new Uint8Array(W * H * D), palette: COLORS.slice(0, nc) };
  const blobs = Array.from({ length: 6 + nc * 2 }, () => [r() * W, r() * H, r() * D, 1 + Math.floor(r() * nc), 1.5 + r() * 3]);
  for (let k = 0; k < D; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let c = 1; for (const b of blobs) if ((i - b[0]) ** 2 + (j - b[1]) ** 2 + (k - b[2]) ** 2 < b[4] ** 2) c = b[3]; L.vox[idx(L, i, j, k)] = c; }
  return L;
}
// 参考关：6 列单色队列（参考队首 黑/绿/紫/黄/绿/黑，整列同色），全部 200 弹药；数量 = 该色所需 + 补满可见行。
// 多出的弹药：该色方块全部消除后炮台直接离场（规则见 ANALYSIS.md）；自动通关按“正面可打数最多的颜色”动态点击。
export function refQueues(vol, o = {}) {
  const prefs = o.prefs || ['black', 'green', 'purple', 'yellow', 'green', 'black'], ammo = o.maxAmmo || 200, minRows = o.minRows || 18, Q = prefs.map(() => []);
  const need = vol.palette.map((p, c) => Math.ceil(vol.vox.reduce((a, v) => a + (v === c + 1 ? 1 : 0), 0) / ammo));
  let id = 0; const cols = c => prefs.map((p, i) => i).filter(i => prefs[i] === vol.palette[c]);
  vol.palette.forEach((p, c) => { const cs = cols(c); for (let q = 0; q < need[c]; q++) Q[cs[q % cs.length]].push({ color: c, ammo, id: id++ }); });
  Q.forEach((q, ci) => { const c = vol.palette.indexOf(prefs[ci]); while (q.length < minRows) q.push({ color: c, ammo, id: id++ }); });
  const plan = Q.flat().sort((a, b) => a.id - b.id);
  return { ...vol, plan, queues: Q, voxels: vol.vox.reduce((a, v) => a + (v ? 1 : 0), 0), dynamic: true };
}
export function makeLevel(vol, o = {}) {
  const plan = planShooters(vol, o); if (!plan) return null;
  const queues = distribute(plan, COLS, o.seed || 1, o.prefs ? o.prefs.map(n => vol.palette.indexOf(n)) : null);
  return { ...vol, plan, queues, voxels: vol.vox.reduce((a, v) => a + (v ? 1 : 0), 0) };
}
// 逻辑层完整模拟（测试 / 生成器校验）：按计划顺序点击，最多 K 个并行，瞬时命中
export function simulate(L, o = {}) {
  const st = initState(L), K = o.parallel || 3, fronts = L.queues.map(() => 0), slots = new Array(SLOTS).fill(null), worldOf = o.worldOf || (m => { const [i, j, k] = coords(L, m); return [i, j, -k]; });
  let taps = 0, shots = 0, ticks = 0;
  const order = L.plan.slice();
  if (L.dynamic) return simulateDynamic(L, o);
  while (st.total > 0 && ticks++ < 1e6) {
    const busy = slots.filter(Boolean).length;
    if (busy < K && order.length) { const s = order[0], c = L.queues.findIndex((q, ci) => q[fronts[ci]] === s); if (c < 0) return { ok: false, reason: 'order' }; const si = slots.indexOf(null); if (si < 0) return { ok: false, reason: 'full' }; slots[si] = { s, left: s.ammo, si }; fronts[c]++; order.shift(); taps++; continue; }
    let fired = 0;
    for (const sl of slots) { if (!sl) continue; const m = pickTarget(L, st, sl.s.color, sl.si * 3 - 6, 6, 0, worldOf); if (m < 0) continue; removeVoxel(L, st, m); sl.left--; shots++; fired++; if (!sl.left) slots[sl.si] = null; }
    if (!fired && !order.length) return { ok: false, reason: 'stuck', left: st.total };
    if (!fired && slots.filter(Boolean).length >= K) return { ok: false, reason: 'stall', left: st.total };
  }
  return { ok: st.total === 0, taps, shots };
}

// 参考关（动态）：每次点“正面可打未预定数最多”的颜色的队首；该色清空后炮台离场
export function simulateDynamic(L, o = {}) {
  const st = initState(L), K = o.parallel || 3, fronts = L.queues.map(() => 0), slots = new Array(SLOTS).fill(null), worldOf = o.worldOf || (m => { const [i, j, k] = coords(L, m); return [i, j, -k]; });
  let taps = 0, shots = 0, ticks = 0;
  while (st.total > 0 && ticks++ < 2e6) {
    for (const sl of slots) if (sl && st.left[sl.s.color] === 0) slots[sl.si] = null;
    const busy = slots.filter(Boolean).length;
    if (busy < K) { let bc = -1, ba = 0; L.queues.forEach((q, c) => { const s = q[fronts[c]]; if (!s) return; const out = slots.filter(x => x && x.s.color === s.color).reduce((a, x) => a + x.left, 0), a = availCount(L, st, s.color, out); if (a > ba) { ba = a; bc = c; } });
      if (bc >= 0) { const s = L.queues[bc][fronts[bc]], si = slots.indexOf(null); slots[si] = { s, left: s.ammo, si }; fronts[bc]++; taps++; continue; } }
    let fired = 0;
    for (const sl of slots) { if (!sl) continue; const m = pickTarget(L, st, sl.s.color, sl.si * 3 - 6, 6, 0, worldOf); if (m < 0) continue; removeVoxel(L, st, m); sl.left--; shots++; fired++; if (!sl.left) slots[sl.si] = null; }
    if (!fired && slots.every(x => !x) ) return { ok: false, reason: 'stuck', left: st.total };
    if (!fired && slots.filter(Boolean).length >= SLOTS) return { ok: false, reason: 'full', left: st.total };
  }
  return { ok: st.total === 0, taps, shots };
}
