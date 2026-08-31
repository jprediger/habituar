# M0 — Endurecimento da borda da API

> Índice e decisões do marco: [`m0-overview.md`](m0-overview.md) ·
> Plano da API: [`m0-api.md`](m0-api.md) · Arquitetura: `../ARCHITECTURE.md` ·
> Regras: `../CLAUDE.md`
>
> Origem: architecture review da fatia de API do M0 (fases 1 e 3 concluídas, 19 testes
> verdes). Escopo: fechar o que a review encontrou **antes** da primeira fatia de domínio,
> porque quase tudo aqui fica mais caro depois que existe um segundo call site.

---

## Problema

A fatia de API do M0 entrega os quatro padrões vazios que o marco prometeu — guard que nega
por padrão, contexto de requisição correlacionado, tradução de falha na borda e
`withTenant()`. Cada um funciona isoladamente e tem teste. Mas nenhum deles está **fechado**:
todos deixam em aberto exatamente a decisão que a primeira fatia de domínio do M1 vai ter que
tomar sozinha, no meio de outra tarefa, sem revisão dedicada.

Concretamente, hoje:

- **A promessa de formato de erro é falsa.** O `CLAUDE.md` e o `m0-api.md` afirmam que a
  resposta de falha é o catálogo fechado. Só a exceção não tratada respeita isso. O guard
  responde com o corpo default do Nest (`message` + `statusCode`), e a rota inexistente
  também. Quem consumir a API vê duas formas de erro, e a segunda não está em schema nenhum.
- **Não existe caminho declarado para falha esperada.** `mapFailureToHttpResponse` é
  exaustiva, testada e **não tem call site** — e a forma que ela devolve não encaixa num
  handler oRPC, cujo tipo vem do `output` de sucesso do contrato. A primeira fatia do M1
  inventa um jeito, e as seguintes copiam.
- **`withTenant()` protege contra query esquecida, não contra tenant errado.** O tenant chega
  por parâmetro, então qualquer call site pode passar qualquer instituição — inclusive uma
  lida do corpo da requisição. O `CLAUDE.md` pede o contrário: contexto definido no wrapper,
  nunca por chamada. Hoje `RequestContext` e `TenantContext` são dois tipos que não se
  conhecem, e a ponte entre eles é onde o vazamento nasce.
- **O log grava os headers inteiros.** Inofensivo enquanto não há sessão; no primeiro dia do
  M1 vira `cookie` e `authorization` em texto claro no log, e a limpeza é retroativa.
- **O desligamento não fecha o pool.** O hook existe, mas os listeners de sinal nunca são
  registrados, então SIGTERM não o aciona. Conexões ficam penduradas a cada reinício.
- **`LOG_LEVEL` é configuração morta** — parseada, documentada, nunca lida — e o logger
  próprio do Nest emite texto ao lado do JSON do pino, então o processo tem dois formatos.
- **O filtro de exceção pode falhar dentro de si mesmo**, apagando o erro original.

Além disso, a review levantou uma lacuna de documentação: o repositório tem uma regra forte
contra comentário redundante, e nenhuma regra a favor do comentário que falta. As decisões de
responsabilidade de cada classe existem — espalhadas por `plans/` e pelo `CHANGELOG` — mas não
onde são lidas.

## Solução

Um endurecimento da borda, sem nenhuma tabela de domínio nova e sem tocar em produto. Ao
final, cada padrão vazio do M0 tem **uma forma decidida e provada**, e a primeira fatia do M1
não escolhe nada:

- Uma forma de erro no fio, declarada no contrato compartilhado e herdada por toda procedure.
  Código de falha novo é erro de `tsc`; o cliente tipado do passo 14 recebe a união pronta.
- O tenant deixa de ser argumento e passa a ser lido do contexto da requisição. Passar a
  instituição de outra pessoa deixa de ser possível por construção, não por disciplina.
- Um formato de log só, com nível configurável e credencial redigida na origem.
- Desligamento que fecha o pool, e um filtro de exceção que é a última rede e não uma nova
  fonte de falha.
- Postura HTTP e limites de pool coerentes com "uma transação por requisição".
- Uma regra escrita sobre docblock de responsabilidade, imposta por review.

