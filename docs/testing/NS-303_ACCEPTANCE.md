# NS-303 验收记录

验收日期：2026-06-20

规格来源：`docs/tasks/M3.md`

状态：通过。

## 自动化结果

最终执行：`npm.cmd run check`

结果：退出码 0。

- Server：4/4 测试通过。
- Web：9/9 测试通过，其中 Milkdown React 组件在 jsdom 中验证 CommonMark 语义及 20 万中文字符打开预算。
- Storage：27/27 测试通过。
- Contracts、Storage、Server、Web 类型检查通过。
- Fastify server 与 Vite production build 通过。
- `git diff --check`：通过；仅报告仓库既有的 Windows 换行转换提示。

新增生产依赖为 `@milkdown/kit` 与 `@milkdown/react` 7.21.2，均为 MIT；测试依赖 `@testing-library/react` 与 `jsdom` 也为 MIT。`npm audit` 报告 0 个已知漏洞。

## 验收映射

| ID | 结果 | 证据 |
|---|---|---|
| NS303-A01 | 通过 | Milkdown 组件测试验证标题、中文标点、强调、引用、列表、链接和分隔线；真实浏览器从磁盘 Markdown 加载为对应语义节点，编辑后保存仍保持语义 |
| NS303-A02 | 通过 | Web 组件测试要求 20 万中文字符在 5 秒预算内打开；storage 测试要求同规模保存低于 2 秒且逐字相同；最终本机整组实际分别为 82ms/3.05s（含组内其他测试） |
| NS303-A03 | 通过 | storage/API 过期 revision 测试；浏览器打开旧会话后外部插入两段文字，保存显示 409 冲突，磁盘标题与外部正文不变；修复并复验“重新载入磁盘版本”确实重新 GET 最新场景 |
| NS303-A04 | 通过 | 浏览器进入专注模式后 DOM 只保留退出按钮、标题、Milkdown 正文、保存反馈与统计，导航和左右抽屉隐藏 |
| NS303-A05 | 通过 | recoveryDraft 三项测试覆盖有效、过期和损坏草稿；浏览器在自动保存前刷新后显示“发现未保存草稿”，外部版本变化后显示“发现基于旧版本的恢复草稿” |
| NS303-A06 | 通过 | 五类 Section schema、独立 `sections/<scene>/<id>.md` 存储、更新、归档与恢复测试；浏览器创建敏感 Section 并独立保存，正文统计和内容不含该资料 |
| NS303-A07 | 通过 | storage 资格测试验证 `never` 不进入 AI 上下文、`inherit` 可进入候选上下文；浏览器确认敏感资料默认选择“永不提供给 AI” |
| NS303-A08 | 通过 | Section 过期 revision 更新被拒绝，原内容不变；归档/恢复均携带独立 revision |
| NS303-A09 | 通过 | 锚点解析测试在前方插入文字后返回 `relocated`；浏览器先显示 `attached`，外部在正文前增加两段后显示 `relocated` |
| NS303-A10 | 通过 | 引用删除和重复候选测试返回 `orphaned`；读取锚点前后 YAML 字节完全一致 |
| NS303-A11 | 通过 | 错误引用范围返回 422；另一作品更新 Section 返回 404；路径归属由系列根、场景和文件 metadata 交叉校验 |
| NS303-A12 | 通过 | 全量 check、真实中文 fixture 浏览器验收、控制台检查、状态、交接和任务提交完成 |

## 浏览器观察

- 中文 Markdown 从磁盘载入后，DOM 明确呈现 `heading`、`strong`、`blockquote`、`list`、`link` 和 `separator`，不是把语法显示成普通文本。
- 编辑产生恢复草稿是同步动作；在 900ms 自动保存窗口内刷新，重进写作页可选择恢复或保留磁盘版本。
- 右侧抽屉包含场景、Sections、锚点三个页签。敏感 Section 默认 `never`，内容单独保存。
- 外部修改发生后旧会话不会覆盖磁盘；冲突提示持续可见，重新载入后标题、外部前缀和 revision 都来自最新磁盘版本。
- 锚点在原始位置显示 `attached`，正文前插入内容后显示 `relocated` 和原因。
- 浏览器控制台无 warning/error。

## 已知且接受的行为

Milkdown 保存的是 CommonMark 语义，编辑后可能把等价列表标记 `-` 规范化为 `*`、把分隔线 `---` 规范化为 `***`。中文标点、正文文字和语义节点保持不变；应用不保存 Milkdown 私有 JSON。若未来要求逐字符保留 Markdown 标记风格，应新增源码模式或 source-map 级格式保留任务，不能把编辑器 JSON 升格为权威数据。
