# Novel Studio UI 重做设计资产登记

状态：`NS-409C` 进行中  
日期：2026-06-21

本目录保存 UI 重做使用的设计资产：当前真实截图、图像模型目标稿、实现后对照截图和登记说明。

重要纠偏：`NS-409B-plan-target-v2.png` 与 `NS-409B-write-target-v2.png` 已按用户反馈标记为不采纳。原因是规划页右栏臃肿、中间卡片比例不合适；写作页左栏仍抢占正文空间，且整体没有达到已认可目标图的审美水平。后续规划页和写作页以 `NS-409C-plan-target-v1.png`、`NS-409C-write-target-v1.png` 为当前页面级目标图。

## 协作流程

1. 用真实浏览器打开页面并截图。
2. 根据源码和页面列出必须保留的按钮、输入项、状态和交互。
3. 将当前截图、功能清单和 UX 原则交给图像模型生成页面级目标图。
4. 只采纳保留功能且明显改善用户视角的目标图。
5. 用 React / CSS 落地后再次截图。
6. 将实现后截图交回图像模型审查；若建议明显改善且不破坏功能，继续迭代。

## 资产命名

- `NS-409A-<page>-current-v1.png`：本轮改动前真实截图。
- `NS-409A-<page>-target-v1.png`：图像模型目标稿。
- `NS-409A-<page>-implemented-v1.png`：本轮实现后真实截图。

## 已采纳目标图

| 页面 / 状态 | 目标图 | 必须保留功能 | 采纳状态 |
|---|---|---|---|
| 全局视觉方向 | `NS-409A-global-direction-v1.png` | 统一色彩、留白、边框、按钮和工作台气质 | 已采纳为方向，不作为具体页面模板 |
| 概览 | `NS-409A-overview-target-v1.png` | 导航、作品切换、搜索、指标、最近场景、下次继续 | 已采纳 |
| 规划 | `NS-409A-plan-target-v1.png` | 四视图切换、场景卡、移动按钮、右侧规划面板 | 已采纳 |
| 写作 / AI 候选 | `NS-409A-write-target-v1.png` | 作品结构、编辑器、右侧抽屉、AI 审阅、候选待确认条 | 已采纳 |
| 设定库 | `NS-409A-codex-target-v1.png` | 类别、搜索、新建条目、详情区域和未来进展 / 角色所知空间 | 已采纳 |
| 编辑室 / 待确认 | `NS-409A-workshop-review-target-v1.png` | 角色列表、资料范围、对话入口、待确认收件箱空间 | 已采纳 |
| 设置 / 模型连接 | `NS-409A-settings-target-v1.png` | 新增连接、服务、模型列表、地址、获取模型、密钥、测试、高级信息 | 已采纳 |
| 规划 / 故事板重做 | `NS-409C-plan-target-v1.png` | 左侧层级树、中间场景卡、右侧轻量检查栏、四视图切换、规划摘要与分叉动作 | 已采纳为当前实现模板 |
| 写作 / 主编辑区重做 | `NS-409C-write-target-v1.png` | 左侧作品结构、当前章节新场景、新部、各层级新增入口、中央 Markdown 正文、保存与字数状态 | 已采纳为当前实现模板 |
| 规划 / 实现复查 | `NS-409C-plan-review-target-v1.png` | 降低右侧动作按钮和场景卡选中态的视觉重量 | 已采纳：按钮减重、卡片选中态降噪 |
| 写作 / 实现复查 | `NS-409C-write-review-target-v1.png` | 让标题与正文更接近文学稿纸，而不是后台黑体界面 | 已采纳：正文与标题改为书面稿纸字体 |

## 不采纳目标图

| 页面 / 状态 | 文件 | 不采纳原因 |
|---|---|---|
| 规划 | `NS-409B-plan-target-v2.png` | 右侧栏仍偏臃肿，中间卡片与空白比例不理想；不作为后续实现依据。 |
| 写作 | `NS-409B-write-target-v2.png` | 左侧结构栏仍压迫正文，整体不像安静的写作界面；不作为后续实现依据。 |

## 当前截图清单

当前截图来自 Playwright 真实浏览器运行：`NS-409A-current-screenshot-manifest-v1.json`。

本轮至少保留以下页面和状态的现状图：

