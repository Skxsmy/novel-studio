# 浏览器验收流程

本文记录 Novel Studio 的浏览器检查方式。当前项目恢复阶段不再默认要求浏览器截图验证。

## 当前规则

- 自动化测试证明行为，不证明视觉验收。
- 浏览器/E2E 检查只在任务明确要求、用户明确要求，或需要验证真实浏览器专属行为时运行。
- 截图不是 UI 或布局变更的默认完成条件；只有任务或用户明确要求截图证据时才生成截图。
- 用户视觉验收与命令验证分开记录。没有用户确认时，不得把命令通过写成视觉验收通过。
- 临时浏览器报告、trace、失败截图和运行附件不得进入作品库；需要保留时必须在任务验收记录中明确说明用途。

## 可用命令

完整浏览器验收会先构建，再用 Playwright 操作 Chrome：

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

启动器健康检查：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -NoBrowser -SkipBuild -SmokeTest
```

需要让 Codex Browser 或其它工具连接本地页面时，使用前台服务模式，并由调用方结束该命令：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -NoBrowser -SkipBuild -Foreground
```

显式清理当前 checkout 的本地服务：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 -Stop
```

## 数据隔离

浏览器检查必须使用隔离作品库，不能污染作者真实数据。检查结果只记录与当前任务直接相关的命令、结果和必要附件。