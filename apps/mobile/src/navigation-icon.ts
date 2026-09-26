import type Ionicons from '@expo/vector-icons/Ionicons'
import { assertNever } from '@habituar/core/assert-never'
import type { ProfessionalNavigationIcon } from '@habituar/react-client/professional-navigation'
import type { ComponentProps } from 'react'

type IoniconName = ComponentProps<typeof Ionicons>['name']

export type NavigationGlyphs = Readonly<{ inactive: IoniconName; active: IoniconName }>

/**
 * Tradução do ícone lógico da navegação para o conjunto nativo. Cada ícone tem o par
 * contorno/preenchido porque o preenchimento é um dos sinais de seleção que não dependem
 * de cor; ícone novo no hook quebra o build aqui até ganhar os dois.
 */
export function getNavigationGlyphs(icon: ProfessionalNavigationIcon): NavigationGlyphs {
  switch (icon) {
    case 'home':
      return { inactive: 'home-outline', active: 'home' }
    case 'user':
      return { inactive: 'person-outline', active: 'person' }
    default:
      return assertNever(icon)
  }
}
