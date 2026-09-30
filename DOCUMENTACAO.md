# Habituar — Documentação do Sistema

> Espelho textual de [`documentacao_habituar.docx`](documentacao_habituar.docx),
> mantido para busca, revisão em Git e contexto de agentes. O DOCX é o documento
> oficial e preserva o layout de entrega. Mudanças de conteúdo devem atualizar os
> dois arquivos na mesma alteração.

| Nome | Função |
| --- | --- |
| Equipe Habituar | Análise, desenvolvimento, testes e documentação |

## Introdução

Habituar é uma plataforma web e mobile de apoio à organização de estudantes com dificuldades de aprendizagem e ao trabalho dos profissionais que os acompanham. O sistema oferece uma base única para estruturar rotina, tarefas, agenda e acompanhamento, reduzindo a dependência de planilhas, papel e registros dispersos.

O contexto inicial é uma instituição de ensino que acompanha estudantes com TDAH, autismo e deficiências. A principal dificuldade observada é organizacional: planejar estudos, acompanhar entregas e avaliações e manter uma visão contínua do acompanhamento realizado.

A solução é preparada para atender múltiplas instituições com isolamento de dados. Os principais usuários são aluno, profissional, monitor e administrador geral. O administrador geral atua no provisionamento da plataforma e não recebe acesso implícito aos dados sensíveis das instituições.

## Requisitos Funcionais (RFs)

### RF0001 – Consultar estado do serviço

A plataforma deve disponibilizar uma consulta de disponibilidade e versão para web e mobile.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Média | Baixa | Implementado | Atual |

### RF0002 – Cadastrar usuário

A pessoa deve poder criar uma conta com nome, e-mail e senha válidos. O acesso a uma
instituição depende de convite; quem tem conta sem vínculo vê o estado de espera.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Em desenvolvimento | Atual |

### RF0003 – Autenticar usuário

O sistema deve autenticar web por cookie seguro e mobile por credencial Bearer armazenada com proteção nativa.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Implementado | Atual |

### RF0004 – Resolver contexto de acesso

Após autenticar, o sistema deve identificar usuário, instituições disponíveis, tipo de
vínculo, papéis acumulados e permissões efetivas. Quando há mais de um vínculo, a pessoa
pode trocar de instituição sem sair; o cliente lembra a última escolha.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Em desenvolvimento | Atual |

### RF0005 – Encerrar sessão

O usuário deve poder revogar a sessão corrente e remover a credencial do cliente.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Implementado | Atual |

### RF0006 – Direcionar por perfil

A interface deve encaminhar aluno, profissional, monitor e administrador geral ao ambiente correspondente. Profissional e monitor usam o mesmo ambiente profissional, com destinos definidos pelas permissões atuais do vínculo; o endereço antigo do monitor leva a esse ambiente, e endereços digitados diretamente continuam protegidos. Quem perde o vínculo volta à escolha de instituição, a outro vínculo ou à espera por convite, sem dados da instituição anterior no dispositivo.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Em desenvolvimento | Atual |

### RF0007 – Gerenciar papéis e permissões

A instituição deve controlar papéis, permissões e alcances de acesso sem permitir
escalonamento indevido. Cada vínculo tem um tipo (aluno, profissional ou monitor), pode
receber vários papéis compatíveis e soma suas concessões. Os cinco papéis iniciais são
Gestão da equipe, atendimento a vinculados, atendimento institucional, monitoramento e
aluno. Na seção Gestão, na web e no mobile, quem pode consultar a equipe lista e busca
profissionais e monitores, convida, reenvia e revoga convites, substitui o conjunto de
papéis de um membro, remove vínculos com confirmação e cria papéis personalizados a
partir de um modelo do sistema, escolhendo agrupamentos de permissões com nome e
alcance. Ninguém concede o que não possui, modelos do sistema não mudam, a instituição
não fica sem gestão completa da equipe e a mudança de um papel mostra antes o impacto
sobre membros e convites. No mobile, a Gestão abre como uma lista de seções, cada uma
em tela própria, e a confirmação de uma alteração bem-sucedida aparece como aviso
passageiro, também anunciado ao leitor de tela; erros permanecem junto da ação que
falhou. A trilha completa de auditoria dessas mudanças ainda está prevista.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Em desenvolvimento | Atual |

### RF0008 – Vincular acompanhamento

O sistema deve relacionar profissionais ou monitores aos estudantes que acompanham.
Quem gerencia acompanhamentos define, por estudante, as pessoas da equipe que o
acompanham; só vínculos ativos de profissional ou monitor são aceitos, e remover alguém
da instituição encerra os acompanhamentos dessa pessoa. A interface dessa definição
ainda está prevista.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Em desenvolvimento | Atual |

### RF0009 – Manter ficha do estudante

