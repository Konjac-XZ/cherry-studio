# Translation UI and interaction inventory

All items now carry current V2 verification or an evidenced V2-native disposition. Source paths
refer to the customized v1 tree in `D:\GitHub\cherry-studio`.

## TUI-01 Adjustable, persisted translation font size

- Status: `verified` on 2026-08-06. The generated V2 Preference keeps the 16 px default, while the
  extracted runtime normalizer rejects malformed/out-of-range persisted values and the edit path
  rounds/clamps to integer 12-24 px. Settings, input, and output share that value; focused utility,
  settings, and page tests pass.
- Source: commits `610dc802ee` and `7e543a8a00`; `pages/translate/TranslatePage.tsx`, `hooks/useTranslateFontSize.ts`, settings UI and locale keys.
- Behavior: user can adjust translation text size from 12-24 px in integer steps; invalid saved values fall back to 16; edits clamp/round; value survives page/app recreation; input and output remain visually coherent. V1 used typed preference `translate:font:size` plus a localStorage fast-initialization mirror.
- V2 note: V2 currently renders fixed `text-base`; add a Preference-backed page setting rather than v1 localStorage.

## TUI-02 Responsive two-pane layout and manual override

- Status: `verified` on 2026-08-06. The extracted `useTranslateLayout` boundary owns the persisted
  panel split, responsive auto decision, manual `auto -> vertical -> horizontal` cycle, scroll
  handlers, and resize lifecycle. V2 grid geometry retains the horizontal 320/280/250 px trailing
  minimums, vertical 200 px minimum, and 30% leading minimum. Geometry, page, type, and lint checks pass.
- Source: `9dd465af4a`, `2a2163d858`, `b7aad656b6`; `TranslatePage.styles.ts`, `useTranslateLayout.ts`, `DraggableDivider.tsx`, page constants/types.
- Behavior: horizontal/vertical layouts adapt to width/aspect ratio; toolbar control cycles `auto -> vertical -> horizontal -> auto`; override persists as `translate:layout:override`; split percentage persists separately; horizontal minimum widths step from 320 to 280 to 250 px at narrow breakpoints; vertical panes retain 200 px minimum heights and at least a 30% split.
- V2 note: adapt to the Tailwind/Shadcn page structure and V2 design tokens; do not port styled-components mechanically.

## TUI-03 Draggable split and equalized scroll geometry

- Status: `verified` on 2026-08-06. The V2 divider applies the shared axis-aware bounds for pointer
  and keyboard resizing and delegates horizontal double-click to the isolated layout hook. Its
  equalizer measures candidate grid splits from the midpoint search range, minimizes the difference
  between input/output scrollable lengths, restores the live grid style, and chooses 50/50 when
  neither pane scrolls. Focused geometry and scroll-sync tests pass.
- Source: `36ea6c71a7`, `5175376dae`; `DraggableDivider.tsx`, `useTranslateLayout.ts`, `translateScroll.ts`, page styles.
- Behavior: divider changes pane proportions on the active axis; double-click in horizontal mode searches for the split whose input/output scrollable lengths are closest, or resets to 50/50 if neither scrolls; default equalization begins at the midpoint; scroll-sync geometry accounts for unequal content lengths without abrupt jumps.
- Existing evidence: old scroll utility/tests and behavior matrix; V2 has `scrollSync.ts`, requiring equivalence review rather than duplication.

## TUI-04 Floating action bars, hit areas, and visibility lifecycle

- Status: `verified` on 2026-08-06. Input clear/paste/copy and output copy now use one reusable
  V2-native compact surface per pane. The bar remains absolutely positioned for narrow panes,
  fades after 300 ms, reveals immediately on local hover, and reproduces the final `-8px` /
  `calc(200% + 32px)` top-right hotspot without moving visible buttons. It deliberately has no
  `focus-within` visibility rule, so focus alone does not pin it. Component and page tests pass.
- Source: `8e54717302`, `5b1b8501f7`, `645cd316a4`, `9e2a0fd827`, `ce6542f3e5`, `1e6371839a`, `9d927deb90`; `FloatingActionBar.tsx`, `TranslatePageActions.tsx`, `TranslatePage.styles.ts`.
- Behavior: compact source/output actions share one visual surface, stay available at narrow widths, hide when the relevant pane is not hovered, fade with a delay, and use enlarged local hover hotspots without moving the visible buttons. Focus alone must not pin source actions visible.
- Edge detail: the final top-right pseudo-element geometry was `top/right: -8px`, `width/height: calc(200% + 32px)`; preserve the interaction intent using V2-native DOM/CSS.

