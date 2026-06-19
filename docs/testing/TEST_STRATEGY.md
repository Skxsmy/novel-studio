# 测试策略

## 测试层级

- 单元：Zod 契约、frontmatter、路径安全、哈希、原子写入、时间状态和 Proposal 冲突。
- 集成：临时作品库中的创建、保存、重启、索引删除重建和 API 409。
- Golden：中文标点、多语言资料、Markdown/DOCX/PDF/EPUB/HTML 固定样本。
- E2E：浏览器完成创建系列、编辑场景、重载、搜索和后续 AI 候选闭环。
- 安全：路径逃逸、恶意压缩包、外部资源、超大文件和秘密脱敏。

## 当前 M0-M2 验收

1. 新建系列生成可读的 YAML/Markdown 目录。
2. 保存场景后重启服务仍能读取。
3. 过期 `baseRevision` 被拒绝且文件不变。
4. 删除 `index.sqlite` 后可重建并搜索中文正文。
5. 前端不依赖 AI 即可完成上述操作。

提交前统一运行 `npm.cmd run check`。

