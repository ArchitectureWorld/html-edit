# HTML Edit P0 视觉优先选择系统

> 状态：**第一版强制实施契约 v1**  
> 生效日期：2026-08-20  
> 适用范围：细化 [`product-core.md`](product-core.md) 的真实 HTML 可视化编辑能力，以及 [`engineering-plan.md`](engineering-plan.md) 中的 Preview Bridge、Selection Store 和第一阶段验收；不扩大既有产品范围。

## 1. 必须解决的问题

HTML 的 DOM 是嵌套结构，浏览器的事件命中又会受到层叠、透明覆盖层、`pointer-events`、iframe、缩放和页面脚本影响。若编辑器仅使用 `event.target` 或普通父子树选择，用户点击文字、图片或视频时很容易选到整页容器、卡片父层或透明遮罩。

HTML Edit 不接受这种体验。

第一版固定目标为：

> **用户在画布里点击自己看到的对象，第一次点击默认选中最具体、最有意义、可编辑的视觉对象；只有用户主动切换时才选择父容器或后方对象。**

该能力属于 P0。未通过本文件的选择验收，第一阶段“打开 → 选择 → 修改 → 保存 → 重开”闭环不成立。

## 2. 产品行为

### 2.1 默认选择

- 点击可见文字，默认选中文字所属的最小可编辑元素，而不是外层卡片或场景；
- 点击图片、视频、SVG 图形、输入控件或 Canvas，默认选中该视觉对象；
- 点击有背景、边框、阴影或独立布局意义的容器，可直接选中容器；
- 空白透明父容器、编辑器注入层、不可见场景和纯布局包裹层不得抢占第一次点击；
- 选择结果必须同步到 Layers、Inspector、Timeline 和源码定位；
- 悬停和选择本身不得写入或改动用户源码。

### 2.2 重叠与父子层级

一次命中必须产生有序 `SelectionCandidateStack`，而不是只返回一个 `event.target`。

交互固定为：

- 单击：选择默认候选；
- 同一点连续单击或 `Alt + 单击`：依次循环“当前视觉对象 → 父容器 → 同点后方对象”；
- `Shift + 单击`：加入或移出多选；
- Layers 与选择路径面包屑：可直接选择任意父级；
- 锁定对象默认不由画布选中，但仍可在 Layers 中定位；
- 隐藏对象不参与普通画布命中，但仍可在 Layers 中选择。

### 2.3 编辑模式与预览模式

两种模式必须彻底分开：

```text
编辑模式
→ 编辑器在捕获阶段接管画布点击
→ 页面自身 click / hover / navigation 不执行
→ 执行选择、拖动、缩放和文字编辑

预览模式
→ 编辑器不拦截页面事件
→ 页面按原始 HTML / CSS / JavaScript 正常运行
```

不得通过长期修改用户元素的 `pointer-events`、删除遮罩或重写页面结构来换取可选择性。

## 3. 技术架构

```text
Canvas Pointer
→ Coordinate Mapper
→ Fast Hit Test
   ├─ text caret / Range 命中
   └─ document.elementsFromPoint()
→ Deep Hit Test Fallback
   ├─ descendant geometry 补充
   └─ Chromium CDP DOM.getNodeForLocation(ignorePointerEventsNone=true)
→ Candidate Normalizer
→ Visibility / Lock / Editor-Layer Filter
→ Semantic Ranker
→ SelectionCandidateStack
→ Unified Selection Store
→ Canvas Overlay / Layers / Inspector / Timeline / Source
```

选择系统拆成四个独立单元：

1. **Coordinate Mapper**：统一处理 iframe 偏移、页面滚动、画布缩放、CSS transform 和设备像素比；
2. **Hit Test Adapter**：从真实 Chromium 页面取得同一点下的候选节点；
3. **Selection Core**：纯函数完成过滤、分类、排序、循环和多选，不依赖 React；
4. **Selection UI**：绘制悬停框、选择框、候选提示和选择路径，并写入统一 Selection Store。

Selection Core 不直接修改 DOM，不负责稳定 ID 持久化，也不依赖 Moveable、Selecto 或 Timeline。

