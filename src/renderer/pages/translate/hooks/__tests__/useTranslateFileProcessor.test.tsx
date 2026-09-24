import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { toast } from '@renderer/services/toast'
import type { FileContentGateway } from '@renderer/services/translatePlatform'
import type { FileMetadata } from '@renderer/types/file'
import type * as FileUtils from '@renderer/utils/file'
import { MB } from '@shared/utils/constants'

const isTextFileMock = vi.hoisted(() => vi.fn())

vi.mock('@renderer/utils/file', async (importOriginal) => ({
  ...(await importOriginal<typeof FileUtils>()),
  isTextFile: isTextFileMock
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, values?: Record<string, string>) => `${key}:${values?.maxSize ?? ''}` })
}))

import { useTranslateFileProcessor } from '../useTranslateFileProcessor'

const file = (path: string, size = 100): FileMetadata =>
  ({ id: path, path, size, type: path.endsWith('.png') ? 'image' : 'file' }) as FileMetadata

const createGateway = (): FileContentGateway => ({
  getPathForFile: vi.fn(),
  createTempFile: vi.fn(),
  write: vi.fn(),
  get: vi.fn(),
  readText: vi.fn(async () => 'text content'),
  readDocument: vi.fn(async () => 'document content'),
  startImageOcr: vi.fn(async () => 'ocr-job')
})

describe('useTranslateFileProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTextFileMock.mockResolvedValue(true)
  })

  it('reads a supported text file through the narrow gateway', async () => {
    const gateway = createGateway()
    const appendText = vi.fn()
    const { result } = renderHook(() =>
      useTranslateFileProcessor({ appendText, onOcrStarted: vi.fn(), fileContentGateway: gateway })
    )

    await act(async () => result.current.processFile(file('notes.txt')))

    expect(gateway.readText).toHaveBeenCalledWith('notes.txt')
    expect(appendText).toHaveBeenCalledWith('text content')
  })

  it('uses V2 document extraction for supported documents', async () => {
    const gateway = createGateway()
    const appendText = vi.fn()
    const { result } = renderHook(() =>
      useTranslateFileProcessor({ appendText, onOcrStarted: vi.fn(), fileContentGateway: gateway })
    )

    await act(async () => result.current.processFile(file('report.pdf')))

    expect(gateway.readDocument).toHaveBeenCalledWith('report.pdf')
    expect(appendText).toHaveBeenCalledWith('document content')
    expect(isTextFileMock).not.toHaveBeenCalled()
  })

  it('preserves the prepared source limits of 1 MB for text and 10 MB for documents', async () => {
    const gateway = createGateway()
    const { result } = renderHook(() =>
      useTranslateFileProcessor({ appendText: vi.fn(), onOcrStarted: vi.fn(), fileContentGateway: gateway })
    )

    await act(async () => result.current.processFile(file('large.txt', 1 * MB + 1)))
    await act(async () => result.current.processFile(file('large.pdf', 10 * MB + 1)))

    expect(gateway.readText).not.toHaveBeenCalled()
    expect(gateway.readDocument).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('translate.files.error.too_large:1MB')
    expect(toast.error).toHaveBeenCalledWith('translate.files.error.too_large:10MB')
  })

  it('starts image OCR through the V2 File Processing adapter', async () => {
    const gateway = createGateway()
    const onOcrStarted = vi.fn()
    const { result } = renderHook(() =>
      useTranslateFileProcessor({ appendText: vi.fn(), onOcrStarted, fileContentGateway: gateway })
    )

    await act(async () => result.current.processFile(file('scan.png')))

    expect(gateway.startImageOcr).toHaveBeenCalledWith('scan.png')
    expect(onOcrStarted).toHaveBeenCalledWith('ocr-job')
  })

  it('rejects multiple inputs before starting any processor', () => {
    const gateway = createGateway()
    const { result } = renderHook(() =>
      useTranslateFileProcessor({ appendText: vi.fn(), onOcrStarted: vi.fn(), fileContentGateway: gateway })
    )

    expect(result.current.getSingleFile([file('a.txt'), file('b.txt')])).toBeNull()
    expect(toast.error).toHaveBeenCalledWith('translate.files.error.multiple:')
    expect(gateway.readText).not.toHaveBeenCalled()
    expect(gateway.startImageOcr).not.toHaveBeenCalled()
  })
})
