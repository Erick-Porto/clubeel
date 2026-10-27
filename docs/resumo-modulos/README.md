# Clubeel — Resumo geral (base para agents)

> Documento de entrada. Leia este arquivo inteiro antes de mexer no código; depois abra só o(s) módulo(s) que a tarefa toca.
> Estado descrito: branch `master`, commit `5987f33` (2026-09-24). Se o código divergir deste texto, **o código vence** — atualize o doc.

## 1. O que é

Front-end web do **Clube dos Funcionários da CSN (CFCSN)**, Volta Redonda/RJ — produção em `espacos.clubedosfuncionarios.com.br`.
É uma aplicação **Next.js 15 (React 19, TypeScript)** que serve oito produtos distintos:

| Produto | Público | Rotas | Doc |
|---|---|---|---|
| **Agendamento de quadras** (reserva + carrinho + pagamento por cartão) | Sócio logado | `/`, `/places/[slug]`, `/place/[slug]`, `/checkout`, `/profile` | [04](04-agendamento-quadras.md), [05](05-checkout-pagamento.md), [06](06-perfil-socio.md) |
| **Espaços sociais** (churrasqueiras/salões: pré-reserva → análise da secretaria → pagamento; dia inteiro) | Sócio logado | `/espacos-sociais`, `/espacos-sociais/[grupo]/[espaco]`, `/espacos-sociais/reservas[/id]` | [13](13-espacos-sociais.md) |
| **Torneios** (inscrição por categoria + pagamento eRede, times/capitão, chaveamento, resultados lançados pela equipe com código) | Lista, detalhe, chaveamento: qualquer visitante · inscrição e times: sócio · lançamento: equipe com código | `/torneios`, `/torneios/[id]`, `/torneios/[id]/chaveamento/[categoria]`, `/torneios/[id]/equipe`, `/torneios/inscricoes`, `/torneios/times/[id]` | [16](16-torneios.md) |
| **Ingressos de eventos** (vitrine, compra do sócio para o título e do não sócio sem login, pagamento eRede, QR Code/PDF, vários dias) | Vitrine, evento e compra: qualquer visitante · "Meus ingressos": sócio · pedido do não sócio: link do e-mail | `/ingressos`, `/ingressos/[id]`, `/ingressos/[id]/comprar`, `/ingressos/pedido/[id]`, `/ingressos/meus[/id]`, `/ingressos/perdi-o-link` | [17](17-ingressos.md) |
| **Replay** (vídeos curtos gravados nas quadras, guardados 7 dias) | Galeria: qualquer visitante · "Meus vídeos": sócio | `/replay`, `/replay/[slug]`, `/meus-videos` | [07](07-replay.md) |
| **Luz da quadra** (sócio acende/prolonga/devolve a luz pelo celular no uso livre) | Sócio logado | `/luz` (+ banner na home e card no perfil) | [08](08-luz-da-quadra.md) |
| **Aprovação de compras** (diretoria aprova/reprova ordens de compra do ERP Questor) | Diretor (sessão própria, sem relação com sócio) | `/aprovacao/**` | [09](09-aprovacao-compras.md) |
| **Assinatura remota de documentos** (termos, contratos, fichas assinados pelo link do e-mail) | Quem recebeu o link (cookie próprio, sem relação com sócio; fora dos buscadores) | `/assinar/**` | [15](15-assinatura-remota.md) |

Além disso: um **webhook de WhatsApp** (Poli Digital → Lara) — [10](10-webhook-whatsapp.md).

**Não há banco de dados nem regra de negócio pesada aqui.** Toda a verdade (agendamentos, preços, horários, luz, vídeos, ordens) mora na **API interna "Lara"** (Laravel, não publicada na internet; só alcançável de dentro da DMZ onde o Next roda). Pagamentos são feitos na **eRede** (adquirente, OAuth `client_credentials`).

## 2. Arquitetura em uma figura

