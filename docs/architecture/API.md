# 本地 API v1

基础路径：`/api/v1`。首版只绑定 `127.0.0.1`。请求与响应由 `packages/contracts` 的 Zod 契约约束。

## 错误语义

| HTTP | code | 含义 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 请求形状、UUID 或数值范围不合法 |
| 404 | `NOT_FOUND` | 查询目标不存在或未被权威父链引用 |
| 409 | `CONFLICT` | `baseRevision` 过期 |
| 422 | `INVALID_DATA` | 作品层级损坏或结构命令违反不变量 |
| 403 | `PATH_ESCAPE` | 解析路径越出作品根目录 |

## 系统

- `GET /health`
- `GET /system/config`

`GET /health` 返回本地服务身份：`ok`、`version`、`commit`、`startedAt`、`workspaceRoot` 和 `libraryRoot`。启动脚本用这些字段确认端口上的服务来自当前工作区和当前提交。

`PUT /system/config` 属于后续首次启动目录设置，目前未实现。

## 系列与场景

- `GET /series`
- `POST /series`
- `GET /series/:seriesId`
- `POST /series/:seriesId/scenes`
- `GET /series/:seriesId/scenes/:sceneId`
- `PUT /series/:seriesId/scenes/:sceneId`
- `POST /series/:seriesId/scenes/:sceneId/move`
- `POST /series/:seriesId/chapters/:chapterId/scenes/reorder`
- `POST /series/:seriesId/index/rebuild`
- `GET /series/:seriesId/search?q=`
- `PATCH /series/:seriesId/scenes/:sceneId/planning`

场景创建默认落在第一本书的第一个可用章节；若客户端要把场景放入指定位置，`POST /series/:seriesId/scenes` 必须同时提供 `bookId`、`actId` 和 `chapterId`。场景更新必须提供 `baseRevision`。移动只接受 `targetChapterId` 与可选 `order`，祖先 ID 由服务端推导。

## Act 与 Chapter

- `POST /series/:seriesId/books`
- `GET|POST /series/:seriesId/books/:bookId/acts`
- `GET|PUT /series/:seriesId/acts/:actId`
- `POST /series/:seriesId/books/:bookId/acts/reorder`
- `GET|POST /series/:seriesId/acts/:actId/chapters`
- `GET|PUT /series/:seriesId/chapters/:chapterId`
- `POST /series/:seriesId/acts/:actId/chapters/reorder`

创建新部会同步建立第一幕和第一章，正文场景仍由显式场景创建接口产生。改名输入不包含 `order`。重排接收当前成员的完整、无重复排列。

## 校验与迁移

- `GET /series/:seriesId/hierarchy/validate`：只读报告缺失、孤儿、父链、顺序和路径问题。
- `POST /series/:seriesId/migrate`：为 M2 旧作品建立快照并补齐 Act/Chapter 清单。

## 规划与故事时间线

- `GET /series/:seriesId/planning`：返回四种规划视图共享的 `PlanningBoard`。
- `POST /series/:seriesId/timeline/events`
- `PUT|DELETE /series/:seriesId/timeline/events/:eventId`
- `POST /series/:seriesId/timeline/events/reorder`

TimelineEvent 更新与删除要求 `baseRevision`；重排要求当前事件 ID 的完整无重复排列。叙事结构移动继续复用 NS-301 API。

## 写作附属文档与锚点

- `GET|POST /series/:seriesId/scenes/:sceneId/sections`
- `PUT /series/:seriesId/sections/:sectionId`
- `POST /series/:seriesId/sections/:sectionId/archive`
- `POST /series/:seriesId/sections/:sectionId/restore`
- `GET /series/:seriesId/scenes/:sceneId/sections/context?target=local|cloud`
- `GET|POST /series/:seriesId/scenes/:sceneId/anchors`

Section 更新、归档和恢复要求自身的 `baseRevision`，与正文 revision 相互独立。上下文资格接口只返回当前目标允许读取且未归档的 Section，不调用模型。创建锚点要求当前场景 revision、精确引用和字符范围；服务端验证正文切片，不接受客户端单方面声明。锚点查询只计算 `attached/relocated/orphaned`，不得在读取时改写文件。

## Codex

- `GET|POST /series/:seriesId/codex/categories`
- `PUT /series/:seriesId/codex/categories/:categoryId`
- `POST /series/:seriesId/codex/categories/:categoryId/archive`
- `POST /series/:seriesId/codex/categories/:categoryId/restore`
- `GET|POST /series/:seriesId/codex/entries`
- `GET|PUT /series/:seriesId/codex/entries/:entryId`
- `POST /series/:seriesId/codex/entries/:entryId/archive`
- `POST /series/:seriesId/codex/entries/:entryId/restore`
- `GET /series/:seriesId/codex/entries/:entryId/mentions`
- `GET /series/:seriesId/codex/scenes/:sceneId/mentions`
- `GET|POST /series/:seriesId/codex/relations`
- `PUT /series/:seriesId/codex/relations/:relationId`
- `POST /series/:seriesId/codex/relations/:relationId/archive`
- `POST /series/:seriesId/codex/relations/:relationId/restore`
- `GET /series/:seriesId/codex/context?sceneId=&pinnedIds=`
- `GET|POST /series/:seriesId/codex/progressions`
- `GET|PUT /series/:seriesId/codex/progressions/:progressionId`
- `POST /series/:seriesId/codex/progressions/:progressionId/archive`
- `POST /series/:seriesId/codex/progressions/:progressionId/restore`
- `GET|POST /series/:seriesId/codex/knowledge`
- `GET|PUT /series/:seriesId/codex/knowledge/:knowledgeId`
- `POST /series/:seriesId/codex/knowledge/:knowledgeId/archive`
- `POST /series/:seriesId/codex/knowledge/:knowledgeId/restore`
- `GET /series/:seriesId/codex/effective?sceneId=&entryId=&viewerEntryId=`

条目更新分别检查条目 `baseRevision` 和 Research `baseResearchRevision`；只修改其中一类时只要求对应 revision。内置类别不能更新或归档。自动提及与上下文预览是派生查询，不写回正文、Scene 关联或 Canon。`never` 条目即使出现在 `pinnedIds` 中也必须排除。

进展记录和角色所知均为权威 YAML 文件，更新、归档和恢复要求自身 `baseRevision`。有效状态查询只按当前叙事位置返回已生效记录；未来记录只返回数量，不返回摘要、证据或 ID。

## M4 AI 契约

当前只定义契约，不开放真实模型调用接口。`packages/contracts` 已包含：

- `ContextBundle` / `ContextItem`
- `PromptTemplate`
- `ModelCallLog`
- `Proposal` / `ProposalPatch`

NS-401 才能新增 `/api/v1/ai/...` 或 `/api/v1/model-calls/...` 等接口。新增接口必须满足：

- 调用前可预览 `ContextBundle` 和用量估算。
- 调用后必须保存 `ModelCallLog`，包含模型、提示词版本、上下文包 ID、请求/响应哈希和用量。
- AI 输出只能进入 `Proposal` 或候选事实收件箱；不得直接写正文、已确认设定、摘要或角色状态。
- 应用 `Proposal` 前必须比较每个 `ProposalPatch.baseRevision`；目标已变化时返回冲突，不能静默合并。

## 后续长任务

M4 以后需要长时间运行的 AI、导入和分析任务返回 job ID，并通过 `/jobs/:jobId/events` 的 SSE 输出状态。该接口尚未实现，不得在客户端假装可用。
