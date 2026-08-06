# Non-Translate Customization Inventory

Status: source inventory and focused implementation verification complete; final repository
acceptance remains.

This ledger covers meaningful behavior outside the Translate page in the exact committed diff
`14510c940964046351dec5b36ee97d13b1a00339..917967aea8f46f5fe8ff3e4f87ec6b41e9fce8b2`
plus the tracked dirty overlay. Translate-owned cross-process infrastructure is cross-linked rather
than duplicated.

## N01 — Assistant reply completion automation

- Source: `42e7d4b822`, `442ee46e4a`; `Message.tsx`, `MessageMenubar.tsx`,
  `assistantReplyPostProcessing.ts`, assistant settings and tests.
- Required:
  - trigger only on the selected/highest-priority assistant reply transition to `SUCCESS`;
  - optionally process each `MAIN_TEXT` block using the Translate final-processing engine with
    Chinese smart-quote/spacing settings, preserve non-text blocks, update timestamps only for
    changed blocks, and persist atomically;
  - processor failure preserves original content;
  - processed text feeds auto-copy and then optional auto-translation;
  - auto-translation targets the configured native language, skips `UNKNOWN`, waits for languages,
    and never duplicates an existing translation block;
  - add manual beautify and native-language translate actions with honest outcome feedback.
- V2 adaptation: integrate at the deterministic terminal boundary in
  `src/renderer/pages/home/useChatRuntimeState.ts` and V2 message persistence/action injection;
  do not use a render effect.
- Dependencies: Translate post-processing, native-language resolution, message DataApi.
- Status: `verified` on 2026-08-06. The V1 reply processor and priority/cleanup rules remain
  extracted as pure reusable seams; V2 invokes them once from the deterministic execution-terminal
  boundary rather than from render. Only the selected/highest-priority successful reply is
  post-processed, then optionally copied and translated. Processing preserves non-text parts and
  failures/original no-op content; translation uses the loaded typed native-language preference,
  skips `UNKNOWN`, and rechecks persisted parts before appending so concurrent completion cannot
  duplicate a translation. Manual beautify and native-language actions reuse those same seams and
  report changed/unchanged/empty outcomes honestly. Assistant settings and the five V1 flags migrate
  through the V2 sanitizer. Focused terminal, processor, adapter, menu, settings, form, and migration
  suites pass as part of a 258-test run; web typecheck, focused lint, i18n check, and diff checks pass.

## N02 — User-message presentation cleanup

- Source: `79c3e22690`, `ce8e23d317`, `94e9cdf19b`; message types, filters, chat/history/search/flow
  projections and shortcuts.
- Required:
  - after all sibling assistant replies are terminal, hide the originating user message only if at
    least one sibling succeeded;
  - skip session topics;
  - persist `hiddenInChat` as presentation metadata;
  - exclude hidden messages from chat, history/search topic views, flow, and copy-last/edit-last;
  - keep the row in storage and in prompt/context construction.
- V2 adaptation: add an explicit V2 message-data presentation field and one shared projection
  policy; terminal orchestration belongs with N01.
- Status: `verified` on 2026-08-06. After all direct sibling replies are terminal and at least one
  succeeded, non-session topics persist `data.presentation.hiddenInChat` on the originating user
  row while preserving the rest of its data. One shared renderer projection excludes it from the
  chat list, branch-flow presentation, chat-local search, and therefore copy-last/edit-last actions.
  The main message-search query applies the same presentation boundary so global/history topic
  search cannot expose it; the FTS text, stored row, prompt tree, and model context remain intact.
  Projection, deterministic multi-model cleanup, global-search persistence, and integration tests
  pass in the same focused 258-test run, together with web typecheck, focused lint, and diff checks.

## N03 — Per-assistant mentioned-model persistence

- Source: `ca81fbe6bb`; old `Inputbar.tsx`, `AssistantService.ts`, assistant type.
- Required: persist the selected multi-model list per assistant, restore on assistant return,
  compare by provider-qualified identity, drop deleted models, and prevent switch/sync loops.
- V2 adaptation: store `UniqueModelId[]` in assistant-owned JSON settings; resolve against current
  registry rows in `useChatMentionedModels.ts`/`ChatComposer.tsx`, never persist model snapshots.
- Status: `verified` on 2026-08-06. The extracted chat-only `useChatMentionedModels` seam now
  persists only ordered `UniqueModelId[]` values in the owning assistant's JSON settings. Returning
  to an assistant resolves those IDs against current model rows, removes deleted models and repairs
  stale IDs; initial queue/history draft state is preserved, while an actual assistant switch
  restores the new assistant's selection without sync loops. The V1 snapshot field is converted to
  deduplicated provider-qualified IDs during migration. Full Composer and assistant-mapping suites
  pass (157 tests), as do web typecheck, focused lint, and diff checks.

