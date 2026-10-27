# 02 — Autenticação do sócio

> A área `/aprovacao` tem autenticação **separada** — ver [09](09-aprovacao-compras.md). Este doc trata só do sócio.

## Arquivos

| Arquivo | Papel |
|---|---|
| [pages/api/auth/[...nextauth].ts](../../pages/api/auth/[...nextauth].ts) | `authOptions` (exportado e reutilizado por outras rotas via `getServerSession`) |
| [types/next-auth.d.ts](../../types/next-auth.d.ts) | Augment: `Session.accessToken`, `user.{id, cpf, title, telephone, born_date}`; mesmo em `User` e `JWT` |
| [app/components/provider.tsx](../../app/components/provider.tsx) | `NextAuthProvider` = `SessionProvider` |
| [app/login/page.tsx](../../app/login/page.tsx) | Página `/login` (painel + carrossel; no celular o carrossel vira fundo) |
| [app/components/Common/login-aside.tsx](../../app/components/Common/login-aside.tsx) | `AuthSidebar`: formulários de login e cadastro, tela de "manutenção" |
| [app/forgot-password/page.tsx](../../app/forgot-password/page.tsx) | Recuperação de senha em 2 passos |
| [app/components/Auth/TokenValidator.tsx](../../app/components/Auth/TokenValidator.tsx) | Revalida o token da Lara periodicamente e faz signOut se inválido |
| [utils/callback-url.ts](../../utils/callback-url.ts) | `safeCallbackUrl` — anti open-redirect |
| [pages/api/login.ts](../../pages/api/login.ts) | Rota de login "crua" (rate limit 8/min) — **não usada pelo front atual** (o front usa NextAuth) |
| [pages/api/register.ts](../../pages/api/register.ts) | Rota de cadastro com validação de CPF (rate limit 5/min) — **não usada pelo front atual** (o front chama `register` via proxy) |
| [middleware.ts](../../middleware.ts) | Protege rotas de sócio (ver [01](01-infraestrutura-config.md)) |
| [utils/auth-cookies.ts](../../utils/auth-cookies.ts) | Na homologação, nomes/path próprios dos cookies do NextAuth (`*.homolog`, `path=/homolog`); em produção, padrões |

## NextAuth (`authOptions`)

- **Provider**: `CredentialsProvider` com campos `login` (CPF só dígitos) e `password` (**já em SHA-256 hex**, calculado no cliente).
- `authorize`: `API_CONSUME('POST', 'login', {}, {login, password})` — roda no servidor, então vai direto à Lara com o Bearer da aplicação. Espera `data = { user, token }`; retorna `{...user, accessToken: token}`. Erros viram `throw new Error(msg)` (o front exibe `result.error`).
- **Sessão**: `strategy: 'jwt'`. Callbacks `jwt`/`session` copiam `id, accessToken, name, email, title, telephone, cpf` para o token e para `session.user` / `session.accessToken`.
  - Consequência: o `accessToken` da Lara **fica acessível ao navegador** via `GET /api/auth/session`. É o comportamento atual (a área de aprovação deliberadamente faz diferente).
- `pages.signIn = '/login'`; `secret = NEXTAUTH_SECRET`.
- Não há refresh de token: expirou na Lara → `TokenValidator`/interceptor desloga.

## Login e cadastro — `AuthSidebar`

- **Login**: máscara de CPF → `signIn('credentials', { redirect:false, login: cpfDigits, password: SHA256(senha) })`.
  - `result.status === 500` ou erro contendo "fetch" → mostra tela **"Sistema Indisponível"** (botão recarregar + link WhatsApp da secretaria).
  - Sucesso → `router.push(callbackUrl)` + `router.refresh()`.
