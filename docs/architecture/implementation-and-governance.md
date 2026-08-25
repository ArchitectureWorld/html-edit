# HTML Edit 实施计划、质量门槛与工程治理

> 状态：技术架构执行规范 v2 的组成部分  
> 日期：2026-08-25  
> 主索引：[`technical-architecture.md`](technical-architecture.md)

## 17. 具体“借什么、不借什么”总表

| 来源 | 直接复用 | 只借鉴 | 明确不采用 |
|---|---|---|---|
| OpenPencil | 暂无核心依赖；后期 Adapter | 包边界、SceneGraph 索引、CLI/MCP、Layers 虚拟化、格式 Adapter | CanvasKit 主画布、Figma 节点模型、完整 Fork |
| GrapesJS | 暂无 | iframe Canvas、Model/View、Style/Layer UX、插件组织 | Project JSON、整页重新生成 |
| Webstudio | 暂无 | CSS 来源、断点、Token、Flex/Grid Inspector | AGPL Core、专有动画包 |
| Puck | 后期可参考 Config Schema | Component Registry、Field Inspector | React Data 作为统一网页模型 |
| Moveable | **是** | — | 语义选择和持久化 |
| Selecto | **是** | — | 默认 bounding-box 作为最终准确命中 |
| Guides | PoC 后可用 | 标尺、辅助线 | — |
| InfiniteViewer | 条件引入 | 缩放/平移 | 在普通 iframe 可满足时增加复杂度 |
| Scena | 否 | 时间线/画布联动、属性轨道 | Fork、Scene.js 数据作为 HE Timeline |
| Scene.js | 默认否 | CSS 动画编译思路 | canonical runtime |
| Theatre.js | 否 | 曲线编辑、Sequence UX | AGPL Studio、项目格式 |
| Excalidraw | 否 | 易读 JSON、快捷键、Undo UX | Canvas Scene |
| Penpot | 否 | Flex/Grid、组件和约束 UI | 完整技术栈 |
| Konva/Fabric | 否 | 未来 opaque Canvas Adapter | 主画布 |
| Remotion | 后期合法审查后 Adapter | 程序化逐帧视频和 Agent workflow | 核心时间线、默认商业依赖 |
| FFmpeg | 后期受控构建 | 编码/封装 | 未审计的 GPL/nonfree 构建 |
| HyperFrames | 后期 Adapter | HTML 组合转视频、字幕与转场 | 编辑器内核 |
| Zod 4 | **是** | — | 手写重复 JSON Schema |
| Yjs | MVP 否 | transaction origin、shared types 思路 | 过早渗入 Core |

---

## 18. 16 周 MVP 实施计划

### 18.1 Phase 0：架构验证（W1–W2）

目标：在继续扩展 UI 前证明四个高风险核心成立。

| Spike | 内容 | Gate |
|---|---|---|
| SP-01 | iframe + Preview Bridge + 复杂 DOM 选择 | 5000 DOM 节点选择性能达标 |
| SP-02 | stable ID + parse5 + Magic String round-trip | 只改目标区间；保存重开一致 |
| SP-03 | HE Project Graph + Source Binding | 外部修改后可重建绑定或明确冲突 |
| SP-04 | Timeline deterministic seek + video seek | 任意 seek 结果可重复 |
| SP-05 | Moveable/Selecto host overlay | 缩放、滚动、旋转坐标正确 |
| SP-06 | 依赖许可证与版本锁 | 无未审计 AGPL/专有核心依赖 |

未通过 Gate 不进入下一阶段。

### 18.2 Phase 1：真实 HTML 编辑闭环（W3–W6）

```text
Open
→ Select
→ Ensure Stable ID
→ Edit Text/Style/Transform
→ Undo/Redo
→ Save
→ Reopen
```

交付：

- Electron Editor Shell；
- Preview Server / Bridge；
- Selection Core 集成；
- Layers / Inspector；
- Moveable / Selecto；
- Project Graph / Binding；
- Command / Transaction；
- HTML/CSS Patch；
- 原子保存和恢复；
- Golden Projects。

