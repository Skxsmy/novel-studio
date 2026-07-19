# Novel Studio 完整产品规格

状态：权威规格  
版本：1.0  
日期：2026-06-19

本文档保存产品讨论中已经确定的完整意图。它回答的不是“下一步写什么代码”，而是“最终产品必须成为什么、为什么这样设计、用户应感受到什么”。任何实现若与本文档冲突，必须先记录 ADR 并获得用户确认，不能由开发者或 AI 自行改变产品方向。

## 1. 产品定义

Novel Studio 是一个面向个人中文小说作者的本地优先小说创作应用，主要服务长篇和系列小说。

它不是聊天框外面套一层文本编辑器，也不是 Novelcrafter 的界面复制品。它借鉴 Novelcrafter 将故事结构、正文、世界观和 AI 上下文联系起来的思路，并进一步形成：

> 本地小说工作台 + 结构化故事数据库 + 多角色 AI 编辑团队 + 可审计上下文系统 + 证据化资料分析库。

产品必须让作者在两个状态之间自然切换：

- **安静写作**：界面退后，作者只面对正文。
- **深度协作**：规划、Codex、研究资料、多个编辑角色和连续性证据随叫随到。

成功体验不是“AI 写得很多”，而是：

1. 作者能快速找到下一步要写什么。
2. 长篇中的人物、事实、伏笔和时间状态不会失控。
3. AI 明确知道当前场景该看什么、不该知道什么。
4. AI 的建议可解释、可拒绝、可比较，不会偷偷改变作品。
5. 即使停止使用应用，作者仍拥有可直接阅读和迁移的全部原稿。

## 2. 目标用户与创作方式

### 2.1 主要用户

- 使用中文写作的个人小说作者。
- 主要创作单部长篇、多卷长篇或共享世界观系列。
- 采用“规划 + 探索”混合方式：会设计人物、主线和关键节点，也允许正文中的真实发现反过来修改大纲。
- 希望 AI 共同创作，但不愿把最终决定权让给 AI。
- 可能使用 Word 修改和交稿，可能导入多语言小说或研究报告作为参考。
- 不应被要求理解数据库、Git、API 或 Markdown 才能正常写作。

### 2.2 次要用户情形

- 导入已有初稿后补建结构和 Codex。
- 从空白项目通过创作访谈形成故事圣经与初始大纲。
- 直接进入空白正文，写到需要时才补规划资料。
- 将其他 AI 或人工完成的研究报告导入资料库后继续提炼。

### 2.3 暂不服务的情形

- 实时多人共同输入同一文档。
- 在线 SaaS、团队账户和组织权限管理。
- 短篇发布平台、社交社区或公共提示词市场。
- 最终印刷排版、电子书发行和销售管理。

## 3. 不可违背的产品原则

### P-01 作者主权

AI、资料导入、批量替换和连续性分析都只能提出候选变更。正文、摘要、人物状态、关系、伏笔和 Canon 必须由作者确认后改变。

可以自动写入的内容仅限机械事实：

- 字符数、段落数和文件大小。
- 保存时间、文件哈希和 revision。
- 明确的名称提及索引。
- 可从权威文件完全重建的缓存与索引。

### P-02 文件为真

项目目录中的结构化 JSON 文件是作品的权威数据。SQLite、向量索引和搜索缓存必须可以删除并重建。作者不应因为数据库损坏而失去小说。Markdown 和 Word 是导入、导出、镜像和迁移边界格式，不能再被默认视为内部正文权威格式。编辑器运行时 JSON、浏览器 localStorage、缓存和索引数据库都不是权威；只有带 `schemaVersion`、可校验、可迁移并通过原子写入保存的项目 JSON 文件才是权威副本。

归档只用于从日常工作流隐藏数据，不能作为唯一的删除方式。凡是提供归档的对象，都必须在产品设计中提供用户可理解的清理/永久删除手段；若对象仍被历史记录、上下文快照、调用日志、关系或证据引用，界面必须说明阻止原因或先保留必要快照后再允许清理。长期使用不能依赖无限堆积归档数据。

### P-03 上下文透明

任何 AI 调用都必须允许作者检查：

- 调用了哪个角色和模型。
- 使用了哪个提示词版本和参数。
- 发送了哪些正文、Codex、摘要、风格和研究片段。
- 哪些资料因时间、权限或隐私规则被排除。
- 预估与实际用量。

### P-04 故事时间敏感

AI 在某场景工作时只能看到截至该叙事位置有效的状态。未来剧情、未来 Progression 和角色尚未知晓的信息默认不可见。

### P-05 本地优先与隐私

首版在单台 Windows 电脑运行，只监听 `127.0.0.1`，无遥测、账户和云同步。应用核心在断网时仍能写作、规划、搜索和管理资料；模型联网只来自作者显式选择的 Provider 调用，不存在自动联网或静默回退。

### P-06 中文创作优先

应用界面、内置角色、默认提示词和正文工具以中文写作为中心。参考资料可为任意语言，分析结果默认用中文呈现并保留原文定位。中文作者必须能够用中文查询召回语义相关的日文、英文及其它已支持语言原文，而不是只能用资料原语言重复关键词；跨语言命中必须显示命中方式、原文语言和原文证据位置。机器翻译、转写和语义相似都是派生检索辅助，不能替代原文、伪装成直接引文或静默写入 Canon。

固定层级名称是明确例外：无论界面语言如何，作者视角都使用英文 `Series → Volume → Chapter → Act → Scene`，不得翻译、调序或替换为内部存储字段名。

### P-07 AI 不应一味附和

“更换人格”不是装饰。不同编辑必须具有不同职责、评价标准、可见资料和反对义务。重要会审第一轮相互隔离，不得先看其他编辑的结论再形成意见。

### P-08 渐进呈现复杂度

高级时间线、角色知识、Progression、提示词组件和模型路由必须可选。应用不能强迫作者在写第一段正文前填完整套表格。