---

## Histórias de usuário

**Formato de erro e contrato**

1. Como desenvolvedora de uma fatia do M1, quero que o contrato já declare o catálogo fechado
   de falhas, para que eu não precise decidir sozinha como uma falha esperada sai pela borda.
2. Como desenvolvedora de uma fatia do M1, quero que lançar um código de falha inexistente
   seja erro de compilação, para que typo em código de erro não vire resposta errada em
   produção.
3. Como desenvolvedora do cliente web e mobile, quero receber a união de falhas já tipada a
   partir do contrato, para que a tela trate cada caso sem eu reescrever o catálogo.
4. Como consumidora da API, quero que toda resposta de falha tenha a mesma forma, para que meu
   tratamento de erro não dependa de qual camada do servidor falhou.
5. Como consumidora da API, quero que a resposta de rota inexistente e a de rota negada usem o
   mesmo envelope das falhas de domínio, para que não existam três formatos de erro.
6. Como revisor de PR, quero que o único ponto que traduz falha em resposta seja nomeado e
   óbvio, para que eu perceba quando alguém inventa um segundo.
7. Como responsável por segurança, quero que a mensagem de erro venha da declaração no
   contrato e nunca de dado da requisição, para que erro não vire canal de vazamento.
8. Como operadora, quero que a exceção inesperada continue devolvendo só `correlationId`, para
   que eu ligue a resposta ao log sem expor nada ao cliente.
9. Como desenvolvedora, quero que o filtro de exceção nunca lance por falta de contexto, para
   que o erro original não desapareça atrás de um erro de infraestrutura do próprio filtro.

**Isolamento entre instituições**

10. Como responsável pelo produto, quero que seja impossível uma fatia consultar o banco em
    nome de outra instituição, para que o isolamento não dependa de cada autora lembrar.
11. Como desenvolvedora de uma fatia do M1, quero que a transação já saiba a instituição, o
    ator e a sessão da requisição corrente, para que eu não passe contexto à mão em cada
    chamada.
12. Como revisora de PR, quero que passar uma instituição arbitrária exija um método separado
    e nomeado, para que todo uso legítimo fora de requisição seja visível na revisão.
13. Como operadora de um job ou worker futuro, quero um caminho explícito para rodar sem
    requisição, para que a ausência de contexto não me obrigue a burlar o desenho.
14. Como responsável por segurança, quero um teste que prove que o tenant usado na consulta
    veio da requisição, e não de um parâmetro do call site, para que a ponte entre os dois
    contextos esteja coberta.
15. Como desenvolvedora, quero que chamar o banco fora de um contexto de tenant falhe alto e
    cedo, para que o erro apareça no teste e não como zero linhas silencioso em produção.

**Observabilidade**

16. Como operadora, quero um formato de log só no processo inteiro, para que o boot e as
    requisições caiam no mesmo coletor.
17. Como operadora, quero que `LOG_LEVEL` realmente mude o nível emitido, para que eu abaixe o
    ruído em produção e suba o detalhe ao investigar.
18. Como responsável por segurança, quero que `authorization` e `cookie` nunca cheguem ao log,
    para que credencial de sessão não fique legível para quem tem acesso ao coletor.
19. Como responsável por segurança, quero que a redação aconteça na origem e não no coletor,
    para que o dado sensível não exista em disco em nenhum ponto do caminho.
20. Como operadora, quero que toda linha de log de uma requisição continue carregando o
    `correlationId`, para que eu reconstrua o fluxo a partir da resposta que a pessoa usuária
    recebeu.
21. Como desenvolvedora, quero um teste que prove a redação, para que ela não seja desligada
    por engano numa mudança de configuração do logger.

**Ciclo de vida e postura do processo**

22. Como operadora, quero que SIGTERM feche o pool antes do processo sair, para que reinício
    e deploy não deixem conexão pendurada até o timeout do Postgres.
23. Como operadora, quero que uma transação esquecida aberta não segure conexão
    indefinidamente, para que uma fatia com bug não degrade o banco inteiro.
