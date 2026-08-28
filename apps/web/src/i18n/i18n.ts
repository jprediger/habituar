import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources.js'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: (typeof resources)['pt-BR']
  }
}

/**
 * Instância própria do app: nenhum estado do i18next é global ao workspace. Um único
 * idioma no M0 — não existe seletor nem detecção de locale do navegador.
 */
void i18next.use(initReactI18next).init({
  resources,
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

export default i18next
