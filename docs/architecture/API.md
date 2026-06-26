# 本地 API v1

基础路径：`/api/v1`。首版只绑定 `127.0.0.1`。请求与响应由 `packages/contracts` 的 Zod 契约约束。

## 错误语义

| HTTP | code | 含义 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 请求形状、UUID 或数值范围不合法 |
| 401 | `PROVIDER_AUTH_FAILED` | Provider 凭据无效、过期或被拒绝 |
| 403 | `CLOUD_DISABLED` | 作品或资料源禁止云端模型调用 |
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

场景创建默认落在第一本书的第一个可用章节；若客户端要把场景放入指定位置，`POST /series/:seriesId/scenes` 必须同时提供 `bookId`、`actId` 和 `chapterId`。NS-410 起，`/document` 是 JSON `SceneBlockDocument` 主路径，更新必须提供 `baseRevision`。传统 Markdown content 更新仅作为导入/迁移兼容入口，并转换为 block document 后写入 JSON 权威文件。Markdown 导出从 block document 投影，不返回编辑器私有状态。移动只接受 `targetChapterId` 与可选 `order`，祖先 ID 由服务端推导。

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
- `POST /series/:seriesId/codex/relations/:relationId/archive`
- `POST /series/:seriesId/codex/relations/:relationId/restore`
- `GET /series/:seriesId/codex/context?sceneId=&pinnedIds=`
- `GET /series/:seriesId/codex/entries/:entryId/effective?sceneId=&blockId=`
- `GET|POST /series/:seriesId/codex/field-progressions`
- `GET|PUT|DELETE /series/:seriesId/codex/field-progressions/:fieldProgressionId`
- `GET|POST /series/:seriesId/codex/progressions`
- `GET|PUT /series/:seriesId/codex/progressions/:progressionId`
- `POST /series/:seriesId/codex/progressions/:progressionId/archive`
- `POST /series/:seriesId/codex/progressions/:progressionId/restore`
- `GET|POST /series/:seriesId/codex/knowledge`
- `GET|PUT /series/:seriesId/codex/knowledge/:knowledgeId`
- `POST /series/:seriesId/codex/knowledge/:knowledgeId/archive`
- `POST /series/:seriesId/codex/knowledge/:knowledgeId/restore`
- `GET /series/:seriesId/codex/effective?sceneId=&entryId=&viewerEntryId=`

条目更新分别检查条目 `baseRevision` 和 Research `baseResearchRevision`；只修改其中一类时只要求对应 revision。内置类别不能更新或归档。Codex 条目请求和响应不再包含 `tags`；详情正文通过 `details` 对象保存，键名来自同类别的可复用详情类型。`detailAiContext` 通过同一键名保存条目级详情发送开关，`false` 的详情不得进入 M4 ContextBundle。详情类型创建会拒绝同类别重名；更新要求 `baseRevision`，当前只允许切换 NSFW 标记；删除要求 `baseRevision`，且当同类别任何条目仍使用该详情类型名称时返回 `422 INVALID_DATA`。自动提及与上下文预览是派生查询，不写回正文、Scene 关联或 Canon。`never` 条目即使出现在 `pinnedIds` 中也必须排除。

Field progression 是 Canon Description / Detail 字段级变化，存放于 `codex/field-progressions/`，不同于 `codex/progressions/` 的世界事实/关系摘要。创建和更新必须校验 entry、detail type、scene、block 和 source 引用。`DELETE` 仅在没有历史引用阻止时硬删。按 entry 的 effective API 可带 `sceneId` 与 `blockId`，返回 projected entry、fieldStates 和 hidden future count，不返回未来记录正文、摘要或 ID。

进展记录和角色所知均为权威 JSON 文件，更新、归档和恢复要求自身 `baseRevision`。有效状态查询只按当前叙事位置返回已生效记录；未来记录只返回数量，不返回摘要、证据或 ID。

## M4 AI 基础设施

`NS-404` 至 `NS-408` 已实现模型配置、权限边界、上下文预览、角色与提示词模板版本、MockProvider 流式调用、真实 Provider 协议路径和调用日志。DeepSeek、OpenAI、OpenRouter、Ollama、Anthropic、Google Gemini 与通用 OpenAI-compatible 路径已接入协议层；真实外部非写入调用验收和完整调用记录 UI 仍在后续 M4 任务中完成。M4 的第一条纵向闭环已使用 MockProvider 完成“上下文预览 → 流式调用 → 调用日志 → 写作页结果展示”。

所有 M4 AI 接口必须满足：

- 调用前可预览 `ContextBundle` 和用量估算。
- 调用后必须保存 `ModelCallLog`，包含模型、提示词版本、上下文包 ID、请求 / 响应哈希、状态和用量。
- AI 输出不得未经作者确认直接写正文、已确认设定、摘要、故事进展或角色所知。正文类任务可以生成候选文本；候选必须在编辑器内选中，并由作者保留后才保存。
- Provider 必须显式选择；调用失败时不得从本地模型静默回退到云端模型，也不得从当前 Provider 静默换用其它 Provider。资料级 `local-only/never` 内容必须按上下文目标过滤。
- 错误必须分类为认证失败、权限禁止、模型不可用、网络失败、上下文过长、限流、结构化输出失败或未知错误。

### 模型配置与 Provider

- `GET /series/:seriesId/ai/model-profiles`
- `POST /series/:seriesId/ai/model-profiles`
- `PUT /series/:seriesId/ai/model-profiles/:profileId`
- `POST /series/:seriesId/ai/model-profiles/:profileId/credential`
- `PUT /series/:seriesId/ai/cloud-policy`
- `POST /series/:seriesId/ai/model-profiles/:profileId/test`
- `GET /series/:seriesId/ai/model-profiles/:profileId/models`

`ModelProfile` 描述一个可选模型配置，包括 Provider、模型名、服务地址、能力、默认参数和凭据引用。API 不返回明文 API key。`cloudPolicy` 字段暂时保留用于旧文件兼容和调用日志审计，但不作为主界面上的全局“只允许本机模型”开关。

`POST /model-profiles/:profileId/credential` 接收一次性密钥输入并写入 `CredentialStore`，随后把模型配置更新为凭据引用。服务端不得把明文密钥写入作品目录、调用日志、错误响应或 Git 可追踪文件。

`PUT /ai/cloud-policy` 是历史接口，当前不作为用户主路径。M4 当前的安全边界改由模型凭据、Provider 显式选择、资料级 `local-only/never` 规则和“禁止静默回退”共同保证。

`POST /model-profiles/:profileId/test` 只做连接测试和能力读取。Provider 认证失败、余额不足、限流、模型不可用和服务不可达会返回对应错误分类；不会自动换用其它 Provider。

`GET /model-profiles/:profileId/models` 返回 Provider 可见模型列表。若 Provider 不支持模型列表，返回能力声明中的静态模型或明确的“不支持”，不能伪造动态列表。

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

内置角色首版包括：主笔伙伴、结构编辑、人物编辑、连续性编辑、文风编辑、冷酷读者和研究员。内置角色不可原地改写；用户只能复制后修改。

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

每个排除项必须说明排除原因，例如 `future-information`、`context-policy-never`、`hidden-section`、`cloud-disabled`、`over-budget`。`never` 资料即使出现在 `manualContextIds` 中也必须排除。

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
- 正文候选任务：`rewrite` 等可以生成候选文本，但服务端只返回流式文本和调用日志；前端必须把候选放入正文编辑器并整段选中，作者点击“保留”后才按普通场景保存流程写入 Markdown。写作主界面不展示调用来源、基准版本、用量或调用 ID。

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
