# 13 — Espaços sociais (`/espacos-sociais`)

Reserva de **churrasqueiras, salões e áreas de festa**. Diferente das quadras:

- **Unidade = dia inteiro** (sem grade de horários).
- **Pré-reserva → análise → pagamento.** O sócio envia data, dados do evento, convidados extras e bebidas; a data fica presa enquanto a secretaria analisa (contrato fora do sistema). Aprovada, a reserva mostra o valor final (com eventual desconto) e um **prazo para pagar** (`payment_due_at`). Paga → confirmada. Prazo vencido → expira e a data volta a ficar livre.
- **Convidados não sócios**: o espaço inclui `max_guests` no preço e vende até `extra_guests` a mais. A lista nominal (nome + CPF) vai até `guest_limit` (= `max_guests` + extras contratados). Sócios não entram na lista.
- **Editar a pré-reserva** é possível enquanto `can_edit` (só em `requested` e antes de a secretaria marcar o contrato como ok). Data e espaço não mudam — para isso o sócio desiste e faz outra.
- Cancelamento de reserva **paga** é só com a secretaria (estorno decidido por ela). Pelo site, só se desiste **antes de pagar**.

**Princípio do módulo**: o front não decide nada. Disponibilidade, preço, desconto, prazo, limite e capacidade vêm da Lara (API em `api/social/*`, branch `espacos-sociais` do Lara). Botões aparecem pelos booleanos `can_edit`, `can_pay`, `can_cancel`, `can_edit_guests` — nunca deduzidos do `stage`. Recusas são tratadas pelo **`reason`** (código estável) — nunca pelo texto. Depois de cada ação a reserva é **relida**.

## Arquivos

| Arquivo | Papel |
|---|---|
| [app/espacos-sociais/page.tsx](../../app/espacos-sociais/page.tsx) | Vitrine: grupos + espaços de cada grupo, regras do grupo |
| [app/espacos-sociais/[grupo]/[espaco]/page.tsx](../../app/espacos-sociais/[grupo]/[espaco]/page.tsx) | Espaço: ficha, limites, calendário do mês, pré-reserva |
| [app/espacos-sociais/reservas/page.tsx](../../app/espacos-sociais/reservas/page.tsx) | "Minhas reservas sociais" |
| [app/espacos-sociais/reservas/[id]/page.tsx](../../app/espacos-sociais/reservas/[id]/page.tsx) | Detalhe: valores, pagar, convidados, desistir |
| [services/social-api.ts](../../services/social-api.ts) | Contratos, normalização e chamadas (via proxy) |
| [utils/social.ts](../../utils/social.ts) | Formatação (BRL, dias, prazos no fuso do clube, CPF), estimativa, títulos por `reason` (+ orientação de falar com a secretaria em `contract_closed`/`invalid_stage`), slugs |
| [app/components/Social/](../../app/components/Social/) | `SocialCalendar`, `SocialBookingForm`, `SocialGuestsEditor`, `SocialPlaceFacts`, `SocialStageBadge`, `SocialFlashBox`, `QuantityStepper` |
| [styles/social.module.css](../../styles/social.module.css) | Estilos próprios; reaproveita `replay.module.css` (seção, botões, `ReplayNotice`) e o flash de `lighting.module.css` |

URLs: `/espacos-sociais/<grupo>-<groupId>/<espaco>-<placeId>` (só o id importa, como nas quadras) e `/espacos-sociais/reservas/<bookingId>`. Todas no `matcher` do middleware.

## Endpoints (todos autenticados no proxy; nenhum recebe id/CPF de sócio)

| Função | Endpoint |
|---|---|
| `fetchSocialGroups` | `GET social/groups` |
| `fetchSocialGroupPlaces(id)` | `GET social/groups/{id}/places` |
| `fetchSocialCalendar(placeId, 'AAAA-MM')` | `GET social/availability?place_id=&month=` |
| `fetchSocialBeverages` | `GET social/beverages` |
| `fetchSocialLimits(groupId)` | `GET social/limits?place_group_id=` |
| `createSocialBooking` | `POST social/bookings` |
| `updateSocialBooking(id, update)` | `PUT social/bookings/{id}` (edição da pré-reserva; throttle 30/min na Lara) |
| `fetchSocialBookings` / `fetchSocialBooking(id)` | `GET social/bookings[/{id}]` |
| `replaceSocialGuests(id, guests)` | `PUT social/bookings/{id}/guests` (lista inteira) |
| `cancelSocialBooking(id)` | `DELETE social/bookings/{id}` |

As rotas de quadra (`places/group`, `places`, `schedule/time-options`, `POST schedule`) **não** listam nem aceitam espaço social.

A normalização aceita lista pura, `{<chave>: [...]}` ou `{data: [...]}`, e reserva pura ou envelopada em `booking`/`data`. O catálogo de bebidas aceita preço em `price` ou `unit_price` (o formato de `GET social/beverages` não estava no contrato — confirmar com a Lara).

Falha: `{ok:false, status, kind: 'rule'|'validation'|'throttled'|'unauthorized'|'network'|'server', reason, error, context, fieldErrors}`.

## Telas

### Vitrine
`social/groups` → para cada grupo, `social/groups/{id}/places` em paralelo. Grupo sem espaço não aparece. Card: foto, diária, capacidade, convidados incluídos, extras (quantidade e preço), `amenities` (itens fornecidos), `description` (observações/restrições, destacado), regras do grupo em `<details>` (texto como veio, `pre-line`).

