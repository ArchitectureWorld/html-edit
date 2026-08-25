# HTML Edit 源码回写、时间线、交互与 Agent 架构

> 状态：技术架构执行规范 v2 的组成部分  
> 日期：2026-08-25  
> 主索引：[`technical-architecture.md`](technical-architecture.md)

## 11. 布局与视觉编辑策略

### 11.1 属性来源分层

Inspector 必须显示每个属性的来源：

```text
User Source
→ Inherited / Cascade
→ HTML Edit Static Override
→ Timeline Sample
→ Interaction State
→ Final Computed Value
```

用户必须能看见：

- 当前值；
- 来源文件和选择器；
- 是否被覆盖；
- HTML Edit 是否生成 override；
- 是否处于动画或交互控制；
- 清除 override 后将恢复什么值。

### 11.2 generated CSS

默认写入：

```css
[data-he-id="he_xxx"] {
  color: #fff;
  width: 320px;
}
```

规则：

- stylesheet 放在用户 CSS 之后；
- 一项 `targetId` 对应可追踪的受控规则；
- PostCSS 管理写回和格式；
- CSSTree 验证属性和值；
- 空规则必须删除；
- 无效声明不得写入；
- `!important` 只能由用户明确选择或 Cascade Resolver 判定后提示使用；
- 清除 HTML Edit Override 不得删除用户原 CSS。

### 11.3 Transform 策略

为避免覆盖用户已有 `transform`，MVP 优先使用现代 CSS individual transform properties：

```css
[data-he-id="he_xxx"] {
  translate: 24px 10px;
  rotate: 5deg;
  scale: 1.1;
}
```

固定行为：

- absolute/fixed 元素：优先编辑 inset/width/height，旋转缩放使用 individual transforms；
- normal-flow 元素：拖动默认形成视觉 `translate`，不得悄悄改变文档流；
- Flex/Grid：排序、对齐、间距通过 Layout Inspector；自由拖动不自动猜测复杂重排；
- Resize 必须显示将修改 `width/height`、flex-basis 还是 grid 属性；
- 修改前记录 computed geometry，修改后验证边界误差；
- 遇到不可逆 transform matrix 时，保留原 transform，新增独立 transform，并标记高级状态。

---

## 12. Source Patch Engine

### 12.1 HTML Patch

```text
Original source
→ parse5 with sourceCodeLocationInfo
→ Source Index
→ targetId resolve
→ semantic patch plan
→ Magic String minimal edits
→ parse validation
→ source binding rebuild
→ atomic save
```

禁止：

```text
DOM → outerHTML → whole file overwrite
```

必须实现的 Patch 类型：

- 插入/删除 `data-he-id`；
- 修改 text node；
- 设置/删除 attribute；
- 修改 `src/href/poster`；
- 插入、删除、移动可支持元素；
- 插入 generated CSS link；
- 保持无关注释、空白、脚本和格式。

### 12.2 Source Binding 漂移

文件被外部编辑后：

1. file watcher 检测 hash 变化；
2. 暂停持久 Command；
3. 重新 parse；
4. 按稳定 ID 重建 Source Index；
5. 比较 graph revision 与文件 hash；
6. 无冲突则更新 binding；
7. 冲突则显示：
   - reload external；
   - keep editor；
   - open three-way diff；
8. 未解决前不得覆盖外部修改。

### 12.3 CSS Patch

MVP 不自动重写复杂用户 CSS。只允许：

- 修改 `html-edit.generated.css`；
- 用户在 Monaco 中主动编辑原 CSS；
- 后期通过“Apply to source rule”显式迁移 override。

---

## 13. Timeline v0.1

### 13.1 自研原因

时间线是产品成立能力，不能绑定到 Scene.js、Theatre、GSAP 或 WAAPI 的私有格式。外部运行库可以替换，项目数据必须稳定。

### 13.2 数据模型

```ts
type HETimeline = {
  id: string;
  durationUs: number;
  tracks: HETrack[];
  markers: HEMarker[];
};

type HETrack =
  | HEDomAnimationTrack
  | HEVideoTrack
  | HEAudioTrack
  | HEEventTrack;

type HEClip = {
  id: string;
  startUs: number;
  durationUs: number;
  sourceInUs: number;
  playbackRate: number;
  enabled: boolean;
};

type HEKeyframe = {
  id: string;
  timeUs: number;
  property: AnimatableProperty;
  value: HEValue;
  easing: HEEasing;
};
```

### 13.3 时间单位

v2 规定：

- canonical 时间使用整数微秒 `timeUs`；
- UI 可以显示毫秒或帧；
- FPS 使用有理数 `{numerator, denominator}`；
- 不使用浮点秒作为持久数据；
- 现有尚未形成生产数据的 `timeMs` 示例应迁移为 `timeUs`。

原因：

- 避免长时间项目浮点漂移；
- 兼容 29.97/59.94 等帧率；
- 更适合媒体和后续逐帧导出。

### 13.4 Deterministic Evaluator

核心 API：

```ts
evaluate(project, timelineId, timeUs): EvaluationFrame
```

同一项目、同一时间必须返回完全相同的：

- DOM property samples；
- media currentTime；
- element visibility；
- active clips；
- event boundary；
- interaction state snapshot。

`Timeline Core` 不保存 React 状态、DOM Element、Animation 对象或媒体实例。

### 13.5 播放后端

```text
HE Timeline
→ Normalize / Validate
→ Playback Plan
→ logical clock
├─ DOM → WAAPI / direct sampled style
├─ Video/Audio → HTMLMediaElement
└─ Event → Interaction Runtime
```

规则：

