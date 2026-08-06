import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const childHandlers = new Map<string, (...args: unknown[]) => void>()
  return {
    childHandlers,
    childOff: vi.fn(),
    childOnce: vi.fn((event: string, handler: (...args: unknown[]) => void) => childHandlers.set(event, handler)),
    listenerOff: vi.fn(),
    listenerOn: vi.fn(),
    send: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(() => true)
  }
})

vi.mock('@application', () => ({
  application: {
    get: (name: string) => {
      if (name === 'IpcApiService') return { send: mocks.send }
      throw new Error(`Unexpected service: ${name}`)
    }
  }
}))

vi.mock('@logger', () => ({
  loggerService: { withContext: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }
}))

vi.mock('clipboard-event', () => ({
  default: {
    child: { off: mocks.childOff, once: mocks.childOnce },
    off: mocks.listenerOff,
    on: mocks.listenerOn,
    startListening: mocks.startListening,
    stopListening: mocks.stopListening
  }
}))

const createService = async () => {
  const [{ BaseService }, { ClipboardWatchService }] = await Promise.all([
    import('@main/core/lifecycle'),
    import('../ClipboardWatchService')
  ])
  BaseService.resetInstances()
  return new ClipboardWatchService()
}

describe('ClipboardWatchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.childHandlers.clear()
  })

  it('shares one listener across subscribers and stops after the final unsubscribe', async () => {
    const service = await createService()

    await expect(Promise.all([service.subscribe('main'), service.subscribe('main')])).resolves.toEqual([true, true])
    expect(mocks.listenerOn).toHaveBeenCalledOnce()
    expect(mocks.startListening).toHaveBeenCalledOnce()

    service.unsubscribe('main')
    expect(mocks.stopListening).not.toHaveBeenCalled()
    service.unsubscribe('main')
    expect(mocks.stopListening).toHaveBeenCalledOnce()
  })

  it('broadcasts a sequenced change to every subscribed window', async () => {
    const service = await createService()
    await service.subscribe('main')
    await service.subscribe('settings')
    const onChange = mocks.listenerOn.mock.calls[0][1] as () => void

    onChange()

    expect(mocks.send).toHaveBeenCalledWith('main', 'translate.clipboard_changed', { sequence: 1 })
    expect(mocks.send).toHaveBeenCalledWith('settings', 'translate.clipboard_changed', { sequence: 1 })
  })

  it('enters a stable unavailable state after native startup failure', async () => {
    mocks.startListening.mockImplementationOnce(() => {
      throw new Error('native unavailable')
    })
    const service = await createService()

    await expect(service.subscribe('main')).resolves.toBe(false)
    await expect(service.subscribe('settings')).resolves.toBe(false)

    expect(mocks.startListening).toHaveBeenCalledOnce()
    expect(mocks.send).toHaveBeenCalledWith('main', 'translate.clipboard_watch_unavailable', {
      reason: 'native unavailable'
    })
  })

  it.each([
    ['error', [new Error('child failed')]],
    ['exit', [1, null]]
  ])('detaches listener and child handlers after child %s', async (event, args) => {
    const service = await createService()
    await service.subscribe('main')

    mocks.childHandlers.get(event)?.(...args)

    expect(mocks.listenerOff).toHaveBeenCalledWith('change', expect.any(Function))
    expect(mocks.childOff).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mocks.childOff).toHaveBeenCalledWith('exit', expect.any(Function))
    await expect(service.subscribe('settings')).resolves.toBe(false)
  })
})
