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
      +---- Project/File Service ------ Markdown/YAML authority
      +---- Index Service ------------- SQLite FTS5 + optional vectors
      +---- Proposal/Revision Service - inbox, diff, snapshots
      +---- Context Service ----------- story-time and permission filtering
      +---- AI Orchestrator ----------- roles, council, provider adapters
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

- 系列、书、幕、章清单：YAML。
- 场景、Codex、Snippet、Style、Prompt 和 Research Note：Markdown + YAML。
- Workshop：按对话保存 Markdown/JSONL，并有可读索引。
- Proposal、Evidence、调用审计和版本元数据：`.studio` 下可导出的结构化文件。

### 可重建数据

- SQLite 实体投影和 FTS5。
- Embedding 和向量索引。
- 提及、关系邻接、统计和派生警告。
- 解析缓存、缩略图和 Prompt 预览。

删除全部可重建数据后，应用仍能打开和编辑作品，并可重新索引。

## 5. 领域投影

应用加载项目时执行：

1. 验证顶层 manifest 与 schemaVersion。
2. 读取书/幕/章引用图，报告缺失或重复引用。
3. 读取场景和 Codex，生成 revision。
4. 对比索引中的文件哈希，只更新变化实体。
5. 计算叙事顺序投影和故事时间投影。
6. 按场景计算有效 Progression、角色知识和活跃情节线。

投影错误不得改写源文件。严重引用损坏时进入只读诊断模式。

## 6. 长任务与工作队列

以下任务必须异步并可取消：

- AI 流式生成和编辑会审。
- 大型文档解析。
- 全项目索引和 Embedding 重建。
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
      → cloud/source permissions
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
- 作品级配置保存语言、云端策略、自动分析策略和默认角色路由。
- 资料源保存进一步收紧的权限。
- API 密钥只在 Windows Credential Manager；进程内按调用短暂获取。
- 导出项目默认不包含任何凭据或设备私有路径。

## 10. 迁移与兼容

- 所有权威 Schema 显式版本化。
- 读取器至少支持当前与上一格式版本。
- 迁移先生成计划和备份，不在后台静默执行。
- SQLite 迁移失败可直接删除并重建；权威文件迁移必须有回滚。
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

