# 04 — Agendamento de quadras (home → esporte → quadra → carrinho)

## Arquivos

| Arquivo | Papel |
|---|---|
| [app/page.tsx](../../app/page.tsx) | Home `/`: lista esportes |
| [app/places/[placeName]/page.tsx](../../app/places/[placeName]/page.tsx) | `/places/<esporte>-<groupId>`: data + quadras do esporte |
| [app/place/[placeName]/page.tsx](../../app/place/[placeName]/page.tsx) | `/place/<quadra>-<placeId>?date=AAAA-MM-DD`: horários da quadra |
| [app/components/Schedules/schedule.tsx](../../app/components/Schedules/schedule.tsx) | Grade de horários, seleção e "Adicionar ao carrinho" |
| [app/components/Schedules/clock.tsx](../../app/components/Schedules/clock.tsx) | Relógio de expiração do carrinho (10 min) |
| [app/components/Schedules/booking-button.tsx](../../app/components/Schedules/booking-button.tsx) | Botão de ação / link |
| [context/CartContext.tsx](../../context/CartContext.tsx) | Estado global do carrinho |
| [app/components/Common/ItensGrid.tsx](../../app/components/Common/ItensGrid.tsx) | Grade de esportes (mobile) |
| [app/components/Common/sportive-square.tsx](../../app/components/Common/sportive-square.tsx) | Carrossel infinito de esportes (desktop) |
| [utils/uriGen.tsx](../../utils/uriGen.tsx) | `URIGen(nome, id, data)` → `/place/<slug>-<id>?date=...` |

Todas as páginas são **client components** protegidas pelo middleware.

## Convenção de URL (slug)

`<nome-em-minúsculas-com-hífens>-<id>`. O id é sempre o **último segmento após `-`** (`slug.split('-').pop()`).
Há três geradores ligeiramente diferentes: `name.replace(/\s+/g,'-').toLowerCase()` (home/places), `URIGen` (remove acentos e símbolos) e `placeSlug` em `utils/replay.ts`. Todos funcionam porque só o id importa.

## Home (`/`)

- `GET places/group` → objeto de grupos; converte `vertices` (string JSON ou array) em `{x,y}[]` (para o mapa, hoje desativado).
- Mostra só `category === "esportiva"`: `ItensGrid` no mobile, `SportiveSquare` no desktop. Link → `/places/<nome>-<id>`.
- **Espaços sociais no mesmo carrossel**: a home também chama `social/groups` e acrescenta, no fim da lista, um card por grupo social (imagem `image_vertical` → `image_horizontal` → `/images/default-card.png`), com selo "Espaço social" e link para `/espacos-sociais`. Falha nessa chamada é ignorada (carrossel só com esportes). Com grupos sociais, o título desktop vira "Áreas Esportivas e Sociais". `SportiveSquare`/`ItensGrid` aceitam `href` e `tag` opcionais por item (`CarouselItem`).
- `HomeLightingBanner` no topo (ver [08](08-luz-da-quadra.md)).
- Seções "Mapa" (`MapBanner`), "Social" e `MobileNavBar`, tutorial da home: **comentadas**. `NAV_OPTIONS` vazio.

## Esporte (`/places/[slug]`)

- `POST places/` com `{ group_id, member_id: session.user.id, date: selectedDate (ISO yyyy-mm-dd) }`.
  Resposta usada: `places` (objeto → array de `{id, name, image, available_slots, schedule_rules}`), `group` (`name`, `image_horizontal`, `maximum_antecedence`, `minimum_antecedence`), `limit` (`{limit, remaining}`).
- `limit = min(limit.limit, limit.remaining)`; se 0, todas as quadras ficam indisponíveis para o sócio.
- Antecedência máxima de navegação = `max(group.maximum_antecedence, group.minimum_antecedence)` dias.
- Faixa de datas: 8 dias (mobile) / 20 (desktop) em torno da data; setas avançam/voltam esse bloco com animação de 500 ms. Datas passadas ou além da antecedência ficam desabilitadas.
- Repolling a cada **30 s**.
- Card: badge "N Disponíveis / Esgotado / Indisponível"; link "Reservar Horário" → `/place/<nome>-<id>`.
  > **Atenção**: o link para `/place` **não carrega a data escolhida** (`?date=` não é passado aqui; `URIGen` passa no carrinho). A página da quadra usa `?date` só para o título; `Schedule` usa a data de hoje (ver [12](12-pontos-de-atencao.md)).

