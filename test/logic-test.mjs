import { refQueues, refVolume, makeLevel, simulate, randomVolume, volumeFromImage, initState, exposedAt, shootableAt, isShootable, availCount, removeVoxel, coords, idx, pickTarget } from '../src/level.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const V = refVolume(); const cnt = V.palette.map((_, c) => V.vox.filter(v => v === c + 1).length);
ok(V.W === 31 && V.H === 12 && V.D === 46, `参考体素 31×12×46，各色 ${V.palette.map((p, c) => p + ':' + cnt[c]).join(' ')}`);
const st = initState(V); ok(st.exp[2].size > 0 && st.exp[3].size === 0, `初始外露：黑 ${st.exp[2].size}，黄 ${st.exp[3].size}（黄色藏在黑色下面，参考 0–14s 黄炮台等待）`);
// v1.0.4：仅正面朝向炮台可打（shootableAt）。开局黑虽顶面外露但正面未开 → avail=0；黄仍不可打；绿/紫正面可打
ok(availCount(V, st, 2) === 0 && availCount(V, st, 3) === 0, `初始可打：黑 ${availCount(V, st, 2)} 黄 ${availCount(V, st, 3)}（顶面外露≠可打；正面未开）`);
ok(availCount(V, st, 1) > 0 && availCount(V, st, 0) > 0, `初始可打：绿 ${availCount(V, st, 1)} 紫 ${availCount(V, st, 0)}`);
// 回归：仅顶面外露的体素不算可打（topHits 种子）
{ let topOnly = 0, topOnlyShoot = 0;
  for (let k = 1; k < V.D; k++) for (let j = 0; j < V.H; j++) for (let i = 0; i < V.W; i++) {
    const n = idx(V, i, j, k); if (!st.vox[n]) continue;
    const topOpen = j === V.H - 1 || st.vox[idx(V, i, j + 1, k)] === 0;
    const frontOpen = shootableAt(V, st.vox, i, j, k);
    if (topOpen && !frontOpen) { topOnly++; if (isShootable(V, st, n)) topOnlyShoot++; }
  }
  ok(topOnly > 0 && topOnlyShoot === 0, `仅顶面外露 ${topOnly} 格，可打 ${topOnlyShoot}（须为 0）`);
}
ok([...st.exp[1]].every(m => { const [i, j, k] = coords(V, m); return !isShootable(V, st, m) || shootableAt(V, st.vox, i, j, k); }), '绿可打子集均满足 shootableAt');
ok([...st.exp[0]].every(m => { const [i, j, k] = coords(V, m); return exposedAt(V, st.vox, i, j, k); }), '紫外露子集均满足 exposedAt（渲染）');
// 清掉中线绿条后，更深通路打开；黑正面可打；黄仍等黑剥落
{ const st2 = initState(V); const cx = 15; let cleared = 0;
  for (let k = 0; k < 16; k++) for (let j = 0; j < V.H; j++) { const n = idx(V, cx, j, k); if (st2.vox[n] === 2) { removeVoxel(V, st2, n); cleared++; } }
  ok(cleared > 0 && availCount(V, st2, 2) > 0, `清中线绿 ${cleared} 后黑正面可打 ${availCount(V, st2, 2)}（黄 ${availCount(V, st2, 3)}）`);
  let blackCleared = 0;
  for (const m of [...st2.exp[2]]) { if (isShootable(V, st2, m) && st2.vox[m] === 3) { removeVoxel(V, st2, m); blackCleared++; if (blackCleared > 30) break; } }
  ok(blackCleared > 0 && (availCount(V, st2, 3) > 0 || st2.exp[3].size > 0), `剥黑正面 ${blackCleared} 后黄外露 ${st2.exp[3].size} 可打 ${availCount(V, st2, 3)}`);
}
// pickTarget：只打正面可打紫
{ const st3 = initState(V); const m = pickTarget(V, st3, 0, 0, 8, 0, n => { const [i, j, k] = coords(V, n); return [i, j, -k]; });
  const [i, j, k] = coords(V, m);
  ok(m >= 0 && st3.vox[m] === 1 && shootableAt(V, st3.vox, i, j, k), `紫 pickTarget 正面一格 k=${k}`); }

