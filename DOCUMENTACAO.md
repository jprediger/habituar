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
| Alta | Média | Implementado | Atual |

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
| Alta | Alta | Implementado | Atual |

### RF0005 – Encerrar sessão

O usuário deve poder revogar a sessão corrente e remover a credencial do cliente.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Implementado | Atual |

### RF0006 – Direcionar por perfil

A interface deve encaminhar aluno, profissional, monitor e administrador geral ao ambiente correspondente. Profissional e monitor usam o mesmo ambiente profissional, com destinos definidos pelas permissões atuais do vínculo; o endereço antigo do monitor leva a esse ambiente, e endereços digitados diretamente continuam protegidos. Quem perde o vínculo volta à escolha de instituição, a outro vínculo ou à espera por convite, sem dados da instituição anterior no dispositivo.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Implementado | Atual |

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
| Alta | Alta | Implementado | Atual |

### RF0008 – Vincular acompanhamento

O sistema deve relacionar profissionais ou monitores aos estudantes que acompanham.
Quem gerencia acompanhamentos define, por estudante, as pessoas da equipe que o
acompanham; só vínculos ativos de profissional ou monitor são aceitos, e remover alguém
da instituição encerra os acompanhamentos dessa pessoa. Na web e no mobile, essa
definição fica no detalhe do estudante, dentro da seção Gestão.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Média | Implementado | Atual |

### RF0009 – Manter ficha do estudante

Profissionais autorizados devem registrar dados, observações e histórico do estudante.
Na seção Gestão, na web e no mobile, quem gerencia estudantes cadastra e edita os dados
civis e os responsáveis, anexa o termo institucional assinado, em PDF ou imagem de até
2 MB, e arquiva o estudante.
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
| Alta | Alta | Implementado | Atual |

### RF0010 – Organizar rotina e tarefas

O aluno deve montar a grade semanal, receber tarefas e acompanhar entregas e avaliações.
A grade semanal já existe: a equipe que acompanha o aluno monta os blocos de cada dia
(horário, título, tipo e observação), e o aluno e o responsável veem esses blocos como as
tarefas de cada dia na aba Agenda. O aluno registra em cada tarefa do
dia uma observação e até seis fotos, que o responsável e a equipe consultam sem poder
alterar. O aluno marca a tarefa do dia como entregue, levando junto a observação e as
fotos, e pode desfazer a entrega enquanto ela não for avaliada. A equipe que acompanha
avalia a tarefa entregue com um conceito (alcançado, parcial ou não alcançado) e um
comentário opcional, que o aluno e o responsável leem. Na ficha do aluno, a equipe abre
em telas próprias a organização da rotina e o acompanhamento das tarefas. No
acompanhamento, período a período, cada tarefa aparece como avaliada, entregue, não
entregue ou por vir, com um resumo de quantas foram entregues e avaliadas, e abrir a
tarefa mostra a orientação da equipe, o registro do aluno e a avaliação.
No app, o aluno recebe lembretes dos blocos da rotina com uma ou mais antecedências
escolhidas nas configurações, em minutos, horas ou dias. A observação e a
entrega também funcionam sem conexão no app e são enviadas quando ela volta. O modo
foco ainda está previsto.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Em desenvolvimento | Atual |

### RF0011 – Agendar atendimentos

Profissionais devem agendar consultas e o aluno deve visualizá-las em sua agenda.
O profissional agenda, edita e cancela atendimentos, com repetição
semanal opcional e cancelamento de uma única ocorrência da série, e consulta a agenda por
dia, semana ou mês na web e por mês, dia ou programação no mobile, com as mesmas visões
da agenda do aluno e botão flutuante para criar atendimentos; o aluno e o responsável veem os atendimentos na mesma agenda das
tarefas. Registrar o atendimento como realizado ainda está previsto.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Em desenvolvimento | Atual |

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
| Média | Alta | Implementado | Atual |

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

Rotina e tarefas do aluno devem continuar utilizáveis sem conexão, com sincronização posterior. No app mobile, a agenda e as tarefas do aluno ficam salvas no aparelho e o app abre sem conexão com a última sessão. A observação e a entrega feitas sem conexão ficam numa fila no aparelho e são enviadas quando a conexão volta; um aviso mostra que o app está sem conexão e quantas alterações esperam envio. As fotos continuam exigindo conexão. Se a tarefa mudou em outro aparelho, vale a última alteração; se a regra não permite mais a alteração, como desfazer a entrega já avaliada, ela é descartada e o aluno é avisado. A cópia no aparelho é apagada quando a pessoa sai da conta. No web, o uso continua exigindo conexão.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Média | Alta | Implementado | Atual |

