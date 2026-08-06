# Translate fast-reuse audit

This audit prevents the migration from treating the customized V1 Translate Page as a flat behavior diff. The source branch deliberately prepared migration seams on 2026-07-06 and 2026-07-17; those seams are migration assets and must remain recognizable in V2 even when their adapters change.

## Source preparation chain

| Source commit | Prepared boundary | V2 treatment |
|---|---|---|
| `b7aad656b6` | Split the page into focused components and hooks | Reuse the component/hook responsibilities; do not keep adding orchestration to `TranslatePage.tsx`. |
| `770149388a` | `translateRepositories` interfaces plus legacy Dexie adapters | Preserve repository-shaped access; implement it with V2 preferences and Data API. |
| `3b4ae020a0` | Translation engine, language detectors, and pure language rules | Reuse pure rules and the engine contract; adapt execution to V2 `translate.plan`/`translate.open`. |
| `f83ff5f5f9` | Provider-qualified directional model policy | Preserve the policy boundary using V2 `UniqueModelId`; main remains authoritative for final availability validation. |
| `30b7286757` | `TranslationUseCase` preparation/execution pipeline | Port the use-case contract and tests; the page should only bind state and UI effects. |
| `48dca118b4` | Clipboard/window/file/cancellation gateways | Port gateway interfaces and replace only the legacy Electron adapters with typed V2 IPC/Data API adapters. |
| `aa74983f91` | Frozen model identity and cancellation fencing | Keep V2 plan-before-open and run fencing; do not resolve a different model mid-run. |
| `ef30671d3d`, `917967aea8` | Tolerant JSON structure view and selection-copy semantics | Already ported as focused components/utilities; retain their tests. |

## Direct reuse map

### Reuse nearly unchanged

- Clipboard read/write/watch hook split, including rich HTML preference, plain-text code-block preference, write fingerprints, busy guards, baseline suppression, and native-to-polling fallback.
- Pure translation post-processors, JSON structure parsing/display/copy helpers, language-family rules, cache-key normalization, and their fixture/contract tests.
- Page responsibility split (`useTranslatePage`, flow runner, settings sync, language controls, content/layout/file/clipboard hooks), adjusted only where V2 already supplies a stronger native hook.
- `TranslationUseCase` state machine and progress/result vocabulary.

### Keep the boundary; replace the adapter

- Dexie settings/history/language repositories -> generated V2 preferences and typed Data API.
- Legacy assistant engine -> V2 main-process `translate.plan` and streamed `translate.open` IPC.
- `window.api.clipboard` -> typed `translate.clipboard.*` IPC routes.
- Legacy `show_translate` orchestration -> V2 `translate.clipboard` command, main-window route
  delivery, and the extracted `useTranslateAutoPasteTrigger` page coordinator.
- V1 fixed Translate tab -> V2 `translateTabPolicy` session reconciliation and capability guards.
- V1 layout/divider/scroll seam -> extracted V2 `useTranslateLayout` plus pure grid-geometry policy.
- Legacy abort-controller registry -> V2 `AbortController` plus `ai.stream.abort` propagation.
- Legacy file bridge -> restored `FileContentGateway` and file input/processor hooks backed by current
  V2 File Processing jobs and typed file APIs.
- Redux `Model` identity -> provider-qualified V2 `UniqueModelId`.

### V2-native implementation is required

- SQLite/Drizzle schemas and V1-to-V2 migrators.
- Main-process preference/model resolution, custom request parameters, reasoning overrides, glossary injection, and stream ownership.
- V2 generated preference schemas/classification/mappings.
- V2 model selector and Data API mutation/query hooks.

## Corrective findings against the current target

1. `TranslatePage.tsx` currently owns the full detection -> plan -> cache -> polish -> translate -> post-process -> history callback. This duplicates the source `TranslationUseCase` seam and must be extracted.
2. The first V2 clipboard hook collapsed read, watch, and write responsibilities. It lacks the source rich-read/native fallback split, window-focus gateway, and tested write-fingerprint flow. Replace it with the prepared hook/gateway structure rather than extending the collapsed hook.
3. V2 exact cache lookup is model-safe, but the source preparation also restored compatible source/target decisions from history before automatic detection. Add a V2 Data API repository operation for that behavior instead of silently dropping the contract.
4. The current main-process plan/freeze implementation is a valid V2 adapter for the source model-policy/engine seams and should remain authoritative; it should be called through the extracted use case.
5. Existing V2 Translate input/output/language components are upstream-native and should not be overwritten wholesale. Port missing focused components and responsibilities around them.

## Verification rule

For every migrated boundary, retain or port the corresponding source contract tests from `MIGRATION_BEHAVIOR_TEST_MATRIX.md`. A behavior is not considered verified merely because the page-level happy-path test passes.
