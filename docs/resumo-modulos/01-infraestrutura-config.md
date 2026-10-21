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
| Runtime de produção | `next start` como serviço **systemd** (nome padrão no script: `espacos`), atrás do **nginx** (proxy reverso); instância única |

Scripts (`package.json`): `dev` (`next dev --turbo`), `build`, `start`, `lint` (`next lint`). **Sem testes.**

## Arquivos de configuração

### [next.config.ts](../../next.config.ts)
- `reactStrictMode: false`.
- `images.unoptimized: true`, `dangerouslyAllowSVG: true`, `qualities: [100]`.
- `remotePatterns` liberando: `plus.unsplash.com`, `i.imgur.com`, `www.folhadointerior.com.br`, `lara.clubedosfuncionarios.com.br`, `clubedosfuncionarios.com.br`, `placehold.co`, `http://192.168.100.48:8000` (Lara interna). **Imagem de host novo no `<Image>` exige adicionar aqui.**
- `basePath` lido de `NEXT_PUBLIC_BASE_PATH` (vazio em produção, `/homolog` na homologação — ver [Homologação](#homologação-homolog)).
- Há um bloco de `rewrites` comentado (antiga forma de proxy) — o proxy real é `pages/api/backend/[...path].ts`.

### [tsconfig.json](../../tsconfig.json)
- `moduleResolution: bundler`, `jsx: preserve`, `allowJs`.
- `paths` `@/*`, `@/components/*`, `@/services/*` etc. **existem mas não são usados** — o projeto usa imports relativos (decisão registrada no `RELATORIO-CORRECOES.md`). Não reintroduza `@/`.

### [eslint.config.mjs](../../eslint.config.mjs)
- Flat config estendendo `next/core-web-vitals` + `next/typescript`.

### [middleware.ts](../../middleware.ts)
`withAuth` do NextAuth (`next-auth/middleware`) com `pages.signIn: "/login"` (sem prefixo: o withAuth aplica o basePath sozinho) e, na homologação, o nome próprio do cookie de sessão (`utils/auth-cookies.ts`). Sem sessão, redireciona para `/login?callbackUrl=<rota>` — na homologação `/homolog/login?callbackUrl=%2Fhomolog%2F...`; `safeCallbackUrl` tira o prefixo antes do `router.push`.

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
| `NEXT_PUBLIC_BASE_PATH` | `next.config.ts` (`basePath`) e `utils/base-path.ts`. Vazio = produção na raiz; `/homolog` = homologação. **Fixado no build.** | cliente + servidor |
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
Antes do `NextAuthProvider` vem `<HomologBanner />` (`app/components/UI/homolog-banner.tsx`), que só renderiza na homologação; lá o metadata também ganha título `[Homologação] ...` e `robots: noindex, nofollow`.

Também importa `styles/globals.css` e configura FontAwesome (`config.autoAddCss = false` + CSS do core). Metadata: título "Clube dos Funcionários".

## Deploy — [deploy.sh](../../deploy.sh)

Executado no servidor Linux:
1. `git reset --hard` + `git clean -df` (descarta alterações locais no host).
2. `git pull origin master`.
3. `npm ci --include=dev` (devDeps necessárias ao build: `next.config.ts` precisa de TypeScript).
4. `npm run build`.
0. Antes de tudo confere se o serviço systemd existe (`SERVICO`, padrão `espacos`; outro nome: `SERVICO=<nome> ./deploy.sh`) e aborta se não existir.
5. `sudo systemctl restart $SERVICO` e confere se ficou ativo (senão aponta o `journalctl`). O usuário do deploy precisa de sudo para esse restart.
6. Permissões mínimas: dirs `755`, arquivos `644`, `deploy.sh` `+x`, `.env` `600`. **Nunca `777`** (histórico de comprometimento do host — ver `RELATORIO-CORRECOES.md`).

Ou seja: **o que está em `master` vai para produção** no próximo deploy.

## Homologação (`/homolog`)

Segunda instância do **mesmo código**, servida pelo mesmo domínio em `https://espacos.clubedosfuncionarios.com.br/homolog/*`. Não abre porta nova na DMZ: entra pelo mesmo 443 do proxy reverso, e o processo escuta só em `127.0.0.1`.

```
navegador ── espacos.clubedosfuncionarios.com.br (proxy reverso, 443)
               ├─ /homolog/*  → systemd "espacos-homolog" (127.0.0.1:<porta>, branch homolog)
               └─ /*          → systemd da produção      (porta atual, branch master)
```

- **Branch `homolog`**: o que está em teste (hoje: rebrand v4 + espaços sociais). `master` segue indo para a produção. Função aprovada: merge da feature em `master`.
- **Mesma Lara e mesma eRede da produção**: reserva, pagamento, luz e aprovação feitos na homologação são **reais**. A faixa no topo avisa isso.
- **Código ciente do prefixo** — [utils/base-path.ts](../../utils/base-path.ts) (`BASE_PATH`, `EM_HOMOLOGACAO`, `comBase`, `semBase`). O Next prefixa `<Link>`, `router.push` e `redirect()`; **todo o resto precisa de `comBase`**: `fetch('/api/...')` no cliente (inclusive `PROXY_API` do `api-consume`), `src="/images/..."` em string, `url(...)` em `style`, URL de mídia do replay, `callbackUrl` do `signOut`, `pages.signIn` do NextAuth, `basePath` do `SessionProvider`, `new URL(..., request.url)` em Route Handler, `path` de cookie. Em CSS Module use caminho relativo (`url('../public/images/x.png')`), que o bundler resolve com o prefixo.
- **Cookies separados** ([utils/auth-cookies.ts](../../utils/auth-cookies.ts)): na homologação os cookies do NextAuth são `*.homolog` com `path=/homolog`, e o `NEXTAUTH_SECRET` é outro; sessão de um ambiente não vale no outro e sair de um não derruba o outro. Em produção ficam os nomes padrão (nenhuma sessão existente é invalidada). O cookie da aprovação usa `COOKIE_PATH = comBase('/aprovacao')`.
- **Rate limit e cache de pagamentos pendentes** são em memória por processo: cada instância tem o seu.

### Montar no servidor (uma vez)

1. Clonar o repositório numa pasta separada (ex.: `/home/administrator/clubeel-homolog`) e `git checkout homolog`.
2. `.env` próprio: cópia do da produção, trocando
   - `NEXT_PUBLIC_BASE_PATH=/homolog`
   - `NEXTAUTH_URL=https://espacos.clubedosfuncionarios.com.br/homolog/api/auth`
   - `NEXT_PUBLIC_APP_URL=https://espacos.clubedosfuncionarios.com.br/homolog`
   - `NEXTAUTH_SECRET=<outro valor>`
3. `npm ci --include=dev && npm run build`.
4. Serviço systemd a partir do modelo [deploy/espacos-homolog.service](../../deploy/espacos-homolog.service): ajuste `User`, `WorkingDirectory`, caminho do `npm` e porta copiando do serviço da produção (`systemctl cat <serviço>`), depois `sudo cp` para `/etc/systemd/system/`, `sudo systemctl daemon-reload` e `sudo systemctl enable --now espacos-homolog`.
5. No proxy reverso (nginx), **sem** remover o prefixo (o Next espera recebê-lo):
   ```nginx
   location /homolog {
       proxy_pass http://127.0.0.1:<porta>;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       add_header X-Robots-Tag "noindex, nofollow" always;
   }
   ```
   Se o `location /` da produção tiver outros headers, copie de lá (o rate limit usa o IP do cliente).

### Atualizar

Na pasta da homologação: `./deploy-homolog.sh` (pull da branch `homolog`, build, `sudo systemctl restart espacos-homolog`). O script aborta se o `.env` não tiver `NEXT_PUBLIC_BASE_PATH=/homolog` (para não rodar na pasta da produção) ou se o serviço não existir.

Testar local: `NEXT_PUBLIC_BASE_PATH=/homolog npm run build` e `NEXTAUTH_URL=http://localhost:3005/homolog/api/auth next start -p 3005` (no Git Bash do Windows use `MSYS_NO_PATHCONV=1`, senão `/homolog` vira caminho de disco).

## Outros arquivos na raiz

| Arquivo | Situação |
|---|---|
| `README.md` | Marketing/visão antiga; cita Mercado Pago (já substituído pela eRede). Desatualizado. |
| `RELATORIO-CORRECOES.md` | Relatório da correção de segurança (C1–C4, A1–A2, M1–M4). Útil para contexto; cita caminhos `src/pages/...` e Next 15.2.0 que **não correspondem mais** ao repo atual (`pages/` na raiz, Next 15.5.20). |
| `j3.txt` | Arquivo de cookies do curl (CSRF NextAuth) versionado por engano. Lixo; candidato a remoção. |
| `transferRules.ts` | Vazio. |
| `tsconfig.tsbuildinfo`, `next-env.d.ts` | Gerados (ignorados pelo `.gitignore`). |
