import * as fs from 'fs'
import * as path from 'path'

import { composeLocale } from '../src/renderer/i18n/composeLocale'
import { checkRuntimeChineseSpacing } from './i18n-check-runtime-spacing'
import { checkTranslationValues } from './i18n-check-values'
import { sortedObjectByKeys } from './sort'

const baseLocale = process.env.TRANSLATION_BASE_LOCALE ?? 'en-us'
const baseFileName = `${baseLocale}.json`

const rendererLocalesDir = path.join(__dirname, '../src/renderer/i18n/locales')
const rendererCustomLocalesDir = path.join(__dirname, '../src/renderer/i18n/custom-locales')
const rendererCustomOverridesDir = path.join(rendererCustomLocalesDir, 'overrides')
const rendererTranslateSourceDirs = [
  path.join(__dirname, '../src/renderer/components/translate'),
  path.join(__dirname, '../src/renderer/pages/translate')
]
const mainI18nDir = path.join(__dirname, '../src/main/i18n')
const mainSrcDir = path.join(__dirname, '../src/main')

/** Catalogs are flat: every key is a dotted path mapping straight to its translated string. */
type I18N = { [key: string]: string }

/**
 * 检查目标文件与基准模板的键集合是否完全一致（缺键、多键、值不是字符串都会抛错）。
 */
function checkKeys(target: I18N, template: I18N): void {
  for (const key in template) {
    if (!(key in target)) {
      throw new Error(`缺少属性 ${key}`)
    }
    if (typeof target[key] !== 'string') {
      throw new Error(`属性 ${key} 不是字符串，catalog 必须是扁平的 key -> string`)
    }
  }

  for (const targetKey in target) {
    if (!(targetKey in template)) {
      throw new Error(`多余属性 ${targetKey}`)
    }
  }
}

function isSortedI18N(obj: I18N): boolean {
  return JSON.stringify(obj) === JSON.stringify(sortedObjectByKeys(obj))
}

