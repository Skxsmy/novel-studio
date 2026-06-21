# NS-403 验收记录

验收日期：2026-06-21

状态：通过。

## 目标

NS-403 负责 ProviderAdapter 核心、MockProvider、能力描述、ProviderRegistry 和错误分类。任务不接真实模型、不读取密钥、不新增用户界面。

## 验收结果

| ID | 状态 | 证据 |
|---|---|---|
| NS403-A01 | 通过 | 新增 `packages/ai/src/provider.ts`，定义统一 ProviderAdapter 接口 |
| NS403-A02 | 通过 | 新增 `packages/ai/src/registry.ts`，默认 registry 只注册 MockProvider，不注册真实云端 Provider |
| NS403-A03 | 通过 | MockProvider 支持连接测试、模型列表、能力描述、流式输出、结构化输出、embedding 和 token 估算 |
| NS403-A04 | 通过 | 单元测试覆盖认证失败、限流、模型不可用、上下文过长、结构化输出失败和未知错误分类 |
| NS403-A05 | 通过 | MockProvider 结构化输出包含 `safeToWrite: false`；流式文本明确不修改正文、已确认设定或故事资料文件 |
| NS403-A06 | 通过 | `packages/ai` 不包含文件写入、API key 读取或真实网络调用 |
| NS403-A07 | 通过 | 根 `build:packages` 已纳入 `@novel-studio/ai`，全量检查覆盖新包 |

## 命令记录

- `npm.cmd run typecheck -w @novel-studio/ai`：通过。
- `npm.cmd run test -w @novel-studio/ai`：通过；1 个文件、9 项测试。
- `npm.cmd install --package-lock-only --ignore-scripts`：通过；仅用于更新新增 workspace 的 lockfile。沙箱内首次运行因 `package-lock.json` 写入 EPERM 失败，提升权限后成功。
- `npm.cmd run check`：通过；Server 7/7，Web 14/14，AI 9/9，Storage 41/41，生产构建通过。

## 浏览器验收状态

NS-403 没有模型设置 UI，因此不新增浏览器自动化用例。

`BA-M4-001` 仍为待实现：用户可见的 MockProvider 配置、连接测试和能力展示需要等 `NS-404` 或 `NS-409` 完成后验收。

## 下一任务

`NS-405`：场景级上下文装配器、权限过滤、未来剧情隔离和用量估算。
