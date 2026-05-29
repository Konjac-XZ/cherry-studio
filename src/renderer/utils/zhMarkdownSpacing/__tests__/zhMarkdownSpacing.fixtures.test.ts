import { existsSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { normalizeZhMarkdownTextSpacing } from '..'

const fixturesDir = path.join(__dirname, 'fixtures')
const inputSuffix = '.input.md'
const outputSuffix = '.output.md'

type FixturePair = {
  caseName: string
  inputPath: string
  outputPath: string
}

type FixtureDiscovery = {
  missingOutputs: string[]
  orphanOutputs: string[]
  pairs: FixturePair[]
}

function discoverFixtures(): FixtureDiscovery {
  const entries = existsSync(fixturesDir) ? readdirSync(fixturesDir) : []
  const inputFiles = entries.filter((entry) => entry.endsWith(inputSuffix)).sort()
  const outputFiles = entries.filter((entry) => entry.endsWith(outputSuffix)).sort()

  const inputCaseNames = new Set(inputFiles.map((fileName) => fileName.slice(0, -inputSuffix.length)))
  const outputCaseNames = new Set(outputFiles.map((fileName) => fileName.slice(0, -outputSuffix.length)))

  const missingOutputs = [...inputCaseNames]
    .filter((caseName) => !outputCaseNames.has(caseName))
    .map((caseName) => path.join(fixturesDir, `${caseName}${outputSuffix}`))

  const orphanOutputs = [...outputCaseNames]
    .filter((caseName) => !inputCaseNames.has(caseName))
    .map((caseName) => path.join(fixturesDir, `${caseName}${outputSuffix}`))

  return {
    missingOutputs,
    orphanOutputs,
    pairs: [...inputCaseNames].sort().map((caseName) => ({
      caseName,
      inputPath: path.join(fixturesDir, `${caseName}${inputSuffix}`),
      outputPath: path.join(fixturesDir, `${caseName}${outputSuffix}`)
    }))
  }
}

describe('normalizeZhMarkdownTextSpacing fixtures', () => {
  const fixtureDiscovery = discoverFixtures()

  it('has complete input/output fixture pairs', () => {
    expect(
      fixtureDiscovery.missingOutputs,
      `Missing fixture output files:\n${fixtureDiscovery.missingOutputs.join('\n')}`
    ).toEqual([])
    expect(
      fixtureDiscovery.orphanOutputs,
      `Fixture output files without matching input:\n${fixtureDiscovery.orphanOutputs.join('\n')}`
    ).toEqual([])
  })

  it.each(fixtureDiscovery.pairs)('$caseName', async (fixture) => {
    const [input, output] = await Promise.all([
      readFile(fixture.inputPath, 'utf8'),
      readFile(fixture.outputPath, 'utf8')
    ])

    expect(normalizeZhMarkdownTextSpacing(input), `Fixture: ${fixture.caseName}\nExpected: ${fixture.outputPath}`).toBe(
      output
    )
  })
})
