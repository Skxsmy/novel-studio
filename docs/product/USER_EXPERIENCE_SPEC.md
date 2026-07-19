# 用户体验与工作流规格

状态：权威功能规格  
依赖：`PRODUCT_SPEC.md`

## 1. 体验原则

- 默认安静，不把所有功能永久塞成三栏。
- 重要状态可见：保存、冲突、云端发送、用量、Proposal 和索引降级。
- 占位能力必须标注里程碑，不展示伪结果。
- 同一行为在不同工作区使用相同对象和术语。
- 高级字段按需出现；空字段不制造红色警告。
- 用户不应在主界面被工程审计信息打断。调用 ID、基准版本、上下文来源、哈希和内部任务名只进入记录或详情页。
- UI 必须简洁、大气、美观，并保持全项目风格统一；不能把后端安全边界、数据契约和日志字段直接搬到前端主路径。
- 中文文案必须像中文产品本身写出来的，而不是英文界面翻译稿。避免生硬词组、半中半英、牵强比喻和不自然动词。
- 主界面不得变成操作手册。功能说明不能用长段文字占据版面；只允许在输入框 placeholder、图标 tooltip、短空状态、必要错误提示或帮助页中轻量出现。用户开始输入后，placeholder 必须消失，不得与真实内容竞争注意力。
- 作者视角的层级固定为英文 `Series → Volume → Chapter → Act → Scene`。这是中文界面的明确术语例外；不得翻译、调序或显示内部 `book/act/chapter` 字段名。

## 2. 视觉语言

Novel Studio 的视觉方向是“安静写作空间 + 克制的战术工作台”。它应有清晰、冷静、可靠的气质：正文区域保持安静；规划、AI、Codex 和设置页面可以使用更硬朗的分割线、紧凑按钮和少量强调色，形成类似战术终端的秩序感。

参考方向可以包括明日方舟式的清晰层级、硬朗边界、低饱和底色、少量高亮色和紧凑信息面板；但只能吸收设计原则，不得复制其具体素材、图标、字体、商标、角色或界面构图。

### 2.1 风格统一规则

- 全应用共享同一组设计令牌：背景、正文色、弱文本色、边框色、强调色、危险色、成功色、阴影、圆角、间距和字体栈。
- 同类元素必须长得像同类元素。主按钮、次按钮、危险按钮、标签页、卡片、输入框、提示条、抽屉和列表项不得每个页面重新设计。
- 同一页面内不得混用圆润卡片、硬朗终端块、传统表单和网页后台风格，除非有明确层级原因并记录在 UX 决策中。
- 新增页面必须先复用现有布局模式：工作区壳、左侧列表、中间内容、右侧抽屉、设置双栏、审阅收件箱。确实需要新模式时，必须更新本文件。
- 字号和留白应服务阅读与操作，不得把少量状态放成巨大宣传横幅，也不得把密集工程字段塞进主视觉。

### 2.2 信息层级

主界面只显示作者当前决策所需的信息。工程信息遵循以下层级：

| 层级 | 放置位置 | 示例 |
|---|---|---|
| 主路径 | 页面主体、编辑器附近、主要按钮 | 写作、审稿、改写、保留、撤回、保存状态、冲突提示 |
| 辅助信息 | 可收起抽屉、轻量说明、悬停或次级卡片 | 当前场景摘要、选区、模型名称、预计风险 |
| 审计信息 | 调用记录、日志详情、调试页面 | 调用 ID、上下文包 ID、PromptTemplate version、请求哈希、响应哈希、Token 用量 |

不得把审计信息伪装成用户必须处理的主操作。用户需要的是“这段候选要不要保留”，不是“它来自哪个 callId、基于哪个 revision”。

安全边界、失败回退、密钥存储、日志脱敏和权限隔离等开发者必须保证的规则，不应在主界面以解释性长句反复提示。主界面只回答用户当前关心的事：现在能不能用、下一步该做什么、风险是否需要用户决定。更完整的实现边界进入产品文档、高级信息、帮助页或审计记录。

“下一步该做什么”也必须保持轻量。主工作区不展示教程卡、步骤说明区或持续占位的操作指南；只有在没有内容时显示一句短空状态，或在输入框内使用淡色 placeholder，例如“写下这一场的开头”。一旦用户输入真实内容，提示文字必须让位。

### 2.3 中文文案规则