## N04 — Personal navigation commands

- Source: `729083191d`, `a645040361` and earlier personal history; shortcut store/service,
  `NavigationHandler.tsx`, `HomePage.tsx`, labels and navigation E2E.
- Required:
  - global `go_home`: Ctrl/Cmd+Shift+H, works while the main window is unfocused and raises the
    window before navigating home;
  - renderer previous/next assistant: Ctrl/Cmd+ArrowUp/Down, display-order traversal, wraparound,
    exclude assistants hidden by collapsed groups, and activate/reuse/create the assistant topic;
  - hide mini-app popup before home navigation.
- V2 adaptation: add typed command definitions, main/renderer handlers, and typed navigation IPC.
The global Translate Clipboard command remains `TUI-20`.
- Status: `verified` on 2026-08-06. Typed `app.home`, `assistant.previous`, and `assistant.next`
  commands now own the three shortcuts. Home uses the main-process navigation service, which raises
  an unfocused main window and reuses `/app/chat`; V2 has no separate mini-app popup window to hide.
  Assistant traversal reads current collapsed topic-assistant groups at execution time, follows DB
  display order with wraparound, and delegates activation/reuse/creation to the existing assistant
  conversation use case. Legacy shortcut preferences migrate to the new keys. Full HomePage plus
  command/keybinding/migration suites pass (125 tests), as do typecheck and lint.

## N05 — Readable model-name inference

- Source: `3049da16c1`, `94e9cdf19b`; `utils/naming.ts`, `modelManagementPolicy.ts`, add/manage model
  dialogs and tests.
- Required: strip provider prefixes, preserve known brands/acronyms and lowercase o-series names,
  format versions/sizes/dates, tolerate empty/already-readable values, infer batch IDs separately,
  preserve explicit remote/user names, sort groups deterministically, and always display the raw ID
  for disambiguation.
- V2 adaptation: infer from `apiModelId` or the model segment of `UniqueModelId` before sync preview
  and DTO creation; never format the database identity as a display name.
- Status: `verified` on 2026-08-06. The extracted V1 naming policy now infers display labels only
  from the raw API model ID at manual-add, provider-sync, preview, and create-DTO boundaries; the
  provider-qualified database identity remains unchanged. Batch IDs are inferred independently,
  explicit server/user labels survive later ID or registry updates, and the sync preview shows the
  readable label together with the raw API ID. The V1 naming contract plus add/sync/preview suites
  pass (115 tests), as do focused lint and diff checks.

## N06 — Built-in provider hide/restore and Cherry product policy

- Source: `de6147623d`, `63acb7115b`, `94e9cdf19b`; provider policy/hooks/settings/onboarding.
- Required:
  - a built-in provider can be hidden with confirmation; hiding also disables it and chooses a
    fallback;
  - a dedicated hidden-built-in filter permits restoration;
  - hidden custom providers are not exposed through that recovery view;
  - enable does not reorder providers;
  - suppress CherryIN from default-visible setup/onboarding and keep generic setup primary;
  - painting default is Zhipu.
- V2 equivalence: Zhipu painting default is already native; CherryAI/local-embedding settings
  visibility is partially native.
- V2 adaptation: use a provider DB field or typed hidden-built-in-ID preference and one shared
  runtime/settings visibility policy. Retain low-level migrated CherryIN support unless separately
  proven safe to remove.
- Status: `verified` on 2026-08-06. A typed hidden-built-in-ID preference and one shared provider
  visibility policy now hide canonical built-ins from normal runtime/model-selector provider lists
  while the settings page can explicitly request the complete list for recovery. Hiding is
  confirmed, disables the provider first, records its ID, and selects a visible fallback; restoring
  removes only the hidden marker and deliberately leaves the provider disabled. Custom instances
  cannot enter the recovery view, and ordinary enable PATCHes retain V2 ordering. V2 already hides
  CherryAI from generic settings, does not promote CherryIN in onboarding, and defaults painting to
  Zhipu, so those native policies remain unchanged. Provider hook/list/policy tests pass (74 tests),
  as do web typecheck, i18n sync/check, focused lint, and diff checks.

## N07 — Topic middle-click deletion

- Source: `3ae90cf7f4`; old `Tabs/components/Topics.tsx`.
- Required: middle-click on an unpinned topic enters the existing two-second confirmation; second
  middle-click confirms; Ctrl/Cmd+middle-click deletes immediately; pinned/editing rows are guarded;
  no activation event leaks through.