Profissionais autorizados devem registrar dados, observações e histórico do estudante.
O cadastro civil e o termo institucional assinado, com PDF ou imagem de até 2 MB,
estão em desenvolvimento na web e no mobile.
A ficha reúne turma, condições acompanhadas e necessidades de apoio; data de nascimento,
nome social e responsáveis vêm do cadastro do estudante e aparecem na ficha para
consulta. Cada gravação preserva a versão anterior, e observações não podem ser editadas
nem apagadas. Na web e no aplicativo mobile, o profissional abre a ficha a partir da
lista dos estudantes que acompanha, com busca por nome, e registra as consultas
realizadas, com data, duração e anotação, que também não podem ser alteradas. A
monitoria vê os estudantes que acompanha sem abrir a ficha, e estudante arquivado mantém
a ficha apenas para consulta.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Em desenvolvimento | Atual |

### RF0010 – Organizar rotina e tarefas

O aluno deve montar a grade semanal, receber tarefas e acompanhar entregas e avaliações.
A grade semanal já existe: a equipe que acompanha o aluno monta, na ficha, os blocos de
cada dia (horário, título, tipo e observação), e o aluno e o responsável veem a semana
na aba Rotina, com o dia de hoje em destaque. Tarefas, entregas, avaliações e o uso sem
conexão ainda estão previstos.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Em desenvolvimento | Atual |

### RF0011 – Agendar atendimentos

Profissionais devem agendar consultas e o aluno deve visualizá-las em sua agenda.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Previsto | Futura |

### RF0012 – Registrar métricas

Usuários autorizados devem definir métricas e registrar valores por estudante ou grupo.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Média | Alta | Previsto | Futura |

### RF0013 – Emitir relatórios

Profissionais devem gerar relatórios consolidados para apoiar o acompanhamento pedagógico.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Previsto | Futura |

### RF0014 – Provisionar instituições

O administrador geral deve criar e manter instituições sem acesso implícito aos dados
sensíveis delas. Na web, informa CPF ou CNPJ válido e contato, vê membros e papéis,
convida pessoas, revoga convites e entrega um link que aparece uma vez. A pessoa aceita
na web com conta nova ou existente; o convite expira em sete dias. Pela web, o
administrador geral também configura equipe, convites e papéis da instituição com as
mesmas regras, sem ganhar vínculo nem acesso a dados de alunos.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Média | Alta | Em desenvolvimento | Atual |

### RF0015 – Recuperar senha

A pessoa deve poder solicitar a redefinição da própria senha a partir da tela de entrada.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Previsto | Futura |

## Requisitos Não-Funcionais (RNFs)

### RNF0001 – Acessibilidade

As interfaces devem atender WCAG 2.2 AA e regras cognitivas adequadas ao público.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Em aplicação | Atual |

### RNF0002 – Privacidade

Dados pessoais e sensíveis devem ser tratados conforme a LGPD e o princípio do menor acesso.
O responsável confirma e revoga, pela web e pelo aplicativo, o consentimento que a
instituição registrou para o estudante; o texto do termo exibido é um resumo provisório,
pendente de revisão jurídica.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Em aplicação | Atual |

### RNF0003 – Isolamento institucional

Uma instituição não pode ler ou alterar dados pertencentes a outra instituição.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Implementado | Atual |

### RNF0004 – Segurança de sessão

Credenciais devem ser opacas, armazenadas somente como hash no servidor e revogáveis.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Implementado | Atual |

### RNF0005 – Autorização restritiva

Toda rota nasce protegida e todo acesso deve passar pelo catálogo fechado de permissões.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Implementado | Atual |

### RNF0006 – Rastreabilidade

Requisições e erros devem carregar identificador de correlação sem expor cookies ou autorizações em logs.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Implementado | Atual |

### RNF0007 – Portabilidade

As funções devem estar disponíveis em navegador e aplicativo mobile, preservando o mesmo contrato de dados.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Implementado | Atual |

### RNF0008 – Integridade contratual

API e clientes devem compartilhar schemas tipados e validar entradas e saídas.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Implementado | Atual |

### RNF0009 – Qualidade automatizada

Lint, tipos, testes, contraste e fronteiras arquiteturais devem ser verificados continuamente.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Implementado | Atual |

### RNF0010 – Operação offline

Rotina e tarefas do aluno devem continuar utilizáveis sem conexão, com sincronização posterior.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Média | Alta | Previsto | Futura |

### RNF0011 – Auditoria sensível

Escritas e leituras sensíveis devem produzir trilha de auditoria vinculada ao ator e à instituição.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Previsto | Futura |

## Diagrama(s) de Casos de Uso

O diagrama apresenta as interações centrais previstas para cada perfil. As funções ainda não disponíveis permanecem documentadas como escopo funcional do produto.

_[Diagrama de casos de uso disponível no DOCX oficial.]_

## Modelo do Banco de Dados

