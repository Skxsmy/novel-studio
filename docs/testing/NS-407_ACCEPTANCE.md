# NS-407 验收记录

日期：2026-06-21

## 自动化验证

- `npm.cmd run typecheck`
  - 通过。
- `npm.cmd run test`
  - 通过。
  - Server：5 个文件、13 项测试。
  - Web：5 个文件、14 项测试。
  - AI：1 个文件、10 项测试。
  - Storage：3 个文件、41 项测试。
- `npm.cmd run test:e2e`
  - 通过。
  - Playwright / Chrome：1 个用例通过。
- `npm.cmd run check`
  - 通过。
  - Server：5 个文件、13 项测试。
  - Web：5 个文件、14 项测试。
  - AI：1 个文件、10 项测试。
  - Storage：3 个文件、41 项测试。

## 服务端覆盖

`apps/server/test/model-calls.test.ts` 覆盖：

- 成功的流式 AI 调用会返回 `metadata / delta / usage / done` SSE 事件。
- 调用日志保存：
  - 调用 ID。
  - 角色。
  - Provider / Model。
  - ContextBundle ID。
  - PromptTemplate ID / version。
  - 请求哈希、响应哈希。
  - 估算与实际用量。
  - 状态。
- 调用失败也保存失败日志和错误分类。
- 日志不包含明显密钥字符串。
- `GET /ai/calls/:id/context` 返回调用实际使用的上下文快照。
- `rewrite` 可以生成候选文本，但服务端不会改写场景正文。

## 浏览器验收

`tests/e2e/browser-acceptance.spec.ts` 覆盖：

- 写作页打开 AI 面板。
- 使用 MockProvider 发起 AI 审稿调用。
- 审稿结果在侧栏显示。
- 调用记录由后端/API 保存；写作页不展示调用来源、基准版本、用量或调用 ID。
- 在正文中选择文字后切换到“改写”。
- AI 候选直接进入正文编辑器。
- 浏览器真实选区包含候选文本。
- 页面出现“候选待确认 / 保留 / 撤回”。
- 点击“保留”后才保存到 Markdown 场景。
- API 重新读取场景，确认保存后的正文包含候选文本。

## 截图证据

Playwright 附件保存于：

```text
%TEMP%\novel-studio-browser-acceptance\test-results
```

本次新增 / 更新截图：

- `m4-ai-panel-ready.png`
- `m4-ai-review-result.png`
- `m4-ai-inline-candidate-selected.png`

人工查看结果：

- AI 面板已去除大块工程安全说明。
- 主界面聚焦“审稿 / 改写、模型、要求、结果”。
- 写作页不显示调用记录；完整日志 UI 留给 `NS-409`。
- 候选正文在编辑器内高亮选中，正文上方只保留轻量“候选待确认 / 保留 / 撤回”确认条；调用来源、基准版本、用量和调用 ID 不出现在确认条或写作侧边栏。

## 已知 UI 后续任务

- 写作页左侧结构抽屉仍偏圆润、碎片化，与新增 AI 面板的冷硬控制台风格不统一。
- 后续 UI 整理应从用户视角统一全局视觉：更简洁、更大气、更像工具台，而不是把工程边界和内部概念展示给作者。
