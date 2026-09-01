import { application } from '@application'
import type { tabRequestSchemas } from '@shared/ipc/schemas/tab'
import type { IpcHandlersFor } from '@shared/ipc/types'

/**
 * Tab handlers — thin transport delegating to the SubWindowService domain owner. `attach`
 * re-absorbs a legacy detached tab into the main window. This fork intentionally rejects
 * new detach requests so one application function cannot be duplicated across windows.
 */
export const tabHandlers: IpcHandlersFor<typeof tabRequestSchemas> = {
  'tab.attach': async (payload, { senderId }) => application.get('SubWindowService').attachTab(payload, senderId),
  'tab.detach': async () => {},
  'tab.drag_end': async (_input, { senderId }) => {
    if (!senderId) return
    const win = application.get('WindowManager').getWindow(senderId)
    if (win && !win.isDestroyed() && win.getOpacity() < 1) win.setOpacity(1)
  }
}
