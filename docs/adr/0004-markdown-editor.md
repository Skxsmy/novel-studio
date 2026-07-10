# ADR-0004：Markdown 原生编辑器

Status: Superseded by ADR-0010 and ADR-0012

ADR-0010 replaced the Milkdown runtime choice, and ADR-0012 replaced the Markdown/YAML persistence decision with schema-versioned JSON project authority.


正文编辑器采用 Milkdown/ProseMirror/Remark。批注、候选和审阅锚点不写成富文本私有 JSON，而保存为独立数据，并通过稳定块 ID、文本引用和上下文重新定位。
