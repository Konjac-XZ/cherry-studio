# TC-18 Current V2 behavior matrix

Status: `verified` on 2026-08-06 (Asia/Shanghai).

The historical A-G matrix in `todo/inventory/source-behavior-contracts.md` was re-owned by current
V2 boundaries rather than copied test-for-test from the Dexie/Redux implementation. One focused
cross-layer run passed 51 test files and 474 tests.

## Current ownership

| Historical section | Current V2 verifier boundaries |
| --- | --- |
| A. Directional model overrides | Main frozen translation planning, directional model hooks, provider-qualified model eligibility, settings and migration tests |
| B. Execution and mode selection | `TranslationUseCase`, invocation-mode/flow/page tests, request options, abort/stale-result tests |
| C. Cache, detection and targets | Translate history service/hooks, language/detection utilities, cache-aware use case and page flows |
| D. Post-processing and glossary | Extracted processors, Markdown quote/spacing fixtures, glossary SQLite service and assistant reply processor |
| E. Clipboard watch | Main ref-counted watcher plus renderer read/write/watch/platform-gateway tests |
| F. Provider and model rules | Provider visibility, readable naming, provider registry catalog/reasoning and translation planning tests |
| G. Assistant reply beautification | Extracted reply processor/automation policy plus terminal ChatContent and message-action integration suites |

The old A4/F4 residual risk is closed by main-side plan validation against eligible current model
rows before freezing an override. The old B4 observation is owned by the invocation-mode hook's
keyup/window-blur reset plus the flow's abort/replacement fencing. Hidden provider references remain
durable by design while every visible runtime/selector path applies the shared visibility policy.

## Verification result

The focused run included all tests under the current Translate page, Translate hooks/utilities,
translation use case/platform services, main Translate/clipboard/history/glossary services, reply
automation/processing, provider visibility/naming, and provider-registry catalog/reasoning suites.

- Test files: 51 passed.
- Tests: 474 passed.
- Expected stderr from explicit failure/abort cases was present; no unexpected failure occurred.
- The separate full configured repository-test gate subsequently passed 5,846 suites / 21,415 tests
  with zero failures in the Node 24.11.1 Linux/CI validation environment.
