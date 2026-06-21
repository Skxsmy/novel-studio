# 当前状态

更新时间：2026-06-21

## 里程碑

- M0：完成。完整产品意图、架构、治理和验收追踪已写入仓库。
- M1：完成。可点击交互骨架已经浏览器验收。
- M2：完成。文件存储、API、冲突保护、索引重建与搜索已有自动化测试。
- M3：完成。`NS-301` 至 `NS-307` 均已实现并通过自动化与浏览器验收。
- M3 → M4 整备：`NS-400` 完成。当前架构、拆分基线、可重复烟测和 M4 最小契约均已写入仓库。
- M4：进行中。`NS-401` 至 `NS-407` 已完成；`NS-408` 正在推进，DeepSeek 独立 Provider 与通用 OpenAI-compatible 基础路径已实现，剩余 Provider 待接入。

## 当前已实现

- React/Vite + Fastify 本地 Web 应用，只监听 `127.0.0.1`。
- Markdown/YAML 权威原稿与可重建 better-sqlite3/FTS5 索引。
- `Series → Book → Act → Chapter → Scene` 显式父子清单和稳定 UUID。
- 完整排列重排；同章/跨章/跨幕场景移动；跨单本移动明确拒绝。
- 层级校验报告缺失、孤儿、重复父级、祖先、顺序与路径错误。
- 创建、重排与移动使用可恢复多文件事务；访问作品时回滚中断事务。
- M2 缺 Act/Chapter 清单迁移：先快照、再补齐、最后运行同一校验器。
- 新建作品后立即加载幕章，写作抽屉按 Act→Chapter→Scene 展示。
- 故事板、大纲、追踪表与双时间线读取同一 PlanningBoard；选择和筛选跨视图保留。
- 显式 TimelineEvent 文件、故事顺序、未放置场景与可访问结构移动入口。
- 规划分叉支持更新规划、保留有意偏离或标记正文待修订。
- Milkdown/ProseMirror 中文 Markdown 编辑器、专注模式与显式保存/冲突状态。
- localStorage 崩溃恢复草稿保存基础 revision；安全草稿和过期草稿分别提示，不静默覆盖磁盘。
- 五类独立 Section Markdown 文件、`inherit/local-only/never` AI 权限、归档与恢复。
- 独立审阅锚点 YAML、精确引用/前后文重定位，以及 `attached/relocated/orphaned` 明确状态。
- 六个内置设定库类别、自定义类别，以及独立的已确认设定、参考笔记、关系文件和稳定 revision。
- 名称、别名、排除词、大小写、英文复数、最长词优先与同名歧义的可重建提及索引。
- `always/on-mention/manual/never` 模型可读范围预览；`never` 即使主动选择也不会提供给模型。
- 三栏设定库工作区支持条目、参考笔记、识别规则、关系、正文提及、归档与恢复；规划追踪表显示条目名称而非内部 UUID。
- 故事进展与角色所知已使用独立文件保存；可按叙事场景查询“此刻有效”的世界事实、关系变化和角色主观知识。
- 世界事实与角色所知分离；“知道 / 相信 / 误解”不会覆盖已确认设定，未来记录只返回数量，不泄露摘要、证据或内部 ID。
- 进展记录、角色所知和此刻有效状态已接入设定库详情页，使用中文写作用语。
- 主要界面已统一中文写作用语：设定库、已确认设定、参考笔记、资料范围、主动选择、附属文档、追踪表。
- Windows 启动脚本已增加启动互斥锁、当前工作区 / commit 身份校验、旧进程清理、`-Wait` 验收模式和临时日志 fallback；健康服务可被显式复用，端口被异常旧进程占用时不会再启动冗余后台服务。
- 作品库非空时可显示新建系列表单；写作抽屉已增加新建部、新建幕和新建章入口，新部会同步建立第一幕和第一章。
- NS-400 已完成：当前架构文档已更新到 M3；服务端 Codex 路由已从 `app.ts` 拆入 `apps/server/src/routes/codex.ts`，`app.ts` 从约 718 行降到 363 行；storage 的错误、路径安全、原子写入和多文件事务已拆入独立模块；前端设定库已拆为顶层视图、条目编辑器和条目面板；已新增三条 M3→M4 核心烟测；M4 的 Context、Prompt、ModelCallLog 和 Proposal 最小契约已定义。
- NS-307 已完成：写作页左侧作品结构栏改为更清晰的部 / 幕 / 章 / 场景布局；新建场景可以明确指定目标部、幕和章，第二部章节内新建场景不再回落到第一部。
- 启动器已再次瘦身：`scripts/start.ps1` 直接启动 Node 服务产物，不再通过 `npm start` 父进程；新增 `-SmokeTest` 启动验收模式、`-Foreground` 测试托管模式和 `-Stop` 清理模式，并保留轻量互斥锁，减少 Codex / 自动化测试中的后台进程和并发启动风险。
- 浏览器验收已改为 Playwright 自动操纵 Chrome；当前覆盖 M3 主路径以及 M4 的模型设置、上下文预览和提示词预览最小路径，使用系统临时目录中的隔离作品库，不污染真实 `data/library`。未完成的 AI 调用和候选变更仍只登记为待实现验收目录。
- M4 详细规划已写入 `docs/tasks/M4.md`，任务索引已拆成 `NS-401` 至 `NS-410`。
- NS-401 已完成：M4 API 草案、数据格式草案、MockProvider 垂直切片、浏览器验收映射和安全不变量已写入仓库；未新增真实模型调用。
- NS-402 已完成：AI 契约已从单体 contracts 拆到领域文件；storage 已支持模型配置、角色、提示词、Preset、上下文包和调用日志的最小 YAML 持久化；SQLite 可重建 M4 上下文包和调用日志索引。
- NS-403 已完成：新增 `@novel-studio/ai`，实现 ProviderAdapter、ProviderRegistry、MockProvider、模型能力描述、流式输出、结构化输出、embedding、token 估算和统一错误分类；未接真实 Provider，未读取 API key，未新增正文或已确认设定写入能力。
- NS-404 已完成：新增模型配置 API、凭据引用校验、Windows Credential Manager 存储抽象、Provider 连接测试、设置页“模型与资料权限”；NS-408 后主路径已移除全局“只允许本机模型”开关，继续保留 Provider 显式选择、资料级权限过滤和禁止静默回退边界。
- NS-405 已完成：新增场景级 `ContextBundle` 装配和预览 API；写作页右侧可生成最小上下文预览；预览包记录纳入项、排除项、来源、原因和用量估算；`never`、隐藏区段和后文信息不会进入当前场景上下文。
- NS-406 已完成：新增 7 个内置智能编辑角色、提示词模板、Preset、声明式渲染、模板版本 API 和设置页“角色与提示词”；上下文预览会记录真实 PromptTemplate ID / version；模板缺少必填输入或包含表达式时拒绝渲染。
- NS-407 已完成：新增非写入型 AI 调用 API、SSE 流式输出、调用日志保存和写作页“审稿 / 改写”最小闭环；`rewrite` 只生成正文内联候选，候选整段选中，作者点击“保留”后才保存。
- NS-408 进行中：新增 DeepSeek 独立 Provider 与通用 OpenAI-compatible 基础路径，设置页可创建 DeepSeek 配置、保存 / 替换 / 删除 / 复用服务密钥、获取模型列表、测试连接并经统一 ProviderRegistry 发起调用；用户侧已确认 DeepSeek 连接正常且能获取模型列表。OpenAI、OpenRouter、Anthropic、Gemini 和 Ollama 仍待实现。
- UI 原则已补入权威规格：主界面从作者视角组织信息，调用来源、基准版本、调用 ID、Token 用量等审计字段不得出现在写作主路径；UI 预览图必须受控管理，未采纳的探索图不进入项目。
- UI 规范已补充：主界面不得用开发者说明反复解释失败回退、密钥存储、日志脱敏等内部边界；只展示用户当前决策和下一步。截图验收必须生成唯一运行 ID、截图 manifest，并逐图人工检查。
- NS-409C UI 纠偏已记录：移除未跟踪的 `ui-foundation.css` 第二覆盖层；规划页按图像模型目标图改为三栏工作台；写作页验收改为真实正文状态截图，标题和正文改为更接近中文稿纸的字体；`NS-409B-plan-target-v2.png` 与 `NS-409B-write-target-v2.png` 已标记为不采纳。
- NS-409D 宽屏 UI 复查已记录：写作页取消宽屏正文漂移；设定库验收创建真实条目和进展记录并截图；设定库详情 / 进展页和编辑室改为更受控的宽屏工作台；图像模型复查图与最终截图已保存到 `docs/design/ui-redesign/`。
- NS-409E 规划页宽屏过渡修正已记录：故事板、大纲、追踪表和时间线分别使用当前截图生成目标图并保存实现截图；规划页宽屏结构已改善，但文档明确当前 UI 仍不能作为验收通过版本。
- 完整产品、UX、AI 编辑团队、资料库、Word/版本和里程碑规格位于 `docs/product/`。

