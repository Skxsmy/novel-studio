# ADR-0009：进展记录与角色所知分离

状态：已接受（2026-06-20）；Progression 存储与形状已被 ADR-0012/NS-410 取代

Superseded note: ADR-0012/NS-410 retires `codex/progressions/*.yaml` and replaces the old world-fact progression shape with unified schema-versioned JSON Progression at `codex/progressions/*.json`. The separation of Progression and character knowledge still applies.

## 背景

NS-304 已经建立设定库条目、参考笔记、关系和正文提及索引，但它们只表达基础资料与名称出现。长篇小说需要知道“从哪一场起事实发生变化”，以及“某个角色在这一刻知道、相信或误解什么”。如果把人物状态、关系状态或知识直接覆盖到条目详情里，后续场景会失去历史，也会让 AI 在早期场景看到未来信息。

## 决策

1. 世界事实和关系变化原保存为 `codex/progressions/<progressionId>.yaml`；该路径已退役，当前实现必须使用 ADR-0012 的统一 JSON Progression。
2. 角色所知、相信和误解保存为独立角色知识文件；其当前权威格式按 JSON authority 迁移，不依赖旧 progression YAML。
3. 两类记录都以叙事场景为默认生效轴；故事时间只用于后续矛盾提示，不决定上下文可见性。
4. 旧 Progression 支持 `addition` 与 `replacement`；ADR-0012 后统一为 `add` 与 `replace`。
5. CharacterKnowledge 必须指向人物类别条目作为知道者，并与世界事实查询分离返回。
6. 写入记录时验证证据来源。场景证据若含引文，必须能在当前场景正文中定位。
7. 早期场景查询不得返回未来记录正文、证据或 ID；最多返回被隐藏的未来记录数量。
8. 归档表示生命周期状态，不删除权威文件。

## 后果

- 设定库条目可以保留稳定基础描述，剧情变化通过追加历史表达。
- M4 上下文装配器可以按当前场景获取世界事实，并按 POV 角色额外获取角色所知。
- M5 候选事实收件箱可以生成同一格式的候选 Progression/Knowledge，但仍需用户确认后写入。
- 查询逻辑比单字段覆盖复杂，必须有自动化测试覆盖倒叙、误解和 Replacement。

## 回滚

回滚到不理解 NS-410 的旧版本时保留 `codex/progressions/` 与 `codex/knowledge/` 目录，并通过导出的 JSON 备份恢复；不得把旧 YAML progression 当成仍有效的权威来源。SQLite 不保存 Progression 或角色知识的唯一权威数据，因此删除索引不影响记录。
