# 当前状态

更新时间：2026-06-20

## 里程碑

- M0：完成。完整产品意图、架构、治理和验收追踪已写入仓库。
- M1：完成。可点击交互骨架已经浏览器验收。
- M2：完成。文件存储、API、冲突保护、索引重建与搜索已有自动化测试。
- M3：进行中。`NS-301`、`NS-302`、`NS-303` 已验收，下一项是 `NS-304`。

## 当前已实现

- React/Vite + Fastify 本地 Web 应用，只监听 `127.0.0.1`。
- Markdown/YAML 权威原稿与可重建 better-sqlite3/FTS5 索引。
- `Series → Book → Act → Chapter → Scene` 显式父子清单和稳定 UUID。
- 完整排列重排；同章/跨章/跨幕场景移动；跨单本移动明确拒绝。
- 层级校验报告缺失、孤儿、重复父级、祖先、顺序与路径错误。
- 创建、重排与移动使用可恢复多文件事务；访问作品时回滚中断事务。
- M2 缺 Act/Chapter 清单迁移：先快照、再补齐、最后运行同一校验器。
- 新建作品后立即加载幕章，写作抽屉按 Act→Chapter→Scene 展示。
- Grid、Outline、Matrix 与双时间线读取同一 PlanningBoard；选择和筛选跨视图保留。
- 显式 TimelineEvent 文件、故事顺序、未放置场景与可访问结构移动入口。
- 规划分叉支持更新规划、保留有意偏离或标记正文待修订。
- Milkdown/ProseMirror 中文 Markdown 编辑器、专注模式与显式保存/冲突状态。
- localStorage 崩溃恢复草稿保存基础 revision；安全草稿和过期草稿分别提示，不静默覆盖磁盘。
- 五类独立 Section Markdown 文件、`inherit/local-only/never` AI 权限、归档与恢复。
- 独立审阅锚点 YAML、精确引用/前后文重定位，以及 `attached/relocated/orphaned` 明确状态。
- 完整产品、UX、AI 编辑团队、资料库、Word/版本和里程碑规格位于 `docs/product/`。

## 最近验证

- `npm.cmd run check`：退出码 0。
- Server：4/4 测试通过。
- Storage：27/27 测试通过。
- Web：9/9 测试通过（规划、恢复草稿、Milkdown 语义与 20 万字符预算）。
- Production build：server 与 Vite web 通过。
- 浏览器：中文 CommonMark 语义渲染/保存、敏感 Section、专注模式、刷新恢复、外部冲突与真实磁盘重载、锚点 attached→relocated 全部通过；控制台无 warning/error。
- `git diff --check`：通过（仅换行提示）。

详细证据：`docs/testing/NS-301_ACCEPTANCE.md`、`docs/testing/NS-302_ACCEPTANCE.md`、`docs/testing/NS-303_ACCEPTANCE.md`。

## 当前限制

- Codex、Workshop、Review 尚无真实 Canon 或 AI 能力。
- 场景保存尚未回写系列 `updatedAt`。
- 首次启动选择作品库、应用内停止服务和托盘入口尚未实现。
- Milkdown 会规范化等价 CommonMark 标记风格；当前保证语义与正文文字，不承诺逐字符保留 `-/*` 或 `---/***` 写法。

## 唯一下一任务

`NS-304`：先细化 Codex 条目、类别、别名、关系、提及索引和 AI 上下文策略的文件/API/验收契约，再实现可重建索引与真实 UI。
