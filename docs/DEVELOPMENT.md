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

`start-novel-studio.cmd` 会切换到 UTF-8 控制台并调用 `scripts/start.ps1`。启动脚本默认会清理当前项目在 `4317` 端口上的旧服务、重新构建当前工作区，并通过 `/api/v1/health` 检查服务身份。同一提交下有未提交代码改动时，这种默认重启也能避免命中旧进程。

如果只是想复用已经运行且身份匹配的服务，可以显式使用：

```powershell
.\scripts\start.ps1 -ReuseExisting
```

自动化或 Codex 浏览器验收时，使用 `-Wait` 让启动命令保持前台挂住，避免命令宿主结束后连带回收服务进程：

```powershell
.\scripts\start.ps1 -NoBrowser -SkipBuild -Wait
```

`-SkipBuild` 只用于已有构建产物的烟测；正式验收仍应先运行完整构建或 `npm.cmd run check`。

健康检查会返回：

- `version`
- `commit`
- `startedAt`
- `workspaceRoot`
- `libraryRoot`

如果 `4317` 端口被旧 Novel Studio 进程占用，脚本会尝试清理本项目记录或可识别的旧进程。若端口属于无法确认来源的进程，脚本会拒绝自动结束它并输出占用者 PID。

如果 `data/server.stdout.log`、`data/server.stderr.log` 或 `data/server.pid.json` 被 Windows 或旧进程锁住，启动脚本会改用 `%TEMP%\novel-studio\server.<timestamp>.*` 记录本次启动日志和 PID 状态。固定文件锁定会以 warning 形式输出，但不会让已经通过身份校验的服务被误判为失败。
