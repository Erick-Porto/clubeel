# 13 — Espaços sociais (`/espacos-sociais`)

Reserva de **churrasqueiras, salões e áreas de festa**. Diferente das quadras:

- **Unidade = dia.** O espaço fica com o sócio o dia inteiro. Alguns espaços têm **duração fixa** (`event_duration_hours`): nesses, o sócio informa o **horário de início** (obrigatório, dentro de `event_earliest_start`..`event_latest_start`) e o fim é calculado pela Lara (pode passar da meia-noite). O horário não muda a disponibilidade do calendário.
- **Pré-reserva → contato → análise → pagamento.** O sócio envia data, horário (se houver), dados do evento, convidados extras, **bebidas** e **mesas/cadeiras adicionais**; a data fica presa. A secretaria tem **2 dias úteis** para entrar em contato, faz o contrato fora do sistema e aprova (com eventual desconto) ou recusa. Aprovada, a reserva mostra o valor final e um **prazo para pagar** (`payment_due_at`). Paga → confirmada. Prazo vencido → expira.
- **Mesas e cadeiras**: cada espaço inclui `base_tables`/`base_chairs`; o sócio contrata mais (mesa avulsa, cadeira avulsa, jogo completo) do catálogo `GET social/furniture`. Oficiais: `tables_total`/`chairs_total` da reserva.
- **Convidados não sócios**: o espaço inclui `max_guests` no preço e vende até `extra_guests` a mais. A lista nominal (nome + CPF) vai até `guest_limit` (= `max_guests` + extras contratados). Sócios não entram na lista.
- **Reserva feita pela secretaria** (`origin: "secretaria"`): reservada no balcão em nome do sócio, aparece na lista dele e pode **começar** em `awaiting_payment` (o sócio paga pelo site) ou `confirmed`. A tela nunca supõe que a reserva passou por `requested`.
- **Baixa manual**: o sócio pode pagar na secretaria (dinheiro, Pix ao clube, maquininha, transferência); a equipe marca como pago na Lara e a reserva fica `confirmed` com `payment.manual: true`, sem passar pelo pagamento do site. Vale também para quadras (ver [05](05-checkout-pagamento.md)).
- **Editar a pré-reserva** enquanto `can_edit` (só em `requested` e antes de a secretaria marcar o contrato como ok). Data e espaço não mudam — para isso o sócio desiste e faz outra.
- Cancelamento de reserva **paga** é só com a secretaria (estorno decidido por ela). Pelo site, só se desiste **antes de pagar**.

**Princípio do módulo**: o front não decide nada. Disponibilidade, preço, desconto, prazo, limite, capacidade, horário de término e mesas/cadeiras vêm da Lara (API em `api/social/*`, branch `espacos-sociais` do Lara). Botões aparecem pelos booleanos `can_edit`, `can_pay`, `can_cancel`, `can_edit_guests` — nunca deduzidos do `stage`. Recusas são tratadas pelo **`reason`** (código estável) — nunca pelo texto. Depois de cada ação a reserva é **relida**. Estimativas (valor, fim do evento, mesas/cadeiras) aparecem marcadas como tal.

## Arquivos

| Arquivo | Papel |
|---|---|
| [app/espacos-sociais/page.tsx](../../app/espacos-sociais/page.tsx) | Vitrine: grupos + espaços de cada grupo, regras do grupo |
| [app/espacos-sociais/[grupo]/[espaco]/page.tsx](../../app/espacos-sociais/[grupo]/[espaco]/page.tsx) | Espaço: ficha, limites, calendário do mês, pré-reserva |
| [app/espacos-sociais/reservas/page.tsx](../../app/espacos-sociais/reservas/page.tsx) | "Minhas reservas sociais" (site + secretaria) |
| [app/espacos-sociais/reservas/[id]/page.tsx](../../app/espacos-sociais/reservas/[id]/page.tsx) | Detalhe: horário, mesas, valores, pagamento, convidados, editar, desistir |
| [services/social-api.ts](../../services/social-api.ts) | Contratos, normalização e chamadas (via proxy) |
| [utils/social.ts](../../utils/social.ts) | Formatação (BRL, dias, prazos no fuso do clube, CPF, horários, mesas/cadeiras), estimativas (valor, fim do evento, mesas/cadeiras), títulos por `reason` (+ frases com o `context` de `item_limit`/`invalid_time`; orientação de falar com a secretaria em `contract_closed`/`invalid_stage`), `CONTACT_NOTICE`, slugs |
| [app/components/Social/](../../app/components/Social/) | `SocialCalendar`, `SocialBookingForm`, `SocialGuestsEditor`, `SocialPlaceFacts`, `SocialStageBadge`, `SocialFlashBox`, `QuantityStepper`, `SocialPendingPaymentBanner` |
| [styles/social.module.css](../../styles/social.module.css) | Estilos próprios; reaproveita `replay.module.css` (seção, botões, `ReplayNotice`) e o flash de `lighting.module.css` |

