// 自动通关（虚拟时钟逐帧推进；默认不渲染 3D 以加速，R3D=1 渲染）：随机关 + 图片关 + 参考关（浅）全部通关，并截图
import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(800);
let fail = 0;
async function run(name, cfg, maxSec = 400) {
  const r = await p.evaluate(async ([cfg, maxSec, r3d]) => {
    window.__no3d = !r3d; for (const [k, v] of Object.entries(cfg)) __game.set(k, v);
    let t = 100000; __game.renderAt(t); __game.autoSolve();
    const t0 = t; let violations = 0, maxBalls = 0;
    while (!window.__finished && !window.__failed && t - t0 < maxSec * 1000) { t += 33.33; __game.renderAt(t); maxBalls = Math.max(maxBalls, __game.G.balls.length); await new Promise(r => setTimeout(r, 0)); }
    const G = __game.G; return { finished: !!window.__finished, failed: !!window.__failed, simSec: Math.round((t - t0) / 100) / 10, left: __game.st.total, shots: G.shots, used: G.shooters.filter(s => s.state === 'gone').length, shooters: G.shooters.length, maxBalls };
  }, [cfg, maxSec, !!process.env.R3D]);
  const ok = r.finished && !r.failed && r.left === 0; if (!ok) fail++;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(r));
}
await run('随机关 seed=3 15×8×6 三色', { level: 'random', seed: 3, randW: 15, randH: 8, randD: 6, randColors: 3, autoSpeed: 4, autoStartDelay: 0 });
await run('随机关 seed=42 12×6×4 五色', { level: 'random', seed: 42, randW: 12, randH: 6, randD: 4, randColors: 5, autoSpeed: 4 });
await run('参考关 D=4（单色列 200 弹药，动态点击）', { level: 'reference', refDepth: 4, autoSpeed: 4 }, 600);
const png = await p.evaluate(() => { window.__no3d = false; __game.renderAt(9e6); return document.getElementById('stage').toDataURL('image/png'); });
fs.writeFileSync('screenshots/auto_finish.png', Buffer.from(png.split(',')[1], 'base64'));
console.log(errs.length ? 'ERRORS ' + errs.slice(0, 3).join(' | ') : 'no page errors');
console.log(fail || errs.length ? 'SOME FAIL' : 'ALL PASS');
await b.close(); process.exit(fail || errs.length ? 1 : 0);