### RNF0011 – Auditoria sensível

Escritas e leituras sensíveis devem produzir trilha de auditoria vinculada ao ator e à instituição.

| Prioridade | Complexidade | Situação | Versão |
| --- | --- | --- | --- |
| Alta | Alta | Previsto | Futura |

## Diagrama(s) de Casos de Uso

Os diagramas desta seção seguem a notação da UML 2.5. Os atores aparecem fora da
fronteira do sistema, cada caso de uso recebe um identificador (UC) rastreável aos
requisitos funcionais, as dependências «include» indicam comportamento sempre executado
pelo caso de uso base e as dependências «extend» indicam comportamento opcional ou
condicional. Casos de uso marcados com «previsto» descrevem escopo funcional ainda não
implementado. Para manter a legibilidade, o modelo foi dividido em três diagramas por
área do produto, precedidos da hierarquia de atores.

### Atores

Os atores representam papéis desempenhados em relação ao sistema, não pessoas. A
generalização indica que o ator especializado herda todos os casos de uso do ator geral:
o Gestor da instituição é um Profissional que recebeu o papel Gestão da equipe, e
Profissional e Monitor compartilham os casos de uso do Membro da equipe.

_[Figura 1 – Hierarquia de atores do Habituar, disponível no DOCX oficial.]_

| Ator | Descrição |
| --- | --- |
| Visitante | Pessoa sem sessão ativa. Consulta o estado do serviço, cria conta, entra no sistema ou aceita um convite. |
| Usuário autenticado | Ator abstrato que generaliza todos os perfis com sessão ativa. Encerra a sessão e troca de instituição. |
| Aluno | Estudante com vínculo do tipo aluno. Consulta a agenda, registra observação e fotos e entrega as tarefas do dia. |
| Responsável | Familiar ou tutor vinculado ao estudante. Consulta a agenda do aluno e confirma ou revoga o consentimento. |
| Membro da equipe | Ator abstrato que generaliza Profissional e Monitor. Lista os estudantes acompanhados, monta a rotina e avalia tarefas. |
| Profissional | Mantém a ficha do estudante, registra observações e consultas e agenda atendimentos. |
| Monitor | Acompanha estudantes no ambiente profissional, sem acesso à ficha; os destinos dependem das permissões do vínculo. |
| Gestor da instituição | Profissional com o papel Gestão da equipe. Gerencia equipe, convites, papéis, estudantes e acompanhamentos. |
| Administrador geral | Provisiona instituições e configura equipe e papéis, sem vínculo nem acesso implícito a dados de alunos. |

### Acesso e conta

Autenticar sempre inclui a resolução do contexto de acesso (instituições, tipo de
vínculo, papéis e permissões efetivas), o mesmo comportamento executado ao trocar de
instituição. A recuperação de senha estende a autenticação e ainda está prevista.

_[Figura 2 – Diagrama de casos de uso – Acesso e conta, disponível no DOCX oficial.]_

### Gestão institucional

O provisionamento de instituição inclui a gestão de equipe e convites, pois a instituição
recém-criada só ganha membros por convite. A alteração de papéis inclui a pré-visualização
do impacto sobre membros e convites, exigida pelo RF0007.

_[Figura 3 – Diagrama de casos de uso – Gestão institucional, disponível no DOCX oficial.]_

### Acompanhamento, rotina e agenda

A avaliação da tarefa entregue estende o acompanhamento por período, que é onde a equipe
abre a tarefa. O registro de observação ou consulta estende a manutenção da ficha do
estudante, a partir da qual é acionado.

_[Figura 4 – Diagrama de casos de uso – Acompanhamento, rotina e agenda, disponível no DOCX oficial.]_

### Matriz de rastreabilidade

A matriz relaciona cada caso de uso aos requisitos funcionais da seção 2 e à situação
atual de implementação.

