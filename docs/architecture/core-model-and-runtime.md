# HTML Edit 核心模型、真实 DOM 与运行时架构

> 状态：技术架构执行规范 v2 的组成部分  
> 日期：2026-08-25  
> 主索引：[`technical-architecture.md`](technical-architecture.md)

## 5. 推荐总体架构

### 5.1 总体数据流

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

### 5.2 双权威域

| 数据 | 权威来源 | 说明 |
|---|---|---|
| HTML 标签、文本、属性、原始结构 | 用户 HTML 源码 | 必须最小 Patch |
| 用户 CSS、未知选择器和级联 | 用户 CSS 源码 | MVP 不自动大面积重写 |
| 用户 JavaScript 和自定义运行逻辑 | 用户 JS 源码 | 编辑器不尝试完整结构化 |
| 编辑器生成的静态视觉覆盖 | `html-edit.generated.css` | 由 Style Engine 管理 |
| 稳定 ID、锁定、隐藏、别名、Capability | `graph.json` | HE Project Graph |
| 源码文件与节点绑定 | `graph.json` + 可重建 Source Index | Source Binding |
| 动画、媒体片段、关键帧 | `timeline.json` | HE Timeline |
| 触发器、动作、状态 | `interactions.json` | HE Interaction |
| Undo/Redo、revision、origin | Transaction / Operation Log | 结构化事务 |
| 当前悬停、选择框、面板展开 | 内存 UI Store | 不进入工程权威数据 |
| 当前 DOM Element 引用 | Preview Runtime | iframe 重载后可丢弃 |

### 5.3 运行时两棵树

必须区分：

#### A. Runtime DOM Index

- 由 Preview Bridge 从真实页面生成；
- 覆盖当前页面所有 DOM；
- 含临时 `nodeKey`、边界、computed style、可见性和父子关系；
- iframe 重载后可以重建；
- 不直接写入工程文件。

#### B. Persistent HE Project Graph

- 只保存进入持久编辑系统的对象；
- 对象在第一次被修改、命名、锁定、加入时间线或交互时才取得 `data-he-id`；
- 保存稳定身份、Source Binding、Capability 和编辑器元数据；
- 不复制任意 DOM 的全部属性和样式；
- 不保存 DOM Element 实例。

这样既能让 Agent 查询和操作结构化对象，又不会把整个网页强制转换成私有 JSON。

---

## 6. 工程目录与模块边界

### 6.1 Monorepo 目录

在现有 npm workspaces 基础上扩展：

```text
html-edit/
├─ apps/
│  ├─ desktop/                 # Electron Main / Preload / Packaging
│  └─ editor/                  # React 编辑器壳
│
├─ packages/
│  ├─ schema/                  # Zod 4、JSON Schema、migration
│  ├─ project-graph/           # HE Project Graph
│  ├─ source-binding/          # targetId ↔ source / DOM 绑定
│  ├─ command-core/            # Command、Handler、Validation
│  ├─ transaction-core/        # Transaction、Undo/Redo、revision
│  ├─ preview-bridge/          # iframe 通信、DOM Index、Runtime Adapter
│  ├─ selection-core/          # 已有；纯选择算法
│  ├─ overlay-editor/          # Selection UI、Moveable、Selecto、Guides
│  ├─ source-patch/            # parse5、Magic String、HTML Patch
│  ├─ style-engine/            # PostCSS、CSSTree、generated CSS
│  ├─ timeline-model/          # Scene/Track/Clip/Keyframe Schema
│  ├─ timeline-core/           # logical clock、evaluate、playback plan
│  ├─ timeline-ui/             # 时间线视图与直接操作
│  ├─ interaction-model/       # Trigger/Action/State
│  ├─ interaction-runtime/     # Preview / Export 共用编译器
│  ├─ media-core/              # HTMLMediaElement 同步、波形元数据
│  ├─ project-store/           # 文件、原子保存、恢复、autosave
│  ├─ import-html/             # 普通项目打开、隔离导入
│  ├─ export-html/             # 独立 HTML 项目导出
│  ├─ agent-contract/          # JSON Schema、dry-run、未来 CLI/MCP
│  └─ test-fixtures/           # Golden Projects
│
├─ docs/
│  ├─ architecture/
│  ├─ adr/
│  ├─ schemas/
│  └─ handoff/
└─ package.json
```

