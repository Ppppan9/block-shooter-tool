// 导入透明图形生成关卡：PNG / WebP（含 alpha）→ 每个像素 = 一根体素柱（alpha ≤ 阈值 = 无方块），颜色量化 ≤ N 色；
// 生成器保证可解：每色弹药总数 = 方块数，自动通关（虚拟时钟）必须打完且不失败；并截取 3D 画面 screenshots/shape_*.png
import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(500);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const shapes = { heart_png: 'image/png', ring_webp: 'image/webp', smile_png: 'image/png' };
for (const [name, mime] of Object.entries(shapes)) {
  const r = await p.evaluate(async ([name, mime]) => {
    const c = document.createElement('canvas'); c.width = 96; c.height = 80; const g = c.getContext('2d');
    if (name.startsWith('heart')) { g.fillStyle = '#e83a5f'; g.beginPath(); g.moveTo(48, 76); g.bezierCurveTo(-10, 36, 18, -8, 48, 22); g.bezierCurveTo(78, -8, 106, 36, 48, 76); g.fill(); g.fillStyle = '#ffffff'; g.fillRect(28, 22, 10, 10); g.fillStyle = '#3a2a80'; g.fillRect(40, 44, 16, 10); }
    else if (name.startsWith('ring')) { g.lineWidth = 16; g.strokeStyle = '#2db84d'; g.beginPath(); g.arc(48, 40, 28, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#f2c230'; g.beginPath(); g.arc(48, 40, 9, 0, Math.PI * 2); g.fill(); }
    else { g.fillStyle = '#f2c230'; g.beginPath(); g.arc(48, 40, 36, 0, Math.PI * 2); g.fill(); g.fillStyle = '#222222'; g.fillRect(32, 24, 8, 12); g.fillRect(56, 24, 8, 12); g.lineWidth = 6; g.strokeStyle = '#222222'; g.beginPath(); g.arc(48, 44, 18, 0.2, Math.PI - 0.2); g.stroke(); }
    const url = c.toDataURL(mime); const real = url.slice(5, url.indexOf(';'));
    const ref = g.getImageData(0, 0, 96, 80).data;
    __game.set('shapeW', 24); __game.set('shapeDepth', 3); __game.set('shapeColors', 4); __game.set('shapePalette', 'auto'); __game.set('level', 'image');
    const gen0 = __game.shapeGen || 0;
    __game.set('shapeImg', url);
    for (let i = 0; i < 100 && (!(__game.L && __game.L.W === 24 && __game.L.palette[0].startsWith('img') && __game.S.shapeImg === url) || (__game.shapeGen || 0) <= gen0); i++) await new Promise(r => setTimeout(r, 50));
    if ((__game.shapeGen || 0) <= gen0 || __game.S.shapeImg !== url) throw new Error('shape level did not rebuild for ' + name + ' gen=' + __game.shapeGen + '/' + gen0);
    const L = __game.L, st = __game.st, G = __game.G;
    // alpha ↔ 体素柱（与生成同一采样：先缩放到 W×H 再逐像素）
    const H = L.H, cc = document.createElement('canvas'); cc.width = L.W; cc.height = H; const g2 = cc.getContext('2d'); g2.imageSmoothingEnabled = true; const im = new Image(); im.src = url; await im.decode(); g2.drawImage(im, 0, 0, L.W, H); const px = g2.getImageData(0, 0, L.W, H).data;
    let colMismatch = 0, partial = 0, cells = 0, alphaPix = 0; const th = __game.S.shapeThreshold;
    for (let j = 0; j < H; j++) for (let i = 0; i < L.W; i++) { const q = ((H - 1 - j) * L.W + i) * 4, solid = px[q + 3] / 255 > th; if (!solid) alphaPix++; let n = 0, c0 = -1, mixed = false; for (let k = 0; k < L.D; k++) { const v = L.vox[i + j * L.W + k * L.W * L.H]; if (v) { n++; if (c0 < 0) c0 = v; else if (v !== c0) mixed = true; } } if ((n > 0) !== solid) colMismatch++; if (n && (n !== L.D || mixed)) partial++; cells += n; }
    const perColor = L.palette.map((_, c) => L.vox.filter(v => v === c + 1).length), ammo = L.palette.map((_, c) => G.shooters.filter(s => s.color === c).reduce((a, s) => a + s.ammo, 0));
    const shot = async () => { window.__no3d = false; __game.renderAt(500000); return document.getElementById('stage').toDataURL('image/png'); };
    const png0 = await shot();
    // 自动通关（虚拟时钟，跳过 3D）
    __game.set('autoSpeed', 3); __game.set('autoStartDelay', 100); window.__no3d = true; window.__finished = false; window.__failed = false; let t = 600000; __game.renderAt(t); __game.autoSolve(); let f = 0, mid = null;
    while (!window.__finished && !window.__failed && f < 30 * 400) { t += 1000 / 30; f++; __game.renderAt(t); if (!mid && __game.st.total < cells * 0.55) { window.__no3d = false; __game.renderAt(t); mid = document.getElementById('stage').toDataURL('image/png'); window.__no3d = true; } if (f % 90 === 0) await new Promise(r => setTimeout(r, 0)); }
    return { mime: real, W: L.W, H, D: L.D, palette: L.palette, cols: L.palette.map(n => __game.S['col_' + n]), cells, alphaPix, colMismatch, partial, perColor, ammo, finished: !!window.__finished, failed: !!window.__failed, left: __game.st.total, secs: +(f / 30).toFixed(1), png0, mid };
  }, [name, mime]);
  fs.writeFileSync(`screenshots/shape_${name}.png`, Buffer.from(r.png0.split(',')[1], 'base64')); if (r.mid) fs.writeFileSync(`screenshots/shape_${name}_mid.png`, Buffer.from(r.mid.split(',')[1], 'base64'));
  delete r.png0; delete r.mid; console.log(name, JSON.stringify(r));
  ok(r.mime === mime, `${name}: encoded as ${r.mime}`);
  ok(r.colMismatch === 0 && r.alphaPix > 0, `${name}: alpha → no block, opaque → voxel column (mismatch ${r.colMismatch}, transparent px ${r.alphaPix})`);
  ok(r.partial === 0, `${name}: every column full depth + single colour`);
  ok(r.palette.length >= 1 && r.palette.length <= 4, `${name}: ${r.palette.length} colours (≤4) ${r.cols.join(' ')}`);
  ok(r.perColor.every((n, c) => n === r.ammo[c]), `${name}: ammo per colour = voxels per colour ${JSON.stringify(r.perColor)}`);
  ok(r.finished && !r.failed && r.left === 0, `${name}: auto-solve clears it (${r.secs}s virtual)`);
}
ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | '));
await b.close(); console.log(fails ? 'SHAPE FAIL ' + fails : 'SHAPE ALL PASS'); process.exit(fails ? 1 : 0);
