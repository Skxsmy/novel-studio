# NS-404 验收记录：模型设置、凭据边界与 Provider 选择

## 2026-07-01 Settings Repair Follow-Up

Authoritative behavior after the repair:

- Model profiles and service keys are library-global Settings data shared by all projects.
- The obsolete deployment-policy surface is removed and must not appear in runtime code, API payloads, UI, or active task/architecture claims.
- Model profile create/update payloads do not accept `credentialRef`; only `/api/v1/ai/model-profiles/:profileId/credential` may save, replace, or delete a service key.
- Ordinary Save Setting must preserve an existing key when the key field is empty, and must save a newly typed key by calling the credential endpoint after the profile fields are saved.
- Settings is usable without an open project. Key save/replace, connection test, and model fetch are not project-gated.
- Large provider model lists are collapsed by default and expand into a bounded scroll list.

Focused verification:

- `npm.cmd run test -w @novel-studio/web -- src/app/AppShell.test.tsx`: passed, 1 file / 51 tests.
- `npm.cmd run test -w @novel-studio/contracts -- test/ai.test.ts`: passed, 1 file / 1 test.
- `npm.cmd run test -w @novel-studio/storage -- test/ai-files.test.ts`: passed, 1 file / 2 tests.
- `npm.cmd run test -w @novel-studio/server -- test/ai-routes.test.ts test/context-routes.test.ts test/model-calls.test.ts test/workshop-routes.test.ts`: passed, 4 files / 15 tests.
- `npm.cmd run test -w @novel-studio/ai`: passed, 1 file / 20 tests.
- Builds passed for contracts, storage, AI, server, and web.
- Residual searches found no cloud/local policy strings and no old series-scoped model-profile route.
- Full e2e was not a Settings pass: `npm.cmd run test:e2e` hit a transient contracts dist EPERM during rebuild; after contracts rebuilt successfully, `npm.cmd run test:e2e:quick` failed before reaching Settings because the browser acceptance script still asserts the old Chinese homepage heading `小说工作室` against the current English app shell.

日期：2026-06-21

> 后续调整：当前安全边界以 Provider 显式选择、系统凭据引用、资料级 `never` 排除和禁止静默回退为准。

## 自动化覆盖

### 全量检查

命令：

```powershell
npm.cmd run check
```

结果：通过。Server 3 个文件、10 项测试；Web 5 个文件、14 项测试；AI 1 个文件、10 项测试；Storage 3 个文件、41 项测试；生产构建通过。

### AI 包

命令：

```powershell
npm.cmd run test -w @novel-studio/ai
```

结果：通过，1 个文件、10 项测试。

覆盖要点：

- MockProvider 正常连接、模型列表、能力描述、流式输出、结构化输出、embedding 和 token 估算。
- 统一错误分类覆盖认证失败、限流、模型不可用、结构化输出失败、上下文过长和未知错误。
- Profile create/update payload 不接收 `credentialRef`；服务密钥只能通过 credential 专用端点保存、替换和删除。

### Server API

命令：

```powershell
npm.cmd run test -w @novel-studio/server
```

结果：通过，包含 NS-404 路由测试。

覆盖要点：

- 新作品的模型配置列表为空。
- 可创建本机验收模型，并由 MockProvider 自动补齐能力描述。
- 本机验收模型连接测试返回成功。
- 模型列表接口返回 MockProvider 模型。
- profile payload 中的 `credentialRef` 被拒绝；明文服务密钥不进入持久化文件。
- 缺少所需凭据时 Provider 调用在发送前被拒绝。
- Provider 不可用时返回 `provider-unavailable`，不会退回 MockProvider。

### Web

命令：

```powershell
npm.cmd run typecheck -w @novel-studio/web
npm.cmd run test -w @novel-studio/web
```

结果：通过，Web 5 个文件、14 项测试。

覆盖要点：

- 设置页类型通过。
- API 客户端已暴露模型配置、凭据状态和连接测试接口。

### 浏览器验收

命令：

```powershell
npm.cmd run test:e2e
```

结果：通过，1 个 Chrome 用例。

覆盖要点：

- 从作品界面进入“设置”。
- 添加本机验收模型。
- 执行连接测试，页面显示“连接正常”。
- 生成截图附件 `m4-settings-model-profile.png`，用于人工检查设置页布局、按钮位置和状态反馈。

## 人工审查

- 未新增明文 API key 文件。
- 新增凭据实现只接受凭据引用名称；无法访问系统凭据时返回错误。
- `apps/server/src/routes/ai.ts` 只做配置与连接测试，不执行真实模型调用。
- `apps/web/src/SettingsView.tsx` 只编辑模型配置，不要求或保存真实密钥。
- UI 用语使用“本机验收模型”“模型代号”“系统凭据引用”“云端模型开关”等中文表达，避免把实现术语直接甩给作者。

## 未覆盖范围

- 未测试真实 Windows Credential Manager 写入，因为当前任务没有提供真实密钥录入入口。
- 未接真实 OpenAI / Ollama / OpenRouter / Anthropic / Gemini Provider；这些属于 `NS-408`。
- 已做最小浏览器 E2E；完整模型设置体验、真实 Provider 和调用记录浏览器验收归入 `NS-409` / `NS-408`。