- V2 adaptation: reuse the current V2 row deletion state and add button-1 handling to
  `ResourceList.Item` with focused tests.
- Status: `verified` on 2026-08-06. Topic rows now route button-1 auxiliary clicks through the
  existing two-second deletion state: the second middle click confirms, Ctrl/Cmd+middle-click
  confirms immediately, and pinned or inline-renaming rows are guarded. The auxiliary event is
  consumed so it cannot activate the topic. Focused interaction tests pass.

## N08 — Windows font and global Markdown policy

- Source: `ab8fff641d`, `ae3b75202f`; global fonts, Content Search, Display Settings, artifact card,
  `CodeStyleProvider`, Shiki/Markdown-It/KaTeX and tests.
- Required:
  - UI font stack prioritizes Twemoji flags, platform/system fonts, Segoe UI and Microsoft YaHei;
  - code stack prioritizes `JetBrainsMono NFP` before Cascadia/Fira/Consolas;
  - explicit previews/search/artifacts follow the system stack;
  - Markdown typographer is disabled; CJK-friendly behavior is enabled; KaTeX options remain
    supported through the shared renderer.
- V2 adaptation: reconcile with the current renderer instead of copying old `shiki.ts`; verify
  chat, notes, code preview, selection/raw copy, CJK wrapping, math and code spans.
- Status: `verified` on 2026-08-06. The shared renderer now disables Markdown-It typographer,
  enables `markdown-it-cjk-friendly`, and retains the existing shared KaTeX/plugin pipeline. The
  Windows UI and code stacks prioritize the requested Twemoji/system/Segoe/YaHei and
  JetBrainsMono-NFP families respectively. Focused Markdown rendering tests (including straight
  quote fidelity), full typecheck, lint, and diff checks pass.

## N09 — Narrow main-window policy

- Source: `ca81fbe6bb`; old `MIN_WINDOW_WIDTH` changed 960 to 480.
- Required outcome: allow the main chat window at 480 px.
- V2 adaptation: V2 has global 960 and home/agent secondary 520 minima. Set the home/secondary
  outcome to 480 first; change the global/startup minimum only after checking settings and other
  routes at that width.
- Status: `verified` on 2026-08-06. Home and agent routes now request a 480 px secondary minimum
  while the global/settings startup minimum remains 960. The existing route lifecycle restores
  the global minimum outside those compact shells. Focused Home/Agent suites pass (160 tests).

## N10 — Composer focus after inline translation

- Source: old `InputbarCore.tsx` endpoint diff.
- Required: on inline translation completion, refocus the composer and recalculate height across
  success/cancel/failure without stealing focus from an inactive tab or switched assistant.
- V2 adaptation: use the V2 composer focus/surface action, not direct global DOM access. If the V2
  workflow has replaced this action, record the tested native equivalence.
- Status: `verified` on 2026-08-06. The current V2 source had removed the inline input-translation
  action even though its typed target-language preference and migration remained, so native
  equivalence could not honestly be claimed. Chat Composer now exposes a default-pinned,
  customizable input-translation action backed by the existing Translate transport and writes the
  result through `ComposerSurfaceActions.replaceDraft`; V2's editor layout owns height
  recalculation. A separately extracted completion coordinator handles success, cancellation, and
  failure, drops stale results after a topic switch, and restores focus only when the same composer
  scope is still current and its tab is active. Composer, coordinator, preference-default, and
  seeder suites pass (150 tests), as do web typecheck, focused lint, and diff checks.

## N11 — Safe OVMS shutdown

- Source: initial personal squash; old `src/main/services/OvmsManager.ts`.
- Required: query `Get-Process -Name ovms`, treat no process as success, parse one/many PIDs, stop
  each through the manager, and report the first partial failure with per-PID logs.
- V2 adaptation: retain the injectable lifecycle service and named export; prefer owned-PID/path
  verification when available. Do not port the obsolete default export.
- Status: `verified` on 2026-08-06. The lifecycle-managed named `OvmsManager` now queries
  `Get-Process -Name ovms`, treats an empty result as success, normalizes one/many unique PIDs,
  invokes its recursive owned stop path for every PID, logs each failure, and returns the first
  partial failure only after attempting the full set. Shutdown-helper tests, typecheck, and lint pass.

## N12 — Gemini reasoning-off wire semantics

- Source: `0c3147614c`; old reasoning utility/tests.
- Required:
  - Gemini 3 `none` retains `includeThoughts: true` and requests the minimum supported level;
  - Gemini 3 Pro clamps unsupported `minimal` to `low`;
  - pre-Gemini-3 budget dialect sends `thinkingBudget: 0` for `none`.
