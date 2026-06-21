# 当前状态

更新时间：2026-06-21

## 里程碑

- M0：完成。完整产品意图、架构、治理和验收追踪已写入仓库。
- M1：完成。可点击交互骨架已经浏览器验收。
- M2：完成。文件存储、API、冲突保护、索引重建与搜索已有自动化测试。
- M3：完成。`NS-301` 至 `NS-306` 均已实现并通过自动化与浏览器验收。
- M3 → M4 整备：`NS-400` 完成。当前架构、拆分基线、可重复烟测和 M4 最小契约均已写入仓库。

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
- 浏览器验收已改为 Playwright 自动操纵 Chrome；当前只运行 M3 已实现主路径，使用系统临时目录中的隔离作品库，不污染真实 `data/library`。M4/M5 的 AI、上下文和候选变更只登记为待实现验收目录。
- M4 详细规划已写入 `docs/tasks/M4.md`，任务索引已拆成 `NS-401` 至 `NS-410`。
- NS-401 已完成：M4 API 草案、数据格式草案、MockProvider 垂直切片、浏览器验收映射和安全不变量已写入仓库；未新增真实模型调用。
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

详细证据：`docs/testing/NS-301_ACCEPTANCE.md`、`docs/testing/NS-302_ACCEPTANCE.md`、`docs/testing/NS-303_ACCEPTANCE.md`、`docs/testing/NS-304_ACCEPTANCE.md`、`docs/testing/NS-305_ACCEPTANCE.md`、`docs/testing/NS-306_ACCEPTANCE.md`、`docs/testing/NS-401_ACCEPTANCE.md`。

## 当前限制

- 早前手工浏览器验收曾在本地示例作品库留下测试用系列、故事进展和角色所知记录；这些是本地权威数据文件，不进入 Git。新的 Playwright 验收改用隔离临时作品库。
- 当前 Windows / Codex 沙箱环境可能拒绝改写固定 `data/server.*` 启动文件；启动脚本已对 pid 状态写入提供 `%TEMP%\novel-studio` fallback。Codex 自动化启动验收优先使用 `-SmokeTest`，正式发布前仍建议在普通 PowerShell 中复测一次双击启动器。
- 编辑室、待确认页面尚无真实智能编辑工作流或候选变更。
- 场景保存尚未回写系列 `updatedAt`。
- 首次启动选择作品库、应用内停止服务和托盘入口尚未实现。
- Milkdown 会规范化等价 CommonMark 标记风格；当前保证语义与正文文字，不承诺逐字符保留 `-/*` 或 `---/***` 写法。

## 唯一下一任务

`NS-402`：AI 契约分区与模型配置、提示词、上下文包、调用日志的最小持久化。禁止接真实 Provider；先让文件格式、Zod 契约和可重建索引站稳。
