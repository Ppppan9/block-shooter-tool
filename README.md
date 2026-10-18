# 方块射击核玩工具（block-shooter-tool）

单文件离线网页工具（`index.html`，无 CDN），复刻“方块射击 / 炮台打同色体素”手游广告玩法，用于录制广告素材、导出 AE 工程与 3D 动画。遵守核玩工具通用规范（`/workspace/game-toolkit-standard/TOOLKIT_STANDARD.md`：统一按钮、设置键名、导出包结构、默认麻将手指、hideCursor）。

在线：https://ppppan9.github.io/block-shooter-tool/

## 玩法
- **体素关卡**：参考关 31×13×46（紫壳 + 绿菱形漏斗 + 正面绿中线 + 黑/黄夹层）；随机生成 / 导入透明 PNG/WebP（每像素 → 一根体素柱，alpha = 无方块，颜色量化）。
- **6 列队列 + 5 个槽位**：点击队首炮台 → 跳到最左空槽；槽内同色外露目标自动射击（约 12 发/秒）；弹药打光离场；无目标时等待。
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
- `screenshots/mid_ref_*.png`、`mid_game.png`：中局 3D
- `screenshots/shape_*.png`：图片导入关
- `screenshots/ae_export_check.jpg`、`export3d_blender_compare.jpg`：导出校验

参考分析：`ref/ANALYSIS.md`；进度：`ref/PROGRESS.md`。

## 与早期简报的差异（见 ANALYSIS）
- 队列是 **6 列**（不是 5）；槽位是 **5 个**。
- 点击进槽（不是按住）；无目标时原地等待（黄炮台可等十余秒）。
- 参考关弹药全部 **200**；深度画面顶端仍未到尽头（D≈46）。
- 默认手指用麻将工具手图；hideCursor 默认开。
