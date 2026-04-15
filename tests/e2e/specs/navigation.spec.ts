import { expect, test } from '../fixtures/electron.fixture'
import { SidebarPage } from '../pages/sidebar.page'
import { waitForAppReady } from '../utils/wait-helpers'

test.describe('Navigation', () => {
  let sidebarPage: SidebarPage

  test.beforeEach(async ({ mainWindow }) => {
    await waitForAppReady(mainWindow)
    sidebarPage = new SidebarPage(mainWindow)
  })

  test('should navigate to Settings page', async ({ mainWindow }) => {
    await sidebarPage.goToSettings()

    // Wait a bit for navigation to complete
    await mainWindow.waitForTimeout(1000)

    const currentUrl = mainWindow.url()
    expect(currentUrl).toContain('/settings')
  })

  test('should navigate to Files page', async ({ mainWindow }) => {
    await sidebarPage.goToFiles()

    await mainWindow.waitForTimeout(1000)

    const currentUrl = mainWindow.url()
    expect(currentUrl).toContain('/files')
  })

  test('should navigate back to Home', async ({ mainWindow }) => {
    // First go to settings
    await sidebarPage.goToSettings()
    await mainWindow.waitForTimeout(1000)

    // Then go back to home
    await sidebarPage.goToHome()
    await mainWindow.waitForTimeout(1000)

    // Verify we're on home page
    const currentUrl = mainWindow.url()
    // Home page URL should be either / or empty hash
    expect(currentUrl).toMatch(/#\/?$|#$/)
  })

  test('should navigate back to Home with the keyboard shortcut', async ({ mainWindow }) => {
    await sidebarPage.goToSettings()
    await mainWindow.waitForTimeout(1000)

    await mainWindow.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+H' : 'Control+Shift+H')
    await mainWindow.waitForTimeout(1000)

    const currentUrl = mainWindow.url()
    expect(currentUrl).toMatch(/#\/?$|#$/)
  })
})
