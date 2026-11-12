# 18 — Painel (dashboards do administrador)

Área `/painel`: números para a gestão do clube, começando pelas **vendas de ingressos por evento**. Contrato publicado pelo Lara em 2026-11-12; depois entram o MultiVendas e o MultiClubes sem mudar login nem estrutura.

## Regras do contrato

- **Mesmo login do sócio** (CPF + senha → `POST login`, token no header `Session`). Não existe login, senha nem cadastro de administrador no site.
- O perfil (`usuario` ou `administrador`) é dado **no Lara** (Reservas › Contas do site). O `POST login` devolve `user.site_role`; conta criada pelo `register` pode vir sem o campo, e aí vale `usuario`.
- **O navegador não chama a Lara.** Todo `/api/dashboard/*` sai dos Server Components de `app/painel`, com o Bearer da aplicação e o `Session` do sócio. Esses endpoints **não** estão na allowlist do proxy, de propósito.
- O perfil é conferido pela Lara **a cada chamada**: um administrador rebaixado recebe 403 já na próxima, com o mesmo token. Nada guarda "é admin" além da renderização atual (o `cache` do React vale só para ela). `site_role` na sessão serve **só** para mostrar o link "Painel" no menu.
- Sem dado de comprador: a API devolve só números.

## Arquivos

| Arquivo | Papel |
|---|---|
| [services/dashboard-api.ts](../../services/dashboard-api.ts) | Server-only (guard de `window`). Lê o `Session` via `getServerSession`, chama `dashboard/*` com `API_CONSUME` (servidor, `no-store`), traduz o status em `TipoDeFalha`. `lerAcesso`, `lerEventosDoPainel`, `lerDadosDoEvento(id)` (as 5 chamadas em `Promise.all`; se mais de uma falha, vale a mais grave) |
| [utils/painel.ts](../../utils/painel.ts) | Formatação pt-BR (`int`, `money`, `percent`), datas/horas no fuso `America/Sao_Paulo`, `PAINEIS_CONHECIDOS` (chave da Lara → rota e ícone) |
| [app/painel/layout.tsx](../../app/painel/layout.tsx) | `robots: noindex, nofollow`, título |
| [app/painel/page.tsx](../../app/painel/page.tsx) | Confere o acesso e redireciona para o primeiro painel conhecido de `panels` |
| [app/painel/ingressos/page.tsx](../../app/painel/ingressos/page.tsx) + `loading.tsx` | Seletor, KPIs e gráficos de um evento |
| [app/components/Painel/](../../app/components/Painel/) | `PainelCasca` (faixa + abas), `FalhaDoPainel`, `SessaoVencida`, `SeletorDeEvento`, `BotaoAtualizar`, `Esqueleto`, `GraficosIngressos` (Recharts) |
| [styles/painel.module.css](../../styles/painel.module.css) | Estilos da área |

## Endpoints (todos `GET`, Bearer + `Session`)

| Endpoint | Uso |
|---|---|
| `dashboard/access` | `{ admin, member: {name, title}, panels: [{key, label, path}] }`. Abas na ordem recebida; painel com `key` desconhecida não aparece |
| `dashboard/tickets/events` | `{ default_event_id, events[] }`: publicados, encerrados e cancelados, do mais novo ao mais antigo |
| `dashboard/tickets/events/{id}/summary` | `{ event, kpis: [{key, label, value, format}], generated_at }` |
| `…/sales-by-day` | `{ series: [{date, tickets, amount}] }` (dias zerados já vêm; pode ser `[]`) |
| `…/by-lot` | `{ rows: [{type, lot, capacity, member, non_member, courtesies, total, net}] }` (`capacity: null` = sem limite) |
| `…/by-channel` | `{ origin: [...], buyer: [...] }` com `{key, label, count, amount}` |
| `…/by-method` | `{ rows: [{method, count, paid, refunded, received}] }` |

## Erros → tela

