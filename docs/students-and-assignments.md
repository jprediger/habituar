# Estudantes e acompanhamentos

O estudante tem um cadastro em uma instituição, mesmo antes de possuir uma conta. Um
**acompanhamento** (`assignment`) liga esse cadastro ao vínculo institucional ativo de
um profissional ou monitor. Essa relação determina quais estudantes entram no alcance
`assigned` de [papéis e permissões](roles-and-permissions.md).

Fontes da verdade no código:

- Modelo e restrições: `apps/api/db/migrations/0007_students_and_assignments.sql`
- Dados e contratos: `packages/core/src/students.ts` e `packages/core/src/students/contract.ts`
- Regras de cadastro e acompanhamento: `apps/api/src/students/students.service.ts`
- Consultas por alcance: `apps/api/src/students/students.repository.ts`
- Autorizações: `packages/core/src/permissions/permission-catalog.ts` e `apps/api/src/rbac/rbac.service.ts`

Requisitos relacionados: RF0008 e RF0009 em `DOCUMENTACAO.md`. O vínculo de
acompanhamento está implementado no servidor; ficha, observações e histórico clínico
continuam previstos.

## Conceitos e relações

- **Cadastro do estudante** (`students`): pertence a uma instituição e guarda dados
  cadastrais, como nome, data de nascimento e situação de arquivamento. Pode existir sem
  `user_id`; criar uma conta ou enviar convite é uma etapa separada.
- **Vínculo institucional** (`memberships`): relaciona uma pessoa a uma instituição e
  define seu ambiente. Só vínculos ativos de profissional ou monitor podem acompanhar
  estudantes.
- **Acompanhamento** (`assignments`): relaciona um estudante a um vínculo elegível da
  mesma instituição. Um estudante pode ter vários acompanhantes, e um vínculo pode
  acompanhar vários estudantes. A relação não concede permissões por si só: ela delimita
  o conjunto de estudantes acessível a quem já possui uma concessão com alcance `assigned`.
- **Termo institucional** (`student_consents`): quando a instituição registra o termo assinado,
  o PDF ou a imagem (até 2 MB) fica associado ao evento de consentimento. O nome do
  arquivo e a consulta do anexo só ficam disponíveis a quem pode gerenciar responsáveis
  do estudante.
- **Responsável** (`guardians` e `student_guardians`): tem uma relação familiar com o
  estudante, diferente de um acompanhamento profissional. Pode ter cadastro sem conta.
  Quando possui conta vinculada, pode consultar o estudante pelo alcance `own`.

## Regras

- `student.create@institution` permite cadastrar. A consulta usa `student.read` com o
  alcance concedido ao ator; a atualização exige `student.update` sobre o estudante
  específico. A lista é filtrada pela relação permitida na consulta, dentro da instituição.
- `assignment.manage@institution` permite **substituir o conjunto inteiro** de
  acompanhantes de um estudante. A operação aceita apenas vínculos ativos de
  profissionais ou monitores da mesma instituição, sem duplicatas, e recusa estudante
  arquivado. Uma lista vazia encerra todos os acompanhamentos.
- Arquivar um estudante encerra seus acompanhamentos na mesma transação. Reabrir o
  cadastro preserva os dados, mas não restaura automaticamente os acompanhantes.
  Remover um vínculo institucional também encerra seus acompanhamentos.
- Estudantes arquivados não aparecem na lista padrão. O detalhe de um arquivado exige
  alcance `institution`; o acesso por `own` ou `assigned` não o revela.
- Consultar o cadastro não libera automaticamente o contato dos responsáveis. No detalhe,
  e-mail e telefone só são revelados a quem possui `guardian.link` para o estudante.
  Dados clínicos ainda não fazem parte deste cadastro.

## Cenários

| Situação | Resultado |
|---|---|
| Uma monitora com `student.read@assigned` é atribuída a Ana. | Pode consultar o cadastro de Ana; o acompanhamento não autoriza atualizar seus dados. |
| A monitora perde seu vínculo institucional. | Seus acompanhamentos são encerrados e deixam de sustentar o acesso `assigned`. |
| Um profissional substitui os acompanhantes de Ana por uma lista vazia. | Ana continua cadastrada, sem acompanhante; os antigos deixam de ter acesso por essa relação. |
| Ana é arquivada e depois reaberta. | O cadastro e o histórico permanecem; os acompanhamentos precisam ser definidos novamente. |

## Limites deste documento

Convites para criar acesso, vínculos de responsáveis e consentimentos têm fluxos próprios.
Eles se relacionam ao cadastro do estudante, mas não são acompanhamentos. As ações
disponíveis e seus alcances estão em [Papéis e permissões](roles-and-permissions.md).