```
Navegador (React client components)
   │
   │  fetch('/api/backend/<endpoint>')  ← services/api-consume.ts (lado cliente)
   ▼
Next.js (servidor, DMZ) ───────────────────────────────────────────────┐
   ├─ pages/api/backend/[...path].ts   proxy com ALLOWLIST → Lara       │
   │     injeta  Authorization: Bearer <INTERNAL_LARA_API_TOKEN>        │
   │     e       Session: <accessToken do sócio, tirado do JWT NextAuth>│
   ├─ pages/api/auth/[...nextauth].ts  login de sócio (Credentials→Lara)│
   ├─ pages/api/erede/payment_methods  cria transação na eRede          │
   ├─ pages/api/success.ts             verifica na eRede + confirma Lara│
   ├─ pages/api/whatsapp/webhook.ts    Poli Digital → Lara              │
   ├─ app/api/replay/media/[...path]   stream de vídeo (Range) da Lara  │
   ├─ pages/api/ingressos/*            pedido do não sócio (token→cookie)│
   ├─ app/aprovacao/** (Server Components + Server Actions) → Lara      │
   └─ app/(assinatura)/assinar/api/*  Route Handlers, token próprio │
                                                                         ▼
                                         Lara (Laravel)  ·  eRede  ·  ERP Questor (via Lara)
```

Regras de ouro dessa arquitetura:

1. **O navegador nunca fala direto com a Lara.** Cliente → `/api/backend/*` (proxy) → Lara. No servidor, `API_CONSUME` chama a Lara direto (`INTERNAL_LARA_API_URL/api/...`).
2. **`INTERNAL_LARA_API_TOKEN` nunca pode chegar ao bundle do cliente.** Variáveis sem prefixo `NEXT_PUBLIC_` são `undefined` no browser.
3. **Todo endpoint novo da Lara usado pelo cliente precisa entrar na allowlist** de [`pages/api/backend/[...path].ts`](../../pages/api/backend/[...path].ts) (`PUBLIC_ENDPOINTS` ou `AUTHENTICATED_ENDPOINTS`). Fora da lista → 403.
4. **Valor de cobrança nunca vem do cliente** — é recalculado no servidor (`utils/lara.ts → computeAmountInCents`).
5. **Módulos novos (Replay, Luz, Aprovação, Espaços sociais, Torneios, Ingressos, Assinatura remota) seguem "o front não decide nada"**: janela, limite, permissão, status vêm da Lara; o front só formata e exibe a mensagem que ela mandou (`error`/`reason`). Não reimplemente regra de negócio no front.

## 3. Mapa de diretórios

| Caminho | Papel | Doc |
|---|---|---|
| `app/` | App Router: páginas (quase todas `"use client"`), layout raiz, área `/aprovacao`, área `(assinatura)/assinar`, rota de mídia do replay, `robots.ts` | vários |
| `tests/` | `unit/` (Vitest, rotas da assinatura) e `e2e/` (Playwright + Lara falsa) | [15](15-assinatura-remota.md) |
| `app/components/` | Componentes por domínio: `Auth`, `Checkout`, `Common`, `Lighting`, `Profile`, `Replay`, `Schedules`, `Social` | [11](11-ui-compartilhada.md) e por domínio |
| `app/hooks/` | `useIsMobile` (≤1024px), `useLightingAvailability` | [11](11-ui-compartilhada.md), [08](08-luz-da-quadra.md) |
| `pages/api/` | Pages Router — **só rotas de API** (auth, proxy, pagamento, webhook) | [02](02-autenticacao-socio.md), [03](03-proxy-backend-seguranca.md), [05](05-checkout-pagamento.md), [10](10-webhook-whatsapp.md) |
| `services/` | Clientes HTTP: `api-consume` (genérico), `replay-api`, `lighting-api`, `social-api`, `tournament-api`, `ticket-api`, `aprovacao-api` e `assinatura-api` (server-only) | [03](03-proxy-backend-seguranca.md) e por domínio |
| `context/` | `CartContext` (carrinho = agendamentos pendentes status 3) | [04](04-agendamento-quadras.md) |
| `utils/` | Helpers: segurança (`sanitize`, `rate-limit`, `callback-url`), pagamento (`erede`, `lara`, `pending-payments`, `bank-identifier`), formatação (`replay`, `lighting`, `uriGen`) | por domínio |
| `styles/` | CSS Modules (um por componente/tela) + `globals.css` (tokens de cor grená) | [11](11-ui-compartilhada.md) |
| `types/next-auth.d.ts` | Augment dos tipos de `Session`/`User`/`JWT` | [02](02-autenticacao-socio.md) |
| `middleware.ts` | NextAuth middleware: rotas que exigem sessão de sócio | [01](01-infraestrutura-config.md) |
| `public/images/` | Logos, carrossel do login (também usado como foto de esporte), mapa | [11](11-ui-compartilhada.md) |

## 4. Índice dos módulos

