# 03 — Acesso à Lara (API_CONSUME + proxy) e segurança de borda

## `API_CONSUME` — [services/api-consume.ts](../../services/api-consume.ts)

Cliente HTTP único para a Lara, **isomórfico**:

```ts
API_CONSUME<T>(method, endpoint, headers = {}, body = null, options = { skipAuthCheck?: boolean })
  → Promise<{ data: T | null; status: number; ok: boolean; message?: string }>
```

| | No servidor (`typeof window === 'undefined'`) | No cliente |
|---|---|---|
| Base URL | `${INTERNAL_LARA_API_URL}/api` | `/api/backend` (proxy) |
| `Authorization` | `Bearer INTERNAL_LARA_API_TOKEN` se não vier um | não envia (o proxy põe) |
| 401/403 | só retorna | **toast + `signOut('/login')`** (exceto `skipAuthCheck`) |
| ≥500 | `console.error` | `toast.error("Erro no Servidor (status)")` |
| Falha de rede | retorna `{status: 503, ok:false, message:"Falha de conexão com a API."}` | idem |

- Corpo sempre JSON (`JSON.stringify(body)`), `cache: 'no-store'`. Resposta é lida como texto e parseada se possível; `message` = `data.message || data.error`.
- Endpoint aceita com ou sem `/` inicial.
- Importa `next-auth/react` e `react-toastify` — por isso **não deve ser usado em Server Components/Actions** (a área `/aprovacao` tem seu próprio cliente). Rotas `pages/api` usam no servidor sem problema.
- Passar `{ Session: token }` em `headers` é redundante no cliente (o proxy recria os headers), mas é usado no servidor (`success.ts`).

## Proxy — [pages/api/backend/[...path].ts](../../pages/api/backend/[...path].ts)

Pipeline de cada requisição `/<método> /api/backend/<path>?<query>`:

1. **Path traversal**: segmento vazio, `.`, `..`, contendo `..`, `/` ou `\` → **400**.
2. **Allowlist** (regex sobre `path` unido por `/`): fora de `PUBLIC_ENDPOINTS` ∪ `AUTHENTICATED_ENDPOINTS` → **403**.
3. `getServerSession` → endpoint autenticado sem `accessToken` → **401**.
4. `guardRequest` (anti-injeção em body e query) → **400**.
5. Repassa para `${INTERNAL_LARA_API_URL}/api/<path>?<query>` com `Content-Type/Accept: application/json`, `Authorization: Bearer <appToken>`, e `Session: <accessToken>` **se houver sessão** (também em endpoints públicos).
6. Resposta JSON → mesmo status + JSON. Não-JSON com erro → `{message, raw_response (100 chars)}`. Falha de conexão → **502** `Proxy Connection Failed`.

`bodyParser.sizeLimit = '4mb'`.

### Allowlist atual

**Públicos** (sem sessão): `login`, `register`, `check-member`, `change-password`, `replay/places`, `replay/places/{id}/videos`, `tournaments`, `tournaments/{id}`, `tournaments/{id}/categories/{id}/bracket`, `tournaments/{id}/staff/check`, `tournaments/{id}/staff/matches`, `tournaments/{id}/staff/matches/{id}/result`.

**Rotas da equipe do torneio** (`tournaments/{id}/staff/*`): o proxy repassa o header `Tournament-Code` (só se casar com `^[A-Za-z0-9 -]{1,20}$`) e **não** repassa o `Session` — a autorização ali é o código de lançamento.

**Autenticados**: `verify-token`, `schedule(/*)`, `place/{x}`, `places(/*)`, `member/update`, `replay/my-videos`, `lighting/availability`, `lighting/groups`, `lighting/groups/{id}/places`, `lighting/places/{id}/activate`, `lighting/release`, `lighting/activations`, `social/groups`, `social/groups/{id}/places`, `social/availability`, `social/beverages`, `social/furniture`, `social/limits`, `social/bookings`, `social/bookings/{id}`, `social/bookings/{id}/guests`, `tournaments/{id}/eligibility`, `tournaments/{id}/registrations`, `tournaments/my-registrations`, `tournaments/registrations/{id}`, `tournaments/my-teams`, `tournaments/categories/{id}/teams`, `tournaments/member-lookup`, `tournaments/teams/{id}/invites`, `tournaments/invites/{id}`, `tournaments/my-invites`, `tournaments/invites/{id}/accept`, `tournaments/invites/{id}/decline`.

`tournaments/payment` fica **fora** da allowlist: só o servidor chama (`success.ts`).

> Para expor um endpoint novo da Lara ao navegador **é obrigatório** adicioná-lo aqui, com a regex mais fechada possível (um caminho por regex, `\d+` para ids).

## Catálogo de endpoints da Lara usados pelo app

| Endpoint (relativo a `/api`) | Método | Chamado por | Via |
|---|---|---|---|
| `login` | POST | NextAuth `authorize`; confirmação de senha no perfil | servidor / proxy |
| `register` | POST | `AuthSidebar` | proxy |
| `check-member` | POST | esqueci a senha | proxy |
| `change-password` | PUT | esqueci a senha; `PasswordForm` do perfil | proxy |
| `verify-token` | GET | `TokenValidator` | proxy |
| `places/group` | GET | home | proxy |
| `places/` | POST `{group_id, member_id, date}` | `/places/[slug]` | proxy |
| `place/{id}` | GET | `/place/[slug]`, perfil (imagem do último agendamento) | proxy |
| `schedule/time-options` | POST `{date, place_id, member_id}` | `Schedule`, revalidação no checkout | proxy |
| `schedule` | POST (cria pendente) | `Schedule` | proxy |
| `schedule/member/{id}[/]` | GET | `CartContext`, perfil, `utils/lara` | proxy / servidor |
| `schedule/delete-pending` | DELETE `{id}` | `CartContext.removeCartItem`, tutorial do checkout | proxy |
| `schedule/payment` | POST | `pages/api/success.ts` | servidor |
| `member/update` | PUT `{cpf, email, telephone}` | `ProfileForm` | proxy |
| `image/{id}` | GET (jpeg) | `Profile/banner.tsx` (**quebrado**, ver [12](12-pontos-de-atencao.md)) | — |
| `replay/places`, `replay/places/{id}/videos`, `replay/my-videos` | GET | Replay | proxy |
| `/storage/replay/videos/**` (fora de `/api`) | GET/HEAD | rota de mídia | servidor |
| `lighting/*` | GET/POST | Luz da quadra | proxy |
| `social/*` (groups, availability, beverages, furniture, limits, bookings; `PUT bookings/{id}` edita a pré-reserva) | GET/POST/PUT/DELETE | Espaços sociais ([13](13-espacos-sociais.md)) | proxy |
| `social/bookings/{id}` | GET | `utils/lara.computeSocialBookingCharge` (valor a cobrar) e `socialBookingIsPaid` (checagem de "já pago") | servidor |
| `tournaments/*` (lista, detalhe, chaveamento, elegibilidade, inscrições, times, convites, equipe) | GET/POST/PUT/DELETE | Torneios ([16](16-torneios.md)) | proxy |
| `tournaments/payment` | POST | `pages/api/success.ts` | servidor |
| `tournaments/my-registrations`, `tournaments/{id}` | GET | `utils/lara.computeTournamentCharge` (valor e vaga antes de cobrar), `tournamentPaymentState` | servidor |
| `webhooks/whatsapp` | POST | webhook | servidor |
| `aprovacao/login`, `aprovacao/ordens`, `aprovacao/ordens/{cd}`, `aprovacao/ordens/{cd}/decidir` | POST/GET | área de aprovação | servidor (sem token de app; `Authorization` = JWT do diretor) |
| `assinatura/remota/{link,abrir,sessao,identidade,respostas,anexos,anexos/{id},pdf,visualizado,assinar,recusar,encerrar}` | vários | assinatura remota | servidor, pelas rotas `/assinar/api/*` (fora do proxy e da allowlist; `Authorization` = `LARA_SIGNATURE_API_TOKEN`) — ver [15](15-assinatura-remota.md) |

## Anti-injeção — [utils/sanitize.ts](../../utils/sanitize.ts)

- `assertNoInjection(value, opts)`: percorre recursivamente e **lança `InjectionError`** (não muta nada) se encontrar:
  chaves `__proto__`/`prototype`/`constructor`; chaves iniciadas por `$` (operadores NoSQL); caracteres de controle C0 exceto TAB/LF/CR (em chaves ou valores); números não finitos; tipos não-JSON;
  limites: profundidade 12, 5000 nós, string 50 000 chars, 1000 chaves/itens.
- `guardRequest(req, res)`: valida `req.body` e `req.query`; em violação responde **400 `{error:'Entrada invalida.'}`** e retorna `false`.
- Usado em: proxy, `login`, `register`, `erede/payment_methods`, `success`; o webhook usa `assertNoInjection` direto.
- É defesa de borda — a proteção contra SQLi real é responsabilidade da Lara.

## Rate limit — [utils/rate-limit.ts](../../utils/rate-limit.ts)

- `rateLimit(key, limit, windowMs) → {ok, retryAfter}`: janela fixa em `Map` em memória, poda quando passa de 5000 chaves.
- `getClientIp(req)`: primeiro IP de `x-forwarded-for`, senão `socket.remoteAddress`.
- Limites em uso (por IP, janela 60 s): login 8 · register 5 · pagamento 10 · webhook WhatsApp 60. Excedido → **429** + `Retry-After`.
- Só vale para **um processo** (um processo `next start`). O proxy `/api/backend` **não** tem rate limit próprio.