24. Como operadora, quero limites explícitos de pool e de tempo de consulta, para que a
    saturação apareça como erro nomeado e não como lentidão difusa.
25. Como responsável por segurança, quero que o servidor não anuncie a tecnologia que roda,
    para que o reconhecimento de alvo custe mais.
26. Como desenvolvedora do cliente web, quero a política de origem cruzada declarada
    explicitamente, para que o navegador não me bloqueie numa etapa em que a causa é obscura.

**Regras e documentação**

27. Como pessoa nova no repositório, quero que cada classe exportada diga de que é dona, para
    que eu não reconstrua a responsabilidade lendo os call sites.
28. Como agente de IA trabalhando neste repositório, quero a fronteira de cada módulo escrita
    junto do código, para que eu não infira a responsabilidade errada a partir do nome do
    arquivo.
29. Como revisora de PR, quero uma regra escrita que distinga docblock de responsabilidade de
    comentário redundante, para que a discussão em revisão seja sobre o critério e não sobre
    gosto.
30. Como autora de uma classe nova, quero descobrir na hora de escrever a frase que ela tem
    duas responsabilidades, para que a fatia seja corrigida antes de existir.
31. Como mantenedora do `CLAUDE.md`, quero que a tabela "O que impõe o quê" continue honesta
    sobre o que é *review*, para que ninguém confunda regra escrita com regra imposta.
32. Como pessoa que opera o banco em produção, quero que o arquivo de criação de roles diga
    que serve só a desenvolvimento e CI, para que ninguém o execute achando que é o
    provisionamento real.

---

## Decisões de implementação

### 1. Falha esperada sai pelo contrato, não por `Outcome` no fio

O catálogo fechado é declarado **uma vez, na raiz do contrato compartilhado**, e toda
procedure o herda pela mescla do oRPC. Verificado em `@orpc/contract@1.15.0`: `.errors()`
existe no builder de router e faz *spread-merge* com erros já declarados.

```ts
// Forma decidida — o catálogo mora na raiz e nenhuma fatia o redeclara.
export const apiContract = oc
  .errors({
    not_found:       { status: 404, data: failureDataSchema },
    forbidden:       { status: 403, data: failureDataSchema },
    unauthenticated: { status: 401, data: failureDataSchema },
    conflict:        { status: 409, data: failureDataSchema },
    invalid_input:   { status: 422, data: failureDataSchema },
  })
  .prefix(`/${API_VERSION}`)
  .router({ health: healthContract })
```

- A lista de chaves é derivada de `FAILURE_CODES` — não é uma segunda escrita do catálogo.
  Código novo entra em `FAILURE_CODES` e o contrato deixa de compilar até ganhar o status.
- O handler lança `errors.not_found()`. **Isto reintroduz `throw` no caminho de falha, e é
  deliberado**: a regra "falha esperada não é exceção" continua valendo dentro do domínio,
  que segue devolvendo `Outcome<T>`. O `throw` acontece só na borda, no ponto que traduz
  `Outcome` em resposta — que é exatamente onde o `CLAUDE.md` já diz que a tradução mora.
- `mapFailureToHttpResponse` deixa de ser código morto: vira **o único tradutor** de
  `Outcome.failure` para o erro declarado do contrato, com o `switch` exaustivo preservado.
  Ela muda de forma (deixa de montar `{ status, body }` à mão), não de papel.
- A `message` do erro vem da declaração no contrato. **Nunca interpolada com dado da
  requisição** — o envelope do oRPC carrega `message` no fio, então interpolar ali é vazamento.

### 2. Uma forma de erro no fio, inclusive para o que o framework lança

O oRPC serializa erro como `{ defined, code, status, message, data }`. Essa passa a ser **a**
forma de falha da API. O guard e o roteamento do Nest lançam `HttpException`, que produz outra
forma; o filtro de exceção passa a traduzi-las para o mesmo envelope antes de responder.

| Origem | Hoje | Depois |
|---|---|---|
| Falha de domínio | não existe caminho | envelope oRPC, `code` do catálogo |
| Guard negando | `{ message, statusCode }` | envelope oRPC, `code: 'unauthenticated'` |
| Rota inexistente | `{ message, error, statusCode }` | envelope oRPC, `code: 'not_found'` |
| Exceção inesperada | `{ code, correlationId }` | inalterado |

