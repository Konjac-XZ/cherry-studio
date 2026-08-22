export const MIN_TRANSLATE_PANEL_PERCENT = 30

const getMinimumTrailingPanelPixels = (vertical: boolean, viewportWidth: number) => {
  if (vertical) return 200
  if (viewportWidth < 600) return 250
  if (viewportWidth < 800) return 280
  return 320
}

export const getTranslatePanelBounds = (vertical: boolean, axisSize: number, viewportWidth: number) => {
  if (axisSize <= 0) {
    return { minimum: MIN_TRANSLATE_PANEL_PERCENT, maximum: MIN_TRANSLATE_PANEL_PERCENT }
  }

  const trailingMinimum = getMinimumTrailingPanelPixels(vertical, viewportWidth)
  return {
    minimum: MIN_TRANSLATE_PANEL_PERCENT,
    maximum: Math.max(MIN_TRANSLATE_PANEL_PERCENT, ((axisSize - trailingMinimum) / axisSize) * 100)
  }
}

export const clampTranslatePanelSize = (value: number, vertical: boolean, axisSize: number, viewportWidth: number) => {
  const { minimum, maximum } = getTranslatePanelBounds(vertical, axisSize, viewportWidth)
  return Math.min(maximum, Math.max(minimum, value))
}
