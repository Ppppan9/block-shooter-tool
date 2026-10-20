# 方块射击核玩工具（block-shooter-tool）

## v1.0.12：修复 H5 试玩黑屏 + 新增 AppLovin / Facebook / Moloco / Unity 渠道
- **修复**：导出的 H5 试玩打开后舞台全黑，只有底部 CTA。原因：导出器用全文正则剥离/注入（`<script>window.__PLAYABLE__…</script>`、`<style id="h5-playable-css">`），而工具自身 bundle 里就含这些模板字符串 → 正则命中主脚本内部并把游戏 JS 切掉一大段，游戏代码从未运行。现仅在 `<script>` 之外的标记上编辑（`editOutsideScripts`）。另：试玩壳不再 `remove()` 编辑器面板（改为隐藏），避免自动演示时 `updateButtons` 报错。
- **新渠道**：`applovin/`（MRAID 2.0，`mraid.open`）、`facebook/`（单 HTML ≤2MB，`FbPlayableAd.onCTAClick()`）、`moloco/`（单 HTML <5MB，不含 MRAID 脚本，`FbPlayableAd.onCTAClick()`）、`unity/`（MRAID 注入，ready+viewable 后再开始，`mraid.open`）。「全部」= 8 渠道。
- `npm run test:h5`：每个渠道起 http 服务用 Playwright 打开（1024×500 + 390×844，默认 / adaptive / iphone-13 / 大手指图），断言舞台**非黑**、无 console/page error、CTA 钩子存在。

## v1.0.11：H5 机型分辨率对齐 Chrome DevTools
- 修正：iPhone 14 Pro Max → **430×932**；Galaxy Z Fold 5 外屏 → **344×882**；iPad Pro 13 → **1032×1376**。新增 `iphone-14-plus`。设置版本 11。`npm run test:h5`。

## v1.0.10：H5 预览机型/尺寸（预览+导出；adaptive=全机型）

单文件离线网页工具（`index.html`，无 CDN），复刻“方块射击 / 炮台打同色体素”手游广告玩法，用于录制广告素材、导出 AE 工程与 3D 动画。遵守核玩工具通用规范（`/workspace/game-toolkit-standard/TOOLKIT_STANDARD.md`：统一按钮、设置键名、导出包结构、默认麻将手指、hideCursor）。

在线：https://ppppan9.github.io/block-shooter-tool/

## v1.0.8：方块贴合无缝对齐
- 默认 `voxGap=-0.035`（略重叠）+ `voxRound=0.12`，邻接圆角不再开暗缝；参考关 H=12 顶面同层平整（无零星凸起）；`neighborImpulse` 保持 0。设置版本 8。截图：`screenshots/v108_*`。

## v1.0.7：导出 H5 试玩广告
- 新增面板「导出 H5 试玩广告」（在导出 3D 之后）：一键导出 ZIP，含 TikTok/Pangle、Google Ads Playable、Mintegral、Generic 四个渠道子目录；试玩包无编辑器面板，仅游戏画面 + CTA；设置版本 7。`npm run test:h5` → `screenshots/block_shooter_h5_sample.zip`。

## 玩法
- **体素关卡**：参考关 31×12×46（紫壳 + 绿菱形漏斗 + 正面绿中线 + 黑/黄夹层）；随机生成 / 导入透明 PNG/WebP（每像素 → 一根体素柱，alpha = 无方块，颜色量化）。
- **6 列队列 + 5 个槽位**：点击队首炮台 → 跳到最左空槽；槽内同色**正面朝向炮台外露**目标自动射击（约 12 发/秒；一发一格）；弹药打光离场；无目标时等待。
- 小球带弹道避障（平射 / 抛物线 / 隧道沿法线飞入），命中消除 + 弹开物理 + 碎屑。
- **▶ 自动通关**：参考关按开局黄→黑→绿，之后按外露可打数动态点击；随机/图片关按生成器计划顺序（弹药 ≤ 外露未预支 → 永不卡死）。
- 默认手指 = 麻将工具同款（`src/default_hand.js`）；`hideCursor` 默认开（手指出现在画面上时画布 `cursor:none`）。

## 导出
- 视频录制：仅 `⏺ 开始录制` 或 `autoRec`（默认关）触发；`test:norec` 校验。
- AE：`● 开始记录` 或录制同步（aeWithRec），ZIP = `build_ae_project.jsx + timeline.json + assets/ + audio/`，每颗可见方块一层 + 消除关键帧，数字为文本层。
- 3D：`导出 3D 动画 (glTF/FBX/Blender)`，每体素独立节点，数字平面 STEP 切换。

## 开发
```
npm run build        # → index.html
npm run test:logic   # 体素 / 生成器 / 模拟通关
npm test             # 自动通关 + 截图（虚拟时钟）
npm run test:ae      # AE 导出 + jsx mock + 合成 PSNR
npm run test:ae3d    # 同 test:ae
npm run test:3d      # Blender 导入 + FBX + 渲染对比
npm run test:clip    # 逐帧穿模 / 对齐（0 违规）
npm run test:shape   # 透明 PNG/WebP → 关卡
npm run test:norec   # 录制触发规则
npm run test:cursor  # hideCursor + 默认麻将手指
```

## 截图
- `screenshots/ref_vs_tool.jpg`：参考视频 vs 工具，相同时刻并排（0 / 2 / 14 / 20 / 30 s）
- `screenshots/mid_ref_*.png`、`mid_game.png`、`audit_mid_flight.png`：中局 3D
- `screenshots/queue_bob_*.png`、`aim_yaw_fire.png`：队列呼吸 / 射击转向
- `screenshots/v103_*.png`：v1.0.3 任意外露面命中 / 前两行呼吸 / 果冻消除 / 球与描边
- `screenshots/v104_*.png`：v1.0.4 正面可打 / 珍珠白珠 / 缎面果冻方块 / 命中碎裂球消失；`v104_hit_metrics.json`
- `screenshots/v105_*.png`：v1.0.5 命中邻块果冻挤动（径向鼓包/回弹）
- `screenshots/v106_*.png`：v1.0.6 层间对齐 / 角落凸起修复（邻块默认不位移；对照参考）
- `screenshots/v108_*.png`：v1.0.8 方块贴合无缝 / 顶面平整（对照参考）
- `screenshots/shape_*.png`：图片导入关
- `screenshots/ae_export_check.jpg`、`export3d_blender_compare.jpg`：导出校验

参考分析：`ref/ANALYSIS.md`；进度：`ref/PROGRESS.md`。

## 与早期简报的差异（见 ANALYSIS）
- 队列是 **6 列**（不是 5）；槽位是 **5 个**。
- 点击进槽（不是按住）；无目标时原地等待（黄炮台可等十余秒）。
- 参考关弹药全部 **200**；深度画面顶端仍未到尽头（D≈46）。
- 默认手指用麻将工具手图；hideCursor 默认开。
