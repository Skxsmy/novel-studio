# NS-400 验收记录

验收日期：2026-06-20；启动 / 浏览器验收补测：2026-06-21

状态：完成。

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
| NS400-F01 | 通过 | 已在 `packages/contracts/src/index.ts` 定义 `ContextBundle`、`ContextItem`、`PromptTemplate`、`ModelCallLog`、`Proposal` 与 `ProposalPatch`，并写入架构/API/数据模型文档 |
| NS400-G01 | 通过 | `/api/v1/health` 返回 version、commit、startedAt、workspaceRoot 和 libraryRoot；启动脚本用这些字段拒绝误用旧 checkout 服务 |
| NS400-G02 | 通过 | `scripts/start.ps1` 支持 `-Wait`，用于 Codex Browser / 自动化验收期间保持服务前台存活 |
| NS400-G03 | 通过 | 固定 `data/server.*` 启动文件被锁住时，脚本改用 `%TEMP%\novel-studio\server.<timestamp>.*`，不会把 pid 写入失败误判为服务失败 |
| NS400-G04 | 通过 | Codex Browser 更新后复测：`node_repl/js` 最小探针通过，in-app browser 可读取 Novel Studio DOM 并点击进入作品概览 |
| NS400-H01 | 通过 | 启动器瘦身：脚本直接启动 Node 服务产物，不再通过 `npm start` 父进程；新增 `-SmokeTest`、`-Foreground` 和 `-Stop` |
| NS400-H02 | 通过 | `-SmokeTest` 启动临时服务、读取 health、停止服务，结束后 `127.0.0.1:4317` 无残留监听 |
| NS400-H03 | 通过 | Playwright 浏览器验收改为进程内测试服务和隔离作品库；M3 已实现交互自动执行，M4/M5 能力进入待实现验收目录 |
| NS400-H04 | 通过 | 启动器保留轻量互斥锁，并用当前工作区与 commit 校验健康服务，避免并发启动和误复用旧服务 |

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
- M4 最小契约落地后再次运行 `npm.cmd run check`：通过；Server 6/6、Web 14/14、Storage 39/39、生产构建通过。
- 2026-06-21 `node_repl/js` 最小探针：通过；不再出现 `codex/sandbox-state-meta: missing field sandboxPolicy`。
- 2026-06-21 Browser 插件 `26.616.51431`：`browser.documentation()` 完整返回。
- 2026-06-21 `scripts/start.ps1 -NoBrowser -SkipBuild -Wait`：能保持 `127.0.0.1:4317` 服务供浏览器验收；固定 `data/server.*` 文件被当前 Windows 环境拒写时切换到 `%TEMP%\novel-studio`。
- 2026-06-21 in-app browser：打开 `http://127.0.0.1:4317/`，DOM 显示 heading `选择一个系列`；点击“雾港纪事 10 个场景 · 更新于 6月20日”后 heading 变为“雾港纪事”。
- 2026-06-21 `npm.cmd run check`：通过；Server 7/7，Web 14/14，Storage 39/39，生产构建通过。沙箱内同一命令因 `dist` 目录 EPERM 失败，沙箱外使用已批准前缀重跑通过。
- 2026-06-21 `scripts/start.ps1 -NoBrowser -SkipBuild -SmokeTest`：通过；临时服务 health 返回当前工作区和作品库，脚本随后停止服务；端口检查确认无残留监听。
- 2026-06-21 `npm.cmd run test:e2e:quick`：通过；1 个 Chrome 用例验证创建系列、切换工作区、专注模式、新建第二部 / 第二幕 / 第一章 / 场景，并用 API 校验第二部场景归属；命令自然退出。
- 2026-06-21 最终收口 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -NoBrowser -SkipBuild -SmokeTest`：通过；互斥锁版本脚本启动并停止临时服务，端口只剩 `TIME_WAIT`。
- 2026-06-21 最终收口 `npm.cmd run check`：通过；Server 7/7，Web 14/14，Storage 39/39，生产构建通过。
- 2026-06-21 最终收口 `npm.cmd run test:e2e`：通过；构建后 1 个 Chrome 浏览器验收用例通过，命令自然退出。

## 已知风险

- 本任务会移动较多代码，必须优先保持行为不变。
- 拆分 storage 前不得修改文件格式。
- 当前浏览器 E2E 只覆盖 M3 已实现主路径；M4/M5 的 AI、上下文、候选变更仍是待实现验收目录，不能视为已完成。
- 当前 Codex / Windows 沙箱中，固定 `data/server.*` 文件可能拒绝改写；脚本已使用 `%TEMP%\novel-studio` 作为启动状态 fallback。Codex 自动化启动验收优先使用 `-SmokeTest`，双击启动器仍应在普通 PowerShell 环境中抽样复测。
