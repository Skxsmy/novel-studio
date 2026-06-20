# Novel Studio 文档地图

本目录把“产品为什么存在”“最终应具备什么能力”“当前任务怎么实现”“完成的证据在哪里”分开管理。任何实现都不能只从当前界面或代码反推需求。

## 文档层级

| 层级 | 目录/文件 | 回答的问题 | 权威性 |
|---|---|---|---|
| 产品 | `product/` | 为谁做、解决什么问题、最终功能与不可牺牲原则 | 产品范围最高 |
| 架构 | `architecture/`、`adr/` | 数据归属、模块边界、接口、安全与已接受决策 | 技术决策最高 |
| 执行 | `tasks/`、根目录 `TASKS.md` | 当前里程碑如何拆分、每项任务的可判定验收 | 当前实现范围最高 |
| 证据 | `testing/` | 哪条验收由什么测试或人工步骤证明 | 完成声明依据 |
| 运行状态 | 根目录 `STATUS.md`、`HANDOFF.md` | 当前真实进度、工作树、测试、风险、唯一下一步 | 时效性最高 |

## 新会话读取顺序

1. `PROJECT.md`
2. `docs/product/README.md`
3. `docs/product/PRODUCT_SPEC.md`
4. 当前功能对应的领域规格
5. `docs/product/REQUIREMENTS_TRACEABILITY.md`
6. `docs/architecture/TARGET_ARCHITECTURE.md` 与相关 ADR
7. 当前里程碑的 `docs/tasks/M*.md`
8. `STATUS.md`、`HANDOFF.md`、`TASKS.md`
9. 对应 `docs/testing/*_ACCEPTANCE.md`

## 规格到完成的闭环

每个 `NS-###` 必须形成以下链条：

`产品需求 → 任务不变量/行为 → API 与磁盘契约 → 自动或人工验收 → 验收记录 → STATUS/HANDOFF`

缺少任何一环，只能标记为进行中。界面出现、正常路径能跑或测试总数增加都不能单独证明任务完成。

## 冲突处理

产品范围冲突按 `product/README.md` 的优先级处理。实现细节冲突按“已接受 ADR → 架构契约 → 当前任务规格 → 当前代码”处理。代码与规格不同并不自动说明规格过时；必须先确认是缺陷、遗漏还是经过用户确认的方向变化。