O modelo abaixo representa as entidades atualmente implementadas. Usuários e sessões são
globais; vínculos, papéis, permissões, convites, estudantes, responsáveis e atribuições
preservam o contexto institucional. Cada vínculo possui um tipo e recebe papéis por
`membership_roles`; os papéis de sistema possuem `template_key`. Convites guardam
somente o hash do token e seus papéis ficam em `invitation_roles`. Vínculos removidos
recebem data e autor da remoção, sem apagar a conta nem a autoria de registros, e
vínculos e papéis têm versão para recusar edição feita sobre dados desatualizados. O
estudante pode ser cadastrado sem conta própria; seus responsáveis ficam em
`student_guardians`, os consentimentos em `student_consents` e cada acompanhamento
liga um vínculo ativo de profissional ou monitor ao estudante. A ficha do estudante
fica em `student_profile_revisions`, uma revisão por gravação, as observações em
`student_observations` e as consultas realizadas em `student_consultations`; as três
tabelas aceitam somente leitura e inserção, com autoria igual à pessoa autenticada. A
grade semanal do aluno fica em `routine_blocks`, com versão para recusar edição feita
sobre dados desatualizados. As tabelas de responsáveis, consentimentos, ficha e rotina
ainda não aparecem no diagrama. O
banco aplica isolamento por linha para impedir acesso entre instituições.

_[Modelo atual do banco de dados disponível no DOCX oficial.]_

Entidades previstas para evolução do produto incluem tarefas, agenda de consultas, métricas, grupos e relatórios. Elas ainda não fazem parte do modelo físico apresentado.

## Tecnologias utilizadas

| Área | Tecnologias |
| --- | --- |
| Linguagem e execução | TypeScript 6, Node.js 22 e pnpm |
| Monorepo e automação | Turborepo, ESLint e Conventional Commits |
| API | NestJS 12, Express, oRPC e Zod 4 |
| Persistência | PostgreSQL 18 e Drizzle ORM |
| Aplicação web | React, Vite, Tailwind CSS e TanStack Router |
| Aplicação mobile | Expo, React Native e Expo Router |
| Cliente compartilhado | TanStack Query e cliente oRPC tipado |
| Segurança | Argon2, sessões opacas, RLS e permissões tipadas |
| Observabilidade | Pino, logs estruturados e identificador de correlação |
| Testes | Vitest, Jest, Testing Library, axe-core e Testcontainers |
| Infraestrutura local | Docker Compose com PostgreSQL |

## Arquitetura do Software

O Habituar utiliza um monorepo com aplicações web, mobile e API, além de pacotes compartilhados. Web e mobile compartilham contratos, estados de dados e tokens visuais, mas mantêm interfaces próprias para respeitar as características de cada plataforma.

| Camada | Responsabilidade e comunicação |
| --- | --- |
| Aplicações web e mobile | Interfaces próprias que consomem o mesmo cliente tipado. |
| Cliente React compartilhado | Transporte, cache, estados e ações sem compartilhar interface. |
| Contratos e domínio | Schemas, tipos, falhas, permissões e contratos da API. |
| API NestJS | Autenticação, autorização, validação e coordenação das operações. |
| PostgreSQL | Persistência e isolamento reforçado entre instituições. |
| Fluxo principal | Web/Mobile → Cliente compartilhado → Contratos → API → Banco de dados. |

A API valida entradas e saídas a partir de contratos compartilhados, nega acesso por padrão e executa operações de banco dentro do contexto de instituição, ator e sessão. O PostgreSQL reforça o isolamento institucional independentemente dos filtros da aplicação.

## Backlog do produto

### Backlog consolidado

| Funcionalidade | Prioridade | Situação | Descrição |
| --- | --- | --- | --- |
| Autenticação e sessões | Alta | Implementado | Cadastro, login web/mobile, contexto e logout |
| Papéis, permissões e vínculos | Alta | Em desenvolvimento | Papéis somados, catálogo fechado, isolamento institucional e gestão da equipe |
| Instituições e convites | Média | Em desenvolvimento | Cadastro, convite de uso único e aceite na web |
| Interfaces de autenticação | Alta | Implementado | Entrada, cadastro e ambientes por perfil na web e no mobile |
| Fichas e observações | Alta | Em desenvolvimento | Dados de apoio, histórico e consultas realizadas; auditoria prevista |
| Rotina, tarefas e foco | Alta | Em desenvolvimento | Grade semanal pronta; tarefas, foco e offline previstos |
| Agenda e atendimentos | Alta | Previsto | Consultas, anotações e notificações |
| Métricas e grupos | Média | Previsto | Indicadores configuráveis por instituição |
| Relatórios | Alta | Previsto | Consolidação e exportação de acompanhamento |
| Conformidade e retenção | Alta | Previsto | Consentimento, auditoria e descarte controlado |

## Sprint 1

## Sprint 2

## Sprint 3

## Sprint final

## Registros
