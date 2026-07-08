# 目标技术架构

状态：M8 目标架构；当前实现进度见 `STATUS.md`。  
产品行为以 `docs/product/` 为准。

## 1. 运行拓扑

```text
Windows Launcher
      |
      v
Fastify Local Host (127.0.0.1)
      |---- serves React application
      |---- REST commands and queries
      |---- SSE long-running job events
      |
      +---- Project/File Service ------ JSON authority files
      +---- Index Service ------------- SQLite FTS5 + optional vectors
      +---- Proposal/Revision Service - inbox, diff, snapshots
      +---- Context Service ----------- story-time and permission filtering
      +---- AI Orchestrator ----------- roles, council, provider adapters
      +---- Embedding Router ---------- use-case routing + profile-level concurrency
      +---- Import Worker Pool -------- DOCX/PDF/EPUB/HTML isolation
      +---- Backup Service ------------ independent user-selected directory
      +---- Credential Service -------- Windows Credential Manager
```

首版所有服务在一个本地 Node 进程中按模块隔离。耗时解析、Embedding 和索引重建进入 worker，不阻塞正文保存。未来桌面壳或局域网访问复用 API，但不能改变磁盘格式和权限语义。

## 2. Monorepo 目标边界

```text
apps/
  web/                 React 工作区和本地状态
  server/              Fastify 组合根、启动和静态资源
packages/
  contracts/           Zod 类型、API DTO、事件和错误码
  domain/              故事结构、Progression、角色知识和 Proposal 规则
  storage/             文件、原子写入、迁移、索引和快照
  ai/                  Context Builder、角色编排、Prompt 与 ProviderAdapter
  importers/           格式解析和 SourceLocation
  security/            路径、权限、凭据、脱敏和资源限制
  ui/                  可复用界面组件和设计 token
```

依赖方向：`contracts ← domain ← storage/ai/importers ← apps`。AI、导入器和 UI 不得直接绕过 domain/storage 修改权威文件。

## 3. 命令与查询

- Query 读取规范化领域对象，不返回任意磁盘路径。
- Command 携带目标 ID、`baseRevision` 和用户意图。
- 文件写入由 Storage Transaction 统一完成。
- AI 和导入器只创建 Proposal，不调用写入 Command。
- 应用 Proposal 时 Domain 校验权限、revision、引用和生效范围，再创建快照和写入。

未来 API 可以采用 REST 路由，但领域命令保持与传输层无关，以便测试和桌面壳复用。

## 4. 文件与索引

### 权威文件