### 18.3 Phase 2：时间线与媒体（W7–W10）

交付：

- Timeline Schema；
- deterministic evaluator；
- Playhead / zoom / snap；
- Track/Clip/Keyframe UI；
- WAAPI adapter；
- video/audio adapter；
- trim/split/copy；
- DOM/媒体同步；
- Timeline Undo/Redo。

### 18.4 Phase 3：交互与独立导出（W11–W13）

交付：

- Trigger/Action Schema；
- Interaction Compiler；
- Edit/Preview 模式切换；
- HTML Runtime 注入；
- 导出后页面独立运行；
- runtime error panel；
- source/generated diff。

### 18.5 Phase 4：稳定化与交付（W14–W16）

交付：

- Windows 安装包；
- CI、Playwright、性能基线；
- 崩溃恢复和 file watcher；
- 10 分钟复杂 Demo；
- Schema 文档和 Agent Contract；
- 下一阶段 CLI/MCP 入口；
- 许可证清单和第三方 notices。

Agent 正式入口、多人协同、最终 MP4 和 OpenPencil Adapter 均在 MVP 通过后排期。

---

## 19. 开发任务清单

以下任务 ID 是开发 Agent 的直接执行单元。未满足依赖不得并行越级实现。

| ID | 包/范围 | 任务 | 依赖 | 验收 |
|---|---|---|---|---|
| ADR-001 | `docs/adr` | 写入本文 10 项架构决策 | 无 | **已完成：文档、目录、交叉链接完整** |
| PLT-001 | `apps/desktop`,`apps/editor` | Electron/React/Vite 骨架与进程安全 | ADR-001 | 窗口可启动；安全配置测试通过 |
| SCH-001 | `schema` | Zod 4 基础类型、ID、revision、migration | ADR-001 | 导出 TS 类型和 JSON Schema |
| GRF-001 | `project-graph` | HE Graph、节点索引、引用完整性 | SCH-001 | 10k 节点增删查与序列化测试 |
| BND-001 | `source-binding` | Stable ID、SourceBinding、stale conflict | GRF-001 | 外部编辑后重建/冲突测试 |
| CMD-001 | `command-core` | Command Gateway、Handler Registry、dry-run | SCH-001 | 每个 Command 有 Schema 和诊断 |
| TXN-001 | `transaction-core` | revision、inverse、Undo/Redo、手势合并 | CMD-001 | 1000 次随机事务无状态漂移 |
| PRV-001 | `preview-bridge` | 本地服务、注入、DOM Index、消息 Schema | PLT-001,SCH-001 | 重载后 DOM Index 可重建 |
| SEL-001 | `selection-core` | 整合现有选择核心并补齐契约测试 | PRV-001 | `selection-system.md` 全部 Golden Case |
| OVL-001 | `overlay-editor` | Moveable/Selecto/Guides 接入 | SEL-001 | zoom/scroll/rotate/iframe 坐标正确 |
| SRC-001 | `source-patch` | parse5 Source Index、ID/text/attr Patch | BND-001,TXN-001 | 无关源码字节不变化 |
| CSS-001 | `style-engine` | generated CSS、来源追踪、清除 override | SRC-001 | CSS parse/validate/save/reopen 通过 |
| EDT-001 | `apps/editor` | Layers、Inspector、Monaco Diff | GRF-001,OVL-001,CSS-001 | 同步选择；属性来源可见 |
| STO-001 | `project-store` | 原子保存、history、autosave、恢复 | TXN-001,SRC-001 | 中断写入不损坏最后有效版本 |
| TML-001 | `timeline-model` | `timeUs` Schema、migration、引用验证 | SCH-001 | Schema 和边界测试 |
| TML-002 | `timeline-core` | evaluate、logical clock、Playback Plan | TML-001 | 同时刻重复 evaluate 完全一致 |
| TML-003 | `timeline-ui` | playhead、zoom、track、clip、keyframe | TML-002,TXN-001 | 所有编辑进入一个 Transaction |
| MED-001 | `media-core` | video/audio load、seek、trim、sync | TML-002 | scrub 后媒体误差在验收阈值内 |
| INT-001 | `interaction-*` | Trigger/Action/State、Resolver | TML-002,CMD-001 | Preview/Export 结果一致 |
| EXP-001 | `export-html` | runtime/compiler、独立项目导出 | INT-001,CSS-001 | 无编辑器运行也可正常打开 |
| SEC-001 | 全局 | 安全策略、路径、IPC、quarantine | PRV-001,STO-001 | 页面无法访问 Node/任意文件 |
| TST-001 | `test-fixtures` | Golden Projects、visual/perf regression | 各模块 | CI 阻止回归 |
| PKG-001 | `apps/desktop` | Forge、Windows installer、notices | SEC-001,TST-001 | 干净 Windows 可安装运行 |
| AGT-001 | `agent-contract` | Schema 导出、dry-run、structured result | MVP Gate | 不直接写文件，复用 CommandService |
| ADP-001 | `adapter-openpencil` | `.pen` 映射 PoC | MVP Gate,AGT-001 | 显式损失报告；不污染 Core |

