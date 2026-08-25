# HTML Edit 技术架构与开源选型执行规范 v2

> **状态**：已冻结执行基线 v2  
> **日期**：2026-08-25  
> **目标仓库**：`ArchitectureWorld/html-edit`  
> **适用对象**：产品负责人、技术负责人、开发 Agent、代码审查 Agent、测试 Agent  
> **文档用途**：用于冻结“从零开发还是基于开源项目开发”的技术路线，并把后续开发拆成可直接执行、可测试、可验收的工程任务。  
> **与现有文档的关系**：本文与 `product-core.md`、`engineering-plan.md`、`selection-system.md` 及 `docs/adr/0001-core-architecture-decisions.md` 共同构成当前权威基线；架构与开源选型冲突时以本文和 ADR 为准。  
> **规范词**：本文中的“必须 / MUST”“不得 / MUST NOT”“应该 / SHOULD”“可以 / MAY”具有工程约束含义。

---

## 0. 最终决策

### 0.1 一句话结论

HTML Edit **不适合完全从零开发，也不适合 Fork OpenPencil、GrapesJS、Webstudio、Scena 等完整产品作为底座**。推荐路线是：

> **在现有 `html-edit` 仓库上继续开发，自研决定产品成立的双向编辑内核，精准复用成熟开源模块；真实 HTML 继续作为最终运行与交付载体，HE Project Graph 作为结构化编辑投影，两者通过 Source Binding 和 Transaction 保持一致。**

这是一条“**自研核心 + 复用零部件**”的平衡路线。

### 0.2 决策清单

| 决策项 | 决策 |
|---|---|
| 是否重开仓库 | **否**。继续使用 `ArchitectureWorld/html-edit` |
| 是否 Fork OpenPencil | **否** |
| 是否以 GrapesJS / Webstudio 为编辑器内核 | **否** |
| 是否完全从零写所有能力 | **否** |
| 画布渲染 | **真实 Chromium DOM，运行于受控 iframe** |
| 编辑控制层 | **宿主 Overlay，使用 Moveable + Selecto；语义选择仍由自研 Selection Core 决定** |
| 项目核心模型 | **自研 HE Project Graph，保存可持续编辑所需的结构化投影，不复制整个任意 DOM** |
| 源码权威关系 | **HTML/CSS/JS 负责网页语义与未知代码；HE 数据负责稳定身份、编辑元数据、时间线、交互和事务** |
| JSON 的角色 | **开放持久化、Schema、Agent 交换格式，不等于运行时内核本身** |
| 时间线 | **自研 Timeline Model + Deterministic Evaluator + UI；WAAPI/HTMLMediaElement 仅是播放后端** |
| 协同编辑 | **MVP 不引入 Yjs/CRDT，先保留可映射的 Command、Transaction 和 origin** |
| Agent | **MVP 只建设 Agent 可复用的命令与 JSON Schema；CLI/MCP 在人工闭环完成后接入** |
| 视频导出 | **MVP 后置；后期通过 FFmpeg、Remotion 或 HyperFrames Adapter 实现，不进入核心数据模型** |

### 0.3 为什么不是另外三条路线

1. **完全从零开发**会把大量时间消耗在通用拖拽、缩放、框选、解析器、安全沙箱、代码编辑器、测试和打包上；这些不是产品差异化。
2. **Fork 完整产品**能够更快做出演示，但会继承对方的渲染器、数据模型和产品假设。OpenPencil 的核心是 CanvasKit SceneGraph，GrapesJS 的核心是自己的 Component JSON，均与“真实已有 HTML 非破坏性回写”存在根本错位。
3. **把单个开源编辑器设为核心依赖**会让时间线、媒体、Source Patch 和未来 Agent 变成外挂状态，最终仍需重构。
4. **混合路线**可以保留产品独特性，同时避免重复造通用轮子，是速度、风险和长期可控性的最优平衡。

---

## 1. 产品目标与边界

### 1.1 产品目标

HTML Edit 是一个：

> **人工操作优先、以真实 HTML 为运行载体、具备 OpenPencil/Figma 式画布操作与剪辑软件式时间线的动态网页和多媒体编排工具。**

用户应能够完成以下闭环：

```text
打开普通 HTML/CSS/JavaScript 项目
→ 在真实浏览器画布中准确选择视觉对象
→ 修改文字、图片、媒体、属性、样式和基础布局
→ 拖动、缩放、多选、吸附、锁定、隐藏
→ 创建 DOM 动画、视频、音频和事件轨道
→ 创建点击、悬停、进入视口和时间触发交互
→ Undo / Redo
→ 安全保存
→ 关闭并重新打开
→ 页面仍是可独立运行的标准 HTML 项目
```

