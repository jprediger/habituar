# Habituar — Regras de desenvolvimento

> Regras vinculantes para qualquer código neste repositório.
> Produto: `project-description.md` · Arquitetura: `ARCHITECTURE.md` ·
> Execução: `implementation-plan.md` · Acessibilidade: `ACCESSIBILITY.md` ·
> Contribuição: `CONTRIBUTING.md`
>
> Regra que não é imposta por lint, tipo ou CI é sugestão. A última seção diz o que
> impõe o quê. O que estiver marcado como *review* é o que depende de disciplina.

## Idioma

- **Código em inglês**: identificadores, arquivos, diretórios, branches, commits,
  tabelas e colunas. Sem exceção e sem mistura no mesmo identificador.
- **Comentários e documentação em pt-BR.**
- **Comentário explica *por quê*, nunca *o quê*.** Com código em inglês, comentário que
  reafirma a linha é ruído bilíngue. Comente decisão, restrição, armadilha — não fluxo.
- **Texto de usuário sempre em pt-BR e sempre via i18n.** Literal de UI dentro de
  componente é erro. Mensagem de log e de erro interno é inglês.

## Estrutura

- **Fatia vertical, não camada horizontal.** Um módulo Nest por conceito de domínio,
  contendo tudo dele: schema, queries, regra, controller, testes. Não existem `services/`,
  `controllers/` ou `repositories/` no topo agrupando por tipo técnico.
- **Herança entre providers é proibida.** Sem `Base*`, sem `Abstract*`, sem classe de
  serviço herdada. Reuso é composição por injeção — o container existe para isso.
- **Um provider tem uma responsabilidade e um dono.** Provider que aparece em quatro
  módulos é sinal de que o conceito de domínio foi partido no lugar errado.
- **Ciclo entre módulos é erro de desenho.** `forwardRef` é proibido: se dois módulos se
  precisam mutuamente, ou são um só, ou falta um terceiro.
- **Barrel só por módulo.** Um `index.ts` reexportando o próprio módulo é aceitável em
  `apps/api`. Barrel global, e qualquer barrel em `packages/*`, é proibido — cria ciclo
  de import e destrói tree-shaking no cliente.
- **Dependência aponta para dentro.** Domínio não importa framework, HTTP, ORM ou UI.
  A borda importa o domínio, nunca o contrário.
- **Nenhum import atravessa fronteira de pacote sem passar pelo entrypoint público.**
  Em `packages/*`, cada entrypoint é um arquivo no primeiro nível de `src` e aparece
  explicitamente em `exports` por subpath (`@habituar/core/tasks` → `./src/tasks.ts`).
  Não existe entrypoint raiz nem barrel global.

## Tipos

- **Parse, don't validate.** Validação acontece uma vez, na borda. Função interna recebe
  tipo já parseado e não revalida nem faz checagem defensiva redundante.
- **Schema é a fonte da verdade.** Tipo de domínio é inferido do schema zod. Escrever à
  mão um tipo que espelha um schema é proibido — os dois divergem.
- **Validação é zod, sempre.** DTO com `class-validator` é proibido: seria uma segunda
  definição de validade, e evitar isso é a razão inteira do D4. A entrada chega ao
  controller já parseada por pipe de zod.
- **Identificadores são branded types**, não `string` cru. Trocar um id por outro precisa
  ser erro de compilação, não bug de produção.
- **Estado é união discriminada**, nunca combinação de booleanos ou campos opcionais.
  Todo `switch` sobre união termina em `assertNever` — variante nova quebra o build em
  cada ponto que precisa saber dela.
- **Tipos de domínio são `readonly`.** Não se muta parâmetro.
- Proibidos: `any`, `as` (fora de uma lista sancionada e comentada), `!` non-null,
  `@ts-ignore`. Entrada desconhecida é `unknown` e passa por parse.
- Decorators existem por causa do framework, e ficam **na borda**: controller, guard,
  pipe, interceptor, definição de provider. Decorator próprio que esconde regra de
  negócio é proibido — regra fica em código legível, não em metadata.

## Dados e transações

- **Um único caminho até o banco.** O client do ORM é importável apenas pelo módulo de
  acesso a dados. Todo o resto recebe a transação/conexão como parâmetro.
- **Contexto de requisição (tenant, ator, sessão) é definido no wrapper de transação**,
  nunca por chamada individual. Se existe um caminho que esquece de definir, ele é o
  vazamento.
- **Query é nomeada pela intenção**, específica e escopada. Nada de `findAll(where)`
  genérico: helper genérico é o convite para a consulta que ignora escopo.
- **Toda escrita relevante é transacional.** Nunca duas escritas dependentes fora de uma
  transação.
- Migração é aditiva e reversível. Remoção de coluna é operação em duas fases,
  em releases separados.

## Autorização

- **Um único call site.** Checagem de permissão passa por uma função só. Comparar papel
  por string em qualquer outro lugar é erro.
- **Chave de permissão vem de um catálogo fechado e tipado.** Chave com typo é erro de
  build, não `false` silencioso.
- **Negar por padrão é configuração, não disciplina.** Um `APP_GUARD` global exige sessão
  e permissão; rota pública se declara pública, e a lista de públicas é curta e revisada.
  Rota que esquece de se declarar falha fechada.

## Erros

- **Falha esperada não é exceção.** Não encontrado, sem permissão, conflito, entrada
  inválida: retorno tipado com código de um union fechado.
