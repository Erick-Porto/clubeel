# 16 — Torneios (`/torneios`)

Torneios do clube: inscrição de sócio por categoria com pagamento na eRede, times (inclusive montados pelo capitão), chaveamento público e lançamento de resultados pela equipe do clube com um código. Backend: rotas `api/tournaments/*` da Lara.

**Princípio do módulo**: o front não decide nada. Elegibilidade (sexo, idade completa no 1º dia do torneio, pelo cadastro do clube), vagas, período de inscrição, formação de time, chaveamento, classificação e placar vêm da Lara. Recusas são tratadas pelo **`reason`**, nunca pelo texto; a `message` da Lara é exibida como veio. Depois de cada ação a tela **relê** (torneio, elegibilidade, inscrições).

## Regras de negócio (todas da Lara)

- Só **sócios** se inscrevem (titular e dependentes), logados. A inscrição é **individual**: a pessoa escolhe uma ou mais categorias (ou entram todas, ou nenhuma) e paga a sua parte. Categoria de preço zero já nasce paga.
- A inscrição nasce **aguardando pagamento** e **não segura vaga**: as vagas são de quem paga primeiro. Inscrever e pagar só dentro do período (`registration_starts_at`..`registration_ends_at`, refletido em `registration_open`).
- Desistir pelo site só **antes de pagar**; paga → "fale com a organização" (`paid_contact_organizer`).
- Times: `team_formation` `organizer`/`draw` → a organização monta no Lara, o site só mostra; `captain` → o sócio cria o time e convida; `team_size: 1` = individual. Time `complete` = `team_size` pessoas e todas pagaram. Depois do fim das inscrições só a organização mexe (`registration_closed`).
- Chaveamento só aparece depois que a organização **divulga** (`bracket_published`); gerar de novo tira do ar.
- Resultado lançado pela organização no Lara **prevalece** e trava o jogo para o site (`locked`).
- E-mails (inscrição, pagamento, convite, cancelamento) são da Lara. O site não manda e-mail.

## Arquivos

| Arquivo | Papel |
|---|---|
| [app/torneios/page.tsx](../../app/torneios/page.tsx) | Lista (pública): busca + filtro por modalidade (as que vieram na lista) |
| [app/torneios/[id]/page.tsx](../../app/torneios/[id]/page.tsx) | Detalhe (público) + elegibilidade, inscrição e pagamento (logado) |
| [app/torneios/[id]/chaveamento/[categoria]/page.tsx](../../app/torneios/[id]/chaveamento/[categoria]/page.tsx) | Chaveamento público; relê a cada 60 s com o torneio `in_progress` e a aba visível |
| [app/torneios/equipe/page.tsx](../../app/torneios/equipe/page.tsx) | Entrada da equipe: escolhe o torneio (publicados e em andamento) e segue para o código |
| [app/torneios/[id]/equipe/page.tsx](../../app/torneios/[id]/equipe/page.tsx) | Tela da equipe (código + nome), casca própria, sem login de sócio |
| [app/torneios/inscricoes/page.tsx](../../app/torneios/inscricoes/page.tsx) | Minhas inscrições: convites recebidos, pagar, desistir, criar time |
| [app/torneios/times/[id]/page.tsx](../../app/torneios/times/[id]/page.tsx) | Time (de `my-teams`): membros, quem pagou; capitão convida e retira convite |
| [services/tournament-api.ts](../../services/tournament-api.ts) | Contratos, normalização e chamadas (via proxy) |
| [utils/tournament.ts](../../utils/tournament.ts) | Datas, slugs, textos de elegibilidade, placar ("6-4 3-6 7-6 (7-5)", "W.O."), títulos por `reason` |
| [app/components/Tournament/](../../app/components/Tournament/) | `TournamentCard`, `TournamentPaymentPanel`, `MatchCard`, `BracketView`, `ScoreEditor`, `StaffShell`, `TournamentNoticeBanner` |
| [styles/tournament.module.css](../../styles/tournament.module.css) | Estilos do módulo (botões, painéis e selos vêm de `ui.module.css`) |
| [utils/lara.ts](../../utils/lara.ts) | `computeTournamentCharge`, `TournamentChargeRefusal`, `tournamentPaymentState` (servidor) |

URLs: `/torneios/<titulo>-<id>` e `/torneios/<id>` (só o número final importa — o link da equipe pode vir só com o id), `/torneios/<id>/chaveamento/<categoria>-<categoryId>`, `/torneios/equipe` (escolha do torneio), `/torneios/<id>/equipe`, `/torneios/inscricoes`, `/torneios/times/<teamId>`. No `matcher` do middleware ficam **só** `/torneios/inscricoes` e `/torneios/times/:path*`; lista, detalhe, chaveamento e equipe são abertos.

