# HTML Edit 研发实施方案 v2

> 状态：**已冻结执行基线 v2**  
> 生效日期：2026-08-25  
> 产品边界：[`product-core.md`](product-core.md)  
> 完整选型论证：[`architecture/technical-architecture.md`](architecture/technical-architecture.md)  
> 冻结决策：[`adr/0001-core-architecture-decisions.md`](adr/0001-core-architecture-decisions.md)

## 1. 实施结论

HTML Edit 采用：

> **在现有仓库继续开发，自研决定产品成立的核心，直接复用成熟基础库，只借鉴完整开源产品的局部架构和交互。**

不得：

- Fork OpenPencil、GrapesJS、Webstudio、Scena 作为产品底座；
- 用 Canvas SceneGraph 替代真实 DOM；
- 将第三方编辑器 Project JSON 设为工程权威模型；
- 让 UI、Agent、插件直接修改源码或工程 JSON；
- 在第一阶段人工闭环之前进入 Timeline、MCP、CRDT 或最终 MP4。

## 2. 固定技术栈

```text
Desktop       Electron 43 + Chromium
Editor UI     React 19.2 + TypeScript 5.9 + Vite 8.x
UI State      Zustand（仅 session / panel / selection UI 状态）
UI Components Radix UI + CSS Modules

Canvas        sandboxed same-origin iframe + Real DOM
Overlay       Moveable + Selecto；Guides 条件引入
Source View   Monaco

Schema        Zod 4 + JSON Schema
HTML AST      parse5
Patch         Magic String
CSS           PostCSS + CSSTree
Timeline      Self-built model + deterministic evaluator
Playback      Web Animations API + HTMLMediaElement

Local Server  Electron Main + Fastify
Testing       Vitest + Playwright
Packaging     Electron Forge + GitHub Actions
```

依赖必须锁定精确版本并记录许可证。禁止在核心运行时直接使用 `latest`。

## 3. 开源复用与借鉴清单

| 来源 | 本项目采用内容 | 采用方式 | 不采用内容 |
|---|---|---|---|
| OpenPencil | 包边界、格式 Adapter、节点索引、图层虚拟化、CLI / MCP 思路 | 研究实现；后期独立 Adapter | CanvasKit 主画布、Figma SceneNode、完整 Fork |
| GrapesJS | iframe Canvas、Model / View 解耦、Layer / Style 面板组织 | UX 与架构参考 | GrapesJS Project JSON、整页重新生成 |
| Webstudio | computed/source/override 样式来源、断点、Flex/Grid Inspector | Inspector 设计参考 | AGPL Core、专有动画能力 |
| Puck | Component Registry、字段 Schema、Inspector Field | 后期组件 Adapter 参考 | React Data 作为通用网页模型 |
| Moveable | 拖动、缩放、旋转、控制点、几何信息 | **直接依赖**，仅 Overlay | 语义选择、持久化和布局决策 |
| Selecto | 区域框选、候选集合 | **直接依赖**，与 Selection Core 结合 | 仅凭 bounding box 作为最终命中 |
| Scena / Scene.js | 时间线布局、轨道、关键帧、画布联动 UX | 交互参考 | Scene.js 数据作为 canonical Timeline |
| Theatre.js | 曲线编辑和 sequence UX | 交互参考 | Studio / 项目格式进入核心 |
| Penpot | Flex/Grid、约束、组件 UI | 设计参考 | 完整技术栈 |
| Remotion | 程序化逐帧视频导出 | MVP 后可选 Adapter | 核心 Timeline 和默认商业依赖 |
| FFmpeg | 编码、封装、媒体处理 | MVP 后经许可证审计使用 | 未审计 GPL / nonfree 构建 |
| HyperFrames | HTML 组合到视频、字幕、转场工作流 | MVP 后 Adapter / 流程参考 | 编辑器内核 |
| Yjs | transaction origin、shared type 思路 | 协同阶段评估 | MVP 直接进入 Core |

## 4. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│ Human UI / Keyboard / Future CLI / Future MCP / Future Agent │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
                       Command Gateway
                               ▼
                    Transaction Coordinator
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
       HE Project Graph   Source Patch     Timeline /
       + Source Binding      Engine        Interaction
                └──────────────┼──────────────┘
                               ▼
                       Preview Compiler
                               ▼
               Sandboxed same-origin iframe
                      Real Chromium DOM
                               ▲
                               │
                 Preview Bridge / DOM Index
                               ▲
                               │
       Host Overlay: Selection / Moveable / Selecto / Guides