---

## 20. 第一批 PR 顺序

开发 Agent 应按下列 PR 拆分，不提交一个超大 PR：

1. `docs/architecture-v2-and-adrs`（本次已完成）
2. `chore/monorepo-app-shell`
3. `feat/schema-project-graph`
4. `feat/source-binding-command-transaction`
5. `feat/preview-bridge-contract`
6. `feat/selection-overlay`
7. `feat/source-patch-style-engine`
8. `feat/editor-closed-loop`
9. `feat/timeline-model-core`
10. `feat/timeline-ui-media`
11. `feat/interaction-export-runtime`
12. `test/golden-projects-hardening`
13. `release/windows-mvp`

每个 PR 必须：

- 只实现对应任务 ID；
- 包含单元/集成测试；
- 更新相应文档；
- 不改变已冻结 ADR；
- 通过 `lint → typecheck → test → build → smoke`；
- 提供人工验收步骤；
- 明确第三方依赖和许可证；
- 无“后面再补测试”的占位承诺。

---

## 21. 测试与质量门槛

### 21.1 Core 测试

必须覆盖：

- Schema parse/migration；
- Stable ID 唯一性；
- Source Binding 重建；
- Command validation；
- revision conflict；
- Transaction rollback；
- Undo/Redo；
- HTML Patch escaping；
- CSS parse/cascade provenance；
- Timeline trim/split/move；
- deterministic evaluate；
- Interaction resolve；
- atomic save failure。

### 21.2 Golden Projects

至少包含：

1. 单文件 HTML；
2. 多 CSS/JS 文件；
3. Flex；
4. Grid；
5. absolute/transform；
6. 深层嵌套文字；
7. 透明遮罩；
8. `pointer-events:none`；
9. SVG；
10. video/audio；
11. 同源 iframe；
12. Shadow DOM；
13. Canvas/WebGL opaque；
14. 5000 DOM 节点；
15. 10 分钟、500 Clip 时间线；
16. 外部文件修改冲突；
17. 页面脚本运行错误；
18. 导出后独立运行。

### 21.3 性能门槛

- 5000 DOM 节点：
  - fast hover hit-test p95 `< 32ms`；
  - click candidate stack p95 `< 50ms`；
- 常规 1000 DOM 节点页面：
  - 拖动 Overlay 目标 60fps；
  - 不持续触发全树 layout scan；
- 10 分钟 / 500 Clip：
  - 时间线滚动与缩放不持续阻塞主线程；
  - seek 后首个可见状态 `< 100ms`，媒体可异步进入 ready；
- 10k HE 节点：
  - 按 ID 查询近似 O(1)；
  - Layers 使用虚拟化；
- 保存：
  - 无关文件不修改；
  - 失败不得损坏最后有效版本。

### 21.4 一致性门槛

```text
Open → Edit → Save → Reopen
```

