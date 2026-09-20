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

A pessoa deve poder criar uma conta com nome, e-mail e senha válidos.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Implementado | Atual |

### RF0003 – Autenticar usuário

O sistema deve autenticar web por cookie seguro e mobile por credencial Bearer armazenada com proteção nativa.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Implementado | Atual |

### RF0004 – Resolver contexto de acesso

Após autenticar, o sistema deve identificar usuário, instituições disponíveis, papel e ambiente de destino.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Implementado | Atual |

### RF0005 – Encerrar sessão

O usuário deve poder revogar a sessão corrente e remover a credencial do cliente.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Implementado | Atual |

### RF0006 – Direcionar por perfil

A interface deve encaminhar aluno, profissional, monitor e administrador geral ao ambiente correspondente, mantendo profissional e monitor na mesma tela institucional.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Implementado | Atual |

### RF0007 – Gerenciar papéis e permissões

A instituição deve controlar papéis, permissões e alcances de acesso sem permitir escalonamento indevido.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Implementado no servidor | Atual |

### RF0008 – Vincular acompanhamento

O sistema deve relacionar profissionais ou monitores aos estudantes que acompanham.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Implementado no servidor | Atual |

### RF0009 – Manter ficha do estudante

Profissionais autorizados devem registrar dados, observações e histórico do estudante.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Previsto | Futura |

### RF0010 – Organizar rotina e tarefas

O aluno deve montar a grade semanal, receber tarefas e acompanhar entregas e avaliações.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Previsto | Futura |

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

O administrador geral deve criar e manter instituições sem acesso implícito aos dados sensíveis delas.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Média | Alta | Parcial | Atual |

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

O modelo abaixo representa as entidades atualmente implementadas. Usuários e sessões são globais; vínculos, papéis, permissões, estudantes, responsáveis e atribuições preservam o contexto institucional. O banco aplica isolamento por linha para impedir acesso entre instituições.

_[Modelo atual do banco de dados disponível no DOCX oficial.]_

Entidades previstas para evolução do produto incluem fichas, observações, rotina, tarefas, consultas, métricas, grupos e relatórios. Elas ainda não fazem parte do modelo físico apresentado.

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
| Papéis, permissões e vínculos | Alta | Implementado no servidor | Catálogo fechado e isolamento institucional |
| Interfaces de autenticação | Alta | Implementado | Entrada, cadastro e ambientes por perfil na web e no mobile |
| Fichas e observações | Alta | Previsto | Dados sensíveis, histórico e auditoria |
| Rotina, tarefas e foco | Alta | Previsto | Organização semanal e funcionamento offline |
| Agenda e atendimentos | Alta | Previsto | Consultas, anotações e notificações |
| Métricas e grupos | Média | Previsto | Indicadores configuráveis por instituição |
| Relatórios | Alta | Previsto | Consolidação e exportação de acompanhamento |
| Conformidade e retenção | Alta | Previsto | Consentimento, auditoria e descarte controlado |

## Sprint 1

## Sprint 2

## Sprint 3

## Sprint final

## Registros