- 操作用语优先使用动词短句：保留、撤回、生成、开始审稿、恢复草稿。
- 状态用语应直接说明影响：候选待确认、已保存、保存失败、发现未保存草稿。
- 避免翻译腔：例如不使用“来源调用”“基于版本”“应用补丁”“手工钉住”这类让作者出戏的表达。
- 技术名词只在技术页或审计页出现；写作主路径尽量使用作者能直接理解的说法。
- 如果一个中文词读起来像数据库字段名，应重新命名。

### 2.4 前端可维护性规则

前端设计必须先保证后续能改。不得再用一份巨大 CSS 或单个大组件堆出完整应用。

新前端必须采用清晰边界：

- `src/ui/`：设计令牌、基础组件和共享交互模式。
- `src/features/<domain>/`：按作品库、写作、规划、设定库、设置、AI 等业务域拆分页面和局部状态。
- `src/api/`：内部 API client 和数据装配，不把 fetch 散进页面组件。
- `src/app/`：应用壳、路由、全局状态和错误边界。

页面只负责组合 `src/ui/` 组件、业务数据和局部状态，不得把接口请求、一次性控件和大段私有样式塞进页面文件。

样式规则：

- 只允许少量全局样式：reset、tokens、字体和应用基础布局。
- 禁止重新出现几千行 `styles.css` 控全局。
- 全局样式文件应拆成 `reset.css`、`tokens.css` 和少量 layout 基础。
- 页面样式使用局部文件或组件样式。
- 页面不得临时发明按钮、输入框、标签页、卡片或提示条。
- 视觉变化优先通过 tokens 和 `src/ui/` 基础组件完成，而不是逐页打补丁。

实现顺序：

1. 先设计用户工作流和信息架构。
2. 再设计英文 UI 文案和页面结构，先覆盖写作、规划、设置三个核心页面。
3. 再建立视觉 tokens 和基础组件。
4. 只做一条“作品选择 → 写作页 → 保存状态 → 设置入口”的垂直切片验证架构、审美和可维护性。
5. 通过后再扩展其它页面。

### 2.5 文案与双语策略

中文 UI 必须像中文产品原生写出来的。如果当前无法写出自然中文，必须先冻结英文 UI 文案和布局，再把中文作为后续双语切换层处理。

要求：

- 英文草案要先保证信息架构和用户动作清晰。
- 中文翻译不得逐词硬译，必须重新按中文作者的表达习惯写。
- 双语切换应通过文案资源层实现，不把中英文写死在组件内部。
- 主界面不解释 API、数据结构、权限实现、hash、Token、Prompt version、调用 ID 或内部任务名。
- `Series / Volume / Chapter / Act / Scene` 在所有语言模式中保持英文并使用同一顺序。
- M5 Workshop 当前冻结的界面 chrome locale 是 `en-US`，符合“自然中文尚未完成时先冻结英文 UI”的边界。所有 Workshop 按钮、状态、空状态、错误兜底、日期格式和对象标签必须来自同一 Workshop 文案资源；组件不得内联第二套可见文案。默认 system prompt、作者消息、附件文件名、项目内容和模型回复是可编辑或动态内容，不受 chrome locale 限制。该边界不等于中文本地化已经完成；未来中文切换必须在同一资源接口增加完整 locale，而不能在组件中混写中英文。

### 2.6 设计验收规则

任何重要前端实现进入全量开发前，必须先通过一个小范围设计基准：

- 基础组件：按钮、输入、选择、标签、列表、面板、空状态、提示、确认条。
- 核心页面草案：写作、规划、设置。
- 垂直切片：作品入口 → 写作页 → 保存状态 → 设置入口。

只有这些通过用户评审后，才能继续扩展到设定库、AI、调用记录、编辑室和待确认。

浏览器验收必须使用 Codex 内置 Browser。验收服务必须临时启动，完成后关闭，并验证端口不再监听。

## 3. 应用壳

左侧主导航在宽屏显示图标和名称，可折叠为图标栏。顶部显示当前工作区、作品、搜索、专注模式和上下文抽屉开关。

主导航顺序：概览、规划、写作、Codex、工作坊、审阅、资料库。设置固定在底部。

刷新和重启后恢复上次作品、工作区、场景和面板布局；若对应实体已归档或损坏，回到作品概览并说明原因。

