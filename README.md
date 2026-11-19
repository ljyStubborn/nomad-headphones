# NOMAD 01

一个滚动驱动的耳机产品页，使用 Vite、原生 ES 模块、three.js 与 GSAP ScrollTrigger。页面文案为简体中文。

`public/models` 里的模型由 Blender 的 Python API 生成：20 个零件、102k 三角面、4 个 PBR 材质、无贴图。

## 运行

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # dist/
npm run preview
```

## 工作方式

### 一块画布，一条时间轴

`#scene` 是固定定位、透明的 canvas，铺在整篇文档后面；页面本身是普通 HTML，在上层滚动。

相机不是按像素滚动驱动的。`main.js` 先测量每个章节在文档中的位置（`measure()`），把滚动换算成**胶片位置**：0 到 4 的小数，代表当前停留在哪两个章节之间。

```
首屏 (0) → 拆解 (1) → 折叠 (2) → 配色 (3) → 预约 (4)
```

`scene.js` 为每个章节保存一组机位（`SECTIONS`），用 smoothstep 在相邻两组之间插值。因为机位锚的是章节位置而不是固定百分比，文案变长、视口变化、字体回流都不会让镜头错位。

### 机位参数

| 字段 | 含义 |
|---|---|
| `az` / `el` | 相机环绕角度（度） |
| `zoom` | 取景距离倍数，1 表示刚好装下整机 |
| `pan` | 水平偏移（米），正值把产品推向画面右侧 |
| `focus` | 相机对准的世界坐标，用于细节特写 |
| `explode` / `fold` | 0 到 1 的机械状态 |

`fit()` 根据包围盒和当前宽高比实时算出「装下整机」的距离，所以任意屏幕尺寸都不会跑出画面。窄屏时水平偏移会被淡出，产品自动抬到文案上方（`placeCamera`）。

### 机械状态

- **爆炸**：18 个具名零件沿各自的世界方向平移（`EXPLODE`），只有杯体外壳不动。
- **折叠**：两侧铰链绕竖直轴各转 88°，滑轨缩回 20 mm。因为杯体、耳垫、网罩、插孔在 glTF 层级里都是铰链的子节点，它们会自动跟随。

两者都在 `applyPose()` 里基于缓存的静止姿态计算，可以逐帧来回，不会累积误差。

### 零件命名约定

场景按名字取件。换模型时这些名字必须保留：

```
Headband, HeadbandPad,
Slider_L/R, Hinge_L/R, Yoke_L/R, CupMount_L/R,
Cup_L/R, Cushion_L/R, Grille_L/R, Button_L/R, Jack_L/R
```

材质同样按名字查找：`M_Aluminum_Anodized`、`M_Steel_Brushed`、`M_Plastic_Matte`、`M_Leather`。配色按钮在运行时改写它们的颜色、金属度和粗糙度。

## 文件

```
index.html            结构，全部中文文案
src/styles.css        设计令牌、栅格、预约表单、响应式
src/main.js           加载器、滚动到胶片位置的映射、入场动画、配色、表单
src/scene.js          渲染器、灯光、模型、机位、标签
public/models/        nomad.glb（Draco，266 KB）与 nomad-plain.glb（兜底）
public/draco/         压缩模型的解码器
public/fonts/         自托管的 Geist 与 Geist Mono
public/poster.png     WebGL 不可用时的静态图
```

## 设计约定

单一深色主题，单一强调色，圆角统一为 0。

```
--bg      #0a0b0c     --fg     #e9e9e6
--muted   #8b8d8f     --accent #9fd7e8
```

西文用 Geist，等宽数字与标签用 Geist Mono。中文没有单独加载字体，回落到系统黑体（`PingFang SC` / `Microsoft YaHei` / `Noto Sans SC`），避免引入 5 MB 级的中文字体包。中文字距用 `0.01em`，行高 1.75 到 1.85。

## 可用性与降级

- `prefers-reduced-motion`：相机停在首屏机位，入场动画取消。
- 无 WebGL：给 `body` 加 `no-webgl`，显示 `poster.png` 代替画布。
- Draco 模型加载失败：自动改用 `nomad-plain.glb`。
- 预约表单只做前端校验，提交后显示状态文案，不发送任何请求。
- 所有可交互元素都有可见的焦点环。

## 已知缺口

1. 3D 场景做过数值验证（取景、层级、材质），但当前环境无法启动浏览器，**没有用眼睛看过实际渲染**。上线前请在浏览器里过一遍。
2. 细节特写只拍右耳罩，网罩后面没有单元与腔体几何。
3. 模型没有 UV，想加 logo 或材质贴图需要重新展 UV。
4. 752 KB JS（gzip 206 KB）里大部分是 three.js。生产环境应把场景拆成动态 import，等首屏绘制完再加载。

## 文案

所有文案都是概念产品的占位内容。页脚已注明并非真实商品，预约表单不会发送邮件。
