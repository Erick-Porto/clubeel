# 08 — Luz da quadra (`/luz`)

No **uso livre** (fins de semana, feriados — quando não há reserva), o sócio acende a luz de uma quadra pelo celular por um tempo limitado (até ~2 h). Acender **não reserva** a quadra. Um sócio só pode ter **um** acionamento vigente; a luz de uma quadra vai até o maior prazo entre todos os sócios que a acionaram (`lit_until`).

**Princípio do módulo**: o front não decide nada. Janela de horário, feriado, teto de duração, quadra livre/reservada — tudo vem da Lara. Comportamento em recusa é escolhido pelo **`reason`** (código estável) e o texto exibido é o **`error`** da Lara. **Nunca compare mensagens.** Nunca monte o estado "aceso" a partir da resposta do POST — sempre releia a disponibilidade.

## Arquivos

| Arquivo | Papel |
|---|---|
| [app/luz/page.tsx](../../app/luz/page.tsx) | Página; escolhe o estado, executa ações, trata recusas |
| [app/hooks/useLightingAvailability.tsx](../../app/hooks/useLightingAvailability.tsx) | Estado lido do servidor + relógio do servidor + políticas de releitura |
| [services/lighting-api.ts](../../services/lighting-api.ts) | Contratos, normalização e chamadas |
| [utils/lighting.ts](../../utils/lighting.ts) | Formatação no fuso `America/Sao_Paulo`, opções de duração |
| [app/components/Lighting/LightingClosed.tsx](../../app/components/Lighting/LightingClosed.tsx) | Estado 1 — fechado |
| [app/components/Lighting/LightingPicker.tsx](../../app/components/Lighting/LightingPicker.tsx) | Estado 2 — esporte → quadra → tempo |
| [app/components/Lighting/LightingActivePanel.tsx](../../app/components/Lighting/LightingActivePanel.tsx) | Estado 3 — acesa (contador, prolongar, devolver) |
| [app/components/Lighting/DurationStepper.tsx](../../app/components/Lighting/DurationStepper.tsx) | Seletor −/+ e hook `useDurationChoice` |
| [app/components/Lighting/HomeLightingBanner.tsx](../../app/components/Lighting/HomeLightingBanner.tsx) | Banner na home (só se há quadra aberta ou luz acesa) |
| [app/components/Lighting/LightingStatusCard.tsx](../../app/components/Lighting/LightingStatusCard.tsx) | Card no perfil (só com luz acesa) |

Usa também `ReplayNotice` e `ReplaySportSection` (do módulo Replay) e estilos de `replay.module.css`/`places.module.css`.

## Endpoints (todos autenticados no proxy; nenhum recebe id de sócio — o dono é o `Session`)

| Função | Endpoint | Observação |
|---|---|---|
| `fetchAvailability()` | `GET lighting/availability` | Endpoint principal |
| `fetchGroups()` | `GET lighting/groups` | Só grupos com ≥1 quadra liberada; vazio é estado, não erro |
| `fetchGroupPlaces(groupId)` | `GET lighting/groups/{id}/places` | Estado de cada quadra |
| `fetchActivationPlace(activation, groupHint)` | groups + places | Acha a quadra do acionamento (grupo localizado **pelo nome** `place_group`) para saber o `available_minutes` do "Prolongar" |
| `activatePlace(placeId, minutes)` | `POST lighting/places/{id}/activate {minutes}` | Acender **ou** prolongar: 201 = novo, 200 = `extended:true` (prolongou o próprio). A Lara pode conceder menos que o pedido |
| `releaseActivation()` | `POST lighting/release` | Devolve a quadra (encerra o acionamento do sócio) |
| — | `lighting/activations` | Liberado no proxy, não usado pelo front |

## Contratos principais