### P-09 诚实能力边界

未实现、未配置或无法可靠完成的能力必须明确标注。不得伪造联网研究、来源、模型调用或“自动连续性检查”。

### P-10 用户视角与视觉质量

界面首先服务作者的写作感受，而不是展示工程实现。作者不应在主工作流中被迫理解调用 ID、基础版本、来源哈希、上下文来源、内部任务名或数据库状态。此类信息必须可审计，但应进入专门记录、详情页或调试视图，不能抢占写作、规划和审阅主界面。

主界面必须简洁、大气、克制且有明确审美取向。Novel Studio 可以参考“战术终端 / 明日方舟式”的硬朗、干净、清晰层级感：明确边界、紧凑操作、适度高对比、充足留白和少量强调色。但不得照搬任何商业作品的具体素材、图标、字体或受保护视觉元素。

中文文案必须自然、准确，避免翻译腔、过度简化、牵强比喻和不恰当动词。除必要技术名词、模型名、文件格式以及固定层级标签 `Series / Volume / Chapter / Act / Scene` 外，不应中英文混搭。按钮和状态文案必须从作者动作出发，例如“保留 / 撤回 / 开始审稿 / 生成改写”，而不是“提交任务 / 应用补丁 / 来源调用”。

主界面不得用说明文字填满空间。Novel Studio 不是操作手册，写作和规划区域应优先留给正文、结构和用户决策。功能提示只能以 placeholder、tooltip、短空状态、必要错误提示或帮助页的形式存在；输入框 placeholder 必须是淡色提示，用户输入后立即消失。

### P-11 统一视觉语言

全应用必须共享同一套视觉系统。颜色、字体、间距、按钮、卡片、表单、抽屉、提示条和状态反馈应在不同页面保持一致；不得因为一个功能由不同 AI 或不同时间实现，就出现互不相干的页面风格。

新增功能若需要新的 UI 形态，必须先说明它与现有视觉系统的关系：复用哪个组件、扩展哪个模式、是否需要新增设计令牌。不得在业务组件中临时堆叠一次性样式，造成后续页面越来越割裂。

前端结构必须服务长期维护。禁止依赖一份全局大 CSS 或单个大页面组件承载所有视觉和业务逻辑。界面应由稳定的设计令牌、基础组件、业务域页面和独立 API 层组合而成。后续修改风格时，应优先修改 tokens 与共享组件，而不是逐页修补。

## 4. 产品范围总览

### 4.1 必须完成的核心闭环

```text
创建/导入作品
    → 规划故事与场景
    → 编写正文
    → 调用 AI 生成候选稿或编辑意见
    → 审核差异与证据
    → 确认场景摘要及故事状态变化
    → 更新 Codex、时间线和伏笔
    → 继续写作或修订
    → Word/Markdown 导出与外部修改往返
```

任何“第一版完成”的声明都必须证明上述闭环可以端到端运行，不能只证明各页面存在。

### 4.2 顶层工作区

1. **Library / 作品库**：Series、Volume、归档、最近项目和全局设置。
2. **Overview / 概览**：项目进度、最近场景、待处理 Proposal、连续性警告和下一写作入口。
3. **Plan / 规划**：Grid、Outline、Matrix、叙事顺序和故事时间。
4. **Write / 写作**：结构化 block 正文、场景节拍、Sections、局部 AI 操作和专注模式。
5. **Codex / 故事记忆**：人物、地点、物件、设定、组织、情节线、关系和 Progression。
6. **Workshop / 工作坊**：持久对话、编辑角色、会审、折叠式上下文选择和对话提取。
7. **Review / 审阅**：候选正文、候选事实和连续性问题的待审队列，主路径聚焦修改前后差异；批量和审计信息不得挤占主审阅界面。
8. **Research / 资料库**：导入资料、证据化检索、研究笔记和来源权限。
9. **Settings / 设置**：作品库、备份、模型、角色、提示词、隐私和用量控制。

## 5. 作品与系列

### FR-PROJECT-01 作品库

- 首次启动选择作品库与独立备份目录；不能默认要求放在代码仓库中。
- 可创建多个 Series；每个 Series 可包含多个 Volume。
- 最近打开项目、最后修改时间和待处理事项可见。
- 删除项目必须先进入 Trash / 回收站；回收站项目默认从日常列表隐藏，但可恢复。
- 永久删除项目会删除项目目录及其权威文件，必须在确认弹窗中完整输入项目名称，且服务端必须再次校验名称一致后才允许执行。
- 归档、回收站或隐藏状态不能成为唯一清理手段；界面必须提供可理解的恢复与永久删除路径。

### FR-PROJECT-02 创建入口

创建作品时提供三条平等路径：

1. **空白开始**：立即进入第一场景，不强制访谈。
2. **引导访谈**：围绕题材、核心承诺、主题、人物、冲突和关键节点逐步提问；每一步都可跳过；结果作为候选故事圣经和大纲。
3. **导入旧稿**：解析 Markdown 或 DOCX，预览 `Volume / Chapter / Act / Scene` 识别结果后建立项目。

### FR-PROJECT-03 层级

固定结构为：

作者视角的固定层级为：

`Series → Volume → Chapter → Act → Scene`

Library 位于 Series 之上，Manuscript 与 Sections 属于 Scene。所有五个层级标签始终使用以上英文，不得翻译或重排。

- 所有实体使用稳定 UUID；名称和位置不是身份。
- 改名、重排或跨 Act 移动 Scene 不得破坏 Codex、Evidence、Proposal 和时间线引用。
- Series 共享 Codex；Volume 可增加本卷资料或从指定 Scene 起覆盖状态。
- Write 的 Manuscript 结构树只为 `Volume / Chapter / Act / Scene` 提供标题右键菜单，菜单包含重命名和删除；删除必须先显示命名对象及级联影响的确认界面。Series 的创建、重命名和删除由其它项目入口负责，不得放入 Write 结构树菜单。