## TUI-05 Input acquisition actions and drag/drop overlay

- Status: `verified` on 2026-08-06. The restored file-input/processor hooks cover one-file
  selection, drag/drop, clipboard files (including pathless images), localized type/size failures,
  V2 OCR job lifecycle, and guaranteed busy-state release. The input component owns the drag/OCR
  overlays and now refocuses after clear; language exchange is disabled while file/OCR work is busy,
  so it cannot strand an overlay.
- Source: `8e54717302`, `2a2163d858`, `7fe4e72363`; `TranslateInputPane` responsibilities split across `TranslatePage.tsx`, `useTranslateTextInput.ts`, `useTranslateFileInput.ts`, `useTranslateFileProcessor.ts`, page actions/styles.
- Behavior: paste/read clipboard, upload/drop or paste one supported text/doc/image file, reject multiple/unsupported inputs with localized feedback, clear input and refocus, and show/dismiss the processing/drag overlay correctly; flipping languages/content must not leave a stale overlay.
- V2 note: retain V2 File Processing/OCR job architecture and IpcApi; integrate only missing observable behavior.

## TUI-06 Clipboard conversion controls and paste semantics

- Status: `verified` on 2026-08-06. The persisted default-on preference drives shared
  DOM/programmatic HTML selection; the explicit paste button restores the caret, Ctrl/Cmd+Shift+V
  is reset after exactly one paste event, wrapper-only highlighted HTML preserves Markdown, genuine
  rich HTML converts, and the customized Typora fence cases retain language and indentation.
- Source: `5931efc0cf`, `094a3b9fe1`; `HtmlConversionToggleButton.tsx`, `useTranslateHtmlConversion.ts`, `useTranslateClipboardRead.ts`, `useTranslateFileInput.ts`, `utils/markdownConverter.ts`.
- Behavior: persisted default-on toggle controls rich HTML-to-Markdown conversion; the explicit paste button inserts at the current selection/caret and restores it; Ctrl/Cmd+Shift+V is a one-event plain-text bypass; Typora `md-fences` are recognized; both DOM paste and programmatic clipboard-read paths share the same selection rule.
- Edge detail: VS Code Markdown may supply syntax-highlight HTML plus authoritative plain Markdown; prefer plain text for wrapper-only HTML while retaining conversion for real rich semantics. Shared converter consumers must not be changed accidentally.

## TUI-07 Clipboard watch control and feedback

- Status: `verified` on 2026-08-06. A toolbar toggle binds the split watcher hook; native and polling
  paths ignore baseline/empty/unchanged/busy/self-written content, focus the window, trigger the
  frozen translation flow, and remove subscriptions on disable/unmount.
- Source: `6a5a6def42`; `ClipboardWatchToggleButton.tsx`, `useTranslateClipboardWatch.ts`, `useTranslateAutoPasteTrigger.ts` plus main/preload service paths listed in `translate-core.md`.
- Behavior: enable/disable clipboard-triggered translation, ignore empty/unchanged/busy/self-written content, and clean up subscription state on unmount.

## TUI-08 Polish and translate interaction modes

- Status: `verified` on 2026-08-06. The prepared invocation responsibility is restored in
  `useTranslateInvocationMode`: persistent Preference mode routes buttons, keyboard, and clipboard
  triggers; Alt-click/Alt-held provide temporary polish; middle-click on the toggle performs a
  one-shot polish run without changing the saved state; keyup and window blur clear Alt state.
  Force-refresh excludes Alt/Shift chords. Independent frozen polish/translate plans and cache
  identity remain owned by TC-02/TC-07. Hook, toggle, use-case, and page integration tests pass.
