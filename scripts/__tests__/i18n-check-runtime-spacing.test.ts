import { Project } from 'ts-morph'
import { describe, expect, it } from 'vitest'

import { analyzeRuntimeSpacing } from '../i18n-check-runtime-spacing'

const catalogs = {
  'zh-cn': { 'unit.failed': '连接失败', 'unit.seconds': '秒' },
  'zh-tw': { 'unit.failed': '連線失敗', 'unit.seconds': '秒' }
}

const analyze = (code: string) => {
  const project = new Project({ skipAddingFilesFromTsConfig: true, compilerOptions: { jsx: 2 } })
  const sourceFile = project.createSourceFile('src/renderer/Test.tsx', code, { overwrite: true })
  return analyzeRuntimeSpacing(sourceFile, catalogs)
}

describe('runtime Chinese spacing AST guard', () => {
  it.each([
    "const f = new Intl.NumberFormat(locale, { notation: 'compact' })",
    "const f = new Intl.NumberFormat(locale, { style: 'unit', unit: 'second' })",
    "const f = new Intl.ListFormat(locale, { type: 'unit' })",
    'const f = new Intl.RelativeTimeFormat(locale)',
    "const f = new Intl.DateTimeFormat(locale, { month: 'short' })"
  ])('rejects high-risk localized formatter construction: %s', (code) => {
    expect(analyze(code)).toHaveLength(1)
  })

  it('rejects dynamic values touching hardcoded Chinese in templates', () => {
    expect(analyze('const label = `${seconds}秒`')).toHaveLength(1)
    expect(analyze('const label = `耗时${seconds}`')).toHaveLength(1)
  })

  it('rejects dynamic concatenation against a Chinese translation boundary', () => {
    expect(analyze("const label = name + t('unit.failed')")).toHaveLength(1)
  })

  it('rejects adjacent JSX number and translated Chinese unit', () => {
    expect(analyze("const label = <span>{seconds}{t('unit.seconds')}</span>")).toHaveLength(1)
    expect(analyze("const label = <span>{seconds} {t('unit.seconds')}</span>")).toEqual([])
  })

  it('rejects empty joins of a number and Chinese text', () => {
    expect(analyze("const label = [seconds, t('unit.seconds')].join('')")).toHaveLength(1)
    expect(analyze("const label = [seconds, t('unit.seconds')].join(' ')")).toEqual([])
  })

  it('accepts safe or centralized display composition', () => {
    expect(
      analyze(
        "const a = `${seconds} s`; const b = t('unit.failed', { name }); const c = date + ' ' + t('unit.failed'); const d = t('unit.failed') + (count ? ` (${count})` : ''); const f = new Intl.NumberFormat(locale)"
      )
    ).toEqual([])
  })
})
