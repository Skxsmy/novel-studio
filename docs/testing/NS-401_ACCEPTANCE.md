# NS-401 验收记录

验收日期：2026-06-21

状态：通过。

## 目标

NS-401 用于把 M4 的模型连接、上下文装配、提示词版本和调用日志拆成可执行规格。它不实现真实模型调用，也不新增运行时代码。

## 验收结果

| ID | 状态 | 证据 |
|---|---|---|
| NS401-A01 | 通过 | 已新增 `docs/tasks/NS-401.md`，明确 MockProvider 垂直切片、模块边界、API 草案、文件格式草案和安全不变量 |
| NS401-A02 | 通过 | `docs/architecture/API.md` 已写入 M4 模型配置、提示词、上下文预览、非写入调用和调用日志接口草案 |
| NS401-A03 | 通过 | `docs/architecture/DATA_MODEL.md` 已写入 ModelProfile、AgentRole、PromptTemplate、ContextBundle、ModelCallLog 和 Proposal 文件草案 |
| NS401-A04 | 通过 | `docs/testing/BROWSER_ACCEPTANCE.md` 已将 M4 浏览器验收映射到 NS-403、NS-405、NS-407、NS-409、NS-404 和 NS-408 |
| NS401-A05 | 通过 | `TASKS.md` 已将 `NS-401` 标为完成，并把 `NS-402` 作为下一项 |
| NS401-A06 | 通过 | 本任务未新增真实 Provider、API key 文件、模型调用代码或任何正文 / Canon 写入能力 |

## 命令记录

- `git diff --check`：通过，仅有 Windows 换行转换提示。
- `npm.cmd run check`：通过；Server 7/7，Web 14/14，Storage 39/39，生产构建通过。

## 下一任务

`NS-402`：AI 契约分区与模型配置、提示词、上下文包、调用日志的最小持久化。
