# AI 编辑团队、上下文与 Proposal 规格

状态：权威功能规格  
依赖：`PRODUCT_SPEC.md`

## 1. 设计目标

AI 系统的目的不是替作者连续生成整本小说，而是成为一间可控制、可追责、具有真实专业分歧的编辑室。

核心约束：

- 一个角色一次只承担清楚的职责。
- 角色必须基于证据给出意见，而不是输出泛泛鼓励。
- 所有写入先形成 Proposal。
- 模型调用的上下文、成本、权限和来源都可检查。
- 角色、提示词、模型和参数均可由用户修改并版本化。

正文候选的界面规则：

- AI 不开单独窗口覆盖写作流程。
- 分析结果显示在写作页侧栏；正文候选必须直接放入正文编辑器。
- 候选正文放入后必须整段选中，并暂停自动保存。
- 作者点击“保留”后，候选才按普通场景保存流程写入 JSON `SceneBlockDocument` 权威文件；Markdown 只作为投影、导出或外部往返边界。
- 作者点击“撤回”时，正文恢复到生成前版本。
- 调用记录、上下文包、模型、提示词版本和用量可以从记录中检查，但不应抢占写作主界面。

## 2. 角色与 Prompt 模型

### 2.1 用户自定义角色

`AgentRole` 是用户可创建、可修改、可归档的项目数据，不再由系统补种固定编辑团队。每个角色至少记录：

- `id`、名称和说明。
- 职责范围与明确非职责。
- 人格和表达偏好。
- 评价标准与反对义务。
- 禁止行为和写入权限。
- 可读取的 Context Item 类型。
- Prompt 组件与输出 Schema。
- 版本、创建来源和最后修改时间。

角色可以服务于写作、结构、人物、连续性、风格、读者反馈、资料整理或作者自定义的任何工作流。系统可以提供创建入口和推荐建议，但不得假设项目中存在一组固定全局内置角色。

### 2.2 Prompt 模板

`PromptTemplate` 是声明式、版本化的项目数据。模板修改必须生成新版本，旧调用日志继续指向旧版本。模板只允许受控变量替换和组件拼接，不执行任意代码。

### 2.3 Workshop 专属 Prompt

Workshop 的 `general-chat` 和 `agent` 模式使用 Workshop 专属 prompt 配置，不复用全局 `AgentRole` 或 `PromptTemplate`：

- General Chat 使用作者可见、可编辑且按 chat session 独立持久化的 system prompt 和当前用户请求。新 chat session 快照内置默认 prompt；切换会话恢复各自值，分支继承源会话值，调用与 resend 只读取目标 session 的已保存值。
- Agent 使用 Workshop Agent prompt、写作方法和 server-owned Codex 工具注册表；普通回复走文本通道，只有真实工具调用走 Provider 工具协议。
- 这两种模式的 prompt 配置必须集中在 Workshop 专属模块，并为后续 UI 自定义预留数据接口。

Workshop Agent 是对话 agent，不是单次聊天发射器。普通讨论、写作、prompt 修改和小说推敲应自然回复；只有在作者表达 Codex/story-memory 创建或更新意图且目标内容清楚时，才生成 server-owned 工具请求。

每个作者回合对应一个持久化 Agent run。run 记录有序的 Provider attempt、assistant text、工具请求、等待确认、工具结果、修复/重试和续跑步骤；普通自然语言回复可以直接完成 run，不经过 `respond` JSON schema。工具结果必须作为同一 run 的后续输入，续跑产生的新工具请求仍需单独确认。工具名或参数不合格时，server 将安全的校验结果作为 tool error 送回同一 run 并自动续跑；显式结构化最终输出的 schema repair 与 Provider transport retry 使用各自的有界预算。预算耗尽后，run 保留为可重试失败，作者可在不发送新消息的情况下追加新 attempt。进程重启后不得静默重放未完成写入；只有效果可证明安全或已标记为可重试的步骤才能恢复，作者也可以终止该 run。

## 3. 调用模式

### 3.1 单角色调用

适合日常任务。系统可根据任务推荐角色，但用户最终选择。推荐不应自动增加更多模型调用。

Workshop 的 General Chat 属于讨论型单角色调用。它必须满足：

