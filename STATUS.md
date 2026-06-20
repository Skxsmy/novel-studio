# 当前状态

更新时间：2026-06-20

## 里程碑

- M0：完成。完整产品意图、架构、治理和验收追踪已写入仓库。
- M1：完成。可点击交互骨架已经浏览器验收。
- M2：完成。文件存储、API、冲突保护、索引重建与搜索已有自动化测试。
- M3：进行中。`NS-301` 已修复并验收，下一项是 `NS-302`。

## 当前已实现

- React/Vite + Fastify 本地 Web 应用，只监听 `127.0.0.1`。
- Markdown/YAML 权威原稿与可重建 better-sqlite3/FTS5 索引。
- `Series → Book → Act → Chapter → Scene` 显式父子清单和稳定 UUID。
- 完整排列重排；同章/跨章/跨幕场景移动；跨单本移动明确拒绝。
- 层级校验报告缺失、孤儿、重复父级、祖先、顺序与路径错误。
- 创建、重排与移动使用可恢复多文件事务；访问作品时回滚中断事务。
- M2 缺 Act/Chapter 清单迁移：先快照、再补齐、最后运行同一校验器。
- 新建作品后立即加载幕章，写作抽屉按 Act→Chapter→Scene 展示。
- 完整产品、UX、AI 编辑团队、资料库、Word/版本和里程碑规格位于 `docs/product/`。

## 最近验证

- `npm.cmd run check`：退出码 0。
- Server：2/2 测试通过。
- Storage：18/18 测试通过。
- Web：类型检查通过；当前无单元测试。
- Production build：server 与 Vite web 通过。
- 浏览器：空作品库新建“层级验收小说”后立即进入工作台；写作抽屉与面包屑均为第一部/第一幕/第一章/开篇场景。
- `git diff --check`：通过（仅换行提示）。

详细证据：`docs/testing/NS-301_ACCEPTANCE.md`。

## 当前限制

- 规划页仍是交互骨架；Grid/Outline/Matrix/双时间线真实数据属于 `NS-302`。
- 写作页仍使用 Markdown textarea；Milkdown、Sections 和锚点属于 `NS-303`。
- Codex、Workshop、Review 尚无真实 Canon 或 AI 能力。
- 场景保存尚未回写系列 `updatedAt`。
- 首次启动选择作品库、应用内停止服务和托盘入口尚未实现。
- Web 缺少组件/端到端自动测试；当前 NS-301 UI 由人工浏览器验收覆盖。

## 唯一下一任务

`NS-302`：在不绕过 NS-301 层级命令与事务的前提下，让 Grid、Outline、Matrix 和双时间线读取同一真实规划查询模型。