## 6. 规划系统

### FR-PLAN-01 Scene 是规划核心

每个 Scene 可包含：

- 标题、状态、标签和叙事顺序。
- 所属 Volume、Chapter 和 Act。
- POV、地点、出现人物和相关情节线。
- Scene 目标、冲突、结果和 Scene Beats。
- 作者摘要与经确认的 Scene 摘要。
- 故事时间、持续时长和时间精度。
- 计划字数、实际字符数和修订状态。

场景字段必须渐进呈现；只填标题和正文也能工作。

### FR-PLAN-02 Grid

- 卡片按 Chapter 和 Act 分组，支持拖动排序和跨 Act 移动。
- 卡片显示作者选择的字段，不强制固定信息密度。
- 可筛选 POV、人物、地点、标签、状态和情节线。
- 批量移动或改状态前显示影响预览。

### FR-PLAN-03 Outline

- 线性展示 Volume、Chapter、Act、Scene 和摘要。
- 可折叠层级、快速编辑标题和摘要。
- 支持只看主线或指定人物/情节线相关场景。

### FR-PLAN-04 Matrix

- 行列可在场景、人物、情节线、主题、地点和标签间组合。
- 用于回答“某条线在哪些场景推进”“某人物消失了多久”等问题。
- 矩阵单元格来自同一权威数据，不维护第二份规划数据。

### FR-PLAN-05 双时间线

- **叙事顺序**决定读者看到场景的先后，也是 Progression 默认生效轴。
- **故事时间**表示世界中事件实际发生的时刻，用于倒叙、插叙、并行事件和时间矛盾检查。
- 未知或模糊时间允许使用相对顺序与精度标记，不能强迫填写现实日期。

### FR-PLAN-06 计划与正文分叉

当已确认正文与场景目标、节拍或摘要明显不一致时，系统提出分叉提示，作者可：

1. 更新后续规划以接受新方向。
2. 标记为有意偏离，不再提示。
3. 保留规划并进入正文修订。

系统不得自动选择哪一边“正确”。

## 7. 正文写作

### FR-WRITE-01 编辑体验

- 中央为结构化 block 正文编辑器；作者编辑的是正文语义块，Markdown 只作为导入、导出、镜像和兼容投影格式。
- 左侧场景抽屉和右侧资料/AI 抽屉默认可收起。
- 专注模式只保留正文、标题和必要保存状态。
- 面板宽度、开关状态和最近工作区按设备记忆。
- 自动保存必须明确显示保存中、已保存、失败和冲突状态。
- Write 状态栏的自动保存反馈使用同一紧凑位置切换 `Saving / Saved / Retrying / Failed`，不得横向平铺多个状态。普通保存失败后自动重试三次，重试期间显示黄色 `Retrying`；三次重试均失败后显示红色 `Failed`，不提供手动重试，也不继续后台循环。只有下一次正文或标题变更形成新的自动保存节点时，才开始新的保存与重试循环。版本冲突不按普通失败重试，必须保持独立且持续可见的冲突状态。
- 自动保存状态切换使用克制动画并服从减少动态效果设置；动画不能改变状态栏占位尺寸或干扰正文布局。
- 正文中的 Codex 提及可打开轻量预览；预览只显示截至当前 Scene、当前 block 位置有效的 Canon Description 摘要，不泄露后文 Progression。既有预览交互和信息范围保留，视觉样式与当前 Write 视觉系统协调。
- Write 参考设计中的 `Draft / Revise` 在没有真实模式语义前保持不可操作，默认固定为 `Draft`。其它尚无真实接口或安全流程的参考控件保留已批准的视觉位置，但必须语义和交互上禁用。

### FR-WRITE-02 JSON block document 与格式

- 权威正文保存为结构化 `SceneBlockDocument`，该结构必须位于项目 JSON 权威文件中，不保存编辑器私有运行时状态作为唯一副本。
- 现有测试 Markdown 数据可以迁移或重新生成；兼容读取旧 Markdown 只作为导入/迁移路径，不再约束内部权威格式。
- Markdown/Word 是导入导出格式；完整 Markdown/Word 回导必须经过预览和确认，不能直接覆盖内部 block document。
- JSON 权威迁移不得被实现为前后端公共接口的全面破坏性重写；现有前端正在使用的场景读写 API 应通过服务端投影/转换适配继续工作，直到对应界面迁移到 block document API。
- 支持段落、强调、场景分隔符、标题、列表、链接和基础引用。
- 中文段首、引号和出版样式属于显示/导出主题，不通过破坏原文的空格硬编码实现。

### FR-WRITE-03 中文工具

- 中文字符、非空字符、段落和章节总量统计。
- 全角/半角、成对引号、重复标点和常见标点位置检查。
- 人名、地名和专有名词一致性检查。
- 全局搜索与预览式替换；不允许无预览覆盖全书。

### FR-WRITE-04 Scene Beats

- Beats 是作者对当前场景接下来发生什么的意图，不是最终正文。
- 可手工添加、排序、完成和跳过。
- AI 生成正文时明确标注使用了哪些 Beats。
- 生成后 Beats 不自动删除；作者决定完成、保留或改写。

### FR-WRITE-05 AI 正文操作

支持：

- 从 Beats 起草场景。
- 从光标续写。
- 对选区扩写、压缩、改述、增强动作、调整对话、改变叙述距离。
- 生成多个候选版本并并排比较。
- 按自定义提示词执行文本替换。

所有结果先进入候选视图，展示原文、候选文本、模型、角色、提示词版本和上下文摘要。接受后创建快照再写入。

### FR-WRITE-06 Sections

正文场景可关联但不导出为正式小说的区段：

- 作者备注。
- 候选版本。
- 研究材料。
- 敏感或禁止发送给 AI 的资料。
- 程序或 AI 生成的临时内容。