## 最近验证

- `npm.cmd run check`：退出码 0。
- Server：6/6 测试通过。
- Storage：39/39 测试通过。
- Web：14/14 测试通过。
- Production build：server 与 Vite web 通过。
- `npm.cmd run test:smoke`：1 个文件、3 条烟测通过。
- `npm.cmd run check`：NS-307 后再次通过；Server 6/6、Web 14/14、Storage 39/39、生产构建通过。
- 启动器：用户授权后停止旧 PID 52088；沙箱外运行 `scripts/start.ps1 -NoBrowser` 启动最新服务，当前唯一监听 PID 为 50388。
- 浏览器：NS-304 的设定库条目与独立参考笔记、自定义类别、有向关系、提及索引、同名歧义、模型可读范围禁区、归档恢复及追踪表名称解析通过；NS-305 的进展记录、角色误解、未来隐藏提示和归档/恢复通过；NS-306 的新建系列、新建部、新建幕、新建章和层级校验通过。
- 浏览器文案抽样：主导航、首页、概览、规划、写作抽屉、设定库、编辑室、待确认均未发现旧英文界面词或“手工钉住”等生硬译词。
- `git diff --check`：通过（仅换行提示）。
- Codex 更新后重新验证内置 Browser：`node_repl/js` 最小探针通过，不再报 `sandboxPolicy`；Browser 插件 `26.616.51431` 可连接 in-app browser。
- 启动器：`scripts/start.ps1 -NoBrowser -SkipBuild -Wait` 能保持服务供浏览器验收；固定 `data/server.*` 文件被当前 Windows 环境拒写时，脚本切换到 `%TEMP%\novel-studio` 记录本次启动状态。
- 浏览器：in-app browser 打开 `http://127.0.0.1:4317/` 并读取 DOM；点击“雾港纪事 10 个场景 · 更新于 6月20日”后进入作品概览，页面 heading 为“雾港纪事”。
- `npm.cmd run check`：2026-06-21 通过；Server 7/7，Web 14/14，Storage 39/39，生产构建通过。沙箱内同一命令曾因 `dist` 写入 EPERM 失败，使用已批准前缀在沙箱外重跑通过。
- `scripts/start.ps1 -NoBrowser -SkipBuild -SmokeTest`：2026-06-21 通过；脚本启动临时服务、读取 `/api/v1/health`，确认 `workspaceRoot=E:\Codex\projects\novel-studio` 和 `libraryRoot=E:\Codex\projects\novel-studio\data\library`，随后停止临时服务。
- 最终收口 `npm.cmd run check`：2026-06-21 通过；Server 7/7，Web 14/14，Storage 39/39，生产构建通过。
- 最终收口 `npm.cmd run test:e2e`：2026-06-21 通过；Playwright/Chrome 验证创建系列、切换主要工作区、专注模式、新建第二部 / 第二幕 / 第一章 / 场景，并用 API 校验第二部内场景归属；命令自然退出。
- 端口检查：浏览器验收和启动器烟测后 `127.0.0.1:4317` 无监听进程，仅剩系统 `TIME_WAIT` 连接记录。
- NS-401 收口 `npm.cmd run check`：2026-06-21 通过；Server 7/7，Web 14/14，Storage 39/39，生产构建通过。
- NS-402 storage 验证：`npm.cmd run typecheck -w @novel-studio/contracts`、`npm.cmd run typecheck -w @novel-studio/storage` 和 `npm.cmd run test -w @novel-studio/storage` 通过；Storage 3 个文件、41 项测试。
- NS-402 收口 `npm.cmd run check`：2026-06-21 通过；Server 7/7，Web 14/14，Storage 41/41，生产构建通过。
- NS-403 AI 验证：`npm.cmd run typecheck -w @novel-studio/ai` 通过；`npm.cmd run test -w @novel-studio/ai` 通过，1 个文件、9 项测试。
- NS-403 收口 `npm.cmd run check`：2026-06-21 通过；Server 7/7，Web 14/14，AI 9/9，Storage 41/41，生产构建通过。
- NS-404/NS-405 局部验证：`npm.cmd run test -w @novel-studio/ai` 通过，1 个文件、10 项测试；`npm.cmd run test -w @novel-studio/server` 通过，3 个文件、10 项测试；`npm.cmd run typecheck -w @novel-studio/web` 通过；`npm.cmd run test -w @novel-studio/web` 通过，5 个文件、14 项测试。
- NS-404/NS-405 收口 `npm.cmd run check`：2026-06-21 通过；Server 10/10，Web 14/14，AI 10/10，Storage 41/41，生产构建通过。
- NS-404/NS-405 浏览器验收 `npm.cmd run test:e2e`：2026-06-21 通过；1 个 Chrome 用例，覆盖添加本机验收模型、连接测试和写作页生成上下文预览。
- 设置页 UI 修正后 `npm.cmd run test:e2e`：2026-06-21 通过；Playwright 生成 `m4-settings-model-profile.png` 和 `m4-write-context-preview.png` 截图附件。
- 设置页 UI 修正后 `npm.cmd run check`：2026-06-21 通过；Server 10/10，Web 14/14，AI 10/10，Storage 41/41，生产构建通过。
- 浏览器验收端口修正后 `npm.cmd run test:e2e`：2026-06-21 通过；E2E 默认监听 `127.0.0.1:4318`，不再占用日常服务端口 `4317`。
- NS-406 局部验证：`npm.cmd run typecheck` 通过；`npm.cmd run test` 通过，Server 11/11、Web 14/14、AI 10/10、Storage 41/41；`npm.cmd run test -w @novel-studio/server` 通过，4 个文件、11 项测试。
- NS-406 浏览器验收 `npm.cmd run test:e2e`：2026-06-21 通过；1 个 Chrome 用例，覆盖设置页“角色与提示词”、选择连续性编辑、生成提示词预览，并产出 `m4-prompt-template-preview.png` 截图。
- NS-406 收口 `npm.cmd run check`：2026-06-21 通过；Server 11/11，Web 14/14，AI 10/10，Storage 41/41，生产构建通过。
- NS-407 局部验证：`npm.cmd run typecheck` 通过；`npm.cmd run test` 通过，Server 13/13、Web 14/14、AI 10/10、Storage 41/41。
- NS-407 浏览器验收 `npm.cmd run test:e2e`：2026-06-21 通过；1 个 Chrome 用例，覆盖 AI 审稿、正文选区改写、候选内联选中、保留后保存，并产出 `m4-ai-panel-ready.png`、`m4-ai-review-result.png`、`m4-ai-inline-candidate-selected.png` 截图。人工查看确认候选确认条只显示“候选待确认 / 保留 / 撤回”，不显示调用来源、基准版本、用量或调用 ID。
- NS-407 收口 `npm.cmd run check`：2026-06-21 通过；Server 13/13，Web 14/14，AI 10/10，Storage 41/41，生产构建通过。
- NS-408 局部验证：`npm.cmd run test` 通过；Server 15/15，Web 14/14，AI 12/12，Storage 41/41。
- NS-408 浏览器验收 `npm.cmd run test:e2e`：2026-06-21 通过；1 个 Chrome 用例，覆盖 DeepSeek / OpenAI-compatible 配置界面、唯一截图 manifest、写作页上下文预览、AI 审稿和正文候选闭环。人工查看确认 DeepSeek 设置页不再显示开发者回退说明，服务密钥卡不再竖排，凭据引用和能力参数折叠进“高级信息”。
- NS-408 Provider 拆分后验证：`npm.cmd run typecheck` 通过；`npm.cmd run test -w @novel-studio/ai` 通过，15/15；`npm.cmd run test -w @novel-studio/server` 通过，15/15；`npm.cmd run check` 通过，Server 15/15、Web 14/14、AI 15/15、Storage 41/41；`npm.cmd run test:e2e` 通过，1 个 Chrome 用例。
- NS-408 用户侧真实验收：用户已确认 DeepSeek 连接正常，并能获取模型列表。该结论来自用户手动验收；Codex 未读取或打印真实密钥。
- NS-409C UI 纠偏验证：`npm.cmd run typecheck -w @novel-studio/web` 通过；`npm.cmd run test:e2e` 多轮通过，最新截图运行 ID 为 `2026-06-21T13-07-51-086Z`；实现后截图保存为 `docs/design/ui-redesign/NS-409C-plan-implemented-v1.png` 和 `docs/design/ui-redesign/NS-409C-write-implemented-v1.png`。
- NS-409D 宽屏 UI 复查验证：`npm.cmd run typecheck -w @novel-studio/web` 通过；`npm.cmd run test:e2e` 通过，最新截图运行 ID 为 `2026-06-21T13-50-37-338Z`；实现后截图保存为 `NS-409D-write-wide-implemented-v1.png`、`NS-409D-codex-wide-detail-implemented-v1.png`、`NS-409D-codex-wide-progressions-implemented-v1.png` 和 `NS-409D-workshop-wide-implemented-v1.png`。
- NS-409E 规划页宽屏验证：`npm.cmd run typecheck -w @novel-studio/web` 通过；`npm.cmd run test:e2e` 通过，最新截图运行 ID 为 `2026-06-21T14-47-28-769Z`；四个规划子页面的当前图、目标图和实现图已保存到 `docs/design/ui-redesign/`。

