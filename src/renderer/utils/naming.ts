import { getProviderLabelKey } from '@renderer/i18n/label'
import i18n from '@renderer/i18n/resolver'
import { isSystemProvider, type Provider } from '@renderer/types/provider'

/**
 * 从模型 ID 中提取默认组名。
 * 规则如下：
 * 1. 第一类分隔规则：以第一个出现的分隔符分割，取第 0 个部分作为组名。
 * 2. 第二类分隔规则：取前两个部分拼接（如 'a-b-c' 得到 'a-b'）。
 * 3. 其他情况返回 id。
 *
 * 例如：
 * - 'gpt-3.5-turbo-16k-0613' => 'gpt-3.5'
 * - 'qwen3:32b' => 'qwen3'
 * - 'Qwen/Qwen3-32b' => 'qwen'
 * - 'deepseek-r1' => 'deepseek-r1'
 * - 'o3' => 'o3'
 *
 * @param {string} id 模型 ID 字符串
 * @param {string} [provider] 提供商 ID 字符串
 * @returns {string} 提取的组名
 */
export const getDefaultGroupName = (id: string, provider?: string): string => {
  const str = id.toLowerCase()

  // 定义分隔符
  let firstDelimiters = ['/', ' ', ':']
  let secondDelimiters = ['-', '_']

  if (provider && ['aihubmix', 'silicon', 'ocoolai', 'o3', 'dmxapi'].includes(provider.toLowerCase())) {
    firstDelimiters = ['/', ' ', '-', '_', ':']
    secondDelimiters = []
  }

  // 第一类分隔规则
  for (const delimiter of firstDelimiters) {
    if (str.includes(delimiter)) {
      return str.split(delimiter)[0]
    }
  }

  // 第二类分隔规则
  for (const delimiter of secondDelimiters) {
    if (str.includes(delimiter)) {
      const parts = str.split(delimiter)
      return parts.length > 1 ? parts[0] + '-' + parts[1] : parts[0]
    }
  }

  return str
}

/**
 * 从模型 ID 中提取基础名称。
 * 例如：
 * - 'deepseek/deepseek-r1' => 'deepseek-r1'
 * - 'deepseek-ai/deepseek/deepseek-r1' => 'deepseek-r1'
 * @param {string} id 模型 ID
 * @param {string} [delimiter='/'] 分隔符，默认为 '/'
 * @returns {string} 基础名称
 */
export const getBaseModelName = (id: string, delimiter: string = '/'): string => {
  const parts = id.split(delimiter)
  return parts[parts.length - 1]
}

/**
 * 从模型 ID 中提取基础名称并转换为小写。
 * 例如：
 * - 'deepseek/DeepSeek-R1' => 'deepseek-r1'
 * - 'deepseek-ai/deepseek/DeepSeek-R1' => 'deepseek-r1'
 * @param {string} id 模型 ID
 * @param {string} [delimiter='/'] 分隔符，默认为 '/'
 * @returns {string} 小写的基础名称
 */
export const getLowerBaseModelName = (id: string, delimiter: string = '/'): string => {
  // Normalize Fireworks model IDs: Fireworks replaces '.' with 'p' in version numbers
  // e.g. accounts/fireworks/models/deepseek-v3p2 -> deepseek-v3.2
  // e.g. accounts/fireworks/models/kimi-k2p5 -> kimi-k2.5
  const normalizedId = id.toLowerCase().startsWith('accounts/fireworks/models/')
    ? id.replace(/(\d)p(?=\d)/g, '$1.')
    : id

  let baseModelName = getBaseModelName(normalizedId, delimiter).toLowerCase()
  // Remove suffix
  // for openrouter
  if (baseModelName.endsWith(':free')) {
    baseModelName = baseModelName.replace(':free', '')
  }
  // for cherryin
  if (baseModelName.endsWith('(free)')) {
    baseModelName = baseModelName.replace('(free)', '')
  }
  // for ollama
  if (baseModelName.endsWith(':cloud')) {
    baseModelName = baseModelName.replace(':cloud', '')
  }
  return baseModelName
}

