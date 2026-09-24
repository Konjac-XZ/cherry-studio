import * as fs from 'fs'
import * as path from 'path'

import { Node, Project, type SourceFile } from 'ts-morph'

import { composeLocale } from '../src/renderer/i18n/composeLocale'

type I18NValue = string | { [key: string]: I18NValue }
type I18N = { [key: string]: I18NValue }

export interface RuntimeSpacingFinding {
  file: string
  line: number
  reason: string
  snippet: string
}

type ChineseCatalogs = { 'zh-cn': Record<string, string>; 'zh-tw': Record<string, string> }

const ROOT = path.resolve(__dirname, '..')
const RENDERER_DIR = path.join(ROOT, 'src/renderer')
const CENTRAL_FORMATTER_FILES = new Set(['src/renderer/utils/number.ts', 'src/renderer/utils/time.ts'])
// This byte-for-byte upstream mirror is not routed in the fork; the downstream custom history is checked instead.
const IGNORED_SOURCE_FILES = new Set(['src/renderer/pages/translate/components/TranslateHistory.tsx'])
const IGNORED_DIRECTORIES = new Set(['__tests__', 'i18n', 'node_modules'])
const HAN_AT_START = /^\p{Script=Han}/u
const HAN_AT_END = /\p{Script=Han}$/u

const flatten = (obj: I18N, prefix = '', out: Record<string, string> = {}): Record<string, string> => {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out[fullKey] = value
    else if (value !== null && typeof value === 'object') flatten(value, fullKey, out)
  }
  return out
}

const loadChineseCatalogs = (): ChineseCatalogs => {
  const readJson = (relativePath: string) =>
    flatten(JSON.parse(fs.readFileSync(path.join(RENDERER_DIR, relativePath), 'utf-8')) as I18N)
  const customEnglish = readJson('i18n/custom-locales/en-us.json')
  const read = (locale: 'zh-cn' | 'zh-tw') =>
    composeLocale(
      readJson('i18n/locales/' + locale + '.json'),
      customEnglish,
      readJson('i18n/custom-locales/' + locale + '.json'),
      readJson('i18n/custom-locales/overrides/' + locale + '.json')
    )
  return { 'zh-cn': read('zh-cn'), 'zh-tw': read('zh-tw') }
}

const listSourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) listSourceFiles(path.join(dir, entry.name), out)
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(path.join(dir, entry.name))
    }
  }
  return out
}

const translationKey = (node: Node | undefined): string | null => {
  if (!node || !Node.isCallExpression(node)) return null
  const callee = node.getExpression().getText()
  if (callee !== 't' && !callee.endsWith('.t')) return null
  const first = node.getArguments()[0]
  return first && Node.isStringLiteral(first) ? first.getLiteralValue() : null
}

const translationHasBoundary = (key: string, catalogs: ChineseCatalogs, boundary: 'start' | 'end'): boolean => {
  const pattern = boundary === 'start' ? HAN_AT_START : HAN_AT_END
  return (['zh-cn', 'zh-tw'] as const).some((locale) => pattern.test(catalogs[locale][key] ?? ''))
}

const isNumericLike = (node: Node | undefined): boolean => {
  if (!node) return false
  if (Node.isNumericLiteral(node)) return true
  return /(?:count|duration|latency|minutes|percent|seconds|size|tokens|value)/i.test(node.getText())
}

const literalHasHanBoundary = (node: Node, boundary: 'start' | 'end'): boolean => {
  if (!Node.isStringLiteral(node) && !Node.isNoSubstitutionTemplateLiteral(node)) return false
  return (boundary === 'start' ? HAN_AT_START : HAN_AT_END).test(node.getLiteralValue())
}

const expressionHasHanBoundary = (
  node: Node | undefined,
  catalogs: ChineseCatalogs,
  boundary: 'start' | 'end'
): boolean => {
  if (!node) return false
  const key = translationKey(node)
  return key ? translationHasBoundary(key, catalogs, boundary) : literalHasHanBoundary(node, boundary)
}

