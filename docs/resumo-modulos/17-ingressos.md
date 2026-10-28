# 17 — Ingressos de eventos (`/ingressos`)

Venda de ingressos dos eventos do clube: vitrine, página do evento, compra do **sócio** (para as pessoas do título dele, preço de sócio) e do **não sócio** (sem login e sem cadastro), pagamento na eRede, "meus ingressos" com QR Code, código e PDF — do sócio pelo login e do não sócio por CPF + e-mail + código —, "perdi o link", eventos de vários dias (diária × passaporte) e **lugar marcado** (mesa, bistrô, camarote escolhidos num mapa). Backend: rotas `api/tickets/*` da Lara. Contrato: versões v1 a v4 (v2 cupom, v3 compra para o título, v4 vários dias) + lugares marcados.

**Princípio do módulo**: o front não decide nada. Lote, preço, estoque, limite por pedido, lotação de cada dia, cupom, total e situação vêm da Lara. Recusas são tratadas pelo **`reason`**, nunca pelo texto; a `message` da Lara é exibida como veio. Depois de cada ação a tela **relê** (evento, título, pedido).

## Regras de negócio (todas da Lara)

- O evento tem **tipos** (Pista, Mesa…) vendidos em **lotes**; a Lara já devolve o lote à venda agora (`lot`) com `price_member` e `price_non_member`. `members_only` ou `price_non_member: null` = só sócio. `remaining: null` = lote sem limite de quantidade (fecha pela data ou quando a organização vira o lote). O lote vira sozinho (esgotou, passou a data ou "Virar lote agora" no Lara); a compra **relê o evento** ao abrir, e quem já está com pedido aberto mantém o preço do lote em que entrou (o preço que vale é sempre o do pedido).
- Ingresso **nominal** (nome + CPF de quem entra). Um por CPF por evento — no evento de vários dias, um por CPF **por dia**; diária × passaporte da mesma pessoa não pode.
- **Sócio** (titular ou dependente, logado): compra para as pessoas do título (`my-title`), pelo preço de sócio; o nome é o do cadastro; `max_per_order` não vale. Pessoa de fora do título: compra como não sócio (ou pelo login dela, se for sócia).
- **Não sócio**: dados de quem compra + nome/CPF de cada ingresso, até `max_per_order`. CPF de sócio → `holder_is_member`.
- O pedido **guarda os lugares** até `hold_until` (hoje 10 min). Pagamento depois do prazo ainda pode ser aceito se houver lugar; se não houver, `hold_expired` e o site **estorna**.
- **Cupom** (v2): o desconto é da Lara; cupom de 100% deixa o pedido já pago (sem eRede).
- Desistir pelo site só antes de pagar. E-mails (confirmação, cancelamento, link) são da Lara. Check-in é na portaria, pela Lara.
- **Lugar marcado** (tipo `kind: "seat"`): mesa/bistrô/camarote escolhido no mapa. **Não é entrada** — cada pessoa compra a própria entrada num tipo comum. Nominal no **responsável** (sócio: pessoa do título pela `holder_ref`, vazio = ele; não sócio: `holder_name`/`holder_cpf`), que pode ter também a entrada dele no mesmo pedido. Sempre de **um dia** (`day_id`; não há passaporte de mesa). Vários tipos podem vender o mesmo mapa (cada lugar diz o `type_id` que o vende no dia). `max_per_order` vale **separado** para entradas e para lugares — e, nos lugares, também para o sócio. O lugar fica preso ao pedido até `hold_until`; desistiu ou venceu, volta ao mapa. Quem garante que o lugar não é vendido duas vezes é a Lara (`seat_taken`).
- Pedido da secretaria (`origin: "secretaria"`, pago por fora ou `courtesy`) aparece em "meus ingressos" como qualquer outro; cortesia mostra "Cortesia" no lugar do valor.

## Arquivos