## Quadra (`/place/[slug]`)

- `GET place/{id}` → `{name, id, price, image, schedule_rules, schedule, place_group_id}`. Erro → toast + volta para `/`.
- Repolling a cada 150 s. Título "Agendamento para <data de ?date ou hoje>".
- Renderiza `<Schedule src price place_id rules />` + `TutorialOverlay` (passos: selecionar horário, adicionar, relógio, finalizar).

## `Schedule` — regras da grade

- `POST schedule/time-options` `{date, place_id, member_id}` → `data.options: LoadedContent[]` e `data.limit.remaining` (padrão 2 se ausente) → `localQuantity`.
- Classificação de cada slot (ordem de precedência):

| Condição | Rótulo | Estilo |
|---|---|---|
| `colided_member.id === eu` e status 1/2 sem `colided_description` | Confirmado | `myConfirmed` |
| `colided_member.id === eu` e status 1/2 **com** descrição | Indisponível | `reservedByOthers` |
| `colided_member.id === eu` e status 3 | No Carrinho | `inCart` |
| `colides` e `colided_member` (outro sócio) | Ocupado | `reservedByOthers` |
| `excluded_by_rule` | Indisponível | `reservedByOthers` |
| `localQuantity === 0` | Indisponível | `reservedByOthers` |
| senão | `R$ preço` | disponível |

- Clique em slot com `colided_description` → `toast.info(descrição)`.
- Seleção: só **horários consecutivos** (vizinho imediato do primeiro/último selecionado) e até o limite; os demais ficam `nonAdjacent`.
- **Adicionar**: `POST schedule` com
  `{ member_id, place_id, selected_slots: ["HH:MM - HH:MM", ...], price, status_id: '3', date }` (strings) → `refreshCart()` + recarrega a grade.
- Botão "Finalizar (Ir ao Carrinho)" aparece se o carrinho não está vazio → `/checkout`.
- Desktop mostra imagem + `Clock`; mobile mostra barra inferior com total.

## `CartContext` (carrinho)

O carrinho **não é local**: são os agendamentos do sócio com `status_id === 3` na Lara.

- `fetchCartData`: `GET schedule/member/{userId}/` → extrai o primeiro array encontrado (`data`, `pending` ou qualquer propriedade array) → filtra status `'3'` → normaliza:
  `id/place_id/price/status_id` numéricos; `start_schedule`/`end_schedule` via `normalizeToBrasilia` (assume UTC sem fuso e **subtrai 3 h**, formato `AAAA-MM-DD HH:MM:SS`); `created_at` ganha `T…Z`.
- Busca inicial uma vez quando a sessão fica disponível; rebusca ao entrar em `/profile`, `/checkout`, `/cart`.
- Redireciona `/checkout` → `/` quando o carrinho está vazio (exceto com `status=success` na URL).
- API exposta: `cart`, `isLoading`, `refreshCart()`, `clearCart()` (só local), `removeCartItem(id)` (otimista; `DELETE schedule/delete-pending {id}`; reverte em erro).
- `CartItem`: `{id, place_id, place:{id,name,icon,image,image_vertical}, start_schedule, end_schedule, price, status_id, created_at, ...}`.

## `Clock` — expiração do hold

- Pega o item **mais antigo** (`created_at`) e calcula `created_at + 10 min` (datas sem fuso recebem `-03:00`; `' '`→`'T'` para Safari).
- Atualiza a cada 1 s; ao zerar chama `refreshCart()` (a Lara já terá liberado o hold).
- Último minuto: pulso + toast fixo `cart-expiry-toast` atualizado a cada segundo.
- O prazo de 10 min é **convenção do front** espelhando a Lara; se a Lara mudar o hold, ajuste aqui.

## Componentes de vitrine

- `ItensGrid` (mobile): grade de 2 colunas com `image_vertical` → `/places/...` (ou `href` do item). Cada linha tem **240px fixos** (`grid-auto-rows`) — antes o bloco inteiro tinha 720px e cada card a mais encolhia todos. Com total ímpar, o último card ocupa a linha inteira.
- `SportiveSquare` (desktop): duplica a lista até ≥8 itens e de novo (×2) para animação CSS de carrossel infinito.