- 概览：`NS-409A-overview-current-v1.png`
- 规划：`NS-409A-plan-grid-current-v1.png`、`NS-409A-plan-outline-current-v1.png`、`NS-409A-plan-matrix-current-v1.png`、`NS-409A-plan-timeline-current-v1.png`
- 写作：`NS-409A-write-main-current-v1.png`、`NS-409A-write-focus-current-v1.png`、`NS-409A-write-context-current-v1.png`、`NS-409A-write-ai-panel-current-v1.png`、`NS-409A-write-ai-review-current-v1.png`、`NS-409A-write-candidate-current-v1.png`
- 设定库：`NS-409A-codex-current-v1.png`
- 编辑室：`NS-409A-workshop-current-v1.png`
- 待确认：`NS-409A-review-current-v1.png`
- 设置：`NS-409A-settings-model-profile-current-v1.png`、`NS-409A-settings-deepseek-current-v1.png`、`NS-409A-prompt-preview-current-v1.png`
- NS-409C 清理后基线：`NS-409C-plan-current-v1.png`、`NS-409C-write-current-v1.png`

## NS-409C 实现后截图

- 规划：`NS-409C-plan-implemented-v1.png`
- 写作：`NS-409C-write-implemented-v1.png`

本轮已修正：

- 移除未跟踪的第二套 `ui-foundation.css` 覆盖层，避免样式来源混乱。
- 规划页从“标题 + 单张卡 + 右侧表单”改为“标题区 + 三栏工作台”。
- 写作页验收改为先输入真实中文正文再截图，不再用空白正文状态评价写作界面。
- 写作页标题与正文改为书面稿纸字体，降低后台系统感。
- 规划页右侧动作按钮与场景卡选中态降噪。

仍有差异：

- 规划页尚未实现目标图中的底部“新建场景”工作台入口；当前仍依赖写作页层级入口创建场景。
- 写作页左侧结构栏的新增按钮仍偏表单化，后续应继续按复查图收敛为更轻的辅助操作。

## NS-409D 宽屏与三页面复查

日期：2026-06-21  
触发原因：用户在高分辨率截图中指出写作页正文与作品结构之间出现异常空白，设定库和编辑室仍有大量无意义留白，且此前 UI 调整没有真正改变页面骨架。

### 保存资产

- 页面级目标图：
  - `NS-409D-write-wide-target-v1.png`
  - `NS-409D-codex-wide-target-v1.png`
  - `NS-409D-workshop-wide-target-v1.png`
- 图像模型复查目标图：
  - `NS-409D-wide-review-target-v1.png`
- 最终实现截图：
  - `NS-409D-write-wide-implemented-v1.png`
  - `NS-409D-codex-wide-detail-implemented-v1.png`
  - `NS-409D-codex-wide-progressions-implemented-v1.png`
  - `NS-409D-workshop-wide-implemented-v1.png`

### 本轮已采纳

- 写作页取消正文区在宽屏下自动居中漂移，正文从作品结构右侧自然展开。
- 设定库在浏览器验收中创建真实条目和进展记录后截图，不再用空库状态冒充详情页验收。
- 设定库条目列表收窄，详情区、此刻有效、标签页和进展记录改为更受控的宽度。
- 进展记录改为左侧记录表单、右侧历史列表，避免输入框横向摊满屏幕。
- 编辑室改为三栏工作台：左侧编辑角色，中间讨论区，右侧上下文范围和小贴士。
- Playwright 验收新增 `1920x1080` 宽屏截图，覆盖写作、设定库详情、设定库进展记录和编辑室。

### 仍需后续收敛

- `NS-409D-wide-review-target-v1.png` 中的设定库更紧凑，后续可继续把详情区整理为“概要卡 + 记录流”，减少顶部大表单感。
- 编辑室当前已经有三栏骨架，但中间讨论区仍是未接模型前的空状态；真实对话接入时应继续按复查图补足“本次讨论”区域。
- 写作页右侧留白现在属于阅读空间，不再是结构栏与正文之间的布局漂移；若后续接入右侧抽屉，应继续验证宽屏状态。

## NS-409E 规划页宽屏过渡修正

日期：2026-06-21  
触发原因：用户指出规划页在高分辨率下与写作页一样存在横向空间利用不合理的问题；故事板、大纲、追踪表、时间线都不能只按窄屏或单一状态验收。此前曾错误生成一张“大纲 / 追踪表 / 时间线”合并目标图，已从项目目录移除，不作为实现依据。

### 严格采用的页面级流程

- `故事板`、`大纲`、`追踪表`、`时间线` 分别使用真实当前截图作为输入。
- 四个状态分别生成目标图，不再把多个子页面合成到一张图片。
- 图像模型只提供视觉模板；功能入口以源码和本文件清单为准。
- 实现后重新运行 Playwright，保存四张 `1920x1080` 实际截图。

### 保存资产

