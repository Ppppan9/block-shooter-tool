# 方块射击 · 3D 动画导出（glTF / FBX / Blender，支持 UE5 / C4D）— v1.0

| 文件 | 内容 |
|---|---|
| `scene.glb` | glTF 2.0 场景 + 动画。**3D 模型与网页 3D 渲染是同一套 three.js 模型**（品红圆角底座、白色槽位、圆角体素方块、履带炮台：track_L/track_R/hull/turret/barrel/label、小球、碎屑），每帧烘焙每个节点的位置 / 旋转 / 缩放 |
| `scene.fbx` | 由 Blender 无头转换（`npm run test:3d` 自动生成并放入 zip；也可自己运行 `blender --background --python blender_import.py -- --fbx`） |
| `scene3d.json` | 帧率、帧范围、透视相机（yfov / 位置 / 目标）、灯光（太阳 + 环境）、节点清单（入/出点、方块格坐标）、不透明度曲线、音频事件、体素网格 |
| `blender_import.py` | Blender 4.x：导入 glb、设透视相机 / 分辨率 / 色彩 / 太阳光 + 环境光、不透明度曲线、音频序列，可选导出 FBX / 渲染校验帧 |
| `timeline.json` | 与 AE 导出相同的时间轴（英文命名、逐帧烘焙） |
| `audio/` | `mix.wav` + `sfx_*.wav` |

结构：`block_root`（缩放 0.1：场景单位 → 米，Y 轴向上）
- `static_scene`：`base`（底座）、`slot_1..5`（槽位，不动）
- `voxels`：每个方块一个节点 `vox_<颜色>_<列i>_<层j>_<深k>`，被打掉时缩放关键帧 1 → 0（与 AE 的 方块_* 图层同一集合）
- `dynamic_3d`：`<id>_vis`（缩放 1/0 = 显示/隐藏，STEP）→ `<id>`（shooter_NNN / ball_N / debris_N）→ 子网格；炮台 `label` 下每个出现过的数字一个平面 `shooter_NNN_num_<n>`（STEP 缩放切换）
- `camera_persp`：与网页 3D 渲染同 FOV / 位置 / 朝向（拟合参考视频）；2D 叠加层（背景、免责声明、通关文字、结束页、手指）作为贴图平面挂在相机下（`<名>_vis → <名> → <名>_q`），与网页同位置同大小
- `sun_light`：方向光（高度角 / 方位角 = 设置“3D 渲染”）；环境光强度写在 scene3d.json，Blender 脚本设为世界背景
材质：3D 模型为 PBR（`pbr_*`），叠加层 / 数字为无光照贴图（`mat_*`）。
UE5：导入 scene.fbx 或 scene.glb（Interchange），动画为每节点的变换轨道；C4D：导入 scene.fbx。
校验：`npm run test:3d` 用 Blender Cycles 渲染 6 个时刻并与网页 3D 画面比较（PSNR ≥ 18 dB）。
