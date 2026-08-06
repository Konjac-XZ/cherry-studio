# Source behavior contract evidence

This is a ledger copy of `D:\\GitHub\\cherry-studio\\MIGRATION_BEHAVIOR_TEST_MATRIX.md` from customized commit `917967aea8f46f5fe8ff3e4f87ec6b41e9fce8b2`. Its old-v1 test results are evidence of intended behavior, not V2 verification. Each row must be mapped to a V2 task and reverified.

# Pre-migration Behavior Test Matrix

This matrix records behavior contracts for the local translation, model, clipboard, post-processing, and assistant-reply customizations. Tests use in-memory Dexie adapters, mocked AI streams, AbortController signals, fake timers, mocked Electron bridges, and pure rule functions. No test uses a real network, system clipboard, Electron window, or sleep.

## A. Directional model overrides

| ID | Test evidence | Adapter and path | Residual risk |
|---|---|---|---|
| A1 | `uses the native-to-other override when translating away from the native language` | `useDirectionalTranslateModels.test.ts`; mocked Dexie settings and Provider models; success | None |
| A2 | `controls whether each translation direction follows the global model independently` | Same hook adapter; other-to-native success | None |
| A3 | Same independent-follow test plus `uses the default model for both directions when no override is configured` | Mocked settings; follow-global fallback | None |
| A4 | `falls back to the global model when a configured override is no longer available` | Provider model list adapter; removed Provider/model fallback | Partial: the current hook validates membership, but does not reject an embedding/rerank/image override already persisted outside the filtered selector |
| A5 | `selects the polish model independently and falls back when it is unavailable` | Provider model list adapter; independent success/fallback | None |
| A6 | `persists a model selected for the active direction` and `reloads persisted direction models and follow-global switches with the same result` | In-memory Dexie get/put adapter; save/reload | None |
| A7 | `uses the legacy follow-global setting only when direction-specific settings are absent` | Mocked legacy/current setting keys; compatibility fallback | None |
| A8 | `keeps overrides fixed while follow-global directions track global model changes` | Hook rerender with a new global model; update path | None |

## B. Translation execution and mode selection

| ID | Test evidence | Adapter and path | Residual risk |
|---|---|---|---|
| B1 | `uses the resolved direction model and copies processed output before persisting raw history` plus `forwards an explicit model to translate assistant creation` | Mocked streaming service/assistant factory; success | None |
| B2 | `polishes with the independent polish model before translating the polished text` | Ordered mocked `polishText`/`translateText`; success | None |
| B3 | `temporarily uses polish then translation while Alt is held and returns to normal after keyup` | DOM keyboard events with flow adapters; success/reset | None |
| B4 | Alt keyup and `clears the temporary Alt mode when the window loses focus` | DOM key/blur events; reset | Partial: current production code has no explicit reset on translation completion while Alt remains held |
| B5 | `gives an explicit polish trigger priority over normal mode` | Public hook command adapter; explicit option precedence | None |
| B6 | Five `reports translation unavailable for ...` cases | Pure `canStartTranslate` through hook; empty/busy/unknown/incomplete pair | None |
| B7 | `stops an aborted request without copying or saving and allows the next request to finish` and `aborts the active translation and ignores an empty abort key` | AbortController and abort-service adapters; cancel/recovery | None |
| B8 | Translation failure, polish failure, post-process failure, empty translation, and empty polish tests | Rejected mocked streams/services; failure paths and no invalid history | None |
| B9 | `uses the resolved direction model and copies processed output before persisting raw history`, cancellation/failure tests, and cache-hit flow tests | Ordered event log plus auto-copy adapter; success/failure/cancel | None |
| B10 | Existing `AssistantService.test.ts` reasoning tests and `TranslateService.test.ts` live minimize-thinking tests | Store/settings/model-capability adapters; explicit override/fallback | None |

## C. Cache, detection, and target-language decisions

| ID | Test evidence | Adapter and path | Residual risk |
|---|---|---|---|
| C1 | `looks up reusable history by indexed cache key` and exact cache reuse flow | Mocked Dexie index; cache hit | None |
| C2 | `uses distinct cache keys for different models and language directions`, model-mismatch flow, and force-refresh tests | Pure key plus history adapters; miss/bypass | None |
| C3 | `restores source and target decisions from compatible history before language detection` and `skips unknown history languages and detects the source normally` | History/language resolver adapters; recovery/safe skip | None |
| C4 | Strategy tests for `heuristic`, direct `franc`, direct `llm`, short/long `auto`, and franc-to-LLM fallback | Mocked token count, franc, and AI stream | None |
| C5 | `rejects an unknown configured detection method instead of inventing a language` and flow detection-failure state test | Rejected detector; failure/no state mutation | None |
| C6 | Existing `determineTargetLanguage` pair-swap/native-fallback tests and compatible-history flow | Pure language pair rules | None |
| C7 | Existing `treats simplified and traditional chinese as the same native family inside the pair` and variant fallback tests | Pure equivalence rules | None |
| C8 | `includes custom languages in the language candidates`, load-failure fallback, and deleted-history-language skip | Mocked custom-language DB/resolver; success/deletion/failure | None |

## D. Post-processing, glossary, and text rules

