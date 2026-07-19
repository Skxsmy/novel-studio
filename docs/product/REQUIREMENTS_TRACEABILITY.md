# 需求追踪与里程碑完成定义

状态：权威验收索引

本文档防止“页面已经出现”被误报为“功能已经完成”。详细行为以同目录规格为准。

## M0 产品与治理

必须产物：完整产品规格、架构、数据、安全、任务、ADR、测试和交接协议。

完成标准：后来者不依赖聊天记录即可说明目标用户、核心闭环、全部工作区、AI 权限、研究边界、Word 策略和各里程碑目标。

## M1 交互骨架

覆盖：顶层导航、布局、视觉语言和能力边界标记。

完成不代表：Codex、Workshop、Review 或 AI 已有真实能力。

## M2 本地项目内核

覆盖：`FR-PROJECT-01/03` 的基础、`FR-WRITE-01` 的保存状态、文件权威、冲突、索引重建、基础搜索。

完成标准：创建 `Series → Volume → Chapter → Act → Scene` → 写入 Scene 权威文件 → 重启读取 → 搜索 → 删除索引重建全链路通过；项目生命周期必须提供回收站、恢复和永久删除项目目录的路径，永久删除前必须完整输入项目名称并由服务端校验。当前 Scene 权威格式以 NS-410/ADR-0012 的 JSON `SceneBlockDocument` 为准。

## M3 规划、编辑器与 Codex

执行规格：`docs/tasks/M3.md`。其中 `NS-301` 的 A01–A12 是后续规划视图可依赖层级命令的前置质量门；文件事务故障注入与人工 UI 验收未完成时，不能把 NS-301 作为完全验收的稳定基础。

覆盖：

- `FR-PLAN-01`–`FR-PLAN-06`
- `FR-WRITE-01`–`FR-WRITE-04`、`FR-WRITE-06/07`
- `FR-CODEX-01`–`FR-CODEX-08`

完成标准：四种规划视图和双时间线使用真实数据，并统一呈现英文 `Series → Volume → Chapter → Act → Scene`；编辑器与 Markdown 往返；Codex 条目、按类别复用的详情类型、详情类型 NSFW 标记、条目级 detail AI 发送开关、Relations、Progression、角色知识和提及索引均有文件契约和测试。

## M4 模型、Prompt 与上下文

覆盖：`FR-AI-02`–`FR-AI-04`、ProviderAdapter、Context Bundle、风格档案。

完成标准：至少一个本地和一个外部 Provider 适配器通过同一契约；调用前预览上下文和权限；调用后可审计模型、Prompt 版本与用量；显式 Provider 不静默回退；明文密钥不写入项目文件或响应。

## NS-410 Block Write Editor 与 Unified Codex Progression

执行规格：`docs/tasks/NS-410.md`。验收记录：`docs/testing/NS-410_ACCEPTANCE.md`。架构决策：`docs/adr/0012-scene-block-documents-and-codex-field-progression.md`。

覆盖：

- `FR-WRITE-01`–`FR-WRITE-03`、`FR-WRITE-08`
- `FR-CODEX-02`、`FR-CODEX-04`、`FR-CODEX-06`
- `FR-AI-01`、`FR-AI-04` 中与 Context Bundle 时间隔离相关的部分
- `IMPORT_EXPORT_VERSIONING_SPEC.md` 中 Markdown 导出与数据迁移边界

完成标准：Scene 正文以 JSON `SceneBlockDocument` 为内部权威格式；现有测试 Markdown/YAML 数据可迁移或重新生成到 JSON 权威结构；block document 可保存、重载并导出 Markdown；现有前端正在使用的场景 API 在过渡期保持兼容；旧 `codex/progressions/*.yaml` 退役并由统一 `codex/progressions/*.json` Progression 权威系统替代；Codex Canon Description、Detail、世界事实和关系变化可按 scene/block 位置投影；Context Builder、悬浮预览和有效状态 API 不泄露后文 progression；角色知识继续作为独立 JSON 权威系统工作并可引用 JSON progression。NS-410 最终关闭前，验收记录中列出的剩余 YAML/Markdown runtime authority path 必须迁移为 schema-versioned JSON，或通过新的产品/ADR 决策明确降级为导入、导出、镜像或迁移边界；不能只因目标架构写成 JSON 就视为已完成。

验收 ID：