- 系列、书、幕、章清单：JSON。
- 场景、Codex、Progression、角色知识、Snippet、Style、Prompt 和 Research Note：JSON。NS-410 起，场景正文的内部权威是 `SceneBlockDocument`，Markdown/Word 只是导入、导出、镜像和迁移边界格式；旧 `codex/progressions/*.yaml` 退役。
- Workshop：M5 起按 `workshop/sessions/<session-id>.json`、`workshop/messages/<message-id>.json`、`workshop/attachments/<attachment-id>.json` 和会话上下文选择 JSON 保存结构化权威数据；索引必须可重建，不使用 JSONL 作为权威存储。当前内部对象名仍可保留 `WorkshopContextBasket`，但 UI 不再把它呈现为常驻右侧篮子面板，而是通过折叠菜单编辑同一份会话上下文选择数据。Workshop 会话不得把当前场景作为默认上下文；新会话默认标题中性，首条作者消息或附件发送后可更新会话标题，作者手动重命名通过 session 更新命令持久化。分支创建必须在新 session 中复制源会话从开头到源消息的消息历史和消息附件快照，复制记录使用新 ID 并清除旧 Proposal/model-call/context 审计链接；不能只创建一个空 session。流式调用通过事件流传递作者消息、metadata、正式回答增量、reasoning 增量、最终消息、错误和完成事件；普通未关联 Proposal 的消息可删除，已关联 Proposal 的消息必须由存储层阻止删除。Workshop message attachments are parsed draft/message-bound context files, not Reference Library SourceDocuments or retrieval index records; deleting an unlinked message cascades its attachment JSON after the ContextBundle has already snapshotted the extracted text it used. Workshop model calls include same-session visible prior messages as `workshop-chat-history` context, including extracted text from historical message-bound attachments, while excluding the current author message from that history item to avoid duplicating `userRequest`.
- In-flight Workshop stream state is keyed by session and merged with persisted session detail when the author switches back before completion. Permanent Workshop session delete is a separate lifecycle operation from archive: it removes unlinked session records, messages, attachments, context basket, and branch records, but blocks sessions with Proposal-linked messages rather than breaking audit/source references.
- General Chat resend is a storage/API history replacement operation, not a UI-only retry. It is valid only in `chat` sessions for successful author General Chat messages. The repository updates the selected author message, removes later unprotected General Chat messages, deletes their bound attachments, clears branch records/pointers for deleted source messages, and then the server creates a new ContextBundle/ModelCallLog/assistant message from the revised history. Agent sessions and protected later histories are rejected in the current slice.
- Workshop conversations are created as fixed `chat` or `agent` sessions. Chat sessions use the visible author-editable discussion prompt and expose no write actions. Agent sessions run through a server-side structured-step protocol: provider output is buffered and parsed into assistant text or server-owned `role: tool` request messages. The current limited Agent tools are `codex.create_entry` and `codex.update_entry`; they execute only from structured JSON tool request messages after author confirmation. `codex.update_entry` may update entry fields/research/details and create/update/delete unified Codex Progression records through the existing validated repository commands. If an explicitly authorized Agent call refuses only for lack of external evidence, the server performs a repair pass instead of surfacing that refusal as the final Agent reply. Broader Write/Codex mutations, relation writes, character knowledge writes, and full command grants still require Proposal or future Tool Plan/Grant adapters.
- Workshop session export is a derived read path from persisted session, message, attachment, ContextBundle, and ModelCallLog records. It creates no authority state. The export route filters records to the requested session and defaults to readable chat history plus attachment file records only. It includes saved reasoning only when the author explicitly requests it, includes reconstructed provider prompt/context audit only behind a separate explicit option, emits UTF-8 Markdown with a BOM for local Windows readers, and omits extracted attachment body text.
- Embedding model profiles are library-global JSON settings under `.studio/embedding-profiles/`. They are separate from generation `ModelProfile` records and store Provider, endpoint, model, dimensions, batch limits, profile-level concurrency, normalization, license, and credential reference. They do not contain vectors or source text.
- Proposal、Evidence、调用审计和版本元数据：`.studio` 下可导出的结构化文件。
- JSON authority 是 Project/File Service 的内部职责；API 层应在可行处继续提供当前前端所需的兼容投影，例如场景 `content`。

### 可重建数据

- SQLite 实体投影和 FTS5。
- Embedding 和向量索引。向量索引记录必须包含来源 revision/hash、Embedding profile、模型、维度和归一化策略；这些字段变化时对应向量可删除并重建。
- 提及、关系邻接、统计和派生警告。
- 解析缓存、缩略图和 Prompt 预览。

删除全部可重建数据后，应用仍能打开和编辑作品，并可重新索引。

Archive is not a data-retention substitute for deletion. Every archive-capable domain object must have an explicit cleanup or permanent-delete design. Destructive cleanup must either prove there are no live references or preserve the minimum immutable snapshot needed for historical views before removing the source object. The UI must expose the cleanup path and reference-blocking reason instead of letting archived data accumulate indefinitely.

## 5. 领域投影

应用加载项目时执行：

1. 验证顶层 manifest 与 schemaVersion。
2. 读取书/幕/章引用图，报告缺失或重复引用。
3. 读取场景和 Codex，生成 revision。
4. 对比索引中的文件哈希，只更新变化实体。
5. 计算叙事顺序投影、同场景 block 顺序投影和故事时间投影。
6. 按场景/block 计算有效统一 Codex Progression，并按场景计算角色知识和活跃情节线。

投影错误不得改写源文件。严重引用损坏时进入只读诊断模式。

