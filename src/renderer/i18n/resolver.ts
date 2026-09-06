import 'dayjs/locale/de'
import 'dayjs/locale/el'
import 'dayjs/locale/es'
import 'dayjs/locale/fr'
import 'dayjs/locale/ja'
import 'dayjs/locale/pt'
import 'dayjs/locale/ro'
import 'dayjs/locale/ru'
import 'dayjs/locale/tr'
import 'dayjs/locale/vi'
import 'dayjs/locale/zh-cn'
import 'dayjs/locale/zh-tw'

import { preferenceService } from '@data/PreferenceService'
import { loggerService } from '@logger'
import type { LanguageVarious } from '@shared/data/preference/preferenceTypes'
import { defaultLanguage } from '@shared/utils/languages'
import dayjs from 'dayjs'
import i18n from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'

import { composeLocale, type LocaleCatalog } from './composeLocale'

const logger = loggerService.withContext('I18N')

type LocaleModule = { default: LocaleCatalog }

const loadComposedLocale = async (
  upstream: Promise<LocaleModule>,
  customLocale: Promise<LocaleModule> | undefined,
  overrides: Promise<LocaleModule> | undefined
): Promise<LocaleCatalog> => {
  const [upstreamModule, customEnglishModule, customLocaleModule, overrideModule] = await Promise.all([
    upstream,
    import('./custom-locales/en-us.json'),
    customLocale ?? Promise.resolve({ default: {} }),
    overrides ?? Promise.resolve({ default: {} })
  ])

  return composeLocale(
    upstreamModule.default,
    customEnglishModule.default,
    customLocaleModule.default,
    overrideModule.default
  )
}

// Lazy locale-pack loaders. Each dynamic import() is emitted as its own async
// chunk, so a window entry bundles zero translation JSON up front — i18next pulls
// the current language (and the en-US fallback) on demand inside initI18n().
const localeLoaders = {
  'en-US': () =>
    loadComposedLocale(import('./locales/en-us.json'), undefined, import('./custom-locales/overrides/en-us.json')),
  'zh-CN': () =>
    loadComposedLocale(
      import('./locales/zh-cn.json'),
      import('./custom-locales/zh-cn.json'),
      import('./custom-locales/overrides/zh-cn.json')
    ),
  'zh-TW': () =>
    loadComposedLocale(
      import('./locales/zh-tw.json'),
      import('./custom-locales/zh-tw.json'),
      import('./custom-locales/overrides/zh-tw.json')
    ),
  'de-DE': () =>
    loadComposedLocale(
      import('./locales/de-de.json'),
      import('./custom-locales/de-de.json'),
      import('./custom-locales/overrides/de-de.json')
    ),
  'el-GR': () =>
    loadComposedLocale(
      import('./locales/el-gr.json'),
      import('./custom-locales/el-gr.json'),
      import('./custom-locales/overrides/el-gr.json')
    ),
  'es-ES': () =>
    loadComposedLocale(
      import('./locales/es-es.json'),
      import('./custom-locales/es-es.json'),
      import('./custom-locales/overrides/es-es.json')
    ),
  'fr-FR': () =>
    loadComposedLocale(
      import('./locales/fr-fr.json'),
      import('./custom-locales/fr-fr.json'),
      import('./custom-locales/overrides/fr-fr.json')
    ),
  'ja-JP': () =>
    loadComposedLocale(
      import('./locales/ja-jp.json'),
      import('./custom-locales/ja-jp.json'),
      import('./custom-locales/overrides/ja-jp.json')
    ),
  'pt-PT': () =>
    loadComposedLocale(
      import('./locales/pt-pt.json'),
      import('./custom-locales/pt-pt.json'),
      import('./custom-locales/overrides/pt-pt.json')
    ),
  'ro-RO': () =>
    loadComposedLocale(
      import('./locales/ro-ro.json'),
      import('./custom-locales/ro-ro.json'),
      import('./custom-locales/overrides/ro-ro.json')
    ),
  'ru-RU': () =>
    loadComposedLocale(
      import('./locales/ru-ru.json'),
      import('./custom-locales/ru-ru.json'),
      import('./custom-locales/overrides/ru-ru.json')
    ),
  'vi-VN': () =>
    loadComposedLocale(
      import('./locales/vi-vn.json'),
      import('./custom-locales/vi-vn.json'),
      import('./custom-locales/overrides/vi-vn.json')
    ),
  'tr-TR': () =>
    loadComposedLocale(import('./locales/tr-tr.json'), undefined, import('./custom-locales/overrides/tr-tr.json'))
} satisfies Record<LanguageVarious, () => Promise<unknown>>

export const getLanguage = async () => {
  return (await preferenceService.get('app.language')) || navigator.language || defaultLanguage
}

export const getLanguageCode = async () => {
  return (await getLanguage()).split('-')[0]
}

// Map i18n language codes to dayjs locale codes
const dayjsLocaleMap: Record<string, string> = {
  'en-US': 'en',
  'ja-JP': 'ja',
  'ru-RU': 'ru',
  'zh-CN': 'zh-cn',
  'zh-TW': 'zh-tw',
  'de-DE': 'de',
  'el-GR': 'el',
  'es-ES': 'es',
  'fr-FR': 'fr',
  'pt-PT': 'pt',
  'ro-RO': 'ro',
  'vi-VN': 'vi',
  'tr-TR': 'tr'
}

export const setDayjsLocale = (language: string) => {
  const dayjsLocale = dayjsLocaleMap[language] || 'en'
  dayjs.locale(dayjsLocale)
}

let initPromise: Promise<void> | null = null

const doInit = async (): Promise<void> => {
  // Resolve the language up front. A rejected lookup falls back rather than
  // rejecting init — the UI must still render (in the fallback language).
  const lng = await getLanguage().catch(() => defaultLanguage)

  await i18n
    .use(
      resourcesToBackend((language: string) => {
        const loader = localeLoaders[language as LanguageVarious]
        return loader ? loader() : Promise.reject(new Error(`No locale pack for "${language}"`))
      })
    )
    .use(initReactI18next)
    .init({
      lng,
      fallbackLng: defaultLanguage,
      // Load only the exact locale code (e.g. `zh-CN`), never the bare base
      // (`zh`), which has no pack and would trigger a doomed extra fetch.
      load: 'currentOnly',
      // Catalogs are flat: `settings.provider.title` is one literal key, not a path.
      keySeparator: false,
      // Drop i18next's internal setTimeout(0) so init settles without a
      // macrotask (keeps fake-timer tests deterministic). Renamed `initAsync`
      // in i18next v24, and the compat alias is removed in v26 — rename when
      // upgrading.
      initImmediate: false,
      interpolation: {
        escapeValue: false
      },
      saveMissing: true,
      missingKeyHandler: (_1, _2, key) => {
        logger.error(`Missing key: ${key}`)
      }
    })
}

/**
 * Initialize i18next once, lazily. Idempotent: concurrent and repeat callers all
 * await the same in-flight promise. Every window entry must `await initI18n()`
 * before rendering, because translation packs now load asynchronously.
 */
export const initI18n = (): Promise<void> => (initPromise ??= doInit())

export default i18n
