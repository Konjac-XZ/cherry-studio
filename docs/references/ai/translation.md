---
description: Text translation planning and streaming flow, including model freezing, persistence, source language, and trace ownership
sources:
  - src/shared/ipc/schemas/translate.ts
  - src/main/ipc/handlers/translate.ts
  - src/main/services/translate/translateService.ts
  - src/shared/data/preference/preferenceSchemas.ts
  - src/renderer/utils/translate/translateText.ts
  - src/main/services/translate/forkTranslateService.ts
  - src/main/services/translate/translateRequestOptions.ts
  - src/renderer/components/translate/TranslateSettings.tsx
  - src/renderer/pages/home/messages/homeMessageListAdapter.tsx
---

# Text Translation

This document covers one-shot text translation through `translate.open`.
PDF translation uses the separate `translate.pdf.*` routes and
`PdfTranslationService`.

## Active flow

```text
Renderer caller
  -> translate.plan({ targetLangCode, operation })
       `-> freeze modelId for the run
  -> subscribe to ai.stream.* for a renderer-generated translate:* streamId
  -> translate.open({ streamId, text, targetLangCode, operation, modelId, ...optional ownership fields })
       -> translateService.open
       -> AiStreamManager.streamPrompt
       -> WebContentsListener (+ optional persistence and trace listeners)
       -> ai.stream.chunk / done / error
```

TranslatePage can run a polish stage followed by translation while reusing its
frozen model and trace container. Selection and message translation use the
same helper; Home persists the returned text through its chat write boundary.

## Ownership

The responsibilities deliberately split at the renderer/Main boundary:

| Owner | Responsibility |
|---|---|
| Renderer caller | Preprocess the authoritative source, choose the operation, and decide whether message persistence or tracing applies |
| `translateText` | Plan/freeze the model, generate a stream ID, subscribe before opening, accumulate chunks, and bridge abort |
| `translate.open` handler | Validate the managed-window sender and delegate to the service |
| `forkTranslateService` | Validate the frozen model and language, build the directional prompt, apply glossary/request options and model sampling gates, and open the prompt stream |
| `AiStreamManager` | Run the prompt stream and deliver chunks through the listener stack |

`translateService` is a direct-import singleton because it owns no long-lived
resource or persistent side effect. The lifecycle-owned `IpcApiService` owns
the persistent IPC registration.

## IPC contract

`translate.plan` accepts a concrete target language and an optional `operation`
(`translate` or `polish`) and returns the model identity frozen for that run.

`translate.open` requires three transport fields and accepts the local ownership
superset:

```ts
ipcApi.request('translate.open', {
  streamId,
  text,
  targetLangCode,
  operation,
  modelId,
  messageId,
  sourceLangCode,
  traceTopicId,
  traceId
})
```

- `streamId` is renderer-generated and must start with `translate:`. The
  namespace prevents collisions with real chat topic IDs when abort uses
  `ai.stream.abort({ topicId: streamId })`.
- `targetLangCode` must be a concrete configured language, not `unknown`.
- `operation` defaults to translation. `modelId`, when present, must remain an
  eligible model rather than silently switching during a staged run.
- `messageId` opts into Main-side `data-translation` persistence;
  `sourceLangCode` is copied into that part when supplied.
- `traceId` is valid only with a canonical `translate:<uuid>` `traceTopicId`.
- The renderer subscribes to `ai.stream.chunk`, `ai.stream.done`, and
  `ai.stream.error` before it calls `translate.open`, because Main starts the
  stream synchronously.

## Model parameters

The active IPC handler delegates to `forkTranslateService`. It reads directional
models, prompts, and separate translation/polish custom parameters from Main-side
Preference. Explicit provider reasoning parameters override the operation's
auto-disable switch. Otherwise, auto-disable requests `none`: turn thinking off
when supported, or select the lowest declared effort.

The existing custom-parameter editor remains the active configuration surface.
Temperature and top-p use the shared model sampling gates; `top_p` is normalized
to `topP`, with explicit `topP` taking precedence if both are present. Other
provider parameters remain explicit overrides. As in upstream, the gates use
the model's declared reasoning vocabulary; endpoint-specific and custom provider
reasoning are resolved later by the AI pipeline.

The upstream `translateService` and its temperature/top-p/reasoning preferences
remain available in the upstream implementation, but do not control the active
fork route. PDF translation uses BabelDoc through the API gateway separately.

## Home message persistence

Home chat owns the message projection through its existing chat write boundary:

1. `homeMessageListAdapter.translateMessage` aborts any older translation for
   the same message.
2. It writes an empty `data-translation` part so the loading UI has a committed
   target.
3. Each accumulated response replaces that part through
   `ChatWrite.editMessage`; updates are serialized so a slower write cannot
   overwrite a later chunk.
4. Completion waits for pending writes. Failure or abort removes the translation
   part when that controller still owns the translation.

This active path does not pass `messageId` to Main. Starting a new translation
replaces the previous translation; failure does not restore that older result.

The fork's optional `messageId` contract and `TranslationBackend` still exist:
they replace the previous part only on success and discard paused or failed
output. The old `useTranslateMessage` hook has no production caller; do not
rewire Home to it or introduce another overlay owner.

Translate history is owned separately by the Translate page after preprocessing:
the stored source is the authoritative processed source, not the raw clipboard
value. `translate.open` does not write `translate_history` rows.

## Validation

- `src/renderer/utils/translate/__tests__/translateText.test.ts` covers stream
  IDs, planning, frozen models, chunk accumulation, terminal events, errors,
  and abort.
- `src/main/ai/streamManager/persistence/backends/__tests__/TranslationBackend.test.ts`
  covers message-part replacement and discard-on-cancel.
- `src/main/services/translate/__tests__/translateService.test.ts` covers
  upstream model/prompt resolution, model-parameter gating, request validation,
  and stream dispatch.
- `src/main/services/translate/__tests__/forkTranslateService.test.ts` and
  `translateRequestOptions.test.ts` cover directional/frozen models, operation
  parameters, sampling gates, trace ownership, and the fork stream contract.
- `src/renderer/pages/home/messages/__tests__/homeMessageListAdapter.test.tsx`
  covers the active chat translation write lifecycle.
- `src/main/ipc/handlers/__tests__/translate.test.ts` covers sender resolution
  and handler delegation.