### 1.2 产品差异化

HTML Edit 不是以下产品的简单复制：

- 不是 OpenPencil/Figma 的静态设计画布；
- 不是 GrapesJS/Webstudio 的通用建站器；
- 不是 AE/Premiere/剪映的视频后期软件；
- 不是浏览器 DevTools 的可视化包装；
- 不是只接受自有 JSON 模板的页面生成器；
- 不是以 Agent 代替人工操作的代码生成器。

其核心差异是：

```text
真实 HTML 源码可继续维护
+
真实浏览器画面直接编辑
+
非破坏性源码回写
+
统一时间线与交互模型
+
人工与 Agent 共用的结构化命令内核
```

### 1.3 MVP 明确不做

MVP 不实现：

- 任意 React、Vue、Next.js 源码级无损双向回写；
- 完整富文本排版引擎；
- Canvas/WebGL/Three.js/3DGS 内部对象编辑；
- 跨域 iframe 内部选择；
- 完整 AE 合成、专业调色、混音；
- 最终 MP4 高级渲染农场；
- 多人实时协同与云账号体系；
- 正式插件市场、模板市场、素材商城；
- 任意外部网站一键无损克隆；
- 让 Agent 直接修改 JSON 或文件而绕过 Command Bus。

无法可靠理解的对象必须降级为 `opaque/embed`，不得猜测性拆解。

---

## 2. 研究方法与选型标准

### 2.1 研究对象

本次重点核验：

- OpenPencil；
- GrapesJS；
- Webstudio；
- Puck；
- Moveable、Selecto、Guides、InfiniteViewer；
- Scena、Scene.js、Scene.js Timeline；
- Theatre.js；
- tldraw、Excalidraw、Penpot；
- Konva、Fabric.js；
- Remotion、FFmpeg；
- Zod、Yjs；
- Electron、Playwright 等基础设施。

### 2.2 评价维度

内部架构评分采用以下权重。评分是本项目决策估算，不是第三方官方结论。

| 维度 | 权重 | 说明 |
|---|---:|---|
| 产品目标匹配度 | 25 | 是否天然支持真实 HTML、时间线、交互与媒体 |
| 源码保真与可回写性 | 20 | 能否保留已有项目结构和未知代码 |
| MVP 速度 | 15 | 是否减少首个可用版本的工作量 |
| 长期可控性 | 15 | 是否受外部数据模型、渲染器和商业策略锁定 |
| Agent/自动化友好度 | 10 | 是否易于结构化命令、Schema、CLI/MCP |
| 许可证与商业风险 | 10 | 是否允许预期商业使用、分发和修改 |
| 维护成熟度 | 5 | 活跃度、文档、测试和生态质量 |

### 2.3 四条路线评分

| 路线 | 综合评分 | 优点 | 核心问题 | 决策 |
|---|---:|---|---|---|
| A. 完全从零 | 67/100 | 最大控制力，无历史包袱 | 重复造轮子；周期和缺陷风险最高 | 不采用 |
| B. Fork 完整开源产品 | 52/100 | 演示快，已有完整 UI | 数据模型和渲染方式错位；升级合并成本高 | 不采用 |
| C. 以单个编辑器为核心依赖 | 59/100 | 页面编辑能力起步快 | 时间线、Source Patch、媒体和 Agent 成为外挂 | 不采用 |
| D. 自研核心 + 复用模块 | **89/100** | 兼顾速度、产品匹配和可控性 | 要求严格划清模块边界 | **采用** |

### 2.4 研发量级估算

以下是用于排期的工程估算，不是交付承诺：

| 路线 | 可用演示 | 生产级 MVP 估算 | 后续重构风险 |
|---|---:|---:|---|
| 完全从零 | 8–12 周 | 15–24 工程师月 | 中 |
| Fork OpenPencil / Scena | 3–6 周 | 12–22 工程师月 | **高** |
| GrapesJS / Webstudio 核心 | 4–8 周 | 11–20 工程师月 | **高** |
| 推荐混合路线 | 4–6 周形成首个闭环 | **9–15 工程师月** | 中低 |

推荐配置是 3 名具备 TypeScript/Electron/浏览器经验的开发人员，加 1 名产品/测试人员部分投入，完成 12–16 周 MVP。单个开发 Agent 串行执行时，应以任务依赖而非自然周作为进度判断。

---

