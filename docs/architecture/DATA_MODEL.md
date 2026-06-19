# 数据模型与磁盘格式

## 系列目录

```text
series-slug-id/
├─ series.yaml
├─ books/<book-id>/book.yaml
├─ books/<book-id>/manuscript/<act-id>/<chapter-id>/<scene-id>.md
├─ codex/{characters,locations,objects,lore,organizations,plot-threads}/
├─ research/{sources,notes}/
├─ snippets/
├─ styles/
├─ agents/
├─ workshop/
└─ .studio/{index.sqlite,inbox,history,cache,logs}/
```

所有实体使用 UUID。目录名方便人类识别，但引用只能使用 ID。

## 场景文件

场景是带 YAML frontmatter 的 Markdown：

```markdown
---
id: 00000000-0000-0000-0000-000000000000
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
updatedAt: 2026-06-19T00:00:00.000Z
---

正文从这里开始。
```

`revision` 不写进文件，由规范化文件内容的 SHA-256 计算，避免版本字段自身造成循环变化。

## SQLite

索引保存场景定位、标题、正文、提及和 FTS5 数据。它不得保存无法从权威文件或明确缓存源恢复的唯一 Canon 数据。Proposal、历史和调用日志保存为 `.studio` 中独立文件，数据库只索引它们。