const MODEL_NAME_WORDS: Record<string, string> = {
  ai: 'AI',
  api: 'API',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  codex: 'Codex',
  dall: 'DALL',
  deepseek: 'DeepSeek',
  flux: 'FLUX',
  gemini: 'Gemini',
  gemma: 'Gemma',
  glm: 'GLM',
  gpt: 'GPT',
  grok: 'Grok',
  kimi: 'Kimi',
  llama: 'Llama',
  minimax: 'MiniMax',
  mistral: 'Mistral',
  mixtral: 'Mixtral',
  omni: 'Omni',
  qwen: 'Qwen',
  r: 'R',
  tts: 'TTS',
  vl: 'VL',
  yi: 'Yi'
}

const VERSION_FAMILY_WORDS = new Set(['claude'])
const HYPHENATED_VERSION_FAMILY_WORDS = new Set(['glm', 'gpt'])
const SPACED_VERSION_FAMILY_WORDS = new Set(['qwen'])

const preserveKnownWord = (word: string): string | undefined => MODEL_NAME_WORDS[word.toLowerCase()]
const toTitleCase = (word: string): string => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word)

const formatAlphaNumericToken = (word: string): string => {
  if (/^o\d+$/i.test(word)) return word.toLowerCase()

  const knownPrefix = Object.keys(MODEL_NAME_WORDS)
    .sort((a, b) => b.length - a.length)
    .find((prefix) => {
      const rest = word.slice(prefix.length)
      return word.toLowerCase().startsWith(prefix) && /^(?:\d|\.\d)/.test(rest)
    })

  if (knownPrefix) {
    const rest = word.slice(knownPrefix.length)
    if (HYPHENATED_VERSION_FAMILY_WORDS.has(knownPrefix)) return `${MODEL_NAME_WORDS[knownPrefix]}-${rest}`
    if (SPACED_VERSION_FAMILY_WORDS.has(knownPrefix)) return `${MODEL_NAME_WORDS[knownPrefix]} ${rest}`
    return `${MODEL_NAME_WORDS[knownPrefix]}${rest}`
  }

  const alphaNumericMatch = word.match(/^([a-z]+)(\d+(?:\.\d+)?)([a-z]*)$/i)
  if (alphaNumericMatch) {
    const [, prefix, number, suffix] = alphaNumericMatch
    const formattedPrefix = preserveKnownWord(prefix) ?? toTitleCase(prefix)
    if (!suffix) return `${formattedPrefix}${number}`
    return `${formattedPrefix}${number}${suffix.toLowerCase() === 'o' ? 'o' : suffix.toUpperCase()}`
  }

  const numericSuffixMatch = word.match(/^(\d+(?:\.\d+)?)([a-z]+)$/i)
  if (numericSuffixMatch) {
    const [, number, suffix] = numericSuffixMatch
    return `${number}${suffix.toLowerCase() === 'o' ? 'o' : suffix.toUpperCase()}`
  }

  return toTitleCase(word)
}

const formatModelNameToken = (word: string): string => {
  const knownWord = preserveKnownWord(word)
  if (knownWord) return knownWord
  if (/^o\d+$/i.test(word)) return word.toLowerCase()
  if (/^\d+[bkmt]$/i.test(word)) return word.slice(0, -1) + word.slice(-1).toUpperCase()
  if (/[a-z]/i.test(word) && /\d/.test(word)) return formatAlphaNumericToken(word)
  if (/^[a-z]+$/i.test(word)) return toTitleCase(word)
  return word
}

const shouldMergeVersionPair = (tokens: string[], index: number): boolean =>
  tokens.slice(0, index).some((token) => VERSION_FAMILY_WORDS.has(token.toLowerCase())) &&
  /^\d+$/.test(tokens[index]) &&
  /^\d{1,2}$/.test(tokens[index + 1])

const shouldMergeDatePair = (tokens: string[], index: number): boolean =>
  /^\d{2,4}$/.test(tokens[index]) && /^\d{2}$/.test(tokens[index + 1]) && index >= tokens.length - 2

const shouldMergeDateTriple = (tokens: string[], index: number): boolean =>
  /^\d{4}$/.test(tokens[index]) &&
  /^\d{2}$/.test(tokens[index + 1]) &&
  /^\d{2}$/.test(tokens[index + 2]) &&
  index === tokens.length - 3