- `NS-410-A01` 现有测试数据迁移或重建为 JSON block document，Markdown 只作为导入边界。
- `NS-410-A02` block document 保存、重载和 revision。
- `NS-410-A03` block-to-Markdown 导出。
- `NS-410-A04` 损坏输入、重复 ID、缺失引用和过期版本诊断。
- `NS-410-A05` 统一 JSON progression CRUD 与引用校验。
- `NS-410-A06` progression block 删除与记录同步删除。
- `NS-410-A07` baseline-only 投影。
- `NS-410-A08` add/replace/empty replace 字段折叠。
- `NS-410-A09` 同 Scene block 前后有效状态不同。
- `NS-410-A10` 后文 field progression 不泄露正文、摘要或 ID。
- `NS-410-A11` baseline 修改与 replace 边界。
- `NS-410-A12` Context Builder 使用 projected Codex 字段。
- `NS-410-A13` 角色知识与统一 JSON progression 分离，且旧 YAML progression 不再进入运行时权威路径。
- `NS-410-A14` Write 普通 block 与 progression block 编辑。
- `NS-410-A15` Codex baseline/history/effective-at-scene UI。
- `NS-410-A16` 搜索、提及、字数统计和上下文使用 plain text projection。
- `NS-410-A17` 现有场景读写 API 兼容：读返回 projected `content`，旧 `content` 写入转换为 JSON block authority。

## NS-514 Codex Reference Integration

执行规格：`docs/tasks/NS-514.md`。验收记录：`docs/testing/NS-514_ACCEPTANCE.md`。关系模型决策：`docs/adr/0015-codex-relation-description-and-permanent-delete.md`。

覆盖：

- `FR-CODEX-02` 的 Entry、Detail 与 Detail Type 生命周期。
- `FR-CODEX-05` 的 description-only Relation v2、显式迁移/回滚和受引用保护的永久删除。
- `FR-CODEX-06` 的 `Baseline / Current Scene` 只读有效状态投影。
- Progression 与 Mention 返回 Write 的真实 Scene/block 导航。

验收 ID：

- `NS-514-A22` 真实条目、Archived Entries、Story Lens/In Scene/Changed/Watch/Reload 移除以及 Category/Entry 右键生命周期。
- `NS-514-A23` 末尾新增 Detail 行、已保存 Detail 右键删除和 Detail Type 右键删除。
- `NS-514-A24` Relation v2 契约、v1 迁移/精确回滚、硬删除引用阻断和无 Archive UI。
- `NS-514-A25` Baseline 可编辑、Current Scene 跟随 Write 且 Canon/Details 只读、Research 保持 Baseline。
- `NS-514-A26` Open in Write/Open Scene 只对真实目标启用。
- `NS-514-A27` Manuscript/Codex mention 来源分离，以及 Canon Description 内联 Codex 提及摘要预览。
- `NS-514-A28` Detail Type Library restores the approved three-column new-UI
  structure, persists the selected Detail Type description through version 2
  authority, and provides real revision-protected Rename plus guarded Delete
  from the Detail Type row context menu. Rename atomically converts legacy
  name-keyed Entry Detail data to the stable identifier.

这些是已批准但尚未实现的 P6 验收映射；在对应实际证据通过前，不得把本节报告为完成功能。

## M5 编辑团队与 Proposal

执行规格：`docs/tasks/M5.md`。验收记录：`docs/testing/M5_ACCEPTANCE.md`。设计配套：`docs/design/ui-redesign/M5_WORKSHOP_REVIEW_FIGMA_PLAN.md`。

覆盖：全部角色、单角色调用、独立会审、Workshop、Proposal、Review、正文候选和后台分析策略。

完成标准：Proposal/Review 闭环先可用，Review 主路径必须是待审队列加清晰的修改前后差异，不能变成 Proposal 管理台或常驻批量/影响/证据仪表盘；Workshop 作为可靠 Proposal 来源进入闭环；Workshop 上下文选择必须支持折叠菜单式选择 Series 正文、Series 大纲、Volume、Chapter、Act、多个 Scene 和 Codex，并让按规则自动加入的 Codex 与后端实际请求保持可见一致；Workshop 会话默认标题中性，首次发送后按聊天内容自动命名，Rename、Archive、Restore、Export 和 Delete 从会话行上下文菜单进入，Archived 使用独立筛选且只读；Branch 必须复制分支点之前的消息历史和附件快照，不能创建空聊天；消息 Edit and resend、Resend、Branch 和 Delete turn 从消息右下角图标菜单进入；Codex detail 的发送开关必须实际影响 Context Bundle；General Chat 不默认绑定 Scene、不暴露 Proposal 操作、system prompt 完整可见且无隐藏追加 prompt；General Chat 和 Agent 都将 reasoning 与正式回答分离流式显示，reasoning 位于正文上方并默认展开；一个 Send、Sending、Stop、Stopping 控件真实取消 Provider 请求；模型选择、模型运行选项和 Provider Settings 使用三个相邻但职责分离的入口，推理设置按 Provider 连接和精确模型名称持久化；两个编辑独立评审产生可见分歧；候选应用前磁盘不变；过期 Proposal 被拒；事实提取进入收件箱而非 Canon；Tool Plan 只有在用户明确授权后才能通过共享命令适配器操作 Write/Codex，或退回 Proposal。