- Source: `34a758ca5c`, `f25a9f18d1`, `bd93a39fa4`, `f3a112262d`, `60059138b9`; `PolishTranslateToggleButton.tsx`, `usePolishTranslateFlow.ts`, `useTranslateFlow.ts`.
- Behavior: persistent `translate:polish:enabled` mode plus one-shot middle-click and temporary Alt-held modes. The persisted mode routes the primary button, keyboard translation, clipboard-route, and auto-paste triggers through polish-then-translate; invocation precedence is explicit option, temporary Alt/middle-click, persisted toggle, then normal translation. Alt state resets on keyup/window blur. Detect language before polishing, use an independent polish model, and keep polished cache identity distinct. Record the V1 default during preference migration tests rather than inferring it from UI state.

## TUI-09 Language controls, flip rules, and bidirectional mode

- Status: `verified` on 2026-08-06. The restored language-control hook keeps exchange restricted to
  valid idle explicit pairs and synchronizes input/raw/display state. The separate Flip action is
  enabled for a valid auto-detected bidirectional run, aborts/replaces the active stream, preserves
  its invocation mode, corrects the source/target pair, clears stale output, retranslates, and warns
  when the pair omits the configured native language. Chinese variants share pair membership and
  Traditional Chinese uses the Taiwan flag. Hook, domain, preset, and active-page tests pass.
- Source: `e90b352b3e`, `e5d95b2599`, `4a40fb171f`, `fad0c1c005`, `7fe4e72363`; `useTranslateLanguageControls.ts`, `FlipButton.tsx`, settings/page.
- Behavior: auto detection and custom languages coexist with explicit source/target selection; detected language appears in the Auto label; exchange is allowed only for valid explicit pairs; Chinese variants obey native-family rules and Traditional Chinese uses the Taiwan flag; bidirectional target decisions are deterministic. Separate Flip aborts and corrects a wrong auto-detected direction, swaps/retranslates, warns when the pair misses the native language, and clears stale overlays/state—Exchange alone is not equivalent.
- V2-native candidate: V2 already contains language bars, custom-language DataApi, bidirectional Preference keys, and target decision utilities; exact rules and failure behavior remain to audit.

## TUI-10 Global, directional, and polish model controls

- Status: `verified` on 2026-08-06. The settings surface preserves a visible global selector,
  independent per-direction follow/pin controls, and independent page/global polish identities.
  Main-side planning validates provider-qualified identities against eligible chat models, falls
  back through global/available candidates, and freezes the chosen IDs into the prepared run.
  Translate service, use-case, page, migration, type, and settings checks pass.
- Source: `7d05dfd96f`, `5bc3845395`, `3049da16c1`; `useDirectionalTranslateModels.ts`, `useTranslateModelControls.ts`, `TranslateSettings.tsx`, `TranslatePage.tsx`.
- Behavior: global selector remains visible; native-to-other and other-to-native directions can independently follow global or pin an override; polish model is independent; missing/hidden/ineligible models safely fall back; current model identity remains stable across async work.
- Existing evidence: source behavior matrix A1-A8 and F4/F6.

## TUI-11 Busy-stage, cancel, and error presentation

- Status: `verified` on 2026-08-06. The extracted flow runner exposes detection, planning/cache,
  polish, translation, and processing stages; file/clipboard/OCR hooks contribute their own busy
  guards. Stop/unmount/replacement share the flow controller, fence late work and success effects,
  and restore the next-run path. Use-case, hook, page, file/OCR, and cross-window tests pass.
- Source: `87114de228`, `b4e809a80b`, `aa74983f91`; `useTranslateBusyStage.ts`, execution/streaming hooks, translate button and page.
- Behavior: detection, polishing, translating, post-processing, file reading, and clipboard reading expose correct busy/disabled states; cancellation terminates the active run, suppresses success effects, ignores stale late results, and permits the next request.
- V2-native candidate: V2 `useTranslate` already guards late chunks and aborts on unmount; multi-stage semantics still require migration.

## TUI-12 Output rendering, Markdown, overflow, and authoritative copy

- Status: `verified` on 2026-08-06. The V2 output pane wraps long text without horizontal page
  overflow, renders optional async Markdown or completed structured JSON, and retains raw model
  output separately for history/cache. Display, explicit copy/export, and auto-copy intentionally
  use the current processed output, matching the prepared V1 clipboard boundary. Component,
  use-case, post-processing, history, and page tests pass.
