import { refQueues, refVolume, makeLevel, simulate, randomVolume, volumeFromImage, initState, exposedAt, availCount, removeVoxel, coords, idx, pickTarget } from '../src/level.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const V = refVolume(); const cnt = V.palette.map((_, c) => V.vox.filter(v => v === c + 1).length);
ok(V.W === 31 && V.H === 13 && V.D === 46, `参考体素 31×13×46，各色 ${V.palette.map((p, c) => p + ':' + cnt[c]).join(' ')}`);
const st = initState(V); ok(st.exp[2].size > 0 && st.exp[3].size === 0, `初始外露：黑 ${st.exp[2].size}，黄 ${st.exp[3].size}（黄色藏在黑色下面，参考 0–14s 黄炮台等待）`);
// v1.0.3：任一面外露均可打（不是仅正面墙）。开局黑顶面外露 → 可打；黄仍不可打；绿/紫可打
ok(availCount(V, st, 2) > 0 && availCount(V, st, 3) === 0, `初始可打：黑 ${availCount(V, st, 2)} 黄 ${availCount(V, st, 3)}（顶面外露可打；黄仍藏着）`);
ok(availCount(V, st, 1) > 0 && availCount(V, st, 0) > 0, `初始可打：绿 ${availCount(V, st, 1)} 紫 ${availCount(V, st, 0)}`);
// 绿外露集合里应有顶面菱形（j 较高且 k>0）——证明不是 front-wall-only
{ let topish = 0; for (const m of st.exp[1]) { const [i, j, k] = coords(V, m); if (k > 0 && j >= V.H - 3) topish++; }
  ok(topish > 0, `绿顶面/深层外露可打 ${topish}（非仅正面墙）`); }
ok([...st.exp[0]].every(m => { const [i, j, k] = coords(V, m); return exposedAt(V, st.vox, i, j, k); }), '紫外露子集均满足 exposedAt');
// 清掉中线绿条后，更深通路打开；黑仍可打；黄在黑剥落后才外露
{ const st2 = initState(V); const cx = 15; let cleared = 0;
  for (let k = 0; k < 16; k++) for (let j = 0; j < V.H; j++) { const n = idx(V, cx, j, k); if (st2.vox[n] === 2) { removeVoxel(V, st2, n); cleared++; } }
  ok(cleared > 0 && availCount(V, st2, 2) > 0, `清中线绿 ${cleared} 后黑仍可打 ${availCount(V, st2, 2)}（黄 ${availCount(V, st2, 3)}）`);
  // 再清顶层黑若干 → 黄露出
  let blackCleared = 0;
  for (const m of [...st2.exp[2]]) { if (st2.vox[m] === 3) { removeVoxel(V, st2, m); blackCleared++; if (blackCleared > 30) break; } }
  ok(availCount(V, st2, 3) > 0 || st2.exp[3].size > 0, `剥黑后黄外露 ${st2.exp[3].size} 可打 ${availCount(V, st2, 3)}`);
}
// pickTarget：同色外露取近处（一发一格）
{ const st3 = initState(V); const m = pickTarget(V, st3, 0, 0, 8, 0, n => { const [i, j, k] = coords(V, n); return [i, j, -k]; });
  ok(m >= 0 && st3.vox[m] === 1, `紫 pickTarget 命中一格 ${m}`); }

// 正面中线是绿色竖条
ok([...Array(12).keys()].every(j => V.vox[idx(V, 15, j, 0)] === 2), '正面中线 1 格宽绿色竖条（12 层）');
const t0 = Date.now(); const L = makeLevel(refVolume({ D: 14 }), { prefs: ['black', 'green', 'purple', 'yellow', 'green', 'black'] });
ok(L && L.plan.every(s => s.ammo > 0 && s.ammo <= 200), `参考关（D=14）炮台 ${L.plan.length} 个，弹药合计 ${L.plan.reduce((a, s) => a + s.ammo, 0)} = 方块 ${L.voxels}`);
ok(L.plan.reduce((a, s) => a + s.ammo, 0) === L.voxels, '弹药总数 = 方块总数（每颗球都消除一个方块）');
const r = simulate(L); ok(r.ok, `参考关模拟通关 ${JSON.stringify(r)} ${Date.now() - t0}ms`);
for (const seed of [1, 2, 3, 4, 5, 42]) { const par = 1 + seed % 5; const Lr = makeLevel(randomVolume({ seed, colors: 2 + seed % 4 }), { seed, parallel: par }); const rr = simulate(Lr, { parallel: par }); ok(Lr && rr.ok, `随机关 seed=${seed} 炮台 ${Lr.plan.length} 并行 ${par}：${JSON.stringify(rr)}`); }
{ const Lq = refQueues(refVolume({ D: 10 })); const r2 = simulate(Lq); ok(Lq.queues.every(q => q.length >= 18) && Lq.queues.map(q => Lq.palette[q[0].color]).join() === 'black,green,purple,yellow,green,black' && r2.ok, `参考队列（6 列单色，200 弹药，D=10）动态通关 ${JSON.stringify(r2)}`); }
// 图片：中心圆 + 透明
const w = 40, h = 30, px = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = (y * w + x) * 4, d = Math.hypot(x - 20, y - 15); if (d < 13) { px[q] = d < 6 ? 255 : 120; px[q + 1] = d < 6 ? 220 : 30; px[q + 2] = d < 6 ? 0 : 200; px[q + 3] = 255; } }
const Vi = volumeFromImage(px, w, h, { W: 20, D: 3, palette: [['purple', [120, 30, 200]], ['yellow', [255, 220, 0]], ['green', [150, 230, 0]]] });
const Li = makeLevel(Vi, { seed: 3 }); ok(Vi.palette.length === 2 && Li && simulate(Li).ok, `图片关 ${Vi.W}×${Vi.H}×${Vi.D} 颜色 ${Vi.palette} 方块 ${Li.voxels} 通关`);
ok(Vi.vox[idx(Vi, 0, 0, 0)] === 0, '透明像素 = 无方块');
console.log(fail ? 'SOME FAIL' : 'ALL PASS'); process.exit(fail ? 1 : 0);
