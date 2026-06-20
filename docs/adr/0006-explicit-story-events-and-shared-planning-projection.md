# ADR-0006：显式故事事件与共享规划投影

状态：已接受（2026-06-20）

## 背景

场景父清单只能表达读者看到故事的叙事顺序。倒叙、插叙、并行事件和模糊时间不能由同一个 Scene 日期字段可靠表达；Grid、Outline、Matrix 和 Timeline 若各自读取文件，也会产生顺序与筛选分叉。

## 决策

1. 叙事顺序继续由 Book→Act→Chapter→Scene 父清单唯一决定。
2. 世界内实际顺序由 `planning/timeline.yaml.eventIds` 决定；每个 `planning/events/<eventId>.yaml` 保存一个显式 `TimelineEvent`。
3. 一个事件可关联多个 Scene，一个 Scene 也可关联多个事件。事件允许相对、近似和未知时间标签，不强迫现实日期。
4. 服务端提供一个 `PlanningBoard` 查询投影；四种规划视图只对该结果做纯投影和过滤。
5. `scene.storyTime` 保留为旧格式兼容字段，但不再是新故事时间线的权威来源。
6. 计划与正文分叉在没有可靠语义分析前只能由用户或后续分析器显式标记；视图读取不得自动改变状态。

## 结果

- 倒叙场景能同时拥有“叙事线靠后、故事线靠前”的位置。
- 删除 SQLite 不影响规划；所有新数据仍是 YAML/Markdown。
- Codex 尚未实现时，Matrix 对人物、地点和情节线显示稳定短 ID，不伪造名称。
- TimelineEvent 的创建、删除和重排沿用可恢复文件事务；更新采用 revision 冲突保护。
