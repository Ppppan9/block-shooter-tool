// 截图：参考关第 0 帧（虚拟时钟），可选 T 秒后（自动通关推进）
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1300, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(1500);
await p.evaluate(() => __game.renderAt(1000));
const png = await p.evaluate(() => document.getElementById('stage').toDataURL('image/png'));
(await import('fs')).writeFileSync(process.argv[2] || '/tmp/shot.png', Buffer.from(png.split(',')[1], 'base64'));
console.log(JSON.stringify({ errs, status: await p.evaluate(() => document.getElementById('status').textContent) }));
await b.close();