- 不默认绑定当前写作场景；上下文完全来自用户显式选择。
- system prompt 完整暴露给用户编辑，允许为空，不在服务端追加不可见的默认角色 prompt；它在发送前保存到当前 chat session，Provider 调用不得接受 request-local prompt 覆盖。
- 输出不得自动进入 Proposal，也不得在前端暴露 Create Proposal 操作。
- 当精确模型声明 reasoning 能力时，请求默认启用 reasoning。流式 reasoning 与正式回答分离存储和显示，并在第一段内容到达时立即出现在正文上方；每条消息默认展开，作者可用该消息自己的内联箭头折叠或重新展开。界面不提供全局、模型级或消息菜单内的 `Show reasoning` 开关。
- 普通未关联 Proposal 的 General Chat 内容只能按完整、已结束的对话 turn 删除；不得单独删除作者问题或助手回复而留下孤立历史。Agent 协议消息、pending turn 和已进入 Proposal 审计链的消息不得删除。

### 3.2 编辑会审

步骤：

1. 用户选择场景/章节、问题和参与角色。
2. 系统生成共享基础 Context Bundle，并按角色权限派生各自版本。
3. 第一轮并行独立生成；角色看不到其他角色结果。
4. 结果以独立意见卡展示，不先汇总抹平分歧。
5. 用户可选择由“主编汇总器”整理共识、分歧和决策问题。
6. 汇总器只能引用现有意见和证据，不得新增未审查的结论。
7. 任何修改建议仍以独立 Proposal 进入 Review。

用户可在会审前看到预计调用数和用量。默认不在每章完成后自动召集全团队。

### 3.3 后台分析

按作品配置三种策略：

- 手动触发。
- 章节完成时触发。
- 场景确认后自动分析。

无论采用哪种策略，分析结果只进入收件箱。自动分析不得阻塞正文保存，失败也不得影响原稿。

## 4. Context Bundle

### 4.1 装配顺序

一次场景任务按以下顺序装配：

1. 角色职责、禁止行为和输出契约。
2. 当前 Prompt 及用户输入。
3. 当前场景标题、目标、Beats、摘要和选区。
4. 当前场景正文或任务所需正文窗口。
5. 相邻场景与此前场景摘要。
6. 截至当前叙事位置有效的 Codex 和 Progression。
7. POV 角色当前知道、相信或误解的事实。
8. 活跃情节线、伏笔和承诺。
9. 风格档案与用户钉住资料。
10. 获准使用的研究片段。

装配顺序影响优先级，但不能靠重复同一资料提高权重。

### 4.2 Context Item

每项上下文包含：

- 稳定 ID、类型和来源实体 ID。
- 来源 revision 和故事生效范围。
- 是否由用户钉住。
- 来源权限与排除原因。
- 字符/token 估算。
- 内容摘要或实际发送内容。

### 4.3 默认排除

- 当前场景之后的正文和摘要。
- 尚未生效的 Progression。
- POV 角色未知的秘密，除非任务需要全知视角。
- `Never Include` Codex 条目。
- 隐藏 Section、API 密钥和内部应用日志。
- 来源策略或 `never` 规则禁止发送的资料。
- 仅因语义相似但缺乏任务相关性的远距离资料。

### 4.4 上下文预算

- 先保留角色规则、用户要求和当前正文。
- 再保留相关 Canon 和有效状态。
- 较远场景优先使用已确认摘要。
- 超预算时显示被裁剪项目及理由。
- 不得静默用 AI 临时摘要替换 Canon 摘要。

### 4.5 预览与日志

调用前用户可以展开每个 Context Item，手工取消或钉住允许的项目。调用后日志保存项目清单、revision、模型和用量；敏感正文不额外复制进普通日志。

### 4.6 Research Database 检索工具

Research Database 不通过把检索到的全部文件或全部相关 Chunk 预先追加到
Prompt 来接入模型。Workshop 会话只保存作者明确激活的作品库级数据库标识；
Provider 首次请求只获得紧凑的数据库元数据和只读工具定义。支持 native tool
calls 的模型可以在同一作者回合中调用 `research.list_sources`、
`research.search` 和 `research.open_passage`，根据结果继续缩小查询或打开相邻
原文。General Chat 和 Agent 使用同一只读网关；Codex 等写工具仍遵守独立确认
边界。

服务端而不是模型负责数据库白名单、Source `aiPermission`、单次返回数、相关性
阈值、重复片段合并、来源多样性、单次与累计字符/token 预算、最大工具次数、
无进展终止和取消。工具结果必须携带不变的 Research Database、Source、Chunk、
hash、revision、语言、SourceLocation 和实际检索通道，最终回答引用这些原文
锚点。模型不能要求读取未激活数据库、`never` Source、完整数据库转储、原始
文件路径或凭据。

