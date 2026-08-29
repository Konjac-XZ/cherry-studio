import { application } from '@application'
import { type WindowInfo, WindowType } from '@main/core/window/types'

/**
 * Windows running a full TabsProvider. Hidden SubWindows still own their tabs, so they must remain
 * in the candidate set; visibility only affects which owner is preferred. Single definition on
 * purpose — notification delivery and conversation-navigation ownership must agree on the
 * candidate set, or a card lands in a window the navigator won't treat as owner.
 */
export function getFullChromeWindowInfos(): WindowInfo[] {
  const windowManager = application.get('WindowManager')
  return [
    ...windowManager.getWindowInfosByType(WindowType.Main),
    ...windowManager.getWindowInfosByType(WindowType.SubWindow)
  ]
}