### 6.2 依赖方向

固定依赖规则：

```text
schema
  ↑
project-graph / timeline-model / interaction-model
  ↑
command-core
  ↑
transaction-core
  ↑
editor adapters and UI
```

不得出现：

- `schema` 依赖 React；
- `timeline-core` 依赖 `timeline-ui`；
- `project-graph` 保存 DOM Element；
- `command-core` 直接读写 Electron 文件系统；
- `selection-core` 依赖 Moveable；
- UI 组件绕过 Command Gateway 直接改项目 JSON；
- Preview Bridge 成为业务数据权威；
- Agent API 直接写文件。

### 6.3 推荐技术栈

| 层 | 固定技术 | 决策说明 |
|---|---|---|
| 桌面 | Electron 43 | Chromium 150、Node 24.17；适合真实浏览器、CDP、文件系统和 Windows 分发 [R11] |
| UI | React 19.2、Radix UI、CSS Modules | 延续现有方案 |
| 语言 | TypeScript 5.9 | MVP 保持稳定；TS 6.0 是面向 TS 7 的过渡版本，待 M1 后单独升级 [R12] |
| 构建 | Vite 8.x，锁定验证过的精确版本 | 不使用 `latest`；升级必须通过 Electron/Playwright 回归 |
| UI 临时状态 | Zustand | 只保存 session/UI，不作工程数据 |
| Schema | Zod 4 + `z.toJSONSchema()` | 同时服务 TypeScript、文件验证和 Agent Schema [R13] |
| HTML AST | parse5 | 保留 source location |
| 最小 Patch | Magic String | 基于 Source Index 修改区间 |
| CSS | PostCSS + CSSTree | PostCSS 写回；CSSTree 解析、验证和属性语法 |
| 画布控制 | Moveable + Selecto | 仅作 Overlay 控件 |
| 源码编辑 | Monaco | 查看、定位、Diff 和高级编辑 |
| 时间运行 | 自研 evaluator + WAAPI + HTMLMediaElement | 模型不绑定运行库 |
| 本地服务 | Electron Main + Fastify | 受控同源预览服务 |
| 测试 | Vitest + Playwright | Core 单测、Electron/iframe 端到端 |
| 打包 | Electron Forge + GitHub Actions | Windows 安装包和 CI |
| 缓存/Autosave | Dexie/IndexedDB，可选 | 不是工程权威来源 |
| 项目打包 | fflate，可选 | 后期 `.heproj` / Pack Project |

---

## 7. HE Project Graph v0.1

### 7.1 项目文件

MVP 继续使用普通网页文件夹，不强制改成单一二进制工程：

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

后期可以增加“Pack Project”为 `.heproj` ZIP，但不得让用户正常项目失去标准 HTML 独立运行能力。

### 7.2 顶层模型

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

### 7.3 节点投影

```ts
export type HEEditableNode = {
  id: string;                    // 与 data-he-id 一致
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

  capabilities: Array<
    | "text"
    | "attributes"
    | "style"
    | "layout"
    | "transform"
    | "children"
    | "media"
    | "timeline"
    | "interaction"
  >;

  editor: {
    name?: string;
    locked: boolean;
    hidden: boolean;
    selectable: boolean;
  };

  overrideRefs: string[];
};
```

### 7.4 Source Binding

```ts
export type SourceBinding =
  | {
      mode: "source-backed";
      file: string;
      targetId: string;
      tagName: string;
      sourceHash: string;
      sourceRange?: {
        start: number;
        end: number;
      };
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
      reason:
        | "canvas"
        | "webgl"
        | "cross-origin-frame"
        | "closed-shadow-root"
        | "framework-runtime"
        | "unknown-component";
    };
```