- `LightingAvailability`: `now` (ISO do servidor), `open` (**agregado**: alguma quadra aberta), `next_window` (primeira janela a abrir entre todas), `club_window` (só para frase/feriado), `max_minutes`, `min_minutes`, `step_minutes`, `activation | null`.
- `LightingActivation`: `id, place_id, place_name, place_group (nome), starts_at, ends_at` (do sócio), `minutes_remaining`, `lit_until` (da **quadra**, é o número da tela), `released_at`.
- `LightingPlace`: `id, name, image, open` (desta quadra), `window`, `next_window`, `available_minutes` (teto aparado na janela desta quadra), `lit`, `lit_until`. Quadra fechada **aparece desabilitada**, não some. Quadra acesa **não é indisponível** (acionar = prolongar).
- `LightingWindow`: `date, start, end, starts_at, ends_at, source ('weekly'|'date'), reason` (nome do feriado quando `source==='date'`).
- Falha: `{ok:false, status, kind: 'rule'|'validation'|'throttled'|'unauthorized'|'network'|'server', reason, error, extras}`.
  `reason` documentados: `window_closed`, `window_ending`, `member_limit`, `place_reserved` (extras `reserved_from/until`), `place_not_eligible`, `no_activation`. Extras podem trazer `next_window` (da quadra recusada).

## Máquina de estados da página

```
status === 'loading'        → LoadingScreen
loading                     → Loading
!data                       → ReplayNotice "Não conseguimos falar com o clube" + Tentar novamente
data.activation             → LightingActivePanel   (estado 3)
data.open                   → LightingPicker        (estado 2)
senão                       → LightingClosed        (estado 1)
```
- `flash`: aviso fechável (tom neutro ou alerta) gerado pelas recusas.
- `busy` (ref) + `pending` (state): trava contra duplo toque → nunca dois POSTs.
- Tratamento de recusa: `unauthorized` → nada (interceptor já levou ao login); `throttled` → toast warning; `network` → toast error; `server` → toast (se <500) + reload; `validation` → flash alerta + reload; `rule` → flash por `reason` + reload (`no_activation` relê em silêncio).
- Sucesso: toast com a duração **concedida** (`activation.minutes_remaining`), depois `reload()`. No "devolver", se `lit_until` ainda está no futuro avisa que outro sócio mantém a luz.

## `useLightingAvailability`

- Releituras: ao montar; ao voltar a aba visível; a cada **45 s** enquanto há acionamento **ou** `open` (aba visível); num `setTimeout` para o próximo prazo anunciado pela resposta (`ends_at`, `lit_until`, `next_window.starts_at`) + 1,5 s de folga (máx. 6 h); e via `reload()` após ações.
- Requisições simultâneas são deduplicadas (`inFlight`).
- `serverNow` = relógio local + offset calculado a partir de `now` (não depende do relógio do celular). Com acionamento, tique a cada 1 s.
- 401 não vira estado de erro (o interceptor do `API_CONSUME` cuida).
- **Cada componente que usa o hook faz sua própria leitura** (home banner, card do perfil, página) — não há cache compartilhado.

## Picker e duração

- Passo 1 esporte (`fetchGroups`), passo 2 quadra (`fetchGroupPlaces`, relido a cada mudança de `availability.now`), passo 3 tempo.
- `durationOptions(min, step, max)`: de `min` em passos de `step` até `max` (= `available_minutes` da quadra); se `max` não cai num passo, entra como última opção ("até o fechamento"). `useDurationChoice` começa no maior e prende ao novo teto quando as opções encolhem.
- Em recusa, o picker reage: `window_closed/ending` → relê a quadra; `place_reserved` → desseleciona e relê; `place_not_eligible` → reseta tudo e relê grupos.
- `expectedLitUntil` é só **previsão** para o texto da dica; o valor real vem na resposta.
- Painel "acesa": número grande = `lit_until` (não `ends_at`); se `lit_until − ends_at > 60 s` mostra "outro sócio prolongou". Sem a quadra encontrada na lista, o "Prolongar" usa `max_minutes` como teto.

## Formatação (`utils/lighting.ts`)

Tudo exibido no fuso do **clube** (`America/Sao_Paulo`), não do aparelho: `formatClock`, `formatDay`, `isWindowToday` ("hoje" = data do `now` da Lara), `describeWindow`, `describeOpening`, `windowOccasion`, `formatDuration` (minutos), `formatCountdown`, `durationOptions`, `placeImageUrl` (aceita só http(s)/`//`/`/`).
