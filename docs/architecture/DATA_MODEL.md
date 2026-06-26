# 数据模型与磁盘格式

详细产品语义见 `docs/product/PRODUCT_SPEC.md`，层级操作、写作附属文档和 Codex 的强制不变量见 `docs/tasks/M3.md`，决策依据见 ADR-0001、ADR-0005、ADR-0007、ADR-0008 与 ADR-0011。

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
├─ codex/detail-types/
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

六个内置类别使用稳定字符串 ID 和固定目录；自定义类别元数据位于 `codex/categories/<categoryId>.yaml`，条目位于 `codex/custom/<categoryId>/<entryId>.md`。条目 Markdown 正文只保存 Canon Description，Research 位于独立的 `codex/entry-research/<entryId>.md`，两者 revision 独立。Codex 条目元数据不保存 `tags`；旧文件中的 `tags` 仅按未知字段兼容读取，并会在下次条目写入时移除。

可复用详情类型位于 `codex/detail-types/<detailTypeId>.yaml`，按 `categoryId` 归属到一个内置或自定义类别。条目 `metadata.details` 仍以作者可读的详情类型名称作为键保存正文值，便于 Markdown/YAML 人工查看；详情类型文件保存稳定 ID、名称、类别和 revision，用于 UI 集中管理、重名校验和删除保护。删除详情类型前必须确认同类别条目没有使用该详情类型名称。

关系位于 `codex/relations/<relationId>.yaml`。有向关系只表达 `sourceEntryId → targetEntryId`；无向关系从两端查询同一文件，不复制第二条边。提及索引只表示名称或别名在场景正文中出现，不改变 Scene 显式关联或任何 Canon。

## 进展记录与角色所知

世界事实和关系变化位于 `codex/progressions/<progressionId>.yaml`。记录指向设定条目或关系、拥有 `addition/replacement` 变更类型、作者可读的 `fieldKey`、生效起止场景、摘要和证据。Replacement 只影响按场景查询投影，不删除旧记录。

角色知道、相信或误解的内容位于 `codex/knowledge/<knowledgeId>.yaml`。知道者必须是人物条目；记录可指向一个涉及条目、一个关系或二者之一，并带有 `knows/believes/misunderstands` 立场、生效起止场景和证据。

有效状态查询以叙事顺序为准。早期场景不会返回未来记录正文、ID 或证据；只允许返回隐藏数量，用于提醒作者后面还有变化。

## M4 AI 基础设施文件

M4 的 AI 能力以 `packages/contracts` 中的 Zod 契约为先。NS-401 只确定格式草案；NS-402 起实现持久化。

推荐目录：

```text
series-slug-id/
├─ prompts/
│  ├─ roles/<role-id>.yaml
│  ├─ templates/<prompt-template-id>/v<version>.yaml
│  └─ presets/<preset-id>.yaml
└─ .studio/
   ├─ model-profiles/<profile-id>.yaml
   ├─ context-bundles/<context-bundle-id>.yaml
   ├─ model-calls/<model-call-id>.yaml
   └─ inbox/proposals/<proposal-id>.yaml
```

这些文件是 AI 配置、审计和候选层，不是正文、设定、故事进展或角色所知的权威来源。接受候选变更前，应用层必须重新读取目标文件并比较 `baseRevision`。

### ModelProfile

位置：`.studio/model-profiles/<profile-id>.yaml`

保存模型配置和能力，不保存密钥明文。

```yaml
schemaVersion: 1
id: 00000000-0000-0000-0000-000000000000
title: 本地 Mock 连续性编辑
provider: mock
model: mock-continuity-v1
cloudPolicy: local-only
credentialRef: null
defaultParameters:
  temperature: 0.2
  maxOutputTokens: 1200
capabilities:
  streamText: true
  structuredOutput: true
  embeddings: false
  tokenEstimate: true
contextWindowTokens: 32000
createdAt: 2026-06-21T00:00:00.000Z
updatedAt: 2026-06-21T00:00:00.000Z
archivedAt: null
```

`credentialRef` 是系统凭据引用，例如 `novel-studio:openai:default`。不得把 API key 写入 YAML、SQLite、调用日志、浏览器 localStorage 或 Git。模型配置校验会拒绝明显的明文密钥字符串，例如 `sk-...`、`api_key` 或 `bearer ...`。

作品级 `series.yaml` 仍可能保存历史 `cloudPolicy` 字段。当前 M4 主界面不再提供“只允许本机模型”的全局开关；模型调用安全边界由 Provider 显式选择、系统凭据引用、资料级 `local-only/never` 规则和“禁止静默回退”共同保证。

### AgentRole

位置：`prompts/roles/<role-id>.yaml`

```yaml
schemaVersion: 1
id: continuity-editor
title: 连续性编辑
description: 检查人物状态、线索回收、前后矛盾和未来信息泄漏。
persona: 像冷静的连续性守门人，只认已经写下和已经确认的证据。
duties:
  - 指出矛盾并给出证据。
  - 区分世界事实和角色此刻知道的内容。
nonDuties:
  - 不做修辞润色。
challengeObligation: 必须指出不合逻辑处，不为了安慰作者而回避问题。
forbiddenActions:
  - 直接改写正文
  - 直接更新已确认设定
outputContract: 输出风险等级、证据、影响范围和建议动作。
readScopes:
  scenes: true
  codex: true
  research: false
  hiddenSections: false
builtIn: true
createdAt: 2026-06-21T00:00:00.000Z
updatedAt: 2026-06-21T00:00:00.000Z
archivedAt: null
```

