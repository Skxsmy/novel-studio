# Novel Studio

Novel Studio 是一个面向中文长篇与系列小说的本地优先写作工作台。它把 Markdown 原稿、结构化故事资料、可审计 AI 上下文和多角色编辑工作流放在同一个本地 Web 应用中。

当前状态：**M0 已完成，M1/M2 首个纵向版本开发中**。现阶段已经开始实现系列创建、场景文件落盘、浏览器工作台和基础检索；AI、完整 Codex、资料解析和 Word 往返仍按路线图推进，不能视为已经交付。

## 开发运行

```powershell
npm.cmd install
npm.cmd run dev
```

浏览器访问 `http://127.0.0.1:5173`。服务端 API 默认位于 `http://127.0.0.1:4317/api/v1`。

完整检查：

```powershell
npm.cmd run check
```

## 新参与者从这里开始

1. 阅读 `AGENTS.md`。
2. 阅读 `PROJECT.md`、`STATUS.md` 和 `HANDOFF.md`。
3. 只领取 `TASKS.md` 中一个状态明确的任务。
4. 完成测试、更新交接文档，再提交代码。

产品研究资料保留在相邻目录 `../novelcraft`，本仓库只保存采用、改造或排除后的产品决策。

