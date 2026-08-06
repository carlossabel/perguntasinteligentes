# Plano de evolução — Diagnóstico de Aderência

Documento vivo das decisões combinadas. Serve para retomar o contexto entre sessões.

## Visão: funil de dois estágios

1. **Estágio 1 — Assessment de segmento (macro).** Rodado pelo comercial. Lê o negócio,
   mede a maturidade da empresa e levanta oportunidades (funcionalidades a explorar).
2. **Estágio 2 — Diagnóstico de aderência (técnico).** Rodado por especialista.
   Para cada funcionalidade, um veredito sobre o nosso sistema
   (ok / atende / parceira / parcial / custom / gap).
3. **Cruzamento — Relatório único.** Junta os dois: onde a oportunidade vira venda e
   onde vira risco.

## Modelo de dados

`segmento → área → funcionalidade → pergunta → opção` (base do estágio 2, já pronto).

Estágio 1 (já construído):
- `assessmentPerguntas`: [{ id, segmento_id, texto, ordem }]
- `assessmentOpcoes`: [{ id, pergunta_id, texto, nivel (0-4), oportunidades:[func_id], ordem }]
- `assessments` (resultado): [{ id, cliente_nome, segmento_id, criado_em, maturidade, oportunidades:[func_id] }]

## Decisões fechadas

- **Oportunidade é regra manual**, não IA: cada opção do assessment lista na mão as
  funcionalidades que acende. (IA fica para depois, se fizer falta.)
- **Grau de maturidade da resposta** (0-4, rotulado Imaturo→Maduro): definido por nós ao
  cadastrar cada opção. A média vira a "maturidade da empresa" (0-100). Independente da
  oportunidade que a opção acende.
- **Estágio 1 é honesto**: mostra só maturidade + oportunidades (com contagem).
  Sem risco e sem complexidade ali — não há dado para afirmar risco antes do técnico.

## Tensão resolvida: baixa maturidade = oportunidade E risco

São dois eixos, não um. Baixa maturidade **cria a oportunidade** (há demanda), mas **não
determina o risco** (risco depende do nosso catálogo). Toda oportunidade nasce candidata a
virar risco; **o veredito técnico é o desempate**:
- baixa maturidade + atende → oportunidade limpa (venda fácil).
- baixa maturidade + gap/custom → risco (não entregamos bem).

Por isso o risco não vive no estágio 1 — emerge no cruzamento.

## Fatia 2 (próxima): costura estágio 1 → estágio 2

As oportunidades acesas no assessment abrem o diagnóstico técnico já no **modo customizado**
com essas funcionalidades pré-selecionadas. Liga um estágio ao outro sem entidade nova.

## Fatia 3: relatório cruzado + risco

Relatório único por cliente: perfil do estágio 1 + fit do estágio 2, com matriz
oportunidade × veredito destacando prioridades.

**Fórmula de risco (combinada, a calibrar):** risco de uma oportunidade =
`peso_veredito × fator_imaturidade`.
- `peso_veredito`: gap 1,0 · custom 0,5 · parcial 0,4 · parceira 0,25 · atende 0 · ok 0.
- `fator_imaturidade` = (4 − nivel) / 4  → Imaturo(0)=1,0 · Inicial(1)=0,75 ·
  Em desenv.(2)=0,5 · Gerenciado(3)=0,25 · Maduro(4)=0.
  (Se uma oportunidade for acesa por mais de uma opção, usar o menor nível — o mais imaturo.)
- Risco do cliente = soma normalizada nas oportunidades acesas → Baixo / Médio / Alto.

Racional: dói mais o gap onde o cliente é imaturo (precisa e não temos) do que onde ele já
resolve bem sozinho. Números são ponto de partida — calibrar com casos reais.