| ID | Caso de uso | Ator principal | Requisitos | Situação |
| --- | --- | --- | --- | --- |
| UC01 | Consultar estado do serviço | Visitante | RF0001 | Implementado |
| UC02 | Cadastrar conta | Visitante | RF0002 | Implementado |
| UC03 | Autenticar | Visitante | RF0003 | Implementado |
| UC04 | Resolver contexto de acesso | (incluído) | RF0004, RF0006 | Implementado |
| UC05 | Encerrar sessão | Usuário autenticado | RF0005 | Implementado |
| UC06 | Trocar de instituição | Usuário autenticado | RF0004 | Implementado |
| UC07 | Recuperar senha | Visitante | RF0015 | Previsto |
| UC08 | Aceitar convite | Visitante | RF0002, RF0014 | Implementado |
| UC09 | Gerenciar equipe e convites | Gestor, Administrador geral | RF0007, RF0014 | Implementado |
| UC10 | Gerenciar papéis e permissões | Gestor, Administrador geral | RF0007 | Implementado |
| UC11 | Cadastrar e arquivar estudante | Gestor | RF0009 | Implementado |
| UC12 | Definir equipe que acompanha o estudante | Gestor | RF0008 | Implementado |
| UC13 | Manter ficha do estudante | Profissional | RF0009 | Implementado |
| UC14 | Registrar observação ou consulta | Profissional | RF0009 | Implementado |
| UC15 | Montar grade semanal | Membro da equipe | RF0010 | Implementado |
| UC16 | Avaliar tarefa entregue | Membro da equipe | RF0010 | Implementado |
| UC17 | Agendar, editar ou cancelar atendimento | Profissional | RF0011 | Implementado |
| UC18 | Listar estudantes acompanhados | Membro da equipe | RF0008, RF0009 | Implementado |
| UC19 | Consultar agenda | Aluno, Responsável | RF0010, RF0011 | Implementado |
| UC20 | Registrar observação e fotos da tarefa | Aluno | RF0010 | Implementado |
| UC21 | Entregar ou desfazer entrega da tarefa | Aluno | RF0010 | Implementado |
| UC22 | Confirmar ou revogar consentimento | Responsável | RF0009 | Implementado |
| UC23 | Provisionar instituição | Administrador geral | RF0014 | Implementado |
| UC24 | Registrar métricas | Profissional | RF0012 | Previsto |
| UC25 | Emitir relatórios | Profissional | RF0013 | Previsto |
| UC26 | Acompanhar tarefas por período | Membro da equipe | RF0010 | Implementado |

### Especificação dos principais casos de uso

As especificações abaixo detalham os casos de uso de maior risco ou complexidade, no
formato de fluxo principal, fluxos alternativos e regras de negócio.

#### UC03 – Autenticar

| Campo | Conteúdo |
| --- | --- |
| Ator principal | Visitante |
| Requisitos | RF0003, RF0004, RF0006, RNF0004, RNF0005 |
| Pré-condições | A pessoa possui conta cadastrada. |
| Fluxo principal | 1. O visitante informa e-mail e senha na web ou no app.<br>2. O sistema valida o formato dos dados.<br>3. O sistema confere a senha com o hash Argon2 armazenado.<br>4. O sistema cria uma sessão opaca e guarda apenas o hash do token.<br>5. Na web, o token é entregue em cookie seguro; no mobile, como credencial Bearer guardada no SecureStore.<br>6. O sistema executa UC04: resolve instituições, vínculo, papéis e permissões efetivas.<br>7. O sistema direciona a pessoa ao ambiente correspondente ao perfil. |
| Fluxos alternativos | 3a. Credenciais inválidas: o sistema responde com a falha unauthenticated, sem revelar se o e-mail existe, e mostra a mensagem junto do campo.<br>6a. Mais de um vínculo: o sistema abre a última instituição escolhida ou pede a escolha.<br>6b. Nenhum vínculo ativo: o sistema exibe o estado de espera por convite. |
| Pós-condições | Sessão ativa associada ao usuário e contexto institucional carregado no cliente. |
| Regras de negócio | Sessões têm validade renovada a cada uso; o token em texto claro nunca é persistido; toda rota não pública exige sessão válida. |

#### UC08 – Aceitar convite

