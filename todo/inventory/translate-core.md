# Translation engine, data, and platform inventory

## TC-01 Explicit translation use case and engine boundary

- Status: `verified` on 2026-08-06. The source `TranslationUseCase` seam is restored with V2
  `UniqueModelId`, typed DataApi history ports, main-side frozen planning, renderer flow binding,
  and six focused use-case tests. Cross-stage AbortSignal coverage is verified under TC-15.
- Source: `3b4ae020a0`, `30b7286757`; `services/translation/TranslationEngine.ts`, `LegacyAssistantTranslationEngine.ts`, `TranslationUseCase.ts`, `TranslationUseCase.test.ts`.
- Behavior: a translation run accepts explicit source/target/model/mode inputs, streams output, returns an authoritative final result, and sequences success effects only after the final result.
- V2 adaptation: extend V2 main `TranslateService`/stream manager and renderer hook boundaries rather than resurrecting the v1 assistant-based engine.

## TC-02 Model identity and direction resolution policy

- Status: `verified` on 2026-08-06; provider-qualified frozen model planning, directional resolution,
  stale-override fallback, and non-chat filtering are covered by focused main/renderer tests.
- Source: `f83ff5f5f9`, `c31bfa9027`, `aa74983f91`; `translateModelIdentity.ts`, `translateModelPolicy.ts`, `modelCapabilities.ts`, directional hooks/tests.
- Behavior: use provider-qualified stable identities; filter embedding/rerank/image-only models; validate saved overrides; global/directional/polish fallback rules; never let an async provider refresh silently switch the model of an active request.

## TC-03 Custom request parameters and reasoning precedence

- Status: `verified` on 2026-08-06. Independent typed Translate/Polish parameter arrays are
  converted and applied at the main translation request boundary; provider-specific reasoning
  overrides use one shared precedence predicate. Focused request-option, service, settings, and
  migration tests are owned jointly with TUI-23.
- Source: `112171ddbf`, `6d14f154ed`, `fce34e1c5c`, `152969f360`, `b338548e47`; `CustomBodySettings.tsx`, translate repository settings, `AssistantService.ts`, `TranslateService.ts`, aiCore parameter builders/options/reasoning tests.
- Behavior: independent translation and polish custom parameters survive request construction; explicit custom values are not lost during provider adaptation; reasoning-effort options obey documented precedence.
- V2 adaptation: main process now owns AI request construction; map these settings into V2 request options at the main-side translation boundary.

## TC-04 Minimize-thinking and auto-disable-thinking policy

- Status: `verified` on 2026-08-06. Translate and Polish retain independent default-on
  minimize-reasoning settings without mutating assistant defaults; explicit request-scoped
  reasoning fields take precedence and the settings UI communicates that override. Verification is
  shared with TUI-23 and the main transport tests.
- Source: `dcb5d69312`, `7f36e1bea8`, `d94800017d`, `7a45972a7b`; settings, `TranslateService`, `AssistantService`, reasoning tests.
- Behavior: translation can minimize reasoning when supported; optional auto-disable controls translate-specific thinking without mutating unrelated assistant/model settings; unsupported models fall back safely.

## TC-05 Multi-strategy language detection

- Status: `verified` on 2026-08-06. V2 supports explicit heuristic/Franc/LLM/Auto strategies,
  script-aware Korean/Japanese/Chinese/English heuristic detection with candidate fallback, the
  100-token Auto threshold and LLM input cap, custom candidates, Qwen-MT/missing-model rejection,
  invalid-method failure, and cancellation propagation/fencing through TC-15. Focused detector,
  use-case, and page tests pass.
- Source: `e90b352b3e`, `e5d95b2599`, `3b4ae020a0`; `services/languageDetection/*`, `detectLanguage.ts`, detection tests.
- Behavior: `heuristic`, direct `franc`, direct `llm`, and `auto` strategies; Auto uses LLM below 100 estimated tokens and otherwise Franc with LLM fallback; LLM input is capped at 100 tokens; candidates include custom languages; missing/Qwen-MT detector models are rejected; unknown configured method fails rather than inventing a language; errors do not mutate valid page state and cancellation propagates.