const literalOption = (node: Node, name: string): string | null => {
  if (!Node.isObjectLiteralExpression(node)) return null
  const property = node.getProperty(name)
  if (!property || !Node.isPropertyAssignment(property)) return null
  const initializer = property.getInitializer()
  return initializer && Node.isStringLiteral(initializer) ? initializer.getLiteralValue() : null
}

const highRiskIntlReason = (node: Node): string | null => {
  if (!Node.isNewExpression(node)) return null
  const constructor = node.getExpression().getText()
  const options = node.getArguments()[1]

  if (constructor === 'Intl.RelativeTimeFormat') return 'Intl.RelativeTimeFormat must use the central spacing formatter'
  if (constructor === 'Intl.NumberFormat' && options) {
    if (literalOption(options, 'notation') === 'compact')
      return 'compact Intl.NumberFormat must use formatCompactNumber'
    if (literalOption(options, 'style') === 'unit')
      return 'unit Intl.NumberFormat must use the central spacing formatter'
  }
  if (constructor === 'Intl.ListFormat' && options && literalOption(options, 'type') === 'unit') {
    return 'unit Intl.ListFormat must use the central spacing formatter'
  }
  if (constructor === 'Intl.DateTimeFormat') {
    if (!options || !Node.isObjectLiteralExpression(options)) {
      return 'date-producing Intl.DateTimeFormat must use the central spacing formatter'
    }
    const dateFields = ['dateStyle', 'day', 'era', 'month', 'timeZoneName', 'weekday', 'year']
    if (dateFields.some((field) => options.getProperty(field))) {
      return 'date-producing Intl.DateTimeFormat must use the central spacing formatter'
    }
  }
  return null
}

const isSeparatedExpression = (node: Node, side: 'start' | 'end'): boolean => {
  if (!Node.isStringLiteral(node) && !Node.isNoSubstitutionTemplateLiteral(node)) return false
  const value = node.getLiteralValue()
  if (!value) return true
  return side === 'start' ? /^[\s\p{P}]/u.test(value) : /[\s\p{P}]$/u.test(value)
}

const hasSeparatedBoundary = (node: Node, side: 'start' | 'end'): boolean => {
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return isSeparatedExpression(node, side)
  }
  if (Node.isParenthesizedExpression(node)) return hasSeparatedBoundary(node.getExpression(), side)
  if (Node.isBinaryExpression(node) && node.getOperatorToken().getText() === '+') {
    return hasSeparatedBoundary(side === 'start' ? node.getLeft() : node.getRight(), side)
  }
  if (Node.isConditionalExpression(node)) {
    return hasSeparatedBoundary(node.getWhenTrue(), side) && hasSeparatedBoundary(node.getWhenFalse(), side)
  }
  if (Node.isTemplateExpression(node)) {
    const literal =
      side === 'start' ? node.getHead().getLiteralText() : node.getTemplateSpans().at(-1)?.getLiteral().getLiteralText()
    return literal ? (side === 'start' ? /^[\s\p{P}]/u.test(literal) : /[\s\p{P}]$/u.test(literal)) : false
  }
  return false
}

const addFinding = (findings: RuntimeSpacingFinding[], sourceFile: SourceFile, node: Node, reason: string) => {
  findings.push({
    file: sourceFile.getFilePath(),
    line: sourceFile.getLineAndColumnAtPos(node.getStart()).line,
    reason,
    snippet: node.getText().replace(/\s+/g, ' ').slice(0, 160)
  })
}