- `performance.now()` 驱动 logical clock；
- `HTMLMediaElement.timeupdate` 频率会变化，不能作为主时钟；
- Scrub 时直接 evaluate；
- 媒体 seek 等待 `seeked` 或超时，提供 pending 状态；
- 播放时按误差阈值修正媒体，而不是每帧强制 seek；
- WAAPI 只是加速后端，seek 结果必须可由 evaluator 重建；
- Preview 与 Export 使用同一个 compiler。

### 13.6 第一版能力

- play / pause / seek / scrub；
- playhead、zoom、snap；
- track lock/hide/mute；
- clip move/trim/split/copy；
- keyframe add/delete/move/copy；
- linear、step、cubic-bezier；
- DOM、Video、Audio、Event；
- 简单场景进入/退出；
- 轨道虚拟化预留。

高级曲线、调色、音频效果和嵌套合成后置。

---

## 14. Interaction v0.1

### 14.1 Trigger

- `click`
- `hover-enter`
- `hover-leave`
- `scene-enter`
- `in-view`
- `time`

### 14.2 Action

- `timeline.play`
- `timeline.pause`
- `timeline.seek`
- `element.show`
- `element.hide`
- `state.set`
- `media.play`
- `media.pause`
- `navigation.anchor`
- `navigation.scene`

### 14.3 冲突解析

最终属性优先级必须由统一 Resolver 决定：

```text
User source base
→ HTML Edit static override
→ Timeline sampled value
→ active interaction override
```

每个最终值带 provenance，Inspector 能显示控制来源。不得让：

- WAAPI 偷偷保留 fill 状态；
- hover CSS 与 Interaction Runtime 互相覆盖而不可解释；
- 页面自有脚本直接修改后让编辑器认为数据已保存。

未知页面脚本造成的 Runtime Mutation 只视为运行状态，除非用户执行“Capture as edit”。

---

## 15. JSON、Schema、Operation Log 与 CRDT

### 15.1 JSON 决策

JSON 适合作为 v0.1 的持久化与开放交换格式，因为：

- 人和开发 Agent 可读；
- Git Diff 可审查；
- TypeScript 支持自然；
- 便于 migration；
- 便于生成 CLI/MCP Schema；
- Zod 4 可直接导出 JSON Schema。[R13]

但 JSON 不等于运行时内核。运行时可以使用 `Map`、索引和类封装。

### 15.2 暂不采用

| 技术 | MVP 决策 | 原因 |
|---|---|---|
| Protobuf / FlatBuffers | 不采用 | 调试与 Agent 可读性差，当前性能收益不成立 |
| CBOR / MessagePack | 不采用 | 只节省体积，不解决核心问题 |
| SQLite | 不作工程权威 | 浏览器/桌面双环境复杂，Git Diff 差 |
| CRDT / Yjs | 后置 | 单机人工闭环未稳定前会放大数据模型复杂度 |
| 裸 JSON Patch | 不作公开命令 | 语义和约束不足 |

### 15.3 Operation Log

```json
{
  "operationId": "op_01...",
  "transactionId": "tx_01...",
  "revisionBefore": 12,
  "revisionAfter": 13,
  "commandType": "element.style.set",
  "targetId": "he_title",
  "source": "human",
  "timestamp": "2026-08-25T08:00:00Z"
}
```

Operation Log 用于：

- 崩溃恢复；
- 调试；
- Undo/Redo；
- Agent 审计；
- 未来协同映射。

不得用它代替定期快照。

### 15.4 Yjs 引入时机

Yjs Shared Types 和 UndoManager 适合多人协同及选择性 Undo。[R15] 但只有以下条件全部满足后才允许引入：

- Command Schema 已稳定；
- Stable ID 不再频繁变化；
- Transaction origin 已统一；
- Timeline array/order 语义已固定；
- Source Patch 冲突策略已验证；
- 单机 save/reopen 和 undo/redo 已通过长期测试。

未来 Yjs 必须包在 Collaboration Adapter 中，不能渗入所有 Core 类型。

---

## 16. Agent、CLI 与 MCP

### 16.1 MVP 原则

前三个月不把 Agent 做成产品主入口，但从第一天保证：

- 所有 Command 有 Zod Schema；
- 可导出 JSON Schema；
- 所有对象有稳定 ID；
- 所有修改支持 `dryRun`；
- 所有修改检查 `baseRevision`；
- 所有结果返回 structured diagnostics；
- 人工与未来 Agent 共用相同 Command Handler。

### 16.2 禁止方式

Agent 不得：

- 直接修改 `graph.json`；
- 直接操作 DOM 并声称已保存；
- 直接替换整份 HTML；
- 跳过 revision；
- 对 opaque node 猜测内部结构；
- 以 CSS selector 代替稳定 ID；
- 绕过安全项目根目录；
- 在未 dry-run 时执行跨文件高风险修改。

### 16.3 后续 CLI

人工闭环完成后实现：

```text
he project inspect
he project validate
he node list
he node get <id>
he node set-text <id> --value ...
he node set-style <id> --property ... --value ...
he timeline list
he timeline keyframe upsert ...
he interaction upsert ...
he command dry-run <json>
he command apply <json>
he diff
```

所有命令支持：

```text
--json
--project-root
--base-revision
--dry-run
```

### 16.4 MCP

MCP 只包装同一个 `CommandService`：

```text
MCP Tool
→ JSON Schema validate
→ CommandService.dryRun/apply
→ Transaction
→ structured result
```

参考 OpenPencil 的：

- live app 与 headless 共用工具；
- JSON 输出；
- 项目根目录范围；
- inspect/modify/export 分层；
- Agent skill 文档。

不得照搬其 Figma 工具语义。

---