必须满足：

- normalized HE Graph 一致；
- 目标 HTML/CSS 变更准确；
- 未触及源码无无意义 Diff；
- Timeline 同一 timeUs 结果一致；
- Preview 与 Export 核心状态一致；
- Undo 回到原始源文件 hash 或等价规范化状态。

### 21.5 安全门槛

- 页面脚本无法获得 Node；
- 页面无法读取项目根以外文件；
- 跨域 iframe 作为 opaque；
- Quarantine 模式不执行未知脚本；
- IPC 消息伪造被拒绝；
- session token 过期后失效；
- 外部导航不替换编辑器窗口；
- file path traversal 测试通过。

---

## 22. 风险与控制

| 风险 | 可能结果 | 控制 |
|---|---|---|
| 任意 HTML 无法完整结构化 | 误改源码 | Project Graph 只做投影；不理解则 opaque |
| CSS cascade 复杂 | Inspector 与画面不一致 | provenance + generated CSS + computed verification |
| JS 动态 DOM 无源码位置 | 保存失真 | runtime-only 或 component-host，不承诺回写 |
| 绑定因外部编辑漂移 | 修改错对象 | stable ID + hash + stale conflict |
| iframe 坐标复杂 | 选框错位 | 单一 Coordinate Mapper + Golden Tests |
| Moveable 改坏布局 | 页面结构变化 | 预览与提交分离；布局策略显式 |
| 媒体 seek 不稳定 | scrub 错帧 | logical clock、ready state、误差修正 |
| 时间线绑定某运行库 | 后期无法替换 | 自研 model/evaluator，Adapter 后端 |
| OpenPencil 功能诱惑导致 Fork | 核心路线漂移 | ADR 禁止 Fork；只按借鉴表执行 |
| AGPL/专有依赖进入核心 | 商业与分发风险 | dependency allowlist + notices + CI license scan |
| 过早引入 Agent/CRDT | 人工体验未完成 | MVP Gate 后才允许 |
| 功能扩张 | 16 周无法闭环 | opaque policy + 三阶段 Gate |

---

## 23. 冻结的 ADR

### ADR-001：采用混合路线

自研产品内核，复用通用基础库；不 Fork 完整编辑器。

### ADR-002：真实 DOM 是画布

编辑和最终运行均基于 Chromium DOM，不以 CanvasKit/Konva/Fabric 模拟网页。

### ADR-003：双权威域

HTML/CSS/JS 与 HE Project Graph 各自负责明确数据域，通过 Source Binding 和 Transaction 保持一致。

### ADR-004：语义 Command 是唯一持久修改入口

UI、Agent、CLI、MCP 均不得直接修改文件或项目 JSON。

### ADR-005：自研 deterministic Timeline

Scene.js、Theatre、WAAPI、GSAP、Remotion 均不得成为 canonical timeline model。

### ADR-006：未知能力降级为 opaque

不得为了“看起来支持”而猜测性重建未知网页结构。

### ADR-007：JSON 是持久格式，不是产品本体

运行时使用适合的索引和对象；JSON 负责保存、交换和 Agent Schema。

### ADR-008：CRDT 后置

先完成单机事务和源码冲突，再评估 Yjs。

### ADR-009：人工优先、Agent 后置

从第一天保留 Agent 契约，但不延误人工闭环。

### ADR-010：OpenPencil 只作为参考与后期 Adapter

不得以其 Core、CanvasKit renderer 或 Figma SceneNode 替换 HE Core。

未经新 ADR、技术负责人审查和迁移方案，不得更改以上决策。

---

## 24. 开发 Agent 执行契约

开发 Agent 接到任务后必须：

