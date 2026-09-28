import type { PropsWithChildren, ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n/i18n.js'

/**
 * Único ponto que conhece a instância concreta do i18next; o resto do app só chama
 * `useTranslation()`, então trocar de biblioteca de tradução não vaza para as rotas.
 */
export function I18nProvider(props: PropsWithChildren): ReactElement {
  return <I18nextProvider i18n={i18n}>{props.children}</I18nextProvider>
}