1. [01-infraestrutura-config.md](01-infraestrutura-config.md) — stack, scripts, env vars, middleware, layout raiz, deploy.
2. [02-autenticacao-socio.md](02-autenticacao-socio.md) — NextAuth, login/cadastro, esqueci a senha, `TokenValidator`, `callbackUrl`.
3. [03-proxy-backend-seguranca.md](03-proxy-backend-seguranca.md) — `API_CONSUME`, proxy `/api/backend`, allowlist, `sanitize`, `rate-limit`, catálogo de endpoints da Lara.
4. [04-agendamento-quadras.md](04-agendamento-quadras.md) — home, esporte → quadra → horários, `Schedule`, `CartContext`, relógio de expiração.
5. [05-checkout-pagamento.md](05-checkout-pagamento.md) — checkout, eRede, verificação e estorno, `success.ts`.
6. [06-perfil-socio.md](06-perfil-socio.md) — perfil, dados pessoais, troca de senha, agendamentos.
7. [07-replay.md](07-replay.md) — galeria pública, meus vídeos, rota de mídia com Range.
8. [08-luz-da-quadra.md](08-luz-da-quadra.md) — disponibilidade, acender/prolongar/devolver, polling.
9. [09-aprovacao-compras.md](09-aprovacao-compras.md) — área isolada da diretoria (Server Components/Actions, cookie httpOnly).
10. [10-webhook-whatsapp.md](10-webhook-whatsapp.md) — webhook Poli Digital.
11. [11-ui-compartilhada.md](11-ui-compartilhada.md) — header, footer, loading, tutorial, carrossel, estilos, componentes órfãos.
12. [12-pontos-de-atencao.md](12-pontos-de-atencao.md) — bugs conhecidos, dívidas técnicas, documentos desatualizados, armadilhas.
13. [13-espacos-sociais.md](13-espacos-sociais.md) — churrasqueiras/salões: vitrine, calendário, pré-reserva, minhas reservas, pagamento por reserva.
14. [14-identidade-visual.md](14-identidade-visual.md) — rebrand v4: tokens, tema escuro, cores de módulo, peças de UI (`app/components/UI/`), modelo de tela, pegadinhas.
15. [15-assinatura-remota.md](15-assinatura-remota.md) — assinatura de documentos pelo link do e-mail: área isolada, cookies httpOnly, IP de quem assina, etapas, testes.
16. [16-torneios.md](16-torneios.md) — torneios: lista/detalhe públicos, elegibilidade, inscrição e pagamento eRede, times e convites, chaveamento, tela da equipe com código de lançamento.
17. [17-ingressos.md](17-ingressos.md) — ingressos de eventos: vitrine, compra do sócio (título) e do não sócio (sem login, token do pedido em cookie httpOnly), cupom, pagamento eRede com estorno no `hold_expired`, QR/PDF, vários dias.

## 5. Fluxo principal do sócio (ponta a ponta)

1. Acessa `/` sem sessão → **página de boas-vindas** (`public-home.tsx`: Entrar, RePET, Torneios, Ingressos; `/` fica fora do matcher). Rota protegida sem sessão → `middleware.ts` redireciona para `/login?callbackUrl=...`.
2. Login (`AuthSidebar`): CPF + senha → **senha vira SHA-256 no cliente** → `signIn('credentials')` → `authorize` chama `POST login` na Lara → JWT NextAuth guarda `accessToken` da Lara + dados do sócio.
3. Home (`/`): `GET places/group` → grade de esportes (categoria `esportiva`). Banner da luz aparece se a Lara disser que há quadra aberta.
4. `/places/<esporte>-<id>`: seletor de datas + `POST places/` (`group_id`, `member_id`, `date`) → quadras com `available_slots` e limite do sócio. Repolling 30 s.
5. `/place/<quadra>-<id>`: `GET place/{id}` + `POST schedule/time-options` → grade de horários. Sócio escolhe horários **consecutivos** (até o limite) → `POST schedule` com `status_id: '3'` (pendente = vai pro carrinho; hold de **10 min** a partir de `created_at`).
6. `/checkout`: resumo (`CartContext`) + formulário de cartão. Ao pagar: revalida disponibilidade (`schedule/time-options`) → `POST /api/erede/payment_methods` (servidor recalcula valor, cria transação eRede, guarda em cache) → `POST /api/success` (servidor consulta a eRede, compara valor, `POST schedule/payment` na Lara com `status_id: 1`; estorna se algo falhar) → `/checkout?status=success|expired|error`.
7. `/profile?tab=schedules`: agendamentos pendentes (carrinho), confirmados (status 1) e anteriores (status 10).