Sections 使用独立文件和权限元数据，不混入正文后再靠隐藏样式遮蔽。

### FR-WRITE-07 Snippets 与参考

- 保存项目内自由笔记、清单、语句碎片和临时构思。
- 可钉到编辑器旁边或加入 Workshop 上下文。
- Snippet 默认不是 Canon，也不自动提供给 AI。

### FR-WRITE-08 Codex Progression Blocks

- 写作正文可插入 Codex Progression block，用来记录某个场景位置起生效的 Canon Description、Detail、世界事实或关系变化。
- 变化 block 必须引用统一 JSON Progression 记录；删除正文 block 时同步删除该记录，若历史引用阻止硬删，界面必须说明阻止原因。
- Progression block 可折叠、展开、编辑和删除；专注模式中默认以不打断写作的折叠状态存在。
- 右侧管理面板可按当前场景 block 顺序列出变化，点击后定位到正文 block，并与正文 block 编辑保持同步。
- 新建 Story Change 的入口位于 Write 右侧侧栏的 `Scene` 页面内，并放在 `Story changes` 标题右侧；不得改为正文块之间的新增按钮。
- Story Change 保留既有的排序、键盘移动、折叠/展开、编辑、尺寸调整和正文定位能力，并按新 Write 视觉语言重新设计；删除前必须二次确认。
- 这些 block 不得污染普通 Markdown 导出正文；导出时可作为可选注释或附录处理。

## 8. Codex 与故事状态

### FR-CODEX-01 类别

内置人物、地点、物件、世界设定、组织和情节线；用户可创建自定义类别。类别决定默认图标和可复用详情类型的默认集合，但不限制作者继续自定义。

### FR-CODEX-02 条目内容

每个条目可包含：

- 名称、别名、缩略图。
- Canon Description。
- 与 Canon 分离的 Research。
- 按类别集中管理并可复用的自定义详情类型，例如人物的年龄、样貌、阵营或地点的布局、禁忌。详情类型必须可在集中管理界面中添加、删除，并可标记为 NSFW。
- AI 上下文策略。
- 每个条目的每个详情值都必须有独立开关，决定该详情是否随该条目发送给 AI；条目级 AI 上下文策略和资料权限仍然优先约束整体可见性。
- 提及规则和排除词。
- Relations、Progressions 和 Evidence。
- 条目的正常生命周期入口位于条目右键菜单：未归档条目提供 Archive 和 Delete，归档条目提供 Restore 和 Delete；永久删除必须二次确认并遵守引用阻断。
- Archived Entries 是真实条目类别，必须可发现、恢复和永久删除归档条目，不能以 Story Lens 或静态计数替代。
- 新增结构化 Detail 时，在现有详情列表末尾追加一行：先选择 Detail Type、填写 Value 并保存；保存后该行恢复为普通详情行并显示独立的 Send to AI 开关。
- Category 的 Rename/Delete 和已保存 Detail 的 Delete 都使用对应标题或行的右键菜单，并支持键盘上下文菜单入口；永久删除必须确认并遵守真实引用阻断。
- Codex 条目列表不提供独立 Reload 操作；保存冲突仍禁止覆盖，请求失败仍就近显示错误，但不增加旧 UI Reload 控件。
- Canon Description 中对其他 Codex 条目的提及必须具有与正文提及一致的可交互标记和摘要预览。在 Codex 的 Canon 页面处于 `Baseline` 模式时，弹窗显示被提及条目的 Baseline Canon Description 摘要；处于 `Current Scene` 模式时，弹窗显示被提及条目在 Write 当前 Scene 下的 effective Canon Description 摘要。

Reusable Detail Type authority stores a stable identifier, category, display
name, author-written description, NSFW state, timestamps, and revision. The
description explains what the reusable field means; it is not an Entry Detail
value and is never synthesized from the display name. Existing version 1
Detail Type files project an empty description until an explicit version 2
migration or author save writes the new field.

Detail Type Rename and Delete are available only from the keyboard-reachable
context menu on the corresponding Detail Type row. Rename uses the current
Detail Type revision, rejects a duplicate display name in the same Category,
and atomically moves any legacy Entry Detail and per-Detail context-policy keys
from the old display name to the stable Detail Type identifier. If both keys
exist with different values, Rename fails without changing any authority file.
Delete retains confirmation and the server-owned in-use blocker.

### FR-CODEX-03 提及

- 正文提及通过名称和别名索引，可设置大小写、自动复数和排除词。
- Mentions 必须区分 `Manuscript mentions` 与 `Codex mentions`：前者来自正文 Scene，后者来自其他 Codex 内容对当前条目的提及。
- 自动提及只说明文本出现过，不代表条目参与了场景或某事实已经成立。
- 作者可手工添加场景关联。

### FR-CODEX-04 上下文策略

每个条目提供：

- 总是包含。
- 当前文本或场景提及时包含。
- 不自动包含，但允许主动选择。
- 永不提供给 AI。

来源权限和资料级 `never` 规则仍可进一步阻止发送。

### FR-CODEX-05 Relations

- 关系权威由来源条目、目标条目、方向、描述、证据和有效区间组成；作者界面不要求或展示关系 `type`。
- 新建关系必须明确选择 From、To 并填写简短描述；From → To 表示默认方向，复杂关系由自然语言描述表达。
- “甲信任乙”和“乙信任甲”不能默认视为同一关系。
- 关系变化通过 Progression 表达，不覆盖历史。
- 作者界面的关系生命周期只提供永久删除，不提供归档；删除必须二次确认，并在 Progression、知识、证据或其它权威引用仍存在时由服务端阻断。

### FR-CODEX-06 Progression

