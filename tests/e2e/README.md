# Browser acceptance tests

These tests drive a real Chrome browser through Playwright.

They are intentionally limited to capabilities that Novel Studio currently declares as implemented. Future AI/context/proposal workflows are tracked in `docs/testing/BROWSER_ACCEPTANCE.md` until the corresponding milestone is implemented.

The Playwright global setup starts the Fastify app in-process with an isolated temporary library, then closes it after the run. Do not point these tests at `data/library`.
