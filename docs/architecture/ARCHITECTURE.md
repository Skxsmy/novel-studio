# 系统架构

本文描述当前 M0–M2 实现。M3–M8 的完整目标模块、数据流和扩展边界见 `TARGET_ARCHITECTURE.md`；产品行为见 `../product/PRODUCT_SPEC.md`。

## 运行拓扑

```text
Browser (React/Vite)
        |
   REST + SSE /api/v1
        |
Fastify local server (127.0.0.1)
   |          |           |
File store   SQLite      Provider adapters
(authority)  (index)     (M4)
```

首版服务仅监听回环地址。生产构建由 Fastify 提供前端静态文件；开发时 Vite 将 `/api` 代理到 Fastify。

## 工作区

- `apps/web`：中文浏览器界面。
- `apps/server`：API、配置、任务编排和静态资源服务。
- `packages/contracts`：Zod 契约和共享 TypeScript 类型。
- `packages/storage`：文件原子写入、Markdown/YAML、索引和重建。

依赖方向固定为：应用可依赖 packages；packages 不依赖应用；contracts 不依赖 storage。

## 写入流程

1. 客户端读取实体及 `revision`。
2. 客户端提交变更和 `baseRevision`。
3. 服务端重新读取磁盘并比较版本。
4. 不一致返回 409，不做覆盖。
5. 一致时写临时文件、刷盘、原子替换。
6. 成功后更新可重建索引并返回新版本。

AI 与导入器不能绕过此流程；它们先创建 Proposal。

## 故障边界

- YAML/Markdown 无法解析：实体标记损坏并只读开放原文件，不静默修复。
- SQLite 损坏或缺失：关闭索引、保留编辑能力，并提供重建。
- 索引更新失败：文件写入仍为成功，但返回 degraded 状态并排队重建。
- 外部文件变化：M3 以后通过哈希检测，冲突时保留用户版本。