- Source: `9dd465af4a`, `ef1d2b8ef2`, `ae3b75202f`, `5b1b8501f7`; `TranslateOutputContent.tsx`, `useTranslateMarkdownRenderer.ts`, output pane/page styles.
- Behavior: long output wraps without horizontal/page overflow; Markdown rendering is optional and safe; top-right full-copy, history, and cache use the authoritative raw translation unless a specifically documented current post-processing copy path applies.
- V2-native candidate: V2 output pane and async Shiki rendering exist; source post-processing and JSON boundaries must be restored without weakening raw-data semantics.

## TUI-13 Tolerant completed-output JSON structure view

- Status: `verified` on 2026-08-06. Parser, isolated renderer, completed-output guard, page
  activation, fallback, and output-pane integration are covered by focused JSON/output/page tests.
- Source: commits `ef30671d3d`, `917967aea8`; `jsonStructure.ts`, `JsonStructureView.tsx`, `TranslateOutputContent.tsx`, settings/persistence/tests.
- Behavior: after translation completes, accept only a complete object/array or one standalone JSON fence; try strict parse, then scoped formatter normalization/jsonrepair; render a fully expanded static hierarchy; fall back to Markdown/plain text; keep raw output authoritative for full copy/history/cache.
- Layout/copy: key cells are intrinsic/nonshrinking but capped at 30%/280px; native selection copy normalizes flex-column separator artifacts only within this view.

## TUI-14 JSON display and selection-copy preferences from dirty overlay

- Status: `verified` on 2026-08-06. Decoded display, all four local selection-copy modes, optional
  blank rows, generated Preference defaults/migration, page runtime binding, and the dedicated
  settings card are covered by JSON, page, settings, and migration tests.
- Source overlay hash `b66be933979532438c0466dd2ea16c93b6714dd1`; `JsonStructureView.tsx`, `TranslateSettings.tsx`, `useTranslatePage.ts`, `useTranslateSettingsSync.ts`, translate repository types/implementation and tests/i18n.
- Behavior: decoded JSON strings display real newline/tab characters as React text; dedicated `JSON view` settings card; persisted four-way separator choice (`: `, `:\n`, `：`, `：\n`); optional blank line between selected rows, default off, without double-inserting within a newline-bearing column separator; settings disable while structured view is off but retain saved choices.

## TUI-15 Settings surface decomposition and exact preference semantics

- Status: `verified` on 2026-08-06. The V2 side panel exposes model, language, display, JSON, post-processing,
  regex, prompts, glossary, custom languages, and request options through focused components, and
  every write uses rollback-capable Preference/Data API mutations with visible failure feedback.
  Runtime normalization and migration are verified under TC-17.
- Source: `fad0c1c005`, `b338548e47`, `4026adbb4f`, `27a5022ebf`, `13094dd99d`, `bd700629cb`; `TranslateSettings.tsx` and `pages/settings/TranslateSettingsPopup/*`.
- Behavior: model, language, display, misc, JSON view, post-processing, prompt, glossary, regex replacement, and custom request parameter responsibilities remain discoverable; auto-copy is independent from post-processing; per-rule toggles persist independently under a master post-processing switch.
- V2 adaptation: use Preference/DataApi/SQLite according to V2 ownership and Shadcn components; never add a legacy Redux/Dexie fallback.

## TUI-16 History list behavior and state restoration

- Status: `verified` on 2026-08-06. The V2 Data API now searches source/target text, the displayed
  `MM/DD HH:mm` date form, and renderer-resolved localized language labels/codes while retaining
  server-side paging. Default, search, and starred views expose at most the newest 200 rows to the
  deferred virtual list. Star/delete/clear/copy/detail/reuse remain mutation-backed; reuse restores
  raw text and closes the drawer without changing selectors, and stale languages resolve safely.
  Hook, component, schema, service, and page tests pass.
- Source: `0c4a4ae925`, `4415e4b689`, `2e331d7ff6`; `TranslateHistory.tsx`, `TranslateHistory.test.tsx`, `useTranslateHistorySelection.ts`.
- Behavior: newest 200 rows by default; search and starred-only modes query broadly but cap rendered results at 200; virtualized/deferred list supports star/delete/clear and localized language/date search. Selecting an entry loads raw source/output and closes the drawer but deliberately does not change current source/target selectors; deleted/unknown languages are handled safely. Cache reuse remains distinct from manual selection.
- V2-native candidate: V2 SQLite TranslateHistory service/hooks already exist; old cache-key and restoration semantics require focused comparison.

