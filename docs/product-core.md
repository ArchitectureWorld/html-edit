# HTML Edit 产品核心定义 v2

> 状态：**已确认并冻结的产品基线 v2**  
> 生效日期：2026-08-25  
> 架构依据：[`architecture/technical-architecture.md`](architecture/technical-architecture.md)  
> 实施依据：[`engineering-plan.md`](engineering-plan.md)

## 1. 产品定义

**HTML Edit 是一个人工操作优先、面向真实 HTML 项目的动态网页与多媒体可视化编排器。**

它直接打开、运行和继续维护标准 HTML、CSS、JavaScript 与本地媒体项目，让用户在真实 Chromium 画布中选择和修改 DOM 元素，并以剪辑软件式多轨时间线统一编排：

- DOM 动画；
- 视频与音频；
- 场景和章节；
- 点击、悬停、进入视口和时间触发交互；
- 页面状态与跳转。

长期产品关系为：

```text
真实 HTML 可视化画布
+
非破坏性源码回写
+
HE Project Graph 结构化编辑投影
+
多轨时间线
+
页面交互与状态编排
+
人工与 Agent 共用的 Command / Transaction 内核
```

第一版的顺序固定为：

```text
先让人完整、顺手、可靠地编辑真实 HTML
→ 再完成时间线与交互闭环
→ 最后接入 Agent、插件、协同与高级视频导出
```

## 2. 产品不是什么

HTML Edit 不是：

- 把网页截图放进视频时间线；
- 用 CanvasKit、Konva、Fabric 或其他私有画布模拟网页；
- 把任意 HTML 全量转换成 Figma / OpenPencil 式静态 SceneGraph；
- GrapesJS、Webstudio 或其他建站器的二次包装；
- 浏览器 DevTools 的简单可视化外壳；
- 只能接受自有模板 JSON 的页面生成器；
- 完整替代 Premiere、剪映或 After Effects；
- 只能由 Agent 生成、人工无法完整修改的系统。

产品必须始终满足：

```text
画布里看到的对象
= Chromium 中实际运行的对象
= 能够定位到源码或明确标记为运行时对象的对象
= 时间线、交互和历史记录引用的对象
```

## 3. 核心数据原则

### 3.1 两个权威域

旧版“HTML/CSS/JavaScript 是唯一 Source of Truth”的表述已经废止。当前模型是两个职责明确的权威域。

#### 用户源码权威域

负责：

- HTML 标签、文本、属性和原始结构；
- 用户 CSS、未知选择器、级联与媒体查询；
- 用户 JavaScript、自定义运行逻辑和未知组件；
- 项目资源和脱离 HTML Edit 后的独立运行结果。

#### HE Project Graph 权威域

负责：

- `data-he-id` 稳定身份；
- Source Binding；
- 节点别名、锁定、隐藏、选择能力和编辑能力；
- 时间线、媒体片段、关键帧；
- 触发器、动作和状态；
- revision、Operation Log、Undo / Redo 和恢复信息。

两侧不是互相竞争的完整副本。所有持久修改必须经过：

```text
UI Intent / Future Agent Intent
→ Command
→ Transaction
→ Source Patch + HE Data Update
→ Preview Refresh
→ Atomic Save
```

### 3.2 真实 DOM 的角色

真实 DOM 是：

- 当前浏览器运行状态；
- 可视化选择与检查对象；
- Preview Bridge 的 Runtime DOM Index 来源；
- 画布与最终页面一致性的基础。

真实 DOM 不是：

- 独立工程文件；
- 可绕过源码直接永久保存的状态；
- 使用 `outerHTML` 整页序列化的依据。

### 3.3 HE Project Graph 的边界

HE Project Graph 只保存进入持续编辑系统的对象，不复制任意页面的完整 DOM、computed style 或 JavaScript 运行状态。

普通对象在以下情况第一次获得稳定 ID 并进入 Graph：