当应用已经打开一个 Series，但没有可恢复的上次工作区状态时，默认显示 `Overview`。这里的 `Overview` 是项目概览工作区：它显示当前 Series 和 Volume、下一写作入口、真实项目进度、最近更新的 Scene、待处理 Proposal，以及已经接入真实检测来源的注意事项。恢复一个仍然有效的上次工作区状态时，仍按上一段规则返回该工作区；不能用默认 `Overview` 覆盖有效的恢复状态。

## 4. 首次启动

1. 欢迎页解释本地优先、文件为真和 AI 候选制。
2. 选择作品库目录和备份目录；二者不能是同一目录，建议不同磁盘但不强制。
3. 检查目录读写权限并创建测试文件后删除。
4. 模型连接是可跳过步骤；不连接 AI 也能完整写作和管理作品。
5. 进入作品库，可创建或导入作品。

## 5. 创建项目

### 空白开始

输入 Series 名、第一 Volume 名和可选说明；创建后直接进入第一个 Scene。高级设置使用安全默认值。

### 引导访谈

- 问题分阶段而非一次长表单。
- 每一阶段展示已提炼内容，允许修改和跳过。
- 访谈对话保存在 Workshop。
- 最终人物、设定、场景和大纲均作为 Proposal 展示，用户决定哪些进入项目。

### 导入旧稿

- 先解析并展示 `Volume / Chapter / Act / Scene` 识别树。
- 用户可调整标题层级和 Scene 分隔。
- 确认前不创建正式项目。
- 导入报告记录忽略的样式、图片和无法识别内容。

## 6. 写作工作区

```text
┌──────────────────────────────────────────────────────┐
│ Series / Volume / Chapter / Act / Scene   搜索  专注 │
├──────┬──────────────────────────────────────┬────────┤
│Scene │                                      │ 按需   │
│抽屉  │              正文编辑器              │ 抽屉   │
│可收起│                                      │ 可收起 │
├──────┴──────────────────────────────────────┴────────┤
│ 保存状态 · 字符 · 段落 · POV · 连续性提示             │
└──────────────────────────────────────────────────────┘
```

右侧抽屉标签：场景资料、Codex、AI、检查。一次只打开一个标签，避免多层面板。

右侧侧栏是包含 `Scene / Codex / AI / Check` 四个页面的容器，不得把整个侧栏称为 Scene 面板。`Scene` 页面中的 `Story changes` 标题右侧提供新增按钮；变化条目可定位正文中的对应 block，正文 block 保留折叠、编辑、排序、键盘移动和受约束的尺寸调整，删除前必须确认。

Manuscript 结构树在 `Volume / Chapter / Act / Scene` 标题上提供右键菜单，包含重命名和删除；Series 不在这里管理。菜单同时支持键盘上下文菜单入口，删除确认必须说明对象名称和级联影响。

保存状态只占用状态栏中的一个稳定位置，通过克制动画在 `Saving / Saved / Retrying / Failed` 之间切换。普通保存失败后自动重试三次，期间使用黄色 `Retrying`；全部失败后使用红色 `Failed`，不提供手动重试，直到下一次编辑触发新的自动保存节点。减少动态效果开启时改为无运动的状态切换。版本冲突保持独立可见并禁止静默覆盖。

正文内 Codex 提及预览保留原有轻量信息结构，只按新 Write 视觉语言协调外观；内容限于截至当前 Scene 和 block 有效的 Canon Description 摘要。

没有真实语义的 `Draft / Revise` 切换保持禁用并默认显示 `Draft`。参考界面中其它尚无真实接口或 Proposal 安全流程的按钮保留批准的视觉效果，但必须不可点击、可被辅助技术识别为禁用，并且不得产生模拟结果。

选择文本后出现紧凑操作条：评论、加入 Snippet、扩写、压缩、改述、自定义 Prompt。AI 操作先打开候选面板，不直接替换选区。

AI 改写候选必须直接进入正文编辑器并保持整段选中。编辑器上方只显示轻量确认条：

```text
候选待确认    保留    撤回
```

确认条不得显示调用来源、基准版本、上下文字数、调用 ID、Token 用量或其他审计字段。作者点击“保留”后才保存；点击“撤回”恢复生成前正文。

## 7. 规划工作区