## 4. 命中策略

### 4.1 快速路径

画布中的 Preview Bridge 在编辑模式捕获 `pointermove` 和 `pointerdown`：

1. 将编辑器坐标转换成 iframe 视口坐标；
2. 使用文本 caret / Range 判断点击点是否落在真实文字字形上；
3. 使用 `document.elementsFromPoint()` 取得浏览器绘制顺序下的元素栈；
4. 对命中元素递归检查点内可见后代，补充被 `pointer-events: none` 排除的子对象；
5. 生成轻量候选快照发送给 Selection Core。

悬停优先使用快速路径，避免在每次鼠标移动时进行重型全树扫描。

### 4.2 深层回退

普通 DOM 命中不能可靠覆盖 `pointer-events: none`、复杂 Shadow DOM、嵌套 iframe 或异常覆盖层。出现以下情况时启用深层回退：

- 快速路径只得到 `html`、`body`、整页容器或明显空白父层；
- 用户执行穿透选择；
- 候选与视觉边界不一致；
- 命中对象受 `pointer-events: none` 影响；
- Golden Project 将该页面标记为复杂命中页面。

Electron Main 通过 `webContents.debugger.sendCommand()` 调用 Chromium CDP `DOM.getNodeForLocation`，并启用 `ignorePointerEventsNone`。CDP 结果只作为命中来源，不作为项目数据或稳定引用；最终仍需映射回 Preview Bridge 的 DOM 节点和 `data-he-id`。

若 CDP 暂时不可用或因 DevTools 打开而断开，必须自动退回 DOM 几何补充路径，不能让基本选择失效。

## 5. 候选过滤与排序

### 5.1 默认排除

以下对象不进入第一次点击候选：

- 带有编辑器内部标识的 Overlay、Hover Box、Selection Box 和辅助控件；
- `display: none`、`visibility: hidden/collapse` 或没有有效布局矩形的对象；
- 有效累计透明度接近 0 的对象；
- 当前时间点不活动的场景；
- 已锁定对象；
- `html`、`body` 等文档根节点，除非没有其他候选；
- 没有文字、背景、边框、阴影、媒体、SVG 图形或独立编辑意义的空白透明包裹层。

被排除对象仍可根据类型出现在穿透候选栈或 Layers 中，不能永久不可选。

### 5.2 默认优先级

同一绘制层内，排序原则为：

```text
点击点上的真实文字
→ 图片 / 视频 / 表单控件 / Canvas / iframe 等替换元素
→ SVG 可编辑图形
→ 有可见背景、边框、阴影或独立内容的元素
→ 语义组件根节点
→ 纯布局容器
→ html / body
```

绘制层级优先于语义评分：后方对象不能仅因为“更像叶子节点”而越过前方真实可见对象。只有前方对象被判定为编辑器层、不可见层或空白透明拦截层时，才允许自动穿透。

### 5.3 稳定与可解释

- 相同 DOM、相同时间点和相同坐标必须得到相同候选顺序；
- 每个候选包含 `reason`，用于调试和 UI 提示，如 `text-hit`、`replaced-element`、`painted-box`、`transparent-wrapper`；
- 选择系统保留候选栈快照，连续点击时不得因悬停框注入而改变顺序；
- `data-he-id` 只在对象进入持久编辑、时间线或交互系统时写入，普通悬停和临时选择不污染源码。

## 6. 边界对象

- CSS `::before` / `::after`：映射到其所属元素；
- CSS `background-image`：选择承载背景的元素；
- SVG：优先选择可编辑图形节点，必要时循环到 `<svg>` 根；
- Canvas / WebGL / 3DGS：第一版作为一个原子视觉对象，内部对象选择由后续 Adapter 实现；
- 开放 Shadow Root：进入内部选择；
- Closed Shadow Root：作为宿主组件原子选择；
- 同源 iframe：允许继续进入子文档选择；
- 跨域 iframe：作为 iframe 原子对象选择；
- 视频字幕、浏览器原生控件和匿名节点：映射到最近的可编辑宿主元素。

