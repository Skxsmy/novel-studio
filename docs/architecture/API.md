# 本地 API v1

基础路径：`/api/v1`。首版只绑定 `127.0.0.1`。请求与响应由 `packages/contracts` 的 Zod 契约约束。

## 错误语义

| HTTP | code | 含义 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 请求形状、UUID 或数值范围不合法 |
| 401 | `PROVIDER_AUTH_FAILED` | Provider 凭据无效、过期或被拒绝 |
| 404 | `NOT_FOUND` | 查询目标不存在或未被权威父链引用 |
| 409 | `CONFLICT` | `baseRevision` 过期 |
| 422 | `INVALID_DATA` | 作品层级损坏或结构命令违反不变量 |
| 403 | `PATH_ESCAPE` | 解析路径越出作品根目录 |
| 429 | `PROVIDER_RATE_LIMITED` | Provider 限流或配额耗尽 |
| 502 | `PROVIDER_ERROR` | Provider 返回不可恢复错误、协议错误或结构化输出失败 |
| 503 | `PROVIDER_UNAVAILABLE` | Provider 网络不可达、模型不可用或本地服务未启动 |

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
- `GET /series/:seriesId/scenes/:sceneId/document`
- `PUT /series/:seriesId/scenes/:sceneId/document`
- `GET /series/:seriesId/scenes/:sceneId/export/markdown`
- `POST /series/:seriesId/scenes/:sceneId/move`
- `POST /series/:seriesId/chapters/:chapterId/scenes/reorder`
- `POST /series/:seriesId/index/rebuild`
- `GET /series/:seriesId/search?q=`
- `PATCH /series/:seriesId/scenes/:sceneId/planning`

Scene 创建默认落在第一个 Volume 的第一个可用 Act；若客户端要把 Scene 放入指定位置，`POST /series/:seriesId/scenes` 当前必须同时提供兼容字段 `bookId`、`actId` 和 `chapterId`，分别表示产品层级的 Volume、Chapter 和 Act。NS-410 起，`/document` 是 JSON `SceneBlockDocument` 主路径，更新必须提供 `baseRevision`。传统 Markdown content 更新仅作为导入/迁移兼容入口，并转换为 block document 后写入 JSON 权威文件。Markdown 导出从 block document 投影，不返回编辑器私有状态。移动只接受内部 `targetChapterId`（产品 Act）与可选 `order`，祖先 ID 由服务端推导。

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
- `GET /series/:seriesId/scenes/:sceneId/sections/context`
- `GET|POST /series/:seriesId/scenes/:sceneId/anchors`

Section 更新、归档和恢复要求自身的 `baseRevision`，与正文 revision 相互独立。上下文资格接口只返回当前目标允许读取且未归档的 Section，不调用模型。创建锚点要求当前场景 revision、精确引用和字符范围；服务端验证正文切片，不接受客户端单方面声明。锚点查询只计算 `attached/relocated/orphaned`，不得在读取时改写文件。

## Codex

- `GET|POST /series/:seriesId/codex/categories`
- `PUT /series/:seriesId/codex/categories/:categoryId`
- `POST /series/:seriesId/codex/categories/:categoryId/archive`
- `POST /series/:seriesId/codex/categories/:categoryId/restore`
- `GET|POST /series/:seriesId/codex/detail-types`
- `PUT /series/:seriesId/codex/detail-types/:detailTypeId`
- `DELETE /series/:seriesId/codex/detail-types/:detailTypeId`
- `GET|POST /series/:seriesId/codex/entries`
- `GET|PUT /series/:seriesId/codex/entries/:entryId`
- `POST /series/:seriesId/codex/entries/:entryId/archive`
- `POST /series/:seriesId/codex/entries/:entryId/restore`
- `GET /series/:seriesId/codex/entries/:entryId/mentions`
- `GET /series/:seriesId/codex/scenes/:sceneId/mentions`
- `GET|POST /series/:seriesId/codex/relations`
- `PUT /series/:seriesId/codex/relations/:relationId`
- `DELETE /series/:seriesId/codex/relations/:relationId`
- `POST /series/:seriesId/codex/relations/:relationId/archive`
- `POST /series/:seriesId/codex/relations/:relationId/restore`
- `GET /series/:seriesId/codex/context?sceneId=&pinnedIds=`
- `GET /series/:seriesId/codex/entries/:entryId/effective?sceneId=&blockId=`
- `GET|POST /series/:seriesId/codex/progressions`
- `GET|PUT|DELETE /series/:seriesId/codex/progressions/:progressionId`
- `POST /series/:seriesId/codex/progressions/:progressionId/archive`
- `POST /series/:seriesId/codex/progressions/:progressionId/restore`
- `GET|POST /series/:seriesId/codex/knowledge`
- `GET|PUT /series/:seriesId/codex/knowledge/:knowledgeId`
- `POST /series/:seriesId/codex/knowledge/:knowledgeId/archive`
- `POST /series/:seriesId/codex/knowledge/:knowledgeId/restore`
- `GET /series/:seriesId/codex/effective?sceneId=&entryId=&viewerEntryId=`

