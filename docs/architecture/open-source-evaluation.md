# HTML Edit 开源候选深度评估

> 状态：技术架构执行规范 v2 的组成部分  
> 日期：2026-08-25  
> 主索引：[`technical-architecture.md`](technical-architecture.md)

## 4. 开源候选深度评估

## 4.1 OpenPencil

### 已确认能力

OpenPencil 当前采用 Vue 3、CanvasKit（Skia WASM）、Yoga WASM 和 Tauri；其代码明确拆分为：

- `scene-graph`：节点、命中测试、复制、吸附、撤销；
- `pen`：`.pen` 文档模型和导入；
- `kiwi` / `fig`：Figma `.fig`；
- `core`：CanvasKit 渲染、布局和工具；
- `dom-css`：HTML/CSS/Tailwind 投影；
- `vue`：无头编辑 SDK；
- `cli` / `mcp`：命令行和 Agent 工具。

OpenPencil 还支持 `.fig`、`.pen`、HTML/CSS 导入导出、CLI、MCP 和机器可读输出，且项目采用 MIT 许可证并处于活跃开发阶段。[R1][R2]

### 与 HTML Edit 的根本错位

OpenPencil 的核心明确“让浏览器 DOM 远离 core”，画面由 CanvasKit SceneGraph 渲染。HTML/CSS 通过 `dom-css` 适配器投影为设计节点。[R2]

HTML Edit 的核心恰好相反：

```text
编辑画面
= 真实 DOM
= 浏览器实际布局结果
= 用户最终运行对象
```

因此 Fork OpenPencil 后，必须重写或替换：

- CanvasKit renderer；
- Yoga 布局主导关系；
- SceneGraph 与 DOM 的身份关系；
- 文本布局和字体测量；
- CSS cascade；
- JavaScript 运行；
- HTML 源码回写；
- 时间线与媒体模型。

这已经不是二次开发，而是保留外壳后更换发动机。

### 最终使用方式

| 方式 | 决策 |
|---|---|
| Fork 整个 OpenPencil | 禁止 |
| 以 `@open-pencil/core` 为编辑内核 | 禁止 |
| 直接用 CanvasKit SceneGraph 替代 DOM | 禁止 |
| 研究其包边界、SceneGraph、CLI/MCP | 推荐 |
| 参考其虚拟化 Layers、格式 Adapter、机器可读命令 | 推荐 |
| 后期开发 `.pen` / OpenPencil Adapter | 推荐，MVP 后 |
| 直接依赖 `scene-graph` | 仅允许 Sprint 0 做隔离 PoC，默认不进入生产依赖 |

### 允许借鉴的具体功能

1. **包边界**：SceneGraph、格式适配器、渲染器、CLI、MCP 分层；
2. **稳定节点与可查询树**：用于设计 HE Project Graph；
3. **格式适配器**：`.fig/.pen/HTML` 均通过 Adapter 进入统一模型；
4. **Agent 工具设计**：同一工具可控制运行中的 App 或头部模式；
5. **机器可读输出**：所有 CLI 命令提供 JSON；
6. **文件访问范围**：Agent/MCP 只能操作允许的项目根目录；
7. **大型 Layers 虚拟化**：用于数千节点的图层面板。

### 明确不借鉴

- CanvasKit 作为 HTML Edit 主画布；
- Yoga 作为外部 HTML 的权威布局器；
- Figma 字段或 `.fig` 元数据进入 HE Core；
- OpenPencil SceneNode 成为 HTML Edit 原生节点；
- AI 聊天先于人工闭环。

---

## 4.2 GrapesJS

GrapesJS 是成熟的 HTML 模板和 Web Builder 框架，具备 Component、Block、Style Manager、Layer Manager、Command、Plugin 和 iframe Canvas 等能力，采用 BSD-3-Clause 许可证。

其官方文档明确规定：

> Component/Model 是最终模板代码的 Source of Truth，Canvas View 只是该模型的预览。[R3]

这与 HTML Edit 的外部源码保真目标冲突。若直接采用 GrapesJS：

```text
现有 HTML
→ GrapesJS Component Model
→ 用户编辑
→ 重新生成 HTML
```

原始格式、注释、未知脚本关系和局部源码结构很难保持。

### 决策

- 不作为产品底座；
- 不使用 GrapesJS Project JSON 作为 HE 格式；
- 参考其 Component Model/View 分层；
- 参考其 iframe Canvas、Plugin、Style Manager 和 Layer Manager UX；
- 将 GrapesJS 的 HTML 解析结果作为外部对照测试，不进入生产持久层。

---

## 4.3 Webstudio

Webstudio 是面向真实 CSS 和响应式网页的可视化 Builder，CSS Inspector、设计 Token、响应式状态和组件化体验值得参考。

但其核心采用 AGPL-3.0-or-later，官方仓库还明确指出可选 Animation 包使用专有许可证。[R4]

### 决策

- 不 Fork；
- 不引入其核心代码作为商业产品依赖，除非未来完成独立法律评估；
- 只参考：
  - CSS 来源与优先级可视化；
  - 响应式断点 UX；
  - Token 与变量 UI；
  - Flex/Grid 属性分组；
  - 可访问性和语义化组件思路。

---

## 4.4 Puck

Puck 是 MIT 许可的 React 可视化编辑器，核心模式是：

```text
组件配置 + 字段 Schema + JSON Data
→ React Render
```

