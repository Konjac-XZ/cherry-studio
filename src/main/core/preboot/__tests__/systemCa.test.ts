import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getCACertificatesMock, setDefaultCACertificatesMock } = vi.hoisted(() => ({
  getCACertificatesMock: vi.fn(),
  setDefaultCACertificatesMock: vi.fn()
}))

vi.mock('node:tls', () => ({
  getCACertificates: getCACertificatesMock,
  setDefaultCACertificates: setDefaultCACertificatesMock
}))

import { configureNodeSystemCa } from '../systemCa'

describe('configureNodeSystemCa', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_USE_SYSTEM_CA', '')
    getCACertificatesMock.mockImplementation((source: string) => {
      if (source === 'default') return ['bundled-ca', 'shared-ca']
      if (source === 'system') return ['system-ca', 'shared-ca']
      return []
    })
    setDefaultCACertificatesMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('adds system certificates to the current process and enables them for child Node processes', () => {
    configureNodeSystemCa()

    expect(getCACertificatesMock).toHaveBeenNthCalledWith(1, 'default')
    expect(getCACertificatesMock).toHaveBeenNthCalledWith(2, 'system')
    expect(setDefaultCACertificatesMock).toHaveBeenCalledWith(['bundled-ca', 'shared-ca', 'system-ca'])
    expect(process.env.NODE_USE_SYSTEM_CA).toBe('1')
  })
})
