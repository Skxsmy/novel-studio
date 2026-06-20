# NS-400 验收记录

验收日期：2026-06-20

状态：进行中。

## 目的

NS-400 是 M3 与 M4 之间的整备门。它不新增小说功能，而是降低 M4 接入 AI 前的结构风险，避免 Provider、上下文、提示词、调用日志和 Proposal 被直接堆进现有大文件。

## 当前基线

| 文件 | 当前规模 | 处理方向 |
|---|---:|---|
| `packages/storage/src/index.ts` | 约 4584 行 | 后续按文件事务、层级、Codex、规划、正文等领域提取 |
| `apps/server/src/app.ts` | 约 718 行 | 先拆 Codex 路由，再拆规划 / 写作 / 层级路由 |
| `apps/web/src/CodexView.tsx` | 约 692 行 | 后续拆条目列表、详情、关系、进展、角色所知和上下文预览 |
| `packages/contracts/src/index.ts` | 约 962 行 | M4 前先规划契约分区，不在本轮贸然迁移导出路径 |
| `packages/storage/test/repository.test.ts` | 约 1192 行 | 后续随 storage 拆分迁移测试文件 |

## 验收进度

| ID | 状态 | 证据 |
|---|---|---|
| NS400-A01 | 通过 | 已新增 `docs/tasks/M4_PREP.md`、本验收记录，并更新任务索引 |
| NS400-A02 | 通过 | 已记录大文件规模、拆分顺序和 M4 前风险 |
| NS400-A03 | 通过 | 已更新 `docs/architecture/ARCHITECTURE.md`，当前架构不再停留在 M0–M2 |
| NS400-B01 | 通过 | 已将 Codex 路由移入 `apps/server/src/routes/codex.ts`；`app.ts` 从约 718 行降到 363 行 |
| NS400-B02 | 通过 | `npm.cmd run typecheck -w @novel-studio/server`、`npm.cmd run test -w @novel-studio/server` 和全量 `npm.cmd run check` 均通过 |
| NS400-C01 | 通过 | 已提取 `errors.ts`、`fileSystem.ts`、`fileTransactions.ts`；`ProjectRepository` 公开导入保持不变 |
| NS400-D01 | 通过 | 已将 `CodexView.tsx` 拆为 `CodexView.tsx`、`CodexEntryEditor.tsx`、`CodexEntryPanels.tsx`；顶层视图从约 692 行降到 162 行 |
| NS400-E01 | 通过 | 已新增 `packages/storage/test/smoke.test.ts`，覆盖创建写作恢复、层级创建校验、设定库提及/资料范围/未来事实隔离；可用 `npm.cmd run test:smoke` 单独执行 |
| NS400-F01 | 待办 | 后续写入 M4 最小 Context/Prompt/CallLog/Proposal 契约 |

## 本轮命令记录

- `npm.cmd run typecheck -w @novel-studio/server`：通过。
- `npm.cmd run test -w @novel-studio/server`：6/6 测试通过。
- `npm.cmd run check`：通过。
- Server：6/6 测试通过。
- Web：5 个文件、14 项测试通过。
- Storage：36/36 测试通过。
- Production build：server 与 Vite web 通过。
- `npm.cmd run typecheck -w @novel-studio/storage`：通过。
- `npm.cmd run test -w @novel-studio/storage`：36/36 测试通过。
- storage 文件事务拆分后再次运行 `npm.cmd run check`：通过；Server 6/6、Web 14/14、Storage 36/36、生产构建通过。
- `npm.cmd run typecheck -w @novel-studio/web`：通过。
- `npm.cmd run test -w @novel-studio/web`：5 个文件、14 项测试通过。
- Codex 前端拆分后再次运行 `npm.cmd run check`：通过；Server 6/6、Web 14/14、Storage 36/36、生产构建通过。
- `npm.cmd run test:smoke`：通过；1 个文件、3 条 M3→M4 核心烟测通过。
- `npm.cmd run test -w @novel-studio/storage`：通过；2 个文件、39 项测试通过。
- 烟测落地后再次运行 `npm.cmd run check`：通过；Server 6/6、Web 14/14、Storage 39/39、生产构建通过。

## 已知风险

- 本任务会移动较多代码，必须优先保持行为不变。
- 拆分 storage 前不得修改文件格式。
- E2E 建立前，浏览器验收仍是重要补充证据，但不能作为唯一回归机制。