规则：

- `sourceRange` 只是缓存，不是稳定身份；
- 每次源文件变化后，以 `targetId + parse index + sourceHash` 重新绑定；
- 找不到对象时标记 `binding-stale`，不得静默绑定到相似元素；
- 用户必须能看到并处理绑定冲突；
- `data-he-id` 删除或重复时必须报错；
- ID 删除后不得复用。

### 7.5 稳定 ID 策略

```text
普通悬停
→ 不写 ID

临时选中但未修改
→ 不写 ID

首次持久操作
→ EnsureStableId Command
→ 最小 Patch 插入 data-he-id
→ 创建 HEEditableNode
→ 后续 Timeline / Interaction / History 共用该 ID
```

持久操作包括：

- 修改文字、属性、样式、位置；
- 命名、锁定、隐藏；
- 加入时间线；
- 创建交互；
- 复制、删除、重排；
- Agent 建立引用。

---

## 8. 节点支持边界

### 8.1 v0.1 完整支持

| 对象 | 能力 |
|---|---|
| 普通容器 `div/section/header/...` | 选择、属性、样式、尺寸、基础布局、transform |
| 文本元素 | 纯文本编辑、字体、字号、行高、字距、颜色、对齐 |
| 图片 | `src`、alt、fit、object-position、尺寸 |
| 视频 | `src`、poster、音量、in/out、播放、时间线 |
| 音频 | `src`、音量、in/out、播放、时间线 |
| SVG 根和基础图形 | 原子/基础图形选择、fill/stroke、transform |
| 链接和按钮 | 文本、属性、样式、交互 |
| 基础表单控件 | value/placeholder/disabled 等安全属性 |
| absolute/fixed 元素 | x/y/width/height/rotate/scale |
| Flex/Grid 容器 | Inspector 中编辑容器属性和子项属性 |

### 8.2 部分支持

| 对象 | 处理 |
|---|---|
| `::before/::after` | 映射到宿主元素，不单独持久化 |
| CSS background image | 编辑宿主背景 |
| Open Shadow Root | 可进入，但通过独立 Frame Path 标识 |
| 同源 iframe | 可进入子文档，单独 page/frameId |
| 自定义 Element | 默认宿主原子编辑；Adapter 声明能力后可展开 |
| JS 动态生成 DOM | Runtime 可选择；只有能建立稳定 Source Binding 才允许源码回写 |
| React/Vue hydrated 区域 | 默认 `component-host`，不保证源码级结构修改 |

### 8.3 必须降级为 opaque/embed

- Canvas/WebGL/Three.js/3DGS 内部对象；
- 跨域 iframe；
- Closed Shadow Root 内部；
- 无法定位源码来源的动态节点；
- 需要执行未知代码才能构造的复杂组件；
- Lottie 等专有运行对象；
- 外部网页中的高风险脚本区。

opaque 节点可以：

- 整体选择；
- 移动、缩放；
- 锁定、隐藏；
- 设置出现时间；
- 触发宿主级交互。

不得编辑其内部结构，除非未来安装对应 Adapter。

---

## 9. Command、Operation 与 Transaction

### 9.1 Canonical API

持久修改的唯一入口是语义 Command，而不是直接 JSON Patch：

```ts
export type HECommand =
  | EnsureStableIdCommand
  | SetTextCommand
  | SetAttributeCommand
  | SetStyleCommand
  | TransformElementCommand
  | InsertElementCommand
  | DeleteElementCommand
  | ReparentElementCommand
  | UpsertKeyframeCommand
  | MoveClipCommand
  | TrimClipCommand
  | UpsertInteractionCommand;
```

每个 Command 必须包含：

```ts
type CommandMeta = {
  commandId: string;
  projectId: string;
  baseRevision: number;
  targetId?: string;
  source: "human" | "system" | "future-agent";
  timestamp: string;
  dryRun?: boolean;
};
```

### 9.2 为什么不直接以 JSON Patch 为主

JSON Patch 是标准的 JSON 操作格式，但路径级修改无法表达：