/** Infer a readable label from an API model id without changing its identity. */
export function inferModelNameFromId(id: string): string {
  const normalized = getBaseModelName(id.trim()).replace(/[:_]+/g, '-').replace(/\s+/g, '-')

  if (!normalized) return ''

  const rawTokens = normalized.split('-').filter(Boolean)
  const result: string[] = []

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i]

    if (/^\d{8}$/.test(token)) {
      result.push(`${token.slice(0, 4)}-${token.slice(4, 6)}-${token.slice(6)}`)
    } else if (/^\d{4}$/.test(token) && i === rawTokens.length - 1) {
      result.push(`${token.slice(0, 2)}-${token.slice(2)}`)
    } else if (shouldMergeVersionPair(rawTokens, i)) {
      result.push(`${token}.${rawTokens[++i]}`)
    } else if (shouldMergeDateTriple(rawTokens, i)) {
      result.push(`${token}-${rawTokens[i + 1]}-${rawTokens[i + 2]}`)
      i += 2
    } else if (shouldMergeDatePair(rawTokens, i)) {
      result.push(`${token}-${rawTokens[++i]}`)
    } else if (HYPHENATED_VERSION_FAMILY_WORDS.has(token.toLowerCase()) && /^\d/.test(rawTokens[i + 1])) {
      result.push(`${formatModelNameToken(token)}-${formatModelNameToken(rawTokens[++i])}`)
    } else {
      result.push(formatModelNameToken(token))
    }
  }

  return result.join(' ')
}

/**
 * 获取模型服务商名称，根据是否内置服务商来决定要不要翻译
 * @param provider 服务商
 * @returns 描述性的名字
 */
export const getFancyProviderName = (provider: Provider) => {
  return isSystemProvider(provider) ? i18n.t(getProviderLabelKey(provider.id)) : provider.name
}

// \uFE0F = VS16 (emoji-presentation selector); \u20E3 = combining enclosing keycap (1️⃣);
// \u200D = ZWJ joining multi-part sequences (🧛‍♂️). Composed into the emoji regexes below.
const EMOJI_PART_PATTERN = String.raw`(?:\p{Emoji}\uFE0F|\p{Emoji_Presentation})(?:\p{Emoji_Modifier})?`
const KEYCAP_EMOJI_PATTERN = String.raw`(?:[0-9#*]\uFE0F?\u20E3)`
const REGIONAL_FLAG_EMOJI_PATTERN = String.raw`(?:\p{Regional_Indicator}{2})`
const EMOJI_SEQUENCE_PATTERN = String.raw`(?:${EMOJI_PART_PATTERN}(?:\u200D${EMOJI_PART_PATTERN})*)`
const EMOJI_CLUSTER_PATTERN = String.raw`(?:${KEYCAP_EMOJI_PATTERN}|${REGIONAL_FLAG_EMOJI_PATTERN}|${EMOJI_SEQUENCE_PATTERN})`
// Anchored at both ends for whole-string checks (isEmoji); anchored at the start only
// for leading-run extraction/removal (getLeadingEmoji / removeLeadingEmoji).
const EMOJI_REGEX = new RegExp(`^(?:${EMOJI_CLUSTER_PATTERN})+$`, 'u')
const EMOJI_LEADING_REGEX = new RegExp(`^(?:${EMOJI_CLUSTER_PATTERN})+`, 'u')
const FIRST_LETTER_OR_EMOJI_REGEX = new RegExp(`${EMOJI_CLUSTER_PATTERN}|\\p{L}\\p{M}*`, 'u')

/**
 * 用于获取 avatar 名字的辅助函数，会取出字符串的第一个字符，支持表情符号。
 * @param {string} str 输入字符串
 * @returns {string} 第一个字符，或者返回空字符串
 */
export function firstLetter(str: string): string {
  const match = str?.match(FIRST_LETTER_OR_EMOJI_REGEX)
  return match ? match[0] : ''
}

/**
 * 移除字符串开头的表情符号。
 * @param {string} str 输入字符串
 * @returns {string} 移除开头表情符号后的字符串
 */
export function removeLeadingEmoji(str: string): string {
  return str.replace(EMOJI_LEADING_REGEX, '').trim()
}

/**
 * 提取字符串开头的表情符号。
 * @param {string} str 输入字符串
 * @returns {string} 开头的表情符号，如果没有则返回空字符串
 */