```

### 4.1 进程边界

```text
Electron Main
├─ Window / lifecycle
├─ local preview server
├─ file access and path policy
├─ atomic save / recovery
├─ CDP deep hit-test
└─ packaging / update hooks

Preload
├─ allowlisted IPC
├─ sender/origin/session validation
└─ Zod message validation

Renderer / Editor
├─ React UI
├─ Command Gateway
├─ Selection UI
├─ Overlay Editor
├─ Inspector / Layers / Timeline UI
└─ project session state

Preview iframe
├─ actual user HTML/CSS/JS
├─ Runtime DOM Index
├─ Preview Bridge
├─ WAAPI / HTMLMediaElement playback
└─ runtime diagnostics
```

Electron 安全固定项：

```text
nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true
```

iframe 仅加载绑定 `127.0.0.1` 随机端口的受控服务；每次预览使用随机 session token；外链、弹窗、下载和导航默认受限。

## 5. Monorepo 目录

在当前 npm workspaces 上扩展：

```text
html-edit/
├─ apps/
│  ├─ desktop/                 # Electron Main / Preload / Forge
│  └─ editor/                  # React editor shell
│
├─ packages/
│  ├─ schema/                  # Zod、JSON Schema、migration
│  ├─ project-graph/           # HE Project Graph
│  ├─ source-binding/          # targetId ↔ source / runtime binding
│  ├─ command-core/            # Command、Handler、validation、dry-run
│  ├─ transaction-core/        # revision、inverse、Undo/Redo、rollback
│  ├─ preview-bridge/          # iframe communication、DOM Index
│  ├─ selection-core/          # 已有；纯命中与排序算法
│  ├─ overlay-editor/          # selection overlay、Moveable、Selecto
│  ├─ source-patch/            # parse5、Magic String、HTML patch
│  ├─ style-engine/            # generated CSS、provenance、CSSTree
│  ├─ project-store/           # atomic save、history、autosave、recovery
│  ├─ timeline-model/          # Scene / Track / Clip / Keyframe Schema
│  ├─ timeline-core/           # logical clock、evaluate、playback plan
│  ├─ timeline-ui/             # timeline direct manipulation
│  ├─ media-core/              # video/audio loading、seek、sync
│  ├─ interaction-model/       # Trigger / Action / State Schema
│  ├─ interaction-runtime/     # Preview / Export shared compiler
│  ├─ import-html/             # open ordinary HTML projects
│  ├─ export-html/             # standalone HTML runtime export
│  ├─ agent-contract/          # JSON Schema、structured result、future MCP
│  └─ test-fixtures/           # Golden Projects
│
├─ docs/
│  ├─ architecture/
│  ├─ adr/
│  ├─ schemas/
│  └─ handoff/
└─ package.json
```

## 6. 包依赖规则

固定依赖方向：

```text
schema
  ↑
project-graph / timeline-model / interaction-model
  ↑
command-core
  ↑
transaction-core
  ↑
adapters / UI / desktop
```

禁止：

- `schema` 依赖 React；
- `timeline-core` 依赖 `timeline-ui`；
- `project-graph` 保存 `DOM Element`；
- `command-core` 直接访问 Electron 文件系统；
- `selection-core` 依赖 Moveable / Selecto；
- `preview-bridge` 成为持久数据权威；
- UI 绕过 Command Gateway 直接改工程数据；
- Agent API 直接写文件；
- 跨包导入另一个包的内部源码路径。

## 7. 项目数据与持久化

```text
user-project/
├─ index.html
├─ styles/
├─ scripts/
├─ assets/
├─ html-edit.generated.css
└─ .html-edit/
   ├─ project.json
   ├─ graph.json
   ├─ timeline.json
   ├─ interactions.json
   ├─ operations.ndjson
   └─ history/