function readI18N(filePath: string): I18N {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件 ${filePath} 不存在，请检查路径或文件名`)
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (error) {
    throw new Error(`解析 ${filePath} 出错。${error}`)
  }
}

function readOptionalI18N(filePath: string): I18N {
  return fs.existsSync(filePath) ? readI18N(filePath) : {}
}

/**
 * 校验一组翻译文件：基准模板有序，其余文件有序且与基准键集合完全一致。
 *
 * @param label 分组名（用于报错信息，如 renderer / main）
 * @param baseFilePath 基准模板文件
 * @param files 该组需要校验的全部翻译文件（含基准模板本身）
 */
function checkCatalog(label: string, baseFilePath: string, files: string[]): I18N {
  const baseJson = readI18N(baseFilePath)

  if (!isSortedI18N(baseJson)) {
    throw new Error(`[${label}] 主模板 ${path.basename(baseFilePath)} 的键值未按字典序排序。`)
  }

  for (const filePath of files) {
    if (path.resolve(filePath) === path.resolve(baseFilePath)) continue
    const targetJson = readI18N(filePath)
    if (!isSortedI18N(targetJson)) {
      throw new Error(`[${label}] 翻译文件 ${path.basename(filePath)} 的键值未按字典序排序。`)
    }
    try {
      checkKeys(targetJson, baseJson)
    } catch (e) {
      console.error(e)
      throw new Error(`[${label}] 在检查 ${filePath} 时出错`)
    }
  }

  return baseJson
}

function listJsonFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(dir, file))
}

function checkSortedFlatCatalog(label: string, catalog: I18N): void {
  if (!isSortedI18N(catalog)) throw new Error('[' + label + '] keys are not sorted')
  for (const [key, value] of Object.entries(catalog)) {
    if (typeof value !== 'string') throw new Error('[' + label + '] ' + key + ' is not a string')
  }
}

/**
 * Validate the downstream overlay independently, then verify every effective
 * renderer catalog has exactly the composed English key set.
 */
function checkRendererCustomCatalogs(upstreamBase: I18N, upstreamFiles: string[]): I18N {
  const customEnglish = readI18N(path.join(rendererCustomLocalesDir, baseFileName))
  const englishOverrides = readI18N(path.join(rendererCustomOverridesDir, baseFileName))
  checkSortedFlatCatalog('renderer custom/' + baseFileName, customEnglish)
  checkSortedFlatCatalog('renderer custom overrides/' + baseFileName, englishOverrides)

  for (const key of Object.keys(customEnglish)) {
    if (key in upstreamBase) {
      throw new Error('[renderer custom] downstream addition already exists upstream: ' + key)
    }
  }
  for (const key of Object.keys(englishOverrides)) {
    if (!(key in upstreamBase)) {
      throw new Error('[renderer custom overrides] unknown upstream key: ' + key)
    }
  }

  const effectiveEnglish = composeLocale(upstreamBase, customEnglish, {}, englishOverrides)
  for (const upstreamFile of upstreamFiles) {
    const filename = path.basename(upstreamFile)
    const locale = filename.replace(/\.json$/, '')
    const customLocale = locale === baseLocale ? {} : readOptionalI18N(path.join(rendererCustomLocalesDir, filename))
    const overrides = readOptionalI18N(path.join(rendererCustomOverridesDir, filename))
    checkSortedFlatCatalog('renderer custom/' + filename, customLocale)
    checkSortedFlatCatalog('renderer custom overrides/' + filename, overrides)

    for (const key of Object.keys(customLocale)) {
      if (!(key in customEnglish)) {
        throw new Error('[renderer custom/' + filename + '] locale-only key: ' + key)
      }
    }
    const upstreamLocale = readI18N(upstreamFile)
    for (const key of Object.keys(overrides)) {
      if (!(key in upstreamLocale)) {
        throw new Error('[renderer custom overrides/' + filename + '] unknown upstream key: ' + key)
      }
    }

    const effective = composeLocale(upstreamLocale, customEnglish, customLocale, overrides)
    try {
      checkKeys(effective, effectiveEnglish)
    } catch (error) {
      console.error(error)
      throw new Error('[renderer effective] invalid composed catalog for ' + filename)
    }
  }

  return effectiveEnglish
}

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // Skip test folders and the i18n module itself (the catalog is the source of truth there).
      if (entry.name === '__tests__' || entry.name === 'i18n') continue
      collectSourceFiles(path.join(dir, entry.name), acc)
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(path.join(dir, entry.name))
    }
  }
  return acc
}

/**
 * Verify that every `t('some.key')` call in files that import `t` from `@main/i18n`
 * resolves to a string in the main catalog. This catches the common drift where main code
 * starts using a key the small main catalog does not carry.
 *
 * A non-literal key — `t(someVar)`, a template string, a ternary — cannot be checked
 * against the catalog statically, so it is reported as a loud failure rather than skipped
 * silently: main code must use literal keys so this guard can cover them.
 */
function checkMainKeyCoverage(mainBaseJson: I18N): void {
  const importsMainT = /import\s*(?:type\s*)?\{[^}]*\bt\b[^}]*\}\s*from\s*['"]@main\/i18n['"]/
  const anyTCall = /(?<![\w.])t\(/g
  const literalTCall = /^t\(\s*(['"])([\w.]+)\1/

  const missing = new Set<string>()
  const dynamic = new Set<string>()
  for (const file of collectSourceFiles(mainSrcDir)) {
    const content = fs.readFileSync(file, 'utf-8')
    if (!importsMainT.test(content)) continue
    const rel = path.relative(mainSrcDir, file)
    for (const call of content.matchAll(anyTCall)) {
      if (call.index === undefined) continue
      const literal = literalTCall.exec(content.slice(call.index))
      if (!literal) {
        const snippet = content
          .slice(call.index, call.index + 40)
          .split('\n')[0]
          .trim()
        dynamic.add(`${snippet}…  (${rel})`)
        continue
      }
      const key = literal[2]
      if (typeof mainBaseJson[key] !== 'string') {
        missing.add(`${key}  (${rel})`)
      }
    }
  }

  const errors: string[] = []
  if (dynamic.size > 0) {
    errors.push(`main 源码存在无法静态校验的非字面量 t() 调用（请改用字面量 key）：\n${[...dynamic].join('\n')}`)
  }
  if (missing.size > 0) {
    errors.push(`main 源码使用了 main catalog（src/main/i18n）中不存在的 i18n key：\n${[...missing].join('\n')}`)
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n\n'))
  }
}

/**
 * Verify literal renderer translation keys in the Translate feature against the renderer catalog.
 *
 * Renderer code can legitimately use dynamic keys and window-local catalogs, so the repository-wide
 * main-process rule cannot be applied wholesale here. The Translate feature uses the shared renderer
 * catalog and is scanned recursively; dynamic calls remain covered by their typed source values/tests.
 */
function checkRendererTranslateKeyCoverage(rendererBaseJson: I18N): void {
  const literalTCall = /(?<![\w.])t\(\s*(['"])([\w.-]+)\1/g
  const missing = new Set<string>()

  for (const sourceDir of rendererTranslateSourceDirs) {
    for (const file of collectSourceFiles(sourceDir)) {
      const content = fs.readFileSync(file, 'utf-8')
      const rel = path.relative(path.join(__dirname, '..'), file)
      for (const match of content.matchAll(literalTCall)) {
        const key = match[2]
        if (typeof rendererBaseJson[key] !== 'string') {
          missing.add(`${key}  (${rel})`)
        }
      }
    }
  }

  if (missing.size > 0) {
    throw new Error(
      `Translate renderer source uses i18n keys missing from the renderer catalog:\n${[...missing].join('\n')}`
    )
  }
}

function checkTranslations(): void {
  const rendererFiles = listJsonFiles(rendererLocalesDir)
  const rendererUpstreamBaseJson = checkCatalog('renderer', path.join(rendererLocalesDir, baseFileName), rendererFiles)
  const rendererBaseJson = checkRendererCustomCatalogs(rendererUpstreamBaseJson, rendererFiles)
  checkRendererTranslateKeyCoverage(rendererBaseJson)

  const mainBaseFilePath = path.join(mainI18nDir, 'locales', baseFileName)
  const mainFiles = listJsonFiles(path.join(mainI18nDir, 'locales'))
  const mainBaseJson = checkCatalog('main', mainBaseFilePath, mainFiles)

  checkMainKeyCoverage(mainBaseJson)
}

export function main() {
  try {
    checkTranslations()
    const { checked, failures } = checkTranslationValues()
    if (failures.length > 0) {
      for (const failure of failures) console.error(`  x ${failure}`)
      throw new Error(`${failures.length} translations failed validation`)
    }
    const runtimeSpacingFindings = checkRuntimeChineseSpacing()
    if (runtimeSpacingFindings.length > 0) {
      for (const finding of runtimeSpacingFindings) {
        console.error(
          `  x ${path.relative(path.join(__dirname, '..'), finding.file)}:${finding.line} ${finding.reason}`
        )
        console.error(`    ${finding.snippet}`)
      }
      throw new Error(`${runtimeSpacingFindings.length} runtime Chinese spacing risks found`)
    }
    console.log(`i18n 检查已通过（已校验 ${checked} 条翻译）`)
  } catch (e) {
    console.error(e)
    throw new Error(`检查未通过。请修复上面的 i18n 问题。`)
  }
}

main()
