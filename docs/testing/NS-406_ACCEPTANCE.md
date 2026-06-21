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
- 上下文预览使用真实内置连续性编辑角色和连续性检查模板。
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
- 页面显示内置角色列表。
- 选择“连续性编辑”。
- 在右侧输入“作者要求”。
- 点击“预览提示词”。
- 页面显示“最终提示词”和实际展开后的作者要求。
- 生成截图附件：
  - `m4-settings-model-profile.png`
  - `m4-prompt-template-preview.png`
  - `m4-write-context-preview.png`

浏览器验收中曾发现角色、模板、Preset 三个请求并发首次读取时会触发内置文件补种竞态。已在 `apps/server/src/prompts/builtIns.ts` 加入每作品补种锁，并用接口并发测试覆盖。

## 人工审查

- “角色与提示词”页三栏布局可读：左侧角色列表，中间角色边界和模板版本，右侧提示词预览。
- UI 文案使用中文写作用语，未引入新的英文混搭入口；模板 ID 和版本作为审计信息保留。
- 模板预览明确说明“不调用模型”，不会写入正文。
- 内置角色只读的提示明确，避免误以为可以直接覆盖项目基础角色。

## 未覆盖范围

- NS-406 不实现真实模型调用；调用日志写入属于 `NS-407`。
- 当前只允许 UI 编辑自定义角色的少量字段；更完整的角色编辑器可在 NS-409 或后续 UI 整理中扩展。
- 当前模板保存新版本的 UI 只编辑工作指令；组件、变量和 Preset 的完整编辑器留给后续。
