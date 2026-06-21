# NS-405 验收记录：场景级上下文装配器

日期：2026-06-21

## 自动化覆盖

### 全量检查

命令：

```powershell
npm.cmd run check
```

结果：通过。Server 3 个文件、10 项测试；Web 5 个文件、14 项测试；AI 1 个文件、10 项测试；Storage 3 个文件、41 项测试；生产构建通过。

### Server API

命令：

```powershell
npm.cmd run test -w @novel-studio/server
```

结果：通过，包含 NS-405 路由测试。

覆盖要点：

- `POST /api/v1/series/:seriesId/context/preview` 可生成并保存 `ContextBundle`。
- `GET /api/v1/series/:seriesId/context/:contextBundleId` 可复查同一上下文快照。
- 预览包包含编辑职责、用户请求、当前场景和当前场景可读设定条目。
- 每个纳入项带来源 ID 和纳入原因。
- `never` 设定即使被主动选择也不会进入上下文。
- 隐藏区段不会进入上下文。
- 后文进展摘要不会向较早场景泄露。
- 排除项包含 `context-policy-never`、`hidden-section` 和 `future-information`。
- 用量估算为非零值。

### Web

命令：

```powershell
npm.cmd run typecheck -w @novel-studio/web
npm.cmd run test -w @novel-studio/web
```

结果：通过，Web 5 个文件、14 项测试。

覆盖要点：

- 写作页右侧“场景资料”可调用上下文预览 API。
- UI 类型覆盖模型选择、纳入项、排除项和用量摘要。

### 浏览器验收

命令：

```powershell
npm.cmd run test:e2e
```

结果：通过，1 个 Chrome 用例。

覆盖要点：

- 从写作页打开“场景资料”右侧抽屉。
- 使用设置页创建的本机验收模型。
- 点击“生成上下文预览”。
- 页面显示“纳入资料”和纳入项统计。
- 生成截图附件 `m4-write-context-preview.png`，用于人工检查右侧抽屉、资料保护说明和上下文预览状态。

## 人工审查

- 上下文预览不会调用 Provider。
- 上下文预览不会修改正文、设定库、摘要、故事进展或角色所知。
- 后文信息只以排除理由出现，不返回未来摘要、证据正文或内部 ID。
- 右侧预览入口明确说明“只生成资料包，不调用模型，不修改正文”。

## 未覆盖范围

- 当前 UI 是最小预览入口；来源分组、调用后快照查看和更细的浏览器自动验收属于 `NS-409`。
- 当时角色职责仍是占位文本；正式角色、提示词模板和版本历史已由 `NS-406` 补齐。
- 当前 token 估算使用本地估算函数；真实 Provider 的 tokenizer 差异属于 `NS-408` 或后续优化。