**Como a equipe chega**: botão **Área da equipe** no cabeçalho de `/torneios` → `/torneios/equipe` (lista os torneios `in_progress` e `published` — encerrado não aceita resultado pelo site, `results_closed`) → `/torneios/<id>/equipe` (código + nome). O link direto `/torneios/<id>/equipe` também funciona. Na raiz sem sessão há a porta **Torneios** (ver [02](02-autenticacao-socio.md)).

## Endpoints e quem chama

| Endpoint (Lara, `/api/…`) | Proxy | Chamado por |
|---|---|---|
| `GET tournaments` (`?place_group_id=`), `GET tournaments/{id}`, `GET tournaments/{id}/categories/{c}/bracket` | público | lista, detalhe, chaveamento, home |
| `GET tournaments/{id}/eligibility`, `POST tournaments/{id}/registrations` | autenticado | detalhe |
| `GET tournaments/my-registrations`, `DELETE tournaments/registrations/{id}` | autenticado | minhas inscrições, perfil, destaque no chaveamento |
| `GET tournaments/my-teams`, `POST tournaments/categories/{c}/teams`, `GET tournaments/member-lookup`, `POST tournaments/teams/{t}/invites`, `DELETE tournaments/invites/{i}` | autenticado | minhas inscrições, time |
| `GET tournaments/my-invites`, `POST tournaments/invites/{i}/accept\|decline` | autenticado | minhas inscrições, perfil |
| `POST tournaments/{id}/staff/check`, `GET …/staff/matches`, `PUT …/staff/matches/{m}/result` | público + header `Tournament-Code` | equipe |
| `POST tournaments/payment` | **fora da allowlist** | só o servidor (`pages/api/success.ts`) |
| `GET tournaments/my-registrations`, `GET tournaments/{id}` | — | servidor, para calcular a cobrança (`utils/lara.ts`) |

Tratamento de 401/403 em `tournament-api.ts` (o interceptor genérico do `API_CONSUME` fica desligado com `skipAuthCheck`):
- **público**: 401 nunca desloga (visitante);
- **sócio**: 401 sem `reason` = sessão vencida → toast + `signOut` para o login; **403 não desloga** — é o `not_captain`;
- **equipe**: 401 `invalid_code` → volta para a tela do código.

Falha: `{ok:false, status, kind: 'rule'|'validation'|'throttled'|'unauthorized'|'network'|'server', reason, error, context, fieldErrors}` (mesmo formato dos espaços sociais; `error` = `message` da Lara ou, na validação do Laravel, o primeiro erro de campo).

### Proxy

- Rotas `tournaments/\d+/staff/*`: o proxy repassa o header `Tournament-Code` (só se casar com `^[A-Za-z0-9 -]{1,20}$`) e **não** repassa o `Session` de um sócio logado no mesmo navegador.
- `tournaments/payment` não está na allowlist de propósito (como deveria ser `schedule/payment`).

## Pagamento (eRede)

Mesmo pipeline das quadras e dos espaços sociais ([05](05-checkout-pagamento.md)), com `tournamentRegistrationIds` no lugar de `scheduleIds`/`socialBookingId`:

1. `TournamentPaymentPanel` → `CheckoutPayment` no modo torneio (`tournamentRegistrationIds`, `onTournamentResult`). O valor exibido é informativo.
2. `POST /api/erede/payment_methods`: `computeTournamentCharge(ids, Session)` lê `my-registrations` (inscrição de outro sócio não aparece → `not_owner`), exige todas `pending_payment` (paga → `already_paid`; outra situação → `invalid_status`), **relê cada torneio** e recusa **antes de cobrar** se `registration_open` não for `true` (`registration_closed`) ou se a categoria estiver com `vacancies_left <= 0` (`category_full`) — é o "cobre só depois de conferir a vaga" do contrato. Valor = soma dos `amount`. Recusa → 409 `{error, reason}` sem ir à eRede.
3. `POST /api/success`: verifica a transação na eRede pelo `tid`, compara o valor e chama `POST tournaments/payment` `{registration_ids, payment_method, paid_amount (= soma exata), payment_integration_id: tid, paid_at}` com o `Session`.
   - **5xx / rede**: reenvia o mesmo `tid` até 3 vezes (a Lara devolve 200 com o mesmo pagamento no reenvio). Ainda falhando, relê as inscrições: todas pagas e sem `payment.manual` → foi o nosso pagamento (não estorna).
   - **Recusa** (`category_full` — vaga acabou entre a conferência e o pagamento —, `registration_closed`, `payment_mismatch`, `invalid_status`…) → **estorno** e 409 com o `reason`. Sem `reason` ou `invalid_status` e tudo pago (secretaria) → `already_paid`.
4. A tela relê e mostra o aviso pelo `reason`.

## Telas