1. 先读取本文、相关 ADR、目标包 README 和依赖任务；
2. 只处理被分配的任务 ID；
3. 先写或补齐失败测试，再实现；
4. 使用公开包出口，不跨包导入内部文件；
5. 不引入未经批准的新编辑器框架；
6. 不修改产品数据权威关系；
7. 不用整页序列化替代 Source Patch；
8. 不用 DOM Element、WAAPI Animation、React State 作为持久数据；
9. 所有新持久数据都有 Zod Schema、`schemaVersion` 和 migration 策略；
10. 所有新 Command 有 validation、dry-run、revision、inverse/rollback；
11. 所有第三方依赖记录版本、许可证、用途和替代方案；
12. 完成前运行全部验证命令并粘贴真实结果；
13. 提交人工验收步骤和已知限制；
14. 不以“以后再完善”掩盖未达到验收条件；
15. 遇到未定义 Web 能力时降级为 opaque，并提交诊断，不自行扩大范围。

### Definition of Done

一个任务只有同时满足以下条件才算完成：

- 代码已实现；
- 类型检查通过；
- 单元测试通过；
- 相关集成/Playwright 测试通过；
- 文档更新；
- 无未解释许可证；
- 无直接绕过 Command/Transaction；
- 无无关源码重写；
- 失败路径已测试；
- 人工验收步骤可复现；
- PR 与任务 ID 一一对应。

---

## 25. 立即执行的第一批任务

现有仓库已经有 `selection-core`，且 ADR-001 已由本次文档同步完成。下一步不应继续单独深化 UI，而应先补齐其上游基础。

固定顺序：

```text
SCH-001
→ GRF-001
→ BND-001
→ CMD-001
→ TXN-001
→ PRV-001
→ 将已有 selection-core 接入真实 Preview
→ OVL-001
→ SRC-001 / CSS-001
→ 完成第一阶段人工闭环
```

### 第一阶段 Gate

只有以下全部通过，才开始 Timeline：

```text
打开标准 HTML 项目
→ 第一次点击选择正确视觉对象
→ 修改文字和样式
→ 拖动/缩放
→ Undo/Redo
→ 安全保存
→ 关闭重开
→ 页面独立运行
→ 无关源码无大面积变化
→ 外部修改冲突可见
```

---

## 26. 最终建议

HTML Edit 的正确路线不是“找一个最像的开源产品然后改”，而是：

> **把产品独特的部分牢牢掌握在自己手里，把已经被开源生态证明成熟的底层能力按边界复用。**

必须自研的是：

- HE Project Graph；
- Source Binding；
- Command / Transaction；
- 视觉语义 Selection；
- Source Patch；
- CSS provenance；
- deterministic Timeline；
- Interaction Compiler；
- Preview/Export 一致性。

应该直接复用的是：

- Electron/Chromium；
- React；
- Zod；
- parse5；
- Magic String；
- PostCSS/CSSTree；
- Moveable/Selecto；
- Monaco；
- Vitest/Playwright；
- Electron Forge。

应该借鉴但不绑定的是：

- OpenPencil 的模块化、格式 Adapter、CLI/MCP；
- GrapesJS 的 Model/View 和 iframe Canvas；
- Webstudio 的 CSS Inspector；
- Puck 的组件 Schema；
- Scena/Theatre 的时间线 UX；
- Penpot 的 Flex/Grid 设计体验；
- Remotion/HyperFrames 的后期视频输出工作流。

因此，项目应继续在现有仓库中推进，采用本文件定义的 **Balanced Projection Graph Architecture**，而不是重开、Fork 或换底座。

---

# 参考资料

> 以下均优先列出官方仓库、官方文档或规范。访问日期：2026-08-25。

- **[R1] OpenPencil Repository**  
  https://github.com/open-pencil/open-pencil

- **[R2] OpenPencil Agent/Architecture Guide**  
  https://github.com/open-pencil/open-pencil/blob/master/AGENTS.md

- **[R3] GrapesJS Component Manager — Component/Model as Source of Truth**  
  https://grapesjs.com/docs/modules/Components.html

- **[R4] Webstudio Repository and License**  
  https://github.com/webstudio-is/webstudio

- **[R5] Puck — Visual Editor for React**  
  https://github.com/puckeditor/puck

- **[R6] Selecto — Accurate Selection with Moveable Geometry**  
  https://github.com/daybrush/selecto

