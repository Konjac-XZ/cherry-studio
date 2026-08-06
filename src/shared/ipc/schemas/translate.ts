import type { TranslateLangCode } from '@shared/data/preference/preferenceTypes'
import { UniqueModelIdSchema } from '@shared/data/types/model'
import { TranslateOperationSchema } from '@shared/data/types/translate'
import * as z from 'zod'

import { defineRoute } from '../define'

/**
 * Translate IPC schema — an independent micro-domain (plan ruling 16). `translate.open`
 * OPENS a streaming translation and returns its `streamId`; the streamed chunks/done/error
 * keep riding the shared `ai.stream_*` events (keyed by streamId), and abort goes through
 * `ai.stream.abort` — none of that changes here. The renderer subscribes to those events
 * before calling `open`. `streamId` must be prefixed `translate:` (validated in the service).
 */
export const translateRequestSchemas = {
  'translate.plan': defineRoute({
    input: z.object({
      targetLangCode: z.custom<TranslateLangCode>(),
      operation: TranslateOperationSchema.optional()
    }),
    output: z.object({ modelId: UniqueModelIdSchema })
  }),
  'translate.open': defineRoute({
    input: z.object({
      streamId: z.string(),
      text: z.string(),
      targetLangCode: z.custom<TranslateLangCode>(),
      operation: TranslateOperationSchema.optional(),
      /** Freeze a model returned by translate.plan for this exact run. */
      modelId: UniqueModelIdSchema.optional(),
      messageId: z.string().optional(),
      sourceLangCode: z.custom<TranslateLangCode>().optional()
    }),
    output: z.object({ streamId: z.string() })
  }),
  'translate.clipboard_watch.start': defineRoute({ input: z.void(), output: z.boolean() }),
  'translate.clipboard_watch.stop': defineRoute({ input: z.void(), output: z.void() }),
  'translate.clipboard.read': defineRoute({
    input: z.void(),
    output: z.object({ text: z.string(), html: z.string() })
  }),
  'translate.clipboard.write': defineRoute({ input: z.string(), output: z.boolean() }),
  'translate.window.focus': defineRoute({ input: z.void(), output: z.void() })
}

export type TranslateEventSchemas = {
  'translate.clipboard_changed': { sequence: number }
  'translate.clipboard_watch_unavailable': { reason: string }
}
