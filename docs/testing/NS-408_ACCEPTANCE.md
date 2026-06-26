# NS-408 验收记录：真实 Provider 接入

状态：部分通过。DeepSeek、OpenAI、OpenRouter、Ollama、Anthropic、Google Gemini 与通用 OpenAI-compatible 基础路径已完成；完整 NS-408 仍进行中。

## 范围

本次验收覆盖：

- DeepSeek adapter；
- OpenAI adapter；
- OpenRouter adapter；
- Ollama adapter；
- Anthropic adapter；
- Google Gemini adapter；
- 通用 OpenAI-compatible adapter；
- DeepSeek 快速配置 UI；
- 密钥保存端点与凭据引用；
- 密钥替换、删除和复用；
- 服务端 fake fetch / fake credential store 测试；
- 写作页非写入调用仍经统一 ProviderRegistry；
- 浏览器验收截图唯一化与人工检查流程。

不覆盖：

- 用户真实 DeepSeek 非写入调用；
- 用户真实 OpenAI、OpenRouter、Ollama、Anthropic 或 Google Gemini 调用；
- 完整调用日志 UI。

## 官方 API 核对

本轮新增 OpenAI、OpenRouter、Ollama、Anthropic 和 Google Gemini 前，已核对官方文档中的 endpoint、请求体与返回体，并以 fake fetch 测试锁定：

- OpenAI：`GET https://api.openai.com/v1/models` 返回 `object: "list"` 与 `data[].id`；`POST https://api.openai.com/v1/chat/completions` 使用 Bearer 认证、`messages`、`stream`、`max_completion_tokens`，且本实现为 OpenAI 路径发送 `developer` + `user` 消息。
- OpenRouter：`GET https://openrouter.ai/api/v1/models` 返回 `data[].id/name/context_length`；`POST https://openrouter.ai/api/v1/chat/completions` 使用 Bearer 认证、`messages`、`stream`、`max_completion_tokens`。
- Ollama：`http://localhost:11434/v1` 下的 `/models` 与 `/chat/completions` 为官方 OpenAI compatibility 路径；本实现不要求 Authorization header。
- DeepSeek：保留官方 OpenAI-compatible `https://api.deepseek.com/models` 与 `/chat/completions` 路径，仍使用 `max_tokens`。
- Anthropic：`GET https://api.anthropic.com/v1/models` 返回 `data[]`、`has_more`、`first_id`、`last_id`；`POST https://api.anthropic.com/v1/messages` 使用 `x-api-key`、`anthropic-version: 2023-06-01`、`model`、`max_tokens`、`system`、`messages` 和可选 `stream`；流式文本来自 `content_block_delta` / `text_delta`。
- Google Gemini：`GET https://generativelanguage.googleapis.com/v1beta/models` 使用 `pageSize/pageToken`，返回 `models[]/nextPageToken`；`POST https://generativelanguage.googleapis.com/v1beta/{model=models/*}:generateContent` 使用 `contents`、`systemInstruction`、`generationConfig`；流式接口为 `POST ...:streamGenerateContent?alt=sse`；模型元数据使用 `baseModelId/name/displayName/inputTokenLimit/supportedGenerationMethods`；API key 通过 `x-goog-api-key` header 传递。

## 自动化结果

| 检查 | 结果 |
|---|---|
| `npm.cmd run build -w @novel-studio/ai` | 通过 |
| `npm.cmd run test -w @novel-studio/ai` | 通过，20/20 |
| `npm.cmd run test -w @novel-studio/server -- ai-routes.test.ts` | 通过，8/8 |
| `npm.cmd run test -w @novel-studio/web -- AppShell.test.tsx` | 通过，38/38 |
| `npm.cmd run check` | 首次沙箱内因 `packages/contracts/dist/*.js` 写入 EPERM 失败；提升权限重跑通过。最终 Server 20/20、Web 44/44、AI 20/20、Storage 47/47，生产构建通过；Vite 提示单个前端 chunk 大于 500 kB |
| `env TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run build:packages` | 通过 |
| `env TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run test -w @novel-studio/ai` | 通过，18/18（历史） |
| `env TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run test -w @novel-studio/server` | 通过，16/16（历史） |
| `env TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run typecheck -w @novel-studio/web` | 通过 |
| `env TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run check` | 通过，Server 16/16、Web 14/14、AI 18/18、Storage 41/41 |
| `npm.cmd run test:e2e` | 通过 |

## 用户侧真实验收

用户已在设置页保存 DeepSeek 密钥，并从用户视角确认：

- DeepSeek 连接正常；
- 能够获取 DeepSeek 模型列表。

该项由用户手动验收提供结论；Codex 未在本地进程中读取或打印真实密钥，也未声称自行完成真实密钥测试。

## 浏览器截图

最新一次截图清单由 Playwright 生成，文件名带运行时间戳：

- `*-screenshot-manifest.json`
- `*-01-m4-settings-model-profile.png`
- `*-02-m4-deepseek-provider-config.png`
- `*-07-m4-ai-inline-candidate-selected.png`

人工检查结论：

- DeepSeek 设置页不再显示“回退策略必须另行显式配置”等开发者说明。
- 连接区域只显示用户能理解的状态：`连接状态 / 尚未测试`。
- 服务密钥卡不再竖排，不再被能力卡挤压。
- 能力参数与凭据引用已折叠进“高级信息”。
- 截图流程不再复用同名图片；每次运行写入 manifest，便于确认是否为本轮截图。

仍需后续 UI 整理：

- 设置页整体仍偏表单后台，不是最终视觉质量。
- 模型配置页需要在 `NS-409` 或 UI 整理任务中进一步统一字体、留白、按钮和卡片风格。
- AI 改写确认条可用，但仍需更精致的视觉处理。

## 安全边界

- API Key 只通过 `/credential` 端点写入 `CredentialStore`。
- `ModelProfile` 只保存 `credentialRef`。
- 用户可替换当前密钥、删除密钥，或让模型配置复用已有凭据引用。
- DeepSeek 使用独立 `provider: deepseek`；通用 `openai-compatible` 不继承 DeepSeek 的默认地址、模型或 provider-specific 错误语义。
- OpenAI、OpenRouter、Ollama、Anthropic 和 Google Gemini 在 ProviderRegistry 中有独立 provider ID，不通过通用 `openai-compatible` 配置冒充。
- fake secret 测试确认认证失败信息不会泄露密钥。
- Provider 失败不会静默改用其他 Provider。

## 待补验收

仍需执行真实外部非写入调用验收：

1. 选择已通过连接测试的真实 Provider 模型，例如 `DeepSeek 写作模型` 或用户配置的 Anthropic / Google Gemini / OpenAI / OpenRouter 模型。
2. 到写作页进行一次非写入型 AI 审稿。
3. 确认 AI 结果不直接写入正文，调用记录不泄露密钥。

该项通过后，对应 Provider 路径可视为真实环境纵向闭环通过。Codex 不读取或打印真实密钥。