Detail Type create and update use schema version 2. Create accepts `categoryId`,
`name`, optional `description`, and optional `nsfw`. Update requires
`baseRevision` and at least one of `name`, `description`, or `nsfw`;
`description` is trimmed, may be empty, and is limited to 4000 characters.
Rename rejects a duplicate normalized name in the same Category and atomically
converts legacy Entry `details` and `detailAiContext` keys from the old display
name to the stable Detail Type identifier. Conflicting legacy and stable values
reject the whole request. List responses always project a version 2 document.
A validated version 1 authority file is projected with an empty description
without a read-time write. The explicit storage migration and exact rollback
are governed by ADR-0016.

Relation `DELETE` is the connected author-facing lifecycle under ADR-0015 and
uses `baseRevision` plus reference blockers. The archive and restore routes are
temporary compatibility endpoints and are not exposed by the connected Codex
client.

条目更新分别检查条目 `baseRevision` 和 Research `baseResearchRevision`；只修改其中一类时只要求对应 revision。内置类别不能更新或归档。Codex 条目请求和响应不再包含 `tags`；详情正文通过 `details` 对象保存，键名来自同类别的可复用详情类型。`detailAiContext` 通过同一键名保存条目级详情发送开关，`false` 的详情不得进入 M4 ContextBundle。详情类型创建和重命名会拒绝同类别重名；重命名、description 和 NSFW 更新都要求 `baseRevision`。删除要求 `baseRevision`，且当同类别任何条目仍使用该详情类型稳定 ID 或兼容名称时返回 `422 INVALID_DATA`。自动提及与上下文预览是派生查询，不写回正文、Scene 关联或 Canon。`never` 条目即使出现在 `pinnedIds` 中也必须排除。

Progression 是统一 JSON 权威系统，存放于 `codex/progressions/`。它可以 target Canon Description、Detail、世界事实或关系状态；旧 `codex/progressions/*.yaml` 格式退役，不作为运行时兼容目标。创建和更新必须校验 entry、relation、detail type、scene、block、source 和 evidence 引用。`DELETE` 仅在没有历史引用阻止时硬删。按 entry 的 effective API 可带 `sceneId` 与 `blockId`，返回 projected entry、fieldStates 和 hidden future count，不返回未来记录正文、摘要或 ID。

Progression 和角色所知均为权威 JSON 文件，更新、归档和恢复要求自身 `baseRevision`。有效状态查询只按当前叙事位置返回已生效记录；未来记录只返回数量，不返回摘要、证据或 ID。

## Research

- `GET /series/:seriesId/research/sources`
- `GET /series/:seriesId/research/sources/:sourceId`
- `POST /series/:seriesId/research/sources`
- `PUT /series/:seriesId/research/sources/:sourceId`

列表返回按导入时间排序的 SourceDocument 与 revision；详情额外返回受管理原文。导入请求使用 JSON `fileName`、`mediaType`、`sizeBytes` 和规范 `contentBase64`，可同时提供显示名称、作者、声明语言、标签、人工智能权限和版权/使用备注。NS-602 只接受扩展名与媒体类型一致、大小不超过 5 MiB、严格 UTF-8、非空且字节数可复核的 `.txt` 和 `.md`；服务端自己计算 SHA-256，不信任客户端哈希。成功返回 `201` 和建立后的详情。

属性更新要求 `baseRevision`，只可修改显示名称、作者、声明语言、标签、人工智能权限和使用备注。冲突返回 `409` 并保留现有权威文件；原始文件名、媒体类型、字节数、哈希、导入时间、解析器和原文位置不可由该接口修改。NS-602 不注册删除、归档、重新解析或搜索路由，客户端不得把这些命令显示为可用。

## Workshop Agent Tools

