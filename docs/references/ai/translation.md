---
description: Text translation planning and streaming flow, including model freezing, persistence, source language, and trace ownership
sources:
  - src/shared/ipc/schemas/translate.ts
  - src/main/ipc/handlers/translate.ts
  - src/main/services/translate/translateService.ts
  - src/renderer/utils/translate/translateText.ts
  - src/renderer/utils/translate/translateText.ts
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
same helper and may either keep the result locally or provide a message target.

## Ownership

The responsibilities deliberately split at the renderer/Main boundary:

| Owner | Responsibility |
|---|---|
| Renderer caller | Preprocess the authoritative source, choose the operation, and decide whether message persistence or tracing applies |
| `translateText` | Plan/freeze the model, generate a stream ID, subscribe before opening, accumulate chunks, and bridge abort |
| `translate.open` handler | Validate the managed-window sender and delegate to the service |
| `translateService` | Validate the frozen model and language, build the directional prompt, apply glossary/request options, and open the prompt stream |
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

When `messageId` is present, `TranslationBackend` replaces the previous
`data-translation` part only after a successful terminal result and preserves
all unrelated message parts. Paused or failed streams do not persist partial
text. Translate history is owned separately by the Translate page after its
preprocessing boundary: the source stored there is the authoritative processed
source, not the raw clipboard value.

## Validation

- `src/renderer/utils/translate/__tests__/translateText.test.ts` covers stream
  IDs, planning, frozen models, chunk accumulation, terminal events, errors,
  and abort.
- `src/main/ai/streamManager/persistence/backends/__tests__/TranslationBackend.test.ts`
  covers message-part replacement and discard-on-cancel.
- `src/main/services/translate/__tests__/translateService.test.ts` covers
  model/prompt resolution, request validation, and stream dispatch.
- `src/main/ipc/handlers/__tests__/translate.test.ts` covers sender resolution
  and handler delegation.