- 顶部切换 Grid、Outline、Matrix、Timeline。
- 所有规划视图使用同一 `Series → Volume → Chapter → Act → Scene` 结构；不得让内部 `act/chapter` 名称决定产品标签。
- 左侧过滤条件在需要时展开。
- 任何拖动完成后显示撤销提示；失败时恢复原位置。
- 双时间线通过颜色和图例明确区分叙事顺序与故事时间。
- 多视图使用同一选择状态：在 Matrix 选择场景后切到 Grid，仍定位该场景。

## 8. Codex 工作区

- 左侧类别和过滤，中间条目列表，右侧条目详情。
- 条目详情分 Canon、Research、Details、Relations、Progressions、Mentions。
- 删除 Current Scene、Changed at position 和 Needs attention 三个 Story Lens；原区域改为使用真实归档数据的 Archived Entries 类别。过滤区删除 `In Scene`、`Changed` 和 `Watch`；`All` 只表示当前类别和搜索条件下的默认完整列表，不需要额外语义谓词。
- Category 标题的右键菜单提供 Rename 和 Delete，并支持键盘入口；删除前显示类别名称、条目影响和服务端阻断。Codex 条目界面不恢复旧 UI 的独立 Reload 控件。
- 未归档 Entry 的右键菜单提供 Archive 和 Delete；Archived Entries 中的 Entry 右键菜单提供 Restore 和 Delete。右键菜单同时支持 `Shift+F10` 或 Menu 键，永久删除必须显示对象名称、影响和服务端阻断结果。
- Details 使用按类别集中管理的详情类型；新增、删除和复用类型必须在同一处可见，不能让每个条目发明一套孤立字段。
- Details 类型管理必须使用足够大的弹窗或等价独立管理层，不得挤在条目详情内形成狭小行内表单。管理层必须能切换类别、为自定义类别创建详情类型，并标记类型是否 NSFW。
- Detail Type Library must retain the approved new-UI three-column structure:
  the left column selects a Category, the middle column lists that Category's
  Detail Types and provides the existing create control, and the right column
  edits the selected Detail Type. It must not be replaced by a two-column
  category list plus inline name-and-Add form. The right column persists the
  selected Detail Type description as real authority data. Controls whose data
  fields are not implemented remain visibly present but disabled. Rename and
  Delete are entered only from the Detail Type row context menu. Rename opens a
  focused name editor and saves through the real revision-protected backend;
  Delete uses the existing confirmation and server-owned in-use blocker. The
  selected Detail Type editor does not add duplicate Rename or Delete actions.
- 条目内每个 detail 行必须提供一个小型开关，控制该 detail 是否随当前条目进入 AI 上下文；该开关是内容选择，不应展示调用 ID、哈希或其他审计字段。
- Add Detail 在现有 Structural Details 末尾追加一行；Detail Type 单元格使用选择框，Value 单元格使用文本编辑区，第三列在创建阶段显示 Save。保存成功后该行恢复为普通 detail 行和 Send to AI 开关；验证、过期 revision 和保存错误必须就近显示。
- 已保存 detail 行的右键菜单提供 Delete，并支持键盘入口和删除确认；删除使用真实 Entry revision 写入，失败时原行保持不变。
- Detail Type 的重命名和删除操作都位于类型行的右键菜单，并支持键盘入口。重命名打开单独的名称编辑界面并使用真实 revision 写入；删除要求确认，类型仍被 Detail 使用时必须显示真实阻断，不能从界面中假删除。
- Add Relation 打开简洁的创建页面，只包含 From、To 和必填的 Simple Description；不提供 `type` 输入。关系行右键菜单只提供 Delete，不提供 Archive，删除前必须确认并显示真实引用阻断。
- `Baseline / Effective Scene` 改为 `Baseline / Current Scene`。Baseline 可编辑；Current Scene 跟随 Write 当前打开的 Scene，并只读显示该位置有效的 Canon Description 和 Details。Research 保持 Baseline，不参与切换；Current Scene 下不得显示 Canon Description 蓝色说明框。
- Mentions 页面在现有 `Manuscript mentions` 旁增加 `Codex mentions`，分别显示正文 Scene 和其他 Codex 内容对当前条目的真实提及及数量，不混成一个来源不明的列表。
- Canon Description 文本框中的 Codex 提及复用正文提及的可交互标记与预览框。在 Codex 的 Canon 页面处于 `Baseline` 模式时，弹窗显示被提及条目的 Baseline Canon Description 摘要；处于 `Current Scene` 模式时，弹窗显示被提及条目在 Write 当前 Scene 下的 effective Canon Description 摘要。弹窗不显示内部 ID 或审计字段。
- 没有可用 Write Scene 时，Current Scene 必须禁用或显示诚实的无场景状态，不能回退到伪造数据；切换工作区后仍使用共享项目会话中的当前 Write Scene。
- 当前场景时间点固定显示，查看 Progression 时可拖动叙事位置；任何有效状态查询都不得泄露未来 Scene 或 block 的变化。
- Progression 和 Mention 的 Open in Write / Open Scene 只有在存在真实目标时才启用，并导航到对应 Scene 或 block；没有目标时保留原视觉位置但语义上禁用。

