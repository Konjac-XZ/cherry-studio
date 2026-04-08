import { loggerService } from '@logger'
import db from '@renderer/databases'
import type { GlossaryEntry, TranslateLanguageCode } from '@renderer/types'
import { v4 as uuidv4 } from 'uuid'

const logger = loggerService.withContext('GlossaryService')

export class GlossaryService {
  private static _isInitialized: boolean = false

  static async init() {
    if (GlossaryService._isInitialized) {
      return
    }

    try {
      await db.open()
      GlossaryService._isInitialized = true
    } catch (error) {
      logger.error('Failed to open Dexie database:', error as Error)
    }
  }

  static async getAll(): Promise<GlossaryEntry[]> {
    await GlossaryService.init()
    const entries = await db.translate_glossary.toArray()
    return entries.sort((a, b) => b.createdAt - a.createdAt)
  }

  static async getByTargetLanguage(langCode: TranslateLanguageCode): Promise<GlossaryEntry[]> {
    await GlossaryService.init()
    return db.translate_glossary.where('targetLanguage').equals(langCode).toArray()
  }

  static async add(
    data: Pick<GlossaryEntry, 'sourcePhrase' | 'targetPhrase' | 'targetLanguage'>
  ): Promise<GlossaryEntry> {
    await GlossaryService.init()

    const existing = await db.translate_glossary
      .where('targetLanguage')
      .equals(data.targetLanguage)
      .filter((e) => e.sourcePhrase.toLowerCase() === data.sourcePhrase.toLowerCase())
      .first()

    if (existing) {
      throw new Error('DUPLICATE_ENTRY')
    }

    const now = Date.now()
    const entry: GlossaryEntry = {
      id: uuidv4(),
      sourcePhrase: data.sourcePhrase,
      targetPhrase: data.targetPhrase,
      targetLanguage: data.targetLanguage,
      createdAt: now,
      updatedAt: now
    }

    await db.translate_glossary.add(entry)
    return entry
  }

  static async update(
    id: string,
    data: Partial<Pick<GlossaryEntry, 'sourcePhrase' | 'targetPhrase' | 'targetLanguage'>>
  ): Promise<void> {
    await GlossaryService.init()
    await db.translate_glossary.update(id, {
      ...data,
      updatedAt: Date.now()
    })
  }

  static async delete(id: string): Promise<void> {
    await GlossaryService.init()
    await db.translate_glossary.delete(id)
  }
}

export function buildCustomizedDictionary(entries: GlossaryEntry[], inputText: string): string {
  const lowerInput = inputText.toLowerCase()
  const matched = entries.filter((entry) => lowerInput.includes(entry.sourcePhrase.toLowerCase()))
  if (matched.length === 0) {
    return '[No glossary requiring specified translations was found in the original text]'
  }
  return matched.map((entry) => `${entry.sourcePhrase} -> ${entry.targetPhrase}`).join('\n')
}

export default GlossaryService
