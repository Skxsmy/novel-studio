# 数据模型与磁盘格式

详细产品语义见 `docs/product/PRODUCT_SPEC.md`，层级操作的强制不变量见 `docs/tasks/M3.md#ns-301作品层级与安全结构操作`，决策依据见 ADR-0001 与 ADR-0005。

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
├─ research/{sources,notes}/
├─ snippets/
├─ styles/
├─ agents/
├─ workshop/
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

## 规划与双时间线

叙事顺序来自父清单。`planning/timeline.yaml.eventIds` 保存世界内事件顺序，事件详情位于 `planning/events/<eventId>.yaml`，包含时间类型、标签、精度、持续时长、关联场景、说明和标签。

Scene frontmatter 的规划字段包括目标、冲突、结果、摘要、节拍、POV、人物/地点/情节线引用、计划字数、持续时长和分叉状态。`storyTime` 是旧格式兼容字段，不作为 NS-302 时间线来源。

## 文件事务

单文件正文更新使用同目录临时文件与原子替换。创建层级、重排和移动涉及多个文件，使用 `.studio/transactions` 预写日志与备份；访问作品时先恢复未完成事务。事务和快照是恢复机制，不是新的 Canon 副本。

## SQLite

SQLite 保存可重建的场景定位、正文搜索、提及与 FTS5 数据。它不得保存无法从权威文件或明确缓存源恢复的唯一 Canon。删除 SQLite 后必须能完整重建。
