// Deve falhar no lint: seta apontando para fora — packages/* não importa de apps/*.
import type { Something } from '@habituar/api'
export type Leak = Something
