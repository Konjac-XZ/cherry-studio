import * as z from 'zod'

import { TranslateLangCodeSchema } from '@shared/data/preference/preferenceTypes'
import { UniqueModelIdSchema } from '@shared/data/types/model'
import { TraceIdSchema } from '@shared/data/types/trace'
import { TranslateOperationSchema } from '@shared/data/types/translate'
import { AbsoluteFilePathSchema } from '@shared/types/file'

import { defineRoute } from '../define'

const pdfJobInputSchema = z.strictObject({ jobId: z.uuid() })
export const TranslateTraceTopicIdSchema = z
  .string()
  .regex(/^translate:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)

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
      targetLangCode: TranslateLangCodeSchema,
      operation: TranslateOperationSchema.optional()
    }),
    output: z.object({ modelId: UniqueModelIdSchema })
  }),
  'translate.open': defineRoute({
    input: z
      .object({
        streamId: z.string(),
        text: z.string(),
        targetLangCode: TranslateLangCodeSchema,
        operation: TranslateOperationSchema.optional(),
        /** Freeze a model returned by translate.plan for this exact run. */
        modelId: UniqueModelIdSchema.optional(),
        messageId: z.string().optional(),
        sourceLangCode: TranslateLangCodeSchema.optional(),
        traceTopicId: TranslateTraceTopicIdSchema.optional(),
        traceId: TraceIdSchema.optional()
      })
      .refine((input) => !input.traceId || input.traceTopicId, {
        message: 'traceTopicId is required when traceId is provided',
        path: ['traceTopicId']
      }),
    output: z.object({ streamId: z.string(), traceId: TraceIdSchema.optional() })
  }),
  'translate.clipboard_watch.start': defineRoute({ input: z.void(), output: z.boolean() }),
  'translate.clipboard_watch.stop': defineRoute({ input: z.void(), output: z.void() }),
  'translate.clipboard.read': defineRoute({
    input: z.void(),
    output: z.object({ text: z.string(), html: z.string() })
  }),
  'translate.clipboard.write': defineRoute({ input: z.string(), output: z.boolean() }),
  'translate.window.focus': defineRoute({ input: z.void(), output: z.void() }),
  'translate.pdf.start': defineRoute({
    input: pdfJobInputSchema.extend({
      sourcePath: AbsoluteFilePathSchema,
      sourceLangCode: z.union([z.literal('auto'), TranslateLangCodeSchema]),
      targetLangCode: TranslateLangCodeSchema.refine((code) => code !== 'unknown', {
        message: 'targetLangCode must be a concrete language, not "unknown"'
      }),
      modelId: UniqueModelIdSchema
    }),
    /**
     * `outputPath` is the translated PDF's managed location — the run records itself in
     * translate history and hands the artifact to FileManager, so there is no temp file
     * for the renderer to clean up (hence no `translate.pdf.cleanup` companion route).
     */
    output: z.strictObject({ outputPath: AbsoluteFilePathSchema, fileName: z.string().min(1) })
  }),
  'translate.pdf.cancel': defineRoute({ input: pdfJobInputSchema, output: z.void() })
}

export const PDF_TRANSLATION_PROGRESS_STAGES = [
  'checking_assets',
  'downloading_assets',
  'loading_model',
  'parsing',
  'analyzing',
  'extracting_terms',
  'translating',
  'typesetting',
  'rendering'
] as const

export type PdfTranslationProgressStage = (typeof PDF_TRANSLATION_PROGRESS_STAGES)[number]

export interface PdfTranslationProgress {
  stage: PdfTranslationProgressStage
  /** Completion within the current stage, or null when BabelDOC cannot measure it. */
  stageProgress: number | null
  /** Monotonic completion across initialization and translation, 0–100. */
  overallProgress: number
}

/** Coarse pipeline stage reported via `onStage`, distinct from the fine-grained `PdfTranslationProgressStage`. */
export type PdfTranslationStage = 'preparing' | 'downloading_assets' | 'translating'

export type TranslateEventSchemas = {
  'translate.clipboard_changed': { sequence: number }
  'translate.clipboard_watch_unavailable': { reason: string }
  'translate.pdf.stage': {
    jobId: string
    stage: PdfTranslationStage
  }
  'translate.pdf.progress': PdfTranslationProgress & {
    jobId: string
  }
}
