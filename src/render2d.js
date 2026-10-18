// 2D 部分：背景渐变、免责声明、结果文字、结束页（页面绘制 + AE 素材同源）
import { DW, DH } from './world.js';
export const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
export function drawBackground(c, S, k) {
  const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0);
  const lg = g.createLinearGradient(0, 0, 0, DH); lg.addColorStop(0, S.bgTop); lg.addColorStop(0.55, S.bgMid); lg.addColorStop(1, S.bgBottom); g.fillStyle = lg; g.fillRect(0, 0, DW, DH);
  const rg = g.createRadialGradient(560, 760, 40, 560, 760, 720); rg.addColorStop(0, hexA(S.bgMid, 0.55)); rg.addColorStop(1, hexA(S.bgMid, 0)); g.fillStyle = rg; g.fillRect(0, 0, DW, DH); // 参考：右侧中部最亮
  const vg = g.createRadialGradient(DW / 2, DH * 0.55, DH * 0.35, DW / 2, DH * 0.55, DH * 0.85); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,6,20,0.35)'); g.fillStyle = vg; g.fillRect(0, 0, DW, DH);
}
export const hexA = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
export function drawDisclaimer(g, S) {
  if (!S.discShow) return; g.save(); const fs = S.discSize, y = DH - S.discY;
  if (S.discBar > 0) { g.fillStyle = `rgba(0,0,0,${S.discBar})`; g.fillRect(0, y - fs * 1.5, DW, fs * 1.5 + S.discY); }
  g.globalAlpha = S.textOpacity; g.font = `${fs}px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom';
  g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineJoin = 'round'; g.strokeText(S.discText, DW / 2, y - fs * 0.2); g.fillStyle = '#fff'; g.fillText(S.discText, DW / 2, y - fs * 0.2);
  g.restore();
}
export function drawResult(g, S, win) {
  g.save(); g.font = 'bold 76px "Microsoft YaHei","PingFang SC",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.lineWidth = 14; g.strokeStyle = win ? '#3a0a5a' : '#4a0010'; g.strokeText(win ? S.winText : S.loseText, DW / 2, 420); g.fillStyle = win ? '#ffe14a' : '#ff5a6a'; g.fillText(win ? S.winText : S.loseText, DW / 2, 420); g.restore();
}
export function drawEnd(g, S, p, noDim) {
  g.save(); g.globalAlpha = p; g.fillStyle = 'rgba(0,0,0,.55)'; if (!noDim) g.fillRect(0, 0, DW, DH);
  g.fillStyle = '#ffd54a'; g.beginPath(); g.roundRect(160, 600, 400, 100, 50); g.fill();
  g.fillStyle = '#4a2a00'; g.font = 'bold 34px "Microsoft YaHei",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(S.endTitle, 360, 650);
  g.restore();
}