## 9. Workshop

- Workshop messages use a single broad reading column. Do not alternate author and assistant messages as left/right narrow bubbles; role distinction comes from compact metadata, a restrained surface tint, and a small accent.
- Workshop message body text, attachment chips, and reasoning blocks must use a readable author-workspace scale rather than compact log typography.
- In-flight streamed replies must remain visible when the author leaves a Workshop session and returns before the stream finishes.
- Session lifecycle actions belong to the selected session row's context menu. Mouse right click, `Shift+F10`, the keyboard Menu key, and touch long press open the same focused menu; closing it restores focus to the row. The menu contains Rename, Export, Archive or Restore, and confirmed Delete, plus the visible General Chat system prompt entry only for a General Chat session. Double click never renames. The conversation header keeps Branch and removes the duplicate three-dot actions menu.
- Session filters are `All`, `Chat`, `Agent`, and `Archived`. `All`, `Chat`, and `Agent` exclude archived sessions. `Archived` contains only archived sessions, which remain readable and can be exported, restored, or permanently deleted but cannot send, edit, or resend.
- Edit and resend, Resend, Branch, and Delete turn live only in an icon-only three-dot menu at the bottom-right of each eligible message. The control has an accessible name but never displays the word `More`. Edit and resend applies only to successful General Chat author messages in `chat` sessions. Resend must make the revised author message and new assistant reply replace the old forward history in the visible conversation; old later replies, later requests, and their attachment chips must disappear after the operation. Agent sessions must not expose Edit and resend or Resend.
- Export belongs to the session area, not under every message. The export control uses separate `Include reasoning` and `Include prompt audit` checkboxes; default export is a readable chat-history Markdown file without reasoning and without prompt/context audit dumps. Enabling reasoning includes saved reasoning blocks. Enabling prompt audit includes reconstructed provider prompt/context records inside the downloaded file rather than crowding the conversation surface. Attachment chips/files are represented as file records only; attachment body text must not be dumped into the export. Downloaded Markdown must open as readable UTF-8 text in local Windows tools.
- Agent Codex tool confirmations are write gates, not help/tutorial cards. The visible confirmation appears only for server-owned `role: tool` messages such as `codex.create_entry` and `codex.update_entry`, never under every assistant reply and never by scanning assistant prose for a fake tool call. When missing reusable detail types are detected, the UI should list the draft detail labels that will be created and require one explicit confirmation before creating those detail types and the entry/update.
- 左列为对话和分支，中间为消息；不得保留常驻右侧 Context Basket 面板。
- 新会话列表项先显示中性的临时标题；首次发送后应按首条消息或附件文件名自动命名。作者从会话行上下文菜单选择 Rename 后编辑名称，保存后不再被自动命名覆盖；双击标题不得触发重命名。
- Branch 必须让作者继续看到分支点之前的聊天历史和附件名/附件上下文；新开的分支不能呈现为空白对话。
- Branch must also be available from the actions menu of each eligible settled message so the author can choose the exact divergence point. Pending messages and tool requests whose result would be excluded must not present an enabled branch action; a completed tool result is a valid divergence point when the copied protocol prefix is complete.
- 上下文选择应靠近输入区，以类似菜单的高折叠控件出现，支持 Series 正文、Series 大纲、Volume、Chapter、Act、多个 Scene、Codex 条目、按详情类型和按类别选择条目。
- Codex context grouping uses only `Codex Entries`, `Entries by Detail`, and `Entries by Category`; duplicate `Entries by Type` and unimplemented `Entries by Tag` controls are absent.
- Workshop messages never expose the removed legacy `Create Proposal` command. New Proposal creation comes only from a current, explicitly supported Proposal or approved tool workflow; existing linked Proposal cards remain readable.
- General Chat uses a `Delete turn` action on eligible author and assistant messages. The action removes the complete author/reply turn after confirmation; Agent messages and protected or incomplete turns do not expose it. After success, every removed message and message-bound attachment disappears together rather than leaving an orphan question or answer.
- 上下文菜单中的可选项必须真实可选，不得因为当前项目已有对应数据而禁用；只有当前项目确实没有该类数据时才显示不可用状态。
- 用户再次点击已选中的上下文项时必须取消选择；不应强迫用户到另一个“已选上下文”列表中删除。
- 已选上下文在菜单中的状态、输入区附近的轻量摘要和后端实际请求必须一致；用户看到什么，后台就发送什么，后台会发送什么，用户也必须看得到。
- 选择 Volume、Chapter、Act 或 Scene 后，系统应按 Codex 名称、别名、排除词和条目级上下文策略自动加入相关 Codex 条目，并立即在菜单中显示这些自动加入的条目；条目设置为不自动加入或永不提供给 AI 时不得自动加入。
- 输入区附近的模型选择器只显示模型名称。相邻的运行选项图标显示当前精确模型实际支持的流式输出和推理请求控件；不同模型可以是开关、提供商声明的强度集合、预算范围或不支持，界面不得补齐模型没有的选项。相邻的 Provider 设置图标导航到 Settings 工作区中可见标签为 `Model connections` 的页面；该页面负责凭据、服务地址和模型发现。导航发生时必须记住当前 Workshop 会话，并在 Settings 中显示一个能够返回该同一 Workshop 会话的入口。
- 当模型选择器没有任何可用连接时，Workshop 仍然允许作者创建和管理会话、编辑尚未发送的消息、使用 `Shift+Enter` 保留换行、添加附件并选择或移除上下文。模型选择器必须明确显示当前没有可用连接，并提供进入 Settings 工作区 `Model connections` 页面的真实入口。只有会启动模型调用的 `Send`、`Edit and resend`、`Resend` 和运行选项不可用；这些控件必须显示为不可操作并说明需要先配置模型，不能表现为能够点击但没有结果。与模型调用无关的 `Branch`、符合条件的 `Delete turn` 和会话生命周期操作不得因为没有模型而一起失效。
- Settings 工作区的 `Model connections` 页面必须读取资料库全局的真实模型连接，不得显示参考界面的静态连接数据。该页面必须支持创建和更新连接、读取凭据是否存在但绝不回显凭据内容、保存或替换凭据、删除凭据、发现模型、测试连接以及确认归档。尚未接入真实数据或命令的其他 Settings 页面保留批准的视觉结构，但其内容控件必须明确不可操作，不能模拟保存、测试、计数或成功结果。从 Workshop 进入该页面时，返回操作必须回到进入前的同一个 Workshop 会话。
- Workshop 上下文的验收必须覆盖一条完整链路：作者在真实界面中选择一个具体上下文项，界面摘要显示同一选择，随后发送消息，服务端保存的 Context Bundle 包含同一个上下文项，并且实际提供给模型的请求由该 Context Bundle 构建。仅验证界面勾选、仅直接调用上下文接口或仅验证服务端装配都不能单独证明这条链路。
- 当前模型的推理请求设置按 Provider 连接和精确模型名称持久化。应用重启或在模型之间来回切换时，各模型恢复自己的最后一次有效设置；若 Provider 能力变化使旧设置失效，界面改用该模型声明的默认值并明确更新控件，而不是发送无效参数。
- Workshop 只使用一个固定占位的发送控件。空闲时显示 `Send`，请求建立期间显示动画 `Sending`，整个 Provider 请求进行期间变为可操作的 `Stop`，作者点击后显示动画 `Stopping`，服务端确认取消后回到 `Send`。这四个状态在同一个位置切换；减少动态效果开启时保留状态变化但不播放运动动画。
- General Chat 和 Agent 的流式 reasoning 都必须在第一段 reasoning 到达时立即显示在回答正文上方。reasoning 默认展开，每条消息只保留一个内联箭头用于折叠或重新展开；不提供 `Show reasoning` 按钮，也不把 reasoning 操作放进消息菜单。
- Pending Agent tool request 的 `Not now` 只关闭 review 界面。它不能执行、拒绝、删除或修改该请求，再次打开时仍显示同一待确认内容。
- 角色选择器显示职责而非只显示头像。
- 会审启动前列出参与角色、预计调用和资料权限。
- 第一轮意见以独立标签展示；汇总是额外步骤。
- 消息选区可执行“提取为……”并进入 Proposal 预览。