词法检索、别名/转写、查询翻译和多语言向量是不同通道，必须逐项披露。只有
通过中日英正向、反向、专名、假朋友和无关负样本验证的 embedding profile
才能提供无共享词项的跨语言语义通道；否则网关明确降级为现有词法能力，不得
把中文查询偶然命中日文汉字描述成语义跨语言检索。

### 4.7 Workshop 模型行为 Harness

Workshop harness 的首要职责是在生产运行时约束模型行为，而不只是记录一次
测试是否通过。全部模型可见工具必须由同一个 server-owned 策略注册表声明工具
用途、可用会话模式、读写效果、确认要求、输入校验、输出校验和停止条件；模型
每一步只能看到当前模式、能力、数据库激活和确认状态允许使用的工具。

`research.list_sources`、`research.search` 和 `research.open_passage` 是可自动
执行的只读工具。`codex.create_entry` 和 `codex.update_entry` 是 Agent 模式下
需要作者确认的写入请求：调用参数必须先经过 schema、目标、revision 和产品边界
校验，持久化为待确认草稿，并绑定精确请求身份；确认后、实际执行前必须再次校验。
同一个 Provider step 不得混合自动读工具和待确认写工具，General Chat 不得获得
Codex 写工具，工具形状的普通文字不得被当作调用执行。

作者在同一会话中作出的纠正、拒绝、范围限制和已确认选择必须在后续回合持续
有效。作者不需要掌握提示词工程，也不需要反复重写详细约束；短句纠正必须足以
改变后续普通回复、Research 查询、Codex 草稿和工具参数。作者没有明确要求创建
或更新时，Agent 不得为了表现主动性而调用写工具；已经成功、拒绝、取消或失效的
写入不得被隐藏重放。

行为评测必须和生产 harness 分开但使用同一工具策略。评测记录完整模型调用、
工具调用、校验、确认、工具结果和最终数据库状态，并至少同时检查：最终 authority
是否正确、工具轨迹是否包含必要动作和禁止动作、对话是否让作者用自然短反馈完成
工作。开放式任务不得只按唯一工具序列评分；涉及写入确认、禁止重放、来源引用和
工具权限的安全边界必须使用确定性断言。真实模型因输出具有随机性，回归评测必须
支持同一任务多次 trial，不能用一次成功代替稳定性结论。

## 5. Proposal 系统

### 5.1 Proposal 类型

- `text-replacement`：正文替换。
- `text-insertion`：续写或插入。
- `scene-summary`：场景摘要。
- `codex-create` / `codex-update`。
- `progression-create`。
- `relation-update`。
- `plot-thread-update`。
- `beat-update`。
- `research-note`。
- `continuity-issue`：只报告，不直接修改。

### 5.2 必需字段

- Proposal ID、类型、状态。
- 目标实体与 `baseRevision`。
- 生成角色、模型、Prompt 版本和时间。
- 变更前、变更后或结构化 patch。
- Evidence 列表。
- 一句话理由、风险和置信度。
- 依赖的 Context Bundle ID。

### 5.3 状态

`pending → accepted / rejected / edited / stale / superseded`

- `accepted`：建立快照后应用。
- `edited`：用户修改候选后应用，保留原候选。
- `stale`：目标 revision 已变化；不得直接应用。
- `superseded`：被更新 Proposal 取代，但仍可审计。

### 5.4 Review 行为

- 逐项、按场景或按类别筛选。
- 正文使用行内/并排差异；结构化事实显示字段差异和生效点。
- 批量接受前预览所有目标和快照数量。
- 接受一项可能使其他 Proposal 过期时立即重新计算状态。
- 拒绝可选填原因，用于调整角色/Prompt，但不自动训练模型。

## 6. Prompt 系统

### 6.1 对象区别

- **Persona**：角色如何判断和表达。
- **Preset**：模型、参数、上下文策略和 Prompt 的组合。
- **Prompt**：某类任务的具体指令模板。
- **Input**：调用时需要用户填写的类型化字段。
- **Component**：可复用的模板片段。

### 6.2 模板能力

允许变量、条件、循环、列表筛选、文本拼接和转义。禁止：

- 任意 JavaScript 或系统命令。
- 读取未通过 Context Bundle 提供的文件。
- 网络访问。
- 访问密钥和系统环境变量。

### 6.3 版本

