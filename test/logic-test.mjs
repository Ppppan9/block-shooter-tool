import { refQueues, refVolume, makeLevel, simulate, randomVolume, volumeFromImage, initState, exposedAt, idx } from '../src/level.js';
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const V = refVolume(); const cnt = V.palette.map((_, c) => V.vox.filter(v => v === c + 1).length);
ok(V.W === 31 && V.H === 13 && V.D === 46, `参考体素 31×13×46，各色 ${V.palette.map((p, c) => p + ':' + cnt[c]).join(' ')}`);
const st = initState(V); ok(st.exp[2].size > 0 && st.exp[3].size === 0, `初始外露：黑 ${st.exp[2].size}，黄 ${st.exp[3].size}（黄色藏在黑色下面，参考 0–14s 黄炮台等待）`);
// 正面中线是绿色竖条
ok([...Array(12).keys()].every(j => V.vox[idx(V, 15, j, 0)] === 2), '正面中线 1 格宽绿色竖条（12 层）');
const t0 = Date.now(); const L = makeLevel(refVolume({ D: 14 }), { prefs: ['black', 'green', 'purple', 'yellow', 'green', 'black'] });
ok(L && L.plan.every(s => s.ammo > 0 && s.ammo <= 200), `参考关（D=14）炮台 ${L.plan.length} 个，弹药合计 ${L.plan.reduce((a, s) => a + s.ammo, 0)} = 方块 ${L.voxels}`);
ok(L.plan.reduce((a, s) => a + s.ammo, 0) === L.voxels, '弹药总数 = 方块总数（每颗球都消除一个方块）');
const r = simulate(L); ok(r.ok, `参考关模拟通关 ${JSON.stringify(r)} ${Date.now() - t0}ms`);
for (const seed of [1, 2, 3, 4, 5, 42]) { const Lr = makeLevel(randomVolume({ seed, colors: 2 + seed % 4 }), { seed }); const rr = simulate(Lr, { parallel: 1 + seed % 5 }); ok(Lr && rr.ok, `随机关 seed=${seed} 炮台 ${Lr.plan.length} 并行 ${1 + seed % 5}：${JSON.stringify(rr)}`); }
{ const Lq = refQueues(refVolume({ D: 10 })); const r2 = simulate(Lq); ok(Lq.queues.every(q => q.length >= 18) && Lq.queues.map(q => Lq.palette[q[0].color]).join() === 'black,green,purple,yellow,green,black' && r2.ok, `参考队列（6 列单色，200 弹药，D=10）动态通关 ${JSON.stringify(r2)}`); }
// 图片：中心圆 + 透明
const w = 40, h = 30, px = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = (y * w + x) * 4, d = Math.hypot(x - 20, y - 15); if (d < 13) { px[q] = d < 6 ? 255 : 120; px[q + 1] = d < 6 ? 220 : 30; px[q + 2] = d < 6 ? 0 : 200; px[q + 3] = 255; } }
const Vi = volumeFromImage(px, w, h, { W: 20, D: 3, palette: [['purple', [120, 30, 200]], ['yellow', [255, 220, 0]], ['green', [150, 230, 0]]] });
const Li = makeLevel(Vi, { seed: 3 }); ok(Vi.palette.length === 2 && Li && simulate(Li).ok, `图片关 ${Vi.W}×${Vi.H}×${Vi.D} 颜色 ${Vi.palette} 方块 ${Li.voxels} 通关`);
ok(Vi.vox[idx(Vi, 0, 0, 0)] === 0, '透明像素 = 无方块');
console.log(fail ? 'SOME FAIL' : 'ALL PASS'); process.exit(fail ? 1 : 0);
