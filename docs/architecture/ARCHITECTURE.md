# 当前架构

本文描述截至 M3 完成、NS-400 整备中的真实实现。M8 的完整目标模块、资料库、Word 往返、备份和长期运行任务见 `TARGET_ARCHITECTURE.md`；产品行为以 `../product/PRODUCT_SPEC.md` 为准。

## 运行拓扑

```text
Browser (React/Vite)
        |
   REST /api/v1
        |
Fastify local server (127.0.0.1)
   |          |
File store   SQLite / FTS5
(authority)  (index/cache)
```

当前已具备 `ProviderAdapter`、MockProvider、DeepSeek 独立 Provider、OpenAI/OpenRouter/Ollama/OpenAI-compatible 基础路径、Anthropic Messages API 路径、Google Gemini GenerateContent API 路径、上下文预览、SSE 流式调用和调用日志 API。用户侧已确认 DeepSeek 连接正常并能获取模型列表；真实外部非写入调用和完整调用记录 UI 仍在 M4 后续任务中。

## 工作区和依赖方向

- `apps/web`：中文浏览器界面，包含概览、规划、写作、设定库、编辑室和待确认。
- `apps/server`：Fastify 本地 API、错误处理、静态资源服务和领域路由注册。
- `packages/contracts`：Zod 契约和共享 TypeScript 类型。
- `packages/storage`：JSON 权威文件原子写入、Markdown/Word 边界格式导入导出、层级校验、索引重建和查询。

依赖方向固定为：

```text
apps/* -> packages/storage -> packages/contracts
apps/* -> packages/contracts
packages/contracts -> no app/storage dependency
```

任何 M4 模型、上下文或 Proposal 能力都不能绕过 contracts 与 storage 的写入保护。

## 当前数据权威

作品目录中的结构化 JSON 文件是权威数据；Markdown/Word 是导入导出边界格式；SQLite 只保存可重建索引。

```text
series.json
books/<book-id>/book.json
books/<book-id>/acts/<act-id>.json
books/<book-id>/chapters/<chapter-id>.json
books/<book-id>/manuscript/<act-id>/<chapter-id>/<scene-id>.json
planning/events/<event-id>.json
sections/<scene-id>/<section-id>.json
review/anchors/<anchor-id>.json
codex/categories/<category-id>.json
codex/<category-id>/<entry-id>.json
codex/entry-research/<entry-id>.json
codex/relations/<relation-id>.json
codex/progressions/<id>.json
codex/knowledge/<id>.json
.studio/index.sqlite
.studio/transactions/*.json
```

删除 `.studio/index.sqlite` 后，场景搜索、设定库搜索、正文提及和歧义索引必须能从文件重建。

## 写入流程

1. 客户端读取实体和 `revision`。
2. 客户端提交变更和 `baseRevision`。
3. 服务端重新读取磁盘并比较版本。
4. 不一致返回 409，不做覆盖。
5. 一致时通过临时文件、事务日志和原子替换写入。
6. 成功后更新可重建索引并返回新版本。

普通生命周期使用归档和恢复，不用删除表达。读取操作不得为了“顺手修复”改写权威文件。

## 已实现领域

### 作品层级

已实现 `Series → Book → Act → Chapter → Scene` 的显式父子清单和稳定 UUID。排序命令必须提交完整、无重复排列；场景移动只接受目标章，由服务端推导父链。跨单本移动当前明确拒绝。

### 规划

规划工作区使用同一个 `PlanningBoard` 投影生成 Grid、Outline、Matrix、叙事时间线和故事时间线。故事事件保存在独立 YAML 中；未放置场景不会被读取操作自动写入时间线。

### 正文与附属文档

正文使用 JSON `SceneBlockDocument` 文件；当前 Write 场景正文与 Codex Canon 描述编辑器采用 CodeMirror 6 运行时，详见 ADR-0010 和 ADR-0012。Markdown 只作为导入导出/镜像格式。Sections、候选资料和敏感资料保存为独立 JSON 文件，并拥有独立 revision 与 AI 权限。审阅锚点保存为独立 JSON，查询时只返回定位状态，不写回。

