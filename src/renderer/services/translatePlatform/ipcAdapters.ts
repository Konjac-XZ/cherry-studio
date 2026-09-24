import { ipcApi } from '@renderer/ipc'
import { AbsoluteFilePathSchema } from '@shared/types/file'
import { createFilePathHandle } from '@shared/utils/file'

import type { ClipboardContent, ClipboardGateway, FileContentGateway, WindowGateway } from './types'

const emptyClipboardContent = (): ClipboardContent => ({ html: '', plainText: '' })

export const ipcClipboardGateway: ClipboardGateway = {
  async readBrowserRich() {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    const read = clipboard?.read
    if (!clipboard || typeof read !== 'function') return emptyClipboardContent()

    const items = await read.call(clipboard)
    let plainText = ''
    let html = ''
    for (const item of items) {
      if (!plainText && item.types.includes('text/plain')) plainText = await (await item.getType('text/plain')).text()
      if (!html && item.types.includes('text/html')) html = await (await item.getType('text/html')).text()
    }
    return { html, plainText }
  },

  async readBrowserPlainText() {
    const readText = typeof navigator !== 'undefined' ? navigator.clipboard?.readText : undefined
    return readText ? readText.call(navigator.clipboard) : ''
  },

  async readNative() {
    const { html, text } = await ipcApi.request('translate.clipboard.read')
    return { html, plainText: text }
  },

  async writeBrowserText(text) {
    const writeText = typeof navigator !== 'undefined' ? navigator.clipboard?.writeText : undefined
    if (!writeText) throw new Error('Browser clipboard write is not available.')
    await writeText.call(navigator.clipboard, text)
  },

  async writeNativeText(text) {
    const written = await ipcApi.request('translate.clipboard.write', text)
    if (!written) throw new Error('Native clipboard write could not be verified.')
  },

  startWatch: () => ipcApi.request('translate.clipboard_watch.start'),
  stopWatch: () => ipcApi.request('translate.clipboard_watch.stop'),
  onChanged: (callback) => ipcApi.on('translate.clipboard_changed', callback),
  onWatchUnavailable: (callback) => ipcApi.on('translate.clipboard_watch_unavailable', callback)
}

export const ipcWindowGateway: WindowGateway = {
  async focus() {
    await ipcApi.request('translate.window.focus')
  }
}

export const ipcFileContentGateway: FileContentGateway = {
  getPathForFile: (file) => window.api.file.getPathForFile(file),
  createTempFile: (fileName) => window.api.file.createTempFile(fileName),
  async write(filePath, data) {
    await window.api.file.write(filePath, data)
  },
  get: (filePath) => window.api.file.get(filePath),
  readText: (filePath) => window.api.fs.readText(filePath),
  readDocument: (filePath) => window.api.file.readExternal(filePath, true),
  async startImageOcr(filePath) {
    const snapshot = await ipcApi.request('file_processing.start_job', {
      feature: 'image_to_text',
      file: createFilePathHandle(AbsoluteFilePathSchema.parse(filePath))
    })
    return snapshot.id
  }
}
