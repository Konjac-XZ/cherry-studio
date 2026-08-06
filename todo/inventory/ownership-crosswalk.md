# Path Category and Contract Ownership Crosswalk

The source-path matrix uses namespaced `PC-*` routing categories. They are not behavior task IDs.
This crosswalk prevents a path label from being mistaken for proof that every changed region in a
file has a final disposition.

## Category to behavior tasks

| Path category | Implementation tasks/dispositions |
| --- | --- |
| PC-R01 | R01-R05; native clipboard packaging is TC-11/TUI-07 |
| PC-T01 | TUI-01-TUI-05, TUI-08-TUI-12, TUI-17-TUI-21, TUI-25 |
| PC-T02 | TC-17, TUI-14-TUI-15, TUI-22-TUI-23, D03-D06 |
| PC-T03 | TC-01-TC-05, TC-15-TC-17, TUI-08, TUI-10-TUI-11, TUI-23 |
| PC-T04 | TC-05-TC-06, TUI-09, TUI-19 |
| PC-T05 | TC-11-TC-16, TUI-05-TUI-07, TUI-17, TUI-20 |
| PC-T06 | TC-07-TC-08, TC-19, TUI-16, TUI-21, TUI-24 |
| PC-T07 | TC-09-TC-10, TUI-15, N01, D06 |
| PC-T08 | TUI-12-TUI-14, D02-D06 |
| PC-N01 | N01-N03, N10 |
| PC-N02 | N05-N06, N12, N14, N16 |
| PC-N03 | N04, N07, N09, TUI-18, TUI-20 |
| PC-N04 | N08, N10, N13, N15, N16, R05 and evidenced upstream/no-port entries |
| PC-N05 | N05, N15 |
| PC-N09 | N09 |
| PC-D01 | N14/D01 equivalence audit |
| PC-SUPPORT | Verification follows the production task touched by each test/i18n/asset region |

## Multi-contract implementation and verification ownership

| Contract boundary | Implementation owner | Verification owner | Supporting/cross-linked tasks |
| --- | --- | --- | --- |
| Translation request parameters | TC-03/TC-04 | TC-18 | TUI-23 |
| Native clipboard watcher | TC-11/TC-12 | TC-18 | TUI-07, TUI-20 |
| History cache/raw boundary | TC-07/TC-08/TC-19 | TC-18 | TUI-16, TUI-21 |
| Post-processing/glossary | TC-09/TC-10 | TC-18 | TUI-15, N01 |
| JSON dirty overlay | TUI-14 | D06 | D02-D05 |
| Claude Sonnet 5 dirty overlay | N14 | D01 | provider-registry focused tests |
| Directional/polish models | TC-02 | TC-18 | TUI-08, TUI-10 |
| Settings persistence/migration | TC-17 | TC-18 | all TUI settings tasks, D03-D05 |
| Global Translate Clipboard command | TUI-20 | TC-18 | TC-11-TC-13, N04 command architecture |

## Region-specific overrides found by adversarial audit

- `components/QuickPanel/provider.tsx`: result capacity is N15; unrelated endpoint scaffolding is
  R05/noise only after caller/provenance recheck.
- `components/Popups/SelectModelPopup/base-popup.tsx`: result capacity is N15; readable name/model
  identification is N05.
- `AssistantKnowledgeBaseSettings.tsx`: unset knowledge-recognition default is N16.
- `useTopic.ts`: user-message presentation filtering is N02; endpoint timing instrumentation is R05
  diagnostic no-port unless V2 reproduces the need.
- `useTranslate.ts`: message translation/assistant automation support is N01; language-option and
  unknown-lookup diagnostics are R05 diagnostic no-port unless V2 reproduces the need.
- Translate toolbar/actions/styles: floating action lifecycle is TUI-04; responsive control priority
  and section dividers are TUI-25.

Final audit must add any new multi-region override it discovers; broad category membership alone is
never a completion disposition.
