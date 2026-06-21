# 最新交接

更新时间：2026-06-21

## 仓库状态

- 分支：`main`
- 最近相关提交：查看 `git log -5 --oneline`；应包含 NS-401、NS-402、NS-403、NS-404/NS-405、NS-406 提交。
- 当前任务：`NS-406` 已完成；M4 已拆成 `NS-401` 至 `NS-410`。下一任务是 `NS-407`，目标是非写入型 AI 调用、SSE 流式输出和 ModelCallLog。
- 预期脏文件：无。接手时运行 `git status --short` 核实；如不为空，先判断是否为用户未提交改动。

## 已完成

- NS-301：显式层级、事务、迁移与校验。
- NS-302：共享 PlanningBoard、四种规划视图、双时间线、结构命令和人工分叉。
- NS-303：
  - `@milkdown/kit`/React 7.21.2 编辑场景 Markdown，原稿仍为 YAML frontmatter + Markdown；
  - 标题、正文、字符/段落统计、900ms 自动保存、409 冲突和真实磁盘重载；
  - localStorage 草稿记录基础 revision，区分可直接恢复与基于旧版本的草稿；
  - `sections/<scene-id>/<section-id>.md` 五类 Section、三档 AI 权限、独立 revision、归档和恢复；
  - `review/anchors/<anchor-id>.yaml` 锚点，以及原位、唯一引用、上下文消歧和明确 orphaned 规则；
  - ADR-0007、A01–A12 执行规格和逐项验收记录。
- NS-304：
  - 六个内置类别和 `codex/categories/<category-id>.yaml` 自定义类别；内置类别不可变更；
  - 已确认设定条目、`codex/entry-research/<entry-id>.md` 参考笔记和 `codex/relations/<relation-id>.yaml` 物理分离，各自保有 revision；
  - 条目名称、别名、标签、自定义字段、缩略图引用、提及规则和 `always/on-mention/manual/never` 上下文策略；
  - 名称/别名、排除词、大小写、英文复数、最长词优先和同范围歧义的 SQLite 可重建提及索引；
  - Scene 保存只增量重建当前场景的 Codex 提及；条目变化重建 Codex 派生索引，不改 Scene 正文或显式关联；
  - 有向/无向关系保留原始 source、target 和 relation ID，归档代替删除；
  - Fastify `/api/v1` 设定库类别、条目、参考笔记、关系、正文提及、资料范围预览和搜索接口；
  - 三栏设定库界面，以及规划追踪表使用条目名称显示稳定引用；
  - ADR-0008、A01–A12 执行规格和逐项验收记录。
- 界面中文术语修正：
  - 主导航使用“设定库 / 编辑室 / 待确认”，不在界面暴露 Codex、Workshop、Review；
  - 设定库使用“已确认设定 / 参考笔记 / 识别规则 / 正文提及”，不在界面暴露 Canon、Research、Details、Mentions；
  - 模型相关范围使用“模型可读范围 / 资料范围 / 主动选择”，不得再写“手工钉住”；
  - 写作右侧抽屉使用“附属文档”，不在界面暴露 Section；
  - 状态、规划标签和统计使用“草稿 / 视角 / 追踪表 / 字”，不在界面暴露 draft、POV、Matrix 或“字符”。
- NS-305 核心实现：
  - `codex/progressions/<id>.yaml` 保存故事进展，支持条目与关系目标、追加事实和替换此前状态；
  - `codex/knowledge/<id>.yaml` 保存角色所知，支持知道、相信和误解，并与世界事实分离；
  - 有效状态查询按叙事场景计算，不因倒叙或故事时间提前泄露后文；
  - 未来记录只返回数量，不返回摘要、证据或内部 ID；
  - 证据可引用正文场景、设定条目和关系；正文引文必须能在场景正文中找到；
  - `/api/v1` 已增加故事进展、角色所知和此刻有效状态接口；
  - 设定库详情页已增加“进展记录”“角色所知”“此刻有效”区域；
  - ADR-0009、数据模型文档、接口文档和 `docs/testing/NS-305_ACCEPTANCE.md` 已补齐。
- 启动器防重入修复：
  - `scripts/start.ps1` 增加 `Local\NovelStudioStartLock` 启动互斥锁；
  - 健康检查通过时复用已有服务；
  - 端口被占用但健康检查失败时直接报错，不再另起冗余后台服务。