- Progression 是统一 JSON 权威系统，保存于 `codex/progressions/<progressionId>.json`。旧 `codex/progressions/<progressionId>.yaml` 格式退役，不能再作为运行时权威或新功能约束。
- v1 只支持 `add` 与 `replace`。`add` 表示从指定场景或 block 位置起增加内容；`replace` 表示从指定场景或 block 位置起替换此前状态。
- Progression target 可以是 Canon Description、稳定 detail type ID、世界事实条目或关系。
- 默认沿叙事顺序生效；故事时间用于矛盾检测，不自动改写叙事知识状态。
- 对 Canon Description 和 Detail 的 target，空 `replace` 表示清空并在悬浮预览、Context Builder 和 AI 上下文中隐藏该字段。
- 同一 Scene 内，来自 Write block 的 Progression 必须按 block 顺序生效；查询某个 block 位置时，只能看到当前位置之前或当前位置自身已经生效的变化。
- 后文 Progression 不能向早期场景、早期 block、悬浮预览或 AI 上下文泄露正文、摘要或内部 ID；最多返回隐藏数量。
- Codex 主页面以 `Baseline` 和 `Current Scene` 明确区分初始设定与当前叙事位置的有效状态。Baseline 可编辑；Current Scene 跟随 Write 当前打开的 Scene，并以只读方式投影 Canon Description 和 Details。Research 始终显示 Baseline，不随该切换改变。

### FR-CODEX-07 世界真相与角色知识

- 世界事实表示“实际发生或成立什么”。
- 角色知识表示“角色从何场景起知道、相信或误解什么”。
- POV 写作上下文只能看到该角色当时可知的内容，除非作者显式允许全知视角。

### FR-CODEX-08 情节线与伏笔

- 情节线记录承诺、推进、反转、回收、放弃和状态。
- 未回收伏笔、长期未推进的承诺和相互矛盾的回收状态进入 Review。
- 读者反馈类角色可以评价读者是否会忘记某线，但不能自动关闭它。

## 9. AI 编辑团队

完整行为见 `AI_EDITORIAL_SYSTEM.md`。产品必须支持用户创建、修改、归档和版本化角色与 Prompt 模板，但不得假设项目中存在固定的全局内置编辑团队。

日常按需调用一位用户选择的角色；重要任务可会审。角色差异必须来自职责、标准、上下文和输出契约，不只是不同口吻。Workshop 的 General Chat 和 Agent prompt 属于 Workshop 专属配置，不与全局角色模板混用。

## 10. Workshop、Prompt 与模型

### FR-AI-01 Workshop