它非常适合“已知 React 组件库的页面编排”，但不适合任意外部 HTML 源码级双向编辑。[R5]

### 决策

- 不作为核心；
- 借鉴“组件注册表 + 字段 Schema + 自定义 Inspector”；
- 后期为受支持自定义组件建立 `ComponentAdapter` 时，可参考 Puck 的 Config/Field 模式；
- 不将 React Component Data 设为网页统一格式。

---

## 4.5 Moveable、Selecto、Guides、InfiniteViewer

### Moveable

Moveable 提供 Drag、Resize、Scale、Rotate、Group、Snap、Warp 等交互，适合作为 Overlay 变换控件。

### Selecto

Selecto 提供鼠标/触摸框选和多选。其官方文档指出默认依赖 `getBoundingClientRect()`，对旋转或扭曲对象不够准确，并建议结合 Moveable 的几何信息。[R6]

### 决策

- `Moveable`：**直接依赖**；
- `Selecto`：**直接依赖**；
- `Guides`：Sprint 0 验证后可直接依赖；
- `InfiniteViewer`：仅在普通 iframe 缩放/滚动无法满足 UX 时引入；
- 不允许 Moveable/Selecto 决定语义选择结果；
- 它们只消费自研 Selection Core 已确定的 `targetId` 和几何信息。

固定流程：

```text
Pointer
→ 自研 Hit Test
→ SelectionCandidateStack
→ Semantic Ranker
→ primary targetId
→ Moveable / Selecto Overlay
→ Preview Command
→ Commit Transaction
```

---

## 4.6 Scena、Scene.js、Scene.js Timeline

Scena 将 Scene.js、Moveable、Selecto、InfiniteViewer、Guides 和 Timeline 组合成动画编辑器，采用 MIT 许可证。[R7]

它非常接近 HTML Edit 的表面形态，但其核心时间线仍围绕 Scene.js 的 CSS 属性和选择器模型。仓库公开问题也显示整体工程集成和维护稳定性需要谨慎评估。

### 决策

- 不 Fork Scena；
- 不采用 Scene.js 项目数据作为 HE Timeline；
- 不让 Scene.js 选择器成为持久对象身份；
- 参考：
  - 时间线与画布联动；
  - 属性轨道展开；
  - Playhead、缩放、关键帧交互；
  - Moveable 变换录制为关键帧；
  - Guides/InfiniteViewer 组合方式。
- Scene.js 可以在隔离 PoC 中作为播放后端对照，但不得成为 canonical runtime。

---

## 4.7 Theatre.js

Theatre.js 的 Core 采用 Apache-2.0，而用于编辑动画的 Studio 采用 AGPL-3.0。[R8]

其关键帧、序列、曲线编辑和属性面板体验值得研究，但直接嵌入 Studio 会引入许可证与数据模型锁定；其程序化关键帧写入能力也不等同于一个完整自定义时间线内核。

### 决策

- 不引入 Theatre Studio；
- 可以参考曲线编辑器、序列导航和属性组织；
- 如后期只使用 Apache Core，也必须通过 Adapter，不能把 Theatre 项目格式设为 HE 格式。

---

## 4.8 tldraw、Excalidraw、Penpot、Konva、Fabric.js

| 项目 | 有价值部分 | 不适合作为核心的原因 | 使用方式 |
|---|---|---|---|
| tldraw | 无限画布、快捷键、Selection UX、Store 思路 | 当前生产使用存在专门许可证要求；白板模型不是 DOM | UX 参考 |
| Excalidraw | 简洁 JSON 场景、Undo、导入导出、低学习成本 | Canvas 白板，不处理 CSS/DOM | Agent 友好格式和交互参考 |
| Penpot | Flex/Grid、开放设计系统、组件、插件/API | 静态设计工具技术栈庞大，非真实 DOM 源码编辑 | 布局 Inspector 参考 |
| Konva | Canvas SceneGraph、事件、变换、导出 | Canvas 与真实 HTML 目标冲突 | 仅用于未来原子 Canvas 节点 |
| Fabric.js | Canvas 对象、选择、变换、JSON/SVG | 同上 | 不进入核心 |

---

## 4.9 Remotion、FFmpeg、HyperFrames

### Remotion

Remotion 适合通过 React 代码生成视频，但当前采用特殊的分层商业许可，并非可以无条件作为所有公司免费使用的普通 MIT 库。[R9]

### FFmpeg

FFmpeg 主体是 LGPL 2.1+；若构建时启用 GPL 组件，则整个 FFmpeg 构建适用 GPL。[R10]

### HyperFrames

HyperFrames 适合把 HTML 组合、字幕、语音、转场和浏览器画面渲染为视频，但它属于“视频输出和内容生产层”，不是“任意 HTML 源码编辑内核”。

### 决策

- 三者均不进入 MVP 文档模型；
- MVP 只预留 `VideoExportAdapter`；
- 后期优先实现：
  1. 浏览器逐帧截图/音频采样；
  2. 受控 LGPL FFmpeg 构建；
  3. 根据授权和业务需求选择 Remotion 或 HyperFrames Adapter；
- 任何视频导出实现不得反向控制 HE Timeline Schema；
- 引入 Remotion 前必须完成组织规模与许可证核验；
- 分发 FFmpeg 时必须固定构建参数、许可证清单和源代码获取说明。

---
