# Full configured checks

Status: `verified` on 2026-08-06 (Asia/Shanghai), with the Windows-host portability boundary recorded
separately below.

## Repository checks

- `pnpm lint`: passed. Oxlint reported 0 warnings/errors; ESLint exited successfully with 36 existing
  warning-level diagnostics; node/web/aiCore typechecks, i18n validation, and Biome format/lint all
  passed.
- `pnpm db:migrations:check`: passed.
- `git diff --check`: passed.
- `pnpm build:win:x64`: passed; artifact details are recorded in
  `todo/verification/windows-x64-installer.md`.

## Complete unit-test suite

The complete configured Vitest suite passed in an isolated WSL2 Ubuntu copy using the repository's
required Node 24.11.1 and pnpm 11.8.0:

| Metric | Result |
| --- | ---: |
| Suites | 5,846 |
| Failed suites | 0 |
| Tests | 21,415 |
| Passed | 21,348 |
| Skipped/pending | 67 |
| Failed | 0 |

The lockfile passed pnpm's supply-chain policy check. Because WSL lacked the X11 development headers
needed to compile the optional desktop `selection-hook`, the isolated install skipped the aggregate
lifecycle phase, then explicitly rebuilt test-critical `better-sqlite3`, esbuild, SWC, and Electron.
Electron 41.8.0 was downloaded through the installer-supported mirror after the official download
endpoint twice terminated its TLS stream. No Vitest files or projects were excluded.

## Supplemental Windows-host run

A native Windows run executed 21,354 tests: 21,118 passed, 38 were pending, and 198 failed across 47
files. Before the Linux run, the result was programmatically intersected with the target diff and had
zero directly changed failing test files. The failures were dominated by upstream tests that model
POSIX `/mock/...` paths while Node uses Windows path semantics. One real migration-integration issue
was found beyond that direct-file intersection: an existing populated-migration test relied on the
tip migration implicitly. It now explicitly names `0005_slow_obadiah_stane`, as the test's own helper
contract requires, and passes in the final Linux suite.
