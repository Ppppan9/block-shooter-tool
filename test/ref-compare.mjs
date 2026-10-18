// Build screenshots/ref_vs_tool.jpg: ref video frames vs tool at matched moments + mid-game shots
import { chromium } from 'playwright-core';
import fs from 'fs';
import { execSync } from 'child_process';
const moments = [0, 2, 14, 20, 30]; // seconds from ANALYSIS
const tmp = '/tmp/bs_refcmp';
fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync('screenshots', { recursive: true });
for (const s of moments) {
  execSync(`ffmpeg -v error -y -ss ${s} -i ref/ref.mp4 -frames:v 1 -vf scale=360:-2 ${tmp}/ref_${s}.png`);
}
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(600);
const shots = await p.evaluate(async (secs) => {
  Math.random = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  __game.set('level', 'reference'); __game.set('refDepth', 14); __game.set('refOpening', true);
  __game.set('autoSpeed', 4); __game.set('autoStartDelay', 50); __game.set('moveMin', 40); __game.set('moveMax', 60);
  __game.set('delayMin', 20); __game.set('delayMax', 40); __game.set('thinkChance', 0); __game.set('handShow', true);
  window.__no3d = true; let t = 200000; __game.renderAt(t); __game.autoSolve(); const t0 = t;
  // wall-clock of auto is sped by autoSpeed; virtual time advances with renderAt
  // Drive by virtual seconds matching reference event times (autoSpeed compresses waits)
  const out = {};
  const maxF = 30 * 90;
  let f = 0;
  const need = new Set(secs);
  // opening frame before any tap meaningfully happens
  window.__no3d = false; __game.renderAt(t); out[0] = document.getElementById('stage').toDataURL('image/png'); window.__no3d = true; need.delete(0);
  while (need.size && f < maxF) {
    t += 1000 / 30; f++; __game.renderAt(t);
    const elapsed = (t - t0) / 1000; // virtual seconds (autoSpeed already shortens wait() via /autoSpeed but renderAt uses absolute vclock)
    // wait()/moveHand use now() which is __vclock — so advancing t advances auto. Good.
    for (const s of [...need]) {
      if (elapsed >= s) {
        window.__no3d = false; __game.renderAt(t);
        out[s] = document.getElementById('stage').toDataURL('image/png');
        window.__no3d = true; need.delete(s);
      }
    }
    if (f % 60 === 0) await new Promise(r => setTimeout(r, 0));
  }
  // mid-game extra
  while (f < maxF && __game.st.total > 2000) { t += 1000 / 30; f++; __game.renderAt(t); if (f % 90 === 0) await new Promise(r => setTimeout(r, 0)); }
  window.__no3d = false; __game.renderAt(t);
  out.mid = document.getElementById('stage').toDataURL('image/png');
  out.meta = { elapsed: +((t - t0) / 1000).toFixed(1), left: __game.st.total, taps: __game.G.taps || 0, finished: !!window.__finished };
  return out;
}, moments.filter(s => s > 0));
for (const s of moments) {
  if (!shots[s]) { console.warn('missing tool shot', s); continue; }
  fs.writeFileSync(`${tmp}/tool_${s}.png`, Buffer.from(shots[s].split(',')[1], 'base64'));
}
if (shots.mid) fs.writeFileSync('screenshots/mid_game.png', Buffer.from(shots.mid.split(',')[1], 'base64'));
console.log('meta', shots.meta);
// also save individual matched pairs
for (const s of moments) {
  if (fs.existsSync(`${tmp}/tool_${s}.png`)) fs.copyFileSync(`${tmp}/tool_${s}.png`, `screenshots/tool_${s}s.png`);
}
const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
const labs = moments.map(s => `${s}s`);
let inputs = '', filters = [];
moments.forEach((s, i) => {
  inputs += ` -i ${tmp}/ref_${s}.png -i ${tmp}/tool_${s}.png`;
  filters.push(`[${i * 2}:v]scale=280:498,drawtext=text='ref ${s}s':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.6:fontfile=${font}[r${i}]`);
  filters.push(`[${i * 2 + 1}:v]scale=280:498,drawtext=text='tool ${s}s':x=6:y=6:fontsize=16:fontcolor=yellow:box=1:boxcolor=black@0.6:fontfile=${font}[t${i}]`);
  filters.push(`[r${i}][t${i}]vstack=inputs=2[c${i}]`);
});
const hstack = moments.map((_, i) => `[c${i}]`).join('') + `hstack=inputs=${moments.length}[out]`;
filters.push(hstack);
execSync(`ffmpeg -v error -y ${inputs} -filter_complex "${filters.join(';')}" -map "[out]" -q:v 4 screenshots/ref_vs_tool.jpg`);
console.log('wrote screenshots/ref_vs_tool.jpg', fs.statSync('screenshots/ref_vs_tool.jpg').size);
await b.close();
