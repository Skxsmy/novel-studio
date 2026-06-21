# NS-409A 验收记录：图像模型协作式 UI 重做

状态：通过  
日期：2026-06-21

## 自动化结果

| 检查 | 结果 |
|---|---|
| `npm.cmd run typecheck -w @novel-studio/web` | 通过 |
| `npm.cmd run test:e2e`（建立当前截图基线） | 通过 |
| `npm.cmd run test:e2e`（首次实现后截图） | 通过 |
| `npm.cmd run test:e2e`（标题收敛后最终截图） | 通过 |

最终截图运行 ID：`2026-06-21T11-05-18-486Z`。

## 设计资产

设计资产目录：`docs/design/ui-redesign/`

关键文件：

- `NS-409A-current-screenshot-manifest-v1.json`
- `NS-409A-implemented-screenshot-manifest-v1.json`
- `NS-409A-global-direction-v1.png`
- `NS-409A-overview-target-v1.png`
- `NS-409A-plan-target-v1.png`
- `NS-409A-write-target-v1.png`
- `NS-409A-codex-target-v1.png`
- `NS-409A-workshop-review-target-v1.png`
- `NS-409A-settings-target-v1.png`
- `NS-409A-implemented-review-target-v1.png`

## 浏览器截图覆盖

本轮不是抽查，Playwright 最终运行保存了以下实现后截图：

- 概览：`NS-409A-overview-implemented-v1.png`
- 规划：`NS-409A-plan-grid-implemented-v1.png`、`NS-409A-plan-outline-implemented-v1.png`、`NS-409A-plan-matrix-implemented-v1.png`、`NS-409A-plan-timeline-implemented-v1.png`
- 写作：`NS-409A-write-main-implemented-v1.png`、`NS-409A-write-focus-implemented-v1.png`、`NS-409A-write-context-implemented-v1.png`、`NS-409A-write-ai-panel-implemented-v1.png`、`NS-409A-write-ai-review-implemented-v1.png`、`NS-409A-write-candidate-implemented-v1.png`
- 设定库：`NS-409A-codex-implemented-v1.png`
- 编辑室：`NS-409A-workshop-implemented-v1.png`
- 待确认：`NS-409A-review-implemented-v1.png`
- 设置：`NS-409A-settings-model-profile-implemented-v1.png`、`NS-409A-settings-deepseek-implemented-v1.png`、`NS-409A-prompt-preview-implemented-v1.png`

## 人工视觉检查

已查看最终实现截图中的概览、规划、设定库、编辑室、待确认、设置 DeepSeek 配置和写作 AI 候选状态。

通过点：

- 主视觉已从旧书页 serif 大标题和后台表单风格，收敛为统一的现代中文工作台风格。
- 深墨绿色侧栏、暖灰背景、琥珀强调、卡片边框、按钮和输入框在主要页面上保持一致。
- 设置页不再出现竖排密钥说明，表单不再被能力卡挤压。
- 设置页主标题为“模型连接”，主界面不再写“模型与资料权限”。
- 规划页主工具栏不再暴露 revision 短号。
- 待确认页主界面不再写“基础版本”。
- AI 候选确认条只显示“候选待确认 / 保留 / 撤回”，没有调用来源、调用 ID、Token、哈希、基准版本等审计字段。
- 专注模式仍只在写作页出现，能够进入和退出。

保留问题：

- 本轮主要通过全局视觉系统收敛实现，尚未把所有页面拆成真正的可复用 UI 组件库。
- 设定库空状态和编辑室未来完整交互仍需要在后续功能任务中细化。
- `NS-409A-implemented-review-target-v1.png` 给出了更进一步的视觉优化方向，后续 UI 任务可继续使用，但本轮不再无限扩展范围。

## 安全和功能边界

- 未改动 ProviderAdapter、凭据存储或模型调用协议。
- 未新增任何 AI 直接写入正文、已确认设定、摘要、人物状态或故事进展的能力。
- 真实密钥仍不写入作品目录、日志或 Git。
- 浏览器验收继续使用隔离临时作品库。

## NS-409C 纠偏验收补充

日期：2026-06-21  
状态：通过，但仍有后续视觉收敛项。

### 自动化结果

| 检查 | 结果 |
|---|---|
| `npm.cmd run typecheck -w @novel-studio/web` | 通过 |
| `npm.cmd run test:e2e`（清理第二套样式覆盖后） | 通过 |
| `npm.cmd run test:e2e`（规划 / 写作结构重排后） | 通过 |
| `npm.cmd run test:e2e`（写作真实正文截图和字体修正后） | 通过 |

最新截图运行 ID：`2026-06-21T13-07-51-086Z`。

### 本轮新增设计资产

- 清理后基线：
  - `docs/design/ui-redesign/NS-409C-plan-current-v1.png`
  - `docs/design/ui-redesign/NS-409C-write-current-v1.png`
- 页面级目标图：
  - `docs/design/ui-redesign/NS-409C-plan-target-v1.png`
  - `docs/design/ui-redesign/NS-409C-write-target-v1.png`
- 图像模型复查目标图：
  - `docs/design/ui-redesign/NS-409C-plan-review-target-v1.png`
  - `docs/design/ui-redesign/NS-409C-write-review-target-v1.png`
- 实现后截图：
  - `docs/design/ui-redesign/NS-409C-plan-implemented-v1.png`
  - `docs/design/ui-redesign/NS-409C-write-implemented-v1.png`

### 人工视觉检查

已查看最新规划页和写作页截图。

通过点：