| Arquivo | Papel |
|---|---|
| [app/ingressos/page.tsx](../../app/ingressos/page.tsx) | Vitrine (pública): cartões, busca; encerrados no fim |
| [app/ingressos/[id]/page.tsx](../../app/ingressos/[id]/page.tsx) | Evento (público): detalhes, regras, tipos com o lote e os dois preços; vários dias em blocos por dia + passaporte em destaque |
| [app/ingressos/[id]/comprar/page.tsx](../../app/ingressos/[id]/comprar/page.tsx) | Compra (pública): relê o evento; sócio logado → `MemberCheckout`; sem login ou `?modo=nao-socio` → `GuestCheckout` |
| [app/ingressos/pedido/[id]/page.tsx](../../app/ingressos/pedido/[id]/page.tsx) | Pedido do não sócio (link do e-mail e confirmação) |
| [app/ingressos/meus/page.tsx](../../app/ingressos/meus/page.tsx) | Meus ingressos: sócio logado → `my-orders`, busca; sem login → `GuestAccess` |
| [app/components/Ticket/GuestAccess.tsx](../../app/components/Ticket/GuestAccess.tsx) | "Meus ingressos" do não sócio: CPF + e-mail → código → lista |
| [pages/api/ingressos/acesso/](../../pages/api/ingressos/acesso/) | (servidor) `entrar` (confere o código, grava o cookie do acesso), `pedidos` (lista sem tokens), `pedidos/[id]/abrir` (grava o cookie de um pedido), `sair` |
| [app/ingressos/meus/[id]/page.tsx](../../app/ingressos/meus/[id]/page.tsx) | Pedido do sócio |
| [app/ingressos/perdi-o-link/page.tsx](../../app/ingressos/perdi-o-link/page.tsx) | "Perdi o link": CPF + e-mail → `resend-link` |
| [app/components/Ticket/](../../app/components/Ticket/) | `EventCard` (+ `EventStatusPill`), `TicketTypeCard`, `MemberCheckout`, `GuestCheckout`, `CouponField`, `HoldCountdown`, `TicketOrderView` |
| [app/components/Ticket/SeatPicker.tsx](../../app/components/Ticket/SeatPicker.tsx) | Lugar marcado: `useSeatCart` (carrinho de lugares + recusas), `SeatSection` (bloco do checkout) e o mapa em tela cheia |
| [services/ticket-api.ts](../../services/ticket-api.ts) | Contratos, normalização e chamadas |
| [utils/ticket.ts](../../utils/ticket.ts) | Datas no fuso de Brasília, preço por público, agrupamento por dia, rótulos, prévia do cupom, CPF, títulos por `reason` |
| [utils/ticket-guest.ts](../../utils/ticket-guest.ts) | (servidor) cookie httpOnly com o token do pedido do não sócio |
| [pages/api/ingressos/pedidos/index.ts](../../pages/api/ingressos/pedidos/index.ts) | (servidor) cria o pedido do não sócio e guarda o token |
| [pages/api/ingressos/pedidos/[id]/abrir.ts](../../pages/api/ingressos/pedidos/[id]/abrir.ts) | (servidor) link do e-mail: confere o token e grava o cookie |
| [pages/api/ingressos/pedidos/[id]/pdf.ts](../../pages/api/ingressos/pedidos/[id]/pdf.ts) | (servidor) PDF do pedido (não sócio pelo cookie; sócio pelo Session) |
| [utils/lara.ts](../../utils/lara.ts) | `computeTicketCharge`, `ticketOrderIsPaid`, `ticketOrderRoute`, `TicketChargeRefusal` (servidor) |
| [styles/ticket.module.css](../../styles/ticket.module.css) | Estilos do módulo |

URLs: `/ingressos/<titulo>-<id>` e `/ingressos/<id>` (só o número final importa), `/ingressos/<id>/comprar[?modo=nao-socio]`, `/ingressos/pedido/<id>[?token=…]`, `/ingressos/meus`, `/ingressos/meus/<id>`, `/ingressos/perdi-o-link`. No `matcher` do middleware fica **só** `/ingressos/meus/:path+` (o pedido do sócio). `/ingressos/meus` fica fora: sem login é o "Meus ingressos" do não sócio.

## O não sócio e o `access_token`

A Lara devolve o `access_token` do pedido do não sócio **uma única vez**, na criação. Ele **nunca chega ao JavaScript do navegador**:

1. `GuestCheckout` → `POST /api/ingressos/pedidos` (rota do site; limite 10/min por IP de quem compra) → `POST tickets/events/{id}/guest-orders`. O servidor grava o token no cookie **httpOnly** `ingresso_pedido_<id>` (`Path=/api` — `/homolog/api` na homologação —, `SameSite=Lax`, `Secure` em produção, 180 dias), tira o token do corpo e devolve o pedido. A tela vai para `/ingressos/pedido/<id>`.
2. As rotas do pedido (`GET`/`DELETE tickets/guest-orders/{id}`) vão pelo **proxy**, que põe `Ticket-Order-Token` a partir do cookie daquele pedido e **não** repassa o `Session` de um sócio logado no mesmo navegador.
3. Pagamento (`payment_methods`/`success`) e PDF leem o mesmo cookie no servidor.
4. **Link do e-mail** (`/ingressos/pedido/{id}?token=…`): a página manda o token para `POST /api/ingressos/pedidos/{id}/abrir` (limite 20/min), que confere na Lara e grava o cookie; a página tira o token da URL (`router.replace`) na mesma hora. A rota tem `Referrer-Policy: no-referrer`, `Cache-Control: no-store` e `X-Robots-Tag: noindex` (`next.config.ts`) e está no `robots.ts`.
5. Sem cookie (outro aparelho, cookie apagado) ou token errado → `order_not_found` → a página oferece "Perdi o link".

