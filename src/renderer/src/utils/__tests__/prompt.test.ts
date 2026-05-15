import { configureStore } from '@reduxjs/toolkit'
import { type Assistant, type MCPTool, type Model } from '@renderer/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AvailableTools,
  buildSystemPromptWithThinkTool,
  buildSystemPromptWithTools,
  containsSupportedVariables,
  replacePromptVariables,
  SYSTEM_PROMPT,
  THINK_TOOL_PROMPT,
  ToolUseExamples
} from '../prompt'

const mocks = vi.hoisted(() => ({
  glossaryGetAll: vi.fn()
}))

// Mock window.api
const mockApi = {
  system: {
    getDeviceType: vi.fn()
  },
  getAppInfo: vi.fn()
}

vi.mock('@renderer/store', () => {
  const mockStore = configureStore({
    reducer: {
      settings: (
        state = {
          language: 'zh-CN',
          userName: 'MockUser'
        }
      ) => state
    }
  })
  return {
    default: mockStore,
    __esModule: true
  }
})

vi.mock('@renderer/services/GlossaryService', () => ({
  GlossaryService: {
    getAll: mocks.glossaryGetAll
  },
  buildFullCustomizedDictionary: (entries: Array<{ sourcePhrase: string; targetPhrase: string }>) => {
    if (entries.length === 0) {
      return '[No glossary entries configured]'
    }
    return entries.map((entry) => `${entry.sourcePhrase} -> ${entry.targetPhrase}`).join('\n')
  },
  GLOSSARY_LOAD_FAILED_MESSAGE: '[Failed to load glossary entries]'
}))

// Helper to create a mock MCPTool
const createMockTool = (id: string, description: string, inputSchema: any = {}): MCPTool => ({
  id,
  serverId: 'test-server',
  serverName: 'Test Server',
  name: id,
  description,
  inputSchema: {
    type: 'object',
    title: `${id}-schema`,
    properties: {},
    ...inputSchema
  },
  type: 'mcp'
})

// Helper to create a mock Assistant
const createMockAssistant = (name: string, modelName: string): Assistant => ({
  id: 'asst_mock_123',
  name,
  prompt: 'You are a helpful assistant.',
  topics: [],
  type: 'assistant',
  model: {
    id: modelName,
    name: modelName,
    provider: 'mock'
  } as unknown as Model
})

// 设置全局 mocks
Object.defineProperty(window, 'api', {
  value: mockApi,
  writable: true
})