### Espaço
- Carrega em paralelo: espaços do grupo (acha o espaço pelo id), lista de grupos (só para `maximum_antecedence` e imagem), limites e bebidas.
- **Calendário**: mês a mês, dia pintado pelo `status` da Lara (`available`, `reserved`, `blocked`, `out_of_window`; desconhecido = indisponível). Só `available` é clicável. As setas vão do mês atual (fuso do clube) até hoje + `maximum_antecedence` dias (sem esse dado, 12 meses) — é só limite de navegação; dentro do mês, quem diz o que está fora da janela é a Lara. Respostas de um mês já abandonado são descartadas.
- **Limites**: aviso (`active` restante, `window` "N a cada D dias"). Com `remaining = 0` o aviso fica em destaque, mas o formulário continua — **quem decide é o POST**.
- **Pré-reserva** (`SocialBookingForm`): tipo de evento, número de pessoas (dica `≤ capacity`), observações, extras (0..`extra_guests`), bebidas (quantidade e subtotal), convidados opcionais (até `max_guests` + extras escolhidos), **resumo estimado** com preços do catálogo atual e o aviso "A reserva só é confirmada após análise da secretaria e pagamento". Linhas de convidado totalmente vazias não são enviadas (um mapa de índices mantém o `context.index` apontando a linha certa). O formulário, uma vez aberto, não desmonta: se a data for recusada, o sócio escolhe outra sem perder o preenchido.
- Recusa do POST → flash (título por `reason`, texto da Lara) e releitura: `date_unavailable`/`date_blocked`/`out_of_window` → limpa a data e relê o calendário; `limit_reached` → relê limites; `beverage_unavailable` → relê bebidas; `place_not_social` → relê o espaço; `invalid_guest` → destaca a linha. Sucesso → `/espacos-sociais/reservas/{id}`.

### Minhas reservas
Lista na ordem da Lara (futuras primeiro), com selo do estágio (`stage_label`; cor por `stage`), total e prazo de pagamento quando `awaiting_payment`.

### Detalhe
- Estágio + frase do contrato; `refusal_reason`/`cancel_reason` quando houver.
- **Valores**: diária, extras, bebidas, desconto, total — sempre os da reserva (preços congelados), nunca do catálogo. O total exibido é o `total` da Lara (não soma no front).
- **Editar pré-reserva** (`can_edit`): ao clicar, lê o espaço (`social/groups/{grupo}/places`, para o máximo de extras, incluídos e capacidade) e o catálogo de bebidas, e troca o corpo da tela pelo `SocialBookingForm` em modo `editing`, preenchido com a reserva:
  - Data e espaço só para leitura (o PUT não os envia).
  - Todos os campos vão no PUT; vazio vira `null` (limpa). `items` vai **sempre inteiro** (`[]` tira todas as bebidas).
  - Bebidas: catálogo atual, mas as já contratadas aparecem com o **preço contratado** e continuam na lista mesmo se saíram do catálogo (senão sumiriam ao mandar a lista inteira). A estimativa usa diária e preço do extra **da reserva**.
  - Convidados: só vão no PUT se o sócio abrir "Alterar lista também" (campo ausente = lista mantida); abertos, valem como lista inteira e os CPFs precisam ser redigitados (vêm mascarados). Se os extras baixarem para menos que a lista atual, a tela avisa que a lista menor tem de ir na mesma chamada (senão `over_capacity`).
  - Sucesso → a tela volta ao detalhe **com a reserva da resposta** (recalculada), sem nova leitura.
  - `contract_closed` / `invalid_stage` / `not_owner` → fecha a edição, mostra a mensagem com orientação para falar com a secretaria e relê a reserva (`can_edit` virá `false`). `beverage_unavailable` → relê o catálogo e mantém o formulário. Demais recusas → aviso, formulário aberto.
- **Pagar** (`can_pay`): abre o `CheckoutPayment` no modo `socialBookingId` (ver [05](05-checkout-pagamento.md)). Sucesso → toast + releitura (passa a `confirmed`). Recusa com `reason` (ex.: `payment_mismatch`) → flash + releitura.
- **Convidados** (`can_edit_guests`): editor com teto `guest_limit`. A Lara devolve CPFs **mascarados** e o PUT substitui a lista inteira, então o sócio **redigita os CPFs** ao editar (o mascarado aparece como dica). `guests_locked` → fecha o editor e orienta falar com a secretaria.
- **Desistir** (`can_cancel`): confirmação embutida na tela → `DELETE` → releitura.
- `confirmed`: aviso de que cancelar reserva paga é com a secretaria (WhatsApp).

## Integração com o resto do app

- Menu do usuário ([header.tsx](../../app/components/Common/header.tsx)): "Espaços Sociais" e "Minhas Reservas Sociais".
- Perfil, aba Agendamentos ([appointments.tsx](../../app/components/Profile/appointments.tsx)): bloco "Espaços Sociais" com atalhos.
- Home: cada grupo social vira um card (selo "Espaço social") no fim do carrossel de esportes, levando à vitrine — ver [04](04-agendamento-quadras.md). A antiga seção "Áreas Sociais" (baseada em `places/group` categoria `social`) continua comentada.
