// 导出 After Effects 工程：通用“精灵”时间轴记录器。网页每帧绘制的就是 scene() 返回的精灵列表
// （素材 + 中心位置/缩放/旋转/不透明度/层级），这里逐帧采样，导出时每个元素（id + 素材）的每段连续出现 = 一个独立图层。
import { makeZip } from './zip.js';
import JSX_TEXT from './build_ae_project.jsx';
import README_TEXT from './README_AE.md';
import { renderSfxOffline, encodeWav, SFX_NAMES, SFX_DUR } from '../audio.js';
const r3 = v => Math.round(v * 1000) / 1000;
const LABEL = { bg: 15, board: 14, vox: 9, shooter: 2, ball: 1, debris: 11, num: 3, slot: 14, ui: 15, end: 5, hand: 12, audio: 16 };
// 图层命名（中文 / English）
export function layerName(id, asset, zh) {
  const m = id.match(/^([a-z]+)_?(.*)$/) || [id, id, ''], k = m[1], rest = m[2];
  const T = { background: ['背景', 'Background'], base: ['底座', 'Base'], slot: ['槽位', 'Slot'], shooter: ['炮台', 'Shooter'], ball: ['小球', 'Ball'], debris: ['碎屑', 'Debris'], vox: ['方块', 'Voxel'], num: ['数字', 'Number'], disclaimer: ['免责声明', 'Disclaimer'], end: ['结束页', 'End card'], hand: ['手指', 'Hand'], result: ['结果', 'Result'] };
  const base = (T[k] || [k, k])[zh ? 0 : 1];
  if (k === 'background' || k === 'base' || k === 'disclaimer' || k === 'hand' || id === 'end_card') return base;
  if (k === 'result') return base + '_' + (rest === 'win' ? (zh ? '通关' : 'win') : (zh ? '失败' : 'lose'));
  if (k === 'shooter') return base + '_' + rest + '_' + colorName(asset.replace('shooter_', ''), zh);
  return base + '_' + rest;
}
const CN = { purple: '紫', green: '绿', black: '黑', yellow: '黄', red: '红', blue: '蓝', orange: '橙', pink: '粉' };
const colorName = (c, zh) => zh ? (CN[c] || c) : c;
const labelOf = id => { const k = id.split('_')[0]; return LABEL[k] ?? (id === 'background' ? LABEL.bg : id.startsWith('end') ? LABEL.end : LABEL.ui); };
const folderOf = a => a.startsWith('vox') ? 'voxels' : a.startsWith('shooter') ? 'shooters' : a.startsWith('ball') || a.startsWith('debris') ? 'fx' : 'ui';
export function createAERecorder(api) {
  let R = null;
  function start(opt = {}) {
    const E = api.env();
    R = { t0: api.now(), lastT: 0, vox0: E.st.vox.slice(), seenVox: new Set(), pops: [], popSeen: new Set(), Wd: E.Wd, frames: 0, tracks: new Map(), sfx: [], snaps: [], snapEvery: opt.snapEvery || window.__aeSnapEvery || 0, maxSnaps: opt.maxSnaps || 40, L: E.L, S: { ...E.S }, A: E.A };
    api.sfx.hook = (name, o) => { if (R) R.sfx.push({ t: Math.max(0, (api.now() - R.t0) / 1000), name, dur: o && o.dur }); };
  }
  function stop() { const r = R; R = null; return r; }
  function sample(now) {
    if (!R) return;
    const E = api.env(); if (E.L !== R.L) { R = null; return; }
    R.A = E.A;
    const t = Math.max(R.lastT + 1e-4 * (R.frames > 0), (now - R.t0) / 1000), f = R.frames;
    // 方块：记录期间出现在渲染列表里的方块（外露 + 内侧一层）+ 消除时刻
    if (E.voxBase && E.voxBase !== R.lastVB) { R.lastVB = E.voxBase; for (const l of E.voxBase) for (const [n] of l) R.seenVox.add(n); }
    for (const p of E.G.pops) if (!R.popSeen.has(p.n)) { R.popSeen.add(p.n); R.pops.push([p.n, Math.max(0, (p.t0 - R.t0) / 1000), p.color]); }
    for (const it of E.items) {
      const key = it.id + '|' + it.asset; let tr = R.tracks.get(key);
      if (!tr) { tr = { id: it.id, asset: it.asset, z: it.z, s: [], order: R.tracks.size }; R.tracks.set(key, tr); }
      tr.s.push(it.w ? [t, r3(it.x), r3(it.y), r3(it.sx), r3(it.sy), r3(it.rot), r3(it.op), f, r3(it.lift || 0), r3(it.z), r3(it.w[0]), r3(it.w[1]), r3(it.w[2]), r3(it.ws ?? it.wk ?? 1), r3(it.wsy ?? 1), r3(it.rx || 0), r3(it.ry || 0), it.num ?? -1] : [t, r3(it.x), r3(it.y), r3(it.sx), r3(it.sy), r3(it.rot), r3(it.op), f, r3(it.lift || 0), r3(it.z)]); // [10..13] = 世界锚点 + 缩放（v1.2.1，3D 导出 / AE 3D 外观用）
      if (it.num != null) (tr.n || (tr.n = [])).push([t, it.num, r3(it.numOp ?? 1), r3(it.lx), r3(it.ly), r3(it.lsx || 1)]); // 炮台数字（AE 文本图层，源文字定格关键帧） // 纸箱：尺寸 / 翻盖角度 / 阶段（3D 导出与 AE 3D 外观用）
    }
    if (R.snapEvery && f % R.snapEvery === R.snapEvery - 1 && R.snaps.length < R.maxSnaps) R.snaps.push({ t, url: E.canvas.toDataURL('image/png') });
    R.lastT = t; R.frames++;
  }
  async function exportZip(rec = R, So = null) {
    if (!rec || rec.frames < 2) throw new Error('没有可导出的记录：请先自动通关或手动游玩');
    const E = api.env(), S = So ? { ...rec.S, ...So } : rec.S; if (!rec.A3) rec.A3 = api.sprites(rec); const AS = { ...rec.A, ...rec.A3 }, AS2 = null;
    const fps = +S.aeFps || 30, bake = S.aeSampling === 'bake', CW = 720, CH = 1280, zh = S.aeNames !== 'en';
    const D = Math.max(1 / fps, Math.ceil((rec.lastT + 1 / fps) * fps - 1e-6) / fps);
    const assets = [], assetFiles = [], pending = [], used = new Map();
    const folders = [{ id: 'root', name: '方块射击_AE工程' }, { id: 'img', name: '素材', parent: 'root' }, { id: 'voxels', name: '方块', parent: 'img' }, { id: 'shooters', name: '炮台', parent: 'img' }, { id: 'fx', name: '小球特效', parent: 'img' }, { id: 'ui', name: '界面', parent: 'img' }, { id: 'aud', name: '音频', parent: 'root' }, { id: 'pre', name: '预合成', parent: 'root' }];
    const toPng = c => new Promise(res => c.toBlob(b => b.arrayBuffer().then(a => res(new Uint8Array(a))), 'image/png'));
    function assetFor(key) {
      if (used.has(key)) return used.get(key);
      const a = (AS2 || AS)[key]; const c = a.c instanceof HTMLCanvasElement ? a.c : (() => { const cc = document.createElement('canvas'); cc.width = a.c.width; cc.height = a.c.height; cc.getContext('2d').drawImage(a.c, 0, 0); return cc; })();
      const file = 'assets/' + key + '.png', o = { id: key, file, folder: folderOf(key), w: c.width, h: c.height, name: key + '.png', kx: c.width / a.w, ky: c.height / a.h, ax: a.ax, ay: a.ay };
      assets.push(o); pending.push(toPng(c).then(data => assetFiles.push({ name: file, data }))); used.set(key, o); return o;
    }
    const rnd = v => Array.isArray(v) ? v.map(x => Math.round(x * 100) / 100) : Math.round(v * 100) / 100, r4 = x => Math.round(x * 10000) / 10000;
    // 重采样到 fps 网格（线性插值），再按容差精简
    function resample(s) {
      const f0 = Math.round(s[0][0] * fps), f1 = Math.max(f0, Math.round(s[s.length - 1][0] * fps)), out = []; let j = 0;
      for (let f = f0; f <= f1; f++) { const tau = f / fps; while (j < s.length - 2 && s[j + 1][0] <= tau + 1e-9) j++; const a = s[j], b = s[j + 1] || a, u = b[0] > a[0] ? Math.min(1, Math.max(0, (tau - a[0]) / (b[0] - a[0]))) : 0; out.push({ t: tau, v: a.map((x, i) => i === 0 ? tau : x + (b[i] - x) * u) }); }
      return { f0, f1, list: out };
    }
    function prop(fr, get, tol) {
      const t = fr.list.map(o => o.t), vv = fr.list.map(o => get(o.v));
      const same = (a, b, e) => Array.isArray(a) ? a.every((x, i) => Math.abs(x - b[i]) <= e) : Math.abs(a - b) <= e;
      if (vv.every(x => same(x, vv[0], 1e-6))) return rnd(vv[0]);
      let keep;
      if (bake) keep = vv.map((_, i) => i);
      else { keep = [0]; let a = 0; for (let b = 2; b < vv.length; b++) { let ok = true; for (let m = a + 1; m < b && ok; m++) { const u = (t[m] - t[a]) / (t[b] - t[a]); const lin = Array.isArray(vv[a]) ? vv[a].map((x, i) => x + (vv[b][i] - x) * u) : vv[a] + (vv[b] - vv[a]) * u; ok = same(lin, vv[m], tol); } if (!ok) { keep.push(b - 1); a = b - 1; } } if (vv.length > 1) keep.push(vv.length - 1); }
      return { t: keep.map(i => r4(t[i])), v: keep.map(i => rnd(vv[i])) };
    }
    const keyCount = p => (p && typeof p === 'object' && !Array.isArray(p) && p.t) ? p.t.length : 0;
    // 每个轨道拆成连续出现段
    const segs = [], layers = [], markers = [], comps = [];
    // v1.2：3D 外观（aeLook：auto = 记录时开启 3D 渲染则用 3D；3d；2d = v1.1 的 2D 精灵）
    const look = false, seqComps = [];
    // v1.2.1：同一元素换了绘制层（杯子从传送带层进入托盘 / 飞行层，纸箱翻盖在杯子上下切换）时也拆段，每段按自己的层级排序
    for (const tr of rec.tracks.values()) {
      const zs = !(look && tr.id.startsWith('box')), zOf = e => e[9] ?? tr.z;
      let a = 0; for (let i = 1; i <= tr.s.length; i++) if (i === tr.s.length || tr.s[i][7] !== tr.s[i - 1][7] + 1 || (zs && Math.abs(zOf(tr.s[i]) - zOf(tr.s[i - 1])) > 0.5)) { const s = tr.s.slice(a, i); segs.push({ tr: zs ? { ...tr, z: zOf(s[0]) } : tr, s }); a = i; }
    }
    const nSeg = new Map(); segs.forEach(g => nSeg.set(g.tr.id + '|' + g.tr.asset, (nSeg.get(g.tr.id + '|' + g.tr.asset) || 0) + 1));
    segs.sort((p, q) => p.tr.z - q.tr.z || p.tr.order - q.tr.order || p.s[0][0] - q.s[0][0]);
        const segK = new Map();
    seqComps.sort((p, q) => p.z - q.z); let sq = 0;
    // 方块图层：每个“记录期间可见”的方块一个图层（全部方块：aeVoxels=all），位置/缩放 = 世界中心投影，消除时缩小到 0 后出点；按相机深度从远到近叠放
    const Wd = rec.Wd, voxLayers = [], zzOf = w => 10 + (1 - Wd.proj(w[0], w[1], w[2])[2]) * 1e3, K0 = (() => { const a = Wd.proj(-0.5, 0, 6), b = Wd.proj(0.5, 0, 6); return Math.hypot(b[0] - a[0], b[1] - a[1]); })();
    { const popAt = new Map(rec.pops.map(p => [p[0], p[1]])), L = rec.L, set = S.aeVoxels === 'all' ? null : rec.seenVox, popD = Math.max(1 / fps, (S.popDur || 110) / 1000);
      for (let n = 0; n < rec.vox0.length; n++) { const v = rec.vox0[n]; if (!v || (set && !set.has(n) && !popAt.has(n))) continue;
        const w = Wd.vox(n), p = Wd.proj(w[0], w[1], w[2]), aL = Wd.proj(w[0] - 0.5, w[1], w[2]), aR = Wd.proj(w[0] + 0.5, w[1], w[2]), k = Math.hypot(aR[0] - aL[0], aR[1] - aL[1]) / K0, col = L.palette[v - 1], a = assetFor('vox_' + col);
        const tp = popAt.get(n), sc = k * 100 / a.kx, [i, j, kk] = [n % L.W, Math.floor(n / L.W) % L.H, Math.floor(n / (L.W * L.H))];
        const lay = { name: (zh ? '方块_' : 'Voxel_') + colorName(col, zh) + `_${i}_${j}_${kk}`, src: { asset: a.id }, in: 0, label: LABEL.vox, tr: { anchor: [rnd(a.ax * a.kx), rnd(a.ay * a.ky)], position: rnd([p[0], p[1]]), scale: rnd([sc, sc]) } };
        if (tp != null) { const t1 = Math.min(D, r4(tp + popD)); lay.out = Math.max(r4(tp) + 1 / fps, t1); lay.tr.scale = { t: [r4(tp), r4(Math.max(tp + 1e-3, t1 - 1e-4))], v: [rnd([sc, sc]), [0, 0]] }; }
        voxLayers.push({ z: zzOf(w), layer: lay }); } }
    voxLayers.sort((p, q) => p.z - q.z); for (const v of voxLayers) seqComps.push(v); seqComps.sort((p, q) => p.z - q.z);
    { const a = assetFor('base'); seqComps.push({ z: 1.5, layer: { name: zh ? '底座' : 'Base', src: { asset: a.id }, label: LABEL.slot, tr: { anchor: [0, 0], position: [0, 0], scale: [100 / a.kx, 100 / a.ky] } } }); seqComps.sort((p, q) => p.z - q.z); }
    const numLayers = [];
    for (const g of segs) {
      while (sq < seqComps.length && seqComps[sq].z <= g.tr.z) layers.push(seqComps[sq++].layer);
      const a = assetFor(g.tr.asset), fr = resample(g.s), tin = fr.f0 / fps;
      const last = g.s[g.s.length - 1], nextT = rec.frames - 1 > last[7] ? last[0] + 1 / fps : D;
      const tout = Math.min(D, Math.max(tin + 1 / fps, Math.round(nextT * fps) / fps));
      const k = g.tr.id + '|' + g.tr.asset, n = (segK.get(k) || 0) + 1; segK.set(k, n);
      const nm = layerName(g.tr.id, g.tr.asset, zh) + (nSeg.get(k) > 1 ? ` #${n}` : '');
      layers.push({ name: nm, src: { asset: a.id }, in: r4(tin), out: r4(tout), label: labelOf(g.tr.id), tr: {
        anchor: [rnd(a.ax * a.kx), rnd(a.ay * a.ky)],
        position: prop(fr, e => [e[1], e[2]], 0.25),
        scale: prop(fr, e => [e[3] * 100 / a.kx, e[4] * 100 / a.ky], 0.25),
        rotation: prop(fr, e => e[5] * 180 / Math.PI, 0.2),
        opacity: prop(fr, e => Math.max(0, Math.min(100, e[6] * 100)), 0.5),
      } });
      if (g.tr.n && g.tr.id.startsWith('shooter')) { // 数字：AE 文本图层（源文字定格关键帧 + 位置/不透明度），紧跟炮台图层之上
        const ns = g.tr.n.filter(e => e[0] >= g.s[0][0] - 1e-9 && e[0] <= last[0] + 1e-9); if (ns.length) {
          const fr2 = resample(ns.map(e => [e[0], e[3], e[4], e[2] * 100, e[5]])), txt = [], tt = []; let prev = null; for (const e of ns) if (e[1] !== prev) { prev = e[1]; tt.push(r4(Math.max(tin, Math.round(e[0] * fps) / fps))); txt.push(String(e[1])); }
          const tt2 = [], tx2 = []; tt.forEach((t, q) => { if (tt2.length && t <= tt2[tt2.length - 1]) { tx2[tx2.length - 1] = txt[q]; return; } tt2.push(t); tx2.push(txt[q]); });
          layers.push({ name: (zh ? '数字_' : 'Number_') + g.tr.id.split('_')[1] + (nSeg.get(k) > 1 ? ` #${n}` : ''), src: { text: { t: tt2, v: tx2, font: 'Arial-Black', size: 24, fill: [1, 1, 1], stroke: [0.08, 0.07, 0.09], strokeWidth: 5 } }, in: r4(tin), out: r4(tout), label: LABEL.num, tr: { anchor: [0, 0], position: prop(fr2, e => [e[1], e[2] + 8], 0.25), scale: prop(fr2, e => [e[4] * 100, e[4] * 100], 0.5), opacity: prop(fr2, e => Math.max(0, Math.min(100, e[3])), 0.5) } });
        } }
    }
    while (sq < seqComps.length) layers.push(seqComps[sq++].layer);
    // 音频
    const audioFiles = [], ZH = n => (SFX_NAMES[n] || [0, n])[1];
    if (S.aeAudio !== 'none' && rec.sfx.length) {
      try {
        if (S.aeAudio === 'both' || S.aeAudio === 'mixed') { const buf = await renderSfxOffline(rec.sfx, D, S); if (buf) { audioFiles.push({ name: 'audio/mix.wav', data: encodeWav(buf) }); assets.push({ id: 'mix', file: 'audio/mix.wav', folder: 'aud', name: 'mix.wav' }); layers.push({ name: '混合音轨', src: { asset: 'mix' }, label: LABEL.audio }); } }
        if (S.aeAudio === 'both' || S.aeAudio === 'events') {
          const kinds = new Map(); rec.sfx.forEach(e => { const k = e.name + (e.name === 'whoosh' && e.dur ? '_' + Math.round(e.dur * 1000) : ''); if (!kinds.has(k)) kinds.set(k, e); e.k = k; });
          for (const [k, e] of kinds) { const buf = await renderSfxOffline([{ t: 0, name: e.name, dur: e.dur }], (e.name === 'whoosh' ? (e.dur || 0.3) : SFX_DUR[e.name] || 0.4) + 0.2, S); if (!buf) continue; audioFiles.push({ name: `audio/sfx_${k}.wav`, data: encodeWav(buf) }); assets.push({ id: 'sfx_' + k, file: `audio/sfx_${k}.wav`, folder: 'aud', name: `sfx_${k}.wav` }); }
          const al = rec.sfx.map((e, i) => { const st = r4(e.t); return { name: `音效 ${i + 1} ${ZH(e.name)}`, src: { asset: 'sfx_' + e.k }, start: st, in: st, label: LABEL.audio }; });
          comps.push({ id: 'sfx', name: '音效_逐事件', w: CW, h: CH, duration: D, fps, folder: 'pre', layers: al });
          layers.push({ name: '音效_逐事件', src: { comp: 'sfx' }, label: LABEL.audio });
        }
      } catch (e) { console.warn('audio export', e); }
    }
    for (const e of rec.sfx) markers.push([r4(e.t), ZH(e.name)]);
    const d = new Date(), p2 = x => String(x).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    comps.push({ id: 'main', name: '主合成_方块射击', w: CW, h: CH, duration: D, fps, folder: 'root', bg: [0, 0, 0], layers, markers });
    const [CW2, CH2] = S.aeSize && S.aeSize !== 'canvas' ? S.aeSize.split('x').map(Number) : [E.canvas.width, E.canvas.height];
    const K = Math.round(CW2 / CW * 1e6) / 1e6;
    if (K !== 1) { const mul = (P, f) => P == null ? P : Array.isArray(P) ? P.map(x => x * f) : P.t ? { ...P, v: P.v.map(x => Array.isArray(x) ? x.map(y => y * f) : x * f) } : P; for (const c of comps) { c.w = CW2; c.h = CH2; for (const l of c.layers) if (l.tr) { l.tr.position = mul(l.tr.position, K); l.tr.scale = mul(l.tr.scale, K); } } }
    if (!zh) {
      const T = [['主合成_方块射击', 'Main_BlockShooter'], ['方块射击_AE工程', 'BlockShooter_AE'], ['音效_逐事件', 'SFX events'], ['混合音轨', 'Mixed audio'], ['预合成', 'Precomps'], ['音效', 'SFX'], ['素材', 'Assets'], ['界面', 'UI'], ['音频', 'Audio'], ['小球特效', 'FX'], ['方块', 'Voxels'], ['炮台', 'Shooters'],
        ['点击', 'pop'], ['射击', 'shoot'], ['命中', 'hit'], ['离场', 'whoosh'], ['通关', 'chime'], ['失败', 'error']];
      const tr = x => { if (typeof x !== 'string') return x; for (const [a, b] of T) x = x.split(a).join(b); return x; };
      for (const c of comps) { c.name = tr(c.name); if (c.markers) c.markers = c.markers.map(([t, m]) => [t, tr(m)]); for (const l of c.layers) l.name = tr(l.name); }
      for (const f of folders) f.name = tr(f.name);
    }
    const stats = { comps: comps.length, layers: 0, keys: 0, perComp: {}, voxels: voxLayers.length, voxelsPopped: rec.pops.length, shooters: new Set(segs.filter(g => g.tr.id.startsWith('shooter')).map(g => g.tr.id)).size, sfx: rec.sfx.length };
    for (const c of comps) { stats.perComp[c.id] = c.layers.length; stats.layers += c.layers.length; for (const l of c.layers) { if (l.src && l.src.text && l.src.text.t.length > 1) stats.keys += l.src.text.t.length; if (l.tr) for (const k of ['position', 'scale', 'rotation', 'opacity']) { const kc = keyCount(l.tr[k]); if (kc > 1) stats.keys += kc; } } }
    const timeline = {
      meta: { tool: 'block-shooter-tool', format: 1, created: d.toISOString(), fps, width: CW2, height: CH2, duration: D, canvas: [E.canvas.width, E.canvas.height], sampling: bake ? 'bake' : 'reduce', scale: K, names: zh ? 'zh' : 'en', saveAep: S.aeSaveAep !== false, aepName: `block-shooter-tool_${stamp}.aep`, newProject: true, stats,
        voxelGrid: { W: rec.L.W, H: rec.L.H, D: rec.L.D, palette: rec.L.palette }, note: '图层从下到上排列；时间单位秒；位置/锚点单位像素（合成坐标）；缩放为百分比' },
      folders, assets: assets.map(({ id, file, folder, w, h, name }) => ({ id, file, folder, w, h, name })), comps, mainComp: 'main',
    };
    await Promise.all(pending);
    const enc = new TextEncoder();
    const files = [{ name: 'build_ae_project.jsx', data: enc.encode(JSX_TEXT) }, { name: 'timeline.json', data: enc.encode(JSON.stringify(timeline)) }, { name: 'README_AE.md', data: enc.encode(README_TEXT) }, ...assetFiles.sort((a, b) => a.name < b.name ? -1 : 1), ...audioFiles];
    return { blob: makeZip(files), name: `block-shooter-tool_ae_export_${stamp}.zip`, timeline, stats, files: files.length, fileList: files, snaps: rec.snaps.map(s => s.t), segs: segs.map(g => ({ id: g.tr.id, asset: g.tr.asset, z: g.tr.z, s: g.s, n: g.tr.n || null })), vox: { vox0: rec.vox0, seen: rec.seenVox, pops: rec.pops } };
  }
  return { start, stop, sample, exportZip, get rec() { return R; }, set rec(v) { R = v; } };
}
