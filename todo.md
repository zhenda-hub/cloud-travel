# TODO · 云旅游 3D 天坛（结构优先重构）

> 创建于 2026-10-04
> 目标：做出**结构好**的天坛祈年殿 3D 模型（不是"电影感"，是结构本身经得起看）

---

## 一、结论先行

**天坛的结构问题，靠 AI 图生 3D 解决不了。**

已试过并确认的天花板：

| 路线 | 结果 | 结论 |
|---|---|---|
| Lux3D 文生 3D（Turbo） | 底座歪、无檐下结构 | 概念化，只有轮廓 |
| Lux3D 图生 3D（G1） | 目前最好，但檐下斗栱仍糊 | AI 的天花板 |
| Pixal3D | 补了底座，但整体模糊 | 见下方"分辨率陷阱" |
| TRELLIS.2 | 补了底座，彩画可辨 | 慢（18 min） |
| Hunyuan3D | 只出几何、无纹理、底座乱 | 弃用 |
| TripoSplat（高斯泼溅） | 视觉好、但不是网格 | 弃用 |

**根因**：照片只给**外观**（颜色、材质、大致轮廓）。斗栱怎么叠、柱网怎么排、平座怎么接、背面/内部什么样 —— 这些是**建筑知识**，照片里根本没有。AI 只能"猜"，所以永远糊、永远缺结构。

**⇒ 想要结构好，只能自己建。**

---

## 二、参照项目（huangbai-AI/yingxian-pagoda「应县木塔 · 一木千年」）

https://github.com/huangbai-AI/yingxian-pagoda

### 为什么它结构好 —— 三条硬证据

1. **用的是真实尺寸数据**（`model/模型信息.json`）
   ```json
   { "height_m": 67.31, "base_body_diameter_m": 30.27,
     "mesh_objects": 255, "level_groups": 7,
     "vertices": 609508, "polygons_before_modifiers": 351958 }
   ```
   → 应县木塔真实高 67.31 m、底径 30.27 m。**照着文物测数建的，不是从照片猜的。**

2. **模型是 Python 脚本分层生成的**（`model/重建模型.py`，23783 字符）
   - 7 个楼层：`00 石砌台基` / `01 首层与副阶周匝` / `02 第二明层与暗层` / … / `06 攒尖顶与铁刹`
   - 自写几何基元：`box()` `rod()` `beam()` `octa()` `ring_beams()`
   - **斗栱是单独一个参数化函数**：
     ```python
     def bracket(i, p, angle, s):
         def block(...)   # 斗
         def gong(...)    # 拱："Continuous shaped underside; broad bearing tops and curved bracket arms"
     ```
     注释原话：`One repeating, connected teaching assembly; used identically in the tower and close view`
   - 按 **8 重对称**（`k*math.pi/4`）在每个柱头复用

3. **材质是真的**
   ```python
   mat('古木') mat('朱漆') mat('浅木') mat('暗木') mat('青灰瓦') mat('瓦脊')
   mat('石台') mat('灰缝') mat('土朱墙') mat('鎏金') mat('铁刹') mat('彩画青') mat('彩画土黄')
   model/材质/古木纹理.png   # 真实木纹贴图 + bump（Poly Haven，CC0）
   ```

### 它的其他技术点（**本项目不追求，仅备查**）

- 后处理链（`src/cinema.js`）：`GTAOPass` + `BokehPass`(景深) + 自写 glow + `FXAA` + `OutputPass`
- 光照：`environmentIntensity = .22`（很低）+ `DirectionalLight(0xffd39a, 5.8)`（暖色强主光）+ `VSMShadowMap`
- 环境（`src/environment.js`）：6000 块实例化石板铺地 + 22 棵 billboard 松树 + 距离淡出
- 栈：`three 0.180` + `vite 7` + `gsap/ScrollTrigger` + `lenis` + `gltf-transform`/`draco`/`meshopt`
- 六幕滚动分镜

> ⚠️ 用户明确说：**不追求电影感，要的是结构好。**

---

## 三、方案：Blender + Python 参数化重建天坛

**three.js 程序化版已试过并删除（见 §七），改走 Blender。**

| | 已弃用的代码版（three.js） | 应走的路线（Blender） |
|---|---|---|
| 在哪建 | 浏览器里跑 | 离线跑 |
| 怎么建 | JS 手写几何 | **Python 脚本参数化** |
| 尺寸依据 | 拍脑袋 | **真实测数** |
| 能力 | 只能拼基本体 | 倒角/细分/布尔/贴图烘焙/法线 |
| 斗栱 | 96 个小方块 | **`bracket()` 函数** |
| 迭代 | 改一次刷一次 | 逐层精修 |