```

### 7.1 双权威域

| 数据 | 权威来源 |
|---|---|
| HTML 标签、文本、属性、原始结构 | 用户 HTML |
| 用户 CSS 与未知级联 | 用户 CSS |
| JavaScript 与自定义逻辑 | 用户 JS |
| HTML Edit 生成的视觉覆盖 | `html-edit.generated.css` |
| 稳定 ID、能力、锁定、隐藏、别名 | `graph.json` |
| Source Binding | `graph.json` + 可重建 Source Index |
| 动画和媒体片段 | `timeline.json` |
| 触发器、动作和状态 | `interactions.json` |
| revision、origin、Undo/Redo | Transaction / Operation Log |
| hover、selection box、panel state | 内存 UI Store |
| DOM Element 引用 | Preview Runtime，可丢弃 |

### 7.2 HE Project Graph v0.1

```ts
export type HEProjectGraph = {
  schemaVersion: "0.1.0";
  projectId: string;
  revision: number;
  entry: string;
  fps: { numerator: number; denominator: number };
  pages: Record<string, HEPage>;
  nodes: Record<string, HEEditableNode>;
  assets: Record<string, HEAsset>;
  settings: HEProjectSettings;
};
```

节点仅保存持续编辑投影：

```ts
export type HEEditableNode = {
  id: string;
  pageId: string;
  parentId: string | null;
  childIds: string[];
  kind:
    | "element"
    | "text"
    | "image"
    | "video"
    | "audio"
    | "svg"
    | "canvas"
    | "iframe"
    | "component-host"
    | "embed";
  sourceBinding: SourceBinding;
  capabilities: HECapability[];
  editor: {
    name?: string;
    locked: boolean;
    hidden: boolean;
    selectable: boolean;
  };
  overrideRefs: string[];
};
```

### 7.3 Source Binding

```ts
export type SourceBinding =
  | {
      mode: "source-backed";
      file: string;
      targetId: string;
      tagName: string;
      sourceHash: string;
      sourceRange?: { start: number; end: number };
      cssBindings?: CssBinding[];
    }
  | {
      mode: "generated";
      ownerFile: string;
      targetId: string;
    }
  | {
      mode: "opaque";
      hostTargetId: string;
      reason: OpaqueReason;
    };
```

规则：

- `sourceRange` 只是缓存；
- 文件变化后按 `targetId + Source Index + sourceHash` 重建；
- 找不到时标记 `binding-stale`；
- 重复或缺失 ID 必须显式报错；
- 不得静默绑定到相似元素；
- 删除后的 ID 不复用。

### 7.4 Schema 与迁移

- 所有持久文件必须包含 `schemaVersion`；
- 使用 Zod 4 生成 TypeScript 类型和 JSON Schema；
- 未知新版本只读打开；
- migration 必须可测试、可回滚；
- JSON 使用稳定排序，减少无意义 Diff；
- MVP 权威持久化继续使用 JSON / NDJSON；
- CBOR、Protobuf、SQLite 只可作为后期缓存或性能层，不能替代权威 Schema。

## 8. Command 与 Transaction

```text
UI Intent / Future Agent Intent
→ Command Gateway
→ Schema Validation
→ Permission / Revision Check
→ Dry Run / Diagnostics
→ Transaction Coordinator
→ Domain Services
→ Preview Apply
→ Atomic Persistence
```

```ts
export type HECommand<TType extends string, TPayload> = {
  type: TType;
  commandId: string;
  projectId: string;
  baseRevision: number;
  targetId?: string;
  source: "human" | "system" | "future-agent";
  timestamp: string;
  dryRun: boolean;
  payload: TPayload;
};
```

每个 Command 必须有：

- 独立 Zod Schema；
- validation；
- dry-run；
- structured diagnostics；
- revision conflict；
- files / domains affected；
- inverse、rollback 或可验证快照；
- deterministic result。

拖动和缩放时：

```text
pointermove → preview-only mutation
pointerup   → one committed Transaction
```

Undo / Redo 操作 Transaction，不直接回滚 Zustand 或 DOM。

## 9. Preview Bridge 与 Runtime DOM Index

Preview Bridge 负责：

- ready / error / runtime diagnostics；
- Runtime DOM Index；
- hover / select / inspect；
- stable ID 命中；
- element rect、computed style、media state；
- preview-only operations；
- WAAPI / media playback；
- iframe zoom、scroll 和坐标映射。

Bridge 由本地 Preview Server 在响应阶段注入，不永久写入用户源码。所有消息包含 `sessionId` 并经过 origin、sender、session 和 Zod 校验。

```ts
interface CanvasAdapter {
  load(entryUrl: string): Promise<void>;
  getTree(): Promise<DomNodeSummary[]>;
  select(targetId: string | null): Promise<void>;
  inspect(targetId: string): Promise<ComputedElementSnapshot>;
  applyPreview(operations: PreviewOperation[]): Promise<void>;
}
```

## 10. Selection 与 Overlay

选择系统以 [`selection-system.md`](selection-system.md) 为强制实施契约。

```text
Canvas Pointer
→ Coordinate Mapper
→ Fast Hit Test
   ├─ text caret / Range
   └─ elementsFromPoint()