## 6. 长任务与工作队列

以下任务必须异步并可取消：

- AI 流式生成和编辑会审。
- 大型文档解析。
- 全项目索引和 Embedding 重建。Embedding 调用通过 profile 级并发限制调度，不同 use case 绑定不同 profile 时不得共享一个全局单线程队列。
- Word 导入差异计算。
- 备份验证和大型迁移。

Job 状态：`queued/running/waiting-user/completed/failed/cancelled`。SSE 只传进度和结果引用，不持续传完整敏感正文。服务重启后，非幂等任务标记中断并要求用户重试。

## 7. AI 数据流

```text
User Task
  → Role + Prompt version
  → Context Builder
      → narrative position
      → effective Codex/knowledge
      → source permissions
      → token budget
  → Preview/Confirm
  → ProviderAdapter
  → validated structured result
  → Proposal files
  → Review
  → snapshot + domain command
  → authority files + index update
```

模型输出在写入 Proposal 前使用 Zod 校验。修复失败时保留原始结果为诊断附件，不创建看似完整的结构化更新。

ProviderAdapter 实现必须以该 Provider 的官方 API 入口和官方文档为准。任何新增或变更 Provider 路径，都必须在任务与验收记录中写明官方来源 URL、采用的 endpoint 族、请求/响应形状、认证方式、流式协议以及模型列表行为；不得从第三方示例、其他 Provider 的兼容层或记忆中的接口形状推断语义。

Embedding Router 是 ProviderAdapter 之外的共享向量调用层。它接收 use case、profile、文本批次和取消信号，按 profile 批量拆分和限流，并返回向量、文本哈希、模型、维度和归一化状态。首个默认 profile 面向本地 `BAAI/bge-small-zh-v1.5` HTTP 服务；云端 embedding 或用户自定义 embedding 模型必须通过显式 profile 和凭据引用接入，不能作为失败回退。

## 8. 导入数据流

```text
Untrusted file
  → size/type/hash gate
  → isolated worker
  → normalized blocks + locations + warnings
  → import preview
  → user confirms
  → SourceDocument or project creation Proposals
```

解析器无权访问作品库外文件或网络。EPUB/DOCX 解压先检查路径与压缩比。

## 9. 配置与凭据

- 应用级配置保存作品库、备份目录、UI 状态和连接配置 ID。
- 作品级配置保存语言、自动分析策略和默认角色路由。
- 作品库级 Settings 保存全局模型连接配置 ID；所有 project/series 共享同一组模型设置和凭据引用。
- 资料源保存进一步收紧的权限。
- API 密钥只在 Windows Credential Manager；进程内按调用短暂获取。
- 导出项目默认不包含任何凭据或设备私有路径。

## 10. 迁移与兼容

- 所有权威 Schema 显式版本化。
- 读取器至少支持当前与上一格式版本。
- 迁移先生成计划和备份，不在后台静默执行。
- SQLite 迁移失败可直接删除并重建；JSON 权威文件迁移必须有回滚。当前开发分支中的测试数据可以重建，不需要为无价值 fixture 保留复杂兼容路径。
- Provider 和 Prompt 版本变化不能改变历史调用记录。

## 11. 性能策略

- 正文编辑和保存不等待 AI、Embedding 或全局分析。
- 场景按需加载，摘要和列表使用轻量投影。
- 大型系列采用增量哈希扫描和索引更新。
- Context Builder 优先读取索引定位，再从权威文件验证 revision。
- 两百万中文字符 fixture 上持续监控启动、保存、打开场景和搜索延迟。

## 12. 未来网络访问边界

当前只允许回环地址。任何局域网或跨地点模式必须先完成独立里程碑：

- 身份验证和安全会话。
- HTTPS 与可信设备配对。
- CSRF、CORS、速率限制和审计。
- 多客户端 revision 冲突与文件锁语义。
- 远程关机、备份和凭据访问限制。

不能仅把 host 从 `127.0.0.1` 改为 `0.0.0.0` 就声称支持局域网。

