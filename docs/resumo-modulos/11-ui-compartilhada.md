# 11 — UI compartilhada, hooks e estilos

## Componentes comuns (`app/components/Common/`)

| Componente | Uso | Notas |
|---|---|---|
| [header.tsx](../../app/components/Common/header.tsx) | Todas as telas de sócio e replay/luz | **Sem props** desde o rebrand v4. Topo fixo (logo claro/escuro, módulos no desktop: Início, Espaços sociais, Replay, Luz da quadra, Torneios, Ingressos — até 1180px com os nomes curtos, até 960px sem ícone; carrinho com contador quando há itens; menu do usuário). No celular (≤760px) a **barra inferior** (`data-bottom-nav`) tem três botões: **Início**, **Menu** e **Perfil** (sem sessão, "Entrar") — o `body` ganha espaço por `body:has([data-bottom-nav])`. **Menu** abre uma folha acima da barra com a grade dos módulos (`SHEET`: Espaços, Replay, Luz, Torneios, Ingressos), cada um na cor do seu módulo (`areaStyle`); fecha com Esc, toque fora, o X ou ao trocar de página; o botão Menu fica aceso quando o módulo atual está na folha. Módulo ativo pela URL (`moduleOf`). Menu do usuário: Meu perfil, Meus agendamentos, Meus vídeos, Minhas reservas sociais, Minhas inscrições em torneios, Meus ingressos, **Tema** (Sistema/Claro/Escuro) e Sair (`signOut → /login`). Sem sessão mostra "Entrar". **É aqui que se adicionam módulos e itens de menu.** |
| [footer.tsx](../../app/components/Common/footer.tsx) | Telas de sócio (logo troca no tema escuro) | Contatos do clube (tel. (24) 2102-2750, WhatsApp (24) 99251-0959, e-mail), redes sociais, créditos (Erick Porto e Gustavo Alves) |
| [loading.tsx](../../app/components/Common/loading.tsx) | Geral | `LoadingScreen` (tela cheia com logo) e `Loading` (`small?`) |
| [carousel.tsx](../../app/components/Common/carousel.tsx) | `/login` | Lista arquivos via `GET /api/carousel` ([pages/api/carousel.ts](../../pages/api/carousel.ts) lê `public/images/carousel`) e troca a cada 5 s |
| [tutorial-overlay.tsx](../../app/components/Common/tutorial-overlay.tsx) | `/places`, `/place`, `/checkout` | Onboarding com spotlight (máscara SVG), passos `{targetId, targetClickableItem, title, description, waitForAction, offset, mOffset}`. Estado global em `localStorage['app_tutorial_status']` (`in_progress`/`completed`/`skipped`) — **um único tutorial encadeado entre páginas**. `waitForAction` simula o clique no elemento real. Os `id`s de DOM usados pelos passos (`schedule-1`, `action-buttons-1/2`, `expire-clock`, `date-selection`, `place-card-0`, `schedule-button-0`) **não podem ser renomeados** sem atualizar os passos. |
| [login-aside.tsx](../../app/components/Common/login-aside.tsx) | `/login` | Ver [02](02-autenticacao-socio.md) |
| [theme.tsx](../../app/components/Common/theme.tsx) + [theme-script.ts](../../app/components/Common/theme-script.ts) | Menu do usuário / layout raiz | Tema claro/escuro. Padrão = sistema. A escolha fica em `localStorage["cfcsn-theme"]` e vira `data-theme` no `<html>`; o script do layout aplica antes da pintura (sem piscar). O script mora num `.ts` sem `"use client"` para o layout (servidor) receber o texto, não uma referência. |

### Peças da identidade v4 (`app/components/UI/`)

