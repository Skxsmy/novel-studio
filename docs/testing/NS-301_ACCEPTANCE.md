# NS-301 验收记录

验收日期：2026-06-20

规格来源：`docs/tasks/M3.md`

状态：自动化与人工验收通过；待形成任务提交后关闭。

## 自动化结果

执行：`npm.cmd run check`

结果：退出码 0。

- TypeScript：contracts、storage、server、web 全部通过。
- Server：2/2 测试通过。
- Storage：18/18 测试通过。
- Web：当前无单元测试，`--passWithNoTests`；类型检查通过。
- Production build：Fastify server 与 Vite web 构建通过。

## 验收映射

| ID | 结果 | 证据摘要 |
|---|---|---|
| A01 | 通过 | 新系列磁盘创建与读取测试，层级校验 valid |
| A02 | 通过 | Act/Chapter 改名后 UUID 不变 |
| A03 | 通过 | 删除被引用 Act/Chapter 文件后返回 `INVALID_DATA` |
| A04 | 通过 | 未知、遗漏、重复 ID 被拒绝；API 对遗漏返回 422 |
| A05 | 通过 | 默认创建 Scene 后出现在首个真实 Chapter 清单末尾 |
| A06 | 通过 | 同章移动后顺序正确且 Set 大小等于数组长度 |
| A07 | 通过 | 跨幕移动只提交目标章；服务端推导 Act，更新路径并通过校验 |
| A08 | 通过 | 正常层级 valid；删除清单后报告 `MISSING_CHAPTER`；API 可查询 |
| A09 | 通过 | 测试真实删除 `acts/` 与 `chapters/`，迁移创建 1 Act/1 Chapter 并保留快照 |
| A10 | 通过 | `npm.cmd run check` 退出码 0 |
| A11 | 通过 | 空作品库浏览器新建“层级验收小说”，立即进入工作台；写作抽屉显示第一幕→第一章→开篇场景，面包屑一致 |
| A12 | 通过 | 人工构造 `committing` 日志、备份与损坏目标；下次访问自动回滚且层级 valid |

## 规格有效性复盘

初版 NS-301 规格只能证明功能方向正确，不能阻止静默跳过缺失文件、重排遗漏成员、同章移动复制 ID、调用方提交冲突祖先、逐文件写入留下半状态、用 no-op 伪装迁移测试。

修订版把这些风险改写为强制不变量、命令语义和 A01–A12 验收。修复后的实现和测试可以逐条回指规格，因此该规格现在具备指导后续 AI 接力与审查实现的能力。
