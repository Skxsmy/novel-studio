# NS-406 验收记录：提示词模板、角色与版本

日期：2026-06-21

## 自动化覆盖

### 全量检查

命令：

```powershell
npm.cmd run check
```

结果：通过。Server 4 个文件、11 项测试；Web 5 个文件、14 项测试；AI 1 个文件、10 项测试；Storage 3 个文件、41 项测试；生产构建通过。

### 类型检查

命令：

```powershell
npm.cmd run typecheck
```

结果：通过。Contracts、Server、Web、AI、Storage 均通过类型检查。

### 单元与接口测试

命令：

```powershell
npm.cmd run test
```

结果：通过。Server 4 个文件、11 项测试；Web 5 个文件、14 项测试；AI 1 个文件、10 项测试；Storage 3 个文件、41 项测试。

新增覆盖要点：

- `GET /ai/roles` 会补齐 7 个内置角色。
- 内置角色不能直接 `PUT` 覆盖。
- 内置角色可复制为自定义角色，自定义角色可修改。
- `GET /ai/prompts` 会补齐内置提示词模板。
- `POST /ai/prompts/:id/preview` 缺少必填 `user_request` 时返回 `PROMPT_INPUT_MISSING`。
- 模板预览会展开 `{{user_request}}` 等声明式占位符。
- 模板新增版本时保留旧版本文件，不覆盖 v1。
- `{{ user_request.toUpperCase() }}` 一类表达式会返回 `PROMPT_TEMPLATE_INVALID`，不会执行。
- 角色、模板、Preset 三个接口并发首次读取时不会互相抢写内置 YAML。

### 上下文预览回归

命令：

```powershell
npm.cmd run test -w @novel-studio/server
```

结果：通过，Server 4 个文件、11 项测试。

覆盖要点：

- `ContextBundle.items` 包含 `prompt-template`。
- 上下文预览使用真实角色文件和提示词模板。
- 未来信息、隐藏区段和 `never` 设定仍被排除。

### 浏览器验收

命令：

```powershell
npm.cmd run test:e2e
```

结果：通过，1 个 Chrome 用例。

覆盖要点：

- 设置页默认打开“模型连接”，仍可添加本机验收模型并测试连接。
- 点击“角色与提示词”进入新分区。
- 页面显示用户创建的角色列表。
- 选择一个上下文检查角色。
- 在右侧输入“作者要求”。
- 点击“预览提示词”。
- 页面显示“最终提示词”和实际展开后的作者要求。
- 生成截图附件：
  - `m4-settings-model-profile.png`
  - `m4-prompt-template-preview.png`
  - `m4-write-context-preview.png`

浏览器验收中曾发现角色、模板、Preset 三个请求并发首次读取时会触发早期补种竞态。后续 Workshop Agent 隔离工作已移除全局内置补种路径；当前角色和模板由用户显式创建或由功能专属 prompt 模块提供。

## 人工审查

- “角色与提示词”页三栏布局可读：左侧角色列表，中间角色边界和模板版本，右侧提示词预览。
- UI 文案使用中文写作用语，未引入新的英文混搭入口；模板 ID 和版本作为审计信息保留。
- 模板预览明确说明“不调用模型”，不会写入正文。
- 角色与模板页面不得暗示存在不可编辑的全局基础角色；用户创建的角色和模板应按普通项目数据处理。

## 未覆盖范围

- NS-406 不实现真实模型调用；调用日志写入属于 `NS-407`。
- 当前只允许 UI 编辑自定义角色的少量字段；更完整的角色编辑器可在 NS-409 或后续 UI 整理中扩展。
- 当前模板保存新版本的 UI 只编辑工作指令；组件、变量和 Preset 的完整编辑器留给后续。
