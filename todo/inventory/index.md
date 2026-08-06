# Migration Work Index

This is the execution checklist. Detailed inventories are the authoritative status source; this file
must mirror them and never promote a task on its own. Source-path categories live in
`source-path-coverage.md` and map to tasks through `ownership-crosswalk.md`. A task is not `verified`
until its focused tests and final relevant integration checks pass on V2.

## Inventory accounting

| Source set | Count | Coverage state |
| --- | ---: | --- |
| Committed endpoint diff paths | 286 | every path has a category and task crosswalk |
| Dirty-only tracked paths | 8 | every path has a category and D01-D06 overlay contract |
| Translate core tasks | 19 | inventoried |
| Translate UI/tasks | 25 | inventoried |
| Non-Translate tasks | 16 | inventoried |
| Repository/build/maintenance tasks | 5 | inventoried |
| Source behavior-matrix sections | 7 | imported as historical evidence |
| Remaining `AUDIT` path owners | 0 | manually resolved |

## Translate core

| ID | Work item | State |
| --- | --- | --- |
| TC-01 | Explicit translation use case and engine boundary | verified |
| TC-02 | Model identity and direction resolution | verified |
| TC-03 | Custom request parameters and provider routing | verified |
| TC-04 | Minimize-thinking and explicit override precedence | verified |
| TC-05 | Detection strategies and cancellation | verified |
| TC-06 | Language-family and target rules | verified |
| TC-07 | Model-aware history cache and reuse | verified |
| TC-08 | Raw history versus processed display | verified |
| TC-09 | Ordered post-processing | verified (pure domain; runtime integration tracked separately) |
| TC-10 | Glossary data and prompt injection | verified |
| TC-11 | Native clipboard-watcher lifecycle | verified |
| TC-12 | Rich clipboard I/O and feedback protection | verified |
| TC-13 | HTML-to-Markdown boundary | verified |
| TC-14 | File/OCR platform gateways | verified |
| TC-15 | Cancellation and stale-result fencing | verified |
| TC-16 | Repository/gateway consolidation | verified |
| TC-17 | Complete settings migration/defaults/failure behavior | verified |
| TC-18 | Recreate old behavior verification matrix | verified |
| TC-19 | Preserve history model/cache metadata before first V2 migration | verified |

## Translate UI and interactions

| ID | Work item | State |
| --- | --- | --- |
| TUI-01 | Persisted font size | verified |
| TUI-02 | Responsive/manual layout | verified |
| TUI-03 | Draggable split and scroll geometry | verified |
| TUI-04 | Floating action visibility and hit areas | verified |
| TUI-05 | Input actions and drag/drop | verified |
| TUI-06 | Clipboard conversion and caret paste | verified |
| TUI-07 | Clipboard watch control | verified |
| TUI-08 | Polish interaction modes | verified |
| TUI-09 | Language controls/flip/bidirectional | verified |
| TUI-10 | Directional/polish model controls | verified |
| TUI-11 | Busy stages/cancel/errors | verified |
| TUI-12 | Output/Markdown/raw-copy boundary | verified |
| TUI-13 | Tolerant JSON structure view | verified |
| TUI-14 | Dirty JSON display/selection-copy preferences | verified |
| TUI-15 | Settings surfaces and preference semantics | verified |
| TUI-16 | History search/reuse/selector behavior | verified |
| TUI-17 | Page lifecycle/cross-window parity | verified |
| TUI-18 | Persistent non-closable Translate tab | verified |
| TUI-19 | Word and token counter | verified |
| TUI-20 | Global Translate Clipboard route bootstrap | verified |
| TUI-21 | Cache feedback and force refresh | verified |
| TUI-22 | Directional/polish prompt editors | verified |
| TUI-23 | Translate/Polish custom request controls | verified |
| TUI-24 | Custom language CRUD | v2-native verified |
| TUI-25 | Responsive toolbar priority and separators | verified |

## Non-Translate product behavior

| ID | Work item | State |
| --- | --- | --- |
| N01 | Assistant reply terminal automation | verified |
| N02 | User-message presentation cleanup | verified |
| N03 | Per-assistant mentioned-model persistence | verified |
| N04 | Home and assistant navigation commands | verified |
| N05 | Readable model-name inference | verified |
| N06 | Provider hide/restore and Cherry policy | verified |
| N07 | Topic middle-click deletion | verified |
| N08 | Windows font and global Markdown policy | verified |
| N09 | Narrow main-window outcome | verified |
| N10 | Composer focus after inline translation | verified |
| N11 | Safe OVMS shutdown | verified |
| N12 | Gemini reasoning-off semantics | verified |
| N13 | Small UI/locale/script behaviors | verified |
| N14 | Claude Sonnet 5 dirty overlay | verified |
| N15 | QuickPanel/model-popup page capacity | verified |
| N16 | Assistant knowledge-recognition default | v2-native |

## Dirty overlay

| ID | Work item | State |
| --- | --- | --- |
| D01 | Claude Sonnet 5 behavior | verified |
| D02 | Decoded JSON string display | verified |
| D03 | Dedicated JSON settings section | verified |
| D04 | Four native-selection separators | verified |
| D05 | Optional blank line between selected rows | verified |
| D06 | Focused tests and locale propagation | verified |

## Repository and acceptance

| ID | Work item | State |
| --- | --- | --- |
| R01 | Personal Windows x64 installer script and successful artifact | verified |
| R02 | Suppress four personal-branch CI workflows | verified |
| R03 | Repository hygiene and instruction reconciliation | verified |
| R04 | Preserve test-suite integrity; do not copy suppressions blindly | verified no-port |
| R05 | Maintenance-only source-difference dispositions | verified dispositions |

## Required implementation order

1. Protect migration fidelity first: TC-19, preference/data schemas, migration mappings and tests.
2. Establish V2-native shared domain/platform boundaries: TC-01, TC-02, TC-03, TC-05, TC-06,
   TC-11 through TC-17.
3. Implement history/cache/raw-output/post-processing/glossary: TC-07 through TC-10.
4. Implement Translate interactions and JSON/settings surfaces: TUI-01 through TUI-23 and TUI-25,
   retaining and verifying the V2-native candidate TUI-24 implementation.
5. Integrate conversation completion and other non-Translate behavior: N01 through N16.
6. Resolve all V2-native/maintenance/no-port candidates with focused evidence: N14, R03-R05.
7. Re-run the complete source diff/path/behavior audit and close any newly found gaps.
8. Run formatting, lint, type/build checks, all configured unit tests, and the personal Windows x64
   installer build; record artifact path, size and hash.

## Completion gate

Completion requires all non-noise rows to be `verified`, all no-port/V2-native rows to carry current
V2 evidence, zero unowned source paths, a clean final diff audit, passing configured checks, and a
successfully produced Windows x64 installer. Historical V1 tests and static source similarity are
never accepted as current V2 runtime proof.