URLs: `/espacos-sociais/<grupo>-<groupId>/<espaco>-<placeId>` (só o id importa, como nas quadras) e `/espacos-sociais/reservas/<bookingId>`. Todas no `matcher` do middleware.

## Endpoints (todos autenticados no proxy; nenhum recebe id/CPF de sócio)

| Função | Endpoint |
|---|---|
| `fetchSocialGroups` | `GET social/groups` |
| `fetchSocialGroupPlaces(id)` | `GET social/groups/{id}/places` |
| `fetchSocialCalendar(placeId, 'AAAA-MM')` | `GET social/availability?place_id=&month=` |
| `fetchSocialBeverages` / `fetchSocialFurniture` / `fetchSocialCatalog` | `GET social/beverages`, `GET social/furniture` (os dois juntos; catálogo que falhar volta vazio) |
| `fetchSocialLimits(groupId)` | `GET social/limits?place_group_id=` |
| `createSocialBooking` | `POST social/bookings` |
| `updateSocialBooking(id, update)` | `PUT social/bookings/{id}` (edição da pré-reserva; throttle 30/min na Lara) |
| `fetchSocialBookings` / `fetchSocialBooking(id)` | `GET social/bookings[/{id}]` |
| `replaceSocialGuests(id, guests)` | `PUT social/bookings/{id}/guests` (lista inteira) |
| `cancelSocialBooking(id)` | `DELETE social/bookings/{id}` |

As rotas de quadra (`places/group`, `places`, `schedule/time-options`, `POST schedule`) **não** listam nem aceitam espaço social.

Contratos principais (ver `services/social-api.ts`):
- `SocialPlace`: `price`, `capacity`, `max_guests`, `extra_guests`, `extra_guest_price`, `base_tables`, `base_chairs`, `event_duration_hours` (`null` = sem horário), `event_earliest_start`/`event_latest_start` (`null` = sem limite).
- `SocialCatalogItem` (bebida ou mobiliário): `id`, `category` (`bebida`/`mobiliario`), `price`, `tables_per_unit`, `chairs_per_unit`, `max_quantity` (`null` = sem limite). Bebidas e mobiliário vão **no mesmo `items`** do pedido, com **`item_id`** (`beverage_id` é o nome antigo, só lido como fallback).
- `SocialBooking`: além de valores e estágio, `origin`, `start_time`/`end_time`/`duration_hours`/`ends_next_day`, `base_tables`/`base_chairs`/`tables_total`/`chairs_total`, `items[]` com `category`, `payment` (`paid_amount`, `paid_at`, `method`, `method_label`, `manual`, `refunded_amount`) e os `can_*`.

A normalização aceita lista pura, `{<chave>: [...]}` ou `{data: [...]}`, e reserva pura ou envelopada em `booking`/`data`.

Falha: `{ok:false, status, kind: 'rule'|'validation'|'throttled'|'unauthorized'|'network'|'server', reason, error, context, fieldErrors}`. `reason` tratados: `place_not_social`, `date_unavailable`, `date_blocked`, `out_of_window`, `limit_reached`, `over_capacity`, `beverage_unavailable` (item fora do catálogo), `item_limit` (`context.item_id`, `context.max_quantity`), `invalid_time` (`context.earliest_start`/`latest_start`/`duration_hours`), `invalid_guest` (`context.index`), `guests_locked`, `invalid_stage`, `contract_closed`, `payment_mismatch`, `not_owner` — e `already_paid`, que é **código do nosso servidor** (não da Lara) para o "já pago".

## Telas

Visual v4 ([14](14-identidade-visual.md)): capa do módulo `social` com abas **Espaços** / **Minhas reservas** em todas as telas. Vitrine e "Minhas reservas" têm **busca** na página. Selo de estágio (`SocialStageBadge` → `Pill`): `requested` e `awaiting_payment` em tom de atenção (relógio / cartão), `confirmed` ok, `refused` e `cancelled` em tom de erro (`stageTone` devolve `danger`), demais neutros — o texto continua sendo o `stage_label` da Lara. No celular, o calendário vem antes da ficha e a barra "Total estimado + Enviar pré-reserva" acompanha a rolagem do formulário.

### Vitrine
`social/groups` → para cada grupo, `social/groups/{id}/places` em paralelo. Grupo sem espaço não aparece. Card (`SocialPlaceFacts`): foto, diária, capacidade, convidados incluídos, extras, "Inclui X mesas e Y cadeiras", "Evento de N horas · início entre A e B" (quando há duração), `amenities`, `description` (destacado), regras do grupo em `<details>`.

