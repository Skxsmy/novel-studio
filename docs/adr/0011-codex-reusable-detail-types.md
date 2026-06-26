# ADR-0011：Codex 可复用详情类型

状态：已接受

Superseded note: ADR-0012 supersedes the YAML/frontmatter file-format assumption with schema-versioned JSON project authority. Reusable detail types should use stable detail type IDs as JSON keys where this ADR conflicts with NS-410.

## 背景

Codex Details 需要表达作者按作品定义的结构化信息，例如人物年龄、样貌、阵营，或地点布局、禁忌、线索。早期实现把详情作为条目内的自由标签/键值直接编辑，导致不同条目难以复用同一类型，也无法集中添加、删除或约束名称。`tags` 对 Codex 条目没有有效产品语义，继续保留会混淆规划标签和设定详情。

## 决定

1. 移除 Codex 条目的 `tags` 字段。前端不再显示或提交 tags，后端合同和 storage 写入不再接受 tags 作为 Codex 条目元数据。
2. 新增 `codex/detail-types/<detailTypeId>.yaml` 作为详情类型权威文件。每个详情类型拥有稳定 ID、所属 `categoryId`、作者可读名称、NSFW 标记、创建/更新时间和 revision。
3. 详情类型按类别复用。创建时拒绝同类别同名类型；不同类别可以使用相同名称。
4. 条目正文值继续保存在条目 frontmatter 的 `details` 对象中，以详情类型名称作为键。这样 Markdown/YAML 仍然可读，并避免把条目内容拆散到多个文件。
5. 条目 frontmatter 新增 `detailAiContext` 对象，以详情类型名称作为键保存是否随该条目发送给 AI；缺失或 `true` 视为包含，`false` 必须在 M4 ContextBundle 组装时过滤。
6. 删除详情类型是永久删除，但必须提供 `baseRevision`，并且只有同类别条目均未使用该详情类型名称时才允许删除；否则返回 `INVALID_DATA`。
7. Details 的长文本编辑复用与 Canon Description、Write 相同的 `EditorSurface`，保证纯文本保存、换行/空格处理和后续 Codex mention 装饰行为一致。
8. 前端详情类型管理使用独立的大弹窗，支持按类别查看、为自定义类别创建详情类型、切换 NSFW 标记和删除未使用类型；条目 detail 行只负责选择类型、编辑正文和切换该 detail 是否发送给 AI。

## 后果

- 作者可以在一个类别下集中管理可复用的详情类型，再在多个条目中选择并填写对应正文。
- `details` 键仍是作者可读名称，因此重命名详情类型若未来需要支持，必须明确迁移使用该名称的条目键；本 ADR 只接受新增和删除。
- NSFW 是详情类型级标记，不会自动把条目排除出 AI；条目级 `detailAiContext`、条目级上下文策略和资料权限共同决定最终发送内容。
- 删除保护依赖当前条目中是否仍存在同名详情键；因此 UI 应先移除或清空条目详情值，再允许删除类型。
- SQLite 不新增不可恢复数据；详情类型可从 YAML 重建索引。当前变更不需要 SQLite schema 迁移。
- 旧文件中残留的 Codex `tags` 作为未知字段兼容读取，并在新版本下一次保存该条目时被规范化移除。这是产品决定，不是静默迁移错误。

## 迁移与回滚

无需批量迁移旧作品即可打开：没有 `codex/detail-types/` 的作品仍可读取，旧条目的 `details` 键值仍显示为兼容的自由详情。旧详情类型没有 `nsfw` 时按 `false` 读取；旧条目没有 `detailAiContext` 时按空对象读取，意味着现有详情默认保持可发送。作者新增详情类型或保存条目后才会写入新字段。

回滚到不理解详情类型的旧版本时，旧版本应忽略 `codex/detail-types/` 目录；条目内已有 `details` 键值仍保留。不理解 `detailAiContext` 的旧版本可能无法继续过滤单个详情的 AI 发送范围，因此回滚前应避免执行会发送 Codex 上下文的 AI 操作。若条目已经被新版本保存，Codex `tags` 会被移除，回滚版本不能自动恢复这些已删除字段；这是按用户要求删除无效字段的预期结果。

## 验证

- Storage 测试覆盖详情类型创建、NSFW 更新、过期 revision 拒绝、同类别重名拒绝、已使用类型删除拒绝、未使用类型永久删除、条目详情值保留，以及 `detailAiContext` 持久化。
- Server 测试覆盖详情类型列表/创建/更新/删除 API，验证已使用详情类型返回 `422 INVALID_DATA`，并验证 M4 ContextBundle 会过滤关闭发送的单个详情。
- Web 测试覆盖 Details 类型弹窗管理、NSFW 切换、删除确认、详情行选择复用类型、每行 AI 发送开关、保存 payload 不包含 `tags`，以及详情正文通过共享编辑器输入。
