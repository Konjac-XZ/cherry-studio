/** Checks source and translated catalog values before changes merge. */
import * as fs from 'fs'
import * as path from 'path'

import pangu from 'pangu'

import { composeLocale } from '../src/renderer/i18n/composeLocale'

/** Catalogs are flat: every key is a dotted path mapping straight to its translated string. */
type I18N = { [key: string]: string }
type Glossary = { doNotTranslate: string[] }

const ROOT = path.resolve(__dirname, '..')
const BASE_LOCALE = process.env.TRANSLATION_BASE_LOCALE ?? 'en-us'
const CATALOG_DIRECTORIES = ['src/main/i18n/locales']
const RENDERER_CATALOG_DIRECTORY = 'src/renderer/i18n/locales'
const RENDERER_CUSTOM_DIRECTORY = 'src/renderer/i18n/custom-locales'
const RENDERER_OVERRIDE_DIRECTORY = 'src/renderer/i18n/custom-locales/overrides'
const CHINESE_LOCALES = ['zh-cn', 'zh-tw']
const ALLOWED_EMPTY_SOURCE_KEYS = new Set(['src/renderer/i18n/locales:settings.provider.oauth.provided_by_suffix'])
const BLOCK_TAG_PATTERN =
  /<\/?(?:address|article|aside|blockquote|br|div|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|td|th|tr|ul)\b[^>]*>/gi
const INLINE_TAG_PATTERN = /<\/?(?:[A-Za-z][\w-]*|\d+)(?:\s[^<>]*?)?\s*\/?>/g

const interpolations = (text: string) => (text.match(/{{[^}]*}}/g) ?? []).sort()
const tagPlaceholders = (text: string) => (text.match(/<\/?[\w-]+\s*\/?>/g) ?? []).sort()
const nestedKeys = (text: string) => (text.match(/\$t\([^)]*\)/g) ?? []).sort()

const visibleTextProjection = (text: string) =>
  text.replace(BLOCK_TAG_PATTERN, ' ').replace(INLINE_TAG_PATTERN, '').replace(/\s+/g, ' ').trim()

export const validateChineseSpacing = (text: string): string | null => {
  const projected = visibleTextProjection(text)
  const actual = projected === text ? text : projected
  const suggested = pangu.spacingText(actual)

  if (typeof suggested !== 'string' || suggested === actual) return null
  return `Chinese spacing: actual ${JSON.stringify(actual)}, suggested ${JSON.stringify(suggested)}`
}

/** Case and separators vary legitimately: "Github", "Cherry-Studio-Diagnose". Spelling does not. */
const foldForTermMatch = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

export const validateSource = (source: string): string | null => {
  const text = source.trim()

  if (!text) return 'empty source value'
  if (/to be translated/i.test(text)) return 'placeholder marker leaked into the source locale'

  return null
}

export const validate = (english: string, translation: string, doNotTranslate: string[] = []): string | null => {
  const text = translation.trim()

  if (!text) return /[\p{L}\p{N}]/u.test(english) ? 'empty' : null
  if (/to be translated/i.test(text)) return 'placeholder marker leaked into the translation'
  if (text.startsWith('[') && !english.trim().startsWith('[')) {
    return 'starts with a bracketed note instead of the translation'
  }
  if (text.length > Math.max(80, english.length * 4)) {
    return 'suspiciously long - likely an explanation, not a translation'
  }

  const sameList = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)
  if (!sameList(interpolations(english), interpolations(translation))) {
    return `interpolation mismatch: expected ${interpolations(english).join(' ') || '(none)'}`
  }
  if (!sameList(tagPlaceholders(english), tagPlaceholders(translation))) {
    return `tag placeholder mismatch: expected ${tagPlaceholders(english).join(' ') || '(none)'}`
  }
  if (!sameList(nestedKeys(english), nestedKeys(translation))) {
    return `$t() reference mismatch: expected ${nestedKeys(english).join(' ') || '(none)'}`
  }

  const foldedEnglish = foldForTermMatch(english)
  const foldedTranslation = foldForTermMatch(text)
  for (const term of doNotTranslate) {
    const foldedTerm = foldForTermMatch(term)
    if (foldedEnglish.includes(foldedTerm) && !foldedTranslation.includes(foldedTerm)) {
      return `dropped untranslatable term "${term}"`
    }
  }

  return null
}

