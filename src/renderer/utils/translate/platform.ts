export const getTranslateModifierLabel = (navigatorLike: Pick<Navigator, 'platform' | 'userAgent'> = navigator) =>
  /Mac|iPhone|iPad|iPod/.test(navigatorLike.platform || navigatorLike.userAgent) ? 'Cmd' : 'Ctrl'
