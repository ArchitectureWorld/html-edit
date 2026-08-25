# ADR-001：HTML Edit 核心架构与开源复用决策

- **状态**：Accepted / Frozen
- **日期**：2026-08-25
- **适用范围**：整个 `ArchitectureWorld/html-edit` 仓库
- **相关文档**：
  - [`../product-core.md`](../product-core.md)
  - [`../architecture/technical-architecture.md`](../architecture/technical-architecture.md)
  - [`../engineering-plan.md`](../engineering-plan.md)

## 背景

HTML Edit 需要同时满足：

- 真实 HTML / CSS / JavaScript 项目继续独立运行；
- OpenPencil / Figma 式画布操作；
- 剪辑软件式时间线；
- 非破坏性源码回写；
- 未来 Agent / CLI / MCP 程序化编辑；
- 图片、视频、音频和页面交互统一编排。

调研表明，完整 Fork OpenPencil、GrapesJS、Webstudio 或 Scena 会继承与本项目不一致的渲染器、数据模型或许可证边界；完全从零开发则会重复实现大量成熟基础能力。

因此接受以下十项冻结决策。

## 决策 1：采用混合路线

自研决定产品成立的内核，复用成熟通用模块，不 Fork 完整编辑器。

必须自研：

- HE Project Graph；
- Source Binding；
- Command / Transaction；
- 视觉语义 Selection；
- Preview Bridge；
- Source Patch；
- CSS provenance；
- deterministic Timeline；
- Interaction Compiler；
- Preview / Export 一致性。

直接复用：

- Electron / Chromium；
- React / TypeScript / Vite / Zod；
- parse5 / Magic String / PostCSS / CSSTree；
- Moveable / Selecto；
- Monaco；
- Vitest / Playwright / Electron Forge。

## 决策 2：真实 DOM 是画布

编辑画面与最终运行画面均基于真实 Chromium DOM。

不得以 CanvasKit、Konva、Fabric、SVG SceneGraph 或静态截图替代网页画布。

## 决策 3：采用双权威域

用户 HTML / CSS / JavaScript 负责网页语义、未知代码和独立运行结果。

HE Project Graph 与附加数据负责：

- 稳定身份；
- Source Binding；
- 编辑元数据；
- 时间线；
- 交互；
- revision 与操作记录。

两侧通过 Transaction Coordinator 保持一致。

## 决策 4：语义 Command 是唯一持久修改入口

人工 UI、未来 CLI、MCP、插件和 Agent 均必须调用相同 Command Service。

不得直接修改：

- 项目 JSON；
- 源码文件；
- DOM 并将其当成已保存结果；
- Zustand / React State 并将其当成工程数据。

## 决策 5：自研 deterministic Timeline

Timeline Model、Evaluator 和 Playback Plan 由项目自研。

WAAPI、HTMLMediaElement、GSAP、Scene.js、Theatre.js、Remotion 都只能作为运行或导出 Adapter，不得成为 canonical Timeline Model。

## 决策 6：未知能力降级为 opaque

无法可靠理解、定位源码或回写的对象必须标记为 `opaque/embed`。

不得为了宣传“支持”而猜测性拆解 Canvas、WebGL、跨域 iframe、Closed Shadow Root、框架运行时节点或未知组件。

## 决策 7：JSON 是持久化和交换格式，不是产品本体

运行时内核使用带索引的 TypeScript 对象和领域服务。

JSON / NDJSON 用于：

- 工程持久化；
- Schema 校验；
- migration；
- Agent 交换；
- Operation Log。

后期 CBOR、Protobuf 或 SQLite 只可作为缓存和性能层。

## 决策 8：CRDT 后置

MVP 先完成单机 revision、Transaction、Undo / Redo、原子保存和外部文件冲突。

通过人工闭环 Gate 后再评估 Yjs / CRDT，不允许其提前渗入 Core。

## 决策 9：人工优先、Agent 后置

从第一天保留 Command Schema、dry-run、revision 和 structured diagnostics，但 Agent、CLI、MCP 不得延误人工编辑闭环。

## 决策 10：OpenPencil 只作为参考与后期 Adapter

借鉴 OpenPencil：

- 模块化包边界；
- SceneGraph 索引思想；
- Layers 虚拟化；
- 格式 Adapter；
- CLI / MCP 与机器可读输出。

不采用：

- 完整 Fork；
- CanvasKit renderer；
- Figma SceneNode 作为 HE Core；
- `.fig` / `.pen` 作为 HTML Edit 原生工程格式。

## 后果

### 正面

- 画布、预览和最终网页保持一致；
- 核心数据和行为长期可控；
- 能复用成熟通用库，减少重复开发；
- Agent 后续可复用人工命令内核；
- 不受单一第三方编辑器数据模型锁定。

### 代价

- 必须自研 Source Binding、Transaction、Timeline 和 Interaction 等关键模块；
- 对包边界、Schema、测试和迁移要求更高；
- 初期不能靠 Fork 快速堆出大量表面功能。

## 修改规则

本 ADR 已冻结。修改任一决策必须新建 ADR，并至少包含：

- 原决策为何失效；
- 新方案与候选对比；
- 数据迁移方式；
- 对已有模块和项目文件的影响；
- 许可证与安全影响；
- 回滚方案；
- 自动化验收计划。