| ID | Test evidence | Adapter and path | Residual risk |
|---|---|---|---|
| D1 | Existing `does not apply any post-processor when the master switch is disabled` plus latest-settings service test | Pure processor/settings adapter; disabled path | None |
| D2 | Existing `applies smart quotes before spacing when both are enabled` | Pure ordered processor pipeline | None |
| D3 | Existing regex tests for disabled, compatibility, sequential, empty, invalid pattern, and invalid flags | Pure regex rules; success/skip/failure | None |
| D4 | Glossary dictionary builder tests, preprocessor injection/failure tests, and `substitutes the customized dictionary into the translation prompt` | Mocked glossary DB plus prompt factory | None |
| D5 | Existing `zhMarkdownSpacing.test.ts` and nine fixture tests | Pure fixture corpus | None |
| D6 | Existing quote/Markdown protected-range tests, `markdownConverter.test.ts`, and clipboard rich-HTML conversion tests | Markdown parser/converter adapters; boundary paths | None |
| D7 | Streaming translation success and polish-then-translate tests both terminate through the same final processor | Mocked processor and ordered stream adapters; once-only final application | None |
| D8 | Cache-hit flow keeps stored raw display text while auto-copy uses current processed text; streaming history stores raw output | History/settings/copy adapters; changed-settings semantics | None |

## E. Clipboard watch

| ID | Test evidence | Adapter and path | Residual risk |
|---|---|---|---|
| E1 | `starts one native listener for concurrent subscribers and stops it after the final unsubscribe` | Mocked `clipboard-event`; first/last subscriber lifecycle | None |
| E2 | Same concurrent-subscriber test | Shared start promise/listener adapter | None |
| E3 | Native start failure, child error, and child exit tests | Mocked listener/process handlers; fallback/detach | Module import rejection is represented by listener startup failure rather than a separate loader fault |
| E4 | Baseline/native-change success plus empty/unchanged/busy parameterized tests | Mocked preload clipboard and mutable refs | None |
| E5 | `does not translate clipboard text written by the current translation run` plus write-marker test | Fingerprint refs and mocked clipboard write | None |
| E6 | Empty, unchanged, reading, translating, and post-processing suppression tests | Hook state refs; skip paths | None |
| E7 | `removes the native listener and subscription when the renderer unmounts` | Mocked remove callback/stopWatch | None |
| E8 | Native-to-polling fallback, focusForce assertion, rich/plain/native read fallbacks, browser/native write fallbacks | Fake timers and mocked `window.api`/navigator clipboard | None |

## F. Provider and model rules

| ID | Test evidence | Adapter and path | Residual risk |
|---|---|---|---|
| F1 | Existing `inferModelNameFromId` representative family/version/provider/date tests | Pure naming rules | None |
| F2 | `preserves a user-provided model name instead of applying automatic naming` | Pure managed-model display helper | None |
| F3 | Existing hidden Provider selector tests plus `falls back to the configured default provider when a referenced provider is unavailable` | Redux selector/store Provider adapters | Hidden configured defaults remain stored; visible selectors exclude them |
| F4 | Directional removed-model and custom-polish fallback tests | Visible Provider model list adapter | Same persisted capability-validation gap as A4 |
| F5 | Existing translation/polish custom-parameter and reasoning precedence tests | Store/model capability adapters | None |
| F6 | `excludes embedding, rerank, and text-to-image models from translation selection` plus existing model capability suites | Real model predicates with hook adapter | Persisted overrides bypass this selector; see A4/F4 |

## G. Assistant reply beautification

| ID | Test evidence | Adapter and path | Residual risk |
|---|---|---|---|
| G1 | Quote and Chinese/Latin spacing representative tests | Real post-processing rules | None |
| G2 | Disabled/no-change tests | Real rules; unchanged path | None |
| G3 | Success-transition timing tests and idempotence test; `Message.tsx` uses the tested predicate | Pure status predicate at the Message integration point | No full DOM render of the large Message component; integration is kept at the extracted decision boundary |
| G4 | `preserves the original reply and does not notify when beautification throws` | Throwing processor adapter; failure fallback | None |
| G5 | Utility output tests plus Message success-transition predicate tests | Real utility and integration decision adapter | None |

## Pure utility audit and verification

Existing suites reused rather than duplicated: `translationPostProcessors.test.ts`, `zhMarkdownSpacing.test.ts`, `zhMarkdownSpacing.fixtures.test.ts`, `GlossaryService.test.ts`, `naming.test.ts`, `useProvider.test.ts`, model reasoning/capability suites, `markdownConverter.test.ts`, and prompt glossary tests.

Verification completed on 2026-07-17:

- Focused renderer contract set: 22 files, 286 tests, passed repeatedly after formatting.
- Focused main clipboard set: 1 file, 5 tests, passed repeatedly.
- Full renderer: 184 files, 3213 tests passed. An earlier parallel run timed out one pre-existing `TranslateHistory` test; that file passed alone and the full serial rerun passed.
- Full main: 61 files, 885 passed and 8 skipped.
- `pnpm lint`: passed, including node/web/aiCore typecheck, i18n check, and formatting. It reports existing non-fatal warnings in `useTopic.ts`, `Messages.tsx`, `Topics.tsx`, and `GlossarySettings.tsx`.
- `pnpm test:aicore` was not required because no `packages/aiCore` production or test file was changed; aiCore typecheck passed as part of lint.