- 修改文字、属性、样式、位置或尺寸；
- 命名、锁定、隐藏；
- 加入时间线；
- 创建交互；
- 复制、删除、重排；
- 被 Agent 建立持久引用。

无法可靠理解或回写的 Web 对象必须降级为 `opaque/embed`，不得猜测性拆解。

## 4. 产品成立的六项核心能力

### 4.1 真实 HTML 可视化编辑

必须支持：

- 打开和运行普通 HTML、CSS、JavaScript 项目；
- 在真实 Chromium 画布中悬停、选择和定位 DOM；
- 第一次点击优先选中用户看到的最具体、有意义对象；
- 图层、画布、属性、时间线和源码同步选择；
- 修改文字、图片、视频、SVG、容器、属性和基础样式；
- 多选、拖动、缩放、吸附、锁定、隐藏、复制和删除；
- 编辑模式与页面预览模式彻底分离。

第一版首先完整支持普通静态 HTML 项目。React、Vue、Next.js 等框架区域默认作为 `component-host` 或 `opaque`，不承诺源码级双向修改。

### 4.2 非破坏性源码回写

用户修改必须安全、可审查地回写项目：

- HTML 使用 source location 和最小区间 Patch；
- 视觉覆盖默认写入 `html-edit.generated.css`；
- 不自动大面积重写用户原 CSS；
- 不无意义改变未触及的 HTML、JavaScript、注释、格式和目录结构；
- 保存必须原子化并支持失败恢复；
- 外部文件变化必须通过 revision 和 Source Binding 显式处理；
- 绑定失效时必须报错，禁止静默绑定到“看起来相似”的节点。

### 4.3 HE Project Graph 与稳定引用

第一版必须形成：

```text
Project
├─ Pages
├─ Editable Nodes
├─ Assets
├─ Source Bindings
├─ Timeline References
├─ Interaction References
└─ Revision / Operation Metadata
```

稳定 ID 固定使用：

```html
<h1 data-he-id="he_01J...">标题</h1>
```

不得长期依赖：

```text
:nth-child()
XPath
DOM index
临时图层顺序
单一 CSS class
```

### 4.4 剪辑软件式多轨时间线

时间线是主编辑界面，不是附属动画面板。

第一版统一管理：

- DOM 动画属性；
- 视频、音频和字幕基础轨道；
- 场景、章节和事件；
- 进入、停留、退出和基础转场；
- 与时间相关的交互动作。

基础体验必须包含：

- Play / Pause / Seek / Scrub；
- Playhead 与缩放；
- Track / Clip / Keyframe；
- Move / Trim / Split / Copy / Snap；
- Lock / Hide / Mute；
- 基础 Easing；
- DOM、Video、Audio 共用逻辑时钟；
- 相同时间点重复求值结果一致。

时间线权威数据不得等同于 WAAPI、GSAP、Scene.js、Theatre.js、Remotion 或 React State。

### 4.5 页面交互与状态编排

第一版 Trigger：

- `click`；
- `hover-enter`；
- `hover-leave`；
- `scene-enter`；
- `in-view`；
- `time`。

第一版 Action：

- `timeline.play / pause / seek`；
- `element.show / hide`；
- `state.set`；
- `media.play / pause`；
- `navigation.anchor / scene`。

Preview 与独立 Export 必须共用 Interaction Compiler，禁止把产品交互散落成不可审查的内联脚本。

### 4.6 结构化 Command 内核

所有人工操作从第一天统一进入：

```text
UI Intent
→ Command
→ Validation / Dry Run
→ Transaction
→ Domain Services
→ Preview + Persistence
```

第一版建设：

- Command Schema；
- stable `targetId`；
- `baseRevision` 与冲突检查；
- Transaction；
- inverse / rollback；
- Undo / Redo；
- structured diagnostics；
- 可记录、可比较的 Operation Log。

未来 CLI、MCP、插件和 Agent 只能调用同一 Command Service，不得直接修改文件或 JSON。

## 5. 项目文件结构