## TC-06 Language family and target-decision rules

- Status: `verified` on 2026-08-06. V2 target rules now preserve distinct same-language and
  outside-pair outcomes, treat Simplified/Traditional Chinese as one bidirectional family member,
  keep exact custom codes deterministic, and reject unknown/deleted codes without guessing.
  Traditional Chinese uses the prepared Taiwan flag. Utility, use-case, flip-hook, and page tests
  cover family matching, stale pair values, explicit targets, and corrected retranslation.
- Source: `4a40fb171f`, `translationLanguageRules.ts`, `useTranslateLanguageControls.ts`, tests.
- Behavior: simplified/traditional Chinese equivalence inside a bidirectional native pair; same-language and not-in-pair failures are distinct; custom/deleted/unknown languages resolve safely.

## TC-07 Exact history cache key and reuse policy

- Status: `verified` on 2026-08-06. Provider-qualified exact keys, force refresh, polish composite
  identity, exact DataApi lookup, and compatible-history language recovery before detection are
  implemented and covered by service/use-case/page tests.
- Source: `0c4a4ae925`, `4415e4b689`, `60059138b9`; `translateRepositories/cacheKey.ts`, legacy repository, translation flow/tests.
- Behavior: indexed cache key includes source text, provider-qualified model, source/target direction, and relevant mode; force-refresh bypasses; model/direction mismatch misses; compatible history can restore language decisions before detection; polish cache remains mode-correct.
- V2 adaptation: use SQLite/DataApi indexes or a narrow query, not legacy Dexie or dual writes.

## TC-08 Raw history versus current processed output

- Status: `verified` on 2026-08-06. The use case persists the authoritative raw model result while
  the page derives display/auto-copy output from current post-processors; cache and history reuse
  reprocess raw text under current settings, streaming revisions never enter history, and final
  processing runs once after the authoritative result. Use-case, history, cache, and page tests pass.
- Source: `13094dd99d`, `bd700629cb`, `TranslationProcessingService`, flow tests/matrix D7-D8.
- Behavior: store raw model translation in history/cache; current enabled post-processors determine displayed/auto-copied processed text; cache hits can reprocess raw text under current settings; final processing occurs once, never per streaming revision.

## TC-09 Ordered translation post-processing pipeline

- Status: pure utility boundary `verified` on 2026-08-06; runtime preference loading,
  final-result/history/copy integration, and assistant automation remain owned by TC-08, TUI-15,
  and N01. See `todo/verification/tc-09-post-processing-domain.md`.
- Source: `519182b7d2`, `fd0400dc16`, `271244e98a`, `23bd160be8`, `27a5022ebf`, `bd700629cb`; `translationPostProcessors.ts`, `zhMarkdownSpacing/*`, regex/glossary/settings/tests.
- Behavior: master switch; per-rule switches; Chinese smart quotes before Chinese/Latin spacing; English Markdown straight-quote handling; sequential regex rules with disabled/empty/invalid-regex/invalid-flag safety; preserve protected Markdown/code/math/link/URL/structured ranges including slash-prefixed syntax.
- V2 implementation: pure renderer-domain API in `src/renderer/utils/translate/postProcessors.ts`
  and `zhMarkdownSpacing.ts`, exported through the Translate utility boundary. It has no UI,
  Preference, history, clipboard, or translation-service side effects.

## TC-10 Glossary management and prompt injection

- Status: `verified` on 2026-08-06. V2 now owns glossary persistence in SQLite, strict DataApi CRUD,
  V1 Dexie migration, target-language filtering, duplicate protection, renderer CRUD, and conditional
  `{{customized_dictionary}}` prompt injection. Focused migration/service/schema/engine tests pass.
