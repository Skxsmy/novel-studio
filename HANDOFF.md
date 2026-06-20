# 最新交接

更新时间：2026-06-20

## 仓库状态

- 分支：`main`
- 最近相关提交：`NS-302 feat(planning): add shared planning workspace`（本交接所在 HEAD）
- 预期脏文件：无。接手时运行 `git status --short` 核实。

## 已完成

- NS-301：显式层级、事务、迁移与校验。
- NS-302：
  - `PlanningBoard` 统一 Book/Act/Chapter/Scene、叙事顺序、故事事件、未放置区与 Matrix 维度；
  - `planning/timeline.yaml` 与 `planning/events/*.yaml` 为显式故事事件权威文件；
  - Grid、Outline、Matrix、Timeline 共用选择和筛选；
  - 同章重排、跨章移动、HTML5 拖动和键盘/按钮入口复用 NS-301 命令；
  - 规划字段、人工分叉决策、事件 revision 与旧项目只读兼容；
  - ADR-0006、API/数据文档和逐项验收记录。

## 验证

- `npm.cmd run check`：退出码 0。
- Server 3/3，Web 4/4，Storage 23/23。
- 中文两章三场浏览器 fixture：四视图、跨视图筛选、倒叙时间线、未放置区、事件创建、同章与跨章移动通过。
- 浏览器控制台：无 warning/error。

## 已知限制

- Codex 尚未实现，Matrix 的人物/地点/情节线暂显示稳定短 ID。
- HTML5 拖动依赖浏览器原生 `dataTransfer`；另有可访问按钮入口，不依赖拖动完成结构操作。
- 自动语义分叉检测属于后续 AI/连续性能力；当前只接受显式人工标记。
- 写作页仍是 textarea，未实现 Sections 与审阅锚点。

## 唯一下一任务

`NS-303`：先细化 Markdown 往返、Milkdown 编辑器、Sections 权限、专注模式和锚点重定位验收，再修改写作存储与 UI。不得把编辑器私有 JSON 变成权威副本。
