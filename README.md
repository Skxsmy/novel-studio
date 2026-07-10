# Novel Studio

Novel Studio is a local-first writing workspace for long-form Chinese fiction. It combines structured manuscript planning, a block-based writing surface, story memory, auditable AI context, Proposal-based changes, review workflows, and local file ownership.

Current work and repository state are intentionally not duplicated here. Start with [STATUS.md](STATUS.md), then follow the active task linked from [TASKS.md](TASKS.md).

## Repository Map

- `apps/server`: Fastify local API and route composition.
- `apps/web`: React/Vite application organized under `src/app`, `src/api`, `src/features`, and `src/ui`.
- `packages/contracts`: shared Zod schemas and TypeScript contracts.
- `packages/storage`: schema-versioned JSON authority storage and rebuildable indexes.
- `packages/ai`: Provider adapters, context/model infrastructure, and embedding routing.
- `docs/product`: authoritative product and domain behavior.
- `docs/architecture`: current architecture, target architecture, data, API, and security boundaries.
- `docs/adr`: architectural decisions and supersession history.
- `docs/tasks`: scoped work-item specifications.
- `docs/testing`: acceptance evidence and testing strategy.
- `scripts`: Windows development, startup, and repository validation scripts.
- `tests/e2e`: isolated Playwright functional acceptance harness.

Local project data under `data/` and generated directories such as `node_modules`, `dist`, `.vite`, and caches are not repository knowledge and must not be committed.

## Development

Use the UTF-8 PowerShell setup before reading Chinese text or running commands:

```powershell
.\scripts\dev-shell.ps1
npm.cmd install
npm.cmd run dev
```

Production-style local startup:

```powershell
.\start-novel-studio.cmd
```

Repository validation:

```powershell
npm.cmd run docs:check
npm.cmd run check
```

Detailed startup behavior is documented in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). Product authority and task-specific reading routes are documented in [docs/README.md](docs/README.md).