export const analyzeRuntimeSpacing = (sourceFile: SourceFile, catalogs: ChineseCatalogs): RuntimeSpacingFinding[] => {
  const findings: RuntimeSpacingFinding[] = []
  const relativePath = path.relative(ROOT, sourceFile.getFilePath()).replace(/\\/g, '/')
  const isCentralFormatter = CENTRAL_FORMATTER_FILES.has(relativePath)

  sourceFile.forEachDescendant((node) => {
    const intlReason = highRiskIntlReason(node)
    if (intlReason && !isCentralFormatter) addFinding(findings, sourceFile, node, intlReason)

    if (Node.isTemplateExpression(node)) {
      let previous = node.getHead().getLiteralText()
      for (const span of node.getTemplateSpans()) {
        const next = span.getLiteral().getLiteralText()
        if (HAN_AT_END.test(previous) || HAN_AT_START.test(next)) {
          addFinding(findings, sourceFile, node, 'dynamic template value directly touches Chinese text')
          break
        }
        previous = next
      }
    }

    if (Node.isBinaryExpression(node) && node.getOperatorToken().getText() === '+') {
      const left = node.getLeft()
      const right = node.getRight()
      const rightKey = translationKey(right)
      if (rightKey && translationHasBoundary(rightKey, catalogs, 'start') && !hasSeparatedBoundary(left, 'end')) {
        addFinding(findings, sourceFile, node, `dynamic value directly precedes Chinese translation ${rightKey}`)
      }
      const leftKey = translationKey(left)
      if (leftKey && translationHasBoundary(leftKey, catalogs, 'end') && !hasSeparatedBoundary(right, 'start')) {
        addFinding(findings, sourceFile, node, `Chinese translation ${leftKey} directly precedes a dynamic value`)
      }
    }

    if (Node.isJsxElement(node)) {
      const children = node.getJsxChildren()
      for (let index = 0; index < children.length - 1; index++) {
        const leftChild = children[index]
        const rightChild = children[index + 1]
        if (!Node.isJsxExpression(leftChild) || !Node.isJsxExpression(rightChild)) continue
        const left = leftChild.getExpression()
        const right = rightChild.getExpression()
        if (
          (isNumericLike(left) && expressionHasHanBoundary(right, catalogs, 'start')) ||
          (expressionHasHanBoundary(left, catalogs, 'end') && isNumericLike(right))
        ) {
          addFinding(findings, sourceFile, node, 'adjacent JSX values directly join a number and Chinese text')
          break
        }
      }
    }

    if (Node.isCallExpression(node)) {
      const propertyAccess = node.getExpression()
      if (!Node.isPropertyAccessExpression(propertyAccess)) return
      const separator = node.getArguments()[0]
      const array = propertyAccess.getExpression()
      if (
        propertyAccess.getName() === 'join' &&
        separator &&
        Node.isStringLiteral(separator) &&
        separator.getLiteralValue() === '' &&
        Node.isArrayLiteralExpression(array)
      ) {
        const elements = array.getElements()
        for (let index = 0; index < elements.length - 1; index++) {
          const left = elements[index]
          const right = elements[index + 1]
          if (
            (isNumericLike(left) && expressionHasHanBoundary(right, catalogs, 'start')) ||
            (expressionHasHanBoundary(left, catalogs, 'end') && isNumericLike(right))
          ) {
            addFinding(findings, sourceFile, node, "join('') directly joins a number and Chinese text")
            break
          }
        }
      }
    }
  })

  return findings
}

export const checkRuntimeChineseSpacing = (): RuntimeSpacingFinding[] => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true })
  const catalogs = loadChineseCatalogs()
  const findings: RuntimeSpacingFinding[] = []

  for (const file of listSourceFiles(RENDERER_DIR)) {
    const relativePath = path.relative(ROOT, file).replace(/\\/g, '/')
    if (IGNORED_SOURCE_FILES.has(relativePath)) continue
    const sourceFile = project.addSourceFileAtPath(file)
    findings.push(...analyzeRuntimeSpacing(sourceFile, catalogs))
    project.removeSourceFile(sourceFile)
  }
  return findings
}