Workshop session mutations enforce one in-process activity boundary. A session
may have only one active General Chat call, Agent call, resend, Agent retry, or
confirmed tool execution with Agent continuation. While one of those operations
is active, a second model-producing operation, Branch, Archive, Restore,
permanent session Delete, and message-turn Delete return `409`; the rejected
request does not truncate history or begin Provider transport. The same
boundary prevents a history or lifecycle mutation from racing with call
registration.

An archived Workshop session is read-only. Reading and export remain available,
and the session may be restored or permanently deleted. Title or General Chat
prompt updates, branching, context changes, message and attachment changes,
resend, tool execution, and Agent-run changes are rejected by the repository
even if a client bypasses the visible disabled controls.

- `PUT /series/:seriesId/workshop/sessions/:sessionId`

Session title or General Chat system-prompt updates use this existing session
mutation route. An automatic first-message title update supplies both `title`
and `expectedTitle`; the repository changes the title only when the persisted
title still equals `expectedTitle`. If the author has already completed Rename,
the route returns the unchanged current session, so a delayed automatic response
cannot overwrite the author's title. `expectedTitle` is a write precondition and
is never persisted in session authority.

- `POST /series/:seriesId/workshop/sessions/:sessionId/calls/:operationId/cancel`

Every streaming General Chat or Agent send receives one stable `operationId`
before the Provider attempt starts. Retries, repairs, and continuations keep the
same operation identifier even when they create another model call. The cancel
command validates the active session operation, aborts its shared Provider
signal, waits for version 2 call/message/run cancellation persistence, and
returns the cancelled Workshop result. The original server-sent event stream
remains open and emits the same terminal `done(status=cancelled)` result; the
client must not abort that stream as its normal Stop action. A disconnected
stream is only a fallback cancellation signal. Repeating a cancel command is
idempotent for the same completed cancelled operation and cannot trigger a
retry, continuation, or tool side effect.

Workshop streaming events identify `operationId`, `assistantMessageId`,
`modelCallId`, and `attempt`. An `assistant-start` event declares the target and
whether provisional answer/reasoning content must reset. Every answer or
reasoning delta carries the same scope. Automatic retry or repair reuses its
target with reset; a post-tool continuation declares a new assistant target.
Late events from replaced or cancelled attempts are ignored.

Exact-model parameter resolution is a pre-transport step. If Provider metadata
or parameter resolution fails before transport, the server records the failed
assistant message and Agent step with `modelCallId: null`, does not create a
Model Call Log, and does not invoke Provider chat transport. Cancellation during
the automatic retry delay likewise creates no retry step and starts no second
Provider request.

- `POST /series/:seriesId/workshop/sessions/:sessionId/messages/:messageId/resend`

This route edits/resends a previous General Chat author message. It is valid only for active `chat` sessions and successful `author` / `general-chat` messages that are not Proposal-linked. The request may provide replacement `content` plus model options for the new call; it cannot override the General Chat system prompt. The server reads the prompt persisted on the target session, updates the source author message, deletes later unprotected General Chat messages, deletes message-bound attachments attached to those deleted messages, clears branch records/pointers that depended on deleted messages, creates a new ContextBundle/ModelCallLog from the revised history, and appends the new assistant message. Agent sessions and Agent/tool/result histories are not supported by this route in the current slice; protected later records return an error instead of being silently erased.

- `GET /series/:seriesId/workshop/sessions/:sessionId/export?includeReasoning=&includePromptAudit=`

This route exports one Workshop session as `text/markdown`. `includeReasoning` and `includePromptAudit` default to false. The export reads persisted session, message, and attachment records filtered to the requested session; default output is visible message history plus attachment file records only. Saved provider reasoning content is included only when `includeReasoning=true`. Model-call metadata and reconstructed provider prompt/context records are included only when `includePromptAudit=true` and durable links exist. Extracted attachment body text is omitted from the export. The route is read-only, emits UTF-8 Markdown with a BOM for local Windows readers, and must not fabricate tool calls, hidden prompts, unsaved reasoning, or attachment bodies.

For Agent sessions, `GET /series/:seriesId/workshop/sessions/:sessionId` reconciles unfinished model/tool work after transaction recovery and returns persisted `agentRuns` with run documents and damaged-record diagnostics. Reconciliation marks uncommitted running work interrupted and never replays it automatically.

- `POST /series/:seriesId/workshop/sessions/:sessionId/agent-runs/:runId/retry`
- `POST /series/:seriesId/workshop/sessions/:sessionId/agent-runs/:runId/abandon`

