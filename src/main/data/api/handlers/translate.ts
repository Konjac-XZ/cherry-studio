/**
 * Translate API Handlers
 *
 * Implements translate history and custom language endpoints.
 * All input validation happens here at the system boundary.
 */

import { translateGlossaryService } from '@data/services/TranslateGlossaryService'
import { translateHistoryService } from '@data/services/TranslateHistoryService'
import { translateLanguageService } from '@data/services/TranslateLanguageService'
import type { TranslateSchemas } from '@shared/data/api/schemas/translate'
import {
  CreateTranslateGlossaryEntrySchema,
  CreateTranslateHistorySchema,
  CreateTranslateLanguageSchema,
  TranslateGlossaryQuerySchema,
  TranslateHistoryQuerySchema,
  UpdateTranslateGlossaryEntrySchema,
  UpdateTranslateHistorySchema,
  UpdateTranslateLanguageSchema
} from '@shared/data/api/schemas/translate'
import type { HandlersFor } from '@shared/data/api/types'

export const translateHandlers: HandlersFor<TranslateSchemas> = {
  '/translate/histories': {
    GET: async ({ query }) => {
      const parsed = TranslateHistoryQuerySchema.parse(query ?? {})
      return translateHistoryService.list(parsed)
    },
    POST: async ({ body }) => {
      const parsed = CreateTranslateHistorySchema.parse(body)
      return translateHistoryService.create(parsed)
    },
    DELETE: async () => {
      translateHistoryService.clearAll()
      return undefined
    }
  },

  '/translate/histories/:id': {
    GET: async ({ params }) => {
      return translateHistoryService.getById(params.id)
    },
    PATCH: async ({ params, body }) => {
      const parsed = UpdateTranslateHistorySchema.parse(body)
      return translateHistoryService.update(params.id, parsed)
    },
    DELETE: async ({ params }) => {
      translateHistoryService.delete(params.id)
      return undefined
    }
  },

  '/translate/languages': {
    GET: async () => {
      return translateLanguageService.list()
    },
    POST: async ({ body }) => {
      const parsed = CreateTranslateLanguageSchema.parse(body)
      return translateLanguageService.create(parsed)
    }
  },

  '/translate/languages/:langCode': {
    GET: async ({ params }) => {
      return translateLanguageService.getByLangCode(params.langCode)
    },
    PATCH: async ({ params, body }) => {
      const parsed = UpdateTranslateLanguageSchema.parse(body)
      return translateLanguageService.update(params.langCode, parsed)
    },
    DELETE: async ({ params }) => {
      translateLanguageService.delete(params.langCode)
      return undefined
    }
  },

  '/translate/glossary': {
    GET: async ({ query }) => translateGlossaryService.list(TranslateGlossaryQuerySchema.parse(query ?? {})),
    POST: async ({ body }) => translateGlossaryService.create(CreateTranslateGlossaryEntrySchema.parse(body))
  },

  '/translate/glossary/:id': {
    GET: async ({ params }) => translateGlossaryService.getById(params.id),
    PATCH: async ({ params, body }) =>
      translateGlossaryService.update(params.id, UpdateTranslateGlossaryEntrySchema.parse(body)),
    DELETE: async ({ params }) => {
      translateGlossaryService.delete(params.id)
      return undefined
    }
  }
}
