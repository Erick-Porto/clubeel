# 07 — Replay (vídeos das quadras)

O sócio aperta um botão na quadra e o lance recente é gravado pela Lara. Cada vídeo fica **7 dias** e depois o arquivo é apagado (a regra mora na Lara). Contrato de referência: `docs/replay-api.md` **no repositório da Lara** (não neste).

## Arquivos

| Arquivo | Papel |
|---|---|
| [app/replay/page.tsx](../../app/replay/page.tsx) | `/replay` — esportes → quadras com vídeo (**pública**) |
| [app/replay/[placeName]/page.tsx](../../app/replay/[placeName]/page.tsx) | `/replay/<quadra>-<id>` — galeria paginada da quadra, filtro por data (**pública**) |
| [app/meus-videos/page.tsx](../../app/meus-videos/page.tsx) | `/meus-videos` — vídeos das reservas pagas do sócio (protegida) |
| [app/api/replay/media/[...path]/route.ts](../../app/api/replay/media/[...path]/route.ts) | Route Handler que faz stream do arquivo da Lara repassando `Range` |
| [services/replay-api.ts](../../services/replay-api.ts) | Cliente: `fetchReplayPlaces`, `fetchPlaceVideos`, `fetchMyVideos` + normalização |
| [utils/replay.ts](../../utils/replay.ts) | Formatação, agrupamento por esporte, foto do esporte, `resolveMediaUrl`, slug |
| [app/components/Replay/ReplaySportSection.tsx](../../app/components/Replay/ReplaySportSection.tsx) | Banda colapsável de um esporte (reusada pela Luz) |
| [app/components/Replay/ReplayVideoGrid.tsx](../../app/components/Replay/ReplayVideoGrid.tsx) / [ReplayVideoCard.tsx](../../app/components/Replay/ReplayVideoCard.tsx) | Grade e card de vídeo |
| [app/components/Replay/ReplayNotice.tsx](../../app/components/Replay/ReplayNotice.tsx) | Estado vazio/erro padronizado (reusado pela Luz) |

## Decisões de negócio (não "corrigir")

- **Galeria é pública**: `/replay` está fora do matcher do middleware e `replay/places*` é público no proxy. O replay é do jogo, em espaço coletivo.
- O selo **"Vídeo de reserva"** (`has_member`) diz só que houve reserva — a API **não** informa de quem, de propósito. Não tente inferir.
- A `url` do vídeo **nunca deve ser persistida** (vira 404 quando o arquivo expira).
- Todas as chamadas usam `skipAuthCheck: true`: um 401 não pode derrubar um visitante; em `/meus-videos` o 401 vira o estado "Sua sessão expirou" com botão de login (`/login?callbackUrl=%2Fmeus-videos`).
- `/meus-videos` é o destino do link enviado por e-mail: middleware → login com `callbackUrl` → volta direto.

## Serviço (`replay-api.ts`)

| Função | Endpoint | Retorno |
|---|---|---|
| `fetchReplayPlaces()` | `GET replay/places` | `ReplayPlace[]` (`id, name, place_group?, videos_count, last_recorded_at`) — **única fonte** da lista (só quadras com vídeo agora) |
| `fetchPlaceVideos(id, {date?, page?})` | `GET replay/places/{id}/videos?date=AAAA-MM-DD&page=N` (24/página) | `{videos, meta{current_page,last_page,per_page,total}, place{id,name,place_group}}` |
| `fetchMyVideos()` | `GET replay/my-videos` | `ReplayVideo[]` ordenado do mais recente |

`ReplayVideo`: `uuid, url, place{id,name}, place_group{id,name}, orientation ('horizontal'|'vertical'), duration_seconds, size_bytes, recorded_at, expires_at, days_left, has_member`.
Resultado: `{ok:true,data} | {ok:false,status,reason:'unauthorized'|'not_found'|'network'|'server',message}`.
A normalização é tolerante (procura a chave documentada, depois `data`, depois qualquer array) para não deixar tela em branco.

## Entrega do arquivo de vídeo

A Lara não é acessível pelo navegador, então `resolveMediaUrl(url, {download?})` decide:
- `NEXT_PUBLIC_REPLAY_MEDIA_MODE=direct` → usa a `url` da Lara como veio (exige vhost público só-leitura para `storage/replay/videos/`).
- **padrão `proxy`** → converte `…/storage/replay/videos/<AAAA/MM/uuid.mp4>` em `/api/replay/media/<AAAA/MM/uuid.mp4>` (`?download=1` para baixar).

Rota `app/api/replay/media/[...path]/route.ts` (GET/HEAD, `force-dynamic`, sem sessão):
- Segmentos só `[A-Za-z0-9._-]`, máx. 8, sem `.`/`..` → senão 400. Prefixo fixo `/storage/replay/videos/` (não é proxy genérico).
- Repassa `Range` e `If-Range`; devolve status (200/206) e headers `content-type/length/range, accept-ranges, last-modified, etag`; força `accept-ranges: bytes`.
- 404 da Lara → 404 "Vídeo expirado ou inexistente". Falha de rede → 502.
- `?download=1` → `Content-Disposition: attachment`. `Cache-Control: private, max-age=300`.

## Telas

- **`/replay`**: `groupPlacesBySport` agrupa por `place_group` (sem esporte → "Outras quadras", sempre por último), ordena por gravação mais recente. Todos os esportes começam **fechados**. Card de quadra → `/replay/<placeSlug>`.
- **`/replay/[slug]`**: banner com foto do esporte (`sportImage`), filtro de data (`max` = hoje), "Carregar mais" (append), proteção contra corrida de respostas (`requestRef`). Mostra o selo de reserva.
- **`/meus-videos`**: `groupVideosBySport`, aviso de quantos vídeos expiram em ≤ `REPLAY_URGENT_DAYS` (2) dias; card mostra o nome da quadra.
- **`ReplayVideoCard`**: `<video preload="none">` (até 24 por página — não baixar todos no 4G), poster com botão play; `onError` ou `isExpired` → "Este vídeo expirou"; proporção 9/16 ou 16/9 pela `orientation`; botão Baixar (mesma origem → attachment; outra origem → nova aba).

## Utilitários (`utils/replay.ts`)

`formatRecordedAt(Long)`, `formatRelative` ("há 2 h", "ontem"), `formatDuration` (segundos), `formatSize`, `formatDaysLeft`, `isUrgent`, `isExpired`, `aspectRatioFor`, `groupPlacesBySport`, `groupVideosBySport`, `sportImage(nome)` (casa nome do esporte sem acento com fotos de `public/images/carousel/`: beach, padel, tenis, futebol/futsal/society/campo, areia, volei — **paliativo** até a Lara mandar imagem do grupo), `resolveMediaUrl`, `toApiDate`, `placeSlug`, `placeIdFromSlug`.
