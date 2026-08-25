export class SystemFontService {
  private fontsPromise: Promise<string[]> | undefined

  getFonts(): Promise<string[]> {
    if (!this.fontsPromise) {
      this.fontsPromise = this.loadFonts().catch((error) => {
        this.fontsPromise = undefined
        throw error
      })
    }

    return this.fontsPromise
  }

  private async loadFonts(): Promise<string[]> {
    const { default: fontList } = await import('font-list')
    const fonts = await fontList.getFonts({ disableQuoting: true })

    return fonts.map((font: string) => font.trim()).filter(Boolean)
  }
}

export const systemFontService = new SystemFontService()