## 10. Review

Review 的主界面不是 Proposal 管理后台。它必须优先让作者清楚看到“将要改什么”：左侧是待审临时候选，主工作区是修改前/修改后的差异，接受或拒绝后该候选离开待审队列。

- 正文：并排或行内差异。
- 结构化资料：字段、旧值、新值、生效场景和证据。
- 问题报告：严重度、证据、可能解释和建议动作。
- 证据、来源、理由和审计细节默认折叠或进入详情区，不能长期挤占差异阅读区。
- 批量操作、影响统计和工程诊断不能作为主审阅路径的常驻面板；只有在专门的批量流程中才显示。
- 任何冲突项必须从批量操作中排除并单独处理。

## 11. 资料库

- Research 页面的旧 Figma 设计和旧绑定参考中的禁用占位符已经过时，不再约束该页面。Research 使用当前代码中的共享令牌与组件，并由已安装的 UI 设计 Skill 按当前作者工作流产出具名书面清单后直接在 React 中实现。这个例外只替代 Research 页面的旧设计来源，不自动改变其它已验收页面；最终连接页面仍需作者单独进行视觉接受或拒绝。
- `Research` 是左侧主导航中位于 `Review` 之后的独立工作区，Settings 仍固定在导航底部。Research Database 属于作品库而不属于 Series，所以没有打开 Series 时仍可创建、选择和管理。打开 Series 只增加显式关联或解除关联当前知识库的动作，不改变知识库所有权。刷新和重启恢复最后打开的知识库及该知识库内最后打开的来源；对象确定不存在或损坏时回到仍可用的知识库或来源列表并显示短错误状态。来源详情的暂时读取失败不能从来源架删除仍由列表确认存在的 Source，也不能清除其持久化选择；页面必须保留来源行并提供真实的重试动作。
- 页面采用稳定的三列资料管理布局，而不是卡片仪表盘：知识库选择器位于来源架之前；左列只显示当前知识库的可滚动来源列表和上传入口；中列是选中来源的标题、解析状态、原文结构/预览与后续检索内容；右列是属性表单。切换知识库会整体替换来源架和阅读选择，不把不同知识库的来源混在一张列表中。窄屏时来源列表成为可关闭抽屉，属性区在正文之后排列或成为侧栏，不能挤压原文到不可阅读。
- 上传按钮打开真实文件选择器，只列出当前切片实际支持的格式。选择文件后显示上传/解析中的稳定行状态；成功来源立即选中；损坏、空白、过大、编码不确定或伪装格式在写入权威记录前给出作者可理解的原因。
- 可编辑属性是显示名称、作者、声明语言、标签、人工智能上下文权限和版权/使用备注。来源类型、原始文件名、文件大小、导入时间、内容哈希、解析器版本和错误详情是只读事实，默认不占据主阅读区；工程哈希只进入来源详情，不显示在列表行。
- 当前知识库的关键词搜索位于阅读区上方，结果显示来源类型、命中词语言、命中通道和可读位置，并打开包含原始证据的精确结构块，将实际命中词滚动到当前视野并只高亮该词。结果标题与高亮词必须绑定作者已经提交的查询；作者随后修改但尚未提交的输入不能改写现有结果。只有包含命中位置的来源分页实际打开后才显示成功状态；分页失败时保留来源事实、属性和搜索结果，并显示能够重新请求该分页的真实重试动作，不能把分页读取失败误判为来源权威记录消失。还没有真实命令的批量操作必须缺席或明确不可用，不能以静态计数、假进度或示例结果代替。
- 默认检索当前选中的一个知识库。未来只有在作者明确选择多个已关联知识库后才联合检索；每条结果必须显示所属知识库，联合查询不能把不同知识库的来源、权限或索引合并保存。
- 多知识库检索的范围控件位于搜索输入旁，使用带复选框的菜单并显示已选数据库数量；当前数据库默认选中，作者可选择作品库中的其它数据库，不要求它们与当前 Series 关联。切换 Source、打开 Series、刷新页面或完成上一次搜索都不能暗中扩大范围。结果点击后明确切换到所属数据库和 Source，再打开原文位置。
- 检索方式使用 `Hybrid` 与 `Exact` 两段选择。`Exact` 保留原文关键词以及作者在数据库设置中确认的别名和转写；`Hybrid` 只有在所选 Embedding profile 的中日英能力验证和数据库向量状态都通过时才增加语义召回。范围中的每个数据库分别显示 `Ready`、`Exact only`、`Indexing`、`Stale` 或 `Unavailable`，一个数据库损坏不能抹掉健康数据库结果。
- 联合结果是紧凑的证据列表而不是卡片仪表盘。每项先显示数据库、Source、位置和原文语言，再显示未翻译原文、实际命中通道和可读的分数组成。别名、转写、查询翻译和 semantic 命中必须可区分；翻译文字不能代替原文 Evidence。分页追加必须保持查询、范围、方式和索引快照一致，快照变化时要求重新搜索而不是混合两次排名。
- 原始资料、解析状态、权限和研究笔记保持清晰分区。Research 工作区使用 `Sources` 和 `Notes` 两个紧凑页签切换同一知识库的三个栏位；切换知识库会整体替换来源和笔记，不能混合展示。
- 搜索结果同时展示原文、来源位置和实际命中方式；NS-604 只显示已执行的关键词通道，不显示尚未执行的语义命中。
- 由 AI 生成的总结不能替代原文证据。
- “加入项目”从已经打开的精确原文位置创建当前 Research Database 拥有的 Research Note，或把该段证据加入当前知识库内已有的活动 Research Note。原文证据、笔记正文和新鲜度状态分别显示；归档笔记恢复前只读。
- “转入 Codex”要求已经打开 Series，并明确选择现实参考、世界规则或仅供灵感，以及现有 Codex Entry 或命名的新 Entry。现实参考和仅供灵感的目标是 Codex Research；世界规则的目标是 Canon Description。该操作只创建 Review Proposal，接受前不得改变 Codex；候选文字编辑不得反向改写笔记。
- 数据库选择器提供 `Active` 和 `Archived` 两个明确视图。数据库设置中的归档与永久删除属于危险区；有 Workshop 会话或待确认 Proposal 引用时，确认界面列出可操作的阻断原因。归档数据库保持内容可读但整个工作区只读，恢复后才重新进入检索和 Workshop 选择。永久删除必须完整输入数据库名称，成功后选择下一个活动数据库或空状态。
- Source 行的键盘可达操作菜单提供 Archive；归档视图提供 Restore 和 Delete permanently。活动 Source 还提供 Replace file 或 Refresh web snapshot 以及 Reparse current original。替换和重新解析说明会保留旧版本且 Research Note 引用不会自动改写。永久删除要求完整输入显示名称，并在有 Research Note 引用时显示必须先处理的笔记，而不是静默断开证据。
- 归档 Research Note 的操作区提供 Restore 和 Delete permanently。永久删除要求完整输入笔记标题；待确认 Proposal 会显示为阻断项。所有确认、冲突和暂时失败都保留当前行、草稿与阅读位置。窄屏使用同一操作和阻断信息，不把危险动作隐藏成无法解释的图标。

## 12. 错误与降级

- 服务不可用：显示本地恢复指引，不让页面无限加载。
- 文件损坏：显示路径、解析问题和只读原文入口。
- 索引损坏：允许继续编辑并提供重建，不显示为作品损坏。
- 自动保存失败：正文保留在内存和恢复草稿中，状态持续可见。
- 版本冲突：展示磁盘版、当前草稿和差异，禁止静默覆盖。
- 模型失败：保留输入和 Context Bundle，可重试或换模型；不创建空 Proposal。

## 13. 首版需要真实用户测试的假设

- “安静中心 + 抽屉”是否比固定三栏更适合长时间写作。
- 场景抽屉的默认宽度和层级信息量。
- Review 收件箱在大量摘要/事实 Proposal 下是否过载。
- 会审结果是先看独立意见还是先看汇总。
- 中文字符、字数和目标进度的默认展示方式。

这些属于待验证 UX，不得被实现者当成永久事实；测试结果通过 ADR 或 UX 决策记录更新。
