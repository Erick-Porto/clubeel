# 11 — UI compartilhada, hooks e estilos

## Componentes comuns (`app/components/Common/`)

| Componente | Uso | Notas |
|---|---|---|
| [header.tsx](../../app/components/Common/header.tsx) | Todas as telas de sócio e replay/luz | Fixo; fica "ativo" após rolar `surgeIn` px. Props: `options` (nav por seção ou por página), `onlyScroll`, `profileOptions`, `activeSection`, `onNavigate`. Menu do usuário: Meu Perfil, Meus Vídeos, Luz da Quadra, Espaços Sociais, Minhas Reservas Sociais, Início, Sair (`signOut → /login`). Sem sessão mostra "Acessar" → `/login`. **É aqui que se adicionam novos itens de menu.** |
| [footer.tsx](../../app/components/Common/footer.tsx) | Telas de sócio | Contatos do clube (tel. (24) 2102-2750, WhatsApp (24) 99251-0959, e-mail), redes sociais, créditos (Erick Porto e Gustavo Alves) |
| [loading.tsx](../../app/components/Common/loading.tsx) | Geral | `LoadingScreen` (tela cheia com logo) e `Loading` (`small?`) |
| [carousel.tsx](../../app/components/Common/carousel.tsx) | `/login` | Lista arquivos via `GET /api/carousel` ([pages/api/carousel.ts](../../pages/api/carousel.ts) lê `public/images/carousel`) e troca a cada 5 s |
| [tutorial-overlay.tsx](../../app/components/Common/tutorial-overlay.tsx) | `/places`, `/place`, `/checkout` | Onboarding com spotlight (máscara SVG), passos `{targetId, targetClickableItem, title, description, waitForAction, offset, mOffset}`. Estado global em `localStorage['app_tutorial_status']` (`in_progress`/`completed`/`skipped`) — **um único tutorial encadeado entre páginas**. `waitForAction` simula o clique no elemento real. Os `id`s de DOM usados pelos passos (`schedule-1`, `action-buttons-1/2`, `expire-clock`, `date-selection`, `place-card-0`, `schedule-button-0`) **não podem ser renomeados** sem atualizar os passos. |
| [login-aside.tsx](../../app/components/Common/login-aside.tsx) | `/login` | Ver [02](02-autenticacao-socio.md) |
| [ItensGrid.tsx](../../app/components/Common/ItensGrid.tsx), [sportive-square.tsx](../../app/components/Common/sportive-square.tsx) | Home | Ver [04](04-agendamento-quadras.md) |

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

- **CSS Modules**, um por tela/componente (`schedule.module.css`, `checkout.module.css`, `replay.module.css`, `lighting.module.css`, `aprovacao.module.css`, …). Não há Tailwind nem CSS-in-JS (há bastante `style={{...}}` inline em telas antigas).
- [globals.css](../../styles/globals.css): fonte **Nunito** (Google Fonts), tokens `--grena` (#7d0400), `--grena-light`, `--grena-dark`, `--grena-darker`, `--grena-darkest`, `--grena-lighter`, `--grena-lightest*`, `--background`, `--foreground`, e `--logo-*` (URLs dos logos).
- Módulos reaproveitados entre domínios: os Espaços sociais usam `replay.module.css` (seção, cabeçalho, botões) e o flash de `lighting.module.css`; a Luz usa `replay.module.css` (notice, grupos) e `places.module.css` (cards de quadra); o tema de banco do cartão vem de `payment-selector.module.css` via `utils/bank-identifier.ts`.

## Assets (`public/images/`)

Logos (`logo-cfcsn-*`, `logo-eng-*`), `default-avatar.png`, `default-card.png`, `profile-crown.svg`, `MAPA.jpg`, e `carousel/bg-*.jpg` (beach tennis, futebol, padel, tennis, vôlei) — usados no carrossel do login **e** como foto de esporte no Replay/Luz (`sportImage`) e no banner da home.

## Padrões de UI recorrentes

- Erros/sucesso: `toast.*` do `react-toastify` (container no layout raiz, canto inferior direito).
- Estados vazios/erro nos módulos novos: `ReplayNotice` (`icon`, `title`, `description`, `action`, `tone`) — usado também nos Espaços sociais.
- Listas por esporte colapsáveis: `ReplaySportSection`.
- Links internos costumam ter `referrerPolicy='no-referrer' rel='noopener noreferrer'` (padrão herdado; inofensivo).
