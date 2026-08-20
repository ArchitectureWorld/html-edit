# @html-edit/selection-core

HTML Edit 的 P0 视觉优先选择内核。该包不依赖 React，负责：

- 真实 DOM 同点候选采集与语义排序；
- 透明父层、编辑器覆盖层、非当前场景、锁定层过滤；
- `pointer-events: none` 深层候选补充；
- 父子层与后方对象循环选择；
- 编辑器坐标到 iframe 视口坐标映射；
- Chromium CDP `DOM.getNodeForLocation` 深层命中封装。

```bash
npm run verify --workspace @html-edit/selection-core
```

单元测试验证排序、过滤、循环、坐标映射与 CDP 参数；真实 Chromium Golden Test 验证嵌套文字、透明遮罩、`pointer-events: none`、非当前场景、编辑器覆盖层和重叠对象。
