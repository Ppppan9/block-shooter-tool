# 动画 / 模型审计（对照 ref.mp4 逐帧 + ANALYSIS.md）

审计对象：`block-shooter-tool` v1.0.0→v1.0.1；参考 `ref/frames/f0001–f0545`、`shooters_*.jpg`、`balls_*.jpg`、`ball_consec.png`、`empty_47.jpg`、`screenshots/ref_vs_tool.jpg`、`mid_ref_*.png`、`tool_*.png`。

判定：PASS = 与参考一致或可接受；GAP = 风格/精度差距（不阻塞）；BUG = 玩法/可视错误（应修）。

---

## 1. 模型（体素 / 炮台 / 相机 / 底座）

| 项 | 判定 | 证据 | 严重度 | 建议 |
|---|---|---|---|---|
| 体素圆角方块 + 配色紫/绿/黑/黄 | PASS | `scene3d.js` RoundedBox + `PALETTE`；`settings` col_* 默认接近参考 | — | — |
| 体素尺寸 / 31 列 / 绿菱形+中线 | PASS/GAP | `level.js` `refVolume`；顶面菱形在工具里略偏「三角/漏斗」观感（`ref_vs_tool` 0s 列） | 低 | 可选微调 rx/rz 或凸起密度 |
| 相机长焦俯视 | PASS | `world.js` + `cam3dFov≈3.35` 拟合 ANALYSIS | — | — |
| 品红底座 | PASS | `scene3d.js` base；参考亦有粉托边 | — | — |
| 炮台：履带×2+车身+圆顶+短炮管+数字 | PASS | `makeShooter` 六件套；`shooters_a.jpg` / f0001 对照形状接近卡通坦克 | — | — |
| 炮台描边 / 后排数字半透明 | PASS | `outline3d`、`numBackOpacity=0.45` | — | — |
| 槽位白圆盘 ×5、队列 6 列 | PASS | `REF_SLOTS` / `REF_FRONT`；ANALYSIS 核实 | — | — |
| 手指默认麻将手图 | PASS | `default_hand.js` + hideCursor；规范要求（参考视频手为另一套卡通手 → 属规范优先） | — | GAP 仅相对参考素材 |

## 2. 交互动画（点击 → 进槽 / 队列前移 / 手按下）

| 项 | 判定 | 证据 | 严重度 | 建议 |
|---|---|---|---|---|
| 点击队首 → 最左空槽跳跃 | PASS | `tapShooter` + `shooterWorld` jump，`jumpDur`/`jumpHeight` | — | — |
| 队列后排前移 | PASS | `advanceDur`，起跳后再前移 | — | — |
| 手按下缩小 | PASS | `pressEnabled` / `hand.press` | — | — |
| 点击涟漪 | PASS/GAP | 工具有白圈 ripple；参考较弱 | 低 | 可关 `tapRipple` |
| 时序黄→黑→绿进槽 | PASS | `refOpening` + ANALYSIS 0.4/1.2/2.0s | — | — |

## 3. 消除动画（命中缩方块 / 碎屑）

| 项 | 判定 | 证据 | 严重度 | 建议 |
|---|---|---|---|---|
| 命中后体素缩小消失 | PASS | `G.pops` + `popDur`，`voxGroups` 缩放 | — | — |
| 同色碎屑弹出 | PASS | `debrisCount`/`G.debris`；`ball_consec.png` 参考亦有紫屑 | — | — |
| 碎屑量/停留 | GAP | 参考碎屑云更浓；工具默认 2 颗 / 500ms | 低 | 可调 `debrisCount` |

## 4. 子弹动画（发射 / 弹道 / 弹开 / 淡出）

| 项 | 判定 | 证据 | 严重度 | 建议 |
|---|---|---|---|---|
| 白球 + 射速 ≈12/s | PASS | `ball` mesh、`fireRate=12`；`balls_33.jpg` 珠链 | — | — |
| 命中后弹开+重力+淡出 | PASS | `ph:'bounce'`、`ballLife`；参考 `balls_33` / `ball_consec` | — | — |
| 弹道避障（不穿模） | PASS | `pickTargetLOS` + `sphereHitsVox`；`test:clip` | — | — |
| 球半径观感 | GAP | 参考球略大/更亮；工具 `ballR=0.3` | 低 | 可调大或加自发光 |

