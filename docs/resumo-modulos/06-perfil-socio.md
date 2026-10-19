# 06 — Perfil do sócio (`/profile`)

## Arquivos

| Arquivo | Papel |
|---|---|
| [app/profile/page.tsx](../../app/profile/page.tsx) | Página com menu lateral de 3 abas |
| [app/components/Profile/banner.tsx](../../app/components/Profile/banner.tsx) | Capa (imagem do último local agendado) + avatar + nome + matrícula |
| [app/components/Profile/profile-components.tsx](../../app/components/Profile/profile-components.tsx) | `Modal` (confirmação de senha), `ProfileForm`, `PasswordForm` |
| [app/components/Profile/appointments.tsx](../../app/components/Profile/appointments.tsx) | Aba "Agendamentos" |
| [app/components/Profile/cart.tsx](../../app/components/Profile/cart.tsx) | Lista do carrinho (pendentes) com "Finalizar Compra" |
| [app/components/Profile/latest-appointments.tsx](../../app/components/Profile/latest-appointments.tsx) | Lista de agendamentos filtrada por `status_id` |

## Página

- Abas (`ViewState`), em pílula (`ui.seg`) abaixo do cabeçalho: `schedules` ("Agendamentos", contador = tamanho do carrinho), `profile` ("Meus dados"), `password` ("Segurança"). A aba inicial continua `profile`, salvo os casos abaixo.
- Abre em `schedules` se `?tab=schedules` **ou** se o carrinho tem itens.
- Para a capa: `GET schedule/member/{id}` → `data.schedules` → agendamento mais recente → `GET place/{place_id}` → `image || horizontal_image`.
- Envolto em `<Suspense>` (usa `useSearchParams`).

- No topo do conteúdo (qualquer aba), `SocialPendingPaymentBanner`: uma faixa por reserva social com `can_pay` ("Você tem uma reserva aguardando pagamento até …" → detalhe). Ver [13](13-espacos-sociais.md).

## `ProfileForm` (Meus Dados)

- Campos da sessão: nome, CPF, matrícula (somente leitura), e-mail e telefone (editáveis após "Editar Dados").
- Salvar abre `Modal` pedindo a senha atual → **revalida a senha** com `POST login {login: cpf, password: SHA256}` → `PUT member/update {cpf, email, telephone}` → `useSession().update(...)` para refletir na sessão.

## `PasswordForm` (Segurança)

- Mesmas regras visuais de senha do "esqueci a senha" + "Senhas iguais".
- Confirmação via `Modal` → `POST login` com a senha atual (SHA-256) → `PUT change-password {cpf, new_password: SHA256}`.
  > Note que aqui o `change-password` vai **sem** `title`/`birth_date` (diferente do fluxo de recuperação) e `change-password` é endpoint **público** no proxy. A segurança depende da Lara (ver [12](12-pontos-de-atencao.md)).

## `Appointments` (Agendamentos)

Ordem dos blocos:
1. `LightingStatusCard` — só aparece se o sócio tem luz acesa (ver [08](08-luz-da-quadra.md)).
2. **Agendamentos a finalizar** → `Cart` (itens status 3 do `CartContext`, remover, total, link `/checkout`).
3. **Locais Agendados** → `LatestAppointments appointmentStatus={1}` + aviso: cancelamento só pela secretaria via WhatsApp (24) 9 9251-0959.
4. **Agendamentos Anteriores** → `LatestAppointments appointmentStatus={10}`.
5. **Espaços Sociais** → só atalhos para `/espacos-sociais/reservas` e `/espacos-sociais` (fluxo próprio, ver [13](13-espacos-sociais.md)).

`LatestAppointments`: `GET schedule/member/{id}` → `data.schedules` filtrado por `status_id`, ordenado do mais recente; mostra 4 e "Ver mais".

## `Banner`

- Avatar: tenta `fetch(${process.env.INTERNAL_LARA_API_URL}/api/image/{id})` **a partir do navegador** com `Authorization: Bearer ${process.env.INTERNAL_LARA_API_TOKEN}`. No cliente essas variáveis são `undefined` → a requisição sempre falha e cai no toast "Foto de perfil não encontrada." + avatar padrão. **Bug conhecido** — a correção correta é um endpoint no proxy (ex.: `image/\d+` na allowlist, ou rota dedicada que devolva a imagem), nunca expor o token.
- Capa: foto do último local agendado; sem ela, o substituto na cor do módulo `perfil` (o `placehold.co` saiu no rebrand v4). Sem foto de perfil, o avatar mostra as **iniciais** (o `default-avatar.png` não é mais usado aqui). O toast do bug acima continua aparecendo — a lógica não foi alterada.
