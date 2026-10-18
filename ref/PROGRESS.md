# PROGRESS（方块射击核玩工具 block-shooter-tool）

## M1 分析 + 脚手架 + 核心逻辑（进行中 2026-10-19 03:30 UTC+8）
- ✅ ref/ANALYSIS.md（相机拟合、6 列 / 5 槽、同色规则、射速 12/s、弹药打光离场、等待）
- ✅ 从 coffee-sort-tool v1.2.2 复制脚手架（build.mjs / template / settings / ae / export3d / audio / default_hand），删掉咖啡专用文件
- ✅ src/level.js：体素关卡（refVolume 31×12×46）、外露规则、目标选择、可解生成器 planShooters（弹药 ≤ 外露未预支 → 永不卡死）、distribute、volumeFromImage、simulate；test/logic-test.mjs ALL PASS
- ⏳ 下一步：src/world.js（相机/槽位/队列世界坐标）、src/three/scene3d.js、src/main.js 重写、settings.js 重写
- ✅ M1 完成；M2 进行中（04:00 UTC+8）：src/world.js（拟合相机 + 槽位/队列地面反投影坐标）、src/three/scene3d.js（体素 InstancedMesh 外露+内侧一层、底座、槽位、6 元素炮台 + 描边 + 数字牌）、src/main.js（点击→跳槽、同色外露目标 + 弹道避障、小球命中消除 + 弹开物理（体素/底座/炮台碰撞）、碎屑、离场、胜负、手指自动通关：计划顺序 / 参考关动态 + 参考开局黄→黑→绿）
- ✅ 参考关 = 6 列单色队列（黑/绿/紫/黄/绿/黑）全 200 弹药（level.refQueues）；随机/图片关 = 计划生成（保证可解）
- ✅ npm test（test/run-test.mjs，虚拟时钟）：随机×2 + 参考关 D=4 通关；test/midshot.mjs 中局截图
- ⏳ 下一步：AE 导出（recorder 适配：方块图层 = 每个可见方块一层 + 消除关键帧；数字 = 文本/素材层）、3D 导出、test:clip、PNG 导入测试、仓库 + Pages

## M4 状态（2026-10-19 04:10 UTC+8）
- AE：`npm run test:ae` = ae-export（虚拟时钟）+ ae-mock（0 错误，~460 图层 / ~7300 关键帧，80 个方块图层）+ ae-composite（PSNR 平均 ~33 dB，screenshots/ae_export_check.jpg）。数字为 AE 文本图层，字号按投影换算（lsx）。
- 3D：`npm run test:3d` = E3D=1 ae-export + Blender 无头（glb 导入、FBX 导出、Cycles 渲染 6 帧对比网页 PSNR 22–28 dB，screenshots/export3d_blender_compare.jpg）PASS。
  export3d.js：block_root 缩放 0.1；voxels/vox_<色>_i_j_k（消除缩放到 0）；dynamic_3d/<id>_vis；数字 = label 下 shooter_NNN_num_<n> 平面 STEP 切换；描边材质 pbr_outline 在 Blender 中用 Backfacing×相机光线。
- 下一步：test:clip（穿模/对齐逐帧测试）→ test:shape / test:norec / test:cursor → ref_vs_tool.jpg → README → push + Pages 校验。
