// Deve falhar no lint: decorators ficam na borda do framework, não no domínio.
declare function Injectable(): (target: Function) => void

@Injectable()
export class Leak {}