→ Deep Hit Test Fallback
   ├─ descendant geometry
   └─ CDP DOM.getNodeForLocation
→ Candidate Normalizer
→ Visibility / Lock / Editor Layer Filter
→ Semantic Ranker
→ SelectionCandidateStack
→ Unified Selection Store
```

Moveable / Selecto 的边界：

- Moveable：控制框、拖动、缩放、旋转、几何信息；
- Selecto：区域多选；
- Selection Core：决定“用户语义上选中了谁”；
- Overlay：绘制反馈；
- Transaction：决定如何持久化；
- 任何第三方控件不得自行写 DOM 或源码。

## 11. 变换与布局策略

画布拖动必须区分布局类型：

| 当前布局 | 默认提交策略 |
|---|---|
| absolute / fixed | 更新 inset / transform 等受控属性 |
| normal flow | 优先 margin / container layout，不自动改成 absolute |
| Flex child | 编辑 order、grow、basis、align-self 或受控 offset |
| Grid child | 编辑 grid position、align-self、justify-self |
| 不可安全推断 | 仅 Preview，提交前要求显式策略或降级 |

不得为了“拖得动”把所有元素强行变为 `position:absolute`。

## 12. Source Patch 与 Style Engine

### 12.1 HTML Patch

禁止：

```text
HTML → DOM → 修改 → outerHTML → 整页覆盖
```

固定流程：

```text
Original HTML
→ parse5 + sourceCodeLocationInfo
→ Source Index
→ targetId / Source Binding 定位
→ Magic String 最小 Patch
→ reparse / validate
→ Transaction Manifest
→ atomic save
→ rebuild Source Index
```

第一阶段 Patch：

- Ensure stable ID；
- text；
- attribute；
- safe insert / delete / reorder；
- basic media source；
- generated stylesheet link。

### 12.2 CSS

视觉样式默认写入 `html-edit.generated.css`：

```css
[data-he-id="he_title"] {
  font-size: 72px;
}
```

Style Engine 必须显示：

```text
computed value
source declaration
HTML Edit override
inheritance / variable source
```

MVP 不自动重写用户原 CSS。用户明确进入源码模式后，Monaco 才允许高级编辑，并通过 file watcher / revision 重新绑定。

## 13. Timeline v0.1

```text
Timeline
├─ Scene
├─ Track
│  └─ Clip
│     └─ Keyframe
└─ Marker / Event
```

第一版 Track：

- `dom-animation`；
- `video`；
- `audio`；
- `event`。

时间使用整数微秒 `timeUs`；fps 是显示和吸附参数，不是底层时间真相。

```ts
interface TimelineEvaluator {
  evaluate(timeUs: number, snapshot: TimelineSnapshot): EvaluationResult;
}
```

Evaluator 必须纯函数化、可重复、可测试，不保存 WAAPI、DOM、MediaElement 或 React 状态。

运行流程：

```text
timeline.json
→ validate / normalize
→ deterministic evaluate
→ Playback Plan
→ DOM adapter → WAAPI / direct style
→ Media adapter → HTMLMediaElement
→ Event adapter → Interaction Runtime
```

第一版 UI：

- play / pause / seek / scrub；
- playhead / zoom / snap；
- track / clip / keyframe；
- move / trim / split / copy；
- lock / hide / mute；
- basic easing；
- timeline Undo / Redo。

## 14. Interaction v0.1

Trigger：

```text
click
hover-enter
hover-leave
scene-enter
in-view
time
```

Action：

```text
timeline.play / pause / seek
element.show / hide
state.set
media.play / pause
navigation.anchor / scene
```

Preview 与 Export 共用同一 Resolver / Compiler。缺失引用必须明确报错，不得静默失败。

## 15. Node 支持与 opaque 策略

### 完整支持

- 普通容器；
- 文本；
- 图片；
- 视频、音频；
- SVG 根和基础图形；
- 链接、按钮、基础表单；
- absolute / fixed；
- 基础 Flex / Grid。

### 部分支持

- pseudo element 映射宿主；
- background image；
- Open Shadow Root；
- 同源 iframe；
- custom element 宿主；
- 能建立稳定 Source Binding 的动态 DOM；
- React / Vue 区域作为 `component-host`。

### opaque / embed

- Canvas / WebGL / Three.js / 3DGS 内部；
- 跨域 iframe；
- Closed Shadow Root；
- 无源码来源的动态节点；
- Lottie 等未安装 Adapter 的专有对象；
- 高风险未知脚本区。

## 16. 安全、保存与恢复

### 安全

- 页面脚本不能获得 Node；
- 页面不能读取项目根外文件；
- 跨域 iframe 原子化；
- 支持 Quarantine 模式不执行未知脚本；
- session token 过期失效；
- 外部导航不替换编辑器窗口；
- 所有路径做 canonicalize 和 traversal 检查。

### 保存

多域修改使用 Transaction Manifest：

```text
prepare temp files
→ validate all outputs
→ fsync
→ atomic rename
→ commit revision
→ cleanup
```

失败不得损坏最后有效版本。外部变化通过 file watcher + revision 产生可见冲突。

## 17. 16 周 MVP 顺序

### Phase 0：架构验证（W1–W2）

- iframe + Preview Bridge + complex hit-test；
- stable ID + parse5 + Magic String round-trip；
- HE Project Graph + Source Binding；
- deterministic Timeline seek + video seek；
- Moveable / Selecto host overlay；
- dependency license audit。

### Phase 1：真实 HTML 编辑闭环（W3–W6）

```text
Open → Select → Ensure Stable ID → Edit
→ Undo/Redo → Save → Reopen
```

### Phase 2：时间线与媒体（W7–W10）

- Timeline model / evaluator / UI；
- WAAPI adapter；
- video/audio adapter；
- trim/split/copy；
- DOM/media synchronized scrub。

### Phase 3：交互与独立导出（W11–W13）

- Trigger / Action；
- Interaction Compiler；
- Edit / Preview mode；
- standalone HTML runtime；
- runtime error and diff panels。

### Phase 4：稳定化与交付（W14–W16）

- Windows installer；
- CI and performance baseline；
- crash recovery and file watcher；
- Golden Projects；
- 10-minute complex demo；
- Agent Contract schema；
- third-party notices。

## 18. 任务 ID 与依赖

| ID | 包/范围 | 任务 | 依赖 | 关键验收 |
|---|---|---|---|---|
| ADR-001 | `docs/adr` | 冻结核心架构决策 | 无 | **本次文档同步完成** |
| PLT-001 | `apps/desktop`,`apps/editor` | Electron/React/Vite 壳与安全边界 | ADR-001 | 窗口可启动；安全配置测试 |
| SCH-001 | `schema` | Zod 基础类型、ID、revision、migration | ADR-001 | TS 类型和 JSON Schema |
| GRF-001 | `project-graph` | Graph、节点索引、引用完整性 | SCH-001 | 10k 节点测试 |
| BND-001 | `source-binding` | stable ID、binding、stale conflict | GRF-001 | 外部编辑重建/冲突 |
| CMD-001 | `command-core` | Gateway、Handler、validation、dry-run | SCH-001 | 每个 Command 有 Schema 与诊断 |
| TXN-001 | `transaction-core` | revision、inverse、Undo/Redo | CMD-001 | 随机事务无状态漂移 |
| PRV-001 | `preview-bridge` | local server、bridge、DOM Index | PLT-001,SCH-001 | reload 后重建 |
| SEL-001 | `selection-core` | 接入已有核心并补齐契约 | PRV-001 | selection Golden Cases |
| OVL-001 | `overlay-editor` | Moveable / Selecto / Guides | SEL-001 | zoom/scroll/rotate 坐标 |
| SRC-001 | `source-patch` | Source Index、ID/text/attr Patch | BND-001,TXN-001 | 无关字节不变化 |
| CSS-001 | `style-engine` | generated CSS、provenance | SRC-001 | save/reopen 一致 |
| EDT-001 | `apps/editor` | Layers、Inspector、Monaco Diff | GRF-001,OVL-001,CSS-001 | 同步选择、来源可见 |
| STO-001 | `project-store` | atomic save、history、recovery | TXN-001,SRC-001 | 中断写入不损坏 |
| TML-001 | `timeline-model` | timeUs Schema 与 migration | SCH-001 | Schema / boundary tests |
| TML-002 | `timeline-core` | evaluate、clock、Playback Plan | TML-001 | 同时刻结果一致 |
| TML-003 | `timeline-ui` | timeline direct editing | TML-002,TXN-001 | 每个手势一个 Transaction |
| MED-001 | `media-core` | load、seek、trim、sync | TML-002 | scrub 误差达标 |
| INT-001 | `interaction-*` | Trigger/Action/State、Resolver | TML-002,CMD-001 | Preview/Export 一致 |
| EXP-001 | `export-html` | runtime compiler、standalone export | INT-001,CSS-001 | 无编辑器可运行 |
| SEC-001 | 全局 | security policy、IPC、quarantine | PRV-001,STO-001 | Node/任意文件不可访问 |
| TST-001 | `test-fixtures` | Golden Projects、perf regression | 各模块 | CI 阻止回归 |
| PKG-001 | `apps/desktop` | Forge、Windows installer、notices | SEC-001,TST-001 | 干净 Windows 安装运行 |
| AGT-001 | `agent-contract` | Schema、dry-run、structured result | MVP Gate | 复用 CommandService |
| ADP-001 | `adapter-openpencil` | `.pen` 映射 PoC | MVP Gate,AGT-001 | 显式损失报告 |

## 19. 当前立即执行顺序

`ADR-001` 已由本次文档同步完成。下一步固定为：

```text
SCH-001
→ GRF-001
→ BND-001
→ CMD-001
→ TXN-001
→ PRV-001
→ SEL-001
→ OVL-001
→ SRC-001 / CSS-001
→ EDT-001 / STO-001
→ 第一阶段 Gate
```

`PLT-001` 可与 `SCH-001` 并行。

现有 `selection-core` 不得继续脱离 Preview Bridge 单独堆叠 UI；先补齐上游模型和运行桥接。

## 20. 测试与质量门槛

### Core

- Schema parse / migration；
- stable ID uniqueness；
- Source Binding rebuild / stale；
- Command validation / dry-run；
- revision conflict；
- Transaction rollback；
- Undo / Redo；
- HTML Patch escaping；
- CSS provenance；
- Timeline trim / split / move；
- deterministic evaluate；
- Interaction resolve；
- atomic save failure。

### Golden Projects

至少覆盖：

- 单文件和多文件项目；
- Flex / Grid / absolute / transform；
- 深层文字、透明遮罩、`pointer-events:none`；
- SVG、video、audio；
- 同源 iframe、Shadow DOM；
- Canvas/WebGL opaque；
- 5000 DOM 节点；
- 10 分钟 / 500 Clip；
- 外部文件冲突；
- runtime error；
- standalone export。

### 性能

- 5000 DOM：hover hit-test p95 `< 32ms`；
- click candidate stack p95 `< 50ms`；
- 常规页面 Overlay 目标 60fps；
- 10 分钟 / 500 Clip seek 首个可见状态 `< 100ms`；
- 10k HE 节点按 ID 查询近似 O(1)；
- 保存不修改无关文件。

### CI

```text
install
→ lint
→ typecheck
→ unit test
→ build
→ Playwright smoke
→ Electron package
→ artifact / notices
```

## 21. 第一阶段 Gate

只有以下全部通过，才允许进入 Timeline：

```text
打开标准 HTML 项目
→ 第一次点击选中正确视觉对象
→ 修改文字和样式
→ 拖动 / 缩放 / 多选
→ Undo / Redo
→ 安全保存
→ 关闭重开
→ 页面独立运行
→ HE Graph 与源码引用一致
→ 无关源码无大面积变化
→ 外部修改冲突可见
```

## 22. 开发 Agent 完成要求

每个任务必须：

- 只实现一个任务 ID；
- 先有失败测试或契约测试；
- 使用公开包出口；
- 不绕过 Command / Transaction；
- 新持久数据有 Zod、Schema Version 和 migration；
- 新依赖记录精确版本、许可证、用途、替代方案；
- 运行真实验证命令；
- 更新文档；
- 提供人工验收步骤和已知限制；
- 不以“后续补测试”作为完成。

完整执行规则见仓库根目录 [`AGENTS.md`](../AGENTS.md)。