| Peça | Para quê |
|---|---|
| `PageHeader` | Título da tela: seta de voltar (`backHref` ou `back` = histórico), `kicker`, título, apoio e ações |
| `ModuleCover` / `ReplayCover`, `SocialCover` (covers.tsx) | Capa colorida do módulo com abas. Só em módulo com abas (Replay: Galeria/Meus vídeos; Espaços: Espaços/Minhas reservas) |
| `Pill` | Selo de estado (`ok`/`warn`/`danger`/`info`/`off`) — sempre texto + ícone |
| `Media` / `MediaTag` | Imagem de fundo com substituto (ícone ou iniciais) na cor do módulo quando não há foto |
| `SearchBar` + `matchesSearch` | Busca de lista que vem inteira (ignora acento e maiúscula) |
| `Note`, `areaStyle`, `initialsOf` | Aviso colorido, variáveis `--c/--ci` do módulo, iniciais do avatar |

Estilos em `styles/ui.module.css`. Regras completas em [14](14-identidade-visual.md).

### Sem uso desde o rebrand v4

`ItensGrid.tsx` e `sportive-square.tsx` (grade/carrossel antigos da home) — ver [04](04-agendamento-quadras.md).

### Componentes órfãos (não renderizados hoje)

| Componente | Situação |
|---|---|
| `map-banner.tsx` | Mapa interativo do clube (`react-zoom-pan-pinch`, polígonos SVG sobre `MAPA.jpg`, viewBox 2000×1200). Import comentado na home. |
| `mobileNavBar.tsx` | Barra inferior mobile (Mapa/Esportes). Comentada na home. |
| `horizontal-nav-bar.tsx` | Nav por scroll. Sem uso. |
| `location.tsx` | Google Maps embed (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`). Sem uso. |
| `Checkout/CreditCardBrand.tsx` | SVG de bandeiras. Uso comentado em `CheckoutPayment`. |

Antes de apagar, confirme com o usuário — vários foram desligados temporariamente (ex.: mapa, área social).

## Hooks (`app/hooks/`)

- `useIsMobile()` — `window.innerWidth <= 1024` (inclui tablets), atualiza no resize. Começa `false` no primeiro render (SSR).
- `useLightingAvailability()` — ver [08](08-luz-da-quadra.md).

## Estilos (`styles/`)

- **CSS Modules**, um por tela/componente (`schedule.module.css`, `checkout.module.css`, `replay.module.css`, `lighting.module.css`, `aprovacao.module.css`, …) + `ui.module.css` (peças compartilhadas) e `home.module.css`. Não há Tailwind nem CSS-in-JS.
- [globals.css](../../styles/globals.css): identidade v4 — fontes Unbounded/Figtree/JetBrains Mono (Google Fonts), tokens de cor como canais (`--grena-rgb`) e como cor pronta (`--grena`), tema escuro (sistema + `data-theme`), cores de módulo (`--a-<módulo>-rgb`), raios, sombras e `--bottom-nav-height`. Os nomes antigos (`--grena-light`, `--grena-dark`, `--background`…) viraram apelidos dos tokens novos. Detalhes em [14](14-identidade-visual.md).
- Módulos reaproveitados entre domínios: os Espaços sociais usam `replay.module.css` (seção, cabeçalho, botões) e o flash de `lighting.module.css`; a Luz usa `replay.module.css` (notice, grupos) e `places.module.css` (cards de quadra); o tema de banco do cartão vem de `payment-selector.module.css` via `utils/bank-identifier.ts`.

## Assets (`public/images/`)

Logos (`logo-cfcsn-*`, `logo-eng-*`), `default-avatar.png`, `default-card.png`, `profile-crown.svg`, `MAPA.jpg`, e `carousel/bg-*.jpg` (beach tennis, futebol, padel, tennis, vôlei) — usados no carrossel do login **e** como foto de esporte no Replay/Luz (`sportImage`) e no banner da home.

## Padrões de UI recorrentes

- Erros/sucesso: `toast.*` do `react-toastify` (container no layout raiz, canto inferior direito).
- Estados vazios/erro: `ReplayNotice` (`icon`, `title`, `description`, `action`, `tone`) — é o "estado vazio" padrão do app inteiro (borda tracejada; `tone="alert"` em erro).
- Busca sem resultado: `ReplayNotice` com "Nada encontrado para “…”".
- Listas por esporte colapsáveis: `ReplaySportSection`.
- Links internos costumam ter `referrerPolicy='no-referrer' rel='noopener noreferrer'` (padrão herdado; inofensivo).
