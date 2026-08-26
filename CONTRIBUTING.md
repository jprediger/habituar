# Contribuindo com o Habituar

> Regras de código: `CLAUDE.md` · Acessibilidade: `ACCESSIBILITY.md`

## Antes da primeira linha

1. Leia `CLAUDE.md`. Ele é vinculante, não sugestivo — inclusive a tabela final, que diz
   quais regras o CI impõe e quais dependem de você.
2. Confirme em qual marco do `implementation-plan.md` seu trabalho se encaixa. Marco
   fora de ordem custa retrabalho, não tempo.

## Branches

```
<tipo>/<descrição-curta-em-inglês>

feat/session-revocation
fix/rls-leak-on-report-query
chore/upgrade-expo-sdk
```

Branch sai de `main` e volta por PR. Ninguém commita direto em `main`.

## Commits — Conventional Commits

Formato obrigatório:

```
<tipo>(<escopo>): <descrição no imperativo>

[corpo opcional — explica o porquê, nunca o quê]

[rodapé opcional — BREAKING CHANGE, refs de issue]
```

### Tipos

| Tipo | Quando |
|---|---|
| `feat` | funcionalidade nova percebida por alguém |
| `fix` | correção de comportamento errado |
| `refactor` | muda estrutura sem mudar comportamento |
| `perf` | melhora desempenho sem mudar comportamento |
| `test` | adiciona ou corrige teste |
| `docs` | documentação apenas |
| `build` | toolchain, empacotamento, dependências |
| `ci` | pipeline |
| `chore` | manutenção que não se encaixa acima |
| `revert` | desfaz um commit anterior |

### Escopos

Um dos workspaces — `api`, `web`, `mobile`, `core`, `tokens`, `config` — ou um escopo de
repositório: `deps`, `release`, `docs`. Mudança que atravessa vários workspaces é sinal
de que talvez sejam vários commits.

### Regras

- **Em inglês**, como todo o resto do código.
- Imperativo: `add`, não `added` nem `adds`. A frase completa é
  "if applied, this commit will *add session revocation*".
- Minúscula no início, sem ponto final, no máximo 72 caracteres na primeira linha.
- **Um commit é uma mudança coesa.** Se a descrição precisa de "e", provavelmente são
  dois commits.
- Quebra de compatibilidade leva `!` após o escopo **e** rodapé `BREAKING CHANGE:` com a
  instrução de migração.
- Nunca commite código comentado, segredo, `.env` ou arquivo gerado.

### Exemplos

```
feat(api): add session revocation on role change
fix(core): resolve metric targets for students added after definition
refactor(web): move record filters into shared hook
feat(api)!: return cursor pagination on record list

BREAKING CHANGE: `page`/`perPage` foram removidos em favor de `cursor`.
Clientes na v1 continuam suportados até 2026-12-01.
```

E o que não passa:

```
update stuff              → sem tipo, sem escopo, sem informação
fix: bug                  → qual bug, em quê?
feat(api): adicionei rota → português e tempo verbal errado
chore: wip                → commit que não deveria existir no PR
```

## Pull requests

- **PR pequeno.** Revisão útil acaba por volta de 400 linhas; acima disso o revisor
  aprova por cansaço, e é aí que passa o vazamento entre instituições.
- Título do PR segue o mesmo formato dos commits.
- A descrição responde: **o que muda para quem usa** e **por que desta forma**.
  Comportamento que mudou entra também no `CHANGELOG.md`, na seção *Não publicado*.
- Se o PR toca schema, permissão, sessão ou qualquer caminho de leitura de dado
  sensível, diga isso explicitamente na descrição. Esses PRs são revisados com outro
  nível de atenção.

### Checklist

Estas são as regras que **nenhuma ferramenta pega** — é por isso que estão aqui:

- [ ] Rota nova está declarada no contrato em `packages/core`, validada com zod
- [ ] Nenhum provider herda de outro; nenhum `forwardRef`; nenhum `class-validator`
- [ ] Módulo é fatia vertical; não criei camada horizontal nem abstração para caso futuro
- [ ] Nenhum acesso a banco fora do caminho único, e o contexto de tenant é definido pelo
      wrapper de transação
- [ ] Autorização passa pelo call site único; nenhum papel comparado por string
- [ ] Efeito colateral (tempo, aleatoriedade, rede) é injetado, não chamado direto
- [ ] Teste descreve comportamento; regra de segurança tem teste que tenta burlá-la
- [ ] Tela nova cumpre o checklist do `ACCESSIBILITY.md`
- [ ] Comentários em pt-BR explicam o porquê; nenhum texto de usuário hardcoded
- [ ] Dependência nova resolve complexidade material e teve manutenção e cadeia de
      suprimentos avaliadas; não reimplementei criptografia, protocolo ou parser complexo
- [ ] `CHANGELOG.md` atualizado, se houver mudança percebida

## O que o CI exige

Lint, typecheck, testes e a checagem de acessibilidade precisam estar verdes. CI
vermelho não se contorna com `--no-verify`: se a regra está errada, muda-se a regra em um
PR próprio, com justificativa.

O formato dos commits é validado automaticamente. Commit fora do padrão é rejeitado no
`commit-msg`, não no review.