- 项目已移除未跟踪的 `ui-foundation.css` 第二覆盖层，当前不再存在两套 UI foundation 同时生效的问题。
- 规划页从“单张场景卡 + 右侧表单”改为三栏工作台：层级树、故事板、规划检查栏。
- 规划页场景卡选中态和右侧动作按钮视觉重量降低，不再使用厚黑框或巨大黑色主按钮。
- 写作页主截图会先输入真实中文正文，验收对象变为真实写作状态，而不是空白编辑器壳。
- 写作页标题和正文已切换为更接近中文稿纸的 serif 字体，视觉上不再是后台系统黑体标题。

保留问题：

- 写作页左侧结构栏的新增按钮仍偏表单化。
- 规划页尚未提供目标图中的底部“新建场景”工作台入口。
- 本轮只对规划页和写作页做 NS-409C 复查；其它页面仍沿用 NS-409A 结果。

## NS-409D 宽屏验收补充

日期：2026-06-21  
状态：通过，但仍建议后续继续按复查图做更细的设定库和编辑室审美收敛。

### 自动化结果

| 检查 | 结果 |
|---|---|
| `npm.cmd run typecheck -w @novel-studio/web` | 通过 |
| `npm.cmd run test:e2e` | 通过 |

最新截图运行 ID：`2026-06-21T13-50-37-338Z`。

### 本轮新增验收覆盖

- Playwright 新增 `1920x1080` 宽屏截图：
  - `ui-write-wide`
  - `ui-codex-wide-detail`
  - `ui-codex-wide-progressions`
  - `ui-workshop-wide`
- 设定库验收不再只截空库；脚本会创建真实地点条目和一条进展记录，再进入详情页和进展页截图。
- 进展记录证据不伪造正文引文；本轮曾因引用不存在被服务端拒绝，已改为只保存证据说明。

### 保存截图

- `docs/design/ui-redesign/NS-409D-write-wide-implemented-v1.png`
- `docs/design/ui-redesign/NS-409D-codex-wide-detail-implemented-v1.png`
- `docs/design/ui-redesign/NS-409D-codex-wide-progressions-implemented-v1.png`
- `docs/design/ui-redesign/NS-409D-workshop-wide-implemented-v1.png`

### 人工视觉检查

通过点：

- 写作页正文不再在宽屏上漂到屏幕中段，作品结构右侧的大块异常空白已消除。
- 设定库详情页不再把输入框和文本区横向铺满整屏；条目列表已收窄，详情区更集中。
- 设定库进展记录页改为左侧录入、右侧历史列表，避免原先一整行表单压满宽屏。
- 编辑室从“巨大空白板 + 底部输入框”改为三栏工作台。
- 本轮生成并保存 `NS-409D-wide-review-target-v1.png` 作为后续二次迭代参考。

保留问题：

- 设定库仍可继续压缩为更优雅的“概要卡 + 记录流”。
- 编辑室未接真实模型对话前，中间区仍是空状态；后续接入模型时必须继续截图检查。

## NS-409E 规划页宽屏验收补充

日期：2026-06-21  
状态：自动化通过；视觉状态只能算宽屏结构过渡版，不能算最终 UI 验收通过。

### 自动化结果

| 检查 | 结果 |
|---|---|
| `npm.cmd run typecheck -w @novel-studio/web` | 通过 |
| `npm.cmd run test:e2e` | 通过 |

最新截图运行 ID：`2026-06-21T14-47-28-769Z`。

### 本轮新增验收覆盖

- Playwright 对规划页四个子页面保存 `1920x1080` 截图：
  - `ui-plan-grid-wide`
  - `ui-plan-outline-wide`
  - `ui-plan-matrix-wide`
  - `ui-plan-timeline-wide`
- 四个子页面均先保存当前真实截图，再分别生成图像模型目标图，未使用合并图作为实现依据。

### 保存截图

- 当前真实截图：
  - `docs/design/ui-redesign/NS-409E-plan-grid-wide-current-v1.png`
  - `docs/design/ui-redesign/NS-409E-plan-outline-wide-current-v1.png`
  - `docs/design/ui-redesign/NS-409E-plan-matrix-wide-current-v1.png`
  - `docs/design/ui-redesign/NS-409E-plan-timeline-wide-current-v1.png`
- 图像模型目标图：
  - `docs/design/ui-redesign/NS-409E-plan-grid-wide-target-v1.png`
  - `docs/design/ui-redesign/NS-409E-plan-outline-wide-target-v1.png`
  - `docs/design/ui-redesign/NS-409E-plan-matrix-wide-target-v1.png`
  - `docs/design/ui-redesign/NS-409E-plan-timeline-wide-target-v1.png`
- 实现后截图：
  - `docs/design/ui-redesign/NS-409E-plan-grid-wide-implemented-v1.png`
  - `docs/design/ui-redesign/NS-409E-plan-outline-wide-implemented-v1.png`
  - `docs/design/ui-redesign/NS-409E-plan-matrix-wide-implemented-v1.png`
  - `docs/design/ui-redesign/NS-409E-plan-timeline-wide-implemented-v1.png`

### 人工视觉检查

通过点：

- 规划页不再被固定在窄宽度，右侧大面积无意义空白明显减少。
- 大纲行高已修正为紧凑列表，不再被拉伸成几条巨大横带。
- 追踪表和时间线主内容区不再只漂在左侧小区域。
- 四个规划子页面均保留右侧当前场景检查器和规划分叉动作。

保留问题：

- 当前 UI 仍存在字体选择、字号层级、边框重量和设计语言不统一问题。
- 故事板和追踪表在测试数据较少时仍偏空，需要后续为空状态和多数据状态分别设计。
- 本轮修的是宽屏结构和明显空白，不代表规划页视觉达到最终质量。
