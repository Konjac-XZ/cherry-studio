import { setupTestDatabase } from '@test-helpers/db'
import { beforeEach, describe, expect, it } from 'vitest'

import { translateGlossaryTable } from '@data/db/schemas/translateGlossary'
import { translateLanguageTable } from '@data/db/schemas/translateLanguage'
import { buildCustomizedDictionary, translateGlossaryService } from '@data/services/TranslateGlossaryService'
import { ErrorCode } from '@shared/data/api/errors'
import { parsePersistedLangCode } from '@shared/data/preference/preferenceTypes'

describe('TranslateGlossaryService', () => {
  const dbh = setupTestDatabase()

  beforeEach(async () => {
    await dbh.db.insert(translateLanguageTable).values({ langCode: 'zh-cn', value: 'Chinese', emoji: '🇨🇳' })
  })

  it('creates, lists, updates, and deletes entries', () => {
    const created = translateGlossaryService.create({
      sourcePhrase: 'Cherry Studio',
      targetPhrase: '樱桃工作室',
      targetLanguage: parsePersistedLangCode('zh-cn')
    })
    expect(translateGlossaryService.list({ targetLanguage: parsePersistedLangCode('zh-cn') })).toEqual([created])

    const updated = translateGlossaryService.update(created.id, { enabled: false })
    expect(updated.enabled).toBe(false)
    expect(translateGlossaryService.list({ enabled: true })).toHaveLength(0)

    translateGlossaryService.delete(created.id)
    expect(dbh.db.select().from(translateGlossaryTable).all()).toHaveLength(0)
  })

  it('rejects case-insensitive duplicates within one target language', () => {
    const dto = {
      sourcePhrase: 'OpenAI',
      targetPhrase: '开放人工智能',
      targetLanguage: parsePersistedLangCode('zh-cn')
    }
    translateGlossaryService.create(dto)

    expect(() => translateGlossaryService.create({ ...dto, sourcePhrase: 'openai' })).toThrow(
      expect.objectContaining({ code: ErrorCode.CONFLICT })
    )
  })

  it('injects only enabled entries whose source phrase occurs in the input', () => {
    const now = new Date().toISOString()
    const entries = [
      {
        id: '0198f60d-e597-7000-8000-000000000001',
        sourcePhrase: 'OpenAI',
        targetPhrase: '开放人工智能',
        targetLanguage: parsePersistedLangCode('zh-cn'),
        enabled: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: '0198f60d-e597-7000-8000-000000000002',
        sourcePhrase: 'hidden',
        targetPhrase: '隐藏',
        targetLanguage: parsePersistedLangCode('zh-cn'),
        enabled: false,
        createdAt: now,
        updatedAt: now
      }
    ]

    expect(buildCustomizedDictionary(entries, 'An OPENAI model')).toBe('OpenAI -> 开放人工智能')
    expect(buildCustomizedDictionary(entries, 'Nothing matched')).toContain('No glossary')
  })
})