- **[R7] Scena — Scene.js Timeline Editor**  
  https://github.com/daybrush/scena

- **[R8] Theatre.js License Split**  
  https://github.com/theatre-js/theatre/blob/main/README.md

- **[R9] Remotion License**  
  https://www.remotion.dev/license

- **[R10] FFmpeg License and Legal Considerations**  
  https://www.ffmpeg.org/legal.html

- **[R11] Electron 43 Release**  
  https://electronjs.org/blog/electron-43-0

- **[R12] TypeScript 6.0 Transition Release / TypeScript 5.9**  
  https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html  
  https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html

- **[R13] Zod 4 JSON Schema**  
  https://zod.dev/json-schema

- **[R14] Electron Security Guide**  
  https://electronjs.org/docs/latest/tutorial/security

- **[R15] Yjs UndoManager and Collaborative Shared Types**  
  https://docs.yjs.dev/api/undo-manager  
  https://docs.yjs.dev/getting-started/a-collaborative-editor

- **Supplementary: Moveable**  
  https://github.com/daybrush/moveable

- **Supplementary: Scene.js**  
  https://github.com/daybrush/scenejs

- **Supplementary: Penpot**  
  https://github.com/penpot/penpot

- **Supplementary: Excalidraw**  
  https://github.com/excalidraw/excalidraw

- **Supplementary: Konva**  
  https://github.com/konvajs/konva

- **Supplementary: Fabric.js**  
  https://github.com/fabricjs/fabric.js

---

## 附录 A：依赖准入表

核心产品默认允许的许可证：

```text
MIT
BSD-2-Clause
BSD-3-Clause
Apache-2.0
ISC
```

需法律审查：

```text
MPL-2.0
LGPL
AGPL
GPL
Source-available / commercial dual license
任何自定义 EULA
```

任何 Agent 新增依赖前必须记录：

```json
{
  "package": "name",
  "version": "exact version",
  "license": "SPDX",
  "purpose": "why it is needed",
  "scope": "runtime | dev | optional-adapter",
  "alternatives": ["..."],
  "approvedBy": "..."
}
```

## 附录 B：项目 Schema 示例

```json
{
  "schemaVersion": "0.1.0",
  "projectId": "project_demo",
  "revision": 12,
  "entry": "index.html",
  "fps": {
    "numerator": 30,
    "denominator": 1
  },
  "pages": {
    "page_main": {
      "id": "page_main",
      "entry": "index.html",
      "name": "Main"
    }
  },
  "nodes": {
    "he_title": {
      "id": "he_title",
      "pageId": "page_main",
      "parentId": null,
      "childIds": [],
      "kind": "text",
      "sourceBinding": {
        "mode": "source-backed",
        "file": "index.html",
        "targetId": "he_title",
        "tagName": "h1",
        "sourceHash": "sha256:..."
      },
      "capabilities": [
        "text",
        "attributes",
        "style",
        "transform",
        "timeline",
        "interaction"
      ],
      "editor": {
        "name": "Hero title",
        "locked": false,
        "hidden": false,
        "selectable": true
      },
      "overrideRefs": [
        "override_he_title"
      ]
    }
  },
  "assets": {},
  "settings": {
    "stableIdAttribute": "data-he-id"
  }
}
```

## 附录 C：Command 示例

```json
{
  "type": "element.style.set",
  "commandId": "cmd_01J...",
  "projectId": "project_demo",
  "baseRevision": 12,
  "targetId": "he_title",
  "source": "human",
  "timestamp": "2026-08-25T08:00:00Z",
  "dryRun": false,
  "payload": {
    "property": "font-size",
    "value": "72px"
  }
}
```

预期返回：

```json
{
  "ok": true,
  "transactionId": "tx_01J...",
  "revisionBefore": 12,
  "revisionAfter": 13,
  "filesChanged": [
    "html-edit.generated.css",
    ".html-edit/graph.json",
    ".html-edit/operations.ndjson"
  ],
  "diagnostics": [],
  "previewApplied": true
}
```
