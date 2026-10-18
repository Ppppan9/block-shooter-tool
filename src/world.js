// 统一世界模型（3D 真值）：体素 / 底座 / 槽位 / 炮台队列 / 小球都在同一世界坐标里，2D（AE 图层锚点、手指点击）= 同一相机投影。
// 相机按参考第 0 帧拟合（tools/fit_camera.mjs）：FOV≈3.35°（长焦近正交），左前上方俯视。
import * as THREE from 'three';
import { coords, idx, SLOTS, COLS } from './level.js';
export const DW = 720, DH = 1280;
// 参考实测（地面反投影，世界单位 = 参考关卡 1 格）
export const REF_SLOTS = [[-5.354, 6.012], [-2.484, 5.627], [0.27, 5.52], [3.007, 5.484], [5.832, 5.316]];
export const REF_FRONT = [[-6.384, 9.356], [-3.64, 8.712], [-0.658, 8.593], [2.027, 8.547], [4.926, 8.248], [7.682, 8.142]];
export const SH = { w: 2.35, d: 1.92, h: 1.75, row: 2.02 }; // 炮台外形（宽 / 深 / 高）与队列行距（参考：14 个 ≈ 26.3 单位）
export function createWorld(S, L) {
  const W = L.W, H = L.H, D = L.D;


  const vs = Math.min(2.2, 31 / W, 20 / H) * (S.voxScale || 1); // 体素边长：参考关 31 列 = 1；小关卡放大到参考宽度
  const cam = new THREE.PerspectiveCamera(S.cam3dFov, DW / DH, 1, 3000);
  cam.position.set(S.cam3dX, S.cam3dY, S.cam3dZ); cam.lookAt(S.cam3dTX, S.cam3dTY, S.cam3dTZ); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const vox = n => { const [i, j, k] = coords(L, n); return [(i - (W - 1) / 2) * vs, (j + 0.5) * vs, -(k + 0.5) * vs]; };
  const vec = new THREE.Vector3();
  const proj = (x, y, z) => { vec.set(x, y, z).project(cam); return [(vec.x + 1) / 2 * DW, (1 - vec.y) / 2 * DH, vec.z]; };
  const un = (sx, sy, y = 0) => { const v = new THREE.Vector3(sx / DW * 2 - 1, 1 - sy / DH * 2, 0.5).unproject(cam), d = v.sub(cam.position).normalize(), t = (y - cam.position.y) / d.y; return cam.position.clone().add(d.multiplyScalar(t)); };
  const slots = REF_SLOTS.slice(0, SLOTS).map(([x, z]) => [x, z]);
  const front = REF_FRONT.slice(0, COLS);
  const queuePos = (c, r) => [front[c][0] + r * 0.0, front[c][1] + r * SH.row]; // 参考：列方向 ≈ +z（col1 far x -6.54 @ z 35.7）
  const muzzleOf = (x, z) => [x, SH.h + 0.35, z - SH.d * 0.62]; // 炮管口（炮管朝向方块，略向上）
  const base = { x0: -W / 2 * vs - S.baseMargin, x1: W / 2 * vs + S.baseMargin, z0: -D * vs - S.baseMargin, z1: S.baseFront, y0: -S.baseThick, y1: 0, r: S.baseRadius };
  const cellOf = (x, y, z) => { const i = Math.floor(x / vs + W / 2), j = Math.floor(y / vs), k = Math.floor(-z / vs); return i < 0 || j < 0 || k < 0 || i >= W || j >= H || k >= D ? -1 : idx(L, i, j, k); };
  return { W, H, D, vs, cam, vox, proj, un, slots, front, queuePos, muzzleOf, base, cellOf, SH };
}
