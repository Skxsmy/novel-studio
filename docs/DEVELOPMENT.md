# 开发环境约定

## PowerShell 与中文文本

在 Windows PowerShell 中查看中文文档、测试输出或 Markdown 文件前，先启用 UTF-8：

```powershell
.\scripts\dev-shell.ps1
```

读取文本时使用：

```powershell
Get-Content -Encoding UTF8 .\docs\README.md
```

也可以在运行 `dev-shell.ps1` 后使用别名：

```powershell
gc8 .\docs\README.md
```

搜索优先使用 `rg`，避免用裸 `type`、`more` 或未指定编码的 `Get-Content` 查看中文文件。

## 本地启动与运行身份

`start-novel-studio.cmd` 会切换到 UTF-8 控制台并调用 `scripts/start.ps1`。启动脚本默认会清理当前项目在 `4317` 端口上的旧服务、重新构建当前工作区，并通过 `/api/v1/health` 检查服务身份。

脚本现在直接启动 `apps/server/dist/index.js`，不再通过 `npm start` 再间接启动 Node 服务。这样 pid 状态指向真实服务进程，测试时也少一层父进程干扰。

启动脚本使用 `Local\NovelStudioStartLock` 互斥锁串行化启动 / 停止操作，避免连续双击或并发测试同时抢占端口。

如果只是想复用已经运行且身份匹配的服务，可以显式使用：

```powershell
.\scripts\start.ps1 -ReuseExisting
```

自动化环境如果只需要证明服务能启动并返回健康信息，使用 `-SmokeTest`。它会启动服务、等待 `/api/v1/health`、输出身份信息，然后停止临时服务，不会留下后台进程：

```powershell
.\scripts\start.ps1 -NoBrowser -SkipBuild -SmokeTest
```

项目内 Playwright 验收使用 `tests/e2e/global-setup.ts` 直接启动隔离测试服务，不经过启动器，也不写入真实作品库。运行：

```powershell
npm.cmd run test:e2e
```

如果刚刚已经完成构建，可运行：

```powershell
npm.cmd run test:e2e:quick
```

Playwright 细则见 `docs/testing/BROWSER_ACCEPTANCE.md`。

Codex Browser 或其他需要自行连接本地页面的工具，可以使用 `-Foreground`。这个模式不隐藏服务，也不写 pid 文件；停止该命令就停止服务：

```powershell
.\scripts\start.ps1 -NoBrowser -SkipBuild -Foreground
```

如果需要显式清理当前 checkout 的本地服务，使用：

```powershell
.\scripts\start.ps1 -Stop
```

`-SkipBuild` 只用于已有构建产物的烟测；正式验收仍应先运行完整构建或 `npm.cmd run check`。普通双击启动不应使用 `-SkipBuild`。

健康检查会返回：

- `version`
- `commit`
- `startedAt`
- `workspaceRoot`
- `libraryRoot`

如果 `4317` 端口被旧 Novel Studio 进程占用，脚本会尝试清理本项目记录或可识别的旧进程。若端口属于无法确认来源的进程，脚本会拒绝自动结束它并输出占用者 PID。

如果 `data/server.stdout.log`、`data/server.stderr.log` 或 `data/server.pid.json` 被 Windows 或旧进程锁住，启动脚本会改用 `%TEMP%\novel-studio\server.<timestamp>.*` 记录本次 PID 状态。固定文件锁定只会触发简短提示，不会让已经通过身份校验的服务被误判为失败。