| Status | `TipoDeFalha` | Tela |
|---|---|---|
| 400, 401 (ou sessão sem `accessToken`) | `login` | `SessaoVencida`: **`signOut` primeiro** e depois `/login?callbackUrl=/painel`. Só redirecionar não serve: o NextAuth ainda acha que há sessão e o `/login` devolveria para o painel (laço) |
| 403 | `sem-acesso` | "Você não tem acesso aos dashboards" + link para o início (casca sem abas) |
| 404 (ou `?evento=` que não é número) | `nao-encontrado` | "Evento não encontrado" + volta ao seletor |
| 429 (120/min por rota) | `limite` | "Muitas atualizações; tente em instantes" + tentar de novo |
| outro | `indisponivel` | "Não conseguimos carregar o painel" + mensagem da Lara + tentar de novo |

## Proteção

1. `middleware.ts`: `/painel` e `/painel/:path*` no `matcher`. Sem sessão → login, voltando ao painel.
2. Com sessão: cada página chama `dashboard/access` no servidor e aplica a tabela acima. Ser administrador **não** é conferido no middleware nem no cliente.
3. Link "Painel" no menu do usuário (`header.tsx`) só com `session.user.site_role === 'administrador'` e `moduloVisivel('painel')`. Sessões abertas antes desta mudança não têm o campo: o link aparece depois de um novo login. A URL funciona do mesmo jeito.
4. `painel` está em `OCULTOS_EM_PRODUCAO` (`utils/modulos.ts`): em produção some só o link; para liberar, tire da lista.

## `/painel/ingressos`

- **Evento**: `?evento=<id>` na URL (dá para compartilhar e recarregar); sem ele, `default_event_id`. Se ele vier `null` com eventos na lista, abre o primeiro da lista (o contrato diz que `null` só ocorre sem eventos). Lista vazia → "Nenhum evento com vendas".
- **Seletor**: `<select>` nativo com "título · data · status_label"; a troca faz `router.push` e o conteúdo fica num `<Suspense key={id}>`, então a troca mostra o esqueleto.
- **Cards**: os `kpis` na ordem e com o `label` da Lara; `format` → `1.234` / `R$ 1.234,56` / `30,0%`. Celular: 2 colunas.
- **Atualizar**: "Atualizado às HH:MM" (de `generated_at`) + botão que faz `router.refresh()` (os números ficam na tela enquanto busca). Não há atualização automática.
- **Gráficos** (Recharts, componente de cliente que recebe os dados prontos):
  - *Vendas por dia*: área com seletor **Quantidade / Valor** (um eixo só, por regra de visualização; o tooltip mostra os dois). Série vazia → "Nenhuma venda ainda".
  - *Por lote*: barras horizontais empilhadas sócio / não sócio / cortesias por `type · lot`; a capacidade aparece como traço tracejado (lote sem limite não tem traço). Tooltip com total, capacidade e líquido.
  - *Por canal*: roscas de `origin` e `buyer`, com a lista de rótulo, quantidade e valor embaixo.
  - *Recebido por forma de pagamento*: barras de `received`; tooltip com pagamentos, pago, estornado e recebido.
  - Gráfico sem dado mostra frase curta, nunca eixo vazio. Desktop: 2 colunas; ≤900px: 1 coluna.

## Visual

- Casca própria (como a equipe dos torneios): faixa na cor do módulo `painel` com logo, "Painel", nome e matrícula (de `access.member`), "Voltar ao site" e as abas. Sem `Header`, sem barra inferior.
- Cor do módulo `painel` (verde-azulado) é **proposta do site** — ver [14](14-identidade-visual.md).
- Séries dos gráficos: tokens `--viz-1..4` (paleta validada para daltonismo, passos próprios no escuro), sempre na mesma ordem; texto dos gráficos em `--ink-*`.
- **Recharts 2 + React 19**: o `package.json` força `react-is@^19` para o Recharts (`overrides`). Sem isso as barras e fatias podem não aparecer.
