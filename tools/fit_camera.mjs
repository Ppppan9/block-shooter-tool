// 按参考第 0 帧实测的方块体角点 / 中线拟合透视相机（Nelder-Mead）。世界：x 右、y 上、z 朝镜头；方块体 W=31,H=12，前面 z=0，中线 x=0
import * as THREE from 'three';
const W = 31, H = 12;
const PTS = [ // [世界点, 屏幕点(720x1280)]
  [[W / 2, H, 0], [652, 478]], [[W / 2, 0, 0], [652, 700]], [[0, H, 0], [338, 537]], [[0, 0, 0], [338, 768]], [[-W / 2, 0, 0], [6, 808]],
];
const LINES = [ // 世界直线 (点, 方向) 经过屏幕点
  [[W / 2, H, 0], [0, 0, -1], [440, 0]], [[0, H, 0], [0, 0, -1], [85, 0]], [[0, H, 0], [0, 0, -1], [175, 200]],
];
function cam(p) { const [x, y, z, tx, ty, tz, fov] = p; const c = new THREE.PerspectiveCamera(fov, 720 / 1280, 0.1, 1000); c.position.set(x, y, z); c.lookAt(tx, ty, tz); c.updateMatrixWorld(); return c; }
const proj = (c, w) => { const v = new THREE.Vector3(...w).project(c); return [(v.x + 1) / 2 * 720, (1 - v.y) / 2 * 1280, v.z]; };
function err(p) {
  if (p[6] < 2 || p[6] > 80) return 1e9; const c = cam(p); let e = 0;
  for (const [w, s] of PTS) { const q = proj(c, w); if (q[2] > 1) return 1e9; e += (q[0] - s[0]) ** 2 + (q[1] - s[1]) ** 2; }
  for (const [o, d, s] of LINES) { const a = proj(c, o), b = proj(c, [o[0] + d[0] * 20, o[1] + d[1] * 20, o[2] + d[2] * 20]); const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy); e += (((s[0] - a[0]) * dy - (s[1] - a[1]) * dx) / n) ** 2; }
  return e;
}
function nm(f, x0, it = 6000) { let n = x0.length, S = [x0]; for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += Math.abs(x[i]) * 0.1 + 1; S.push(x); } let F = S.map(f);
  for (let k = 0; k < it; k++) { const o = F.map((v, i) => i).sort((a, b) => F[a] - F[b]); S = o.map(i => S[i]); F = o.map(i => F[i]); const c = new Array(n).fill(0); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += S[i][j] / n;
    const r = c.map((v, j) => v + (v - S[n][j])), fr = f(r); if (fr < F[0]) { const e = c.map((v, j) => v + 2 * (v - S[n][j])), fe = f(e); if (fe < fr) { S[n] = e; F[n] = fe; } else { S[n] = r; F[n] = fr; } } else if (fr < F[n - 1]) { S[n] = r; F[n] = fr; } else { const ct = c.map((v, j) => v + 0.5 * (S[n][j] - v)), fc = f(ct); if (fc < F[n]) { S[n] = ct; F[n] = fc; } else { for (let i = 1; i <= n; i++) { S[i] = S[i].map((v, j) => S[0][j] + 0.5 * (v - S[0][j])); F[i] = f(S[i]); } } } }
  return [S[0], F[0]]; }
let best = null;
for (const s of [[20, 60, 60, 0, 0, -10, 30], [40, 70, 50, -5, 0, -15, 25], [10, 50, 70, 0, 5, -5, 35], [30, 80, 40, -10, 0, -20, 20]]) { let [p, e] = nm(err, s); [p, e] = nm(err, p); if (!best || e < best[1]) best = [p, e]; }
const c = cam(best[0]);
console.log(JSON.stringify({ params: best[0].map(v => +v.toFixed(4)), rms: Math.sqrt(best[1] / (PTS.length + LINES.length)).toFixed(2) }));
for (const [w, s] of PTS) console.log(w, s, proj(c, w).slice(0, 2).map(v => v.toFixed(1)));
// 地面反投影：槽位 / 炮台列（参考屏幕点 → y=0 平面）
const un = (sx, sy, y = 0) => { const v = new THREE.Vector3(sx / 720 * 2 - 1, 1 - sy / 1280 * 2, 0.5).unproject(c), d = v.sub(c.position).normalize(), t = (y - c.position.y) / d.y; return c.position.clone().add(d.multiplyScalar(t)).toArray().map(v => +v.toFixed(3)); };
const SLOTS = [[253, 848], [312, 833], [370, 822], [428, 812], [487, 800]], FRONT = [[250, 880], [305, 862], [368, 850], [425, 840], [485, 826], [543, 815]];
console.log('slots', JSON.stringify(SLOTS.map(p => un(...p, 0.05))));
console.log('front', JSON.stringify(FRONT.map(p => un(...p, 0.9))));
console.log('col1 far', JSON.stringify([un(400, 1230, 0.9), un(250, 880, 0.9)]));
console.log('diamond top(y=11) F,B,L,R', JSON.stringify([[338, 540], [175, 200], [5, 405], [525, 322]].map(p => un(...p, 11))));
console.log('screen top y=0 at black line', JSON.stringify(un(85, 0, 11)), 'base front left', JSON.stringify(un(0, 845, 0)), 'base right corner', JSON.stringify(un(686, 700, 0)));