export function getLeadingEmoji(str: string): string {
  const match = str.match(EMOJI_LEADING_REGEX)
  return match ? match[0] : ''
}

/**
 * 检查字符串是否为纯表情符号。
 * @param {string} str 输入字符串
 * @returns {boolean} 如果字符串是纯表情符号则返回 true，否则返回 false
 */
export function isEmoji(str: string): boolean {
  if (str.startsWith('data:')) {
    return false
  }
  if (str.startsWith('http')) {
    return false
  }
  return EMOJI_REGEX.test(str)
}

/**
 * 从话题名称中移除特殊字符：
 * - 替换换行符为空格。
 * @param {string} str 输入字符串
 * @returns {string} 处理后的字符串
 */
export function removeSpecialCharactersForTopicName(str: string): string {
  return str.replace(/["'\r\n]+/g, ' ').trim()
}

/**
 * 获取字符串的第一个字符。
 * @param {string} str 输入字符串
 * @returns {string} 第一个字符，或者空字符串
 */
export function getFirstCharacter(str: string): string {
  // 使用 for...of 循环来获取第一个字符
  for (const char of str) {
    return char
  }

  return ''
}

/**
 * 用于简化文本。按照给定长度限制截断文本，考虑语义边界。
 * @param {string} text 输入文本
 * @param {number} [maxLength=50] 最大长度，默认为 50
 * @returns {string} 处理后的简短文本
 */
export function getBriefInfo(text: string, maxLength: number = 50): string {
  // 去除空行
  const noEmptyLinesText = text.replace(/\n\s*\n/g, '\n')

  // 检查文本是否超过最大长度
  if (noEmptyLinesText.length <= maxLength) {
    return noEmptyLinesText
  }

  // 找到最近的单词边界
  let truncatedText = noEmptyLinesText.slice(0, maxLength)
  const lastSpaceIndex = truncatedText.lastIndexOf(' ')

  if (lastSpaceIndex !== -1) {
    truncatedText = truncatedText.slice(0, lastSpaceIndex)
  }

  // 截取前面的内容，并在末尾添加 "..."
  return truncatedText + '...'
}

/**
 * Truncate text while preserving sentence boundaries where possible.
 *
 * Logic:
 * 1. If text length <= minLength, return as-is
 * 2. Use Intl.Segmenter to split by sentences, accumulate until approaching maxLength
 * 3. If the first sentence exceeds maxLength, try to find the last punctuation within maxLength
 * 4. If no punctuation found, fall back to word boundary truncation
 *
 * @param {string} text Input text
 * @param {object} options Configuration options
 * @param {number} [options.minLength=15] Minimum length, result should not be shorter
 * @param {number} [options.maxLength=50] Maximum length, result should not exceed
 * @returns {string} Truncated text
 */
export function truncateText(text: string, options: { minLength?: number; maxLength?: number } = {}): string {
  const { minLength = 15, maxLength = 50 } = options

  if (!text || text.length <= minLength) {
    return text
  }

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' })
  let result = ''

  for (const { segment } of segmenter.segment(text)) {
    if (result.length + segment.length > maxLength) {
      break
    }
    result += segment
  }

  // If we got a valid result within bounds, return it
  if (result && result.length >= minLength) {
    return result.trim()
  }

  // Need to truncate within a long sentence - try to find a good break point
  const candidate = text.substring(0, maxLength)

  // Try to find the last suitable ending punctuation (excluding comma-like marks)
  const endingPunctuationPattern = /[。！？；!?;]/g
  let lastEndingIndex = -1
  let match: RegExpExecArray | null

  while ((match = endingPunctuationPattern.exec(candidate)) !== null) {
    if (match.index >= minLength) {
      lastEndingIndex = match.index
    }
  }

  // If found a proper ending punctuation, truncate there
  if (lastEndingIndex > 0) {
    return text.substring(0, lastEndingIndex + 1).trim()
  }

  // Fall back to word boundary using Intl.Segmenter
  const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
  let wordResult = ''

  for (const { segment } of wordSegmenter.segment(text)) {
    if (wordResult.length + segment.length > maxLength) {
      break
    }
    wordResult += segment
  }

  // Return word-boundary result if valid, otherwise hard truncate
  return wordResult.length >= minLength ? wordResult.trim() : text.substring(0, maxLength)
}
