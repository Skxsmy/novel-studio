# ADR-0004：Markdown 原生编辑器

状态：已接受

Note: ADR-0010 supersedes the Milkdown runtime choice for the current web Write scene and Codex Canon editor surfaces; the Markdown/YAML persistence decision remains in force.


正文编辑器采用 Milkdown/ProseMirror/Remark。批注、候选和审阅锚点不写成富文本私有 JSON，而保存为独立数据，并通过稳定块 ID、文本引用和上下文重新定位。