O cookie só vale para `/api`: as páginas não o recebem.

## "Meus ingressos" do não sócio (CPF + e-mail + código)

Quem comprou sem ser sócio vê **todos** os pedidos dele em `/ingressos/meus` (sem login). O código de 6 dígitos existe porque o QR é a entrada no evento: saber CPF e e-mail não basta, a pessoa prova que lê o e-mail. O acesso é de **quem comprou** — quem só é titular de um ingresso não o acha aqui ("Os ingressos ficam com quem fez a compra").

1. **CPF + e-mail** (CPF validado no cliente) → `POST tickets/guest-access/code` pelo proxy (público; limite 5/min por IP no proxy). A Lara responde **sempre** a mesma coisa, exista compra ou não: a tela mostra a `message` como veio e vai para o código — nunca diz "CPF não encontrado". 422 do Laravel marca `cpf`/`email`.
2. **Código** ("Enviamos um código para c***@email.com"; campo `inputmode="numeric"`, `autocomplete="one-time-code"`) → `POST /api/ingressos/acesso/entrar` (limite 10/min) → `tickets/guest-access/verify`. Valendo, o `access_token` (2 horas) vai para o cookie httpOnly `ingresso_acesso` (`Path=/api`, vence no `expires_at`) e sai do corpo. `access_code_invalid` → "Código incorreto. Restam N tentativas." (`context.attempts_left`), mantém o campo; `access_code_expired` → "Este código não vale mais." + "Enviar novo código". "Reenviar código" só depois de 60 s; "Trocar CPF/e-mail" volta.
3. **Lista** → `GET /api/ingressos/acesso/pedidos` (limite 60/min) → `tickets/guest-access/orders` com `Ticket-Access-Token`. O servidor **tira o `access_token` de cada pedido** da resposta. "Olá, {nome}", em três grupos: **Seus ingressos** (pagos de eventos que não acabaram, com `TicketCard`: QR, código, entradas; PDF e "Ver pedido"), **Aguardando pagamento** (valor, contador do `hold_until`, Pagar) e **Histórico** (eventos passados, expirados, desistidos, cancelados). Lista vazia → "Nenhum pedido encontrado para este CPF e e-mail." + "Tentar de novo". **Sair** apaga o cookie do acesso.
4. **Abrir, pagar, PDF**: a tela chama `POST /api/ingressos/acesso/pedidos/{id}/abrir`, que relê a lista, acha o pedido e grava o cookie **só dele** (`ingresso_pedido_<id>`, o mesmo da compra e do link). Daí a página do pedido, o pagamento e o PDF são os de sempre. Os 50 tokens não viram cookie de uma vez: estourariam o header `Cookie` (limite do nginx).
5. Sem cookie, vencido ou adulterado: **401 `access_expired`** em qualquer passo → o cookie sai e a tela volta para CPF + e-mail ("Seu acesso venceu").

Já havendo acesso no aparelho (cookie de até 2 horas), `/ingressos/meus` abre direto na lista. A aba "Meus ingressos" da capa e a página do pedido do não sócio levam para cá.

## Lugar marcado (mapa)