const readJson = (filePath: string): I18N => JSON.parse(fs.readFileSync(filePath, 'utf-8'))
const readOptionalJson = (filePath: string): I18N => (fs.existsSync(filePath) ? readJson(filePath) : {})

const readEffectiveRendererCatalogs = (): Map<string, I18N> => {
  const upstreamPath = path.join(ROOT, RENDERER_CATALOG_DIRECTORY)
  const customPath = path.join(ROOT, RENDERER_CUSTOM_DIRECTORY)
  const overridePath = path.join(ROOT, RENDERER_OVERRIDE_DIRECTORY)
  const customEnglish = readJson(path.join(customPath, BASE_LOCALE + '.json'))
  const catalogs = new Map<string, I18N>()

  for (const filename of fs.readdirSync(upstreamPath).filter((file) => file.endsWith('.json'))) {
    const locale = filename.replace(/\.json$/, '')
    catalogs.set(
      filename,
      composeLocale(
        readJson(path.join(upstreamPath, filename)),
        customEnglish,
        locale === BASE_LOCALE ? {} : readOptionalJson(path.join(customPath, filename)),
        readOptionalJson(path.join(overridePath, filename))
      )
    )
  }

  return catalogs
}

export const checkTranslationValues = (): { checked: number; failures: string[] } => {
  const glossary = JSON.parse(fs.readFileSync(path.join(__dirname, 'i18n-glossary.json'), 'utf-8')) as Glossary
  const failures: string[] = []
  let checked = 0

  const catalogGroups: Array<{ directory: string; catalogs: Map<string, I18N> }> = [
    { directory: RENDERER_CATALOG_DIRECTORY, catalogs: readEffectiveRendererCatalogs() },
    ...CATALOG_DIRECTORIES.map((catalogDirectory) => {
      const catalogPath = path.join(ROOT, catalogDirectory)
      return {
        directory: catalogDirectory,
        catalogs: new Map(
          fs
            .readdirSync(catalogPath)
            .filter((file) => file.endsWith('.json'))
            .map((filename) => [filename, readJson(path.join(catalogPath, filename))])
        )
      }
    })
  ]

  for (const { directory: catalogDirectory, catalogs } of catalogGroups) {
    const base = catalogs.get(BASE_LOCALE + '.json')
    if (!base) throw new Error('Missing ' + BASE_LOCALE + '.json in ' + catalogDirectory)

    for (const [key, source] of Object.entries(base)) {
      checked++
      const allowedEmpty = !source.trim() && ALLOWED_EMPTY_SOURCE_KEYS.has(`${catalogDirectory}:${key}`)
      const reason = allowedEmpty ? null : validateSource(source)
      if (reason) failures.push(`${catalogDirectory}/${BASE_LOCALE}.json ${key}: ${reason}`)
    }

    for (const [filename, target] of catalogs) {
      if (filename === BASE_LOCALE + '.json') continue

      for (const [key, translation] of Object.entries(target)) {
        const english = base[key]
        if (english === undefined) continue

        checked++
        const reason = validate(english, translation, glossary.doNotTranslate)
        if (reason) failures.push(`${catalogDirectory}/${filename} ${key}: ${reason}`)
      }
    }

    for (const locale of CHINESE_LOCALES) {
      const filename = locale + '.json'
      const target = catalogs.get(filename)
      if (!target) throw new Error('Missing ' + filename + ' in ' + catalogDirectory)

      for (const [key, translation] of Object.entries(target)) {
        checked++
        const reason = validateChineseSpacing(translation)
        if (reason) failures.push(`${catalogDirectory}/${filename} ${key}: ${reason}`)
      }
    }
  }

  return { checked, failures }
}
