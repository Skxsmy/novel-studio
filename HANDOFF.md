# 最新交接

更新时间：2026-06-20

## 仓库状态

- 分支：`main`
- 最近相关提交：`NS-306 feat(structure): expose series and hierarchy creation`
- 当前任务：`NS-400` 进行中，目标是 M3 到 M4 的整备门。
- 预期脏文件：`TASKS.md`、`STATUS.md`、`HANDOFF.md`、`docs/tasks/M4_PREP.md`、`docs/testing/NS-400_ACCEPTANCE.md`，以及本轮拆分涉及的 server/storage/web 文件。提交后应无脏文件；接手时运行 `git status --short` 核实。

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
  - server typecheck、server test 和全量 `npm.cmd run check` 通过。

## 验证

- `npm.cmd run check`：退出码 0。
- Server 6/6，Web 14/14，Storage 36/36。
- `scripts/start.ps1 -NoBrowser`：已有健康服务存在时复用当前服务，没有启动新的监听进程。
- 浏览器中文 fixture：已确认设定与参考笔记独立保存、自定义类别、同名歧义不误分配、有向关系、`on-mention`/`never` 资料范围预览、归档恢复和追踪表名称解析通过。
- 浏览器文案抽样：主导航、首页、概览、规划、写作抽屉、设定库、编辑室、待确认均无 `Canon/Research/Section/POV/tokens/AI/钉住/手工/0 字符` 等旧界面词；控制台无 warning/error。
- 浏览器控制台：无 warning/error。
- 浏览器 NS-305：通过。创建进展记录、创建角色误解、后文变化隐藏、角色所知归档/恢复和控制台检查均通过。
- 浏览器 NS-306：通过。非空作品库新建系列、新建第二部、第二部下新建第二幕、空幕新建第一章，本地 API 校验为 2 部、3 幕、3 章、`valid=true`。
- 进程：用户授权后停止旧 PID 52088；沙箱外启动最新服务，当前 `127.0.0.1:4317` 由 PID 50388 监听。
- `git diff --check`：通过（仅 Windows 换行转换提示）。

## 已知限制

- Milkdown 在编辑后可能把等价 CommonMark 标记规范化（如 `-`→`*`、`---`→`***`）；正文文字与语义保持，未保存私有 JSON。
- Section 当前显式保存；尚未提供 Section 版本历史或候选稿差异，这属于 M5 Proposal/版本能力。
- 锚点只存证据和定位状态；批注正文、讨论线程与候选修改属于 M5。
- 设定库关系当前表示静态基础关系；关系随剧情变化必须由 NS-305 进展记录追加历史，不能覆盖基础事实。
- 正文提及只表示名称出现在正文，不自动把条目加入场景的人物、地点或情节线显式关联。
- 同名同范围被记录为歧义并不分配给任一条目；人工消歧 UI 尚未实现。
- 当前没有应用内停止服务、托盘入口或 PID 文件；启动脚本只做安全复用和防重复启动，不主动杀进程。
- 浏览器验收留下了测试用系列、故事进展、未来隐藏记录和角色所知记录；它们位于本地示例作品库，不进入 Git。

## 唯一下一任务

`NS-400`：继续完成 M3 到 M4 的整备门。当前优先级：

1. 提取 storage 领域辅助，优先选择文件事务、层级投影或 Codex 查询中边界清楚的一块。
2. 拆分前端大视图，优先 `CodexView` 的详情/进展/角色所知面板。
3. 建立三条可重复烟测：创建写作恢复、层级创建校验、设定库提及与资料范围。
4. 完成后再进入 `NS-401`，不要直接把模型连接堆进现有大文件。