## 5. 离场（弹药打光）

| 项 | 判定 | 证据 | 严重度 | 建议 |
|---|---|---|---|---|
| 缩小平移离场、槽位空出 | PASS | `leave` 状态 + `leaveDur`；`empty_47.jpg` 参考 0→消失 | — | — |

## 6. 其他 / 规则

| 项 | 判定 | 证据 | 严重度 | 建议 |
|---|---|---|---|---|
| **仅正面朝向炮台可打** | **BUG→FIXED (v1.0.1)** | 旧：`exposedAt` 任一面外露即可打 + `pickTargetLOS` 隧道/竖井可打内腔。用户要求：只打靠近炮台一侧正面（`k===0` 或 `k-1` 空）。 | **高** | 见下「已修」 |
| 无目标时等待（黄等黑开） | PASS | `fireNext` 等待；正面规则下开局黑/黄 `availCount=0` | — | — |
| 参考 ~14s 黑线 | NOTE | `f0140` 仍见绿沿中线坑射击；黑顶面线在正面开路后才可打（与用户正面规则一致）。若参考曾「俯射顶面黑」，属参考表现与用户规则差异，以用户规则为准。 | — | 记录 |
| 胜负画面 | GAP | 参考 54s 未通关无胜负页；工具有通关/失败 UI | 低 | 可选关 |

---

## 已修（v1.0.1）

1. **`level.js`**：新增 `frontExposedAt` / `isFrontTarget`；`availCount` / `pickTarget` 只计正面可打；`exposedAt` 仍用于渲染外露面。
2. **`main.js` `pickTargetLOS`**：候选过滤 `isFrontTarget`；删除沿法线「隧道/竖井」钻入内腔的弹道；命中点优先正面法线。
3. **`pickTarget`**：稳定序 `(k,j,i)`，避免生成器与模拟因炮位距离选不同列导致可解性分叉。
4. **`simulate` / `nextAuto`**：进槽前要求 `availCount >= ammo`；计划关正面不足且槽空时回退动态选色。
5. **`test/logic-test.mjs`**：开局黑/黄不可打、清中线绿后黑可打等断言；随机关 `parallel` 与生成器一致。

---

## 严重度排序（修复后剩余）

1. ~~正面可打规则错误（高）~~ → 已修  
2. 碎屑/球尺寸等表现 GAP（低）— 风格项，不打包强制  
3. 绿顶面菱形轮廓略偏（低）  
4. 手指资产与参考不同（规范优先麻将手，非 bug）

## 截图

- 既有：`screenshots/ref_vs_tool.jpg`、`mid_ref_{3,12,25}s.png`、`tool_{0,2,14,20,30}s.png`、`mid_game.png`
- 审计补拍：`screenshots/audit_mid_flight.png`（若本会话生成）


---

## v1.0.2 表现核对（2026-10-19）

| 项 | 判定 | 证据 |
|---|---|---|
| 备选队列呼吸起伏 | PASS | ref 紫列 ~16 帧/周期≈0.53s、振幅≈2px；工具 `bobPeriod=550`、`bobAmp=0.1`，相位按 id；截图 `queue_bob_a/b.png` |
| 射击车身+炮塔转向 | PASS | ref f90–f210 绿灯槽：履带底盘与炮塔同向目标；工具 `body`/`upper` 独立 yaw，炮塔可 `turretExtra` 超前；`aim_yaw_fire.png` |
| 碎屑更浓 | PASS | `debrisCount` 默认 5，寿命 750ms；`audit_mid_flight.png` |
| 白球略亮/光晕 | PASS | `ballGlow=0.55` + halo；物理 `ballR` 仍 0.3 |
| 正面可打 | PASS | 保持 v1.0.1 |

剩余 GAP：绿顶面菱形轮廓略偏；手指资产≠参考卡通手（规范优先麻将手）；槽位炮台不呼吸（参考亦基本静止，仅后坐）；弹道口不随 yaw 偏转（视觉转、弹道仍中心炮口，避免穿模）。