## 3. 现有仓库判断与必须修正的地方

### 3.1 可直接保留的内容

现有仓库已经做对了以下决策：

- 人工操作优先；
- 真实 Chromium iframe；
- 视觉优先选择，不只依赖 `event.target`；
- `data-he-id` 稳定身份；
- parse5 + Magic String 最小化源码 Patch；
- PostCSS 管理受控生成 CSS；
- Command / Operation / Transaction；
- Timeline Core 与 UI 分离；
- WAAPI + HTMLMediaElement 作为运行后端；
- Electron 安全隔离；
- Agent 后置；
- 已开始实现 `packages/selection-core`。

因此，本次不建议推倒重来，也不建议把仓库替换为外部 Fork。

### 3.2 已完成的架构修正

旧版文档中“HTML/CSS/JS 始终是唯一 Source of Truth”的表述过于绝对。本次仓库同步已经将其修正为双权威域模型，用于明确以下数据职责：

- 稳定对象身份；
- 锁定、隐藏、图层别名等编辑器元数据；
- 时间线 Track/Clip/Keyframe；
- 页面交互；
- Undo/Redo 事务；
- Agent 可查询的结构化对象；
- 源码位置漂移后的重新绑定。

当前冻结表述是：

> **用户 HTML/CSS/JS 是网页语义、未知代码和独立运行结果的权威来源；HE Project Graph 是稳定身份、可编辑能力、Source Binding、编辑元数据、时间线引用、交互引用和事务版本的权威来源。所有持久修改必须由 Transaction Coordinator 同步更新两侧。**

这不是两个互相竞争的“真相”，而是两个职责明确的权威域。

### 3.3 不允许出现的错误修正

不得因为引入 HE Project Graph 而改成：

```text
完整 HTML → 全量 JSON SceneGraph → Canvas 模拟渲染 → 再导出 HTML
```

这会重新引入：

- 外部 HTML 解析损失；
- CSS 与浏览器布局差异；
- JavaScript 运行差异；
- 源码结构丢失；
- 编辑器预览和最终网页不一致。

HE Project Graph 是**编辑投影和引用模型**，不是任意网页的完整替代表示。

---

## 4. 分卷文档与阅读顺序

为避免单一文件过长、难以审查和由开发 Agent 精确引用，完整研究与执行规范拆分为以下分卷。分卷内容与本文件、ADR、研发实施方案共同构成技术架构 v2。

| 顺序 | 分卷 | 内容 |
|---:|---|---|
| 1 | [`open-source-evaluation.md`](open-source-evaluation.md) | OpenPencil、GrapesJS、Webstudio、Puck、Moveable、Selecto、Scena、Theatre.js、Remotion、FFmpeg 等候选的能力、许可证、架构错位与采用边界 |
| 2 | [`core-model-and-runtime.md`](core-model-and-runtime.md) | 推荐总体架构、Monorepo、HE Project Graph、节点边界、Command / Transaction、真实 DOM 画布与 Overlay |
| 3 | [`source-timeline-agent.md`](source-timeline-agent.md) | 布局策略、Source Patch、Timeline、Interaction、JSON / CRDT、Agent / CLI / MCP |
| 4 | [`implementation-and-governance.md`](implementation-and-governance.md) | 借鉴总表、16 周计划、任务清单、PR 顺序、质量门槛、风险、ADR、Agent 契约与附录 |

开发 Agent 的最短执行路径：

```text
technical-architecture.md
→ ../adr/0001-core-architecture-decisions.md
→ ../engineering-plan.md
→ 与任务相关的分卷
→ 对应专项规范
```

### 4.1 完整决策摘要

```text
继续使用 ArchitectureWorld/html-edit
+
真实 Chromium DOM 作为画布与运行环境
+
HE Project Graph 作为持续编辑投影
+
Source Binding 连接源码、运行时与稳定 ID
+
Command / Transaction 作为唯一持久修改入口
+
自研 deterministic Timeline 与 Interaction Compiler
+
Moveable / Selecto 等成熟模块按边界复用
+
OpenPencil 等完整产品只借鉴或通过 Adapter 兼容
```

### 4.2 实施入口

```text
SCH-001 → GRF-001 → BND-001 → CMD-001 → TXN-001
→ PRV-001 → SEL-001 → OVL-001 → SRC-001 / CSS-001
→ 第一阶段人工闭环 Gate
```

`PLT-001` 的 Electron / React / Vite 应用壳可与 `SCH-001` 并行，但不得预先建立替代 HE Core 的临时业务模型。
