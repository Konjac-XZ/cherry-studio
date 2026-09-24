import { describe, expect, it } from 'vitest'

import type { TranslateBidirectionalPair } from '@shared/data/preference/preferenceTypes'
import type { TranslateLanguage } from '@shared/data/types/translate'

import { determineTargetLanguage, pickBidirectionalTarget } from '../language'

const lang = (langCode: string, value: string): TranslateLanguage =>
  ({
    langCode,
    value,
    emoji: '🏳️',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }) as TranslateLanguage

const english = lang('en-us', 'English')
const chinese = lang('zh-cn', 'Chinese')
const japanese = lang('ja-jp', 'Japanese')
const bidirectionalPair = ['en-us', 'zh-cn'] satisfies TranslateBidirectionalPair

describe('translate bidirectional helpers', () => {
  describe('pickBidirectionalTarget', () => {
    it.each([
      ['uses the override target when one is provided', 'en-us', japanese, japanese],
      ['uses alter when detected source equals preferred', 'zh-cn', undefined, english],
      ['uses alter when detected Chinese is a variant of preferred Chinese', 'zh-tw', undefined, english],
      ['uses preferred when detected source equals alter', 'en-us', undefined, chinese],
      ['uses preferred when detected source is unknown', 'unknown', undefined, chinese]
    ] as const)('%s', (_name, sourceLanguage, overrideTarget, expectedTarget) => {
      expect(pickBidirectionalTarget(sourceLanguage, chinese, english, overrideTarget)).toBe(expectedTarget)
    })
  })

  describe('determineTargetLanguage', () => {
    it.each([
      ['uses the selected target in direct mode', 'zh-cn', 'ja-jp', false, { success: true, language: 'ja-jp' }],
      [
        'rejects the same language in direct mode',
        'en-us',
        'en-us',
        false,
        { success: false, errorType: 'same_language' }
      ],
      ['maps the first pair member to the second', 'en-us', 'ja-jp', true, { success: true, language: 'zh-cn' }],
      ['maps the second pair member to the first', 'zh-cn', 'ja-jp', true, { success: true, language: 'en-us' }],
      [
        'treats Traditional Chinese as the configured Chinese family member',
        'zh-tw',
        'ja-jp',
        true,
        { success: true, language: 'en-us' }
      ],
      [
        'supports exact custom-language members without guessing deleted codes',
        'custom-klingon',
        'en-us',
        true,
        { success: false, errorType: 'not_in_pair' }
      ],
      [
        'rejects a detected language outside the pair',
        'ja-jp',
        'en-us',
        true,
        { success: false, errorType: 'not_in_pair' }
      ]
    ] as const)('%s', (_name, sourceLanguage, targetLanguage, isBidirectional, expected) => {
      expect(determineTargetLanguage(sourceLanguage, targetLanguage, isBidirectional, bidirectionalPair)).toEqual(
        expected
      )
    })

    it.each([
      ['targets Chinese when English is not the native language', 'en-us', bidirectionalPair, 'zh-cn', 'zh-cn'],
      ['targets Chinese when Japanese is outside the pair', 'ja-jp', bidirectionalPair, 'zh-cn', 'zh-cn'],
      ['translates Simplified Chinese away from the native language', 'zh-cn', bidirectionalPair, 'zh-cn', 'en-us'],
      [
        'treats Traditional Chinese as the Simplified Chinese native language',
        'zh-tw',
        bidirectionalPair,
        'zh-cn',
        'en-us'
      ],
      [
        'treats Simplified Chinese as the Traditional Chinese pair member and native language',
        'zh-cn',
        ['en-us', 'zh-tw'],
        'zh-tw',
        'en-us'
      ]
    ] as const)('%s', (_name, source, pair, nativeLanguage, expectedTarget) => {
      expect(determineTargetLanguage(source, 'ja-jp', true, [...pair], nativeLanguage)).toEqual({
        success: true,
        language: expectedTarget
      })
    })

    it('keeps rejecting outside-pair languages when the native language is not in the pair', () => {
      expect(determineTargetLanguage('ja-jp', 'en-us', true, bidirectionalPair, 'ko-kr')).toEqual({
        success: false,
        errorType: 'not_in_pair'
      })
    })
  })
})
