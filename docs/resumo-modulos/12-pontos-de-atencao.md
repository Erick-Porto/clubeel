# 12 — Pontos de atenção (bugs conhecidos, dívidas, armadilhas)

Levantamento feito na leitura do código (commit `5987f33`). Nada aqui foi corrigido. Antes de corrigir algo, confirme com o usuário se é desejado — alguns itens podem ser intencionais ou depender da Lara.

## Comportamentos intencionais que parecem bug (NÃO "consertar")

| Item | Por quê |
|---|---|
| `/replay` e `replay/places*` sem login | Decisão de negócio (galeria pública). |
| Replay usa `skipAuthCheck` | Um 401 não pode deslogar visitante; em "Meus vídeos" vira estado de tela. |
| `TokenValidator` desligado em `/aprovacao` | Sessões independentes. |
| `decidir` sem `revalidatePath` | Revalidar trocaria a tela de resultado por "fora da fila" (ver [09](09-aprovacao-compras.md)). |
| Login da aprovação manda senha em texto puro | A Lara faz bcrypt; o login de sócio é que usa SHA-256 no cliente. |
| `Sair` da aprovação é form POST, não `<Link>` | Prefetch de `<Link>` deslogaria sem clique. |
| Rota de mídia do replay sem sessão | Não amplia acesso que a galeria pública já concede; caminho travado em `storage/replay/videos/`. |
| Imports relativos em vez de `@/` | Alias quebrava no ambiente do usuário. |
| Luz: reler a disponibilidade após cada POST | O estado "aceso" só pode vir da Lara (multi-dispositivo, outros sócios). |

## Bugs prováveis

1. **Avatar do perfil nunca carrega** — [banner.tsx](../../app/components/Profile/banner.tsx) faz `fetch` no navegador usando `process.env.INTERNAL_LARA_API_URL`/`INTERNAL_LARA_API_TOKEN` (undefined no cliente). Sempre cai em "Foto de perfil não encontrada." Correção: expor a imagem via servidor (proxy/rota dedicada), nunca o token.
2. **Grade de horários ignora a data escolhida** — `/place/[slug]` exibe a data de `?date=` no título, mas não passa `dateProp` ao `<Schedule>`, que usa sempre **hoje**. Além disso `/places/[slug]` não inclui `?date=` no link para a quadra. Resultado: o sócio escolhe uma data no seletor e reserva horários de hoje.
3. **`cartTotal` em `Schedule` acumula** — a cada `fetchData` soma de novo `cart[].price` sem zerar (total do rodapé mobile cresce indefinidamente).
4. **Home quebra se `places/group` falhar** — após o toast de erro continua em `Object.values(response.data)` com `data` nulo (exceção capturada, mas toast duplicado).
5. **`/places/[slug]`** acessa `apiData.limit.limit` sem checar resposta não-ok (cai no `catch`).
6. **Pix incompleto** — a aba está comentada; se reativada, o fluxo gera QR mas nunca confirma o pagamento na Lara (não chama `/api/success`).
7. **CPF do titular** é coletado no formulário do cartão e não é usado.
8. `checkoutContent.tsx` tem `console.log(cart)`/`console.log(oldestItem)` de debug.
9. `PasswordForm` envia `PUT change-password {cpf, new_password}` sem `title`/`birth_date`, e `change-password` é **público** no proxy. Se a Lara não exigir prova de identidade adicional nesse caso, qualquer pessoa com um CPF poderia trocar a senha. Verificar o contrato na Lara.
10. Mensagens da aprovação citam `LARA_API_URL`, mas a variável real é `INTERNAL_LARA_API_URL` (fila e action de login).
11. `/cart` está no matcher do middleware, mas a página não existe.
12. `useEffect` de `places/[slug]` que define `dateDifference` roda só na montagem (`[]`) enquanto `useIsMobile` começa `false` → no mobile pode usar 20 dias em vez de 8 no primeiro render.

## Espaços sociais — pontos a confirmar com a Lara