方向是对的（程序化生成），**但工具和深度都不对**。

---

## 四、执行清单

### 阶段 0 · 资料（先做，不然尺寸全靠猜）

- [ ] 查祈年殿真实尺寸：面阔/柱高/檐出/斗栱层数/宝顶高度/台基三层直径与高度
- [ ] 查祈年殿结构：檐柱 12 根、金柱 12 根、龙井柱 4 根（共 28 根）的排布
- [ ] 查三层檐的出檐比例、"反宇"曲线特征
- [ ] 记录来源（作为脚本里的常量注释）

### 阶段 1 · 脚本骨架 + 台基

- [ ] 建 `model/重建天坛.py`，仿 `重建模型.py` 的结构：
  - 分层 collection（`00 三层圆台基` / `01 柱网` / `02 斗栱` / `03 三檐` / `04 宝顶`）
  - 几何基元：`box()` `rod()` `beam()` `ring()` `lathe_profile()`
  - 材质表（汉白玉/琉璃蓝/朱红/鎏金/彩画青绿…）
- [ ] 三层圆形台基（直径递减）
- [ ] **栏板 + 望柱**（沿圆周阵列，注意间距按真实栏杆数）
- [ ] **螭首**（排水兽头，台基外沿一圈）
- [ ] 四面台阶 + 御路 + 台阶栏杆

### 阶段 2 · 柱网

- [ ] 檐柱 12 根（外圈）
- [ ] 金柱 12 根（内圈）
- [ ] 龙井柱 4 根（中心，直通顶部）
- [ ] 柱础（石鼓）
- [ ] 额枋（柱头之间的横梁）

### 阶段 3 · 斗栱（**最关键，决定"结构感"**）

- [ ] 写 `bracket(level, radius, angle, scale)` 参数化函数
  - `block()` 斗
  - `gong()` 拱（连续底面 + 承托顶面 + 曲线拱臂）
  - `ang()` 昂（斜挑）
- [ ] 按真实斗栱层数逐层复用（檐下、平座下）
- [ ] 每层斗栱与柱网的对应关系

### 阶段 4 · 三层檐

- [ ] 屋顶剖面曲线（檐口翘起 + 反宇）
- [ ] **瓦垄**（沿径向的起伏，用真实几何而非 shader）
- [ ] **垂脊 + 脊兽**（圆形攒尖的放射脊线）
- [ ] 檐口**瓦当/滴水**（一圈）
- [ ] 檐下**彩画带**（青绿彩绘）

### 阶段 5 · 宝顶 + 匾额

- [ ] 宝顶（多层叠珠 + 金顶）
- [ ] 匾额（"祈年殿"，蓝底金字）

### 阶段 6 · 材质

- [ ] 汉白玉（真实石纹贴图 + 法线）
- [ ] 琉璃瓦（蓝色釉面 + 瓦垄法线）
- [ ] 朱红木柱（木纹 + 漆面）
- [ ] 彩画（青绿彩绘贴图或程序化）
- [ ] 鎏金（金属度/粗糙度）

### 阶段 7 · 导出与上线

- [ ] 导出 GLB（用 `@gltf-transform` + Draco 压缩）
- [ ] 接进 `3d.html` 作为新标签（或替换掉不理想的 AI 版本）
- [ ] 给资源 URL 加版本号（见"踩坑"）
- [ ] 提交推送（**需用户明确说"提交"**）

---

## 五、现状盘点（截至 2026-10-04 23:00）

### 项目位置
```
~/ME/repos/github_repo/cloud-travel/          # Windows 下即 <用户目录>\ME\repos\github_repo\cloud-travel
```

### 页面
| 文件 | 内容 |
|---|---|
| `index.html` | 首页 |
| `3d.html` | 3D 云游 —— **2 个标签**：天坛祈年殿（Lux3D G1）/ 日月潭 |

### 模型（2 个，共约 40 MB）
| 文件 | 体积 | 评价 |
|---|---|---|
| `temple-lux3d-g1.glb` | 20.0 MB | 天坛祈年殿。**目前结构最好**（299,051 面） |
| `sun-moon-lake.glb` | 20.3 MB | 日月潭 |

