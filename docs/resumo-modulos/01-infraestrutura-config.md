# 01 — Infraestrutura, configuração e deploy

## Stack

| Item | Versão / detalhe |
|---|---|
| Next.js | `15.5.20` — **layout misto**: App Router em `app/` (páginas) + Pages Router em `pages/api/` (só APIs) |
| React | 19.1 (`useActionState` usado na área de aprovação) |
| TypeScript | 5, `strict: true` |
| Auth | `next-auth` 4.24 (JWT, provider Credentials) |
| UI | CSS Modules, FontAwesome (`@fortawesome/*`), `react-toastify`, `react-zoom-pan-pinch` (mapa, hoje desativado) |
| Cripto no cliente | `crypto-js` (SHA-256 da senha antes de enviar) |
| Imagens | `sharp` instalado; `images.unoptimized: true` no `next.config.ts` |
| Runtime de produção | PM2, processo `espacos`, instância única |

Scripts (`package.json`): `dev` (`next dev --turbo`), `build`, `start`, `lint` (`next lint`). **Sem testes.**

## Arquivos de configuração

### [next.config.ts](../../next.config.ts)
- `reactStrictMode: false`.
- `images.unoptimized: true`, `dangerouslyAllowSVG: true`, `qualities: [100]`.
- `remotePatterns` liberando: `plus.unsplash.com`, `i.imgur.com`, `www.folhadointerior.com.br`, `lara.clubedosfuncionarios.com.br`, `clubedosfuncionarios.com.br`, `placehold.co`, `http://192.168.100.48:8000` (Lara interna). **Imagem de host novo no `<Image>` exige adicionar aqui.**
- Há um bloco de `rewrites` comentado (antiga forma de proxy) — o proxy real é `pages/api/backend/[...path].ts`.

### [tsconfig.json](../../tsconfig.json)
- `moduleResolution: bundler`, `jsx: preserve`, `allowJs`.
- `paths` `@/*`, `@/components/*`, `@/services/*` etc. **existem mas não são usados** — o projeto usa imports relativos (decisão registrada no `RELATORIO-CORRECOES.md`). Não reintroduza `@/`.

### [eslint.config.mjs](../../eslint.config.mjs)
- Flat config estendendo `next/core-web-vitals` + `next/typescript`.

### [middleware.ts](../../middleware.ts)
Reexporta o middleware do NextAuth (`next-auth/middleware`) — sem sessão, redireciona para `/login?callbackUrl=<rota>` (página de signIn definida em `authOptions.pages.signIn`).

`matcher` atual (rotas que **exigem sessão de sócio**):
```
/  /profile  /checkout  /cart  /places/:path*  /place/:path*  /meus-videos  /luz  /espacos-sociais  /espacos-sociais/:path*
```
Ficam **fora de propósito**:
- `/replay` e `/replay/*` — galeria pública por decisão de negócio.
- `/login`, `/forgot-password`.
- `/aprovacao/**` — tem sessão própria (cookie `aprovacao_token`), ver [09](09-aprovacao-compras.md).
- `/api/**` — cada rota faz sua própria checagem.

> `/cart` está no matcher mas **não existe página** `/cart` (o carrinho vive em `/profile?tab=schedules` e `/checkout`).

## Variáveis de ambiente

Arquivos: `.env` (produção/host) e `.env.development.local` (só `NEXTAUTH_URL`). Ambos ignorados pelo git. **Nunca exponha valores.**

| Variável | Onde é usada | Lado |
|---|---|---|
| `INTERNAL_LARA_API_URL` | `api-consume` (server), proxy, `utils/lara`, `aprovacao-api`, rota de mídia do replay | servidor |
| `INTERNAL_LARA_API_TOKEN` | Bearer da aplicação para a Lara (proxy, `api-consume` server, `utils/lara`) | servidor |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | NextAuth | servidor |
| `INTERNAL_EREDE_CLIENT_ID`, `INTERNAL_EREDE_SECRET_ID`, `INTERNAL_EREDE_API_URL`, `INTERNAL_EREDE_AUTH_URL` | `utils/erede.ts` | servidor |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | webhook (obrigatório; sem ele → 503) | servidor |
| `WHATSAPP_WEBHOOK_SIGNING_SECRET` | webhook (opcional; vazio = camada HMAC desligada) | servidor |
| `NEXT_PUBLIC_APP_URL` | `utils/callback-url.ts` (validar origem do callback) | cliente |
| `NEXT_PUBLIC_REPLAY_MEDIA_MODE` | `utils/replay.ts` — `direct` ou (padrão) `proxy` | cliente |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `Common/location.tsx` (componente não usado) | cliente |
| `NODE_ENV` | `secure` do cookie da aprovação | servidor |

## Layout raiz — [app/layout.tsx](../../app/layout.tsx)

Server component que envolve **todo o app** (inclusive `/aprovacao`):
```
<html lang="pt-br"><body>
  <NextAuthProvider>          (SessionProvider)          app/components/provider.tsx
    <CartProvider>            (context/CartContext.tsx)
      <TokenValidator />      (revalida token do sócio a cada 5 min; desligado em /aprovacao)
      {children}
    </CartProvider>
  </NextAuthProvider>
  <ToastContainer position="bottom-right" autoClose=5000 ... />
</body></html>
```
Também importa `styles/globals.css` e configura FontAwesome (`config.autoAddCss = false` + CSS do core). Metadata: título "Clube dos Funcionários".

## Deploy — [deploy.sh](../../deploy.sh)

Executado no servidor Linux:
1. `git reset --hard` + `git clean -df` (descarta alterações locais no host).
2. `git pull origin master`.
3. `npm ci --include=dev` (devDeps necessárias ao build: `next.config.ts` precisa de TypeScript).
4. `npm run build`.
5. `pm2 restart espacos`.
6. Permissões mínimas: dirs `755`, arquivos `644`, `deploy.sh` `+x`, `.env` `600`. **Nunca `777`** (histórico de comprometimento do host — ver `RELATORIO-CORRECOES.md`).

Ou seja: **o que está em `master` vai para produção** no próximo deploy.

## Outros arquivos na raiz

| Arquivo | Situação |
|---|---|
| `README.md` | Marketing/visão antiga; cita Mercado Pago (já substituído pela eRede). Desatualizado. |
| `RELATORIO-CORRECOES.md` | Relatório da correção de segurança (C1–C4, A1–A2, M1–M4). Útil para contexto; cita caminhos `src/pages/...` e Next 15.2.0 que **não correspondem mais** ao repo atual (`pages/` na raiz, Next 15.5.20). |
| `j3.txt` | Arquivo de cookies do curl (CSRF NextAuth) versionado por engano. Lixo; candidato a remoção. |
| `transferRules.ts` | Vazio. |
| `tsconfig.tsbuildinfo`, `next-env.d.ts` | Gerados (ignorados pelo `.gitignore`). |