A exceção inesperada continua sendo o único caso fora do catálogo, porque `internal_error`
não é falha esperada e não pertence ao catálogo fechado — ela é o contrato de "bug ou infra",
e carrega `correlationId` justamente por não poder carregar mais nada.

### 3. O tenant deixa de ser argumento

`withTenant` passa a **ler instituição, ator e sessão do contexto de requisição** em vez de
recebê-los. Consequências:

- `RequestContext` cresce para carregar o tenant, e passa a ser a fonte única dos dois
  contextos que hoje não se conhecem. `TenantContext` deixa de ser um tipo que qualquer um
  monta e passa a ser derivado.
- Um segundo método, separado e nomeado, atende o caso legítimo sem requisição (job, worker,
  migração de dados). Ele é **um par de olhos por definição**: todo uso aparece na busca pelo
  nome, e a lista de call sites é curta e revisada, como a lista de rotas públicas.
- Não é flag booleana mudando comportamento de um método — são dois métodos, como o
  `CLAUDE.md` exige.
- Chamada sem contexto disponível falha alto, com erro nomeado. A RLS já falha fechada
  devolvendo zero linhas; o erro explícito existe para que a causa apareça no teste em vez de
  virar "sumiu linha" em produção.
- Os identificadores continuam strings cruas no M0. A dívida dos branded types já está
  registrada no `CHANGELOG` e não muda aqui.

### 4. Um logger só, com nível e redação

- O pino passa a ser o logger da aplicação inteira, inclusive do boot, substituindo o logger
  próprio do Nest. Dois formatos no mesmo processo é o mesmo problema que "dois formatos de
  erro", num canal diferente.
- `LOG_LEVEL` passa a ser lido e aplicado. Configuração parseada e não usada é pior que
  configuração ausente: promete controle que não existe.
- `authorization` e `cookie` são removidos na origem, não mascarados. Mascarar deixa o
  comprimento e a presença no disco; remover não.
- O destino do log passa a ser sobreponível pelo container, para viabilizar o seam de teste
  descrito adiante. É a exceção sancionada do `CLAUDE.md` — a indireção existe por papel de
  teste real, não por hipótese.

### 5. Ciclo de vida e postura

- Os hooks de desligamento passam a ser registrados no boot, para que o hook de encerramento
  do pool — que já existe e já é testado por chamada direta — realmente rode em SIGTERM.
- O pool ganha limite de conexões, timeout de conexão, `statement_timeout` e
  `idle_in_transaction_session_timeout`. O último é a proteção específica deste desenho: com
  uma transação por requisição, transação pendurada segura conexão *e* bloqueia vacuum.
- O anúncio de tecnologia do Express é desligado; cabeçalhos de segurança e política de origem
  cruzada passam a ser declarados explicitamente.
- O filtro de exceção passa a tolerar ausência de contexto e de logger de requisição. É o
  único lugar do código onde checagem defensiva se justifica, porque é a última rede: um
  filtro que lança apaga o erro que deveria registrar.

### 6. Regra de docblock no `CLAUDE.md`

Entra na seção **Idioma**, ao lado da regra existente sobre comentário, e ganha uma linha na
tabela **O que impõe o quê** marcada como *review* — coerente com "sufixo de papel Nest" e
"teste de comportamento", que também são disciplina e estão declarados como tal.

Texto da regra:

> - **Toda classe e função exportada carrega um docblock de responsabilidade.** Uma ou duas
>   linhas respondendo *de que isto é dono* e, quando existe, *o que isto recusa*. Não é o
>   "o quê" que a regra acima proíbe: responsabilidade e fronteira não estão no corpo — o
>   leitor as reconstruiria lendo os call sites.
> - **Teste da tesoura.** Se apagar o docblock e um leitor competente recupera a mesma
>   informação em cinco segundos olhando a declaração, ele é ruído e sai.
> - **Descreve responsabilidade, não comportamento.** "Único caminho até o banco" sobrevive a
>   refatoração; "abre uma transação e chama `set_config`" envelhece na primeira mudança.
> - Sem `@param`, sem `@returns`, sem repetir a assinatura. Nada em membro privado.