- NS-306：
  - 作品库非空时显示“新建系列”表单；
  - 新建系列后立即打开，并保留旧系列列表；
  - 已增加 `POST /api/v1/series/:seriesId/books`，创建新部时同步建立第一幕和第一章；
  - 写作抽屉按“部 → 幕 → 章 → 场景”展示，并提供“新场景 / 新部 / 新幕 / 新章”；
  - 每个幕提供“新章”，空幕显示“给这一幕添加第一章”；
  - 自动标题使用“第二部 / 第二幕 / 第二章”等中文序数；
  - 全量 check 与浏览器验收通过。
- NS-400 当前进度：
  - 已新增 `docs/tasks/M4_PREP.md` 和 `docs/testing/NS-400_ACCEPTANCE.md`；
  - 已更新当前架构文档，不再停留在 M0–M2；
  - 已将 Codex API 路由拆到 `apps/server/src/routes/codex.ts`；
  - `apps/server/src/app.ts` 从约 718 行降到 363 行，继续只负责 Fastify 创建、错误处理、领域路由注册和静态资源；
  - 已将 storage 的 `StorageError`、路径归属/原子写入/存在性检查、多文件事务拆到 `errors.ts`、`fileSystem.ts`、`fileTransactions.ts`；
  - 已将 `CodexView.tsx` 拆为顶层列表视图、`CodexEntryEditor.tsx` 和 `CodexEntryPanels.tsx`，顶层视图从约 692 行降到 162 行；
  - 已新增 `packages/storage/test/smoke.test.ts` 和 `npm.cmd run test:smoke`，覆盖创建写作恢复、层级创建校验、设定库提及/资料范围/未来事实隔离；
  - 已在 `packages/contracts/src/index.ts` 定义 `ContextBundle`、`ContextItem`、`PromptTemplate`、`ModelCallLog`、`Proposal` 与 `ProposalPatch` 最小契约，并写入架构/API/数据模型文档；
  - NS-307：写作页结构栏已改为更清晰的部 / 幕 / 章 / 场景布局；`CreateSceneInput` 支持 `bookId`、`actId`、`chapterId`，第二部章节内可以直接新建场景；
  - server typecheck、server test、storage typecheck、storage test、web typecheck、web test 和全量 `npm.cmd run check` 通过。
- NS-400 启动 / 浏览器验收补丁：
  - `/api/v1/health` 现在返回 `version`、`commit`、`startedAt`、`workspaceRoot` 和 `libraryRoot`，启动脚本用这些字段确认端口上的服务来自当前工作区和当前提交；
  - `scripts/start.ps1` 默认会重启当前 checkout 的服务，只有显式 `-ReuseExisting` 才复用身份匹配的已有服务；
  - `scripts/start.ps1 -Wait` 会让服务保持在当前命令生命周期内，供 Codex Browser 或其他自动化验收使用；
  - 启动脚本会清理记录过的 starter / port owner 进程，避免 npm 父进程占住日志句柄；
  - 当 `data/server.*` 文件被 Windows 或宿主环境锁住时，启动脚本会把本次日志和 pid 状态写到 `%TEMP%\novel-studio`；
  - 新增 `docs/DEVELOPMENT.md` 和 `scripts/dev-shell.ps1`，统一 PowerShell UTF-8 文本读取约定。
- NS-400 启动器瘦身补丁：
  - `scripts/start.ps1` 不再通过 `npm start` 父进程间接启动服务，改为直接运行 `apps/server/dist/index.js`；
  - 新增 `-SmokeTest`，用于 Codex / 自动化环境中的启动验收：启动、等待 health、输出身份、停止临时服务；
  - 新增 `-Foreground`，用于 Playwright 或其他测试工具托管服务生命周期；
  - 新增 `-Stop`，用于显式停止当前 checkout 的本地服务；
  - 保留轻量 `Local\NovelStudioStartLock` 互斥锁，并恢复当前工作区 + commit 健康校验，避免并发启动和误复用旧服务；
  - 固定 `data/server.*` 文件被锁住时不再刷出多条 warning，改为简短提示并使用 `%TEMP%\novel-studio`。
- NS-400 浏览器验收补丁：
  - 已新增 `@playwright/test`、`playwright.config.ts`、`tests/e2e/` 和 `docs/testing/BROWSER_ACCEPTANCE.md`；
  - Playwright 全局 setup 在测试进程内启动 Fastify，并使用 `%TEMP%\novel-studio-browser-acceptance\library` 作为隔离作品库，测试结束后关闭服务；
  - 当前自动化浏览器用例覆盖 M3 已实现主路径，以及 M4 的模型设置、上下文预览和提示词预览最小路径；
  - 未完成的 AI 调用、完整上下文日志和候选变更验收仍写入待实现目录，不以跳过测试或占位断言冒充通过。
