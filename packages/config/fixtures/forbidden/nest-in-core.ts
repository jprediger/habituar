// Deve falhar no lint: framework dentro do pacote compartilhado.
import { Injectable } from '@nestjs/common'
export const leak = Injectable