- CSS cascade 影响；
- Source Binding；
- 删除节点前的引用完整性；
- Move Clip 的吸附与约束；
- Reparent 后的 HTML Patch；
- 权限和 Capability；
- 事务级 Undo；
- 框架/opaque 降级。

因此：

- 语义 Command 是公开 API；
- 内部可以派生 JSON Patch 用于 Diff、日志或传输；
- Agent 不得直接提交任意 `/nodes/...` 路径变更；
- 数组顺序变更必须使用语义命令。

### 9.3 Transaction 流程

```text
1. Parse + Zod validate Command
2. Check baseRevision
3. Resolve targetId and Source Binding
4. Check capability and security policy
5. Plan graph/source/timeline/interaction operations
6. Apply Preview-only mutation
7. Build inverse operations
8. Stage all file writes to temp files
9. Re-parse HTML/CSS and re-validate JSON
10. Atomic commit
11. Increment revision
12. Publish events
13. Push one Undo transaction
```

任何一步失败：

- 不得部分提交；
- Preview 必须回滚；
- 原文件必须保持最后有效版本；
- UI 显示明确错误和受影响文件；
- 失败 Transaction 不进入 Undo 栈。

### 9.4 手势合并

拖动、缩放、时间线拖拽采用：

```text
pointerdown → beginTransaction
pointermove → preview only
pointerup   → one semantic Command / one Transaction
Escape      → rollback preview
```

不得每一帧产生一条历史记录。

---

## 10. 真实 DOM 画布与 Overlay

### 10.1 三种运行模式

#### Trusted Edit Canvas

- 加载当前本地项目；
- 运行在随机 token 的 `127.0.0.1` 同源服务；
- 页面无 Node/Electron 权限；
- 编辑器在捕获阶段接管选择和直接操作；
- 必要用户脚本可以运行，但导航、下载、弹窗和高风险权限受控；
- Preview Bridge 只通过白名单消息通信。

#### Preview Mode

- 页面交互、链接、动画和媒体按最终运行方式执行；
- 编辑 Overlay 停止拦截；
- 仍保持 sandbox、无 Node 集成；
- 使用独立 session，返回编辑模式时恢复可控状态。

#### Quarantine Import

- 用于外部 HTML/远程网页导入；
- 默认禁止脚本；
- DOMPurify 只用于导入清洗，不用于信任未知代码；
- 网络请求和跨域资源受限制；
- 导入后生成静态副本和风险报告；
- 未经用户明确处理不得进入普通项目模式。

### 10.2 Electron 安全固定项

```ts
{
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true
}
```

Electron 官方安全指南明确要求同时使用 Context Isolation 与进程沙箱。[R14]

还必须：

- 不使用 `<webview>`；
- Preload 只暴露最小白名单 API；
- 校验 IPC sender、origin、sessionId、projectId、revision；
- 路径必须 `realpath` 后确认位于项目根；
- 拒绝 `..`、符号链接逃逸和协议绕过；
- 外部 URL 交给系统浏览器；
- 禁止页面调用任意文件系统；
- Bridge 消息全部使用 Zod Schema；
- 所有 project server 只绑定 loopback；
- 关闭项目后立即撤销 token 和 server。

### 10.3 Selection 与 Overlay

继续执行现有 `selection-system.md`：

```text
Coordinate Mapper
→ caret/Range text hit
→ elementsFromPoint
→ descendant geometry
→ CDP fallback
→ candidate normalize
→ visibility/lock/editor filter
→ semantic rank
→ SelectionCandidateStack
```

Moveable/Selecto 只负责：

- 选中框；
- 控制点；
- 拖动/缩放/旋转的 pointer handling；
- 框选区域；
- 吸附提示。

它们不得负责：

- 选择语义；
- 稳定 ID；
- 源码持久化；
- Undo/Redo；
- 时间线数据。

Selecto 必须通过 `getElementRect` 使用旋转后四点几何，不能只依赖轴对齐 bounding box。

---