- M4 规划补丁：
  - 已新增 `docs/tasks/M4.md`；
  - `TASKS.md` 已将 M4 拆成 `NS-401` 至 `NS-410`；
  - `NS-401` 至 `NS-406` 已完成，当前从 `NS-407` 继续非写入型调用闭环。
- NS-401：
  - 已新增 `docs/tasks/NS-401.md`；
  - 已更新 `docs/architecture/API.md`，写入模型配置、提示词、上下文预览、非写入调用和调用日志 API 草案；
  - 已更新 `docs/architecture/DATA_MODEL.md`，写入 ModelProfile、AgentRole、PromptTemplate、ContextBundle、ModelCallLog 和 Proposal 文件草案；
  - 已更新 `docs/testing/BROWSER_ACCEPTANCE.md`，把 M4 浏览器验收映射到后续任务；
  - 已新增 `docs/testing/NS-401_ACCEPTANCE.md`；
  - 未新增真实 Provider、模型调用代码、API key 文件或正文 / Canon 写入能力。
- NS-402：
  - 已新增 `packages/contracts/src/common.ts`、`ai.ts`、`context.ts`、`prompts.ts`、`proposals.ts`，并让 `index.ts` 继续 re-export；
  - 已新增 `packages/storage/src/aiFiles.ts`；
  - `ProjectRepository` 已暴露模型配置、角色、提示词、Preset、上下文包和调用日志的最小读写方法；
  - `openIndex` 已创建 `ai_context_bundles` 和 `ai_model_calls`，`rebuildIndex` 会重建 M4 派生索引；
  - 已新增 `packages/storage/test/ai-files.test.ts`；
  - 已新增 `docs/tasks/NS-402.md` 和 `docs/testing/NS-402_ACCEPTANCE.md`；
  - 未新增真实 Provider、模型调用代码、API key 文件或正文 / Canon 写入能力。
- NS-403：
  - 已新增 `packages/ai` workspace；
  - 已实现 `ProviderAdapter`、`ProviderRegistry`、默认 registry 和 `MockProvider`；
  - MockProvider 支持连接测试、模型列表、能力描述、流式输出、结构化输出、embedding 和 token 估算；
  - MockProvider 可模拟认证失败、限流、模型不可用、结构化输出失败、上下文过长和未知错误；
  - 已新增统一 `ProviderAdapterError` 与 `classifyProviderError`，错误会归类为 `ModelCallError`；
  - 根目录 `build:packages` 已把 `@novel-studio/ai` 加入 contracts 与 storage 之间；
  - 已新增 `packages/ai/test/mockProvider.test.ts`、`docs/tasks/NS-403.md` 和 `docs/testing/NS-403_ACCEPTANCE.md`；
  - 未新增真实 Provider、模型设置 UI、API key 文件、网络调用或正文 / 已确认设定写入能力。
- NS-404：
  - 已新增模型配置 API、作品级云端权限 API 和 Provider 连接测试路由；
  - 已新增 `apps/server/src/ai/policy.ts`，集中处理云端禁用、凭据引用和错误状态；
  - 已新增 `packages/ai/src/credentials.ts`，提供凭据存储抽象与 Windows Credential Manager 实现，不落明文文件；
  - `CredentialRefSchema` 会拒绝明显的明文密钥字符串；
  - 设置页“模型与资料权限”可添加本机验收模型、建立 Provider 配置占位、保存模型代号和凭据引用、测试连接；
  - 云端禁用或缺少凭据引用时服务端拒绝连接测试，不会退回 MockProvider；
  - 已新增 `docs/tasks/NS-404.md` 和 `docs/testing/NS-404_ACCEPTANCE.md`。
- NS-405：
  - 已新增 `POST /api/v1/series/:seriesId/context/preview` 和 `GET /api/v1/series/:seriesId/context/:contextBundleId`；
  - 上下文预览包含角色职责、提示词模板、用户请求、当前场景、可定位正文选区、前一场景摘要、可读设定条目、当前有效世界事实 / 关系变化 / 角色所知；
  - `never`、隐藏区段、仅本机资料、未选择 manual 资料和后文信息会进入排除清单；
  - 后文进展和角色所知只记录被排除，不泄露未来摘要、证据或内部 ID；
  - 写作页右侧“场景资料”已提供最小上下文预览入口；
  - 已新增 `docs/tasks/NS-405.md` 和 `docs/testing/NS-405_ACCEPTANCE.md`。
