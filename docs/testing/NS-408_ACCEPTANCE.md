# NS-408 验收记录：真实 Provider 接入

状态：部分通过。OpenAI-compatible / DeepSeek 路径已完成；完整 NS-408 仍进行中。

## 范围

本次验收覆盖：

- OpenAI-compatible adapter；
- DeepSeek 快速配置 UI；
- 密钥保存端点与凭据引用；
- 服务端 fake fetch / fake credential store 测试；
- 写作页非写入调用仍经统一 ProviderRegistry；
- 浏览器验收截图唯一化与人工检查流程。

不覆盖：

- 用户真实 DeepSeek API Key；
- OpenAI、OpenRouter、Anthropic、Gemini、Ollama；
- 完整调用日志 UI。

## 自动化结果

| 检查 | 结果 |
|---|---|
| `npm.cmd run typecheck -w @novel-studio/web` | 通过 |
| `npm.cmd run test:e2e` | 通过 |
| `@novel-studio/ai` 单元测试 | 已在同轮通过 |
| `@novel-studio/server` 单元测试 | 已在同轮通过 |
| 全仓 `npm.cmd run test` | 已在同轮通过 |

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
- fake secret 测试确认认证失败信息不会泄露密钥。
- 云端权限仍由作品级 `cloudPolicy` 控制。
- Provider 失败不会静默改用其他 Provider。

## 待用户参与验收

用户在设置页保存真实 DeepSeek API Key 后，需要执行：

1. 打开设置页。
2. 选择或创建 `DeepSeek 写作模型`。
3. 允许云端模型。
4. 粘贴 API Key 并保存。
5. 点击测试连接。
6. 到写作页进行一次非写入型 AI 审稿。

通过后，才能把 OpenAI-compatible / DeepSeek 路径视为真实环境通过。