- 持久聊天、命名、搜索、归档和分支。新会话默认标题必须是中性的，不得暗示已经绑定某个场景或任务；会话开始后应根据首条作者消息或附件文件名自动生成可读标题。手动 Rename 只能从会话列表项的上下文菜单进入，不得通过双击标题触发。该菜单必须支持鼠标右键、`Shift+F10`、键盘 Menu 键和触摸长按，并在关闭后把焦点返回原会话。
- 会话筛选固定为 `All`、`Chat`、`Agent` 和 `Archived`。前三者只显示未归档会话；`Archived` 只显示已归档会话。已归档会话允许读取、导出、恢复和永久删除，但不得发送、编辑或重新发送消息。
- 会话列表项上下文菜单承载 Rename、Export、Archive 或 Restore、Delete；仅 General Chat 会话额外提供其可见 system prompt 的编辑入口。会话标题栏保留 Branch，但不得再保留重复的会话三点操作菜单。
- 从某条消息创建分支时，新分支必须复制源会话从开头到源消息为止的可见消息历史和消息附件快照，不能打开成空聊天。复制出的消息和附件使用新的分支内 ID，不继承旧 Proposal 链接或旧模型调用审计链接。
- 选择单个角色或编辑会审。
- 主动选择整个 Series 正文、整个 Series 大纲、Volume、Chapter、Act、多个 Scene、Codex、Snippet、研究片段和风格档案。
- Workshop 的上下文选择不得作为常驻右侧大面板挤占对话区；应使用靠近输入框的高折叠选择器。已选择内容必须在选择器状态中可见，用户再次选择同一项时可以取消选择。
- 选择 Volume、Chapter、Act 或 Scene 后，其中按 Codex 提及规则命中的条目必须自动进入同一次请求上下文，并立即在选择器中显示；条目级 `manual` 和 `never` 策略仍然阻止自动加入。
- Workshop 对话不得默认绑定当前写作 Scene；Series 正文、Series 大纲、Volume、Chapter、Act、Scene 和 Codex 都必须来自用户显式选择的上下文。
- Workshop Context Basket refs support only full Series text, full Series outline, Volume, Chapter, Act, Scene, and Codex entry. Selection remains a dedicated basket field and message attachments remain call-bound inputs; unsupported `scene-section`, `research-note`, `note`, `proposal-source`, and `message-attachment` basket-ref kinds are removed rather than retained as dormant public capabilities.
- Codex context navigation exposes exactly all Codex entries, entries grouped by reusable detail type, and entries grouped by Codex category. It must not expose duplicate Type/Category paths or an unimplemented Tag path.
- General Chat 是讨论模式，不暴露进入 Proposal 的操作；它的 system prompt 必须完整显示并可编辑，不得在 Workshop 调用路径追加不可见的隐藏 prompt。该 prompt 是 chat session 的独立持久字段：新会话创建时快照内置默认值，允许作者保存为空，切换会话时恢复各自值。context preview、普通调用、流式调用和 resend 只能读取目标 session 已保存的值，call/resend 请求不得临时覆盖它。General Chat 分支复制源 session 的 prompt；Agent session 不持有 General Chat prompt。NS-511 可把该快照迁移为版本化 Prompt 引用，但不得破坏 session 绑定。
- Workshop conversations are created as either `chat` or `agent` sessions. This kind is fixed at session creation and is not a mutable per-message mode selector. General Chat remains discussion-only, uses the visible author-editable system prompt, and never exposes Proposal or Codex write actions. Agent sessions are separate dialogue-agent runs: a user turn may create multiple ordered messages in the same session, including assistant draft text, server-owned `tool` request messages, later `result` messages, and follow-up assistant messages.
- Workshop has exactly two message/call modes: `general-chat` and `agent`. `continuity-check` and `codex-creation` are removed from Workshop authority schemas, active APIs, server/storage branches, UI, and fixtures; the current test environment has no retained project data requiring a compatibility or migration path. The separate AI task kind named `continuity-check` is not a Workshop mode and remains available to non-Workshop editorial calls.
- General Chat author messages may be edited and resent. Resend is available only in `chat` sessions for successful `author` / `general-chat` messages that are not linked to Proposals. The operation replaces that author message's content, deletes later unprotected General Chat messages and their message-bound attachments/branch records from the durable history, then runs a new General Chat model call from the revised history. If later history contains protected records such as Proposal-linked messages, Agent/tool/result records, or other non-chat protocol records, the resend must be blocked with an author-readable error instead of asking the author to repair storage manually. Agent sessions do not support edit/resend in this slice.
- Workshop branch creation must accept the exact message selected by the author rather than silently substituting the session's last message. A settled author, assistant, or complete tool-result boundary may be selected. A pending message, a tool request before its required result, or any prefix containing an incomplete/running tool execution is not an eligible branch boundary. The repository remains authoritative for validating that the copied prefix is protocol-complete before creating the branch.
- Workshop sessions must have a session-level conversation export action. Markdown export defaults to the visible chat history without reasoning and without prompt/context audit dumps. An explicit option may include saved provider reasoning content. A separate explicit prompt-audit option may include reconstructed provider prompt and sent ContextBundle item records when those durable records exist. Message attachments are exported as records only; extracted attachment text/body content is omitted from the export file. Exported Markdown must be UTF-8 portable for local Windows readers. This export must not invent tool calls, hidden prompts, unsaved reasoning, or attachment bodies.
- Agent tool calls are protocol messages, not assistant text. Ordinary Agent conversation uses the Provider's normal assistant-text channel and is never wrapped in a required `respond` JSON object. Codex create/update intent uses a declared Provider tool definition and the Provider's native tool-call channel; the server validates the tool name and arguments, converts the accepted draft through the Codex command adapter, and creates a `role: tool` pending request. The frontend confirms that exact tool request before execution. Raw `Tool Call:` prose, fenced JSON, or other simulated calls are never executable protocol and must not be promoted by text scanning.
- Each Agent author turn creates one durable Agent run containing ordered Provider attempts, assistant text, tool-request, tool-result, repair/retry, and continuation steps. A normal prose response is a valid completed run and does not require a tool step. Every confirmed tool attempt returns its success or atomic failure result to the same run so the Agent continues without another author message; any later write request is a new pending tool message and requires its own author confirmation. Continuation is owned by a session-scoped run coordinator, not by recursive HTTP route logic.
- Provider JSON mode and native tool calling are separate capabilities. `generateObject` is used only when a caller explicitly requests a structured final artifact. A malformed native tool name or argument payload becomes a bounded, model-visible tool error followed by automatic continuation in the same run. A malformed explicitly requested structured result receives at most one server-recorded evidence-based repair attempt. If the applicable repair/correction budget is exhausted, the step becomes retryable in the same run instead of being treated as prose, executable protocol, or a dead conversation end. A model without native tool calls may still hold an Agent conversation but cannot expose write tools or simulate them.
- Agent runs and tool executions are never replayed automatically after interruption. On restart or session load, an unfinished run is reconciled to an explicit interrupted state after storage transaction recovery. The author may retry a server-classified retryable model, repair, continuation, or interrupted tool-result step without sending another author message. Retry appends a new attempt to the same run, reuses the exact persisted input/prompt boundary for that step, allows one new bounded repair for that attempt, and preserves all prior steps; abandon is terminal. Proposal conversion remains a separate explicit workflow and is not implied by retry or abandon.
- The `codex.create_entry` adapter creates new Codex entries. The `codex.update_entry` adapter updates one existing Codex entry's fields/research/details and can create, update, or delete unified Codex Progression records through the validated repository commands. Draft Details first match existing reusable detail types by stable detail type ID or a unique exact normalized existing type name. Update also normalizes legacy name-keyed entry Details to same-category stable IDs before command claim; legacy keys without one exact match join the same planner request as new draft labels so confirmation does not loop. Unmatched labels enter a category-scoped detail schema planner: when `codex.detail-schema` has an explicit embedding profile binding, the planner ranks same-category reusable types as suggestions; similarity is not Evidence, Canon, or write authorization. The author mapping step must choose exactly one existing type or explicitly create a reusable type with a confirmed final name and NSFW flag. Missing/failed embedding configuration degrades to the same manual mapping/create step without silent Provider fallback or automatic creation. Unmatched labels must never be written as free keys. Unknown categories must not silently fall back to another category. Explicit author authorization inside the Agent conversation is sufficient source basis for these limited tools, but authority writes still require the frontend confirmation. Relations, category changes, character knowledge, broad world mutations, and broader Write/Codex tools still require a dedicated Codex Proposal or approved Tool Plan/Grant adapter.
- Workshop composer may attach user-message draft files as request-local context. The supported v1 formats are `.txt`, `.md`, `.doc`, `.docx`, and text-extractable `.pdf`; scanned PDFs, OCR-required PDFs, empty files, oversized files, damaged Word files, and disguised binary text must fail with an author-readable reason before the message can be sent.
- Plain text and Markdown attachments must be decoded by the application for mainstream text encodings, including UTF-8, UTF-16, GB18030/GBK, Big5, Shift_JIS, and Windows-1252. Authors must not be asked to manually convert ordinary text files to UTF-8 before attaching them.
- Workshop message attachments are not Reference Library `SourceDocument` records, are not indexed for retrieval, and must not become Research Notes, Codex entries, manuscript text, or Proposals without a later explicit Proposal or user action.
- Attachment files are parsed on upload into a server-side draft attachment. Sending a Workshop message passes parsed attachment IDs only, binds parsed draft attachments to the created author message, and snapshots their extracted text into the same `ContextBundle` as `message-attachment` context items.
- A parsed draft attachment is sufficient to send a Workshop request even when the composer text is empty. The UI must create an author message, bind the parsed attachment, and use an explicit attachment-review request text rather than blocking the send.
- The composer attachment icon must be an interactive button that opens the file picker, reflects disabled state during in-flight calls, and never appears as a dead control.
- While a Workshop model call is in flight, the author must be able to stop it manually. General Chat and Agent must both propagate cancellation to the active Provider request, preserve the already-created author message and bound attachments, persist the model call and applicable Workshop run/message state as `cancelled`, and show one stopped-status assistant message instead of duplicated error text. Cancellation is not failure, success, or restart interruption and must not execute a pending tool side effect.
- A streamed Workshop reply remains session-scoped while in flight. If the author switches to another Workshop session and returns before completion, the pending author/assistant messages and received stream content must still be visible in the original session instead of disappearing until the final response is saved.
- Workshop model calls must include prior visible messages from the same session as `workshop-chat-history` context. Historical message-bound attachments must carry their extracted text forward in that history item so follow-up questions about an earlier uploaded file do not lose file context. The current author message is represented by the call's `userRequest` and must not be duplicated in history.
- Workshop UI chrome currently uses the explicitly frozen `en-US` resource boundary permitted by the UX specification. Static labels, status text, fallback errors, object labels, and date formatting come from that boundary; editable prompts and author/model/project content remain language-independent. This is an implementation-stage English baseline, not a claim that the P-06 Chinese-localization target is complete.
- Workshop requests enable reasoning by default when the exact selected model declares a reasoning control. There is no global `Show reasoning` control, no model-popover display toggle, and no reasoning action in the message action menu. Returned reasoning appears immediately above the answer text as soon as the Provider begins returning it. Each message starts with its reasoning content expanded and provides one inline chevron that can collapse or reopen only that message's reasoning content.
- Workshop reasoning display must preserve provider-native reasoning fields when official APIs expose them. The current OpenAI-compatible adapter must recognize DeepSeek `reasoning_content`, OpenRouter `reasoning` / `reasoning_content` / `reasoning_details`, and Ollama `thinking`-style fields before falling back to legacy `<think>` / `<thinking>` tag parsing. OpenAI reasoning that is only available through the Responses API must not be fabricated on the Chat Completions-compatible path.
- Workshop chat messages must render as one broad reading column rather than alternating left/right narrow bubbles. Author and assistant messages should be distinguished through compact role metadata, restrained surface color, and a small accent, while body text uses an editor-adjacent readable scale.
- Workshop sessions must expose permanent delete through a compact actions menu rather than another primary session-list button. Permanent delete must cascade unlinked messages, message attachments, context baskets, and branch records; sessions with Proposal-linked messages must be blocked with an author-readable reason.
- Workshop 输入区附近的模型选择器只显示并选择模型名称。相邻的运行选项图标打开当前模型的流式输出和推理请求设置；推理控件必须根据当前 Provider 连接和精确模型名称的真实能力自动变化，不得为所有模型伪造同一组 `Low / Medium / High` 选项。相邻的 Provider 设置图标进入 Settings 工作区中可见标签为 `Model connections` 的页面；该页面负责 Provider 凭据、服务地址和模型发现。离开 Workshop 时必须记录当前 Workshop 会话，并提供返回该同一会话的可见入口。Provider 凭据、服务地址和模型发现不得放进 Workshop 模型选择器。
- 每个模型的推理请求设置按 Provider 连接和精确模型名称分别保存，关闭并重新启动应用后仍恢复该模型最后一次有效设置。切换模型时只恢复目标模型自己的设置，不能沿用来源模型不支持的强度、预算或关闭状态。保存使用标准化配置，不能把 Provider 私有请求对象直接写入项目数据。
- 流式输出必须把 Provider 返回的 reasoning 与正式回答分离；reasoning 使用区别于正文的样式并位于正文上方。Provider 只返回 reasoning 摘要时不得把它标成完整思考过程；当前接口不能提供可见 reasoning 时不得编造内容。
- 每条符合条件的消息只在消息内容右下角显示一个带无障碍名称的三点图标按钮。Edit and resend、Resend、Branch 和 Delete turn 都从该图标菜单进入；界面不得显示文字 `More`。菜单必须按会话种类、消息角色、消息状态、Proposal 关联和工具协议完整性逐项决定是否可用。
- Agent 工具请求中的 `Not now` 只关闭当前 review 界面，不执行、不拒绝、不删除也不改变持久请求；作者再次打开同一请求时必须看到未改变的待确认内容。
- Workshop message deletion operates on one complete settled General Chat turn, never on an isolated protocol record. Selecting either the author message or one of its following assistant replies deletes that author message and every reply before the next author message. The operation is available only in an active `chat` session when every turn member is `general-chat`, settled, limited to author/assistant roles, and unlinked from Proposals. Agent sessions, pending turns, mixed tool/result/system records, and Proposal-linked turns are blocked. The same atomic mutation deletes attachments and branch records sourced from the removed messages, clears affected child-session `branchOfMessageId` links, and updates the source session timestamp. No compatibility path for the prior single-message behavior is required in the current test environment.
- 对话可提取人物、场景、Beats、情节线和研究笔记；提取结果全部是 Proposal。

