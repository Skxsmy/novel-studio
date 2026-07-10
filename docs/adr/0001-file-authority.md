# ADR-0001：Markdown/YAML 为权威数据

Status: Superseded by ADR-0012

ADR-0012 replaces the Markdown/YAML authority format with schema-versioned JSON project files. SQLite remains rebuildable.

SQLite 只作为可重建索引。理由是作品必须能脱离应用阅读、备份和迁移。代价是需要稳定 ID、文件验证和索引重建机制。