Retry requires the current run revision and is valid only for server-classified retryable `failed` or `interrupted` runs. It appends a new attempt without deleting prior steps. Abandon also requires the current revision, is terminal, and preserves the run/message history. Neither endpoint changes Provider/model selection, infers permission, or re-executes confirmed Codex writes.
Agent retry holds the session activity boundary until its Provider attempt and
authority commit finish, so Send, lifecycle changes, and another retry cannot
run concurrently in the same session.

- `POST /series/:seriesId/workshop/sessions/:sessionId/messages/:messageId/tools/codex.create_entry/execute`

This route is a limited author-confirmed execution path for server-owned Agent `role: tool` messages whose content is a structured JSON `codex.create_entry` request. It creates a new Codex entry only. Assistant prose, fake `Tool Call` text, and plain `Codex Draft` text are not executable tool protocol. Draft Details must resolve to reusable detail type IDs by stable ID or exact normalized type name. If any draft detail labels are unmatched, the first request returns `409 CODEX_DETAIL_TYPE_CREATION_REQUIRED` without writing; a later request with `createMissingDetailTypes: true` creates those missing detail types and then writes the entry with stable detail type IDs. The route is not a general Tool Plan, does not update existing entries, and does not write relations, progressions, knowledge, or world facts.

- `POST /series/:seriesId/workshop/sessions/:sessionId/messages/:messageId/tools/codex.update_entry/execute`

This route is the matching author-confirmed execution path for server-owned Agent `role: tool` messages whose content is a structured JSON `codex.update_entry` request. It can update one existing Codex entry's name, aliases, Canon description, reusable Details, research notes, and unified Codex Progression operations in `patch.progressions`. Progression operations support `create`, `update`, and `delete` by calling the same validated Codex Progression repository commands used by the normal Codex API, including `baseRevision` checks for updates/deletes. The route may fill the target entry ID for field/world progression drafts that clearly target the same entry, but it does not execute assistant prose, fake tool-call text, relation writes, character knowledge writes, category edits, or broad Tool Plans. Explicit author authorization in the Agent conversation is a valid source basis for the Agent to draft a structured tool request; the write still requires this route's explicit confirmation before authority changes.

Both limited execute routes claim the source tool message before the first authority write. The message persists validated `toolExecution` with request hash, attempt, retryable flag, `running` / `succeeded` / `failed` / `interrupted` / `abandoned` status, timestamps, optional result-message ID, and optional terminal error. Claims are serialized per Workshop session in the target single local server process; concurrent or later requests for the same tool message return `409` without repeating the authority mutation. Archived sessions cannot claim execution. A running execution blocks session archive/delete. Tool requests and linked results cannot be independently removed through generic message deletion. Branch remaps a complete tool/result pair to cloned IDs, detaches copied messages from source Agent runs, and rejects running or incomplete execution history. The Codex/detail/progression/result write and Agent tool-result step commit atomically. Success or an atomic command failure produces a durable result and continues the same run without another author message; another tool request waits for a separate author confirmation. Update normalizes legacy name-keyed Details to exact same-category reusable IDs before claim and sends unresolved legacy/new labels through one planner response. Restart recovery marks an uncommitted running claim interrupted and requires explicit retry.
The session activity boundary spans both the confirmed Codex command and its
Agent continuation Provider attempt. Therefore Archive, permanent Delete, Send,
retry, or another tool execution cannot enter the window between the durable
tool result and the continuation commit.

## M4 AI 基础设施

`NS-404` 至 `NS-408` 已实现模型配置、凭据边界、上下文预览、角色与提示词模板版本、MockProvider 流式调用、真实 Provider 协议路径和调用日志。DeepSeek、OpenAI、OpenRouter、Ollama、Anthropic、Google Gemini 与通用 OpenAI-compatible 路径已接入协议层；真实外部非写入调用验收和完整调用记录 UI 仍在后续 M4 任务中完成。M4 的第一条纵向闭环已使用 MockProvider 完成“上下文预览 → 流式调用 → 调用日志 → 写作页结果展示”。

所有 M4 AI 接口必须满足：

- 调用前可预览 `ContextBundle` 和用量估算。
- 调用后必须保存 `ModelCallLog`，包含模型、提示词版本、上下文包 ID、请求 / 响应哈希、状态和用量。
- AI 输出不得未经作者确认直接写正文、已确认设定、摘要、故事进展或角色所知。正文类任务可以生成候选文本；候选必须在编辑器内选中，并由作者保留后才保存。
- Provider 必须显式选择；调用失败时不得静默换用其它 Provider。资料级 `never` 内容必须排除。
- 错误必须分类为认证失败、权限禁止、模型不可用、网络失败、上下文过长、限流、结构化输出失败或未知错误。

