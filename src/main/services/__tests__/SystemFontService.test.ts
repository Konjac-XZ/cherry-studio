import { beforeEach, describe, expect, it, vi } from 'vitest'

const getFontsMock = vi.hoisted(() => vi.fn())

vi.mock('font-list', () => ({ default: { getFonts: getFontsMock } }))

import { SystemFontService } from '../SystemFontService'

describe('SystemFontService', () => {
  beforeEach(() => {
    getFontsMock.mockReset()
  })

  it('normalizes and caches a successful font enumeration', async () => {
    getFontsMock.mockResolvedValue([' Arial ', '', 'Menlo'])
    const service = new SystemFontService()

    await expect(service.getFonts()).resolves.toEqual(['Arial', 'Menlo'])
    await expect(service.getFonts()).resolves.toEqual(['Arial', 'Menlo'])

    expect(getFontsMock).toHaveBeenCalledOnce()
    expect(getFontsMock).toHaveBeenCalledWith({ disableQuoting: true })
  })

  it('shares an in-flight enumeration between concurrent callers', async () => {
    let resolveFonts!: (fonts: string[]) => void
    getFontsMock.mockReturnValue(new Promise<string[]>((resolve) => (resolveFonts = resolve)))
    const service = new SystemFontService()

    const first = service.getFonts()
    const second = service.getFonts()
    resolveFonts(['Arial'])

    await expect(Promise.all([first, second])).resolves.toEqual([['Arial'], ['Arial']])
    expect(getFontsMock).toHaveBeenCalledOnce()
  })

  it('retries after a failed enumeration', async () => {
    getFontsMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(['Arial'])
    const service = new SystemFontService()

    await expect(service.getFonts()).rejects.toThrow('boom')
    await expect(service.getFonts()).resolves.toEqual(['Arial'])

    expect(getFontsMock).toHaveBeenCalledTimes(2)
  })
})
