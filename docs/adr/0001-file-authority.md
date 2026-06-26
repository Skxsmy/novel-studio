# ADR-0001：Markdown/YAML 为权威数据

状态：已接受

Superseded note: ADR-0012 supersedes the Markdown/YAML authority format for NS-410 and later work. The current authority target is schema-versioned JSON project files; SQLite remains rebuildable.

SQLite 只作为可重建索引。理由是作品必须能脱离应用阅读、备份和迁移。代价是需要稳定 ID、文件验证和索引重建机制。