describe('prompt', () => {
  const mockDate = new Date('2024-01-01T12:00:00Z')

  beforeEach(() => {
    // 重置所有 mocks
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(mockDate)

    // 设置默认的 mock 返回值
    mockApi.system.getDeviceType.mockResolvedValue('macOS')
    mockApi.getAppInfo.mockResolvedValue({ arch: 'darwin64' })
    mocks.glossaryGetAll.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('AvailableTools', () => {
    it('should generate XML format for tools with strict equality', () => {
      const tools = [createMockTool('test-tool', 'Test tool description')]
      const result = AvailableTools(tools)
      const expectedXml = `<tools>

<tool>
  <name>test-tool</name>
  <description>Test tool description</description>
  <arguments>
    {"type":"object","title":"test-tool-schema","properties":{}}
  </arguments>
</tool>

</tools>`
      expect(result).toEqual(expectedXml)
    })

    it('should handle empty tools array and return just the container tags', () => {
      const result = AvailableTools([])
      const expectedXml = `<tools>

</tools>`
      expect(result).toEqual(expectedXml)
    })
  })

  describe('buildSystemPrompt', () => {
    it('should replace all variables correctly with strict equality', async () => {
      const userPrompt = `
以下是一些辅助信息:
  - 日期和时间: {{datetime}};
  - 操作系统: {{system}};
  - 中央处理器架构: {{arch}};
  - 语言: {{language}};
  - 模型名称: {{model_name}};
  - 用户名称: {{username}};
`
      const assistant = createMockAssistant('MyAssistant', 'Super-Model-X')
      const result = await replacePromptVariables(userPrompt, assistant.model?.name)
      const expectedPrompt = `
以下是一些辅助信息:
  - 日期和时间: ${mockDate.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  })};
  - 操作系统: macOS;
  - 中央处理器架构: darwin64;
  - 语言: zh-CN;
  - 模型名称: Super-Model-X;
  - 用户名称: MockUser;
`
      expect(result).toEqual(expectedPrompt)
    })

    it('should handle API errors gracefully and use fallback values', async () => {
      mockApi.system.getDeviceType.mockRejectedValue(new Error('API Error'))
      mockApi.getAppInfo.mockRejectedValue(new Error('API Error'))

      const userPrompt = 'System: {{system}}, Architecture: {{arch}}'
      const result = await replacePromptVariables(userPrompt)
      const expectedPrompt = 'System: Unknown System, Architecture: Unknown Architecture'
      expect(result).toEqual(expectedPrompt)
    })

    it('should handle non-string input gracefully', async () => {
      const result = await replacePromptVariables(null as any)
      expect(result).toBe(null)
    })

    it('should detect customized dictionary as a supported variable', () => {
      expect(containsSupportedVariables('Glossary:\n{{customized_dictionary}}')).toBe(true)
    })

    it('should replace customized dictionary with all glossary entries', async () => {
      mocks.glossaryGetAll.mockResolvedValue([
        {
          id: 'entry-1',
          sourcePhrase: 'Cherry Studio',
          targetPhrase: 'Cherry Studio',
          targetLanguage: 'zh-cn',
          createdAt: 2,
          updatedAt: 2
        },
        {
          id: 'entry-2',
          sourcePhrase: 'prompt',
          targetPhrase: '提示词',
          targetLanguage: 'zh-cn',
          createdAt: 1,
          updatedAt: 1
        }
      ])

      const result = await replacePromptVariables('Glossary:\n{{customized_dictionary}}')

      expect(mocks.glossaryGetAll).toHaveBeenCalledOnce()
      expect(result).toBe('Glossary:\nCherry Studio -> Cherry Studio\nprompt -> 提示词')
    })

    it('should replace customized dictionary with an empty-state message when no entries exist', async () => {
      mocks.glossaryGetAll.mockResolvedValue([])

      const result = await replacePromptVariables('Glossary:\n{{customized_dictionary}}')

      expect(result).toBe('Glossary:\n[No glossary entries configured]')
    })

    it('should replace customized dictionary with a fallback message when glossary loading fails', async () => {
      mocks.glossaryGetAll.mockRejectedValue(new Error('DB Error'))

      const result = await replacePromptVariables('Glossary:\n{{customized_dictionary}}')

      expect(result).toBe('Glossary:\n[Failed to load glossary entries]')
    })
  })

  describe('Tool prompt composition', () => {
    let basePrompt: string
    let expectedBasePrompt: string
    let tools: MCPTool[]

    beforeEach(async () => {
      const initialPrompt = `
        System Information:
        - Date: {{date}}
        - User: {{username}}

        Instructions: Be helpful.
      `
      const assistant = createMockAssistant('Test Assistant', 'Advanced-AI-Model')
      basePrompt = await replacePromptVariables(initialPrompt, assistant.model?.name)
      expectedBasePrompt = `
        System Information:
        - Date: ${mockDate.toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        })}
        - User: MockUser

        Instructions: Be helpful.
      `
      tools = [createMockTool('web_search', 'Search the web')]
    })

    it('should build a full prompt for "prompt" toolUseMode', () => {
      const finalPrompt = buildSystemPromptWithTools(basePrompt, tools)
      const expectedFinalPrompt = SYSTEM_PROMPT.replace('{{ USER_SYSTEM_PROMPT }}', expectedBasePrompt)
        .replace('{{ TOOL_USE_EXAMPLES }}', ToolUseExamples)
        .replace('{{ AVAILABLE_TOOLS }}', AvailableTools(tools))

      expect(finalPrompt).toEqual(expectedFinalPrompt)
      expect(finalPrompt).toContain('## Tool Use Formatting')
    })

    it('should build a think-only prompt for native function calling mode', () => {
      const finalPrompt = buildSystemPromptWithThinkTool(basePrompt)
      const expectedFinalPrompt = THINK_TOOL_PROMPT.replace('{{ USER_SYSTEM_PROMPT }}', expectedBasePrompt)

      expect(finalPrompt).toEqual(expectedFinalPrompt)
      expect(finalPrompt).not.toContain('## Tool Use Formatting')
      // expect(finalPrompt).toContain('## Using the think tool')
    })

    it('should return the original prompt if no tools are provided to buildSystemPromptWithTools', () => {
      const result = buildSystemPromptWithTools(basePrompt, [])
      expect(result).toBe(basePrompt)
    })
  })

  describe('buildSystemPromptWithTools', () => {
    it('should build a full prompt for "prompt" toolUseMode', async () => {
      const assistant = createMockAssistant('Test Assistant', 'Advanced-AI-Model')
      const basePrompt = await replacePromptVariables('Be helpful.', assistant.model?.name)
      const tools = [createMockTool('web_search', 'Search the web')]

      const finalPrompt = buildSystemPromptWithTools(basePrompt, tools)
      const expectedFinalPrompt = SYSTEM_PROMPT.replace('{{ USER_SYSTEM_PROMPT }}', basePrompt)
        .replace('{{ TOOL_USE_EXAMPLES }}', ToolUseExamples)
        .replace('{{ AVAILABLE_TOOLS }}', AvailableTools(tools))

      expect(finalPrompt).toEqual(expectedFinalPrompt)
      expect(finalPrompt).toContain('## Tool Use Formatting')
    })
  })

  describe('buildSystemPromptWithThinkTool', () => {
    it('should combine a template prompt with think tool instructions for native function calling', async () => {
      // 1. 创建一个带变量的模板提示词，并处理它
      const initialPrompt = `
        System Information:
        - Date: {{date}}
        - User: {{username}}

        Instructions: Be helpful.
      `
      const assistant = createMockAssistant('Test Assistant', 'Advanced-AI-Model')
      const basePrompt = await replacePromptVariables(initialPrompt, assistant.model?.name)
      const expectedBasePrompt = `
        System Information:
        - Date: ${mockDate.toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        })}
        - User: MockUser

        Instructions: Be helpful.
      `

      // 2. 将处理过的提示词与思考工具结合
      const finalPrompt = buildSystemPromptWithThinkTool(basePrompt)
      const expectedFinalPrompt = THINK_TOOL_PROMPT.replace('{{ USER_SYSTEM_PROMPT }}', expectedBasePrompt)

      // 3. 验证结果
      expect(finalPrompt).toEqual(expectedFinalPrompt)
      expect(finalPrompt).not.toContain('## Tool Use Formatting') // 验证不包含工具定义
      // expect(finalPrompt).toContain('## Using the think tool') // 验证包含思考指令
    })
  })
})
