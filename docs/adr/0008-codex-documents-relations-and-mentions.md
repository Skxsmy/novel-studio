# ADR-0008：Codex 文档、关系边与提及索引

状态：已接受

## 背景

Codex 同时包含作者确认的 Canon、仅供参考的 Research、结构化元数据、关系和从正文机械计算出的提及。把这些内容放进同一数据库会破坏文件权威；把 Canon 与 Research 混进同一 Markdown 正文又会让后续上下文装配器难以证明发送边界。同名人物、短名称和方向性关系还要求系统在证据不足时明确保守。

## 决定

1. Codex 条目使用 YAML frontmatter + Markdown Canon Description，按内置类别目录或自定义类别目录保存。
2. 条目 Research 使用 `codex/entry-research/<entryId>.md` 独立保存，拥有独立 revision。
3. 自定义类别使用 `codex/categories/<categoryId>.yaml`；内置类别使用稳定字符串 ID 和固定目录，不创建可漂移的重复定义。
4. 关系使用 `codex/relations/<relationId>.yaml` 独立保存。方向由 `sourceEntryId`、`targetEntryId` 与 `directed` 明确表达。
5. SQLite 保存 Codex 搜索、名称候选、正文提及和歧义；全部可从权威文件重建。
6. 提及匹配采用显式名称规则、排除范围、最长词优先和同范围歧义拒绝。它不做指代消解，也不写回场景关联。
7. AI 上下文策略为 `always/on-mention/manual/never`，由统一纯函数判定。`never` 的排除优先级高于手工钉住。
8. 普通生命周期使用归档与恢复，不以删除文件表示移除。

## 后果

- 作者可直接阅读 Canon 和 Research，并能从目录判断二者边界。
- 同一条目的 Canon 与 Research 可能在不同时间更新，因此 API 必须分别检查 revision。
- Codex 条目改名或规则变化需要重建提及；首版可以同步重建，后续大型项目可迁移到后台 Job。
- 同名条目会产生需要作者处理的歧义记录，系统不会假装知道文本指向谁。
- NS-305 可以在不修改本 ADR 基础格式的前提下新增 Progression 与角色知识文件。

## 回滚

删除 SQLite 后不影响权威数据。若回滚到不理解 Codex 的旧版本，保留 `codex/` 新目录及文件；不得删除或合并 Research。恢复新版本后可重新重建索引。
