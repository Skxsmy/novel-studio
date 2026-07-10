# ADR-0002：本地 Web 运行形态

Status: Accepted

使用 React 浏览器界面和 Fastify 本地服务，首版只监听 `127.0.0.1`。这兼顾 UI 开发效率与本地文件访问，并为后续 Windows 外壳、局域网和远程访问保留边界。