| Campo | Conteúdo |
| --- | --- |
| Ator principal | Visitante (pessoa convidada) |
| Requisitos | RF0002, RF0007, RF0014 |
| Pré-condições | Um gestor ou o administrador geral emitiu um convite e entregou o link de uso único. |
| Fluxo principal | 1. A pessoa abre o link na web.<br>2. O sistema localiza o convite pelo hash do token e mostra instituição e tipo de vínculo.<br>3. A pessoa entra com a conta existente ou cadastra nome e senha.<br>4. O sistema revalida a autoridade de quem emitiu o convite.<br>5. O sistema cria ou reativa o vínculo com os papéis do convite e marca o convite como aceito.<br>6. O sistema direciona a pessoa ao ambiente do perfil. |
| Fluxos alternativos | 2a. Convite expirado, revogado ou já aceito: o sistema informa a situação e encerra o caso de uso.<br>4a. O emissor perdeu a autoridade sobre os papéis: o sistema recusa com invitation-authority-lost. |
| Pós-condições | Vínculo ativo na instituição; convite em estado terminal (aceito). |
| Regras de negócio | O convite vale por sete dias e é de uso único; somente o hash do token é guardado; ninguém concede papéis com permissões que não possui. |

#### UC21 – Entregar ou desfazer entrega da tarefa

| Campo | Conteúdo |
| --- | --- |
| Ator principal | Aluno |
| Requisitos | RF0010, RNF0010 |
| Pré-condições | Aluno autenticado; a grade semanal possui um bloco no dia da tarefa; o estudante não está arquivado. |
| Fluxo principal | 1. O aluno abre a tarefa do dia na Agenda.<br>2. Opcionalmente registra uma observação e até seis fotos (UC20).<br>3. O aluno marca a tarefa como entregue.<br>4. O sistema grava a data e o autor da entrega, conferindo a versão do registro.<br>5. A tarefa passa a aparecer como entregue para o responsável e a equipe. |
| Fluxos alternativos | 4a. Sem conexão (app mobile): a mudança fica na fila do aparelho e é reenviada a cada 30 segundos até a conexão voltar.<br>4b. Versão desatualizada: o sistema responde conflict, recarrega o registro e avisa o aluno.<br>5a. Desfazer entrega: permitido somente enquanto não houver avaliação; caso contrário, o sistema recusa com entry-already-evaluated. |
| Pós-condições | Registro da tarefa com entregueEm preenchido (ou nulo, quando desfeito). |
| Regras de negócio | Um registro por bloco e data; fotos JPEG, PNG ou WebP de até 2 MB, guardadas fora do banco; responsável e equipe apenas consultam. |

#### UC16 – Avaliar tarefa entregue

| Campo | Conteúdo |
| --- | --- |
| Ator principal | Membro da equipe que acompanha o aluno |
| Requisitos | RF0010 |
| Pré-condições | A tarefa do dia foi entregue pelo aluno; o membro da equipe acompanha o estudante. |
| Fluxo principal | 1. O membro da equipe abre o acompanhamento de tarefas do aluno e escolhe o período.<br>2. O sistema lista as tarefas como avaliada, entregue, não entregue ou por vir, com o resumo do período.<br>3. O membro da equipe abre a tarefa entregue e vê orientação, registro do aluno e fotos.<br>4. Informa o conceito (alcançado, parcial ou não alcançado) e um comentário opcional.<br>5. O sistema grava a avaliação, que passa a ser lida pelo aluno e pelo responsável. |
| Fluxos alternativos | 4a. Tarefa não entregue: o sistema recusa com entry-not-delivered.<br>5a. Outra pessoa alterou a avaliação: o sistema responde conflict e recarrega os dados. |
| Pós-condições | Avaliação registrada com versão própria; a entrega deixa de poder ser desfeita. |
| Regras de negócio | A avaliação tem versão independente do registro do aluno, para que novas anotações não a invalidem. |

## Modelo do Banco de Dados

