# PROGRESS（方块射击核玩工具 block-shooter-tool）

## v1.0.2（2026-10-19）
- ✅ 备选队列呼吸起伏（`bobAmp`/`bobPeriod`，仅视觉 bobY，相位按 id 错开）
- ✅ 射击时车身+炮塔 yaw（`body`/`upper` 分组；`aimSpeed`/`turretExtra`）；弹道仍从默认炮口
- ✅ 碎屑更密：`debrisCount` 2→5、`debrisLife`/`debrisSize`/`debrisSpread` 可调
- ✅ 白球光晕：`ballGlow`/`ballHalo`/`ballHaloOp`（物理半径仍 0.3）
- ✅ 正面可打规则保持；test:logic / test:clip PASS

# PROGRESS（方块射击核玩工具 block-shooter-tool）

## v1.0.1（2026-10-19）
- ✅ 射击目标改为仅「正面朝向炮台」外露（`frontExposedAt` / `isFrontTarget`）；渲染仍用任意面 `exposedAt`
- ✅ 去掉 `pickTargetLOS` 隧道/竖井钻内腔弹道；选目标稳定序 (k,j,i)
- ✅ simulate / nextAuto：进槽前 avail≥ammo；计划关不足时回退动态选色
- ✅ `ref/AUDIT_ANIM.md` 模型/动画审计；logic 正面可打断言

# PROGRESS（方块射击核玩工具 block-shooter-tool）

## v1.0.0（2026-10-19）
- ✅ M1–M2：ANALYSIS、核心逻辑、three.js 场景、弹道避障、自动通关、参考/随机/图片可解生成
- ✅ M4：AE 导出（PSNR ~33 dB）、3D 导出（Blender PASS，PSNR 22–28 dB）
- ✅ test:clip 0 违规（默认 REF_D=10；D=46 超过 240s 超时，可用 `REF_D=46 MAX_S=600`）
- ✅ test:shape PNG/WebP alpha→体素柱；shapeGen 等待防竞态
- ✅ test:norec / test:cursor（hideCursor + 默认麻将手指）
- ✅ screenshots/ref_vs_tool.jpg、mid_ref_*.png、shape_*、README
- ✅ 全套测试 PASS；`npm run build`；GitHub Pages

## 已知差距
- 参考关全深度 D=46 自动通关在默认 clip 超时内未跑完（体量 ~17k 体素）；浅深度与随机关已覆盖穿模检查。
- 参考视频 54s 未通关；工具以打光全部方块为胜利。
- ref_vs_tool 时刻对齐为虚拟时钟近似（autoSpeed 压缩点击间隔），非逐帧像素对齐。
