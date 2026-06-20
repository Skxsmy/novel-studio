# 最新交接

更新时间：2026-06-20

## 仓库状态

- 分支：`main`
- 最近相关提交：`NS-303 feat(writing): add markdown workspace and anchored sections`（本交接对应任务提交）
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

## 验证

- `npm.cmd run check`：退出码 0。
- Server 4/4，Web 9/9，Storage 27/27。
- 20 万中文字符：Milkdown 组件 5 秒预算、存储保存 2 秒预算均通过。
- 浏览器中文 fixture：CommonMark 语义、专注模式、刷新恢复、敏感 Section、冲突拒绝/磁盘重载、锚点 attached→relocated 通过。
- 浏览器控制台：无 warning/error。
- `git diff --check`：通过（仅 Windows 换行转换提示）。

## 已知限制

- Milkdown 在编辑后可能把等价 CommonMark 标记规范化（如 `-`→`*`、`---`→`***`）；正文文字与语义保持，未保存私有 JSON。
- Section 当前显式保存；尚未提供 Section 版本历史或候选稿差异，这属于 M5 Proposal/版本能力。
- 锚点只存证据和定位状态；批注正文、讨论线程与候选修改属于 M5。
- Codex 尚未实现，Matrix 的人物/地点/情节线仍显示稳定短 ID。

## 唯一下一任务

`NS-304`：先把 Codex 条目分类、别名/排除词、关系方向、AI 上下文策略、提及索引及删除数据库重建细化为文件/API/验收契约；再实现存储、索引和真实 Codex UI。不得把 Description 与 Research 混成同一 Canon 字段。