验收 ID：`M5-A01` 至 `M5-A45`，详见 `docs/testing/M5_ACCEPTANCE.md`。

## M6 资料分析库

覆盖：作品库级多个隔离 Research Database；TXT、Markdown、DOCX、文本 PDF、EPUB、HTML 和作者明确提交地址后的受控网页快照；SourceLocation、FTS5、可选 Embedding、Research Note 和权限。

完成标准：多个知识库在目录、来源、索引、权限、损坏和生命周期上互相隔离；同一知识库可显式关联多个 Series；默认单库检索，明确多选才联合返回带库标识的结果；六种文件 fixture 与受控网页地址 fixture 解析；中/日/英及混合语言原文检索；中文查询对无共享词项的日文和英文资料进行可验证的跨语言召回；结果公开关键词、别名、转写、查询翻译或语义命中方式并回指原文；扫描 PDF 诚实失败；危险文件和危险网页目标隔离；资料不能越权进入模型。

M6 语义检索必须复用产品与目标架构定义的共享 `EmbeddingModelProfile`、按用途路由和 profile 级并发基础设施，不得创建资料库私有的第二套 Embedding 配置或静默云端回退。

`NS-601 / M6.0` 先完成数据库架构规划。`NS-602` 随后交付 Series 派生索引内核和第一条 TXT/Markdown Research 来源页面。作者在 NS-602 视觉通过后明确改变 Research 所有权边界，因此 ADR-0019 和 `NS-603` 先把 Research 改为作品库级多个隔离知识库，并建立显式多 Series 关联和旧来源迁移。`NS-604` 已提交 SourceDocument version 3、DOCX、文本 PDF、EPUB、HTML、受控网页地址、SourceLocation/Chunk、语言片段、大文件有界读取和单个当前知识库的原文关键词索引自动化证据；其独立作者视觉决定仍保持打开。`NS-605` 已提交明确多选知识库查询、数据库内持久别名/转写、多语言能力验证、独立可重建向量、确定性融合和无共享词项的跨语言检索工程证据，独立作者视觉决定仍保持打开。作者明确要求开发不要停在这些视觉门，因此 `NS-606` 已按 ADR-0021 完成三个严格模型只读检索工具、固定服务器预算、原文引用校验、取消和脱敏持久审计；`NS-607` 已提交 Workshop 会话激活、模型原生检索循环、原文引用、全部 Research/Codex 工具的生产策略和行为评测框架，其独立作者验收仍保持打开；`NS-608` 已完成保存的真实凭据和 `deepseek-v4-pro` 多会话多轮作者工作流、对抗、恢复、性能及最终数据库审查的自动化证据，作者验收仍保持打开。当前活动任务 `NS-609` 按 ADR-0024 实现数据库拥有的证据绑定 Research Note，以及只有经过 Series Proposal 与 Review 才能进入 Codex Research 或 Canon Description 的提升流程。任务顺序变化不改变 JSON 权威、原文 Evidence 或 Series 派生索引仍可重建的原则，任何一个任务的状态都不能代表这些后续任务已经实现。

NS-601 验收 ID：`NS-601-A01` 至 `NS-601-A10`，详见 `docs/tasks/NS-601.md`、`docs/testing/NS-601_ACCEPTANCE.md`、`docs/architecture/DATABASE_ARCHITECTURE.md` 和 ADR-0018。NS-603 起的 Research Database 所有权修订由 ADR-0019 控制。

## M7 Word、版本与备份

覆盖：自动/手工快照、版本比较恢复、定时备份、Markdown/DOCX 导入、书签导出和场景级重导。

完成标准：真实 Word 往返 fixture 通过；书签丢失有人工确认回退；备份可恢复到新目录；迁移有回滚。

## M8 长期可用版本

覆盖：首次目录选择、双击启动、应用内关闭、故障恢复、安全与性能、用户文档。

性能 fixture 至少包含两百万中文字符、数千场景和大型资料库。常用保存、场景打开和搜索不能被 AI 或重索引阻塞。

最终必须逐项通过 `PRODUCT_SPEC.md` 第 16 节的十二步用户旅程。

## 永久非目标检查

每个里程碑评审都确认没有意外引入：支付、套餐、公共市场、遥测、团队席位、自动云端回退或未认证远程监听。
