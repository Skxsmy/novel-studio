# 最新交接

更新时间：2026-06-20

## 仓库状态

- 分支：`main`
- 最近相关提交：`NS-304 polish(ui): localize writing terminology`（本交接对应任务提交）
- 预期脏文件：无。接手时运行 `git status --short` 核实。

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

## 验证

- `npm.cmd run check`：退出码 0。
- Server 5/5，Web 11/11，Storage 32/32。
- 浏览器中文 fixture：已确认设定与参考笔记独立保存、自定义类别、同名歧义不误分配、有向关系、`on-mention`/`never` 资料范围预览、归档恢复和追踪表名称解析通过。
- 浏览器文案抽样：主导航、首页、概览、规划、写作抽屉、设定库、编辑室、待确认均无 `Canon/Research/Section/POV/tokens/AI/钉住/手工/0 字符` 等旧界面词；控制台无 warning/error。
- 浏览器控制台：无 warning/error。
- `git diff --check`：通过（仅 Windows 换行转换提示）。

## 已知限制

- Milkdown 在编辑后可能把等价 CommonMark 标记规范化（如 `-`→`*`、`---`→`***`）；正文文字与语义保持，未保存私有 JSON。
- Section 当前显式保存；尚未提供 Section 版本历史或候选稿差异，这属于 M5 Proposal/版本能力。
- 锚点只存证据和定位状态；批注正文、讨论线程与候选修改属于 M5。
- 设定库关系当前表示静态基础关系；关系随剧情变化必须由 NS-305 进展记录追加历史，不能覆盖基础事实。
- 正文提及只表示名称出现在正文，不自动把条目加入场景的人物、地点或情节线显式关联。
- 同名同范围被记录为歧义并不分配给任一条目；人工消歧 UI 尚未实现。

## 唯一下一任务

`NS-305`：先把进展记录、角色知识、世界真相与角色所知分离、按场景生效的事实查询、关系状态变化和证据返回细化为文件/API/验收契约；再实现存储、查询与连续性 UI。不得用“当前最终状态”覆盖历史，也不得把未来信息泄露给较早场景。
