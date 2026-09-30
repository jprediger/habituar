# Documentação de conceitos para pessoas e agentes de código

Pesquisa de 29/09/2026. Escopo: como manter `docs/` navegável e confiável à medida que
novos conceitos do sistema forem documentados.

## Achados de fontes primárias

1. **Separe finalidade de conteúdo.** O modelo [Diátaxis](https://diataxis.fr/)
   distingue explicação, referência, guia de tarefa e tutorial. Uma pasta dedicada
   aos conceitos pode concentrar explicações e referências; procedimentos e
   instruções operacionais podem ficar em locais próprios quando surgirem. Não há
   necessidade de criar quatro árvores vazias desde já.
2. **Mantenha um mapa curto de entrada.** O [GitHub recomenda dar ao agente um mapa
   estrutural do repositório](https://docs.github.com/en/copilot/tutorials/optimize-ai-usage),
   evitando que ele leia muitos arquivos só para se orientar. Um `docs/README.md`
   com uma frase e link para cada conceito é uma aplicação direta dessa orientação.
   As [diretrizes de links do Google](https://developers.google.com/style/cross-references)
   favorecem rótulos descritivos e destinos relevantes, sem repetir links em excesso.
3. **Separe instruções para o agente de conhecimento do domínio.** O
   [AGENTS.md](https://agents.md/) se destina a comandos, convenções e orientação
   para agentes, complementando README e demais documentos. A documentação de
   conceitos pode ser compartilhada por humanos e agentes; um `AGENTS.md` curto
   pode apontar para seu índice. O [GitHub](https://docs.github.com/en/copilot/how-tos/copilot-cli/cli-best-practices)
   recomenda instruções concisas e acionáveis, pois instruções longas podem perder
   eficácia.
4. **Declare a origem verificável de cada regra.** A orientação do
   [GitHub sobre instruções de repositório](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions)
   enfatiza contexto específico do projeto para entender, construir e validar
   alterações. Para documentos de domínio, citar arquivos de implementação,
   requisitos ou decisões concretas transforma afirmações em hipóteses
   auditáveis. Esta última formulação é uma inferência aplicada ao repositório.
5. **Use exemplos delimitados.** O [guia do Google para exemplos de código](https://developers.google.com/style/code-samples)
   recomenda contextualizar cada exemplo e indicar omissões explicitamente.
   Nas páginas conceituais, exemplos curtos de cenário, regra e resultado podem
   mostrar o comportamento esperado sem reproduzir toda a implementação. A
   adaptação para exemplos de domínio é uma inferência.
6. **Revise junto com a implementação.** O
   [AGENTS.md](https://agents.md/) descreve instruções como documentação viva e
   recomenda atualização conforme o projeto muda. Uma política local de revisão
   das páginas conceituais quando regras, contratos ou fluxos mudarem reduz
   divergências. A política específica é uma recomendação inferida, não uma
   exigência da fonte.

## Aplicação sugerida neste repositório

- Criar um índice em `docs/README.md` quando houver mais de uma página conceitual;
  manter uma linha de resumo e links por conceito.
- Adotar um esquema leve para cada página: definição e escopo; relações com outros
  conceitos; invariantes e exceções; exemplos de comportamento; fontes da verdade
  no código e documentos; links para conceitos vizinhos.
- Escrever cada página em torno de um conceito ou agregado coeso. Preferir links
  entre páginas à duplicação de regras.
- Manter `AGENTS.md`, se adotado, como ponto de navegação e instruções de trabalho,
  não como cópia das páginas de domínio.
