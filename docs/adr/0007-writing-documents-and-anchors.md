# ADR-0007：写作附属文档与审阅锚点

状态：已接受

Note: ADR-0010 supersedes the Milkdown runtime choice for the current web Write scene and Codex Canon editor surfaces. ADR-0012 later supersedes the Markdown/YAML persistence decision with schema-versioned JSON project authority.


## 背景

正文必须保持可脱离应用阅读的 Markdown。作者备注、候选版本和敏感资料具有不同 AI 权限，不能塞进正文后再依赖界面隐藏。审阅锚点又必须经得起普通文本编辑，但向正文插入应用私有节点会污染原稿并绑定特定编辑器。

## 决定

1. 场景正文继续以 YAML frontmatter + Markdown 正文保存；Milkdown 只作为运行时编辑器。
2. Section 保存为 `sections/<scene-id>/<section-id>.md`，自身携带类型、AI 权限、时间和归档元数据。
3. 审阅锚点保存为 `review/anchors/<anchor-id>.yaml`，不写进正文。锚点组合使用稳定逻辑块 ID、精确引用、前后文和原字符范围。
4. 锚点解析是只读纯计算：原位匹配优先，其次唯一精确引用，再以上下文消歧；无法唯一证明时返回 `orphaned`。
5. localStorage 只保存崩溃恢复草稿，必须记录基础 revision；恢复不改变服务器的乐观并发规则。
6. Section AI 权限为 `inherit`、`local-only`、`never`。敏感资料默认 `never`；资格查询默认拒绝未知值。
7. Web 编辑器使用 `@milkdown/kit` 与 `@milkdown/react` 7.21.2；两者采用 MIT 许可证。引入它们只为 Markdown/ProseMirror 编辑与 React 生命周期集成，不把其运行时状态作为持久格式。
8. 编辑器组件测试使用 `@testing-library/react`（MIT）与 `jsdom`（MIT）；二者仅属于开发依赖，不进入生产运行时。

## 后果

- 删除 SQLite 或替换编辑器不会损失正文、Section 或锚点。
- 正文保持干净，普通 Markdown 工具仍可编辑。
- 锚点在大幅改写后可能失效；产品必须明确显示失效，而不是悄悄贴到相似文本。
- Section 和正文是两个独立 revision 域，不能用一次保存假装原子更新两类文档。
- M4 上下文装配器必须调用统一的 Section 资格函数，不得自行解释权限字符串。

## 回滚

移除 UI 和 API 不影响现有正文。Section 与锚点均为新增目录；回滚应用版本前保留这些文件，新版本恢复后可重新读取。不得在回滚时删除用户数据。
