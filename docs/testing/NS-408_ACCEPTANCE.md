# NS-408 验收记录：真实 Provider 接入

状态：部分通过。DeepSeek、OpenAI、OpenRouter、Ollama 与通用 OpenAI-compatible 基础路径已完成；完整 NS-408 仍进行中。

## 范围

本次验收覆盖：

- DeepSeek adapter；
- OpenAI adapter；
- OpenRouter adapter；
- Ollama adapter；
- 通用 OpenAI-compatible adapter；
- DeepSeek 快速配置 UI；
- 密钥保存端点与凭据引用；
- 密钥替换、删除和复用；
- 服务端 fake fetch / fake credential store 测试；
- 写作页非写入调用仍经统一 ProviderRegistry；
- 浏览器验收截图唯一化与人工检查流程。

不覆盖：

- 用户真实 DeepSeek 非写入调用；
- 用户真实 OpenAI、OpenRouter 或 Ollama 调用；
- Anthropic、Gemini；
- 完整调用日志 UI。

## 官方 API 核对

本轮新增 OpenAI、OpenRouter 和 Ollama 前，已核对官方文档中的 endpoint、请求体与返回体，并以 fake fetch 测试锁定：

- OpenAI：`GET https://api.openai.com/v1/models` 返回 `object: "list"` 与 `data[].id`；`POST https://api.openai.com/v1/chat/completions` 使用 Bearer 认证、`messages`、`stream`、`max_completion_tokens`，且本实现为 OpenAI 路径发送 `developer` + `user` 消息。
- OpenRouter：`GET https://openrouter.ai/api/v1/models` 返回 `data[].id/name/context_length`；`POST https://openrouter.ai/api/v1/chat/completions` 使用 Bearer 认证、`messages`、`stream`、`max_completion_tokens`。
- Ollama：`http://localhost:11434/v1` 下的 `/models` 与 `/chat/completions` 为官方 OpenAI compatibility 路径；本实现不要求 Authorization header。
- DeepSeek：保留官方 OpenAI-compatible `https://api.deepseek.com/models` 与 `/chat/completions` 路径，仍使用 `max_tokens`。

## 自动化结果

| 检查 | 结果 |
|---|---|
| `env TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run build:packages` | 通过 |
| `env TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run test -w @novel-studio/ai` | 通过，18/18 |
| `env TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run test -w @novel-studio/server` | 通过，16/16 |
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
- OpenAI、OpenRouter 和 Ollama 在 ProviderRegistry 中有独立 provider ID，不通过通用 `openai-compatible` 配置冒充。
- fake secret 测试确认认证失败信息不会泄露密钥。
- Provider 失败不会静默改用其他 Provider。

## 待补验收

仍需执行一次真实 DeepSeek 非写入调用：

1. 选择已通过连接测试的 `DeepSeek 写作模型`。
2. 到写作页进行一次非写入型 AI 审稿。
3. 确认 AI 结果不直接写入正文，调用记录不泄露密钥。

该项通过后，DeepSeek 路径可视为真实环境纵向闭环通过。
