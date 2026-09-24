import { clipboard } from 'electron'

import { application } from '@application'
import { translateService } from '@main/services/translate/forkTranslateService'
import type { translateRequestSchemas } from '@shared/ipc/schemas/translate'
import type { IpcHandlersFor, WindowId } from '@shared/ipc/types'

function senderWebContents(senderId: WindowId | null): Electron.WebContents | undefined {
  if (senderId == null) return undefined
  return application.get('WindowManager').getWindow(senderId)?.webContents
}

/**
 * Opens a streaming translation. Delegates to the translateService singleton, resolving the
 * caller's WebContents from `ctx.senderId` — the service streams chunks directly to it via
 * the shared `ai.stream_*` events. Returns the `streamId` the renderer filters those by.
 */
export const translateHandlers: IpcHandlersFor<typeof translateRequestSchemas> = {
  'translate.plan': async (request) => translateService.plan(request),
  'translate.open': async (request, { senderId }) => {
    const wc = senderWebContents(senderId)
    if (!wc) throw new Error('translate.open requires a managed window')
    return translateService.open(wc, request)
  },
  'translate.clipboard_watch.start': async (_request, { senderId }) => {
    if (!senderId) throw new Error('clipboard watch requires a managed window')
    return application.get('ClipboardWatchService').subscribe(senderId)
  },
  'translate.clipboard_watch.stop': async (_request, { senderId }) => {
    if (senderId) application.get('ClipboardWatchService').unsubscribe(senderId)
  },
  'translate.clipboard.read': async () => {
    const items = await clipboard.read()
    let html = ''
    for (const item of items) {
      if (item.types.includes('text/html')) {
        const data = await item.getType('text/html')
        html = data instanceof Blob ? await data.text() : ''
        break
      }
    }
    return { text: await clipboard.readText(), html }
  },
  'translate.clipboard.write': async (text) => {
    await clipboard.writeText(text)
    return (await clipboard.readText()) === text
  },
  'translate.window.focus': async (_request, { senderId }) => {
    if (!senderId) return
    const window = application.get('WindowManager').getWindow(senderId)
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  },
  'translate.pdf.start': async (request, { senderId }) => {
    if (!senderId) throw new Error('translate.pdf.start requires a managed window')
    return application.get('PdfTranslationService').translate(
      request,
      (stage) => {
        application.get('IpcApiService').send(senderId, 'translate.pdf.stage', { jobId: request.jobId, stage })
      },
      (progress) => {
        application.get('IpcApiService').send(senderId, 'translate.pdf.progress', {
          jobId: request.jobId,
          ...progress
        })
      }
    )
  },
  'translate.pdf.cancel': async ({ jobId }, { senderId }) => {
    if (!senderId) throw new Error('translate.pdf.cancel requires a managed window')
    application.get('PdfTranslationService').cancel(jobId)
  }
}
