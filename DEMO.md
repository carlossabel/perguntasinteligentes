# Base de demonstração — Lanchonete

Este repositório vem com uma base de exemplo pronta para demonstrar a ferramenta:
o cenário de implantação do software em uma lanchonete (**"Lanchonete do Zé"**).

Ela cobre os dois estágios do funil já preenchidos:

- **Estágio 1 (assessment macro):** 6 perguntas de maturidade → a empresa aparece com
  maturidade **25/100 (Baixa)** e 6 oportunidades acesas.
- **Estágio 2 (diagnóstico técnico):** 9 funcionalidades avaliadas (PDV, comanda/mesas,
  KDS, ficha técnica, delivery, cardápio digital, estoque, emissão fiscal, fechamento de
  caixa), montadas de propósito para mostrar **todos os vereditos** no relatório
  (`ok`, `atende`, `parceira`, `parcial`, `custom`, `gap`) e um "Outro" indo para a curadoria.

A base também já traz **tarefas de implantação** por funcionalidade e um **plano de projeto**
montado para a demo (veja a aba "Plano de projeto"), com uma ordem de áreas sugerida e
algumas tarefas já marcadas como feitas.

## Aba "Plano de projeto"

A partir de um relatório, agrupa as funcionalidades por **área de negócio** e lista as
**tarefas de implantação** de cada uma. Dá para:

- reordenar as **áreas de negócio** (setas ↑↓ no topo de cada área);
- reordenar as **funcionalidades** dentro de uma área;
- reordenar as **tarefas** dentro de uma funcionalidade;
- adicionar/editar/remover tarefas (as tarefas ficam na base, reutilizáveis por funcionalidade);
- marcar tarefas como feitas e acompanhar o progresso.

A ordem e o progresso são guardados **por relatório** (cada cliente tem seu próprio plano);
as tarefas em si são um catálogo por funcionalidade, reaproveitado entre os planos.

## Como ativar

O app lê `server/data.json` (esse nome é ignorado pelo git, por ser persistência de runtime).
A base versionada mora em `server/data.demo.json`. Para rodar a demo:

```bash
cp server/data.demo.json server/data.json   # ativa a base da lanchonete
npm install
npm run dev                                   # http://localhost:5173
```

> Ao clonar este repositório, faça o `cp` acima uma vez. Se `server/data.json` já existir
> de um uso anterior, o `cp` substitui pela base da lanchonete (faça backup antes se quiser
> preservar a base atual: `mv server/data.json server/data.bak.json`).