- **Exceção é para bug e falha de infra**, e sobe até a borda.
- **Só a borda traduz erro em resposta.** O mesmo módulo de domínio serve rota HTTP,
  worker e job sem que cada um invente seu mapeamento.
- `catch` vazio é proibido. Ou trata, ou enriquece e relança.
- Erro nunca carrega dado sensível na mensagem.

## Efeitos colaterais

- **Tempo, aleatoriedade, rede, disco e fila são portas injetadas**, não chamadas
  diretas. `new Date()` e `Math.random()` fora do adapter são proibidos: código que não
  controla o tempo não tem teste de tempo.
- **Porta só onde a troca é real** — relógio, id, envio, armazenamento, fila. Fora dessa
  lista, injete a **classe concreta**: token de injeção mais interface para implementação
  única é indireção morta, e o container torna barato criá-la sem perceber.
- **Efeito não acontece dentro de regra de domínio.** A regra decide; a borda executa.
- Operação externa é idempotente ou tem chave de idempotência.

## Cliente

- **Componente é burro, hook é esperto.** Toda tela tem um hook no pacote compartilhado
  devolvendo dados e ações prontos; cada plataforma só decide o visual. Lógica dentro de
  componente é lógica duplicada na outra plataforma.
- **Estado de servidor pertence à camada de data fetching**; estado local é só o que é
  genuinamente local. Não existe cache paralelo.
- `useEffect` para buscar dados é proibido.
- **Nenhuma referência visual no pacote compartilhado.** Nada de DOM, nada de primitivo
  nativo.
- Consistência visual vem de tokens, não de componente compartilhado entre plataformas.

## Testes

- **Teste descreve comportamento, não implementação.** Nome do teste é uma frase sobre o
  que o sistema faz.
- **Regra de segurança tem teste que tenta burlá-la de propósito**, não teste que confirma
  o caminho feliz.
- Teste de domínio é puro e sem mock de infraestrutura — se precisa de mock pesado, a
  dependência está no lugar errado.
- Bug corrigido entra com teste que falha antes da correção.
- Teste colocado junto do código, `*.test.ts`.

## Anti-padrões banidos

DI e decorators entram no projeto com o NestJS. O que continua fora é o que causa dano de
verdade — e o container facilita justamente essas coisas, então a vigilância aumenta.

- Classe base abstrata, herança de serviço, `Base*` / `Abstract*`
- Repository genérico sobre o ORM
- `@nestjs/cqrs`, event bus ou emitter interno antes de existir um segundo consumidor real
- Interface e token de injeção para implementação única sem papel de teste
- `forwardRef` para resolver ciclo entre módulos
- Provider com escopo de requisição em cascata — contexto de requisição é `AsyncLocalStorage`
- Decorator próprio que esconde regra de negócio
- DTO com `class-validator`
- Barrel `index.ts` reexportando o pacote inteiro
- Flag booleana como parâmetro que muda o comportamento do método — são dois métodos
- Abstração criada para um caso hipotético futuro

## Dependências

- **Dependência nova precisa comprar complexidade material.** Funcionalidade pequena,
  estável e bem delimitada prefere implementação local.
- A avaliação inclui custo de manutenção, saúde do projeto e exposição da cadeia de
  suprimentos, não apenas conveniência inicial.
- Não se reimplementam criptografia, protocolos ou parsers complexos. Nesses casos, uma
  biblioteca especializada e mantida reduz risco real.

## Convenções mecânicas

- Cada segmento do nome de arquivo é `kebab-case`, regra imposta automaticamente pelo
  lint: `student-record.controller.test.ts`, `vite.config.ts`.
- Sufixos de papel seguem a convenção do Nest por *review*: `tasks.module.ts`,
  `tasks.controller.ts`, `tasks.service.ts`, `tasks.repository.ts`.
- Tipos `PascalCase` sem prefixo `I`; constantes de módulo `UPPER_SNAKE`.
- Booleano começa com `is` / `has` / `can`. Função e método começam com verbo.
  Hook começa com `use`.
- Schema de validação tem sufixo `Schema`.
- Banco em `snake_case`; timestamp sempre com timezone; nunca ponto flutuante para valor
  que será agregado ou comparado.
- Commits em Conventional Commits, em inglês, com escopo do workspace:
  `feat(api): add session revocation`. Formato completo em `CONTRIBUTING.md`.
- Sem código comentado e sem `TODO` sem referência a issue.

## O que impõe o quê

| Regra | Imposta por |
|---|---|
| Direção entre workspaces e entrypoints públicos explícitos | `boundaries/dependencies` no CI |
| Import do client do ORM fora do módulo de dados | `no-restricted-imports` |
| `class-validator` em qualquer lugar | `no-restricted-imports` |
| `forwardRef`, herança de provider | `no-restricted-syntax` |
| `new Date()` / `Math.random()` fora do adapter | `no-restricted-imports` |
| Comparação de papel fora do call site único | `no-restricted-syntax` |
| `any`, `as`, `!`, `catch` vazio, `useEffect` de fetch | `@typescript-eslint` type-aware + regras de React |
| Exaustividade de união, tipos inferidos, `readonly` | tsconfig `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` |
| `kebab-case` em nomes de arquivo, formato e escopo de commit | lint local de nome + commitlint |
| Contrato implementado por inteiro, retorno dentro do schema | `@ts-rest/nest` em compilação |
| Sufixo de papel Nest, fatia vertical, porta vs. indireção, teste de comportamento, idioma do comentário | *review* |
