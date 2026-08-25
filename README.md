# HTML Edit

**人工操作优先的真实 HTML 动态网页与多媒体编排器**

HTML Edit 直接打开并运行标准 HTML、CSS、JavaScript 与本地媒体项目，让用户在真实 Chromium 画布中选择和修改 DOM 元素，并通过剪辑软件式多轨时间线编排页面动画、视频、音频和交互。

产品体验参考 OpenPencil / Figma 的画布操作与 AE / 剪辑软件的时间线，但不使用静态 Canvas 场景图替代真实网页，也不把第三方网页编辑器的私有 JSON 设为项目主模型。

## 当前状态

- **产品与技术架构 v2 已冻结**：2026-08-25；
- 已完成 P0“视觉优先选择系统”的规范与 `packages/selection-core` 初始实现；
- 桌面应用壳、HE Project Graph、Source Binding、Command / Transaction、Source Patch 与 Timeline 尚待按任务顺序开发；
- 当前阶段继续坚持“人工可操作性优先，Agent 后置”。

## 核心架构

```text
Human UI / Future CLI / Future MCP / Future Agent
                         │
                         ▼
                 Command Gateway
                         ▼
              Transaction Coordinator
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
HE Project Graph   Source Patch      Timeline /
+ Source Binding      Engine         Interaction
        └────────────────┼────────────────┘
                         ▼
                  Preview Compiler
                         ▼
             Sandboxed same-origin iframe
                   Real Chromium DOM
                         ▲
                         │
          Preview Bridge / Runtime DOM Index
                         ▲
                         │
     Host Overlay / Selection / Moveable / Selecto
```

### 两个权威数据域

HTML Edit 不再使用“只有一份 Source of Truth”的模糊表述，而是明确分工：

| 权威域 | 负责内容 |
|---|---|
| 用户 HTML / CSS / JavaScript | 网页语义、原始结构、未知代码、CSS 级联、独立运行结果 |
| HE Project Graph 与附加数据 | 稳定 ID、Source Binding、编辑器元数据、时间线、交互、revision、操作记录 |

所有持久修改必须由 `Command → Transaction` 同步更新相关源码和 HE 数据。真实 DOM 是运行时画面，不是独立的持久化真相。

## 开发路线

采用：

> **自研产品内核 + 精准复用成熟开源模块。**

不 Fork OpenPencil、GrapesJS、Webstudio 或 Scena 作为产品底座。

### 必须自研

- HE Project Graph；
- Source Binding；
- Command / Operation / Transaction；
- 视觉语义 Selection；
- Preview Bridge；
- 非破坏性 Source Patch；
- CSS 来源与覆盖管理；
- deterministic Timeline；
- Interaction Compiler；
- Preview / Export 一致性。

### 直接复用

- Electron、Chromium；
- React、TypeScript、Vite、Zod；
- parse5、Magic String、PostCSS、CSSTree；
- Moveable、Selecto；
- Monaco；
- Vitest、Playwright、Electron Forge。

### 只借鉴，不绑定

- OpenPencil：模块边界、格式 Adapter、CLI / MCP、图层与节点索引；
- GrapesJS：iframe Canvas、Model / View 组织；
- Webstudio：CSS 来源、断点、Flex / Grid Inspector；
- Puck：组件 Schema 与 Field Inspector；
- Scena / Theatre.js：时间线与曲线编辑交互；
- Remotion / HyperFrames：后期视频导出工作流。

## MVP 成立条件

第一阶段必须先完成以下完整人工闭环：

```text
打开普通 HTML 项目
→ 在真实画布中正确选择视觉对象
→ 修改文字、属性、样式和基础变换
→ 多选、拖动、缩放、吸附
→ Undo / Redo
→ 最小化并安全回写源码
→ 保存、关闭、重新打开
→ 页面仍可脱离 HTML Edit 独立运行
→ 外部源码冲突可见且不会误写
```

未完成该闭环，不进入时间线、Agent、CRDT、最终 MP4 或 OpenPencil Adapter 开发。

## 文档入口

按以下顺序阅读：

1. [产品核心定义](docs/product-core.md)
2. [技术架构与开源选型执行规范](docs/architecture/technical-architecture.md)
3. [研发实施方案](docs/engineering-plan.md)
4. [P0 视觉优先选择系统](docs/selection-system.md)
5. [冻结架构决策 ADR-001](docs/adr/0001-core-architecture-decisions.md)
6. [文档权威关系与索引](docs/README.md)
7. [开发 Agent 执行要求](AGENTS.md)

可视化阅读版本：

- [技术架构与开源选型 HTML 报告](docs/architecture/technical-architecture.html)

## 当前实施入口

架构文档同步完成后，开发顺序从以下任务开始：

```text
SCH-001  Schema 基础
→ GRF-001  HE Project Graph
→ BND-001  Source Binding
→ CMD-001  Command Gateway
→ TXN-001  Transaction Core
→ PRV-001  Preview Bridge
→ SEL-001  接入现有 Selection Core
→ OVL-001  Overlay Editor
→ SRC-001 / CSS-001
→ 第一阶段人工闭环
```

`PLT-001` 的 Electron / React / Vite 应用壳可以在 `SCH-001` 同期推进，但不得绕过上述核心模型先堆叠业务 UI。

## 当前验证命令

仓库现阶段仅包含选择核心包，当前验证入口为：

```bash
npm install
npm run verify
```

后续应用壳建立后，统一 CI 必须扩展为：

```text
install → lint → typecheck → unit test → build
→ Playwright smoke → Electron package
```

## License

[MIT](LICENSE)