### 模型配置与 Provider

- `GET /ai/model-profiles`
- `POST /ai/model-profiles`
- `PUT /ai/model-profiles/:profileId`
- `POST /ai/model-profiles/:profileId/credential`
- `GET /ai/model-profiles/:profileId/credential`
- `DELETE /ai/model-profiles/:profileId/credential`
- `POST /ai/model-profiles/:profileId/test`
- `GET /ai/model-profiles/:profileId/models`

`ModelProfile` 描述一个全局模型配置，包括 Provider、精确模型名、服务地址、能力、默认参数、该模型最后一次有效的标准化 reasoning preference 和凭据引用。模型配置和服务密钥独立于 project/series，保存在作品库级 Settings 中，所有项目共享。Create/Update profile payload 不接收 `credentialRef`；普通保存设置必须保留已有凭据引用。API 不返回明文 API key。Version 1 profile compatibility reads `reasoningPreference` as null; explicit profile mutation writes version 2 and retains rollback data as ADR-0017 specifies。

`POST /ai/model-profiles/:profileId/credential` 接收一次性密钥输入并写入 `CredentialStore`，随后把模型配置更新为凭据引用。设置页的 `Save Setting` 若密码框有新密钥，必须在保存 profile 后调用该 credential 端点；若密码框为空，则只保存 profile 字段并保留已有 key。服务端不得把明文密钥写入作品目录、调用日志、错误响应或 Git 可追踪文件。

`POST /ai/model-profiles/:profileId/test` 只做连接测试和能力读取。Provider 认证失败、余额不足、限流、模型不可用和服务不可达会返回对应错误分类；不会自动换用其它 Provider。

`GET /ai/model-profiles/:profileId/models` 返回 Provider 可见模型列表。每个精确模型可另外声明 reasoning 为 unsupported、toggle、Provider-declared effort set 或 bounded token budget，并说明能否关闭及可见输出是 summary、full 或 none。若 Provider 不支持模型列表，返回能力声明中的静态模型或明确的“不支持”，不能伪造动态列表，也不能为未知模型伪造统一 reasoning 选项。

### Embedding 配置与调用边界

`EmbeddingModelProfile` 是独立于生成模型 `ModelProfile` 的全局配置对象，保存 Provider、服务地址、endpoint、模型、维度、输入上限、批量上限、profile 级并发上限、归一化策略、模型许可证和凭据引用。它用于 Codex schema planner、资料库语义检索、上下文检索和未来 M6 向量索引等 use case 的共享 embedding 调用。

当前基础设施已提供 contracts、storage 和 `@novel-studio/ai` embedding router；M6 或后续 Settings UI 再公开正式 REST 设置路由。REST 路由不得把 embedding profile 混进生成模型 profile，也不得把某个 use case 的模型选择写死。未来候选路由应保持在作品库级 Settings 下：

- `GET /ai/embedding-profiles`
- `POST /ai/embedding-profiles`
- `PUT /ai/embedding-profiles/:profileId`
- `POST /ai/embedding-profiles/:profileId/credential`
- `GET /ai/embedding-profiles/:profileId/credential`
- `DELETE /ai/embedding-profiles/:profileId/credential`
- `POST /ai/embedding-profiles/:profileId/test`

NS-508 已提供独立的 library-global use-case binding 路由，供 Codex schema planner 和后续 Settings UI 复用：

- `GET /ai/embedding-bindings`
- `PUT /ai/embedding-bindings/:useCase`
- `DELETE /ai/embedding-bindings/:useCase`

绑定写入必须验证 profile 存在且未归档。删除绑定只会让对应功能进入未配置状态，不删除 profile、向量缓存或任何作品权威数据。

Embedding router 调用不直接写权威数据。索引调用者负责在向量记录中保存来源 revision/hash、profile、模型、维度和归一化策略，并在这些字段变化时重建。Codex 或 Agent 调用者只可把 embedding 结果用于匹配/建议，不可把语义相似度当作事实证据或 Canon 写入许可。

### 提示词、角色与版本

- `GET /series/:seriesId/ai/roles`
- `POST /series/:seriesId/ai/roles/:roleId/clone`
- `PUT /series/:seriesId/ai/roles/:roleId`
- `GET /series/:seriesId/ai/prompts`
- `POST /series/:seriesId/ai/prompts`
- `POST /series/:seriesId/ai/prompts/:promptTemplateId/preview`
- `POST /series/:seriesId/ai/prompts/:promptTemplateId/versions`
- `GET /series/:seriesId/ai/presets`
- `POST /series/:seriesId/ai/presets`

