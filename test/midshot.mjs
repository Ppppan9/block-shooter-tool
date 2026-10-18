// 参考关自动通关到指定时刻（虚拟时钟），渲染 3D 截图：node test/midshot.mjs out.png 秒数 [秒数2 ...]
import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(800);
const out = process.argv[2] || '/tmp/mid.png', secs = process.argv.slice(3).map(Number);
const shots = await p.evaluate(async (secs) => {
  window.__no3d = true; Math.random = (() => { let s = 99; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  let t = 100000; __game.renderAt(t); __game.autoSolve(); const t0 = t, res = [];
  for (const sec of secs) { while (t - t0 < sec * 1000) { t += 33.33; __game.renderAt(t); await new Promise(r => setTimeout(r, 0)); } window.__no3d = false; __game.renderAt(t); res.push(document.getElementById('stage').toDataURL('image/png')); window.__no3d = true; }
  return res;
}, secs);
shots.forEach((u, i) => fs.writeFileSync(secs.length > 1 ? out.replace('.png', `_${secs[i]}s.png`) : out, Buffer.from(u.split(',')[1], 'base64')));
console.log(JSON.stringify({ errs }));
await b.close();