## TUI-17 Page/module lifecycle and cross-window parity

- Status: `verified` on 2026-08-06. Full-page teardown aborts the flow-owned controller and
  renderer stream, while quick-assistant and selection translators continue to reuse only the
  shared detection/target/stream policies. Selection detection and translation now share one
  AbortSignal across the window lifecycle; pause, replacement, and unmount fence late work.
  Focused quick-assistant/selection tests verify supersession, model loss, and unmount abort.
- Source: `b7aad656b6`, `39fd4efb8b`, `48dca118b4`; page hook/component split, `windows/mini/translate/TranslateWindow.tsx`, `windows/selection/action/components/ActionTranslate.tsx`, window/main platform adapters.
- Behavior: page teardown aborts active work and listeners; shared translation policy is reused where appropriate without forcing full-page UI features into quick/selection translators; explicit model and cancellation identities cross process boundaries correctly.

## TUI-18 Persistent, non-closable Translate tab

- Status: `verified` on 2026-08-06. V2 session reconciliation always restores exactly one normal
  `/app/translate` tab, removes obsolete pinned/duplicate/transient-query copies, and protects the
  live route through the shared tab-policy boundary. Inline/context/batch close, pin/unpin, detach,
  and reorder affordances cannot remove or relocate it. Provider and tab-bar tests pass.
- Source: `80e374a486`; `components/Tab/TabContainer.tsx`, `store/tabs.ts`, tests, page navigation.
- Behavior: Translate behaves as a stable application tab and cannot be accidentally closed; persistence/migration restores it safely.
- V2 note: V2 routing/tab architecture differs; preserve user-visible availability using its native app-shell model.

## TUI-19 Word and prompt-aware token counter

- Status: `verified` on 2026-08-06. The extracted counter hook uses `Intl.Segmenter` word-like
  segments for English, Chinese, mixed text, and punctuation, and estimates tokens from input plus
  the active directional prompt (and polish prompt when active). The input footer exposes both
  counts with an explanatory tooltip. Five focused counter tests and page/component checks pass.
- Source: `useTranslateModelControls.ts`, its focused tests, and the Translate page footer.
- Behavior: show word count based on `Intl.Segmenter` for English, Chinese, and mixed text while ignoring punctuation/whitespace; estimate tokens including the active translation prompt, not input alone; explain the estimate in a popover.
- V2 counterpart: absent from the V2 Translate page.

## TUI-20 Global Translate Clipboard shortcut and route bootstrap

- Status: `verified` on 2026-08-06. The generated Preference schema and unified command registry
  expose a default-enabled global Ctrl/Cmd+Shift+T binding, including migration from legacy
  `show_translate`. Main routes a nonce-scoped command to the stable Translate tab; the extracted
  page hook waits for model loading, dedupes nonce/running/recent triggers, reads through the
  Translate clipboard policy, forces Auto, clears stale state, invokes exactly once, and removes
  the query. Command, migration, routing, hook, tab, type, and i18n checks pass.
- Source: `729083191d`, `a645040361`, `39fd4efb8b`; `store/shortcuts.ts`, i18n labels, main `ShortcutService`/`WindowService`, preload/shared IPC, `useTranslateAutoPasteTrigger.ts`.
- Behavior: default Ctrl/Cmd+Shift+T shows/foregrounds the main window, waits for renderer navigation readiness, opens `/translate?paste=1&_=<nonce>`, then the page waits for settings, reads through the translation clipboard policy, forces Auto source, clears detection, populates input, translates once, suppresses duplicate nonce/running/timestamp triggers, and removes the query.
- V2 counterpart: absent. Implement through V2 shortcut/preferences and app-shell routing. Keep `go_home`, `previous_assistant`, and `next_assistant` as independent shortcut tasks.

## TUI-21 Cache reuse feedback and force-refresh gesture

- Status: `verified` on 2026-08-06. Compatible history restores valid language decisions before
  detection; provider-qualified exact keys and polish composite keys govern reuse. Cache hits now
  identify reuse and explain the platform-specific Ctrl/Cmd-click refresh gesture; that gesture
  bypasses lookup and overwrites through the normal final-history path. Use-case, invocation,
  cache/history, page, and platform-label tests pass.