2026-10-05 删除的对比模型（已归档到仓库外 `C:\Users\zzd\lux3d-output\removed-20261005\`）：
`temple_of_heaven.glb` / `temple-pixal3d.glb` / `temple-pixal3d-level.glb` /
`temple-trellis2.glb` / `temple-trellis2-level.glb`
→ AI 图生 3D 结构达不到目标，不在站点保留。

### git
**已提交** `efe3acf`（天坛模型改用 Lux3D G1 版，模型精简为 2 个），工作区干净。
⚠️ **尚未 push** —— 线上 GitHub Pages 仍是旧版。

### 本地服务
- `http://127.0.0.1:8765/` —— 云旅游静态站（`python -m http.server`）
- `http://127.0.0.1:8188/` —— ComfyUI
- `http://127.0.0.1:18080/v1` —— 本地识图（llama-server，Qwen3.5-9B + mmproj）

---

## 六、踩坑备忘（别重复踩）

### ① 分辨率陷阱（AI 图生 3D 模糊的真正原因）
Pixal3D/TRELLIS.2 的输入被**强制成 1024×1024 正方形**。若主体是横条（如 2.95:1），塞进方框后：
```
实测：模型输入 1024×1024，其中主体只占 932×317 px
      （天坛本体仅约 262×199 px）
```
→ 不是模型不行，是**信息量被输入格式吃掉了**。
**教训：参考图里主体要接近方形、占满画幅。**

### ② 去背景会吃掉浅色台基
BiRefNet 把**汉白玉台基当"地面/背景"删掉**（试了 3 次，紧裁方图也一样）。
- 去背景 → 底座被切掉
- 不去背景 → 底座变成乱刺（"地面"被当几何生成）
**教训：这个题材必须用「自绘遮罩」绕开，或干脆别用 AI 路径。**

### ③ 多视图 rig 是死约束
`Pixal3DMultiViewConditioning` 的方位角写死 `front:0 / left:90 / back:180 / right:270`，且要求**同一尺度、同一 FOV、仰角 0**。
- 节点本身支持 ≥1 张（第一张当正面）
- 但给两张"都是正面"的图会被扭坏
- 工作流 `3d_pixal3d_multi_views` 走的是「一张转盘图 → `ImageCropV2` 切 4 格」，**需自备四视图转盘图**
- ⚠️ 多视图权重 `pixal3d_multiview_int8_convrot.safetensors`(5.3 GB) **已下载**

### ④ `python -m http.server` 不发缓存头 → 改了看不到
响应头只有 `Last-Modified`，没有 `Cache-Control`/`ETag` → 浏览器长期复用旧 JS。
**解法：给资源 URL 加版本号**（现为 `?v=20261004d`，在 `3d.html` 的 css/js 引用上）。
HTML 本身也需**硬刷新一次**（`Ctrl+Shift+R`）或带 `?fresh=1` 打开。

### ⑤ Blender headless 使用要点
```bash
BL="C:/Program Files/Blender Foundation/Blender 5.2/blender.exe"
"$BL" --background --factory-startup --python <script.py> -- <args>
```
- 脚本里用 `sys.argv[sys.argv.index("--")+1:]` 取自定义参数
- 5.2 渲染引擎标识是 `BLENDER_EEVEE`（不是 `_NEXT`）
- 导出顶点色要**平滑着色**（否则按面拆点，顶点数翻 8 倍）；`BYTE_COLOR` 比 `FLOAT_COLOR` 小 3/4

### ⑥ ComfyUI 相关
- 输入目录：`~/Documents/ComfyUI/input`（**不是** ComfyUI 安装目录下的 input）
- 纹理分辨率 4096 会 **OOM**（TRELLIS.2 实测爆到 26 GiB）→ 用 2048
- `DecimateMesh.target_face_count` 默认 700000 太保守 → 调 150000 体积降 2~5 倍

---

## 七、明确不做

- ❌ **不追求电影感**（GTAO/景深/glow/滚动分镜）—— 用户明确说不需要
- ❌ **不再折腾 AI 图生 3D 的结构**（已到天花板）
- ❌ **Hunyuan3D 与高斯泼溅**（已弃用并清理）
- ❌ **three.js 程序化代码版**（`3d-code.html` + `js/temple-code.js` + `js/temple-shaders.js`，2026-10-05 删除）
- ❌ **不碰 git 写操作**（除非用户明确说"提交"）

---

## 八、下一步（从这里继续）

1. **先做阶段 0** —— 查祈年殿真实尺寸
2. 然后写 `model/重建天坛.py` 第一版：**台基 + 柱网 + 斗栱**（先看结构感出不出来）
3. 满意了再往上做三檐、宝顶、材质
