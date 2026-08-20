# HTML Edit

**人工操作优先的真实 HTML 可视化多媒体编排器**

HTML Edit 直接打开并运行标准 HTML、CSS 和 JavaScript 项目，让用户在真实浏览器画布中选择、修改和保存 DOM 元素，并通过剪辑软件式多轨时间线统一编排页面动画、视频、音频和交互。

产品首先解决“人能不能顺手、可靠地编辑真实 HTML”，Agent 在第一版只保留结构化接口基础，不进入前三个月 MVP。

## 已冻结的第一版基线

1. **真实 HTML 画布**：画布对象、浏览器运行对象和源码对象保持一致。
2. **非破坏性源码回写**：局部修改 HTML，视觉样式优先写入生成 CSS，不整页序列化。
3. **专业多轨时间线**：统一管理 DOM 动画、视频、音频、事件、片段和关键帧。
4. **页面交互编排**：支持点击、悬停、进入视口、场景进入和时间事件。
5. **人工优先、Agent 后置**：人工操作统一进入 Command / Operation 系统，未来 Agent 复用同一内核。

## 第一版技术路线

```text
Electron 43 + Chromium
React 19.2 + TypeScript 5.9 + Vite 8.1
Zustand + Radix UI + CSS Modules

iframe + Preview Bridge + Real DOM
Moveable + Selecto + Monaco

parse5 + Magic String + PostCSS
Self-built Timeline Core / Timeline UI
Web Animations API + HTMLMediaElement

Electron Main Process + Fastify
Vitest + Playwright
Electron Forge + GitHub Actions
```

核心原则：

> 自研决定产品成立的内核，复用浏览器、解析器、拖拽控件、测试和打包等成熟基础能力。

不以 GrapesJS、Pinegrow、Pencil 或 Webstudio 作为产品底座。它们可以作为功能、交互或设计参考，但 HTML Edit 必须拥有自己的源码回写、统一命令、时间线、交互和导出模型。

## 文档

- [产品核心定义](docs/product-core.md)
- [第一版研发技术方案](docs/engineering-plan.md)

上述两份文档共同构成当前唯一有效的产品与研发基线；后续实现不得恢复“Agent 优先”、私有画布替代真实 HTML、或以第三方网页编辑器项目模型作为 Source of Truth 的旧路线。

## 当前实施入口

第一阶段先完成以下人工闭环：

```text
打开普通 HTML 项目
→ 点击真实 DOM
→ 图层与属性同步
→ 修改文字与基础样式
→ 拖动 / 缩放
→ Undo / Redo
→ 安全保存
→ 关闭并重新打开
→ 页面与源码仍然正确
```

完成该闭环后，再进入多轨时间线、媒体同步和页面交互。

## License

[MIT](LICENSE)