详细证据：`docs/testing/NS-301_ACCEPTANCE.md`、`docs/testing/NS-302_ACCEPTANCE.md`、`docs/testing/NS-303_ACCEPTANCE.md`、`docs/testing/NS-304_ACCEPTANCE.md`、`docs/testing/NS-305_ACCEPTANCE.md`、`docs/testing/NS-306_ACCEPTANCE.md`、`docs/testing/NS-401_ACCEPTANCE.md`、`docs/testing/NS-402_ACCEPTANCE.md`、`docs/testing/NS-403_ACCEPTANCE.md`、`docs/testing/NS-404_ACCEPTANCE.md`、`docs/testing/NS-405_ACCEPTANCE.md`、`docs/testing/NS-406_ACCEPTANCE.md`、`docs/testing/NS-407_ACCEPTANCE.md`、`docs/testing/NS-408_ACCEPTANCE.md`、`docs/testing/NS-409A_ACCEPTANCE.md`。

## 当前限制

- 早前手工浏览器验收曾在本地示例作品库留下测试用系列、故事进展和角色所知记录；这些是本地权威数据文件，不进入 Git。新的 Playwright 验收改用隔离临时作品库。
- 当前 Windows / Codex 沙箱环境可能拒绝改写固定 `data/server.*` 启动文件；启动脚本已对 pid 状态写入提供 `%TEMP%\novel-studio` fallback。Codex 自动化启动验收优先使用 `-SmokeTest`，正式发布前仍建议在普通 PowerShell 中复测一次双击启动器。
- 编辑室、待确认页面尚无真实智能编辑工作流或候选变更。
- NS-404 至 NS-408 只提供最小设置页、上下文预览入口、提示词预览入口、写作页 AI 审稿 / 改写入口、DeepSeek 独立 Provider 和通用 OpenAI-compatible 基础路径；完整上下文分组 UI、调用后快照查看、完整角色 / 变量 / Preset 编辑器和更多浏览器自动验收属于 `NS-409` 或后续 UI 整理。
- DeepSeek 真实连接和模型列表获取已由用户侧验收通过；真实 DeepSeek 非写入调用结果尚未记录。
- OpenAI、OpenRouter、Anthropic、Gemini 和 Ollama Provider 尚未实现，仍属 `NS-408` 剩余工作。
- UI 仍需继续收敛：NS-409E 只修正规划页宽屏结构，不能视为 UI 验收通过；字体选择、字号层级、边框重量、页面设计语言和空状态仍不统一；写作页左侧结构栏新增按钮仍偏表单化；规划页尚未实现目标图中的底部“新建场景”工作台入口；设定库、编辑室、待确认和设置页仍需继续页面级复查。
- 场景保存尚未回写系列 `updatedAt`。
- 首次启动选择作品库、应用内停止服务和托盘入口尚未实现。
- Milkdown 会规范化等价 CommonMark 标记风格；当前保证语义与正文文字，不承诺逐字符保留 `-/*` 或 `---/***` 写法。

## 唯一下一任务

`NS-408`：记录一次真实 DeepSeek 非写入调用，或继续 Ollama、OpenAI、OpenRouter、Anthropic、Gemini Provider 接入。

说明：下一步应在统一 `ProviderAdapter` 下接入真实 Provider 协议层，继续保持云端权限、凭据引用和“不得从本地模型静默回退云端”的边界。