1. **Evento**: os tipos `seat` saem dos blocos de entrada (`groupTypes(...).seats`) e vão num bloco próprio com o nome dos mapas (`event.maps`: "Mesas e Bistrôs"), preço do lote, "N lugares livres" (`seats_free`; 0 = esgotado) e o aviso de que não é entrada. O "a partir de" da vitrine considera só entradas; o cartão da vitrine avisa que o evento tem lugar marcado (`has_map`).
2. **Compra** (sócio e não sócio): bloco do lugar marcado abaixo das entradas, com "Escolher no mapa" por tipo. O mapa abre em **tela cheia** por cima do checkout: `GET tickets/events/{id}/maps/{mapId}?day_id=` (proxy público, limite 120/min por IP no proxy; `day_id` = o do tipo, obrigatório no evento de vários dias). Desenho em `<svg viewBox="0 0 width height">`: fundo `background_url`, áreas (`stage`/`water`/`green`/`service`/`warn` em tokens, não clicáveis), lugares (`x`/`y` = centro; `circle`/`square`/`rect`) com o rótulo. Só `free` com o tipo à venda para quem compra é clicável (`members_only` não vende ao não sócio). Tocar escolhe; tocar de novo tira; o detalhe mostra "Mesa Vip V2 · 4 lugares · R$ 600" e a situação. Zoom/arrasto/pinça com `react-zoom-pan-pinch` (a escolha é no `pointerup`, ignorando arrasto e pinça), botões de zoom, legenda (livre, escolhido, reservado, vendido, indisponível). Relido a cada `refresh_after` s só com a aba visível; lugar escolhido que deixou de estar `free` sai do carrinho com "Esse lugar acabou de ser reservado. Escolha outro." Limite: `max_per_order` lugares no pedido.
3. **Responsável**: sócio escolhe alguém do título (padrão ele mesmo); não sócio marca "Responsável: quem está comprando" (padrão) ou informa nome e CPF. O resumo mostra "Mesa Vip V2 · 4 lugares (não é entrada)" e cada lugar diz "Para 4 pessoas — as entradas são compradas à parte". O não sócio pode fazer pedido só de lugar.
4. **Pedido**: os itens de lugar levam `seat_id` e vão **depois** das entradas — é por essa ordem que `context.index` e `tickets.N.*` são lidos. Recusas: `seat_taken` (`context.seat_ids`) tira esses lugares do carrinho, mantém o resto e reabre o mapa relido com eles marcados "acabou de ser reservado"; `seat_not_found`/`seat_wrong_type` tiram o lugar e reabrem o mapa; `seat_required` reabre o mapa; `map_not_found` fecha o mapa e relê o evento; `limit_per_order` com mais lugares que `context.max` → "Até N lugares por pedido". `day_required` só aparece como erro de integração.
5. **Pedido / meus ingressos**: o ingresso `kind: "seat"` mostra o lugar em destaque ("Mesa Vip V2", lugares, mapa, dia), o responsável e o selo **"Não é entrada"**; o QR/código serve para a recepção conferir o responsável. Listas contam "2 ingressos · 1 lugar marcado". `hold_expired` com `context.seat_ids` no pagamento → estorno e "O lugar escolhido foi reservado por outra pessoa enquanto o pagamento era feito."

O site não cria nem edita mapas (o desenho é feito no Lara).

## Endpoints e quem chama

| Endpoint (Lara, `/api/…`) | Via | Chamado por |
|---|---|---|
| `GET tickets/events`, `GET tickets/events/{id}` | proxy, público | vitrine, evento, compra |
| `POST tickets/events/{id}/coupon-check` | proxy, público (limite 20/min por IP no proxy) | `CouponField` |
| `GET tickets/events/{id}/maps/{mapId}?day_id=` | proxy, público (limite 120/min por IP no proxy) | mapa do lugar marcado (`SeatPicker`) |
| `POST tickets/guest-orders/resend-link` | proxy, público (limite 5/min) | perdi o link |
| `POST tickets/guest-access/code` | proxy, público (limite 5/min) | `GuestAccess` |
| `POST tickets/guest-access/verify`, `GET tickets/guest-access/orders` | rotas do site `/api/ingressos/acesso/*` (token em cookie) | `GuestAccess` |
| `GET`/`DELETE tickets/guest-orders/{id}` | proxy, público + `Ticket-Order-Token` do cookie | pedido do não sócio |
| `GET tickets/my-title?event_id=` | proxy, autenticado (limite 30/min) | `MemberCheckout` |
| `POST tickets/events/{id}/orders`, `GET tickets/my-orders`, `GET`/`DELETE tickets/orders/{id}` | proxy, autenticado | compra e pedidos do sócio |
| `POST tickets/events/{id}/guest-orders` | rota do site `/api/ingressos/pedidos` | `GuestCheckout` |
| `GET tickets/guest-orders/{id}` (conferir o token do link) | rota do site `…/abrir` | pedido do não sócio |
| `GET tickets/(guest-)orders/{id}/pdf` | rota do site `…/pdf` | `TicketOrderView` |
| `POST tickets/(guest-)orders/{id}/payment`, `GET tickets/(guest-)orders/{id}` | **só o servidor** (`success.ts`, `utils/lara.ts`) | pagamento |