## 6. Como trabalhar neste repositório (instruções para agents)

- **Comandos**: `npm run dev` (Turbopack), `npm run build`, `npm run lint`. Para validar mudanças use `npx tsc --noEmit` + `npm run lint` + `npm run build`. Só a assinatura remota tem testes automatizados: `npm run test` (Vitest) e `npm run test:e2e` (Playwright, Lara falsa) — ver [15](15-assinatura-remota.md#testes).
- **Imports são relativos** (`../../services/api-consume`), não `@/…` — o alias quebrava no ambiente do usuário. Os `paths` do `tsconfig.json` existem mas estão sem uso. Mantenha imports relativos.
- **Idioma**: UI, mensagens e comentários em **português**. Os módulos recentes (Replay, Luz, Aprovação, webhook, segurança) têm comentários longos explicando o *porquê* — preserve esse estilo ao editá-los. A área `/aprovacao` usa até identificadores em português (`lerToken`, `decidirOrdem`); siga o padrão do arquivo que estiver editando.
- **Estilo**: identidade visual v4 (grená, tokens com tema claro/escuro, cor por módulo) — leia [14-identidade-visual.md](14-identidade-visual.md) antes de mexer em tela. CSS Modules em `styles/`, cor-tema `var(--grena)`, peças compartilhadas em `app/components/UI/`. Ícones: FontAwesome. Avisos: `react-toastify` (`toast.*`) — **somente no cliente**.
- **Páginas de sócio são client components** que buscam dados no `useEffect` via `API_CONSUME`. A área `/aprovacao` é o oposto (Server Components + Server Actions, nenhum fetch no cliente) — não misture os padrões.
- **Ao adicionar endpoint da Lara chamado do cliente**: (1) inclua a regex na allowlist do proxy; (2) decida público × autenticado; (3) se precisar do sócio, nunca aceite `member_id` do cliente como autoridade — a Lara usa o header `Session`.
- **Ao adicionar rota de sócio protegida**: inclua no `matcher` de `middleware.ts`.
- **Segredos**: `.env` contém credenciais reais (Lara, eRede, NextAuth, WhatsApp). Nunca imprima, logue ou commite valores. Logs de pagamento nunca devem conter `cardData`.
- **Homologação (`/homolog`)**: segunda instância da branch `homolog` no mesmo domínio. **Nunca use caminho absoluto** (`'/api/...'`, `'/images/...'`, `callbackUrl: '/login'`, `path` de cookie) sem `comBase` de `utils/base-path.ts` — `<Link>`, `router.push` e `redirect()` já prefixam sozinhos. Ver [01](01-infraestrutura-config.md#homologação-homolog).
- **Single-instance**: rate limit e cache de pagamentos pendentes são **em memória** (1 processo `next start`, serviço systemd atrás do nginx). Escalar horizontalmente exige Redis.
- Leia [12-pontos-de-atencao.md](12-pontos-de-atencao.md) antes de "consertar" algo que parece estranho — vários comportamentos são intencionais e documentados.

## 7. Glossário rápido

| Termo | Significado |
|---|---|
| **Lara** | API interna Laravel (agendamentos, sócios, replay, luz, aprovação). URL em `INTERNAL_LARA_API_URL`. |
| **Session** (header) | JWT da Lara do sócio, enviado pelo proxy. Diferente de `Authorization` (token da aplicação). |
| **place** / **quadra** | Espaço reservável. **place group** / **grupo** = esporte/modalidade (ex.: Tênis, Beach Tennis). |
| **schedule** | Agendamento. `status_id`: **3** = pendente/carrinho, **1** = pago/confirmado (2 também tratado como confirmado), **10** = anterior/histórico. |
| **matrícula** (`title`) | Identificador do sócio no clube. Formatos aceitos no cadastro: `00000` (associado), `0000FCN` (funcionário), `00000ESC` (escolinha). |
| **eRede** | Adquirente de cartão. `returnCode === "00"` = aprovado. |
| **Questor** | ERP onde ficam as ordens de compra; a Lara grava a autorização final lá. |
| **Poli Digital** | Ferramenta de WhatsApp que envia webhooks. |
| **hold** | Reserva temporária (10 min) de um agendamento pendente antes do pagamento. Não existe nos espaços sociais (lá o prazo é `payment_due_at`). |
| **pré-reserva** / **stage** | Reserva de espaço social. Estágios: `requested` → `awaiting_payment` → `confirmed`; ou `refused`, `cancelled`, `expired`. |