| 子页面 | 当前真实截图 | 图像模型目标图 | 实现后截图 |
|---|---|---|---|
| 故事板 | `NS-409E-plan-grid-wide-current-v1.png` | `NS-409E-plan-grid-wide-target-v1.png` | `NS-409E-plan-grid-wide-implemented-v1.png` |
| 大纲 | `NS-409E-plan-outline-wide-current-v1.png` | `NS-409E-plan-outline-wide-target-v1.png` | `NS-409E-plan-outline-wide-implemented-v1.png` |
| 追踪表 | `NS-409E-plan-matrix-wide-current-v1.png` | `NS-409E-plan-matrix-wide-target-v1.png` | `NS-409E-plan-matrix-wide-implemented-v1.png` |
| 时间线 | `NS-409E-plan-timeline-wide-current-v1.png` | `NS-409E-plan-timeline-wide-target-v1.png` | `NS-409E-plan-timeline-wide-implemented-v1.png` |

### 本轮已修正

- 规划页外层不再锁死在窄宽度，主区域与右侧检查器按宽屏重新分配。
- 故事板改为“结构树 + 主场景区 + 右侧检查器”的宽屏布局，减少右侧无意义空白。
- 大纲增加表头和三列信息结构，避免整页只是一组巨大横条。
- 追踪表占用主工作区宽度，筛选按钮和矩阵区不再挤在左侧。
- 时间线改为左右双列主区，未放置场景与新建事件在同一宽屏工作区内排列。
- Playwright 验收新增并保存四个规划子页面的 `1920x1080` 截图。

### 重要结论：这不是 UI 验收通过版本

NS-409E 只能视为 M3 到 M4 之间的宽屏结构过渡版，不能当作最终 UI 通过验收。当前仍存在的问题包括但不限于：

- 字体选择和字号层级仍不连贯，有的标题偏大偏重，有的说明文字又偏弱。
- 页面设计语言仍不够统一；边框、阴影、圆角、按钮重量还没有形成稳定系统。
- 故事板和追踪表在测试数据较少时仍会显得空，需要后续为空状态和多数据状态分别设计。
- 规划页四个子页面只是修正了“宽屏结构和明显空白”，还没有达到图像模型目标图的完整精致度。
- 当前实现仍应被标记为“可继续开发的过渡版本”，不能作为 M4 或最终 UI 质量标准。

## 实现后截图清单

实现后截图来自 Playwright 真实浏览器运行：`NS-409A-implemented-screenshot-manifest-v1.json`。

本轮已保存与当前截图一一对应的实现后截图：

- 概览：`NS-409A-overview-implemented-v1.png`
- 规划：`NS-409A-plan-grid-implemented-v1.png`、`NS-409A-plan-outline-implemented-v1.png`、`NS-409A-plan-matrix-implemented-v1.png`、`NS-409A-plan-timeline-implemented-v1.png`
- 写作：`NS-409A-write-main-implemented-v1.png`、`NS-409A-write-focus-implemented-v1.png`、`NS-409A-write-context-implemented-v1.png`、`NS-409A-write-ai-panel-implemented-v1.png`、`NS-409A-write-ai-review-implemented-v1.png`、`NS-409A-write-candidate-implemented-v1.png`
- 设定库：`NS-409A-codex-implemented-v1.png`
- 编辑室：`NS-409A-workshop-implemented-v1.png`
- 待确认：`NS-409A-review-implemented-v1.png`
- 设置：`NS-409A-settings-model-profile-implemented-v1.png`、`NS-409A-settings-deepseek-implemented-v1.png`、`NS-409A-prompt-preview-implemented-v1.png`

## 图像模型复查

实现后截图交给图像模型后，生成了复查优化稿：`NS-409A-implemented-review-target-v1.png`。

本轮采纳了其中“不让标题过重、统一卡片和按钮、让写作中心更安静”的方向，并已继续收敛标题权重和尺寸。复查稿中更大规模的页面重排暂不继续展开，避免把 `NS-409A` 变成无边界的全应用重写；后续 UI 任务若继续调整，应以这张复查稿为下一轮参考，而不是回到实现者主观判断。

## 本轮取舍

- 目标图只决定视觉方向和层级，不改变产品功能。
- 图像模型漏掉的功能不得被实现遗漏；以本文件的功能清单和源码交互为准。
- 主路径不展示调用 ID、哈希、基准版本、凭据引用、Token 用量等审计字段。
- 设置页主视觉只展示用户当下要做的事；更细的连接能力和凭据引用留在“高级信息”。
- 写作候选确认条只显示“候选待确认 / 保留 / 撤回”。
