import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: (typeof resources)['pt-BR']
  }
}

/**
 * Instância própria do app mobile: locale fixo em pt-BR, sem `LanguageDetector` e sem
 * persistência — nada disso existe até o M0 ganhar um seletor de idioma real.
 */
void i18n.use(initReactI18next).init({
  resources,
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

export default i18n