ok([...Array(12).keys()].every(j => V.vox[idx(V, 15, j, 0)] === 2), '正面中线 1 格宽绿色竖条（12 层）');
{ let bump = 0; for (let k = 0; k < V.D; k++) for (let i = 0; i < V.W; i++) {
  const nTop = idx(V, i, V.H - 1, k), nBelow = V.H > 1 ? idx(V, i, V.H - 2, k) : -1;
  if (V.vox[nTop] === 2 && nBelow >= 0 && V.vox[nBelow] !== 2) bump++; // green floating above non-green
}
  // 顶层绿仅出现在同柱下层也为绿（或同色壳）时才不算「浮空」；整层同 j，无单独高出一格的绿
  let greenTop = 0, greenOnlyTop = 0;
  for (let k = 0; k < V.D; k++) for (let i = 0; i < V.W; i++) {
    if (V.vox[idx(V, i, V.H - 1, k)] === 2) { greenTop++; if (V.H > 1 && V.vox[idx(V, i, V.H - 2, k)] === 0) greenOnlyTop++; }
  }
  ok(greenTop > 0 && greenOnlyTop === 0, `顶层绿 ${greenTop} 均有下层支撑（浮空 ${greenOnlyTop}）`);
  // 同层顶面：绿与紫同在 j=H-1，无更高层
  ok(V.H === 12, '参考高度 12 层（无额外凸起层）');
}
const t0 = Date.now(); const L = makeLevel(refVolume({ D: 14 }), { prefs: ['black', 'green', 'purple', 'yellow', 'green', 'black'] });
ok(L && L.plan.every(s => s.ammo > 0 && s.ammo <= 200), `参考关（D=14）炮台 ${L.plan.length} 个，弹药合计 ${L.plan.reduce((a, s) => a + s.ammo, 0)} = 方块 ${L.voxels}`);
ok(L.plan.reduce((a, s) => a + s.ammo, 0) === L.voxels, '弹药总数 = 方块总数（每颗球都消除一个方块）');
const r = simulate(L); ok(r.ok, `参考关模拟通关 ${JSON.stringify(r)} ${Date.now() - t0}ms`);
for (const seed of [1, 2, 3, 4, 5, 42]) { const par = 1 + seed % 5; const Lr = makeLevel(randomVolume({ seed, colors: 2 + seed % 4 }), { seed, parallel: par }); const rr = simulate(Lr, { parallel: par }); ok(Lr && rr.ok, `随机关 seed=${seed} 炮台 ${Lr.plan.length} 并行 ${par}：${JSON.stringify(rr)}`); }
{ const Lq = refQueues(refVolume({ D: 10 })); const r2 = simulate(Lq); ok(Lq.queues.every(q => q.length >= 18) && Lq.queues.map(q => Lq.palette[q[0].color]).join() === 'black,green,purple,yellow,green,black' && r2.ok, `参考队列（6 列单色，200 弹药，D=10）动态通关 ${JSON.stringify(r2)}`); }
const w = 40, h = 30, px = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = (y * w + x) * 4, d = Math.hypot(x - 20, y - 15); if (d < 13) { px[q] = d < 6 ? 255 : 120; px[q + 1] = d < 6 ? 220 : 30; px[q + 2] = d < 6 ? 0 : 200; px[q + 3] = 255; } }
const Vi = volumeFromImage(px, w, h, { W: 20, D: 3, palette: [['purple', [120, 30, 200]], ['yellow', [255, 220, 0]], ['green', [150, 230, 0]]] });
const Li = makeLevel(Vi, { seed: 3 }); ok(Vi.palette.length === 2 && Li && simulate(Li).ok, `图片关 ${Vi.W}×${Vi.H}×${Vi.D} 颜色 ${Vi.palette} 方块 ${Li.voxels} 通关`);
ok(Vi.vox[idx(Vi, 0, 0, 0)] === 0, '透明像素 = 无方块');
console.log(fail ? 'SOME FAIL' : 'ALL PASS'); process.exit(fail ? 1 : 0);