- Source: `e879151ebf`, `6bf693a76c`; `GlossaryService.ts`, `GlossarySettings.tsx`, prompt utilities/tests.
- Behavior: CRUD customized dictionary, build deterministic glossary text, substitute it into the translation prompt, and degrade safely when glossary loading fails.
- V2 adaptation: glossary is business data and belongs in SQLite/DataApi with a forward migration; prompt interpolation occurs main-side.

## TC-11 Clipboard native watcher lifecycle

- Status: `verified` on 2026-08-06. The V2 lifecycle service ref-counts window subscribers, shares
  startup, detaches on native failure/child exit, emits typed events, and falls back to renderer
  polling. Five main and five renderer watcher tests pass.
- Source: `6a5a6def42`; `main/services/ClipboardWatchService.ts`, `main/ipc.ts`, `preload/index.ts`, shared channel/type, main and renderer tests.
- Behavior: one native `clipboard-event` listener for concurrent subscribers; shared start promise; last unsubscribe stops it; native startup/error/child-exit fall back to polling; renderer unmount removes native and logical subscriptions.
- V2 adaptation: lifecycle-managed service plus IpcApi event schema; use registered disposables and no ad-hoc legacy channel.

## TC-12 Clipboard read/write format and feedback-loop protection

- Status: `verified` on 2026-08-06. V2 platform gateways isolate browser/native clipboard and
  window focus; split read/write/watch hooks cover rich/plain/native fallback, write fingerprints,
  baseline/unchanged/busy/self-write suppression, focus, polling, and cleanup (11 hook tests).
- Source: `useTranslateClipboardRead.ts`, `useTranslateClipboardWrite.ts`, `useTranslateClipboardWatch.ts`, platform gateway/adapters/tests.
- Behavior: native rich/plain read with browser fallbacks; write with browser/native fallback; self-written fingerprint prevents watch loop; ignore empty/unchanged/reading/translating/post-processing states; `focusForce` semantics preserved where native watch is unavailable.

## TC-13 HTML/Markdown conversion boundary

- Status: `verified` on 2026-08-06. DOM paste and programmatic reads share the same source-selection
  policy and isolated Turndown boundary; wrapper-only editor HTML preserves authoritative Markdown,
  real rich semantics still convert, and all three customized Typora `md-fences` cases are ported.
  Six utility tests plus read-hook, input-pane, and page tests cover the two acquisition paths without
  changing V2's shared non-Translate converter.
- Source: `5931efc0cf`, `094a3b9fe1`, later clipboard diagnostic behavior; converter and paste/read hooks/tests.
- Behavior: both event-paste and explicit clipboard-read apply identical source-format choice; wrapper-only highlighted HTML does not escape authoritative Markdown; genuine rich HTML still converts; shared non-Translate converter behavior remains unchanged.

## TC-14 File and OCR processing platform gateways

- Status: `verified` on 2026-08-06. The prepared `FileContentGateway`, `useTranslateFileInput`, and
  `useTranslateFileProcessor` boundaries are restored around V2-native file APIs and File Processing
  OCR jobs. Text/document limits remain 1 MB/10 MB; selection, drop, pathless-image paste, type/size
  rejection, OCR start/settle/error/local-dismiss, and busy-state release are covered by five hook
  tests and the 34-test page suite. OCR dismissal fences the late result; it does not falsely claim
  to cancel the backend job.
- Source: `48dca118b4`, `39fd4efb8b`; translate platform types/adapters, file processor hooks, window/main integration.
- Behavior: page logic depends on narrow clipboard/file/window/abort interfaces; files respect size/type rules; errors and cancellation release busy state.
- V2-native candidate: V2 IpcApi File Processing jobs already cover OCR/document flow; audit missing behavior and use those abstractions.

## TC-15 Cancellation and stale-result fencing