角色、模板和 Preset 是项目数据，由用户或明确的功能入口创建。当前不再补种固定全局内置角色；Workshop 的 General Chat 和 Agent prompt 由 Workshop 专属模块提供，不通过这些全局列表选择。

提示词模板是声明式 JSON。当前实现只允许 `{{变量名}}` 替换和组件拼接；不得执行任意 JavaScript。每次修改模板都生成新版本，旧调用日志继续指向旧版本。

`POST /prompts/:promptTemplateId/preview` 只返回渲染后的提示词片段，不触发模型调用。缺少必填输入时返回 `400 PROMPT_INPUT_MISSING`；模板包含表达式或未闭合占位符时返回 `422 PROMPT_TEMPLATE_INVALID`。

### 上下文预览

- `POST /series/:seriesId/context/preview`
- `GET /series/:seriesId/context/:contextBundleId`

`POST /context/preview` 输入：

- `sceneId`
- `roleId`
- `taskKind`
- `userRequest`
- `promptTemplateId`
- `promptTemplateVersion`
- `selection`，可选正文选区
- `manualContextIds`，作者主动选择资料
- `modelProfileId`，用于估算用量和上下文窗口
- `tokenBudget`，可选 token 预算

响应返回 `ContextBundle`。每个 `ContextItem` 必须说明：

- 来源类型和来源 ID。
- 纳入原因。
- 生效的权限策略。
- 估算 token。
- 是否来自用户主动选择。

每个排除项必须说明排除原因，例如 `future-information`、`context-policy-never`、`hidden-section`、`over-budget`。`never` 资料即使出现在 `manualContextIds` 中也必须排除。

`GET /context/:contextBundleId` 读取调用时上下文快照。它是审计记录，不随后续正文或设定变化重写。

### 非写入型 AI 调用与日志

- `POST /series/:seriesId/ai/calls`
- `GET /series/:seriesId/ai/calls`
- `GET /series/:seriesId/ai/calls/:modelCallId`
- `GET /series/:seriesId/ai/calls/:modelCallId/context`

`POST /ai/calls` 输入：

- `contextBundleId`
- `modelProfileId`
- `roleId`
- `taskKind`
- `promptTemplateId`
- `promptTemplateVersion`
- `parameters`

NS-407 已允许两类调用：

- 分析型任务：`analysis`、`critique`、`continuity-check`、`style-review`、`brainstorm` 等，只在写作页侧栏显示结果，不写入正文或设定。
- 正文候选任务：`rewrite` 等可以生成候选文本，但服务端只返回流式文本和调用日志；前端必须把候选放入正文编辑器并整段选中，作者点击“保留”后才按普通场景保存流程写入 JSON `SceneBlockDocument` 权威文件。Markdown 仅是投影、导出或外部往返边界。写作主界面不展示调用来源、基准版本、用量或调用 ID。

应用补丁、候选事实收件箱、摘要 / 人物状态 / 设定更新仍属于 M5。

调用开始时先创建 `ModelCallLog(status=pending)`，然后转为 `streaming`。SSE 事件至少包含：

- `metadata`：调用 ID、模型、上下文包 ID 和提示词版本。
- `delta`：流式文本片段。
- `usage`：估算或实际用量更新。
- `error`：错误分类和可读说明。
- `done`：最终状态和响应哈希。

调用失败也必须保存日志。日志不得保存 API key、完整认证头或未脱敏 SDK 原始错误。

`GET /ai/calls/:modelCallId/context` 返回该调用实际使用的上下文快照，而不是重新生成当前上下文。

### Proposal 边界

M4 只允许保留 `Proposal` 契约和未来接口草案，不实现应用流程。

正文候选可以在 NS-407 通过写作页内联确认后保存；其他 AI 输出如需影响设定、摘要、人物状态、故事进展或角色所知，必须在 M5 进入 `Proposal` 或候选事实收件箱。应用 `Proposal` 前必须比较每个 `ProposalPatch.baseRevision`；目标已变化时返回冲突，不能静默合并。

## 后续长任务

M4 以后需要长时间运行的 AI、导入和分析任务返回 job ID，并通过 `/jobs/:jobId/events` 的 SSE 输出状态。该接口尚未实现，不得在客户端假装可用。
