# Novel Studio

Novel Studio 是一个面向中文长篇与系列小说的本地优先写作工作台。它把 Markdown 原稿、结构化故事资料、可审计 AI 上下文和多角色编辑工作流放在同一个本地 Web 应用中。

当前状态：**M0、M1、M2 已完成，M3 已完成 NS-301 至 NS-304**。现阶段可创建系列、以 Markdown 写作、使用四种真实规划视图、维护独立 Canon/Research 的 Codex、关系与提及索引，并完成刷新恢复和中文全文搜索。下一项是 NS-305 的 Progression 与角色知识；AI 编辑团队、资料解析和 Word 往返仍按路线图推进，不能视为已经交付。

## 开发运行

```powershell
npm.cmd install
npm.cmd run dev
```

浏览器访问 `http://127.0.0.1:5173`。服务端 API 默认位于 `http://127.0.0.1:4317/api/v1`。

日常体验可直接双击 `start-novel-studio.cmd`，它会启动生产构建并打开 `http://127.0.0.1:4317`。

完整检查：

```powershell
npm.cmd run check
```

## 新参与者从这里开始

1. 阅读 `AGENTS.md`。
2. 阅读 `docs/product/README.md` 和完整 `PRODUCT_SPEC.md`，不能只看任务表猜产品。
3. 阅读 `PROJECT.md`、`STATUS.md` 和 `HANDOFF.md`。
4. 只领取 `TASKS.md` 中一个状态明确的任务。
5. 完成测试、更新交接文档，再提交代码。

## 完整规划入口

- 产品愿景与全部功能：`docs/product/PRODUCT_SPEC.md`
- 最终交互体验：`docs/product/USER_EXPERIENCE_SPEC.md`
- AI 编辑团队与上下文：`docs/product/AI_EDITORIAL_SYSTEM.md`
- 资料分析库：`docs/product/REFERENCE_LIBRARY_SPEC.md`
- Word、版本与备份：`docs/product/IMPORT_EXPORT_VERSIONING_SPEC.md`
- 里程碑与完成标准：`docs/product/REQUIREMENTS_TRACEABILITY.md`

产品研究资料保留在相邻目录 `../novelcraft`，本仓库只保存采用、改造或排除后的产品决策。
