# 浏览器验收流程

本文说明 Novel Studio 如何让 Codex / Playwright 操纵真实浏览器，并把按钮交互验收变成可维护的项目资产。

## 基本原则

浏览器验收不是“把当前页面随便点一遍”。项目尚未完成时，验收必须分清三类：

1. **已实现能力**：进入 `tests/e2e`，必须自动执行并通过。
2. **待实现能力**：写入本文的验收目录或对应任务文档，不进入强制通过测试。
3. **探索性检查**：用于临时排查 UI、文案、布局或浏览器控制问题，结果必须写入任务验收记录，不能替代自动化测试。

每个可执行浏览器用例都应同时满足：

- 从用户可见入口开始操作，而不是直接调用内部函数。
- 至少检查一个持久化结果，例如 API 返回、磁盘数据、索引或页面刷新后的状态。
- 检查浏览器 `console.error` 与 `pageerror`。
- 使用隔离作品库，不污染作者真实数据。
- 只验证当前任务声明已经完成的能力；不得把未来 M4/M5 页面占位当作“通过”。

## 命令

完整浏览器验收会先构建，再用 Playwright 操纵 Chrome：

```powershell
npm.cmd run test:e2e
```

如果刚刚已经完成构建，可使用快速验收：

```powershell
npm.cmd run test:e2e:quick
```

需要观察浏览器窗口时使用：

```powershell
npm.cmd run test:e2e:headed
```

启动器本身的健康检查使用：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -NoBrowser -SkipBuild -SmokeTest
```

若需要让 Codex Browser 或其他工具连接本地页面，使用前台服务模式，并由调用方结束该命令：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -NoBrowser -SkipBuild -Foreground
```

显式清理当前 checkout 的本地服务：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -Stop
```

## 数据隔离

Playwright 验收不使用 `data/library`。测试启动时会在系统临时目录创建：

```text
%TEMP%\novel-studio-browser-acceptance\library
```

报告和失败截图 / trace 也写入系统临时目录下的 `novel-studio-browser-acceptance`，不进入 Git，也不混入真实作品库。

## 服务生命周期

Playwright 不再通过 PowerShell 间接启动后台服务。`tests/e2e/global-setup.ts` 会在测试进程内直接创建 Fastify 应用，监听 `127.0.0.1:4317`，并在测试结束后关闭。

这样做的目的：

- 避免 Windows 上 PowerShell → npm → node 的父子进程残留。
- 避免固定 `data/server.*` 文件锁影响浏览器验收。
- 让测试命令自然退出，不依赖后台进程继续存活。

`scripts/start.ps1` 仍用于双击启动、手工验收和 Codex Browser 连接本地页面。

## 当前可执行用例

| 用例 ID | 状态 | 覆盖范围 | 自动化文件 |
|---|---|---|---|
| BA-M3-001 | 已实现 | 启动隔离作品库，创建系列，进入主要工作区 | `tests/e2e/browser-acceptance.spec.ts` |
| BA-M3-002 | 已实现 | 写作页专注模式进入 / 退出 | `tests/e2e/browser-acceptance.spec.ts` |
| BA-M3-003 | 已实现 | 新建第二部，并在第二部章节内新建场景；验证场景归属没有回落到第一部 | `tests/e2e/browser-acceptance.spec.ts` |
| BA-M3-004 | 已实现 | 在第二部中新建幕、新建章、新建场景，并用 API 校验 `bookId / actId / chapterId` | `tests/e2e/browser-acceptance.spec.ts` |
| BA-M3-005 | 已实现 | 切换规划、写作、设定库、编辑室、待确认页面，确认无浏览器错误 | `tests/e2e/browser-acceptance.spec.ts` |

## M4 待实现验收目录

这些用例是 M4 的目标，不得在功能完成前伪装成通过。

| 用例 ID | 对应任务 | 目标状态 | 预期行为 |
|---|---|---|---|
| BA-M4-001 | NS-403 / NS-404 | 待实现 | 用户可配置 MockProvider，连接测试显示模型能力、错误分类和是否可流式输出。 |
| BA-M4-002 | NS-405 / NS-409 | 待实现 | 场景页可打开上下文预览，看到将发送的场景目标、正文选区、相邻摘要、设定状态和主动选择资料。 |
| BA-M4-003 | NS-405 | 待实现 | 被标记为 `never`、隐藏区段或未来剧情的资料不会出现在上下文预览和实际调用记录中。 |
| BA-M4-004 | NS-406 / NS-407 | 待实现 | 发起一次非写入型 AI 调用后，调用日志保存模型、角色、提示词版本、上下文包、请求 / 响应哈希和用量。 |
| BA-M4-005 | NS-407 / NS-409 | 待实现 | 调用完成后可在界面查看实际发送上下文快照，而不是重新生成的当前上下文。 |
| BA-M4-006 | NS-404 / NS-408 | 待实现 | 云端禁用时不会发生云端请求，也不会从本地模型静默回退到云端模型。 |
| BA-M4-007 | NS-407 | 待实现 | AI 回复只显示为非写入型结果，不出现“直接写入正文 / 更新设定”的入口。 |

## M5 待实现验收目录

| 用例 ID | 目标状态 | 预期行为 |
|---|---|---|
| BA-M5-001 | 待实现 | AI 续写只生成候选稿和差异，不直接修改正文。 |
| BA-M5-002 | 待实现 | 候选事实进入待确认收件箱，接受后才更新设定、摘要或人物状态。 |
| BA-M5-003 | 待实现 | 候选变更的基础版本过期时拒绝直接应用，并提示重新生成或人工处理冲突。 |
| BA-M5-004 | 待实现 | 多编辑会审第一轮互相不可见，汇总保留分歧、证据和置信度。 |

## 新增浏览器用例的准入要求

新增任务如果改变了主路径 UI，应同步增加或更新一个浏览器用例。用例文件应优先复用 `tests/e2e/helpers/browserAcceptance.ts`，并遵循：

- 标题写明用户意图，不写“测试按钮能点”。
- 点击后等待对应网络响应或可见状态变化。
- 对关键结果做二次校验，例如重新读取 API 或刷新页面。
- 不使用真实作品库。
- 未完成能力只写入待实现目录，不使用 `test.skip` 堆积假进度。
