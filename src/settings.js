// 设置定义：所有可调参数。版本号 + 迁移（通用分组、键名、标签与麻将 / 打螺丝 / 咖啡工具一致，见 ref/TOOLKIT_STANDARD.md）
import { DEFAULT_HAND } from './default_hand.js';
export const SETTINGS_VERSION = 3;
export const STORE_KEY = 'blockShooterTool.settings';
export const APP_ID = 'block-shooter-tool';
// [key, 标签, 类型, 默认, min, max, step]  类型: range/color/bool/select/text/file/button
export const GROUPS = [
  ['画布与关卡', [
    ['canvasW', '画布宽度(px)', 'range', 720, 360, 1440, 2],
    ['canvasH', '画布高度(px)', 'range', 1280, 640, 2560, 2],
    ['level', '关卡', 'select', 'reference', [['reference', '参考关卡（31×13×46 紫壳 + 绿菱形 + 黑/黄中线）'], ['random', '随机生成（保证可解）'], ['image', '导入透明图形生成']]],
    ['seed', '随机种子', 'range', 1, 1, 9999, 1],
    ['refDepth', '参考关卡深度(格，参考≈46：画面顶端仍未到尽头)', 'range', 46, 4, 60, 1],
    ['randW', '随机关：宽(列)', 'range', 15, 3, 40, 1],
    ['randH', '随机关：高(层)', 'range', 8, 2, 20, 1],
    ['randD', '随机关：深(格)', 'range', 6, 1, 40, 1],
    ['randColors', '随机关：颜色数', 'range', 3, 2, 8, 1],
    ['maxAmmo', '每个炮台最多弹药(参考=200)', 'range', 200, 10, 999, 10],
    ['ammoStep', '弹药取整步长', 'range', 10, 1, 100, 1],
    ['refPrefs', '参考关：每列颜色偏好（参考队首 黑/绿/紫/黄/绿/黑）', 'bool', true],
  ]],
  ['导入透明图形生成关卡', [
    ['shapeImg', '上传透明PNG/WebP（每个像素 → 一根体素柱，alpha = 无方块）', 'file', ''],
    ['shapeThreshold', 'Alpha 阈值', 'range', 0.5, 0.05, 0.95, 0.01],
    ['shapeW', '体素列数（图片宽 → 列，高按比例）', 'range', 31, 4, 64, 1],
    ['shapeDepth', '体素柱深度(格)', 'range', 4, 1, 30, 1],
    ['shapePalette', '颜色', 'select', 'auto', [['auto', '按图片颜色量化（最多 N 色）'], ['fixed', '就近匹配内置 8 色']]],
    ['shapeColors', '最多颜色数', 'range', 4, 1, 8, 1],
    ['shapeSeed', '图形关卡种子', 'range', 1, 1, 9999, 1],
  ]],
  ['外观', [
    ['bgTop', '背景顶部(参考≈#312d3c)', 'color', '#312d3c'],
    ['bgMid', '背景中部亮区(参考≈#a499c0)', 'color', '#a499c0'],
    ['bgBottom', '背景底部(参考≈#665c7a)', 'color', '#665c7a'],
    ['col_purple', '紫色', 'color', '#7a12c4'],
    ['col_green', '绿色', 'color', '#b4f02a'],
    ['col_black', '黑色', 'color', '#38383e'],
    ['col_yellow', '黄色', 'color', '#ffb11e'],
    ['col_red', '红色', 'color', '#f03a3a'],
    ['col_blue', '蓝色', 'color', '#2f7cf0'],
    ['col_orange', '橙色', 'color', '#ff7a1a'],
    ['col_pink', '粉色', 'color', '#ff6ad0'],
    ['baseColor', '底座颜色(参考≈#ff2a8a)', 'color', '#ff2a8a'],
    ['baseMargin', '底座外沿(格)', 'range', 0.9, 0, 4, 0.05],
    ['baseFront', '底座前沿 z(格)', 'range', 1.6, 0, 6, 0.05],
    ['baseThick', '底座厚度(格)', 'range', 0.55, 0.05, 3, 0.05],
    ['baseRadius', '底座圆角(格)', 'range', 0.6, 0, 2, 0.05],
    ['slotColor', '槽位颜色', 'color', '#f4f2ff'],
    ['slotR', '槽位半径(格)', 'range', 1.2, 0.3, 1.4, 0.01],
    ['voxGap', '方块间缝(×格)', 'range', 0.04, 0, 0.3, 0.005],
    ['voxRound', '方块圆角(×格)', 'range', 0.16, 0, 0.45, 0.01],
    ['outline3d', '卡通描边粗细(炮台，参考玩具描边)', 'range', 0.95, 0, 2, 0.05],
    ['numBackOpacity', '后排炮台数字不透明度(参考≈0.45)', 'range', 0.45, 0, 1, 0.01],
    ['ballR', '小球半径(格；观感靠自发光+光晕略放大)', 'range', 0.3, 0.1, 0.8, 0.01],
    ['ballGlow', '小球自发光强度(软光泽，勿过曝)', 'range', 0.28, 0, 2, 0.05],
    ['ballHalo', '小球光晕相对半径', 'range', 1.65, 1, 2.5, 0.05],
    ['ballHaloOp', '小球光晕不透明度', 'range', 0.2, 0, 0.8, 0.01],
  ]],
  ['3D 渲染（three.js，离线打包）', [
    ['cam3dFov', '相机视角 FOV(°，按参考拟合≈3.35)', 'range', 3.35, 1, 60, 0.05],
    ['cam3dX', '相机位置 X', 'range', -206.67, -1500, 1500, 0.01],
    ['cam3dY', '相机位置 Y', 'range', 600.98, 1, 2500, 0.01],
    ['cam3dZ', '相机位置 Z', 'range', 767.89, -1500, 2500, 0.01],
    ['cam3dTX', '相机目标 X', 'range', -0.737, -100, 100, 0.001],
    ['cam3dTY', '相机目标 Y', 'range', 11.987, -100, 100, 0.001],
    ['cam3dTZ', '相机目标 Z', 'range', 7.503, -100, 100, 0.001],
    ['light3dSun', '主光强度(顶光勾方块高光)', 'range', 2.35, 0, 6, 0.05],
    ['light3dAmbient', '环境光强度', 'range', 1.15, 0, 4, 0.05],
    ['light3dAzim', '主光方位角(°)', 'range', 330, 0, 360, 1],
    ['light3dElev', '主光仰角(°)', 'range', 68, 5, 90, 1],
    ['mat3dRough', '默认材质粗糙度(回退)', 'range', 0.72, 0, 1, 0.01],
    ['voxRough', '方块粗糙度(果冻/亮塑料)', 'range', 0.36, 0, 1, 0.01],
    ['tankRough', '炮台粗糙度(半哑光玩具塑料)', 'range', 0.72, 0, 1, 0.01],
  ]],
  ['玩法与动画', [
    ['fireRate', '射速(发/秒，参考≈12)', 'range', 12, 1, 60, 0.5],
    ['ballSpeed', '小球飞行速度(格/秒)', 'range', 45, 5, 200, 1],
    ['ballArc', '小球弧线高度(格)', 'range', 1.2, 0, 8, 0.1],
    ['bounceSpeed', '命中后弹开速度(格/秒)', 'range', 9, 0, 40, 0.5],
    ['gravity', '重力(格/秒²)', 'range', 32, 0, 120, 1],
    ['ballLife', '弹开后存在时间(ms)', 'range', 1100, 100, 4000, 50],
    ['jumpDur', '炮台跳入槽位(ms)', 'range', 260, 50, 1500, 10],
    ['jumpHeight', '跳跃高度(格，≥2.1 越过相邻炮台)', 'range', 2.3, 0, 6, 0.1],
    ['advanceDur', '队列前移(ms)', 'range', 200, 30, 1500, 10],
    ['leaveDur', '弹药打光离场(ms)', 'range', 380, 50, 2000, 10],
    ['popDur', '方块消除(ms，含果冻挤压)', 'range', 160, 0, 1000, 10],
    ['jellyPop', '果冻消除挤压/拉长强度', 'range', 1, 0, 2, 0.05],
    ['debrisCount', '每个方块碎屑数(果冻碎屑更浓≈8)', 'range', 8, 0, 16, 1],
    ['debrisLife', '碎屑存在时间(ms)', 'range', 750, 100, 3000, 50],
    ['debrisSize', '碎屑尺寸(格)', 'range', 0.26, 0.05, 0.8, 0.01],
    ['debrisSpread', '碎屑飞散速度', 'range', 1.35, 0.2, 3, 0.05],
    ['bobAmp', '前两行呼吸起伏幅度(槽位+队首，格≈0.1)', 'range', 0.1, 0, 0.5, 0.01],
    ['bobPeriod', '前两行呼吸周期(ms，参考≈550)', 'range', 550, 200, 3000, 10],
    ['aimSpeed', '射击时车身转向速度(°/秒)', 'range', 420, 0, 1200, 10],
    ['turretExtra', '炮塔相对车身额外转角(°，参考上半身更跟手)', 'range', 8, 0, 45, 1],
    ['recoil', '射击后坐(格)', 'range', 0.12, 0, 0.6, 0.01],
    ['pressScale', '点击炮台按下缩小', 'range', 0.1, 0, 0.3, 0.01],
    ['loseRule', '失败判定', 'select', 'on', [['on', '5 槽全满且都无目标 → 失败'], ['off', '不判失败']]],
  ]],
  ['文字', [
    ['discShow', '显示底部免责声明', 'bool', true],
    ['discText', '底部文字', 'text', '广告素材宣传场景须达到一定条件触发相关支线玩法'],
    ['discSize', '底部字号', 'range', 22, 10, 40, 1],
    ['discY', '底部文字Y(距底)', 'range', 6, 0, 200, 1],
    ['discBar', '底部半透明黑条不透明度', 'range', 0, 0, 1, 0.01],
    ['textOpacity', '文字透明度', 'range', 1, 0, 1, 0.01],
    ['winText', '通关文字', 'text', '通关！'],
    ['loseText', '失败文字', 'text', '槽位已满'],
  ]],
  ['音效', [
    ['sfxMute', '静音', 'bool', false],
    ['sfxVolume', '总音量', 'range', 0.8, 0, 1.5, 0.01],
    ['sfxPop', '点击/跳入槽位', 'bool', true],
    ['sfxPopVol', '点击/跳入槽位 音量', 'range', 1, 0, 2, 0.01],
    ['sfxShoot', '射击', 'bool', true],
    ['sfxShootVol', '射击 音量', 'range', 1, 0, 2, 0.01],
    ['sfxShootMax', '射击音每秒最多(次)', 'range', 14, 1, 60, 1],
    ['sfxHit', '命中', 'bool', true],
    ['sfxHitVol', '命中 音量', 'range', 0.8, 0, 2, 0.01],
    ['sfxWhoosh', '离场', 'bool', true],
    ['sfxWhooshVol', '离场 音量', 'range', 1, 0, 2, 0.01],
    ['sfxChime', '通关', 'bool', true],
    ['sfxChimeVol', '通关 音量', 'range', 1, 0, 2, 0.01],
    ['sfxError', '失败', 'bool', true],
    ['sfxErrorVol', '失败 音量', 'range', 1, 0, 2, 0.01],
  ]],
  ['手指 / 自动通关', [
    ['autoSpeed', '整体速度倍率', 'range', 1, 0.25, 6, 0.05],
    ['moveMin', '移动耗时最小(ms)', 'range', 380, 50, 2000, 10],
    ['moveMax', '移动耗时最大(ms)', 'range', 700, 50, 3000, 10],
    ['delayMin', '点击间隔最小(ms)', 'range', 120, 0, 2000, 10],
    ['delayMax', '点击间隔最大(ms)', 'range', 420, 0, 4000, 10],
    ['thinkChance', '“思考停顿”概率', 'range', 0.12, 0, 0.6, 0.01],
    ['thinkMax', '思考停顿最长(ms)', 'range', 900, 0, 4000, 50],
    ['jitter', '落点随机抖动(px)', 'range', 10, 0, 40, 1],
    ['handSize', '手指大小(画面宽比例)', 'range', 0.42, 0.1, 0.9, 0.01],
    ['handAnchorX', '指尖锚点 X(0~1)', 'range', 0.22039473684210525, 0, 1, 0.005],
    ['handAnchorY', '指尖锚点 Y(0~1)', 'range', 0.03667763157894737, 0, 1, 0.005],
    ['handRotation', '手指旋转(度)', 'range', 6, -60, 60, 1],
    ['handFlip', '手指水平翻转', 'bool', false],
    ['handImage', '上传手指图片(透明PNG，不上传则不显示手指；默认=麻将工具同款手指)', 'file', DEFAULT_HAND],
    ['pressEnabled', '点击按下效果', 'bool', true],
    ['pressDepth', '按压幅度（按下时手指缩小比例）', 'range', 0.12, 0, 0.3, 0.01],
    ['tapRipple', '点击处显示波纹圈（参考视频没有）', 'bool', false],
    ['handShow', '显示手指', 'bool', true],
    ['hideCursor', '手指出现时隐藏鼠标', 'bool', true],
    ['autoParallel', '自动通关同时射击的炮台数', 'range', 3, 1, 5, 1],
    ['handRest', '等待时手指移到一旁', 'bool', true],
    ['autoStartDelay', '开始前等待(ms)', 'range', 400, 0, 5000, 50],
    ['refOpening', '参考关开局按参考顺序点击（黄→黑→绿）', 'bool', true],
  ]],
  ['录制', [
    ['recFps', '帧率', 'range', 30, 15, 60, 1],
    ['recFormat', '格式', 'select', 'auto', [['auto', '自动(优先 MP4)'], ['mp4', 'MP4'], ['webm', 'WebM']]],
    ['recBitrate', '码率(Mbps)', 'range', 8, 1, 30, 0.5],
    ['autoRec', '自动通关开始时自动录制（默认关）', 'bool', false],
    ['autoStop', '自动通关通关后停止录制并下载（仅在正在录制时）', 'bool', true],
    ['tailSec', '通关后继续录制(秒)', 'range', 2.5, 0, 10, 0.1],
  ]],
  ['导出 AE 工程', [
    ['_aeToggle', '记录 AE 时间轴（自动通关/手动游玩都可）', 'button', 'aeToggle', '● 开始记录'],
    ['_aeExport', '重新导出上一次记录', 'button', 'aeExport', '⬇ 导出 ZIP'],
    ['aeWithRec', '录制视频时同步记录，停止录制后自动导出', 'bool', true],
    ['aeFps', 'AE 合成帧率', 'select', '30', [['24', '24'], ['25', '25'], ['30', '30'], ['60', '60']]],
    ['aeSize', 'AE 合成尺寸', 'select', 'canvas', [['canvas', '同画布分辨率'], ['720x1280', '720×1280'], ['1080x1920', '1080×1920']]],
    ['aeSampling', '关键帧方式', 'select', 'reduce', [['reduce', '精简关键帧（线性插值，误差 <0.3px）'], ['bake', '逐帧烘焙（每帧一个关键帧）']]],
    ['aeVoxels', '方块图层', 'select', 'visible', [['visible', '记录期间可见的方块各一个图层（被挡住的内部方块省略）'], ['all', '全部方块']]],
    ['aeNames', '图层命名', 'select', 'zh', [['zh', '中文'], ['en', 'English']]],
    ['aeAudio', '音频', 'select', 'both', [['both', '混合音轨 + 逐事件音效层'], ['mixed', '仅混合音轨'], ['events', '仅逐事件音效层'], ['none', '不导出音频']]],
    ['aeSaveAep', '脚本跑完后提示另存为 .aep', 'bool', true],
  ]],
  ['导出 3D 动画（UE5 / C4D / Blender）', [
    ['_export3d', '用上一次 AE 记录生成 glTF 场景 + Blender 脚本 + 音频', 'button', 'export3d', '导出 3D 动画 (glTF/FBX/Blender)'],
    ['export3dFps', '3D 动画帧率', 'select', '30', [['24', '24'], ['25', '25'], ['30', '30'], ['60', '60']]],
    ['export3dHand', '包含手指（贴图平面；结束页是否显示仍按“结束页显示手指”）', 'bool', true],
  ]],
  ['结束页(End Card)', [
    ['endCard', '显示结束页', 'bool', false],
    ['endCardHand', '结束页显示手指（自动通关点按钮）', 'bool', false],
    ['endDelay', '通关后出现延迟(ms)', 'range', 900, 0, 5000, 50],
    ['endTitle', '标题', 'text', '立即下载 挑战更多关卡'],
  ]],
];
export const DEFS = {};
for (const [, items] of GROUPS) for (const it of items) if (it[2] !== 'button') DEFS[it[0]] = it[3];
// migrate：只补默认值、把仍等于旧默认值的项换成新默认、旧键→新键；不覆盖用户改过的值
export function migrate(obj) {
  if (!obj || typeof obj !== 'object') return { ...DEFS };
  let v = obj.version || 0; const s = { ...(obj.settings || obj) };
  if (v < 1) { // v0（无版本号草稿）：通用旧键 → 新键
    const mv = (o, n, f = x => x) => { if (o in s) { if (!(n in s)) s[n] = f(s[o]); delete s[o]; } };
    mv('handImg', 'handImage'); mv('sfxVol', 'sfxVolume'); mv('sfx', 'sfxMute', x => !x); mv('recTail', 'tailSec', x => Math.round(x / 100) / 10); mv('endText', 'endTitle');
    v = 1;
  }
  const OLD = {
    2: { debrisCount: 2 },
    // v3：恢复任意外露面可打 + 材质/描边/果冻/球默认
    3: { outline3d: 0.6, ballGlow: 0.55, ballHalo: 1.55, ballHaloOp: 0.32, mat3dRough: 0.8, light3dSun: 2.1, light3dAmbient: 1.25, light3dElev: 62, popDur: 110, debrisCount: 5 },
  }; // 版本 → 旧默认（仍等于旧默认才替换）
  for (const nv of Object.keys(OLD).map(Number).sort((a, b) => a - b)) if (v < nv) { for (const k in OLD[nv]) if (s[k] === OLD[nv][k]) delete s[k]; v = nv; }
  const out = { ...DEFS };
  for (const k in DEFS) if (k in s && typeof s[k] === typeof DEFS[k]) out[k] = s[k];
  return out;
}
export function loadSettings() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { }
  return { ...DEFS };
}
export function saveSettings(S) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ version: SETTINGS_VERSION, settings: S })); } catch (e) { console.warn('save fail (图片过大?)', e); }
}
export function exportJSON(S) { return JSON.stringify({ app: APP_ID, version: SETTINGS_VERSION, settings: S }, null, 2); }