- NS-406：
  - 已新增 `apps/server/src/prompts/builtIns.ts`，补齐主笔伙伴、结构编辑、人物编辑、连续性编辑、文风编辑、冷酷读者、研究员 7 个内置角色；
  - 角色、提示词模板和 Preset 保存到 `prompts/roles`、`prompts/templates`、`prompts/presets`，内置角色只读，复制后可改；
  - 已新增声明式渲染器，只允许 `{{变量名}}`，缺少必填输入返回 `PROMPT_INPUT_MISSING`，表达式或未闭合占位符返回 `PROMPT_TEMPLATE_INVALID`；
  - 模板修改通过 `/ai/prompts/:promptTemplateId/versions` 生成新版本，不覆盖旧版本；
  - 上下文预览现在会纳入 `prompt-template` 项，记录 PromptTemplate ID、version 和渲染结果；
  - 设置页新增“角色与提示词”分区，可查看角色、复制角色、预览提示词、保存模板新版本；
  - 浏览器验收发现首次并发读取角色 / 模板 / Preset 会抢写内置 YAML，已加入每作品补种锁并增加并发测试；
  - 已新增 `docs/tasks/NS-406.md` 和 `docs/testing/NS-406_ACCEPTANCE.md`。
- NS-407：
  - 已新增 `apps/server/src/routes/modelCalls.ts` 并注册 `/api/v1/series/:seriesId/ai/calls`、调用列表、调用详情和调用上下文快照 API；
  - `POST /ai/calls` 使用 SSE 返回 `metadata / delta / usage / done`，失败时返回 `error` 并保存失败日志；
  - 调用日志记录模型、角色、PromptTemplate ID/version、ContextBundle ID、请求 / 响应哈希、状态、错误分类和用量，不保存密钥或认证头；
  - MockProvider 的分析任务返回非写入审稿结果，`rewrite` 等正文任务只返回候选正文；
  - 写作页右侧新增“AI 审阅”面板，提供“审稿 / 改写”最小闭环；
  - 改写候选直接进入正文编辑器并整段选中，作者点击“保留”后才保存，点击“撤回”恢复生成前正文；
  - 写作主界面不显示调用来源、基准版本、用量或调用 ID；完整日志 UI 留给 `NS-409`；
  - 已将用户视角、风格统一、图像模型预览和 UI 预览资产管理规则补入 `docs/product/USER_EXPERIENCE_SPEC.md`、`docs/product/PRODUCT_SPEC.md`、`AGENTS.md` 和 `docs/testing/BROWSER_ACCEPTANCE.md`；
  - 已新增 `docs/tasks/NS-407.md` 和 `docs/testing/NS-407_ACCEPTANCE.md`。

## 验证

- `npm.cmd run check`：退出码 0。
- Server 6/6，Web 14/14，Storage 39/39。
- `npm.cmd run test:smoke`：1 个文件、3 条烟测通过。
- NS-307 后 `npm.cmd run check`：通过；Server 6/6，Web 14/14，Storage 39/39，生产构建通过。
- `scripts/start.ps1 -NoBrowser`：已有健康服务存在时复用当前服务，没有启动新的监听进程。
- 浏览器中文 fixture：已确认设定与参考笔记独立保存、自定义类别、同名歧义不误分配、有向关系、`on-mention`/`never` 资料范围预览、归档恢复和追踪表名称解析通过。
- 浏览器文案抽样：主导航、首页、概览、规划、写作抽屉、设定库、编辑室、待确认均无 `Canon/Research/Section/POV/tokens/AI/钉住/手工/0 字符` 等旧界面词；控制台无 warning/error。
- 浏览器控制台：无 warning/error。
- 浏览器 NS-305：通过。创建进展记录、创建角色误解、后文变化隐藏、角色所知归档/恢复和控制台检查均通过。
- 浏览器 NS-306：通过。非空作品库新建系列、新建第二部、第二部下新建第二幕、空幕新建第一章，本地 API 校验为 2 部、3 幕、3 章、`valid=true`。
- 进程：用户授权后停止旧 PID 52088；沙箱外启动最新服务，当前 `127.0.0.1:4317` 由 PID 50388 监听。
- `git diff --check`：通过（仅 Windows 换行转换提示）。
- Codex Browser 更新后复测：
  - `node_repl/js` 最小探针通过，`sandboxPolicy` 错误不再出现；
  - Browser 插件 `26.616.51431` 文档接口可返回；
  - in-app browser 打开 `http://127.0.0.1:4317/`，读取作品库 DOM，并点击“雾港纪事 10 个场景 · 更新于 6月20日”进入作品概览，heading 为“雾港纪事”。
