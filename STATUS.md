# 当前状态

更新时间：2026-06-19

## 当前里程碑

- M0：完成。
- M1：完成；交互骨架已经真实浏览器验收。
- M2：完成；文件存储、API、冲突保护、索引重建与搜索已经自动化测试。
- M3：待开始。

## 当前任务

- 下一任务：`NS-301` 增加显式 Act/Chapter 清单、排序与场景移动契约。

## 已实现

- React/Fastify 本地 Web 应用，只监听 `127.0.0.1`。
- 创建系列时生成可读的 `series.yaml`、`book.yaml` 和场景 Markdown。
- 同目录临时文件 + 原子替换；SHA-256 revision 防止过期覆盖。
- 删除后可重建的 better-sqlite3/FTS5 场景索引。
- 创建、打开、编辑、900ms 自动保存、刷新恢复、中文全文搜索。
- 概览、Plan、Write、Codex、Workshop、Review 工作区骨架。
- Windows 双击启动器和生产静态资源服务。

## 已确认决策

- 本地 Web 应用，首版仅 Windows 单机和 `127.0.0.1`。
- Markdown/YAML 权威原稿 + 可重建 SQLite 索引。
- React/Vite + Fastify + Milkdown + better-sqlite3。
- 中文创作，多语言参考资料。
- AI 候选变更制；仅机械元数据可自动写入。
- 资料摄入优先，不在首版伪装实现联网研究。

## 风险

- Milkdown、DOCX 场景书签和超长中文文稿必须通过真实样本验证。
- 浏览器应用首次选择本地目录的体验需要 Windows 启动器配合。

## 当前限制

- 写作页暂用原生 Markdown textarea；Milkdown 在 `NS-303` 接入。
- Codex、Workshop 和 Review 当前是诚实标注的交互骨架，没有真实 AI 或 Canon 写入。
- 作品库当前默认位于仓库 `data/library`；首次启动选择目录尚未实现。
- 场景保存尚未回写系列 `updatedAt`，刷新后作品库排序暂不反映最后写作时间。
- 还没有应用内“停止服务”与托盘入口。