### 设定库与连续性

设定库条目、参考笔记、关系、提及索引、故事进展和角色所知已经分离：

- 已确认设定不混入参考笔记。
- 关系状态变化通过 Progression 追加，不覆盖基础关系。
- 角色所知支持“知道 / 相信 / 误解”，不覆盖世界事实。
- 按当前叙事场景计算有效状态；未来记录只返回数量，不泄露摘要、证据或 ID。
- `never` 策略即使被主动选择也不得进入模型上下文预览。

## 服务端结构

NS-400 开始把集中路由拆成领域模块：

```text
apps/server/src/app.ts              # 创建 Fastify、错误处理、静态资源、领域路由注册
apps/server/src/routes/codex.ts     # 设定库、进展、角色所知和上下文预览路由
```

后续应继续拆出层级、规划、写作和系统配置路由。`buildApp` 不应重新膨胀成所有 API 的总文件。

## 当前整理风险

以下文件仍然偏大，属于 NS-400 后续拆分对象：

| 文件 | 风险 |
|---|---|
| `packages/storage/src/index.ts` | 领域混杂；M4 若继续堆上下文/Proposal 会难以审计 |
| `apps/web/src/CodexView.tsx` | 详情、关系、进展和角色所知都在同一视图内 |
| `packages/contracts/src/index.ts` | M4 结构化输出、调用日志和 Proposal 会进一步扩大 |
| `packages/storage/test/repository.test.ts` | 覆盖强但定位慢，应随领域拆分测试 |

拆分必须以行为不变为前提，不能为了行数指标改变文件格式或错误语义。

## 前端结构

NS-400 已开始拆分大视图：

```text
apps/web/src/CodexView.tsx          # 设定库类别、列表、选择和顶层载入
apps/web/src/CodexEntryEditor.tsx   # 单个条目的编辑状态、保存和附属数据加载
apps/web/src/CodexEntryPanels.tsx   # 此刻有效、关系、进展、角色所知、正文提及面板
```

后续 M4 的上下文预览、模型资料范围和候选事实入口不得重新塞回 `CodexView.tsx`；应继续以面板或领域组件承载。

## 存储层结构

NS-400 已开始把所有写入共用的安全层从大仓库文件中拆出：

```text
packages/storage/src/index.ts             # ProjectRepository 和领域读写逻辑
packages/storage/src/errors.ts            # StorageError
packages/storage/src/fileSystem.ts        # 路径归属、原子写入、存在性检查
packages/storage/src/fileTransactions.ts  # 多文件事务、事务恢复和 FileMutation
```

后续应继续提取层级、规划、Codex 和索引相关模块。拆分时 `index.ts` 仍可作为包的公开出口，避免破坏外部导入路径。

## 故障边界

- JSON 权威文件或 Markdown/Word 边界输入无法解析：返回明确错误，不静默修复。
- 层级引用缺失、重复、遗漏或父链不一致：校验报告问题，结构命令返回 `INVALID_DATA`。
- 多文件事务中断：下次访问前恢复到提交前状态或完成提交，不留下半状态。
- SQLite 损坏或缺失：从权威文件重建。
- 外部文件变化：带 revision 的写入必须冲突保护，不覆盖用户版本。

## M4 接入前硬门槛

进入真实模型调用前必须先完成：

- Context Bundle / Context Item 契约：已定义于 `packages/contracts/src/index.ts`。
- Prompt Template 版本契约：已定义于 `packages/contracts/src/index.ts`。
- Model Call Log 契约：已定义于 `packages/contracts/src/index.ts`。
- Proposal 契约和基础版本冲突规则：已定义于 `packages/contracts/src/index.ts`，应用前必须比较目标 revision。
- 至少三条可重复烟测：已通过 `npm.cmd run test:smoke` 覆盖创建写作恢复、层级创建校验、设定库提及与资料范围。

AI、导入器和后台任务只能产生候选变更或可审计记录；不得直接改写正文、已确认设定、摘要或角色状态。
