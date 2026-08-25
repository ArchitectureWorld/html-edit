# HTML Edit 开发 Agent 执行规范

本文件适用于仓库全部目录。开发 Agent、代码审查 Agent 和测试 Agent 必须遵守。

## 1. 开始任务前必须阅读

按顺序阅读：

1. `docs/product-core.md`
2. `docs/architecture/technical-architecture.md`
3. `docs/engineering-plan.md`
4. 当前任务涉及的子系统规范，例如 `docs/selection-system.md`
5. `docs/adr/0001-core-architecture-decisions.md`

若文档冲突：

- 产品目标和范围以 `product-core.md` 为准；
- 架构与开源选型以 `technical-architecture.md` 和 ADR 为准；
- 任务顺序、包边界和验收以 `engineering-plan.md` 为准；
- 子系统细节以对应专项规范为准。

不得沿用旧版“HTML/CSS/JS 是唯一 Source of Truth”的说法。当前固定模型是：

```text
源码权威域
+
HE Project Graph 权威域
+
Source Binding
+
Transaction Coordinator
```

## 2. 当前冻结决策

开发过程中不得擅自改变以下决策：

- 不 Fork OpenPencil、GrapesJS、Webstudio、Scena 作为产品底座；
- 真实 Chromium DOM 是画布和最终运行环境；
- HE Project Graph 只保存可持续编辑投影，不复制任意网页的完整 DOM；
- 所有持久修改必须经过 Command / Transaction；
- 不使用整页 `outerHTML` 序列化替代最小 Source Patch；
- 时间线模型与 evaluator 自研，WAAPI / HTMLMediaElement 只是后端；
- 未知 Web 能力必须降级为 `opaque/embed`；
- MVP 不引入 Yjs / CRDT；
- 人工闭环先于 Agent、MCP、插件市场和最终 MP4；
- OpenPencil 只用于架构参考和后期 Adapter。

修改冻结决策必须新增 ADR，写明迁移影响、替代方案和回滚策略。

## 3. 任务执行规则

每次只执行一个明确任务 ID，例如 `SCH-001`、`GRF-001` 或 `PRV-001`。

开始前：

1. 检查任务依赖是否完成；
2. 检查目标包是否已有并行修改；
3. 写出输入、输出、失败模式和验收标准；
4. 先补齐失败测试或契约测试；
5. 记录新增依赖的版本、许可证、用途和替代方案。

实现中：

- Core 包不得依赖 React、Electron UI 或具体播放后端；
- UI 不得直接修改项目 JSON、DOM 或源码文件；
- `project-graph` 不保存 `DOM Element`；
- `timeline-core` 不保存 WAAPI `Animation` 或 React State；
- `selection-core` 不依赖 Moveable / Selecto；
- `command-core` 不直接访问文件系统；
- Agent、CLI 和 MCP 不得绕过 Command Gateway；
- 所有新持久数据必须有 Zod Schema、`schemaVersion` 和 migration 策略；
- 每个 Command 必须支持 validation、revision、dry-run、诊断和 inverse / rollback；
- 遇到无法可靠回写的对象时返回明确诊断，不猜测性修改。

完成前：

1. 运行 lint、typecheck、unit test、build 和适用的 Playwright 测试；
2. 验证失败路径；
3. 更新文档和包 README；
4. 提供人工验收步骤；
5. 明确已知限制；
6. 检查无关源码没有大面积变化；
7. 检查依赖许可证；
8. 确认 PR / commit 只覆盖当前任务 ID。

## 4. 当前开发顺序

本次文档同步完成后，`ADR-001` 视为完成。下一阶段固定顺序为：

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
→ 第一阶段人工闭环 Gate
→ TML-001 及后续时间线任务
```

`PLT-001` 可以与 `SCH-001` 并行，但应用壳只能建立基础进程、安全和 UI 框架，不得提前制造替代 HE Core 的临时业务状态模型。

现有 `packages/selection-core` 不应继续孤立扩展业务 UI；应在 `PRV-001` 完成后进入 `SEL-001` 集成。

## 5. Definition of Done

一个任务只有同时满足以下条件才算完成：

- 代码和类型已实现；
- 单元测试通过；
- 相关集成 / Playwright 测试通过；
- 文档同步；
- 失败路径经过验证；
- 无未解释的第三方许可证；
- 无直接绕过 Command / Transaction；
- 无无关源码重写；
- 人工验收可复现；
- 提交范围与任务 ID 一致。

不得以“先做出来，以后补测试 / 重构 / 迁移”作为完成依据。