Tratamento de 401 em `ticket-api.ts` (interceptor genérico desligado): público e não sócio nunca deslogam; rotas de sócio com 401 sem `reason` → toast + `signOut` para o login. Falha: `{ok:false, status, kind, reason, error, context, fieldErrors}` (mesmo formato de torneios e espaços sociais).

## Pagamento (eRede)

Mesmo pipeline dos outros módulos ([05](05-checkout-pagamento.md)), com `ticketOrderId` (+ `ticketGuest` no não sócio):

1. `TicketOrderView` → `CheckoutPayment ticketOrderId ticketGuest onTicketResult`. Valor exibido é informativo.
2. `POST /api/erede/payment_methods`: sócio exige sessão; **não sócio exige o cookie do pedido** (no lugar da sessão — o anti-oráculo de cartão continua: precisa de um pedido real pendente criado neste aparelho, e há o limite de 10/min). `computeTicketCharge` lê o pedido na Lara (com `Session` ou `Ticket-Order-Token`): pago → `already_paid`; outra situação que não `pending_payment` → `invalid_status`; 404 → `order_not_found` — recusas 409 **sem ir à eRede**. Valor = `round(total × 100)`. O prazo (`hold_until`) **não** é conferido aqui (a Lara aceita pagamento atrasado se houver lugar). `savePendingPayment` guarda `ticketOrderId` (no não sócio, `userId = ticket-guest:<id>`).
3. `POST /api/success`: verifica a transação na eRede pelo `tid`, compara o valor e chama `POST tickets/(guest-)orders/{id}/payment` `{payment_method, paid_amount (= total exato), payment_integration_id: tid, paid_at}`.
   - **5xx/rede**: reenvia o **mesmo `tid`** até 3 vezes (a Lara responde 200 no reenvio). Ainda falhando, relê o pedido: pago → sucesso, sem estorno.
   - **Recusa** → **estorno** e 409 com o `reason`. `hold_expired` → "Os ingressos esgotaram enquanto o pagamento era feito. O valor foi estornado." Sem `reason`/`invalid_status` e pedido pago → `already_paid`.
4. A tela relê o pedido e mostra o aviso pelo `reason`.

Cupom de 100%: o pedido já nasce pago; a tela do pedido mostra os ingressos direto (sem botão Pagar).

## Telas

Visual v4 ([14](14-identidade-visual.md)), módulo `ingressos` (rosa-magenta, cor proposta pelo site). Capa `TicketCover` com abas **Eventos** / **Meus ingressos**.