- 2026-06-21 `npm.cmd run check`：通过；Server 7/7，Web 14/14，Storage 39/39，生产构建通过。沙箱内首次运行因 `dist` 目录 EPERM 失败，沙箱外使用已批准前缀重跑通过。
- 2026-06-21 `scripts/start.ps1 -NoBrowser -SkipBuild -SmokeTest`：通过；临时服务返回 health，随后脚本停止该服务；检查 `127.0.0.1:4317` 无残留监听进程。
- 2026-06-21 最终收口 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -NoBrowser -SkipBuild -SmokeTest`：通过；互斥锁版本脚本启动并停止临时服务，端口只剩 `TIME_WAIT`，无监听进程。
- 2026-06-21 最终收口 `npm.cmd run check`：通过；Server 7/7，Web 14/14，Storage 39/39，生产构建通过。
- 2026-06-21 最终收口 `npm.cmd run test:e2e`：通过；构建后 1 个 Chrome 用例通过，命令自然退出；端口只剩 `TIME_WAIT`，无监听进程。
- 2026-06-21 NS-401 收口 `npm.cmd run check`：通过；Server 7/7，Web 14/14，Storage 39/39，生产构建通过。
- 2026-06-21 NS-402 `npm.cmd run typecheck -w @novel-studio/contracts`：通过。
- 2026-06-21 NS-402 `npm.cmd run typecheck -w @novel-studio/storage`：通过。
- 2026-06-21 NS-402 `npm.cmd run test -w @novel-studio/storage`：通过；3 个文件、41 项测试。
- 2026-06-21 NS-402 `npm.cmd run check`：通过；Server 7/7，Web 14/14，Storage 41/41，生产构建通过。
- 2026-06-21 NS-403 `npm.cmd run typecheck -w @novel-studio/ai`：通过。
- 2026-06-21 NS-403 `npm.cmd run test -w @novel-studio/ai`：通过；1 个文件、9 项测试。
- 2026-06-21 NS-403 `npm.cmd install --package-lock-only --ignore-scripts`：通过；沙箱内首次因 `package-lock.json` 写入 EPERM 失败，提升权限后更新 lockfile。
- 2026-06-21 NS-403 `npm.cmd run check`：通过；Server 7/7，Web 14/14，AI 9/9，Storage 41/41，生产构建通过。
- 2026-06-21 NS-404/NS-405 `npm.cmd run test -w @novel-studio/ai`：通过；1 个文件、10 项测试。
- 2026-06-21 NS-404/NS-405 `npm.cmd run test -w @novel-studio/server`：通过；3 个文件、10 项测试。
- 2026-06-21 NS-404/NS-405 `npm.cmd run typecheck -w @novel-studio/web`：通过；首次沙箱内运行因 `tsconfig.tsbuildinfo` 写入 EPERM 失败，提升权限后通过。
- 2026-06-21 NS-404/NS-405 `npm.cmd run test -w @novel-studio/web`：通过；5 个文件、14 项测试。首次沙箱内运行因 Vite 临时文件写入 EPERM 失败，提升权限后通过。
- 2026-06-21 NS-404/NS-405 `npm.cmd run check`：通过；Server 10/10，Web 14/14，AI 10/10，Storage 41/41，生产构建通过。
- 2026-06-21 NS-404/NS-405 `npm.cmd run test:e2e`：通过；1 个 Chrome 用例，覆盖添加本机验收模型、连接测试和写作页生成上下文预览。
- 2026-06-21 设置页 UI 修正：`npm.cmd run test:e2e` 通过，并产出 `m4-settings-model-profile.png` 与 `m4-write-context-preview.png` 截图附件；`npm.cmd run check` 通过。
- 2026-06-21 浏览器验收端口修正：Playwright E2E 默认监听 `127.0.0.1:4318`，避免和日常启动器的 `4317` 服务互相抢占；`NOVEL_STUDIO_E2E_PORT` 可覆盖。
- 2026-06-21 NS-406 `npm.cmd run typecheck`：通过。
- 2026-06-21 NS-406 `npm.cmd run test`：通过；Server 4 个文件、11 项测试；Web 5 个文件、14 项测试；AI 1 个文件、10 项测试；Storage 3 个文件、41 项测试。
- 2026-06-21 NS-406 `npm.cmd run test:e2e`：通过；1 个 Chrome 用例，覆盖设置页“角色与提示词”和提示词预览，产出 `m4-prompt-template-preview.png` 截图附件。
- 2026-06-21 NS-406 `npm.cmd run check`：通过；Server 11/11，Web 14/14，AI 10/10，Storage 41/41，生产构建通过。
- 2026-06-21 NS-407 `npm.cmd run typecheck`：通过。
- 2026-06-21 NS-407 `npm.cmd run test`：通过；Server 5 个文件、13 项测试；Web 5 个文件、14 项测试；AI 1 个文件、10 项测试；Storage 3 个文件、41 项测试。
- 2026-06-21 NS-407 `npm.cmd run test:e2e`：通过；1 个 Chrome 用例，覆盖 AI 审稿、选区改写、正文内联候选、真实选区和保留后保存，产出 `m4-ai-panel-ready.png`、`m4-ai-review-result.png`、`m4-ai-inline-candidate-selected.png` 截图附件；人工查看确认候选条只显示“候选待确认 / 保留 / 撤回”。
- 2026-06-21 NS-407 `npm.cmd run check`：通过；Server 13/13，Web 14/14，AI 10/10，Storage 41/41，生产构建通过。

## 已知限制

- Milkdown 在编辑后可能把等价 CommonMark 标记规范化（如 `-`→`*`、`---`→`***`）；正文文字与语义保持，未保存私有 JSON。
- Section 当前显式保存；尚未提供 Section 版本历史或候选稿差异，这属于 M5 Proposal/版本能力。
- 锚点只存证据和定位状态；批注正文、讨论线程与候选修改属于 M5。
- 设定库关系当前表示静态基础关系；关系随剧情变化必须由 NS-305 进展记录追加历史，不能覆盖基础事实。
- 正文提及只表示名称出现在正文，不自动把条目加入场景的人物、地点或情节线显式关联。
- 同名同范围被记录为歧义并不分配给任一条目；人工消歧 UI 尚未实现。
- 当前没有应用内停止服务或托盘入口；启动脚本记录 PID 状态并会清理可确认属于本 checkout 的旧进程，但不会结束无法确认来源的端口占用者。
- 早前手工浏览器验收留下了测试用系列、故事进展、未来隐藏记录和角色所知记录；它们位于本地示例作品库，不进入 Git。新的 Playwright 验收使用隔离临时作品库。
- 当前 Codex 更新后内置 Browser 控制通道已恢复；若后续再次出现 `sandboxPolicy` 或 URL policy 错误，先用 `node_repl/js` 最小探针和 Browser 插件文档接口分层确认，不要再用本地代理绕过。Codex shell 中不要依赖“命令结束后仍保留后台服务”的假设；启动验收优先用 `-SmokeTest`，浏览器或 E2E 验收应由能托管服务生命周期的工具使用 `-Foreground`。
- NS-404 至 NS-407 只实现最小设置页、写作页上下文预览入口、提示词预览入口和 AI 审稿 / 改写入口；完整上下文分组、调用记录 UI、完整角色 / 变量 / Preset 编辑器和更多浏览器 E2E 归入 `NS-409` 或后续 UI 整理。
- UI 相关任务必须进行真实浏览器操作并保存截图证据；不要再只用 DOM 断言证明“按钮能点”。当前规则写在 `docs/testing/BROWSER_ACCEPTANCE.md`。
- UI 方向不清晰时应先用当前截图和 UX 要求生成少量视觉预览；预览图必须按 `USER_EXPERIENCE_SPEC.md` 管理，未采纳探索图不进入项目。
- 真实 Provider、真实密钥录入尚未实现；属于 `NS-408`。

## 唯一下一任务

`NS-408`：OpenAI-compatible、Ollama、OpenAI、OpenRouter、Anthropic、Gemini Provider 接入。

当前优先级：

1. 在统一 `ProviderAdapter` 下接入真实 Provider 协议层，优先 OpenAI-compatible 和 Ollama。
2. 继续复用 NS-404 的云端权限和凭据引用边界，不得从本地模型静默回退云端。
3. 单元测试覆盖连接测试、模型列表、流式文本、结构化输出能力声明和错误分类。
4. 不把真实 API 密钥写入作品目录、日志、浏览器控制台或 Git。
5. 浏览器 UI 若有改动，必须截图并检查风格统一与中文文案。
