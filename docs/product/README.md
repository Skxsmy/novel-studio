# 产品规格导航

本目录是 Novel Studio 产品意图的权威来源。聊天记录、占位页面和当前代码都不能替代这些文档。

## 必读顺序

1. `PRODUCT_SPEC.md`：产品要成为什么、目标用户、全部功能和最终完成定义。
2. `REQUIREMENTS_TRACEABILITY.md`：功能在哪个里程碑实现，以及怎样才算完成。
3. `USER_EXPERIENCE_SPEC.md`：工作区、交互、错误和待验证 UX 假设。
4. 当前任务对应的领域规格：
   - `AI_EDITORIAL_SYSTEM.md`
   - `REFERENCE_LIBRARY_SPEC.md`
   - `IMPORT_EXPORT_VERSIONING_SPEC.md`
5. `FEATURE_MATRIX.md`：Novelcrafter 功能的采用、增强和排除决策。

## 决策优先级

发生冲突时按以下顺序处理：

1. 用户在当前任务中的明确新决定。
2. `PRODUCT_SPEC.md` 及领域规格。
3. 已接受 ADR。
4. 架构与数据文档。
5. 里程碑任务说明。
6. 当前实现。

代码与规格不一致时，不能默认代码是正确答案。先判断是未实现、缺陷还是产品决定已变化；产品决定变化必须新增 ADR 并更新规格。

## 不允许的“简化”

- 把 Proposal 确认流程简化为 AI 直接写正文或 Codex。
- 把角色团队简化为不同头像下的同一个通用 Prompt。
- 把双时间线简化成一个日期字段。
- 把世界真相和角色知识合并。
- 把 Research Note 自动视为 Canon。
- 把 SQLite 或编辑器 JSON 变成唯一作品副本。
- 用模型常识代替资料来源和证据定位。
- 因首版单机而在局域网无认证监听。

确需调整上述方向时，必须先向用户说明代价并获得确认。

