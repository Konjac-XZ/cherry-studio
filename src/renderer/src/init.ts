import KeyvStorage from '@kangfenmao/keyv-storage'
import { loggerService } from '@logger'

import { startAutoSync } from './services/BackupService'
import { startNutstoreAutoSync } from './services/NutstoreService'
import storeSyncService from './services/StoreSyncService'
import { webTraceService } from './services/WebTraceService'
import store from './store'
import { initialState as shortcutsInitialState } from './store/shortcuts'

loggerService.initWindowSource('mainWindow')

function initKeyv() {
  window.keyv = new KeyvStorage()
  window.keyv.init()
}

function initAutoSync() {
  setTimeout(() => {
    const { webdavAutoSync, localBackupAutoSync, s3 } = store.getState().settings
    const { nutstoreAutoSync } = store.getState().nutstore
    if (webdavAutoSync || (s3 && s3.autoSync) || localBackupAutoSync) {
      startAutoSync()
    }
    if (nutstoreAutoSync) {
      startNutstoreAutoSync()
    }
  }, 8000)
}

function initStoreSync() {
  storeSyncService.subscribe()
}

function initWebTrace() {
  webTraceService.init()
}

initKeyv()
initAutoSync()
initStoreSync()
initWebTrace()

// Ensure global shortcuts are registered in main on startup
try {
  const { shortcuts } = store.getState().shortcuts || { shortcuts: shortcutsInitialState.shortcuts }
  window.api?.shortcuts?.update?.(
    (shortcuts || shortcutsInitialState.shortcuts).map((s) => ({
      key: s.key,
      shortcut: [...s.shortcut],
      enabled: s.enabled,
      system: s.system,
      editable: s.editable
    }))
  )
} catch (e) {
  loggerService.withContext('init').warn('Failed to push shortcuts to main on startup')
}