- **Vitrine**: cartões (imagem ou ingresso na cor do módulo, "N dias" e as datas "13/02 a 14/02" no evento de vários dias, selo: Vendas abertas / Vendas a partir de… / Vendas encerradas / Esgotado (`capacity_left` 0) / Evento encerrado), data e local, "a partir de" (menor preço à venda para quem vê). Busca.
- **Evento**: hero (quando — "13/02 a 14/02" no evento de vários dias —, local, janela de vendas, lugares restantes), descrição, regras (`<details>`), tipos com lote e os dois preços (o de quem vê realçado; visitante vê "Sócio? Entre para pagar R$ y"), selo "Últimos ingressos" com `remaining ≤ 10` (número escolhido pelo site, só apresentação; `remaining: null` = lote sem limite de quantidade → sem selo e sem contagem — quem diz se o tipo está à venda é só o `available`), tipo indisponível com "Próximo lote a partir de…" e os preços dele. Vários dias: passaporte em destaque ("vale todos os dias", só se houver tipo `passport`) e um bloco por dia (`label` + horário; "Dia esgotado" com `capacity_left` 0 do dia). Botão Comprar e barra fixa com "a partir de".
- **Compra do sócio**: pessoas do título (`is_me` primeiro, titular/dependente, CPF mascarado) com caixa "comprar" e o tipo; `has_ticket` desabilita ("Já tem ingresso"). Vários dias: Diárias (uma caixa por dia, com o tipo daquele dia; `days_taken` desabilita o dia) ou Passaporte (desabilitado se tem algum dia). Cupom, resumo (nome + tipo + preço, prévia do desconto), barra "Reservar e pagar". Atalho **"Comprar para quem não é do seu título"** → compra de não sócio (`?modo=nao-socio`). Recusa com `context.index` marca a pessoa do item (ou pelo CPF mascarado); `already_has_ticket` com `context.day_id` diz o dia ("já tem ingresso em Sáb 13/02"; `null` → "já tem passaporte"); `already_has_ticket`/`invalid_holder`/`holder_not_in_title` relêem o título; `sold_out`/`capacity_full`/`sales_closed`/`type_not_found`/`members_only` relêem o evento.
- **Compra do não sócio**: aviso "É sócio? Entre…" (ou, no atalho do sócio, "Voltar à compra de sócio"); dados de quem compra (nome, CPF, telefone, e-mail); um bloco por ingresso (tipo com o dia no rótulo, nome, CPF; "É para mim" copia os dados de quem compra); até `max_per_order`. No cliente: dígitos do CPF e CPF repetido (só em diárias de dias diferentes). Erros de campo do Laravel (`tickets.0.holder_cpf`) e `context.index`/`context.field` marcam o campo; `holder_is_member` → "o sócio compra pelo login de sócio"; `already_has_ticket` sem índice destaca o ingresso cujo CPF bate com o `context.cpf` mascarado. A mensagem de CPF repetido só cita passaporte se o evento tiver passaporte.
- **Pedido** (`TicketOrderView`, sócio e não sócio): selo + nº, evento, aviso por situação (`expired` → "Comprar de novo"; `withdrawn`; `cancelled` + `payment.refunded_amount`; `paid`), contador até `hold_until` (ao zerar relê o pedido; o botão Pagar continua enquanto a Lara disser `pending_payment`), resumo (preço por ingresso — lotes podem diferir —, "de R$ 80,00 por R$ 72,00", linha "Desconto (cupom X)", "Cortesia"), Pagar/Desistir (com confirmação), e pago: ingressos com QR (SVG da Lara sobre `--pad`, branco nos dois temas), código grande (`ING-…`), "Diária · Sáb 13/02"/"Passaporte · todos os dias", entradas registradas ("Entrou em Sáb 13/02, 21:14") e **Baixar PDF**. Passaporte com `status: "used"` antes do fim do evento (maior `ends_at` do evento e dos dias) mostra "Válido nos outros dias", não "Utilizado"; na diária e no evento sem dias, `used` é "Utilizado".
- **Meus ingressos** (sócio): cartões por pedido (evento, situação, nº de ingressos e pessoas, valor ou "Cortesia"). Busca. Sem login, a mesma URL é o "Meus ingressos" do não sócio (seção acima).
- **Perdi o link**: CPF + e-mail → sempre "Se houver pedido com esse CPF e e-mail, enviamos o link."

## Integração com o resto do app

- Navegação: item **Ingressos** no topo (desktop) e na folha "Menu" do celular; "Meus ingressos" no menu do usuário; porta **Ingressos** na página de boas-vindas ([header.tsx](../../app/components/Common/header.tsx), [public-home.tsx](../../app/components/Common/public-home.tsx)). A entrada do módulo trouxe a **nova barra inferior** do celular (Início · Menu · Perfil) — ver [11](11-ui-compartilhada.md).

## Pontos a confirmar com a Lara

- **Limites por IP** (`guest-orders` 10/min, `coupon-check` 20/min, `resend-link` 5/min, `my-title` 30/min, mapa 120/min): todas as chamadas chegam do mesmo IP (o servidor do site). O site põe limites por IP de quem chama na frente, mas, se a Lara contar só pelo IP da conexão, o limite dela vale para **todo mundo somado**. Combinar: a Lara confiar num header do site (`X-Forwarded-For`/`X-Real-IP`) ou liberar o IP do servidor.
- **Mapa × limite da Lara**: o mapa aberto relê a cada `refresh_after` (15 s → 4/min por pessoa). Se a Lara contar os 120/min pelo IP do servidor do site, cerca de 30 pessoas com o mapa aberto ao mesmo tempo já esgotam o limite de todos. Mesmo combinado do item acima.
- **Nome do lugar na tela**: o site escreve "<nome do tipo> <rótulo>" ("Mesa Vip V2"); o contrato não traz um nome pronto.
- **`payment_method`**: o contrato mostra `"credit"`; o site também oferece débito e manda `"debit"`. Confirmar se a Lara aceita.
- **Formato do `access_token`**: o site aceita até 512 caracteres `[A-Za-z0-9|._~+/=-]`. Token fora disso não é gravado (o pedido não paga pelo site, mas o link do e-mail chega).
- **`payment.refunded_amount`** é o único campo de `payment` usado; o resto do objeto não está no contrato.
- Envelopes: a normalização aceita lista pura, `{<chave>: [...]}` e `{data: [...]}`, e objetos puros ou em `event`/`order`/`coupon`/`data`.
