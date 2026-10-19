## v1.0.8（2026-10-19）
- **方块贴合无缝对齐**：默认 `voxGap=-0.035`（≈3.5% 重叠）+ `voxRound=0.12`，邻接圆角不再开暗缝（corduroy）
- **绿菱形顶面平整**：`refVolume` H=12、同层同 j，去掉 H-1 零星凸起；`neighborImpulse` 保持 0
- `SETTINGS_VERSION` 8；`test:logic` / `test:clip`；Pages 发布

## v1.0.6（2026-10-19）
- **层间对齐 / 角落凸起修复**：v1.0.5 `neighborImpulse` 连射叠乘导致 idle 墙面波浪与左下凸起；默认强度改为 **0**（对齐参考：邻块不位移），存活体素 rest = `worldOf(i,j,k)` + scale(1,1,1)
- 若手动开启邻块 FX：每格最多 1 条 wobble、总数≤48、短峰后硬回 identity，禁止残差
- 保留 shootableAt / 本格果冻消除 / 碎屑 / bob / 材质；`SETTINGS_VERSION` 6
- `test:logic` / `test:clip` PASS；Pages 发布

## v1.0.5（2026-10-19）
- **邻块果冻挤动**：命中消除时半径内邻块径向位移 + 挤压鼓包（`neighborImpulse`/`neighborRadius`/`neighborDur`），~150–300ms 回弹；仅视觉，不改 `shootableAt`
- 保留命中格果冻碎裂 + 球 flash 消失；`SETTINGS_VERSION` 5
- `test:logic` / `test:clip` PASS；Pages 发布

# 进度

## v1.0.4（2026-10-19）
- **正面可打**：`shootableAt`（k===0 或 k-1 空）；顶/侧/背 alone 不算；`exposedAt` 仅渲染
- **命中 FX**：果冻挤压→拉长→碎裂；同色软糖碎屑×12；子弹命中即 flash 消失
- **材质**：方块圆角 0.26 / 缎面 rough 0.52；珍珠白珠 glow+halo；顶光+侧暗 AO
- `test:logic` / `test:clip` PASS；Pages 发布

## v1.0.3（2026-10-19）
- **命中规则重释**：去掉 front-wall-only；任一面 `exposedAt` 可打；恢复隧道 LOS；一发一格
- **呼吸**：仅槽位 + 队列 row0（用户红圈前两行）；后排静止（非整列）
- **果冻消除** + 更密同色碎屑；白球半透明软光泽；炮台描边加厚；vox/tank 分粗糙度
- `test:logic` / `test:clip` PASS；Pages 发布

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