O modelo abaixo representa as entidades atualmente implementadas. Usuários e sessões são
globais; vínculos, papéis, permissões, convites, estudantes, responsáveis e atribuições
preservam o contexto institucional. Cada vínculo possui um tipo e recebe papéis por
`membership_roles`; os papéis de sistema possuem `template_key`. Convites guardam
somente o hash do token e seus papéis ficam em `invitation_roles`. Vínculos removidos
recebem data e autor da remoção, sem apagar a conta nem a autoria de registros, e
vínculos e papéis têm versão para recusar edição feita sobre dados desatualizados. O
estudante pode ser cadastrado sem conta própria; seus responsáveis ficam em
`student_guardians`, os consentimentos, com o termo assinado, em `student_consents` e cada acompanhamento
liga um vínculo ativo de profissional ou monitor ao estudante. A ficha do estudante
fica em `student_profile_revisions`, uma revisão por gravação, as observações em
`student_observations` e as consultas realizadas em `student_consultations`; as três
tabelas aceitam somente leitura e inserção, com autoria igual à pessoa autenticada. A
grade semanal do aluno fica em `routine_blocks`, com versão para recusar edição feita
sobre dados desatualizados. Os
atendimentos ficam em `appointments`, com repetição semanal e versão, e as ocorrências
canceladas de uma série em `appointment_cancelled_occurrences`; a observação e a entrega de cada
tarefa do dia ficam em `routine_entries` e as fotos, guardadas fora do banco, têm os
metadados em `routine_entry_photos`, e a avaliação da equipe sobre a tarefa entregue fica
em `routine_entry_evaluations`, com versão própria. O banco aplica isolamento por linha para impedir acesso entre instituições.

_[Modelo atual do banco de dados disponível no DOCX oficial.]_

Entidades previstas para evolução do produto incluem métricas, grupos e relatórios. Elas ainda não fazem parte do modelo físico apresentado.

## Modelagem UML

Esta seção complementa os casos de uso com as visões estrutural e comportamental do
sistema. O diagrama de classes representa o modelo de domínio em nível conceitual (o
modelo físico está na seção Modelo do Banco de Dados); os diagramas de sequência,
atividades e máquina de estados descrevem os fluxos de maior risco; e os diagramas de
componentes e implantação descrevem a organização do código e a distribuição física da
solução.

### Diagramas de Classes

Os atributos seguem a notação visibilidade nome : Tipo [multiplicidade] {restrição}.
Losangos preenchidos indicam composição: a parte não existe sem o todo (por exemplo, a
sessão sem o usuário). Classes com o estereótipo «somente inclusão» não aceitam alteração
nem exclusão após gravadas. Classes repetidas entre diagramas trazem o estereótipo que
aponta onde estão detalhadas.

#### Identidade, instituições e controle de acesso

O usuário é global e se liga a cada instituição por um Vínculo, que tem um tipo e soma os
papéis recebidos. Cada Papel concede permissões com um alcance (próprio, atribuído ou
instituição); o conjunto dessas concessões forma as permissões efetivas do vínculo.

_[Figura 5 – Diagrama de classes – Identidade, instituições e controle de acesso, disponível no DOCX oficial.]_

#### Estudante, responsáveis e ficha

_[Figura 6 – Diagrama de classes – Estudante, responsáveis e ficha, disponível no DOCX oficial.]_

#### Rotina, tarefas e agenda

_[Figura 7 – Diagrama de classes – Rotina, tarefas e agenda, disponível no DOCX oficial.]_

### Diagramas de Sequência

Os diagramas de sequência mostram a troca de mensagens entre os objetos nos cenários
centrais. Os fragmentos combinados alt, opt e loop representam alternativas, trechos
opcionais e repetições; mensagens tracejadas são retornos.

#### Autenticação e resolução do contexto (UC03 e UC04)

_[Figura 8 – Diagrama de sequência – Autenticação e resolução do contexto de acesso, disponível no DOCX oficial.]_

#### Processamento de uma requisição autenticada

Toda rota passa pela mesma cadeia: autenticação, verificação de permissão e instalação do
contexto institucional, que o PostgreSQL usa para aplicar o isolamento por linha (RNF0003
e RNF0005).

_[Figura 9 – Diagrama de sequência – Cadeia de autorização e isolamento institucional, disponível no DOCX oficial.]_

#### Registro, entrega e avaliação da tarefa do dia (UC20, UC21 e UC16)

_[Figura 10 – Diagrama de sequência – Registro, entrega e avaliação da tarefa do dia, disponível no DOCX oficial.]_

#### Emissão e aceite de convite (UC09 e UC08)

_[Figura 11 – Diagrama de sequência – Emissão e aceite de convite, disponível no DOCX oficial.]_

### Diagramas de Atividades

Os diagramas de atividades usam raias para separar as responsabilidades de cada
participante e losangos para as decisões.