修改 Prompt、Persona 或 Preset 都建立版本。调用日志引用精确版本。内置默认模板升级时保留用户选择的旧版和差异。

## 7. ProviderAdapter

统一能力接口：

- `validateConnection`
- `listModels`
- `streamText`
- `completeChat`（normal assistant text、reasoning metadata、native tool calls、finish reason 和 usage 的统一结果）
- `generateObject`
- `embed`

`streamText`、JSON object、JSON schema、native tool calls、strict tool schema、parallel tool calls、reasoning replay、reasoning request controls、reasoning output kind 和 usage 必须分别声明能力，不能合并为一个 `structuredOutput` 判断。Reasoning request controls are resolved from the Provider connection and exact model name and may be a toggle, a Provider-declared effort set, a token budget, or unsupported; adapters must not invent a universal effort list. Provider transport emits typed reasoning and answer events instead of wrapping reasoning in answer text, and it preserves the opaque Provider metadata required for supported continuation. Workshop stores the resolved normalized request settings for retry and audit while credentials and Provider-private objects remain outside project data.没有 native tool call 能力的模型可以对话，但不得获得写工具或用文本模拟工具调用。
- `estimateTokens`
- `capabilities`

首批适配器：OpenAI、Anthropic、Gemini、OpenRouter、Ollama、OpenAI-compatible。

### 7.1 能力降级

- 模型不支持结构化输出时，适配器可使用严格 JSON Prompt 和验证修复，但必须显示降级状态。
- 模型不支持工具调用时，不得假装执行工具。
- 模型上下文不足时，Context Builder 重新裁剪并要求用户确认重要丢失项。
- 失败回退仅按用户配置执行；跨越本地/云端边界必须再次检查权限。

### 7.2 凭据

Windows 使用凭据管理器。作品文件只保存连接配置 ID，不保存密钥。错误日志屏蔽 Authorization、API Key、Cookie 和请求正文。

### 7.3 Embedding 调用

Embedding 是跨功能基础设施，不属于某一个 Agent、资料库或 Codex 工具的私有实现。系统必须提供独立于生成模型 `ModelProfile` 的 `EmbeddingModelProfile`，用于记录 Provider、服务地址、endpoint、模型名、维度、输入上限、批量大小、并发批次数、是否归一化、是否支持自定义维度、凭据引用和模型许可证。

Embedding 调用按 use case 路由，例如 Codex detail schema 规划、资料库语义检索、上下文检索和未来 M6 向量索引重建可以绑定到不同 profile。缺少显式绑定时只能使用已注册默认 profile，不能静默切换到其它模型或云端服务。

Embedding router 必须支持并发。并发限制是 profile 级的：同一 profile 受自己的批处理并发限制约束，不同 use case 若绑定到不同 profile，必须能同时运行，避免 M6 索引重建阻塞 Codex schema planner 或其它轻量功能。

首选默认本地模型为 `BAAI/bge-small-zh-v1.5`，通过本地 HTTP embedding 服务调用；应用不把模型权重捆进基础安装包，也不自动下载。云端 embedding 和用户自定义 embedding 模型只能通过显式 profile、凭据引用和权限检查接入。

向量索引记录必须保存模型、维度、profile、文本哈希和来源 revision。模型、维度、归一化策略或 Chunk 哈希变化时，对应向量索引必须可重建；语义相似度结果不得被描述为原文证据。

## 8. 风格档案

- 用户提供自己的样文或已确认正文。
- AI 提炼为可编辑规则：叙述人称、距离、句长倾向、比喻密度、对话习惯、禁用表达等。
- 提炼结果需要用户确认后成为风格档案。
- 不自动从全部草稿持续学习，避免把临时缺陷当成风格。
- 参考作品分析与用户风格档案分开；生成时不得要求复刻在世作者的独特表达。

## 9. 验收场景

1. 同一场景由两个不同职责的自定义角色独立评审，系统展示不同标准与真实分歧。
2. POV 角色不知道凶手身份时，写作上下文不包含该秘密；受控检查任务可在权限允许时读取世界真相进行核对。
3. 用户接受续写前磁盘正文不变；目标变化后 Proposal 自动 stale。
4. 模型调用必须使用作者显式选择的 Provider 和模型配置；缺少所需凭据时调用在发送前被阻止。
5. 用户能查看一次调用实际发送的所有 Context Item 和被排除项目。
6. 修改角色 Prompt 后，旧调用仍能定位到旧版本。
7. 编辑会审第一轮日志证明角色未收到其他角色输出。
