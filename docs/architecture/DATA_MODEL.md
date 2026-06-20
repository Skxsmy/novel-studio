# 数据模型与磁盘格式

详细产品语义见 `docs/product/PRODUCT_SPEC.md`，层级操作、写作附属文档和 Codex 的强制不变量见 `docs/tasks/M3.md`，决策依据见 ADR-0001、ADR-0005、ADR-0007 与 ADR-0008。

## 系列目录

```text
series-slug-id/
├─ series.yaml
├─ books/<book-id>/
│  ├─ book.yaml
│  ├─ acts/<act-id>.yaml
│  ├─ chapters/<chapter-id>.yaml
│  └─ manuscript/<act-id>/<chapter-id>/<scene-id>.md
├─ codex/{characters,locations,objects,lore,organizations,plot-threads}/
├─ codex/categories/
├─ codex/custom/<category-id>/
├─ codex/entry-research/
├─ codex/relations/
├─ codex/progressions/
├─ codex/knowledge/
├─ research/{sources,notes}/
├─ snippets/
├─ styles/
├─ agents/
├─ workshop/
├─ sections/<scene-id>/<section-id>.md
├─ review/anchors/<anchor-id>.yaml
├─ planning/
│  ├─ timeline.yaml
│  └─ events/<event-id>.yaml
└─ .studio/{index.sqlite,inbox,history,cache,logs,transactions,snapshots}/
```

目录名可供人类定位，但实体引用只能使用 UUID。移动和改名不改变 UUID。

## 父子清单

- `series.yaml.bookIds`：系列内单本成员。
- `book.yaml.actIds`：单本内幕成员及顺序。
- `acts/<id>.yaml.chapterIds`：幕内章成员及顺序。
- `chapters/<id>.yaml.sceneIds`：章内场景成员及顺序。

子文件同时保存父 ID，并要求 `order = 父清单下标 + 1`。父清单、子父 ID、Scene 物理路径三者不一致时数据无效，不做静默容错。

## 场景文件

场景是带 YAML frontmatter 的 Markdown：

```markdown
---
schemaVersion: 1
id: 00000000-0000-0000-0000-000000000000
bookId: 00000000-0000-0000-0000-000000000000
actId: 00000000-0000-0000-0000-000000000000
chapterId: 00000000-0000-0000-0000-000000000000
title: 雨夜来客
order: 1
status: draft
pov: null
locationIds: []
characterIds: []
plotThreadIds: []
tags: []
goal: ""
summary: ""
beats: []
storyTime: null
createdAt: 2026-06-20T00:00:00.000Z
updatedAt: 2026-06-20T00:00:00.000Z
---

正文从这里开始。
```

`revision` 不写入文件，由规范化后的完整文件内容计算 SHA-256，防止版本字段自身引起循环变化。

## Sections

Section 是与一个场景关联、但不属于小说正文的独立 Markdown 文档。路径为 `sections/<sceneId>/<sectionId>.md`，frontmatter 包含 `id`、`sceneId`、标题、类型、AI 权限、创建/更新时间和 `archivedAt`。

类型为 `author-note`、`candidate`、`research`、`sensitive`、`temporary`；AI 权限为 `inherit`、`local-only`、`never`。敏感资料默认 `never`。归档只设置时间，恢复清空时间；不通过删除表达普通生命周期。Section revision 由自身完整文件计算，更新 Section 不改变正文 revision。

## 审阅锚点

锚点位于 `review/anchors/<anchorId>.yaml`，保存场景 ID、稳定逻辑块 ID、基础场景 revision、精确引用、前后文、原字符范围和时间。锚点不向正文注入 HTML、私有节点或编辑器 JSON。

解析优先检查原范围，其次唯一精确引用，再用前后文消除重复引用歧义；证据不唯一或引用消失时返回 `orphaned`。解析是只读计算，只有未来显式“重新绑定”命令才可更新锚点文件。

## 规划与双时间线

叙事顺序来自父清单。`planning/timeline.yaml.eventIds` 保存世界内事件顺序，事件详情位于 `planning/events/<eventId>.yaml`，包含时间类型、标签、精度、持续时长、关联场景、说明和标签。

Scene frontmatter 的规划字段包括目标、冲突、结果、摘要、节拍、POV、人物/地点/情节线引用、计划字数、持续时长和分叉状态。`storyTime` 是旧格式兼容字段，不作为 NS-302 时间线来源。

## 文件事务

单文件正文更新使用同目录临时文件与原子替换。创建层级、重排和移动涉及多个文件，使用 `.studio/transactions` 预写日志与备份；访问作品时先恢复未完成事务。事务和快照是恢复机制，不是新的 Canon 副本。

## SQLite

SQLite 保存可重建的场景定位、正文搜索、Codex 搜索、名称候选、正文提及、歧义与 FTS5 数据。它不得保存无法从权威文件或明确缓存源恢复的唯一 Canon。删除 SQLite 后必须能完整重建。

## Codex

六个内置类别使用稳定字符串 ID 和固定目录；自定义类别元数据位于 `codex/categories/<categoryId>.yaml`，条目位于 `codex/custom/<categoryId>/<entryId>.md`。条目 Markdown 正文只保存 Canon Description，Research 位于独立的 `codex/entry-research/<entryId>.md`，两者 revision 独立。

关系位于 `codex/relations/<relationId>.yaml`。有向关系只表达 `sourceEntryId → targetEntryId`；无向关系从两端查询同一文件，不复制第二条边。提及索引只表示名称或别名在场景正文中出现，不改变 Scene 显式关联或任何 Canon。

## 进展记录与角色所知

世界事实和关系变化位于 `codex/progressions/<progressionId>.yaml`。记录指向设定条目或关系、拥有 `addition/replacement` 变更类型、作者可读的 `fieldKey`、生效起止场景、摘要和证据。Replacement 只影响按场景查询投影，不删除旧记录。

角色知道、相信或误解的内容位于 `codex/knowledge/<knowledgeId>.yaml`。知道者必须是人物条目；记录可指向一个涉及条目、一个关系或二者之一，并带有 `knows/believes/misunderstands` 立场、生效起止场景和证据。

有效状态查询以叙事顺序为准。早期场景不会返回未来记录正文、ID 或证据；只允许返回隐藏数量，用于提醒作者后面还有变化。