_[Figura 12 – Diagrama de atividades – Ciclo da tarefa do dia, disponível no DOCX oficial.]_

_[Figura 13 – Diagrama de atividades – Convite e aceite, disponível no DOCX oficial.]_

### Diagramas de Máquina de Estados

As máquinas de estados descrevem o ciclo de vida das entidades cujo comportamento depende
do estado atual. As transições indicam evento [condição] / ação.

_[Figura 14 – Máquina de estados – Tarefa do dia (RegistroDaTarefa), disponível no DOCX oficial.]_

_[Figura 15 – Máquina de estados – Convite, disponível no DOCX oficial.]_

_[Figura 16 – Máquina de estados – Vínculo institucional, disponível no DOCX oficial.]_

### Diagrama de Componentes

O monorepo é organizado em aplicações (web, mobile e API) e pacotes compartilhados. Web e
mobile consomem a API apenas pela interface oRPC versionada, por meio do cliente React
compartilhado; os módulos da API são agrupados por área e acessam o banco exclusivamente
pelo módulo database.

_[Figura 17 – Diagrama de componentes do Habituar, disponível no DOCX oficial.]_

### Diagrama de Implantação

O diagrama mostra os nós físicos, os ambientes de execução e os artefatos implantados em
cada um, além dos protocolos de comunicação. O banco é executado em contêiner Docker e a
API se conecta com um papel de aplicação que não é dono das tabelas, o que impede
contornar as políticas de isolamento.

_[Figura 18 – Diagrama de implantação, disponível no DOCX oficial.]_

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

A API valida entradas e saídas a partir de contratos compartilhados, nega acesso por padrão e executa operações de banco dentro do contexto de instituição, ator e sessão. O PostgreSQL reforça o isolamento institucional independentemente dos filtros da aplicação. As fotos das tarefas ficam em um armazenamento de arquivos separado do banco, hoje em disco local definido por `FILE_STORAGE_DIRECTORY`, e o banco guarda só os metadados.

## Backlog do produto

### Backlog consolidado

| Funcionalidade | Prioridade | Situação | Descrição |
| --- | --- | --- | --- |
| Autenticação e sessões | Alta | Implementado | Cadastro, login web/mobile, contexto e logout |
| Papéis, permissões e vínculos | Alta | Implementado | Papéis somados, catálogo fechado, isolamento institucional, gestão da equipe e acompanhamentos |
| Instituições e convites | Média | Implementado | Cadastro, convite de uso único e aceite na web |
| Interfaces de autenticação | Alta | Implementado | Entrada, cadastro e ambientes por perfil na web e no mobile |
| Fichas e observações | Alta | Implementado | Cadastro do estudante, termo assinado, ficha, histórico e consultas realizadas; auditoria prevista |
| Rotina, tarefas e foco | Alta | Em desenvolvimento | Grade semanal, registro, entrega, avaliação e acompanhamento das tarefas, lembretes e uso sem conexão no app prontos; foco previsto |
| Agenda e atendimentos | Alta | Em desenvolvimento | Agendamento com repetição semanal e lembretes locais de tarefas no mobile prontos; Perfil do aluno reúne conta, instituição, saída e notificações, com antecedência única de 30 minutos por padrão (10, 15, 30 ou 60 minutos), autorização explícita do aparelho e cancelamento ao concluir, remarcar, excluir ou sair; tarefas de dia inteiro não geram lembretes; perfis profissional e monitor oferecem acesso à permissão de notificações e, quando têm acesso à agenda, lembretes locais das consultas atribuídas à conta ativa, com antecedência de 30 minutos por padrão e opções de 10, 15, 30 ou 60 minutos; séries geram um aviso por ocorrência, remarcações e cancelamentos atualizam o plano ao sincronizar, sair ou trocar de instituição remove os avisos do vínculo e tocar abre o detalhe da consulta; o aluno também escolhe entre tema do sistema, claro ou escuro; registro do atendimento realizado e anotações previstos |
| Métricas e grupos | Média | Previsto | Indicadores configuráveis por instituição |
| Relatórios | Alta | Previsto | Consolidação e exportação de acompanhamento |
| Conformidade e retenção | Alta | Previsto | Consentimento, auditoria e descarte controlado |

## Sprint 1

Período: 19/08/2026 a 09/09/2026.