- **Cadastro**: CPF, matrícula, data de nascimento (`DD/MM/AAAA` com máscara e validação de data real/futura), senha + confirmação.
  - Matrícula normalizada no blur: `^\d{5}$` (associado), `^\d{4}FCN$` (funcionário), `^\d{5}ESC$` (escolinha); outro formato → erro.
  - Chama `API_CONSUME('POST','register', {}, {title, cpf, birthDate: 'AAAA-MM-DD', password: SHA256})` **via proxy** (`register` é endpoint público na allowlist) e em seguida faz `signIn`.
- `?maintenance=true` na URL força a tela de manutenção.
- **Voltar ao início**: no fim do painel (login e cadastro; some na tela de manutenção) um link "Voltar ao início · RePET e torneios sem precisar de conta" → `/`. As entradas públicas (RePET, Torneios) ficam na **página de boas-vindas** da raiz (`app/components/Common/public-home.tsx`), não mais num cartão do login.
- **Página de boas-vindas** (`/` sem sessão): fotos do carrossel fixas ao fundo com véu na cor da tela, "Bem-vindo!" e quatro portas do mesmo tamanho (duas por linha em telas médias), cada uma nas cores do seu módulo invertidas — **Entrar** (sócio, `inicio`) → `/login`, **RePET** (`replay`) → `/replay`, **Torneios** (`torneios`) → `/torneios`, **Ingressos** (`ingressos`) → `/ingressos` — e o rodapé. Botão "Entrar" também no topo. No celular as portas viram linhas empilhadas.
- **Visual**: no desktop, painel à esquerda + carrossel de fotos à direita. No celular (≤900px) o carrossel fica **fixo ao fundo** e o painel vira um cartão translúcido por cima (`auth.module.css` + `login-side-bar.module.css`).

`/login` (`app/login/page.tsx`): se já autenticado, redireciona para `safeCallbackUrl(callbackUrl)`. Envolto em `<Suspense>` porque usa `useSearchParams` (sem isso o build quebra).

## `safeCallbackUrl(raw)`

Aceita só caminho interno. URL absoluta só se a origem for a do `window` ou de `NEXT_PUBLIC_APP_URL` (é reduzida a path). Rejeita `//host`, `/\host`, e `/login` (evita laço). Padrão: `/`.
É o que faz o link do e-mail de replay (`/meus-videos`) cair direto na página após o login.

## Esqueci a senha (`/forgot-password`)

Passo 1 — `UserCheckStep`: CPF + matrícula + data de nascimento → `POST check-member` `{cpf, title, birth_date}` (público).
Passo 2 — `PasswordResetStep`: regras visuais (≥8, maiúscula, minúscula, número, especial `!@#$%¨&*-_=+§£¢¬`) → `PUT change-password` `{cpf, title, birth_date, new_password: SHA256}` (público). Sucesso → `/`.

## `TokenValidator`

Montado no layout raiz. Se `status === 'authenticated'`:
- sem `accessToken` na sessão → `signOut({callbackUrl: comBase('/login')})` (o NextAuth não aplica o basePath no callback; ver [01](01-infraestrutura-config.md#homologação-homolog));
- senão chama `GET verify-token` (via proxy, `skipAuthCheck`) agora e **a cada 5 min**; resposta não-ok/401/403 → `signOut`.
- **Desligado em `/aprovacao*`** (para um sócio com token vencido não arrastar o diretor para `/login`).

## Interceptor global de 401/403

Em `services/api-consume.ts` (lado cliente): qualquer 401/403 → `toast.error("Sua sessão expirou...")` + `signOut({callbackUrl:'/login'})`, a menos que a chamada passe `{ skipAuthCheck: true }` (usado por `verify-token` e por todo o Replay). Ver [03](03-proxy-backend-seguranca.md).

## Hash de senha — resumo

| Fluxo | Formato enviado à Lara |
|---|---|
| Login, cadastro, troca/recuperação de senha, confirmação de senha no perfil | SHA-256 hex calculado no **cliente** (`crypto-js`) |
| Login da aprovação de compras | **Texto puro**, do servidor (a Lara faz bcrypt `Hash::check`) |

Não troque um pelo outro: a Lara espera formatos diferentes em cada fluxo.