### FR-AI-02 Prompt 系统

- Prompt 类型至少覆盖场景生成、场景摘要、文本替换、Workshop 和编辑审阅。
- 支持 Persona、Preset、输入项、可复用组件、默认模板和版本历史。
- 模板语言支持变量、列表、条件、嵌套和文本组合，但禁止执行任意 JavaScript、文件访问和网络访问。
- 调用前提供最终 Prompt Preview。

### FR-AI-03 模型连接

支持 OpenAI、Anthropic、Google Gemini、OpenRouter、Ollama 和通用 OpenAI-compatible 接口。角色和任务可指定不同模型与参数。

不得：

- 从本地模型静默回退云模型。
- 因模型不支持结构化输出而静默丢弃字段。
- 把 API 密钥写进作品、日志或 Git。

### FR-AI-04 用量控制

- 调用前显示上下文规模与预估用量。
- 按模型、角色、任务和作品记录实际用量。
- 支持软提醒与硬上限。
- 用量是个人控制工具，不发展为计费或商业账户系统。

## 11. 资料分析库

完整行为见 `REFERENCE_LIBRARY_SPEC.md`。

首版的正式能力是导入、解析、检索和提炼用户提供的资料，而不是内置联网搜索。支持 TXT、Markdown、DOCX、文本型 PDF、EPUB 和 HTML；扫描 PDF/OCR、Tavily、Firecrawl 和浏览器采集是未来可插拔获取器。