Não vira lint. Docblock obrigatório por linter produz docblock cerimonial escrito para calar
o linter — o oposto exato do objetivo. A cobertura vem da revisão, e o custo de esquecer é
baixo; o custo de institucionalizar a frase vazia é alto e silencioso.

As classes já existentes na borda da API recebem o docblock no mesmo passo, para que a regra
nasça com exemplo no código e não só no documento.

### 7. Correções menores acopladas

- A fatia `authorization` ganha módulo próprio, para que tenha dono declarado como as demais.
  Hoje o guard é registrado direto na composição raiz, o que funciona mas deixa a fatia sem
  dono — contraria a regra da fatia vertical, e a review não encontrou razão para a exceção.
- O arquivo de criação de roles ganha um comentário dizendo que serve a desenvolvimento e CI
  apenas. As senhas literais que ele fixa são aceitáveis nesses dois ambientes e inaceitáveis
  fora deles; sem o aviso, o arquivo parece provisionamento real.
- Os privilégios default do dono passam a cobrir sequences além de tabelas. Hoje é
  irrelevante (identificadores são uuid), e é justamente por isso que vale fazer agora: a
  primeira coluna de identidade do M1 falharia com permissão negada num ponto distante da
  causa.
- O teste de contexto de requisição deixa de importar o módulo de plataforma junto da
  composição raiz, o que hoje registra o middleware duas vezes. O teste passa por coincidência
  consistente, não por desenho.

---

## Decisões de teste

**O que faz um teste bom aqui.** Todo teste desta spec afirma comportamento observável de
fora: o que sai no fio, o que aparece no log, quais linhas o banco devolve. Nenhum afirma que
um método foi chamado, que um provider foi registrado ou que uma opção de configuração tem
determinado valor — isso é implementação, e trocaria uma regressão real por um teste que
quebra em toda refatoração. O nome de cada teste é uma frase sobre o que o sistema faz.

**Seams existentes, reaproveitados.** A preferência é não criar seam novo; três já cobrem a
maior parte:

| Seam | Prior art no repositório | Cobre nesta spec |
|---|---|---|
| App Nest real em porta efêmera + `fetch` | testes de saúde, de guard, de tradução de falha e de contexto de requisição | forma única de erro (guard, rota inexistente, falha declarada), ausência do anúncio de tecnologia, cabeçalhos |
| `Database` + Postgres real por testcontainers | teste de isolamento entre instituições | as seis burlas atuais, preservadas sem alteração |
| Função pura | tabela de tradução de falhas, `assertNever` | tradução de `Outcome` para erro declarado, exaustividade |

O seam de app real é o mais alto disponível e já é o estilo da casa. Rotas de teste declaradas
dentro do próprio arquivo de teste — padrão que os testes de guard e de exceção já usam —
continuam sendo a forma de exercitar um comportamento que ainda não tem rota de produção.

**Seams novos, dois, ambos justificados por não haver alternativa mais alta:**

1. **Log observável por destino sobreponível.** Nenhum seam existente enxerga o que o processo
   escreve. O teste sobe o app com o destino do pino apontado para um buffer em memória, faz
   uma requisição carregando `authorization` e `cookie`, e afirma sobre as linhas capturadas:
   que a credencial não aparece, que o `correlationId` aparece em todas, e que o nível
   configurado é respeitado. Cobre redação, nível e formato único. Sem isso, redação é crença.
2. **HTTP × Postgres, provando a origem do tenant.** Combina os dois seams existentes em vez
   de criar um terceiro: uma rota de teste lê a tabela-sonda, é chamada por HTTP com contexto
   de instituição A, e devolve só linhas de A. É a única prova de que a instituição usada na
   consulta veio da requisição, e não de um argumento escolhido pelo call site — que é
   precisamente a mudança de desenho desta spec.

**Testes que mudam de asserção.** O teste do guard hoje afirma apenas `status === 401`; passa
a afirmar também o **corpo**, porque foi a asserção fraca que deixou a divergência de formato
passar despercebida. Mesma correção para o teste de rota sem versão.

