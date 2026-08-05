# Diagnóstico de Processo e Aderência de Software

Ferramenta interna para um fornecedor de software (ERP): descobre **como uma empresa faz um processo hoje** (via perguntas de múltipla escolha), cruza cada resposta com as funcionalidades do software e diz automaticamente se o software **atende, atende via customização ou não atende** — gerando um **relatório de aderência**.

O diferencial não é a interface: é uma **base curada** de funcionalidades e perguntas que a IA ajuda a montar, o humano valida, e que fica mais inteligente a cada uso.

---

## Conceito central

> **O veredito ("atende/não atende") mora na RESPOSTA, não na funcionalidade.**

- Cada funcionalidade tem uma **pergunta de processo** com **opções**.
- Cada **opção** carrega um **veredito** pré-configurado por um humano.
- No diagnóstico, o cliente escolhe uma opção → o sistema lê o veredito daquela opção → classifica. Ninguém reanalisa nada na hora do relatório.

Os 5 campos descritivos (objetivo, fluxo, benefício, risco, limitações) + "o que cadastrar" **não decidem** o veredito — eles **escrevem** o relatório.

| Veredito | Significado |
|----------|-------------|
| `ok`     | já faz bem; sem dor; fora da proposta |
| `atende` | dor que o software resolve de fábrica |
| `custom` | resolve, mas via customização (custo/prazo) |
| `gap`    | não atende; vira roadmap |
| `rever`  | opção "Outro"; texto livre → fila de curadoria |

---

## Stack

- **Front-end:** React 18 + Vite + Tailwind CSS + lucide-react
- **Back-end:** Node + Express (a **chave da IA fica só aqui**)
- **IA:** API da Anthropic (Messages), com as perguntas recusadas reinjetadas como contexto de "não perguntar"
- **Persistência:** arquivo JSON (`server/data.json`) — trocável por SQLite/Postgres sem mudar o front

Requisitos: **Node.js 18+** (usa `fetch` nativo e `node --watch`).

---

## Como rodar

```bash
# 1. instalar dependências
npm install

# 2. configurar a chave da IA (server-side)
cp .env.example .env
#   edite .env e preencha ANTHROPIC_API_KEY

# 3. desenvolvimento (sobe API na :3001 e o front na :5173, com proxy)
npm run dev
#   abra http://localhost:5173
```

O app já nasce com uma base semeada (3 áreas, 3 funcionalidades com perguntas aprovadas), então dá para rodar um diagnóstico e ver o relatório imediatamente. A geração pela IA só funciona com `ANTHROPIC_API_KEY` preenchida — o resto funciona sem chave (preenchimento manual, diagnóstico, relatório).

### Produção

```bash
npm run build   # gera dist/
npm start       # Express serve a API + o front buildado em http://localhost:3001
```

---

## Estrutura

```
server/
  index.js       API REST + serve o build
  db.js          load/save em data.json
  seed.js        base inicial
  anthropic.js   chamada à IA (chave via .env) + injeção de recusadas
src/
  App.jsx        shell, navegação, carga de dados
  api.js         cliente HTTP
  ui.jsx         vereditos, helpers e primitivos de UI
  screens/       Cadastro, Curadoria, Diagnostico, Relatorio, Base
```

### API

| Método | Rota            | O que faz |
|--------|-----------------|-----------|
| GET    | `/api/base`     | retorna a base (áreas, funcionalidades, perguntas, opções) |
| PUT    | `/api/base`     | substitui a base |
| GET    | `/api/diag`     | retorna diagnósticos + respostas |
| PUT    | `/api/diag`     | substitui diagnósticos + respostas |
| POST   | `/api/generate` | `{tema, areaId}` → gera descrição + perguntas via IA |

---

## As quatro telas

1. **Cadastro por tema** — digite um tema, a IA sugere os 5 campos + 2–3 perguntas com veredito; você cura (usar / curar depois / descartar) e salva.
2. **Curadoria** — fila de sugeridas (aprovar / ajustar / recusar com motivo), "Outros" recorrentes, sinais de gap/custom recorrentes, e a lista de recusadas.
3. **Bot de diagnóstico** — uma pergunta por vez; "Outro" abre texto obrigatório; grava as respostas.
4. **Relatório de aderência** — agrupa por veredito, monta o texto a partir dos campos da funcionalidade, e separa os "Outros" para voltar à curadoria.

---

## O loop de aprendizado

1. Todo `texto_outro` volta para a curadoria como matéria-prima.
2. Um "Outro" recorrente → vira opção fixa.
3. `gap` recorrente → sinal de roadmap.
4. `custom` recorrente → candidato a virar funcionalidade padrão.
5. Perguntas `recusada` + motivo → reinjetadas na IA como "não perguntar".

Sem esse loop, o sistema é só um formulário. Com ele, é um ativo que aprende.

---

## Roadmap sugerido

- **Autenticação/multiusuário** e troca do JSON por um banco real.
- **Exportação** do relatório em PDF/DOCX.
- **Áreas de negócio por cliente** e versionamento das propostas.
