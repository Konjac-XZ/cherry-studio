import {
  getQuickModelProviderOptionsOverrides
} from '@renderer/services/quickModelRequest'
import { describe, expect, it } from 'vitest'

describe('quickModelRequest', () => {
  describe('getQuickModelProviderOptionsOverrides', () => {
    it('should disable thinking for qwen quick models', () => {
      expect(getQuickModelProviderOptionsOverrides('qwen3-32b')).toEqual({
        enable_thinking: false
      })
    })

    it('should set minimal reasoning effort for doubao quick models', () => {
      expect(getQuickModelProviderOptionsOverrides('doubao-seed-1.8-thinking')).toEqual({
        reasoningEffort: 'minimal'
      })
    })

    it('should disable thinking payload for glm quick models', () => {
      expect(getQuickModelProviderOptionsOverrides('glm-4.5-flash')).toEqual({
        thinking: {
          type: false
        }
      })
    })

    it('should merge all matching overrides', () => {
      expect(getQuickModelProviderOptionsOverrides('qwen-doubao-glm')).toEqual({
        enable_thinking: false,
        reasoningEffort: 'minimal',
        thinking: {
          type: false
        }
      })
    })

    it('should return undefined for unrelated models', () => {
      expect(getQuickModelProviderOptionsOverrides('gpt-4.1-mini')).toBeUndefined()
    })
  })
})