## 7. 数据接口

```ts
export type SelectionCandidate = {
  nodeKey: string;
  targetId?: string;
  frameId: string;
  tagName: string;
  rect: { x: number; y: number; width: number; height: number };
  paintOrder: number;
  domDepth: number;
  kind:
    | "text-owner"
    | "replaced-element"
    | "svg-graphic"
    | "painted-box"
    | "component-root"
    | "layout-container"
    | "document-root";
  visible: boolean;
  locked: boolean;
  editorOwned: boolean;
  transparentWrapper: boolean;
  reason: string[];
};

export type SelectionHitResult = {
  point: { x: number; y: number };
  candidates: SelectionCandidate[];
  selectedIndex: number;
  selected: SelectionCandidate | null;
};
```

Selection Store 保存 `selectedIds`、`primaryId`、当前候选栈、候选索引和最后命中点；不保存 DOM Element 实例，避免 iframe 重载后引用失效。

## 8. 测试与验收

### 8.1 必测 Golden Cases

- `div > div > h2 > span` 多层嵌套文字；
- 图片位于卡片和整页容器内部；
- 全屏透明遮罩覆盖正文；
- `pointer-events: none` 的文字或图标；
- `opacity: 0` 的非当前场景覆盖当前场景；
- 两个绝对定位对象重叠；
- 页面和 iframe 同时滚动；
- 画布缩放 25%、50%、100%、200%；
- CSS transform、旋转、缩放和嵌套 transform；
- SVG 图形、背景图、伪元素、视频、Canvas；
- 开放 Shadow Root、同源 iframe、跨域 iframe；
- 锁定层、隐藏层和编辑器 Overlay。

### 8.2 自动验收

Vitest 覆盖候选过滤、语义排序、绘制顺序、循环选择、多选和确定性。

Playwright 至少包含：

```text
select-deepest-visible
select-text-before-parent
skip-transparent-overlay
select-pointer-events-none
cycle-parent-and-behind
select-under-canvas-zoom
select-after-scroll
select-svg-and-media
edit-mode-blocks-page-events
preview-mode-preserves-page-events
selection-does-not-change-source
```

### 8.3 性能门槛

在 5000 个 DOM 节点的 Golden Project 上：

- 悬停反馈不能持续阻塞主线程；
- 快速命中路径 p95 小于 32 ms；
- 点击完整候选栈 p95 小于 50 ms；
- 深层回退可以异步补充，但首个可用选择框必须先显示；
- 选择框更新不得造成页面布局抖动。

## 9. 分步实施

```text
S1 Selection Core
   候选模型 / 过滤 / 排序 / 循环 / 多选 / 单元测试

S2 Preview Fast Hit Test
   坐标映射 / caret / elementsFromPoint / 后代几何补充

S3 Selection UI
   hover box / selection box / candidate cycle / breadcrumb / Layers 同步

S4 Deep Hit Test
   Electron CDP fallback / pointer-events none / iframe / Shadow DOM

S5 Golden Projects
   自动化场景 / 性能基线 / 回归门槛
```

S1 至 S3 完成前，不进入拖动、缩放和 Inspector 深化；否则后续功能都会建立在错误目标上。

## 10. 完成定义

只有同时满足以下条件，P0 选择系统才算完成：

1. 用户第一次点击能选中看到的最具体对象，而不是默认落到整页或卡片父层；
2. 重叠对象和父子层能够稳定循环选择；
3. 透明空层、不可见场景和编辑器 Overlay 不抢占普通点击；
4. `pointer-events: none` 对象仍有可靠选择路径；
5. 缩放、滚动、transform、SVG、媒体和 iframe 的坐标正确；
6. 编辑模式不触发页面交互，预览模式完整保留页面交互；
7. Layers、Inspector、Timeline 和源码定位同步；
8. 选择过程不修改用户源码，持久操作才按规则写入稳定 ID；
9. 所有 Golden Cases 与自动化测试通过。

未达到以上条件，不得以“可以从 Layers 树里选”作为替代验收。画布直接选择必须真正可用。
