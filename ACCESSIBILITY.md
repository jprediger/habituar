# Habituar — Acessibilidade

> Requisito, não meta. Este documento é normativo: o que está aqui bloqueia merge.
> Arquitetura: `ARCHITECTURE.md` (D12) · Produto: `project-description.md` (§6)

## Por que é obrigatório

- **LBI (Lei 13.146/2015), Art. 63** torna a acessibilidade digital obrigatória para
  empresas sediadas no Brasil e para órgãos públicos. O IFSul é os dois casos ao mesmo
  tempo.
- O padrão aplicado por peritos e tribunais é **WCAG 2.2 nível AA**. Para portal de
  órgão público, também o **eMAG**.
- Existe precedente real: ações civis públicas do MPF e multas acima de R$ 1 milhão.

E há a razão que não é jurídica: o público primário do produto é composto por pessoas
com TDAH, autismo e deficiências. Uma interface inacessível aqui não é atrito — é a
falha do produto.

## Alvo

**WCAG 2.2 AA**, nas duas plataformas, verificado antes do merge.

WCAG cobre bem acessibilidade sensorial e motora, e **mal a cognitiva** — exatamente
onde está o público primário. Por isso a segunda metade deste documento existe: são
regras adicionais, não negociáveis, que a WCAG não cobre.

---

## Regras técnicas — web

- `axe-core` roda em CI. Violação de nível `serious` ou `critical` **falha o build**.
- Contraste não é conferido no olho: as razões são calculadas programaticamente sobre o
  pacote de design tokens, e o teste falha se um par cair abaixo de 4.5:1 (texto normal)
  ou 3:1 (texto grande e componentes de interface).
- HTML semântico antes de ARIA. `div` com `onClick` é erro; se é botão, é `<button>`.
- Todo fluxo é completável **só com teclado**, com foco visível o tempo todo e ordem de
  foco igual à ordem visual.
- Nenhum conteúdo depende exclusivamente de cor para transmitir informação.
- Alvo de toque mínimo de 24×24 CSS px (WCAG 2.2, 2.5.8); usamos 44×44 como padrão.
- Formulário: `label` associado sempre, erro ligado ao campo por `aria-describedby`,
  e o erro descreve **como corrigir**.

## Regras técnicas — mobile

Não existe equivalente automatizado do axe. A verificação é parcialmente manual, e isso
é assumido, não contornado.

- `accessibilityRole`, `accessibilityLabel`, `accessibilityHint` e `accessibilityState`
  em todo elemento interativo.
- `AccessibilityInfo` consultado para movimento reduzido e leitor de tela ativo.
- Suporte a fonte ampliada do sistema sem quebra de layout e sem corte de texto.
- Alvo de toque mínimo de 44×44 pt.
- **Passe manual de VoiceOver e TalkBack** a cada marco, registrado (data, versão,
  telas percorridas, achados). Passe não registrado não aconteceu.

---

## Regras cognitivas

Estas são específicas deste produto e valem em ambas as plataformas.

### Tempo e ritmo
- Sem auto-avanço, sem carrossel automático, sem conteúdo que se move sozinho.
- Sem timeout sem opção clara de estender. Se a sessão precisa expirar, avisa antes e
  preserva o que estava sendo escrito.
- Nada de contagem regressiva que pressione a conclusão de uma tarefa.

### Previsibilidade
- A mesma coisa fica no mesmo lugar, sempre. Navegação não muda entre telas.
- Foco ou digitação nunca disparam mudança de contexto sozinhos (WCAG 3.2.1/3.2.2 —
  aqui tratados como críticos, não AA).
- Nada aparece ou desaparece da tela sem uma ação do usuário.

### Erro e reversibilidade
- **Toda ação destrutiva tem desfazer.** Sem exceção.
- Nenhuma ação irreversível acontece sem confirmação explícita.
- Rascunho de formulário nunca é perdido por navegação, erro de rede ou expiração.
- Mensagem de erro descreve o caminho de saída; nunca culpa o usuário nem usa jargão.

### Carga cognitiva
- Tarefa longa é fatiada, com progresso visível e estimativa de tempo.
- Uma decisão principal por tela.
- O padrão seguro vem pré-selecionado; o usuário não precisa configurar para começar.
- Nada de parede de quarenta checkboxes: configuração é exposta por agrupamentos com
  nome em linguagem natural.

### Linguagem
- pt-BR simples: frases curtas, voz ativa, sem jargão técnico ou clínico.
- Sem dupla negação. Números como algarismos.
- O rótulo diz o que acontece ao clicar, não onde o clique leva.

### Estímulo
- `prefers-reduced-motion` respeitado nas duas plataformas, e movimento decorativo
  simplesmente não existe quando ativo.
- **Modo de baixo estímulo** disponível: menos cor, menos movimento, menos densidade.
- Nenhum som ou vibração automática sem ação do usuário.
- Notificações são agrupadas e respeitam bloco de foco em andamento.

---

## O que verifica o quê

| Regra | Verificação |
|---|---|
| Violações WCAG automatizáveis (web) | `axe-core` no CI — falha o build |
| Contraste dos tokens | teste unitário sobre o pacote de design tokens |
| Navegação por teclado | teste de integração dos fluxos principais |
| Rótulos e papéis no mobile | lint de props de acessibilidade + passe manual |
| VoiceOver / TalkBack | passe manual por marco, registrado |
| Regras cognitivas | *review* — checklist do PR |

Cerca de 30% das barreiras da WCAG são detectáveis por ferramenta automática. O CI verde
significa "nada óbvio quebrado", não "acessível".

## Checklist de tela

Toda tela nova responde sim a todas antes do merge:

- [ ] Completável só com teclado, com foco visível e ordem de foco correta
- [ ] Leitor de tela anuncia propósito, estado e mudanças relevantes
- [ ] Contraste dentro do alvo, e nenhuma informação depende só de cor
- [ ] Alvos de toque no tamanho mínimo
- [ ] Funciona com fonte ampliada e com movimento reduzido
- [ ] Toda ação destrutiva tem confirmação e desfazer
- [ ] Nenhum texto de usuário hardcoded — tudo via i18n, em pt-BR simples
- [ ] Nada se move, avança ou expira sozinho
