# HTML Edit 文档索引与权威关系

> 状态：文档基线 v2  
> 生效日期：2026-08-25

本目录中的文档共同定义 HTML Edit 的产品目标、技术架构、实施顺序和专项子系统。为避免不同阶段文档互相覆盖，固定以下权威关系。

## 1. 权威层级

| 文档 | 负责回答 | 权威范围 |
|---|---|---|
| [`product-core.md`](product-core.md) | 产品是什么、为谁服务、第一版做什么 | 产品目标、范围、成立条件 |
| [`architecture/technical-architecture.md`](architecture/technical-architecture.md) | 从零、Fork 或混合路线如何选择 | 总体架构、开源选型、数据模型、模块边界 |
| [`adr/0001-core-architecture-decisions.md`](adr/0001-core-architecture-decisions.md) | 哪些核心决策已经冻结 | 不得擅自改变的架构决定 |
| [`engineering-plan.md`](engineering-plan.md) | 开发 Agent 具体按什么顺序实施 | 技术栈、包目录、任务 ID、测试和交付 |
| [`selection-system.md`](selection-system.md) | P0 选择问题如何实现 | 选择命中、候选排序、坐标、回退与性能 |
| [`../AGENTS.md`](../AGENTS.md) | Agent 如何执行单个开发任务 | 工作流、禁止项、Definition of Done |

## 2. 冲突处理

出现冲突时按内容类型判断，而不是简单按文件日期覆盖：

1. 产品目标或 MVP 范围冲突：以 `product-core.md` 为准；
2. 数据权威关系、开源选型、渲染方式或模块边界冲突：以技术架构文档和 ADR 为准；
3. 任务依赖、包路径、验收命令冲突：以 `engineering-plan.md` 为准；
4. 选择系统实现细节冲突：以 `selection-system.md` 为准；
5. 任何文档不得恢复已经废止的旧路线。

## 3. 已废止的旧表述

以下表述不再有效：

```text
HTML/CSS/JavaScript 是唯一 Source of Truth
```

替换为：

```text
用户源码是网页语义与独立运行的权威来源；
HE Project Graph 是稳定身份、编辑元数据、时间线、交互和事务版本的权威来源；
Source Binding 与 Transaction Coordinator 负责保持两侧一致。
```

同时废止：

- 以 OpenPencil、GrapesJS、Webstudio 或 Scena 为产品底座；
- 把任意 HTML 全量转换为私有 Canvas SceneGraph；
- 让 UI、Agent 或插件直接修改工程 JSON / 源文件；
- 用整页 DOM 序列化替代最小源码 Patch；
- 用 WAAPI、Scene.js、Theatre.js 或 Remotion 的私有模型作为时间线权威数据。

## 4. 当前状态

| 项目 | 状态 |
|---|---|
| 产品核心定义 v2 | 已同步 |
| 技术架构与开源选型 v2 | 已冻结并上传 |
| ADR-001 | 已完成 |
| 研发实施方案 v2 | 已同步 |
| P0 选择系统专项规范 | 继续有效 |
| `packages/selection-core` | 已有初始实现 |
| Electron / React 应用壳 | 未开始 |
| HE Project Graph / Binding / Command / Transaction | 未开始 |
| Timeline | 未开始 |

## 5. 下一开发入口

```text
SCH-001 → GRF-001 → BND-001 → CMD-001 → TXN-001
→ PRV-001 → SEL-001 → OVL-001 → SRC-001 / CSS-001
```

`PLT-001` 可以与 `SCH-001` 并行。
