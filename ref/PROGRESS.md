# PROGRESS（方块射击核玩工具 block-shooter-tool）

## M1 分析 + 脚手架 + 核心逻辑（进行中 2026-10-19 03:30 UTC+8）
- ✅ ref/ANALYSIS.md（相机拟合、6 列 / 5 槽、同色规则、射速 12/s、弹药打光离场、等待）
- ✅ 从 coffee-sort-tool v1.2.2 复制脚手架（build.mjs / template / settings / ae / export3d / audio / default_hand），删掉咖啡专用文件
- ✅ src/level.js：体素关卡（refVolume 31×12×46）、外露规则、目标选择、可解生成器 planShooters（弹药 ≤ 外露未预支 → 永不卡死）、distribute、volumeFromImage、simulate；test/logic-test.mjs ALL PASS
- ⏳ 下一步：src/world.js（相机/槽位/队列世界坐标）、src/three/scene3d.js、src/main.js 重写、settings.js 重写