Visual v4 ([14](14-identidade-visual.md)), módulo `torneios` (azul, cor proposta pelo site). Capa `TournamentCover` com abas **Torneios** / **Minhas inscrições**.

- **Lista**: cartões (imagem ou troféu na cor do módulo, modalidade, datas, selo "Inscrições abertas" pelo `registration_open`; "Em andamento"/"Encerrado" pelo `status`). Busca por torneio/categoria e filtro por modalidade.
- **Detalhe**: descrição, regulamento (`<details>`), datas e período. Categorias com `summary`, preço, vagas (`vacancies_left`, `null` = sem limite), como o time se forma, times (`categories[].teams`) e o link **Chaveamento** só com `bracket_published`. Deslogado com inscrição aberta → aviso com link de login (`callbackUrl`). Logado → caixas de seleção pela `eligibility`: não elegível desabilitada com o motivo ("Categoria de outro sexo"; "Seu cadastro no clube está incompleto: procure a secretaria"; "Fora da faixa de idade da categoria"); com inscrição ativa mostra a situação e "Pagar". `member_not_found` → aviso "procure a secretaria". Barra fixa com total e **Inscrever-me**; sucesso abre o pagamento com `total_due` e `pay_until`.
- **Minhas inscrições**: convites recebidos (aceitar → se nasceu inscrição pendente, abre o pagamento; recusar), inscrições agrupadas por torneio com situação (`status_label`), "Pago na secretaria" (`payment.manual`), prazo, time; **Pagar** (até `registration_ends_at`), **Pagar as N pendentes** (juntas), **Desistir** (com confirmação; paga orienta a organização), **Criar time** numa categoria de capitão sem time enquanto as inscrições estão abertas (`team_formation` vem do detalhe do torneio, lido junto). Busca na tela.
- **Time**: membros (capitão, pagou/falta pagar); capitão vê convites pendentes (retirar) e **Convidar**: busca por matrícula (família do título) ou CPF, lista com nome, CPF mascarado e titular/dependente, convite pela `ref`. O formulário some quando membros + convites = `team_size` (quem recusa é a Lara: `team_full`).
- **Chaveamento**: grupos (tabela #, Time, J, V, Sets, Games + jogos por rodada; selo "Classificação final" com `closed`) e mata-mata em colunas por rodada, ordenadas e ligadas por `next_match_id`, com o 3º lugar abaixo da final; rola na horizontal no celular. Jogo: lados (time, `source.label` ou "A definir"), sets ganhos, placar por set, W.O., data/hora e local. `bye` aparece apagado. O time do sócio logado (times de `my-registrations` daquele torneio) é destacado.
- **Equipe** (`/torneios/equipe` → `/torneios/<id>/equipe`): casca própria (`StaffShell`, sem `Header`, sem barra inferior, `TokenValidator` desligado; o logo volta para `/torneios`, e antes de entrar há "Outro torneio"). Entrada com código (máscara `ABCD-EFGH`) e "seu nome"; código + nome ficam só no `sessionStorage` da aba. Jogos de todas as categorias com chaveamento gerado, filtro por categoria e "Só jogos a jogar" (`bye` some). **Lançar**/**Corrigir** só com `editable`; `locked` mostra o selo "Lançado pela organização". `ScoreEditor`: até `2 × sets_to_win − 1` sets, tie-break opcional dos dois lados, opção W.O. com escolha do vencedor; só exige linhas completas — o resto é a Lara (`invalid_score` com a mensagem dela). Depois de salvar, relê os jogos.

## Integração com o resto do app

- Navegação: item **Torneios** no topo e na folha "Menu" da barra inferior do celular e "Minhas inscrições em torneios" no menu do usuário ([header.tsx](../../app/components/Common/header.tsx)).
- Home: aba **Torneios** (`/?area=torneios`) com um cartão por torneio, e atalho "Minhas inscrições em torneios". Abas sem itens não aparecem.
- Perfil: `TournamentNoticeBanner` (convites recebidos e inscrições a pagar) ao lado do aviso dos espaços sociais.

## Pontos a confirmar com a Lara

- **Limite do `staff/check` (10/min)**: se a Lara limita por IP, todas as chamadas chegam do mesmo IP (o servidor Next) — o limite vale para a equipe inteira somada.
- **Vaga conferida pelo site**: o "relê o torneio antes de cobrar" usa `vacancies_left` do `GET tournaments/{id}`; a palavra final continua sendo o `tournaments/payment` (que estorna se recusar).
- **`paid_at`** vai como o `dateTime` da eRede (como nas quadras).
- Formatos de envelope: a normalização aceita lista pura, `{<chave>: [...]}` e `{data: [...]}`, e objetos puros ou em `tournament`/`registration`/`team`/`invite`/`match`/`data`.
