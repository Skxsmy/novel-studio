# 最新交接

更新时间：2026-06-21

## 仓库状态

- 分支：`main`
- 最近相关提交：查看 `git log -4 --oneline`；应包含 NS-400 收口和 NS-307 写作页布局 / 定向新建场景提交。
- 当前任务：`NS-307` 已完成；`NS-400` 增补了启动 / 浏览器验收可靠性修复；M4 已拆成 `NS-401` 至 `NS-410`。下一任务仍是 `NS-401`，目标是执行规格、接口草案、文件格式草案和 MockProvider 垂直切片设计。
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
  - 当前自动化浏览器用例只覆盖 M3 已实现主路径：创建系列、切换主要工作区、专注模式、新建第二部 / 第二幕 / 第一章 / 场景，并用 API 校验第二部场景归属；
  - M4/M5 的 AI、上下文和候选变更验收已写入待实现目录，不以跳过测试或占位断言冒充通过。
- M4 规划补丁：
  - 已新增 `docs/tasks/M4.md`；
  - `TASKS.md` 已将 M4 拆成 `NS-401` 至 `NS-410`；
  - 下一步仍从 `NS-401` 开始，先做执行规格、接口草案、文件格式草案和 MockProvider 垂直切片设计。

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

## 唯一下一任务

`NS-401`：按 `docs/tasks/M4.md` 开始 M4 执行规格、接口草案、文件格式草案和 MockProvider 垂直切片设计。当前优先级：

1. 先写 NS-401 执行规格：ProviderAdapter、上下文装配器、调用日志、提示词版本和 Proposal 入口的最小纵向闭环。
2. 只允许做上下文预览、调用记录和候选变更；不得让 AI 直接写正文、设定、摘要或角色状态。
3. 继续防止大文件回潮：模型连接、上下文装配和 Proposal 逻辑不得塞回 `app.ts`、`CodexView.tsx` 或单体 `ProjectRepository`。
