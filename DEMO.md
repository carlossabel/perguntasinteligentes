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

Nada da regra do software foi alterado — é só dado.

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