### Espaço
- Carrega em paralelo: espaços do grupo, lista de grupos (só `maximum_antecedence` e imagem), limites e os dois catálogos.
- **Calendário**: dia pintado pelo `status` da Lara; só `available` é clicável. As setas vão do mês atual (fuso do clube) até hoje + `maximum_antecedence` dias — só navegação; quem diz o que está fora da janela é a Lara.
- **Limites**: aviso; com `remaining = 0` fica em destaque, mas o formulário continua — **quem decide é o POST**.
- **Pré-reserva** (`SocialBookingForm`):
  - **Horário de início** (`<input type="time" required>`, com `min`/`max` da faixa) só quando o espaço tem duração; ao lado, o fim **estimado** ("termina às 02:00, dia seguinte").
  - Tipo de evento, número de pessoas (dica `≤ capacity`), observações, extras (0..`extra_guests`).
  - **Bebidas** e, em seção separada, **Mesas e cadeiras adicionais** (lembra o que o espaço já inclui): quantidade de 0 até `max_quantity`, subtotal, "N mesas e M cadeiras por unidade".
  - Convidados opcionais (até `max_guests` + extras escolhidos).
  - **Resumo estimado**: diária, extras, bebidas, mesas e cadeiras, total; e "mesas e cadeiras no total (estimado)" = base + Σ quantidade × por unidade. Aviso "A reserva só é confirmada após análise da secretaria e pagamento" + contato em até 2 dias úteis.
  - Linhas de convidado vazias não vão (mapa de índices mantém o `context.index`). O formulário, uma vez aberto, não desmonta se a data for recusada.
- Recusa do POST → flash (título por `reason`, texto da Lara + frase do `context`) e releitura: datas → limpa a data e relê o calendário; `limit_reached` → relê limites; `beverage_unavailable`/`item_limit` → relê os catálogos (e `item_limit` destaca o item); `invalid_time` → destaca o horário; `place_not_social` → relê o espaço; `invalid_guest` → destaca a linha.
- Sucesso → toast com o aviso de contato em até 2 dias úteis e vai para `/espacos-sociais/reservas/{id}`.

### Minhas reservas
Lista na ordem da Lara (futuras primeiro), **inclusive as da secretaria** (selo "Feita pela secretaria"), com estágio, horário, total e prazo de pagamento quando `awaiting_payment`.

### Detalhe
- Estágio + frase do contrato; selo "Feita pela secretaria"; em `requested`, o aviso do contato em até 2 dias úteis; `refusal_reason`/`cancel_reason`.
- **Evento**: horário ("20:00 às 02:00 (dia seguinte)", duração), tipo, pessoas, **mesas e cadeiras** (`tables_total`/`chairs_total`), observações.
- **Valores**: diária, extras, itens **separados por `category`** (Bebidas / Mesas e cadeiras adicionais), desconto, total — sempre os da reserva (preços congelados). O total é o `total` da Lara.
- **Pagamento registrado** (`payment`): valor, `method_label`, data; com `payment.manual`, "Pagamento registrado pela secretaria"; estorno se houver.
- **Editar pré-reserva** (`can_edit`): lê o espaço e os dois catálogos e troca o corpo pela edição (`SocialBookingForm` em modo `editing`): data e espaço só leitura; horário editável (quando há duração); todos os campos vão no PUT (vazio = `null`); `items` sempre inteiro (bebidas + mobiliário; `[]` tira todos); itens contratados com **preço contratado** e mantidos mesmo fora do catálogo; base de mesas/cadeiras, diária e preço do extra **da reserva**; convidados só se o sócio abrir o editor (CPFs redigitados). Sucesso → volta com a reserva da resposta. `contract_closed`/`invalid_stage`/`not_owner` → fecha, avisa (orienta a secretaria) e relê. `beverage_unavailable`/`item_limit` → relê os catálogos.
- **Pagar** (`can_pay`): **relê a reserva antes de abrir o checkout** — se a secretaria deu baixa, `can_pay` vem `false` e nada é cobrado. Abre o `CheckoutPayment` no modo `socialBookingId` (ver [05](05-checkout-pagamento.md)). Sucesso → toast + releitura. Recusa com `reason` → flash + releitura; `already_paid` → flash explicando que nada foi cobrado de novo (ou foi estornado) + releitura (virá `confirmed`).
- **Convidados** (`can_edit_guests`): editor com teto `guest_limit`; CPFs redigitados (vêm mascarados). `guests_locked` → fecha e orienta a secretaria.
- **Desistir** (`can_cancel`): confirmação embutida → `DELETE` → releitura.
- `confirmed`: aviso de que cancelar reserva paga é com a secretaria (WhatsApp).

## Integração com o resto do app

- Menu do usuário ([header.tsx](../../app/components/Common/header.tsx)): "Espaços Sociais" e "Minhas Reservas Sociais".
- **Perfil** ([profile/page.tsx](../../app/profile/page.tsx)): `SocialPendingPaymentBanner` no topo do conteúdo, em qualquer aba — "Você tem uma reserva aguardando pagamento até …" para cada reserva com `can_pay` (é assim que o sócio descobre a reserva aprovada no balcão). Some se não houver nada ou se a leitura falhar. Aba Agendamentos: bloco "Espaços Sociais" com atalhos.
- Home: aba **Espaços sociais** (ao lado de Esportes), com um cartão por grupo social e link para a vitrine; `/?area=social` abre direto nela — ver [04](04-agendamento-quadras.md).