- Status: `verified` on 2026-08-06. One flow-owned `AbortController` now crosses preparation,
  detection, cache/planning checks, polish, translation, post-processing gates, history gates, and
  delayed copy fencing. It is linked to `useTranslate`'s actual stream controller, so stop/unmount
  reaches `ai.stream.abort`; late updates/results are discarded and the next run remains usable.
  Focused use-case/hook/page tests cover propagation and suppression. V2's one-shot
  `ai.text.generate` detection route has no remote abort protocol: cancellation returns immediately
  and fences its result, while the main-side one-shot request may drain in the background.
- Source: `87114de228`, `aa74983f91`; abort controller utility, streaming/execution hooks, TranslateService tests.
- Behavior: abort signal reaches the actual stream; abort suppresses copy/history/post-processing/success toast; late chunks/results from cancelled or superseded runs are discarded; empty abort keys are ignored; next run succeeds.
- V2-native candidate: current V2 hook implements controller/ref fencing and unmount abort, but cache lookup, detection, polish, post-settings reads, processing, copy, and persistence must share the same run identity. V2 detection currently lacks AbortSignal propagation.

## TC-16 Repository and gateway consolidation

- Status: `verified` on 2026-08-06. The page now binds the explicit translation use case, DataApi
  history ports, and typed clipboard/window/file gateways. File selection/validation/temporary-file
  handling and OCR startup live in the restored source-style hooks, while execution remains on V2
  File Processing jobs. No renderer page logic directly reaches legacy Dexie or ad-hoc IPC.
- Source: `770149388a`, `48dca118b4`, `94e9cdf19b`; `translateRepositories/*`, `translatePlatform/*`, extracted policies and tests.
- Intent: keep persistence, process/IPC effects, model policy, and orchestration behind explicit interfaces so the page does not directly depend on Dexie/Redux/Electron internals.
- V2 adaptation: the exact v1 interfaces need not survive, but the responsibility boundaries must map to Preference, DataApi, IpcApi, main AI services, and renderer hooks.

## TC-17 Settings load, migration, defaults, and write-failure behavior

- Status: `verified` on 2026-08-06. The generated Preference schema, V1 migration mappings, page
  bindings, decomposed settings surface, runtime enum/range normalization, and rollback-capable
  writes now cover the complete durable translation settings surface. Focused Preference migration,
  Translate page/settings, JSON, prompt, request-option, and failure-path tests pass.
- Source: `useTranslateSettingsSync.ts`, `translateRepositories/legacyDexie.ts`, store/database migration files, settings tests, dirty overlay.
- Behavior: all translation preferences load atomically enough to avoid transient wrong actions; defaults match the old UX; invalid enum/string values fall back; writes report failure; no setting silently resets during V2 migration.
- V2 requirement: update classification inputs/generate Preference schemas and V2 migrator mappings; never hand-edit generated schema/mapping outputs.
- Evidence: `todo/verification/tc-17-preference-migration.md`.

## TC-18 Verification contract carried from old branch

- Status: `verified` on 2026-08-06. Historical A-G contracts now map to current V2
  main/renderer/data/platform owners; the focused cross-layer matrix passed 51 test files and 474
  tests. See `todo/verification/tc-18-v2-behavior-matrix.md`.
- Source: `todo/inventory/source-behavior-contracts.md`, covering A1-A8, B1-B10, C1-C8, D1-D8, E1-E8, F1-F6, G1-G5.
- Requirement: every row must map to one or more V2 tests or an evidenced V2-native equivalent before its owning task becomes `verified`.

## TC-19 V2 history schema preservation before first migration

- Status: `verified`; see `todo/verification/tc-19-history-cache-metadata.md`.

- Source: customized history adds `modelId`/`cacheKey`; V2 `TranslateHistory` schema/service and migrator currently omit them.
- Requirement: extend the shipped V2 SQLite schema through a new forward migration, DataApi queries, and legacy transform before relying on V2 migration for existing user data. Preserve provider-qualified model identity and cache metadata; never rewrite an already-shipped migration.
- Risk: launching migration against real user data before this support lands can irreversibly discard the old cache identity even if cache behavior is implemented later.