- Source: history/cache commits through `4415e4b689` and polish cache `60059138b9`; Translate button, flow runner, repository/tests.
- Behavior: text/model-compatible history may restore language decisions before detection; exact pair/model cache hit reuses output and explains Ctrl/Cmd-click refresh; Ctrl/Cmd-click bypasses and overwrites the cache; polish uses a composite identity; ordinary Translate/Stop and Ctrl/Cmd+Enter/Shift+Enter behavior remains intact.
- V2 counterpart: history exists, but cache reuse/overwrite and gesture do not.

## TUI-22 Native/other/polish prompt editors

- Status: `verified` on 2026-08-06. Three independent Preference-backed editors cover
  native-to-other, other-to-native, and polish prompts. The reusable prompt field preserves remote
  loads during local edits, debounces save, flushes on unmount, resets by scope, and keeps the
  legacy single prompt synchronized with native-to-other. Main planning selects the prompt by
  target/native family. Settings, service, migration, and prompt/glossary tests pass.
- Source: `03acbabc4e`, `f25a9f18d1`; `TranslatePromptSettings.tsx`, prompt constants/store, Model Settings and translation services.
- Behavior: separate prompts for translation to the user's native language, translation to other languages, and polishing; responsive editor layout; scope-specific reset/save-on-blur; legacy single prompt synchronized with the other-language prompt; prompt selection based on target versus configured native language.
- V2 counterpart: only one `feature.translate.model_prompt` editor/migration exists.

## TUI-23 Translate and Polish custom-request controls

- Status: `verified` on 2026-08-06. Translate and polish own independent typed parameter arrays and
  minimize-reasoning switches. Main converts string/number/boolean/JSON values at call scope and
  gives provider-specific reasoning parameters precedence. The UI and main now share the same
  override predicate and show a request-scope notice when it applies. Request-options, service,
  settings, migration, type, lint, and i18n checks pass.
- Source: `112171ddbf`, `6d14f154ed`, `dcb5d69312`, `d94800017d`, `fad0c1c005`, `7a45972a7b`, `b338548e47`; `CustomBodySettings.tsx`, store/service/tests.
- Behavior: independent typed string/number/boolean/JSON parameters for translation and polish; immediate persistence/live next-request behavior; independent minimize-thinking switches default on; custom reasoning values may override minimize-thinking and surface a scoped informational notice.
- V2 counterpart: absent; main-owned V2 AI request construction requires a new request-options mapping.

## TUI-24 Custom language CRUD

- Status: `verified` as V2-native on 2026-08-06. The existing typed DataApi/SQLite path and settings
  UI normalize codes, reject invalid/builtin/custom duplicates, preserve emoji/name edits, and
  confirm deletion. Focused settings and service/schema coverage verifies the edge behavior.
- Source: `CustomLanguageModal.tsx`, `CustomLanguageSettings.tsx`, language repository/tests.
- Behavior: add/edit/delete/list emoji, display name, normalized lowercase code; reject duplicates/invalid rows; route through typed repository.
- V2 counterpart: main-process DataApi implementation already provides validated CRUD and emoji UI. Verify migration and edge behavior, then mark `v2-native` if equivalent.

## TUI-25 Responsive toolbar priority and separators

- Status: `verified` on 2026-08-06. The extracted ResizeObserver-based toolbar policy switches at
  the actual 900 px container width: language and global-model controls disappear while translate,
  stop, flip, polish, clipboard, layout, history, and settings remain. Explicit group separators
  are rendered only with their visible groups, avoiding the hidden-language stray divider.
  Policy and narrow-page tests, typecheck, and lint pass.
- Source: `82302777e8`, `513cde65ea`, `729c1e4a12`; Translate toolbar/actions/styles.
- Behavior: below the 900 px toolbar-container threshold, language and model controls disappear
  while primary actions remain available; separators visually divide language, primary-action,
  flip, and polish groups without introducing stray dividers when a group is hidden.
- V2 adaptation: use a container-aware V2 layout when practical and preserve the outcome at narrow
  widths. Verify the exact retained action priority around the threshold.