- V2 equivalence: explicit zero budget is native. V2 Gemini 3 currently uses
  `includeThoughts: false`, so that semantic still needs a targeted change/test in provider
  reasoning profiles.
- Status: `verified` on 2026-08-06. The Gemini 3 effort dialect now keeps `includeThoughts: true`
  while requesting `minimal`; the shared supported-effort resolver retains the Pro
  `minimal -> low` clamp, and the budget dialect still emits `thinkingBudget: 0` for off.
  Provider-registry and shared reasoning suites pass.

## N13 — Small user-facing behaviors

- Remove an arbitrary 250 px cap from the message translation language menu only if V2 retains the
  cap; keep viewport collision bounds. Source: `0de8b6f574`.
- Use Taiwan rather than Hong Kong for the Traditional Chinese locale flag where V2 still differs.
- Change `program.parse()` to `program.parse(process.argv)` in `scripts/feishu-notify.ts` only if the
  V2 script still has the implicit parse call.
- Status: `verified` on 2026-08-06. V2's message translation command popover has no fixed 250 px
  list cap and retains Radix collision handling; the shared Traditional Chinese preset already uses
  the Taiwan flag. The surviving Feishu script now calls `program.parse(process.argv)` explicitly.
  Current-source audit, focused message-menu coverage, typecheck, and lint pass.

## N14 — Claude Sonnet 5 dirty overlay equivalence audit

- Source: tracked dirty V1 model/reasoning/vision/web-search files and tests.
- V2 native coverage: canonical `claude-sonnet-5`, 1M context, 128K output, file/image/function/
  reasoning/structured output, low/medium/high/xhigh/max/none, adaptive summarized Anthropic
  thinking, and no fixed-budget max-token subtraction.
- Reconcile explicitly:
  - old dirty limit 64K versus V2 registry 128K (prefer newer V2 unless evidence says otherwise);
  - old efforts omit `max`, V2 includes it;
  - verify direct Anthropic and Bedrock aliases plus first-party web-search/server-tool capability.
- Status: `verified` on 2026-08-06. V2's canonical registry remains authoritative at 1M context
  and 128K output, with file/image/function/reasoning/structured-output capabilities and the newer
  effort vocabulary. Direct, slash-prefixed, and Bedrock-style Sonnet 5 IDs normalize to the same
  model. The one missing endpoint behavior was first-party Anthropic server-tool eligibility;
  Sonnet 5 is now declared for web search and URL context at the creator seam. Catalog, reasoning,
  normalization, 128K transport, and server-tool delivery suites pass (155 tests).

## N15 — QuickPanel and model-popup page capacity

- Source endpoint behavior:
  - `components/QuickPanel/provider.tsx` changes default/page capacity from 7 to 14;
  - `components/Popups/SelectModelPopup/base-popup.tsx` changes model page size from 12 to 25.
- Implemented:
  - QuickPanel now uses 14 for both its provider state and omitted-`pageSize` open fallback; its
    fixed/fill/read-only geometry expectations cover the larger default.
  - ModelSelector is virtualized and does not paginate or incrementally cap results, so its fixed
    440 px collision-bounded viewport remains V2-native. The surviving PageUp/PageDown capacity
    contract now uses a shared 25-item default.
- Verification: `todo/verification/n15-n16-ui-defaults.md` records focused provider, geometry,
  keyboard-navigation, model-selector component and typecheck evidence.
- Status: `verified`.

## N16 — Assistant knowledge-recognition default

- Source: endpoint diff in `AssistantKnowledgeBaseSettings.tsx` changes an unset assistant's
  knowledge-recognition default from off to on.
- V2 equivalence: V2 deliberately removed `knowledgeRecognition` from the assistant schema and
  migration mapping. Knowledge tools are available whenever the resolved per-turn knowledge scope
  is non-empty, so an assistant without that legacy field is enabled without a renderer fallback.
  The old explicit-off toggle is not a V2 concept and was not part of this endpoint customization
  (the source diff changed only the unset fallback).
- Verification: the focused `KnowledgeSearchTool` test proves that an assistant object with no
  legacy toggle enables search for an effective knowledge scope; empty or unavailable scopes remain
  disabled by the existing applicability tests. See `todo/verification/n15-n16-ui-defaults.md`.
- Status: `v2-native`.

## Cross-link — Clipboard watcher and forced focus

The global native watcher, typed clipboard IPC, native-helper packaging, ref-counted lifecycle,
polling fallback, self-write fingerprinting, and Windows foreground recovery are owned by
`translate-core.md`/`translate-ui.md`. Their V2 implementation must use typed IPC, lifecycle
services and the window registry, with app-stop/window-replacement cleanup.