内置角色不可原地修改；复制后可生成自定义角色文件。

### PromptTemplate

位置：`prompts/templates/<prompt-template-id>/v<version>.yaml`

```yaml
schemaVersion: 1
id: 00000000-0000-0000-0000-000000000000
roleId: continuity-editor
name: 连续性检查
version: 1
status: active
system: 你是中文长篇小说的连续性编辑。
instructions: |
  请只根据提供的上下文指出连续性问题。
  不要改写正文。不要创造上下文中没有的事实。
components:
  - key: evidence_rules
    title: 证据规则
    body: 每条结论必须引用上下文来源。
variables:
  - key: user_request
    label: 作者要求
    required: true
    defaultValue: null
outputSchemaName: continuity_report
createdAt: 2026-06-21T00:00:00.000Z
updatedAt: 2026-06-21T00:00:00.000Z
archivedAt: null
```

模板是声明式文件。当前实现只允许 `{{变量名}}` 替换和组件拼接；不得执行任意 JavaScript。修改模板必须生成新版本，不能覆盖旧版本。

### PromptPreset

位置：`prompts/presets/<preset-id>.yaml`

```yaml
schemaVersion: 1
id: 00000000-0000-4000-8000-000000001403
title: 连续性编辑默认预设
roleId: continuity-editor
promptTemplateId: 00000000-0000-4000-8000-000000000405
promptTemplateVersion: 1
modelProfileId: null
defaultInputs:
  user_request: ""
createdAt: 2026-06-21T00:00:00.000Z
updatedAt: 2026-06-21T00:00:00.000Z
archivedAt: null
```

Preset 只保存默认角色、模板版本、模型配置和输入项，不保存明文密钥。

### ContextBundle

位置：`.studio/context-bundles/<context-bundle-id>.yaml`

`ContextBundle` 是一次调用前实际可读上下文的快照。它必须记录纳入项和排除项，后续正文或设定变化不得改写旧快照。

```yaml
schemaVersion: 1
id: 00000000-0000-0000-0000-000000000000
seriesId: 00000000-0000-0000-0000-000000000000
sceneId: 00000000-0000-0000-0000-000000000000
roleId: continuity-editor
taskKind: continuity-check
userRequest: 检查这一场有没有和前文矛盾。
promptTemplateId: 00000000-0000-0000-0000-000000000000
promptTemplateVersion: 1
items:
  - id: prompt-template:00000000-0000-4000-8000-000000000405
    kind: prompt-template
    source:
      type: prompt-template
      id: 00000000-0000-4000-8000-000000000405
      revision: null
      label: 连续性检查 v1
    title: 提示词模板：连续性检查 v1
    content: 模板 ID、版本和渲染后的提示词……
    inclusion: required
    inclusionReason: 用于审计本次上下文预览采用的提示词版本。
    access: local-only
    contextPolicy: null
    tokenEstimate: 300
    manuallySelected: false
    textHash: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
  - id: current-scene
    kind: scene
    source:
      type: scene
      id: 00000000-0000-0000-0000-000000000000
      revision: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
      label: 当前场景
    title: 当前场景正文
    content: 当前场景正文……
    inclusion: required
    inclusionReason: 当前写作场景
    access: local-only
    contextPolicy: always
    tokenEstimate: 900
    manuallySelected: false
    textHash: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
excluded:
  - source:
      type: codex-entry
      id: 00000000-0000-0000-0000-000000000000
      revision: null
      label: 后文才揭示的身份
    title: 后文才揭示的身份
    reason: future-information
    note: 后文信息不会向前提供。
estimatedUsage:
  inputTokens: 1800
  outputTokens: 1200
  totalTokens: 3000
createdAt: 2026-06-21T00:00:00.000Z
```

排除原因必须可读且可测试，至少包括：`context-policy-never`、`future-information`、`hidden-section`、`cloud-disabled`、`over-budget`、`permission-denied`。

### ModelCallLog

位置：`.studio/model-calls/<model-call-id>.yaml`

```yaml
schemaVersion: 1
id: 00000000-0000-0000-0000-000000000000
seriesId: 00000000-0000-0000-0000-000000000000
sceneId: 00000000-0000-0000-0000-000000000000
roleId: continuity-editor
taskKind: continuity-check
provider: mock
model: mock-continuity-v1
cloudPolicy: local-only
contextBundleId: 00000000-0000-0000-0000-000000000000
promptTemplateId: 00000000-0000-0000-0000-000000000000
promptTemplateVersion: 1
requestHash: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
responseHash: fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210
status: succeeded
estimatedUsage:
  inputTokens: 1800
  outputTokens: 1200
  totalTokens: 3000
actualUsage:
  inputTokens: 1760
  outputTokens: 420
  totalTokens: 2180
errorCode: null
errorMessage: ""
startedAt: 2026-06-21T00:00:00.000Z
completedAt: 2026-06-21T00:00:02.000Z
```

失败调用也必须写日志，`status=failed`，并保存分类后的 `errorCode`。日志不得保存 API key、认证头、未脱敏 SDK 原始错误或完整隐藏资料。

### Proposal

位置：`.studio/inbox/proposals/<proposal-id>.yaml`

M4 只保留 `Proposal` 契约，不实现应用流程。AI 输出如需影响正文、设定、摘要、进展或角色所知，必须进入 M5 的候选变更流程。每个 patch 必须记录目标类型、目标 ID、基础 revision、字段路径、差异和证据；目标已变化时不得直接应用。