`Research / 资料库` 是左侧主导航中的独立工作区，位于 Review 之后、Settings 之前；它不属于 Settings、Workshop 或 Codex 的内嵌页面。作者在这里上传资料、查看来源与解析状态、打开原文预览，并管理显示名称、作者、声明语言、标签、人工智能使用权限和版权/使用备注。文件类型、原始文件名、大小、导入时间、解析器状态和来源定位等事实字段只读。尚未接入真实解析、检索或生命周期命令的格式和操作不得显示为可用控件。

资料库必须做到：

- 保留原始文件和哈希。
- 分段记录来源、页码、章节或段落。
- 关键词 + 可选语义检索。
- 语义检索通过显式配置的 `EmbeddingModelProfile` 启用。Reference Library 的默认推荐必须是经过项目中/日/英跨语言 fixture 验证的多语言模型配置，而不是只按中文单语效果选择；模型、语言覆盖、跨语言能力、资源占用和许可证必须可见。不自动下载模型，不把未验证模型标记为跨语言可用，也不静默改用云端服务。
- 结论可回指证据。
- 参考资料、研究笔记和故事 Canon 严格分离。
- 多语言原文可按原语言精确检索；配置通过验证的多语言 Embedding 后，中文查询可召回语义相关的日文和英文原文。实体别名、确定性转写和可选查询翻译可扩展召回，但必须保留查询扩展来源、命中方式和原文位置。默认以中文输出分析，引用仍展示并定位到原文；译文只能作为明确标注的派生阅读辅助。

## 12. 版本、备份与 Word

完整行为见 `IMPORT_EXPORT_VERSIONING_SPEC.md`。

- 持续自动保存，但不把每次敲键变成历史版本。
- AI 应用前、批量替换前、Word 合并前自动快照。
- 章节完成或重要节点允许命名版本。
- 可比较任意两个版本并恢复。
- 定时备份整个作品目录到用户选择的独立位置。
- Word 导出写入场景书签；重导按场景展示差异后合并。
- 首版不解析 Track Changes、批注和修订者，不承诺复杂 Word 排版无损。

## 13. 隐私与模型凭据

模型连接只由显式 Provider、模型配置和系统凭据引用决定；产品不提供作品级或模型级联网策略开关。模型设置和服务密钥是作品库级全局 Settings，所有 project/series 共享，不绑定到单个项目。资料进入 AI 上下文由作者选择和 `never` 权限控制，敏感资料默认不提供给 AI。

Embedding 配置同样是作品库级全局 Settings，但独立于生成模型配置。不同功能可以绑定不同 embedding profile；同一 profile 受自己的批处理并发限制约束，不同 profile 不共享一个全局单线程队列。Embedding 结果和向量索引是可重建缓存，不是权威资料或事实证据。

### 13.1 调用记录

保存角色、模型、时间、Prompt 版本、Context Item ID、用量和结果引用。默认不重复保存完整敏感正文；审计界面可依据当时 revision 重建可见上下文，并标记已变化内容。

## 14. 非商业定义

“不需要商业功能”在本项目中明确指：

- 不做订阅、支付、试用和套餐权限。
- 不做用户增长、营销、推荐、公共模板市场和客服后台。
- 不做团队席位和多租户数据隔离。
- 不在 AI 用量上加价或出售模型额度。

成本预估、密钥管理、备份和个人权限仍是必要的安全功能，不属于商业系统。

## 15. 发布属性与未来扩展

当前是私人项目，但保留未来开源可能：

- 依赖优先使用 MIT、Apache-2.0、BSD 等宽松许可证。
- 产品名称、界面和文案必须原创，不复制 Novelcrafter 品牌资产。
- 首版不为局域网和跨地点访问承担安全承诺。
- 未来开放局域网时必须先加入认证、HTTPS、并发编辑冲突和权限模型。
- 未来桌面封装可复用同一 Web 前端与本地服务，不改变作品磁盘格式。

## 16. 最终完成定义

完整产品只有在以下用户旅程通过时才可称为首个长期可用版本：

1. 用户双击启动器并选择作品库与备份目录。
2. 通过空白、访谈或导入创建项目。
3. 在四种规划视图和双时间线中组织长篇。
4. 在安静编辑器中写作并使用 Sections、Snippets 和 Scene Beats。
5. 连接任一本地或云模型，预览上下文后生成候选正文。
6. 召集独立编辑会审并看到真实分歧和证据。
7. 接受候选正文后，场景摘要和人物变化进入事实收件箱。
8. 确认后更新 Codex、Progression、角色知识与伏笔状态。
9. 导入参考资料，通过来源定位完成分析并转为研究笔记。
10. 导出 Word、外部修改、重导并按场景确认差异。
11. 创建版本、恢复历史、删除索引后重建、从备份恢复项目。
12. 全程没有任何未授权云端发送或 AI 直接修改 Canon。