A primeira sprint preparou a base técnica do produto. O objetivo foi deixar o repositório pronto para receber funcionalidades com segurança: aplicações separadas, pacotes compartilhados, regras de desenvolvimento verificadas automaticamente e uma primeira função ponta a ponta, a consulta de estado do serviço, funcionando na API, na web e no mobile.

Todas as entregas previstas para a sprint foram concluídas; a tabela apresenta a data em que cada uma foi entregue.

**Entregas da Sprint 1**

| Entrega | Área | Data de entrega | Descrição |
| --- | --- | --- | --- |
| Monorepo e automação | Infraestrutura | 22/08/2026 | pnpm workspaces, Turborepo, TypeScript 6 e ESM em todos os pacotes; integração contínua executa lint, tipos, testes e build de cada workspace. |
| Regras de desenvolvimento | Infraestrutura | 26/08/2026 | Regras de arquitetura, idioma, tipos, erros e testes; lint de fronteiras entre pacotes, proibição de any, forwardRef e class-validator, nomes em kebab-case e Conventional Commits. |
| Separação das aplicações | Infraestrutura | 27/08/2026 | Aplicações api, web e mobile e pacotes core, design-tokens, react-client e config, cada um com entrypoints públicos explícitos. |
| Contrato da API | Pacote compartilhado | 28/08/2026 | Contrato versionado em /v1 declarado com Zod e oRPC, catálogo fechado de falhas, identificadores tipados e documento OpenAPI gerado. |
| Tokens visuais | Pacote compartilhado | 29/08/2026 | Escalas de cor, espaçamento e tipografia com verificação automática de contraste WCAG 2.2 AA e variáveis de tema para a web. |
| Banco de dados e isolamento | API | 01/09/2026 | PostgreSQL 18 em Docker Compose, papel de aplicação sem posse das tabelas, transação com contexto de instituição, ator e sessão e isolamento por linha provado em banco real. |
| Base da API | API | 02/09/2026 | NestJS 12 com configuração validada na inicialização, rotas negadas por padrão, identificador de correlação, logs estruturados com Pino e rota de saúde. |
| Cliente React compartilhado | Pacote compartilhado | 03/09/2026 | Cliente tipado com TanStack Query, sem interface, consumido igualmente pela web e pelo mobile. |
| Scaffolding da web | Web | 04/09/2026 | Vite, React, Tailwind CSS e TanStack Router, textos em pt-BR via i18n tipado e tela de estado do serviço com testes de acessibilidade. |
| Scaffolding do mobile | Mobile | 05/09/2026 | Expo e Expo Router, tokens, i18n tipado, tela de estado do serviço com testes de acessibilidade e perfis de build. |
| Autenticação e permissões | API e pacote compartilhado | 09/09/2026 | Cadastro e entrada pela API, cookie seguro para web e credencial Bearer para mobile, sessões opacas guardadas como hash, encerramento de sessão e catálogo fechado de permissões aplicado a toda rota. |

Resultado: RF0001 foi entregue, a autenticação e as permissões ficaram disponíveis na API para as telas da sprint seguinte, e os requisitos RNF0003, RNF0004, RNF0005, RNF0006, RNF0008 e RNF0009 passaram a ser verificados automaticamente desde a base do projeto. As regras definidas nesta sprint valem para todo o código das sprints seguintes.

## Sprint 2

Período: 16/09/2026 a 30/09/2026.

A segunda sprint transformou a base em produto utilizável pelas instituições. Foram entregues o acesso das pessoas, a estrutura de instituições, papéis e equipe e o primeiro conjunto de funções de acompanhamento dos estudantes, sempre na web e no mobile sobre o mesmo contrato.

Todas as entregas previstas para a sprint foram concluídas; a tabela apresenta a data em que cada uma foi entregue.

**Entregas da Sprint 2**

