// 逐帧 3D 穿模 / 对齐测试（虚拟时钟，跳过 3D 渲染）：自动通关全过程每帧检查
//  1) 小球 vs 实心方块（球-AABB 穿入深度）  2) 小球 vs 底座 / 地面  3) 小球 vs 炮台（模型真实包围盒；发射中的本炮台前 25% 路径除外）
//  4) 炮台 vs 炮台（队列 / 跳跃 / 槽位 / 离场，含缩放）  5) 炮台 vs 底座 / 方块
//  6) 体素网格对齐（格心 = 网格坐标 × 边长，底层贴底座顶面；几何边长≈1−voxGap，允许略重叠贴合）
//  7) 几何数量核对参考（31 列 / 6 列队列 / 5 槽位 / 炮台 6 个元素 / 4 色）
// 用法：node test/clip-test.mjs   （CASES 环境变量可选：ref,rand3,rand42,img）
import { chromium } from 'playwright-core';
const TOL = +(process.env.TOL || 0.02); // 世界单位（参考关 1 格 = 1）
const CASES = (process.env.CASES || 'ref,rand1,rand42').split(',');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let total = 0; const out = [];
for (const cs of CASES) {
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
  const cfg = cs === 'ref' ? { level: 'reference', refDepth: +(process.env.REF_D || 10) } : { level: 'random', seed: +cs.replace('rand', ''), randW: 10, randH: 6, randD: 4, randColors: 4 };
  const r = await p.evaluate(async ([cfg, TOL, maxS]) => {
    Math.random = (() => { let s = 11; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    for (const [k, v] of Object.entries(cfg)) __game.set(k, v);
    __game.set('voxGap', -0.035); __game.set('voxRound', 0.12); __game.set('neighborImpulse', 0);
    __game.set('autoSpeed', 3); __game.set('autoStartDelay', 100);
    window.__no3d = true; let t = 300000; __game.renderAt(t);
    const Wd = __game.world, L = __game.L, S = __game.S, st = __game.st, vs = Wd.vs, B = Wd.base, SB = __game.shooterBox();
    const V = {}, ex = {}; const lastF = {}; const bad = (k, msg) => { V[k] = (V[k] || 0) + 1; const fr = +(/^f(\d+)/.exec(msg) || [0, -99])[1]; if (!ex[k]) ex[k] = []; if (ex[k].length < 6 && fr - (lastF[k] ?? -99) > 15) { ex[k].push(msg); lastF[k] = fr; } };
    // ---- 静态：网格对齐 / 几何数量 ----
    // allow slight overlap (negative voxGap => unit geo >1) to kill rounded seams; cap matches settings min
    const g = __game.voxGeoSize(), expect = 1 - (S.voxGap ?? 0), maxU = Math.max(1.08, expect + 0.02);
    if (g.some(x => x > maxU + 1e-6 || x < 0.5 || Math.abs(x - expect) > 0.03)) bad('voxGeoOversize', JSON.stringify({ g, expect, voxGap: S.voxGap }));
    for (let n = 0; n < st.vox.length; n += 1) { const i = n % L.W, j = Math.floor(n / L.W) % L.H, k = Math.floor(n / (L.W * L.H)), c = Wd.vox(n);
      if (Math.abs(c[0] - (i - (L.W - 1) / 2) * vs) > 1e-6 || Math.abs(c[1] - (B.y1 + (j + 0.5) * vs)) > 1e-6 || Math.abs(c[2] - (-(k + 0.5) * vs)) > 1e-6) { bad('gridAlign', n + ' ' + c.join(',')); }
      if (j === 0 && c[0] - vs / 2 < B.x0 - 1e-6 || c[0] + vs / 2 > B.x1 + 1e-6 || c[2] + vs / 2 > B.z1 + 1e-6 || c[2] - vs / 2 < B.z0 - 1e-6) bad('voxOffBase', n + ''); }
    const counts = { W: L.W, H: L.H, D: L.D, colors: L.palette.length, cols: __game.G.queues.length, slots: __game.G.slots.length, parts: __game.shooterParts().filter(x => !x.endsWith('_outline')) };
    if (cfg.level === 'ref') { if (L.W !== 31) bad('refCount', 'W ' + L.W); if (counts.cols !== 6) bad('refCount', 'cols ' + counts.cols); if (counts.slots !== 5) bad('refCount', 'slots'); if (counts.colors !== 4) bad('refCount', 'colors');
      const pr = L.palette.indexOf('purple'); let ph = 0; for (let j = 0; j < L.H; j++) if (st.vox[j * L.W] === pr + 1) ph++; counts.purpleLayersAtEdge = ph; if (ph !== 12) bad('refCount', 'purple layers ' + ph); }
    if (counts.parts.join(',') !== 'track_L,track_R,hull,turret,barrel,label') bad('shooterParts', counts.parts.join(','));
    // ---- 逐帧 ----
    const sphBox = (c, r, x0, x1, y0, y1, z0, z1) => { const dx = Math.max(x0 - c[0], 0, c[0] - x1), dy = Math.max(y0 - c[1], 0, c[1] - y1), dz = Math.max(z0 - c[2], 0, c[2] - z1), d = Math.hypot(dx, dy, dz); if (d > 0) return r - d; return r + Math.min(c[0] - x0, x1 - c[0], c[1] - y0, y1 - c[1], c[2] - z0, z1 - c[2]); };
    const bx = (w, P) => { const s = w.s || 1, sy = w.sy ?? 1; return [w.x + P.x0 * s, w.x + P.x1 * s, w.y + P.y0 * s * sy, w.y + P.y1 * s * sy, w.z + P.z0 * s, w.z + P.z1 * s]; }, shBox = w => bx(w, SB), shParts = w => SB.parts.map(P => bx(w, P)); // 逐部件包围盒（履带 / 车身 / 炮塔 / 炮管，含描边）
    __game.autoSolve(); let f = 0, maxBalls = 0, maxPen = {}; const pen = (k, d, msg) => { if (d > (maxPen[k] || 0)) maxPen[k] = d; if (d > TOL) bad(k, msg + ' d=' + d.toFixed(3)); };
    while (!window.__finished && !window.__failed && f < maxS * 30) {
      t += 1000 / 30; f++; __game.renderAt(t); const G = __game.G, r = S.ballR;
      const live = G.shooters.filter(s => s.state !== 'gone').map(s => ({ s, w: __game.shooterWorld(s, t) })).filter(o => o.w && !(o.s.state === 'queue' && o.s.row > 16));
      const boxes = live.map(o => ({ ...o, b: shBox(o.w), parts: shParts(o.w) }));
      maxBalls = Math.max(maxBalls, G.balls.length);
      for (const ball of G.balls) { const c = ball.pos; if (!c) continue;
        // vs 方块（球所在格附近 3×3×3）
        const ci = Math.round(c[0] / vs + (L.W - 1) / 2), cj = Math.floor((c[1] - B.y1) / vs), ck = Math.floor(-c[2] / vs);
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) { const i = ci + di, j = cj + dj, k = ck + dk; if (i < 0 || j < 0 || k < 0 || i >= L.W || j >= L.H || k >= L.D) continue; const n = i + j * L.W + k * L.W * L.H; if (!st.vox[n]) continue; const q = Wd.vox(n), h = vs / 2; if (!ball.blocked) pen('ballVoxel', sphBox(c, r, q[0] - h, q[0] + h, q[1] - h, q[1] + h, q[2] - h, q[2] + h), `f${f} ball${ball.id} ${ball.ph} vox${n} bl${ball.blocked ? 1 : 0} u${(((t - ball.t0) / ball.dur) || 0).toFixed(2)} tg${ball.m}`); }
        pen('ballBase', sphBox(c, r, B.x0, B.x1, B.y0, B.y1, B.z0, B.z1), `f${f} ball${ball.id} ${ball.ph}`);
        pen('ballGround', r - c[1], `f${f} ball${ball.id}`);
        const u = ball.ph === 'fly' ? (t - ball.t0) / ball.dur : 1;
        for (const o of boxes) { if (ball.ph === 'fly' && o.s === ball.sh && u < 0.25) continue; if (o.s.state === 'leave') continue; if (ball.ph === 'bounce' && o.s.state === 'queue') continue;
          for (let pi = 0; pi < o.parts.length; pi++) { const q = o.parts[pi]; pen('ballShooter', sphBox(c, r, q[0], q[1], q[2], q[3], q[4], q[5]), `f${f} ball${ball.id} ${ball.ph} sh${o.s.id}/${o.s.state} ${SB.parts[pi].name}`); } }
      }
      for (let a = 0; a < boxes.length; a++) { const A = boxes[a].b;
        pen('shooterBase', Math.min(A[1] - B.x0, B.x1 - A[0], A[3] - B.y0, B.y1 - A[2], A[5] - B.z0, B.z1 - A[4]), `f${f} sh${boxes[a].s.id}`);
        for (let c2 = a + 1; c2 < boxes.length; c2++) { const Q0 = boxes[c2].b; if (Math.min(A[1] - Q0[0], Q0[1] - A[0], A[3] - Q0[2], Q0[3] - A[2], A[5] - Q0[4], Q0[5] - A[4]) <= TOL) continue; let d = -1, nm = ''; for (let i1 = 0; i1 < SB.parts.length; i1++) for (let i2 = 0; i2 < SB.parts.length; i2++) { const P = boxes[a].parts[i1], Q = boxes[c2].parts[i2], dd = Math.min(P[1] - Q[0], Q[1] - P[0], P[3] - Q[2], Q[3] - P[2], P[5] - Q[4], Q[5] - P[4]); if (dd > d) { d = dd; nm = SB.parts[i1].name + '/' + SB.parts[i2].name; } } pen('shooterShooter', d, `f${f} sh${boxes[a].s.id}/${boxes[a].s.state} vs sh${boxes[c2].s.id}/${boxes[c2].s.state} ${nm}`); } }
      if (f % 60 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return { blk: (window.__blk || []).slice(0, 6), blocked: window.__blockedShots || 0, V, ex, frames: f, finished: !!window.__finished, failed: !!window.__failed, left: __game.st.total, maxBalls, maxPen: Object.fromEntries(Object.entries(maxPen).map(([k, v]) => [k, +v.toFixed(4)])), counts };
  }, [cfg, TOL, +(process.env.MAX_S || 240)]);
  const nV = Object.values(r.V).reduce((a, x) => a + x, 0); total += nV + errs.length + (r.finished ? 0 : 1);
  console.log(cs, nV === 0 && r.finished ? 'PASS' : 'FAIL', JSON.stringify({ violations: r.V, examples: r.ex, frames: r.frames, finished: r.finished, failed: r.failed, left: r.left, maxBalls: r.maxBalls, blocked: r.blocked, maxPen: r.maxPen, counts: r.counts }), errs.slice(0, 3));
  await p.close();
}
await b.close();
console.log(total === 0 ? 'CLIP ALL PASS (0 violations)' : 'CLIP FAIL ' + total); process.exit(total ? 1 : 0);