MVP 继续使用普通网页文件夹，不强制改成私有二进制工程：

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

后期可以增加 `.heproj` ZIP 打包，但不得使项目失去标准 HTML 独立运行能力。

## 6. v0.1 对象支持边界

### 完整支持

- 普通容器；
- 文本元素；
- 图片；
- 视频与音频；
- SVG 根和基础图形；
- 链接、按钮与基础表单控件；
- absolute / fixed 元素；
- 基础 Flex / Grid 属性。

### 部分支持

- `::before` / `::after` 映射到宿主；
- CSS background image 编辑宿主背景；
- Open Shadow Root；
- 同源 iframe；
- 自定义 Element 宿主级编辑；
- JS 动态 DOM 在可建立稳定 Source Binding 时回写；
- React / Vue hydrated 区域作为组件宿主。

### 必须降级为 `opaque/embed`

- Canvas / WebGL / Three.js / 3DGS 内部对象；
- 跨域 iframe；
- Closed Shadow Root 内部；
- 无源码来源的动态节点；
- 未安装 Adapter 的复杂组件或专有运行对象；
- 高风险未知脚本区。

opaque 对象只允许整体选择、移动、缩放、锁定、隐藏、时间显示和宿主级交互。

## 7. 核心界面

```text
┌─────────────────────────────────────────────────────────────┐
│ Project / Save / Undo / Redo / Preview / Export            │
├──────────────┬──────────────────────────┬───────────────────┤
│ Layers       │                          │ Inspector         │
│ Scenes       │    REAL HTML CANVAS      │ Layout            │
│ Assets       │    + HOST OVERLAY        │ Style             │
│              │                          │ Animation         │
│              │                          │ Interaction       │
├──────────────┴──────────────────────────┴───────────────────┤
│                    MULTI-TRACK TIMELINE                     │
└─────────────────────────────────────────────────────────────┘
```

第一轮 UX 只重点验证：

```text
打开项目
点击元素
修改文字和样式
拖动 / 缩放
保存并重开
```

时间线阶段再验证：

```text
创建动画
Scrub 回看
裁切视频
创建交互
独立导出
```

## 8. 第一阶段最低成立条件

只有以下全部通过，第一阶段才算完成：

- 能打开并运行普通标准 HTML 项目；
- 第一次点击能选中用户看到的最具体视觉对象；
- 画布、Layers、Inspector 和源码同步；
- 能修改文字、图片、视频、属性、样式和基础变换；
- 能多选、拖动、缩放、锁定、隐藏、复制和删除；
- 所有持久修改进入 Command / Transaction；
- Undo / Redo 可恢复源码与 HE 数据；
- Source Patch 不产生大面积无关 Diff；
- 保存失败不破坏最后有效版本；
- 关闭重开后页面和 Graph 一致；
- 项目仍可脱离 HTML Edit 独立运行；
- 外部修改冲突可见且不会误写。

第一阶段未完成前，不开发：

- 正式 Agent / MCP；
- 多人 CRDT；
- 最终 MP4；
- OpenPencil / `.pen` Adapter；
- 模板市场和素材商城。

## 9. 产品范围边界

MVP 不包括：

- 任意 React、Vue、Next.js 源码级无损双向编辑；
- WordPress、电商或通用 CMS 建站能力；
- 专业调色、完整混音和 AE 级合成；
- 任意网站一键无损克隆；
- 云账号、数据库、对象存储和多人协同；
- 正式插件市场；
- Agent 代替人工成为主入口；
- 最终 MP4 作为最前面的 P0 条件。

## 10. 最终产品原则

```text
源码是网页语义与独立运行的权威来源；
HE Project Graph 是持续编辑关系的权威来源；
真实 DOM 是运行时画面；
Command / Transaction 是唯一持久修改入口；
时间线和交互必须结构化；
未知能力宁可 opaque，也不做虚假的无损承诺；
先让人真正可用，再接 Agent。
```