- **Carrinho de quadras × reserva social**: o `CartContext` trata como carrinho todo agendamento do sócio com `status_id === 3` em `schedule/member/{id}`. Se o `schedule` de uma reserva social aparecer ali com status 3, ele entraria no carrinho/checkout de quadras. Confirmar o status que a Lara usa para o agendamento da reserva social (ou se ela o exclui dessa listagem).
- **Editar convidados exige redigitar CPFs**: a Lara devolve CPFs mascarados e o `PUT .../guests` substitui a lista inteira com `{name, cpf}`. Para não obrigar o sócio a redigitar, a Lara precisaria aceitar manter um convidado pelo `id`.
- **Formato de `GET social/beverages`** não estava no contrato: o front aceita `{id, name, unit, price|unit_price}`.
- `DELETE social/bookings/{id}` é enviado sem corpo (sem motivo da desistência).

## Fuso horário (cuidado)

- `CartContext.normalizeToBrasilia` assume que `start_schedule`/`end_schedule` vêm em **UTC sem fuso** e subtrai 3 h fixas.
- `Clock.parseSafeDate` assume `created_at` sem fuso como **-03:00**.
- `LatestAppointments` usa `new Date(start_schedule)` (fuso do aparelho).
- Luz e Aprovação formatam explicitamente em `America/Sao_Paulo`; `dt_cadastro` do ERP é "hora de parede" e não passa por `Date`.
- Espaços sociais: `date` é dia (AAAA-MM-DD) e é formatado em UTC para não "voltar um dia"; prazos (`payment_due_at`, `guests_editable_until`) em `America/Sao_Paulo`.
Se a Lara mudar o formato de datas, revise todos esses pontos juntos.

## Dívidas técnicas / riscos operacionais

- **Estado em memória** (rate limit, `pending-payments`) → só funciona com 1 processo. Escalar = Redis.
- **`accessToken` da Lara exposto ao navegador** via sessão NextAuth (`/api/auth/session`). A área de aprovação foi desenhada justamente para não repetir isso.
- **Sem testes automatizados**; validação = `tsc --noEmit`, `lint`, `build`.
- **Lógica de extração de arrays duplicada** (CartContext, `utils/lara.ts`, `replay-api.ts`) porque a Lara não é consistente no envelope das respostas.
- **Hold de 10 min** está hardcoded no `Clock`; tem de bater com a Lara.
- Várias páginas antigas disparam `toast.error("Sessão inválida...")` quando `status` ainda não é `authenticated` em algum render — pode gerar toasts espúrios.
- `deploy.sh` faz `git reset --hard` + `git clean -df` no host: qualquer arquivo não versionado fora do `.gitignore` some (o `.env` está protegido pelo ignore).

## Documentos desatualizados no repositório

- `README.md`: cita **Mercado Pago** (substituído pela eRede), 7 rotas, mapa interativo e polling de 30 s na grade (o polling de 30 s é na lista de quadras; a página da quadra recarrega a cada 150 s).
- `RELATORIO-CORRECOES.md`: cita `src/pages/...` e `src/utils/...` (hoje `pages/` e `utils/` na raiz) e "Next fixado em 15.2.0" (hoje 15.5.20). O conteúdo de segurança continua válido.
- `j3.txt` (cookie jar do curl) e `transferRules.ts` (vazio) são lixo versionado.

## Proxy: `schedule(/.*)?` é amplo

A regex `/^schedule(\/.*)?$/` libera ao navegador **qualquer** caminho sob `schedule/`, inclusive `schedule/payment` (que só deveria ser chamado pelo servidor em `success.ts`). A proteção depende de a Lara recusar pagamento sem transação válida. Candidato a fechar a regex (não alterado). Os endpoints `social/*` foram liberados um a um.

## Pendências herdadas do relatório de segurança

- Rotacionar segredos (`NEXTAUTH_SECRET`, token Lara, credenciais eRede) — operacional, fora do código.
- Remover CPF/telefone do JWT (A3) — não aplicado porque o perfil lê esses campos da sessão.
