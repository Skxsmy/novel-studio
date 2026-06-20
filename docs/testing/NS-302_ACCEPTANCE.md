# NS-302 验收记录

验收日期：2026-06-20

规格来源：`docs/tasks/M3.md`

状态：通过。

## 自动化结果

执行：`npm.cmd run check`

结果：退出码 0。

- Server：3/3 测试通过。
- Web：4/4 规划投影测试通过。
- Storage：23/23 测试通过。
- Contracts、Storage、Server、Web 类型检查通过。
- Fastify server 与 Vite production build 通过。

## 验收映射

| ID | 结果 | 证据 |
|---|---|---|
| A01 | 通过 | PlanningBoard 嵌套层级与 narrativeScenes 顺序一致 |
| A02 | 通过 | Grid、Outline、Timeline 使用同一纯投影；Web 测试验证顺序 |
| A03 | 通过 | 投影不可变性测试；浏览器在 Matrix 选择“周野”后切换 Outline，选择和筛选均保留 |
| A04 | 通过 | HTML5 拖动、同章箭头和跨章箭头共用 NS-301 命令；浏览器验证同章重排及“后移一章”后 2/0 场变为 1/1 场 |
| A05 | 通过 | POV、人物、地点、情节线、标签、状态矩阵测试；中文浏览器 Matrix 正确显示林岚/周野 |
| A06 | 通过 | TimelineEvent CRUD、完整重排、无效引用和过期 revision 测试 |
| A07 | 通过 | 叙事线为“现在场景→十年前场景”，故事线为“旧案发生→调查开始” |
| A08 | 通过 | 未关联的“无人接听的电话”显示在未放置区；创建“港口来电”后移出该区 |
| A09 | 通过 | 删除 timeline 文件后读取为空且不重建文件 |
| A10 | 通过 | aligned、intentional-deviation、revise-prose 与过期 revision 测试 |
| A11 | 通过 | 中文两章三场 fixture 的四视图、共享筛选、事件创建与结构命令浏览器验收；控制台无 warning/error |
| A12 | 通过 | 全量 check、文档、状态、交接与任务提交完成 |

## 浏览器观察

- 卡片按第一部→第一幕→两章分组，并显示 POV、摘要、字数和分叉状态。
- Matrix 选择“周野”后切换 Outline，只显示对应场景，Inspector 仍选中“十年前的雨夜”。
- Timeline 同时展示叙事顺序与世界顺序；倒叙位置明确不同。
- 故事事件创建后数量从 2 变为 3，PlanningBoard revision 同步变化。
- 同章上移和跨章后移均刷新服务端结果，没有客户端先行伪造顺序。

浏览器自动化后端不能稳定合成 HTML5 `dataTransfer`，因此同时验收了共用同一命令函数的可访问按钮入口；拖动处理器本身由代码审查确认只调用 `reorderScenes`/`moveScene`。