| Entrega | Área | Data de entrega | Descrição |
| --- | --- | --- | --- |
| Telas de autenticação | Web e mobile | 18/09/2026 | Telas de entrada, cadastro e saída sobre a API da sprint anterior, com mensagens de falha junto do campo e credencial guardada com proteção nativa no mobile (RF0002, RF0003 e RF0005). |
| Contexto e ambientes por perfil | Web e mobile | 22/09/2026 | Resolução de instituições, papéis e permissões após a entrada, troca de instituição, espera por convite e ambiente profissional com navegação definida pelas permissões (RF0004 e RF0006). |
| Instituições e convites | API e web | 24/09/2026 | O administrador geral cadastra instituições, consulta membros e papéis e convida pessoas por link de uso único válido por sete dias (RF0014). |
| Papéis e permissões | API e pacote compartilhado | 26/09/2026 | Cinco papéis iniciais, papéis somados por vínculo e papéis personalizados sem escalonamento indevido (RF0007). |
| Gestão da equipe | Web e mobile | 28/09/2026 | Listagem e busca de profissionais e monitores, convites, troca de papéis e remoção de vínculos com confirmação. |
| Padrão de interface mobile | Mobile | 29/09/2026 | Layout em listas, telas em pilha, avisos passageiros anunciados ao leitor de tela, ícones Phosphor e escolha de tema. |
| Estudantes e acompanhamentos | API, web e mobile | 30/09/2026 | Cadastro civil, responsáveis, termo institucional assinado, arquivamento e definição da equipe que acompanha cada estudante (RF0008). |
| Ficha do estudante | API, web e mobile | 30/09/2026 | Ficha com histórico de revisões, observações e consultas realizadas que não podem ser alteradas depois de registradas (RF0009). |
| Consentimento e rotina semanal | API, web e mobile | 30/09/2026 | O responsável confirma e revoga o consentimento registrado pela instituição; a equipe monta a grade semanal do aluno, que aluno e responsável consultam na aba Rotina (RF0010, parcial). |

Resultado: os requisitos RF0002 a RF0009 e RF0014 estão implementados, e a grade semanal do RF0010 já está disponível. Ficam para as próximas sprints as tarefas do aluno, o uso sem conexão, a agenda de atendimentos, as métricas, os relatórios, a recuperação de senha e a trilha de auditoria.

## Sprint 3

Período: 07/10/2026 a 11/11/2026.

A terceira sprint levou a rotina para o dia a dia do aluno: lembretes no celular, uma agenda que reúne tarefas e atendimentos, o registro e a entrega das tarefas e a avaliação pela equipe, além do uso do app sem conexão.

A tabela apresenta a data em que cada entrega foi concluída.

**Entregas da Sprint 3**

| Entrega | Área | Data de entrega | Descrição |
| --- | --- | --- | --- |
| Lembretes da rotina | Mobile | 07/10/2026 | O app agenda no próprio aparelho lembretes dos blocos da grade semanal, com uma ou mais antecedências escolhidas pelo aluno em minutos, horas ou dias na nova tela de configurações; sair da conta cancela os lembretes (RF0010). |
| Agenda de atendimentos | API, web e mobile | 10/11/2026 | O profissional agenda, edita e cancela atendimentos, com repetição semanal e cancelamento de uma ocorrência da série, e consulta a agenda por dia, semana ou mês; aluno e responsável veem atendimentos e tarefas na mesma aba Agenda (RF0011, parcial). |
| Registro das tarefas do dia | API, web e mobile | 10/11/2026 | O aluno registra em cada tarefa do dia uma observação e até seis fotos, guardadas fora do banco; responsável e equipe consultam sem alterar (RF0010). |
| Acompanhamento das tarefas | Web e mobile | 10/11/2026 | Na ficha do aluno, a equipe abre em telas próprias a organização da rotina e o acompanhamento das tarefas por período, com o resumo de entregues e avaliadas (RF0010). |
| Entrega e avaliação | API, web e mobile | 10/11/2026 | O aluno entrega a tarefa e pode desfazer a entrega enquanto ela não for avaliada; a equipe avalia com um conceito e um comentário opcional, que aluno e responsável leem (RF0010). |
| Uso sem conexão no app | Mobile e pacote compartilhado | 11/11/2026 | Agenda e tarefas do aluno ficam salvas no aparelho, e observação e entrega feitas sem conexão entram numa fila enviada quando a conexão volta (RNF0010). |

Resultado: o RF0010 passa a contar com o registro, a entrega, a avaliação e o acompanhamento das tarefas e com os lembretes no app, e o RF0011 com o agendamento de atendimentos. O app passa a funcionar sem conexão para o aluno (RNF0010). Ficam para as próximas sprints o modo foco, o registro do atendimento realizado, as métricas, os relatórios, a recuperação de senha e a trilha de auditoria.

## Sprint final

## Registros