**O que não ganha teste, deliberadamente.** O registro dos hooks de desligamento e os limites
do pool. Provar o primeiro exige subir o processo compilado e enviar sinal — um seam novo,
mais lento e mais frágil no CI do que o problema justifica neste marco; provar o segundo exige
saturar um pool real. Ambos são configuração de uma linha, verificável em revisão. Registrado
aqui como decisão consciente, não como esquecimento.

---

## Fora de escopo

- **Qualquer tabela ou regra de domínio.** O marco continua sendo encanamento; nada aqui
  antecipa instituições, usuários, sessões ou vínculos.
- **Autenticação de verdade.** O guard continua negando tudo que não se declara público. A
  sessão opaca do D6 é M1, e é ela que vai preencher ator e sessão no contexto — esta spec só
  prepara o lugar onde eles entram.
- **Branded types para os identificadores de tenant.** Dívida já registrada no `CHANGELOG`,
  nasce em `packages/core` no M1.
- **Autorização por permissão.** O catálogo fechado de permissões do D9 é M1; esta spec não
  cria call site de checagem de papel.
- **Os demais passos pendentes do M0** — `openapi.json` e seu gate, cliente tipado,
  `toQueryState`, hook de saúde, `design-tokens`, `apps/web` e `apps/mobile`, e o resto da
  fase 0. Continuam valendo como estão em [`m0-overview.md`](m0-overview.md); esta spec não
  os reordena.
- **Dockerfile e deploy.** Continuam fora do M0 pelo motivo já registrado.
- **Lint que imponha docblock.** Decidido contra, com o motivo acima. Reabrir exigiria
  evidência de que a revisão está deixando passar, não preferência.
- **Readiness.** `/v1/health` continua sendo liveness e continua sem tocar o banco. Readiness
  entra quando existir algo que possa ficar não-pronto.

---

## Notas

**Ordem sugerida.** A decisão do contrato de erro vem primeiro: ela muda a forma de
`mapFailureToHttpResponse` e do filtro de exceção, e refazer os dois depois seria trabalho
jogado fora. Em seguida o tenant, que é a mudança de desenho mais profunda e a única que fica
inviável depois que existir um segundo call site de banco. O resto — logger, ciclo de vida,
postura, menores, docblocks — é independente entre si e pode ir em qualquer ordem, inclusive
em paralelo.

**Por que agora e não no M1.** Todos os itens desta spec têm hoje exatamente um call site, ou
nenhum. Cada um deles, depois da primeira fatia de domínio, vira refatoração de N call sites
com risco de deixar um para trás — e o item do tenant vira, especificamente, uma auditoria de
segurança em vez de uma mudança de assinatura. É o mesmo argumento que já justificou trazer
`withTenant()` para o M0 sem domínio para usá-lo.

**Tensão declarada, não resolvida por acidente.** Adotar `.errors()` reintroduz `throw` no
caminho de falha esperada, e o `CLAUDE.md` diz "falha esperada não é exceção". A regra
continua íntegra no domínio, que segue devolvendo `Outcome<T>`; a exceção existe só no último
passo da borda, como mecanismo de transporte do framework. Vale registrar a nuance no
`ARCHITECTURE.md` junto ao D4 na próxima revisão daquele documento, para que a contradição
aparente não seja redescoberta como bug de aderência.

**Riscos.** O oRPC está em movimento rápido (`2.0.0-beta` no horizonte) e `.errors()` é API de
contrato, portanto exposta a mudança de major — o risco já está registrado no
[`m0-overview.md`](m0-overview.md) e esta spec o aumenta um pouco, em troca de tipagem
ponta a ponta. E a regra de docblock, sendo *review*, decai se a revisão relaxar; o sinal de
alerta é o primeiro docblock que descreve comportamento em vez de responsabilidade.

**Entradas de `CHANGELOG`.** A mudança de formato de erro é percebida por quem consome a API e
afeta compatibilidade — entrada obrigatória, em `Alterado`. A redação de credencial no log
entra em `Segurança`, descrevendo o impacto e não como explorar. O fechamento do pool em
SIGTERM entra em `Corrigido`.
