// 自动通关（小关卡，虚拟时钟逐帧推进）→ 记录 AE 时间轴（每 N 帧 3D 渲染截取网页画面）→ 导出 AE zip；E3D=1 同时导出 3D zip
import { chromium } from 'playwright-core';
import fs from 'fs';
const OUT = process.env.AE_OUT || '/tmp/bs_ae'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + '/snaps', { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(600);
const cfg = JSON.parse(process.env.CFG || '{"level":"random","seed":5,"randW":8,"randH":5,"randD":2,"randColors":3,"autoSpeed":3,"autoStartDelay":100,"fireRate":20}');
const info = await p.evaluate(async ([cfg, snapEvery]) => { try {
  Math.random = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  for (const [k, v] of Object.entries(cfg)) __game.set(k, v);
  window.__no3d = true; let t = 200000; __game.renderAt(t); __game.aeStart(); __game.autoSolve(); const rec = __game.aeRec.rec; const snaps = []; let f = 0;
  const snap = () => { window.__no3d = false; __game.renderAt(t); snaps.push({ t: (t - rec.t0) / 1000, url: document.getElementById('stage').toDataURL('image/png') }); window.__no3d = true; };
  while (!window.__finished && f < 30 * 120) { t += 1000 / 30; f++; if (f % snapEvery === snapEvery - 1 && snaps.length < 40) snap(); else __game.renderAt(t); await new Promise(r => setTimeout(r, 0)); }
  for (let q = 0; q < 45; q++) { t += 1000 / 30; __game.renderAt(t); }
  snap(); __game.aeStop();
  const r = await __game.doExportAE(false);
  const buf = new Uint8Array(await r.blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { zip: btoa(bin), name: r.name, stats: r.stats, files: r.files, duration: r.timeline.meta.duration, snaps, left: __game.st.total, finished: !!window.__finished };
} catch (e) { return { err: e.stack }; } }, [cfg, +(process.env.SNAP_EVERY || 12)]);
if (info.err) { console.log(info.err); process.exit(1); }
fs.writeFileSync(process.env.AE_ZIP || '/workspace/block_shooter_ae_sample.zip', Buffer.from(info.zip, 'base64'));
const map = {}; info.snaps.forEach((s, i) => { const f = String(i).padStart(3, '0') + '.png'; fs.writeFileSync(`${OUT}/snaps/${f}`, Buffer.from(s.url.split(',')[1], 'base64')); map[f] = s.t; });
fs.writeFileSync(`${OUT}/snaps/snaps.json`, JSON.stringify(map));
if (process.env.E3D) {
  const e3 = await p.evaluate(async () => { try { const r = await __game.doExport3D(false); const buf = new Uint8Array(await r.blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return { zip: btoa(bin), stats: r.stats, duration: r.duration, fps: r.fps }; } catch (e) { return { err: e.stack }; } });
  if (e3.err) { console.log(e3.err); process.exit(1); }
  fs.writeFileSync('/workspace/block_shooter_3d_sample.zip', Buffer.from(e3.zip, 'base64'));
  console.log('3D', JSON.stringify({ stats: e3.stats, duration: e3.duration }));
}
console.log(JSON.stringify({ name: info.name, stats: info.stats, files: info.files, duration: info.duration, snaps: info.snaps.length, finished: info.finished, left: info.left, errs }));
await b.close();
if (errs.length || !info.finished) process.exit(1);
