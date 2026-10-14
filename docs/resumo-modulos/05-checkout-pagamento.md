# 05 — Checkout e pagamento (eRede)

## Arquivos

| Arquivo | Papel |
|---|---|
| [app/checkout/page.tsx](../../app/checkout/page.tsx) | `/checkout`: layout, resumo, tela de resultado por `?status=` |
| [app/components/Checkout/checkout.tsx](../../app/components/Checkout/checkout.tsx) | `CheckoutView`: título + `CheckoutPayment` |
| [app/components/Checkout/checkoutContent.tsx](../../app/components/Checkout/checkoutContent.tsx) | Resumo do pedido (itens, remover, relógio, total) |
| [app/components/Checkout/CheckoutPayment.tsx](../../app/components/Checkout/CheckoutPayment.tsx) | Formulário do cartão (visual de cartão 3D), orquestração do pagamento |
| [app/components/Checkout/CreditCardBrand.tsx](../../app/components/Checkout/CreditCardBrand.tsx) | SVGs de bandeira (uso comentado) |
| [pages/api/erede/payment_methods.ts](../../pages/api/erede/payment_methods.ts) | Cria a transação na eRede |
| [pages/api/success.ts](../../pages/api/success.ts) | Verifica a transação e confirma o agendamento na Lara (ou estorna) |
| [utils/erede.ts](../../utils/erede.ts) | `eredeAuth`, `eredeBaseUrl`, `eredeConfigured`, `getEredeTransaction` |
| [utils/lara.ts](../../utils/lara.ts) | `computeAmountInCents` (valor autoritativo das quadras) e `computeSocialBookingCharge` (espaço social) |
| [utils/pending-payments.ts](../../utils/pending-payments.ts) | Cache em memória `reference → valor validado` (TTL 30 min, consumo único) |
| [utils/bank-identifier.ts](../../utils/bank-identifier.ts) | `identifyBank(numero)` → bandeira + banco (por BIN) para tematizar o cartão |

## Sequência completa

```
CheckoutPayment.handlePayment()
 1. sem session.accessToken/user.id → toast + signOut
 2. para cada item do carrinho: POST schedule/time-options (data/quadra do item)
    → o horário do item ainda está livre (sem dono ou dono = eu)? senão → ?status=error
 3. POST /api/erede/payment_methods { method, cardData{number,holder,expiry,cvv,cpf}, scheduleIds }
       servidor: sessão obrigatória (401) → rate limit 10/min (429) → eredeConfigured (500)
                 → guardRequest → amount = computeAmountInCents(scheduleIds, userId, accessToken)
                 → token eRede (client_credentials) → POST {EREDE}/transactions
                    { capture:true, reference:"ORD-<ts>-<rand>", amount,
                      kind: credit|debit (installments=1 no crédito), cardNumber, cardHolderName,
                      expirationMonth/Year (de "MM/AA"), securityCode, softDescriptor:"Espacos CFCSN" }
                    (pix: kind "Pix" + qrCode.dateTimeExpiration +30min)
                 → savePendingPayment(reference, {userId, scheduleIds, amountCents, method})
                 → devolve o JSON da eRede
 4. (cartão) POST /api/success { transactionData, scheduleIds, method }
       servidor: sessão (401) → POST only → guardRequest
                 → getEredeTransaction(tid) (GET {EREDE}/transactions/{tid}, achata authorization/capture)
                 → returnCode !== "00" → 400
                 → valor esperado = takePendingPayment(tx.reference) se for do mesmo userId,
                   senão recalcula computeAmountInCents (nunca usa valor do cliente)
                 → cobrado != esperado → ESTORNO + 400
                 → POST schedule/payment (Lara, header Session) {
                     schedule_ids, status_id: 1, payment_integration_id: tid, payment_method,
                     paid_amount: centavos/100, paid_at, metadata{last4, authorization_code, nsu, card_brand, reference} }
                 → conflito (409 / "conflito" / error "expired") → ESTORNO + 409 {error:"expired"}
                 → outro erro da Lara → ESTORNO + 502
                 → exceção com tid e valor conhecidos → estorno de emergência + 500
 5. front: 200 → /checkout?status=success · 409/expired → ?status=expired · outro → ?status=error
```

Estorno: `POST {EREDE}/transactions/{tid}/refunds {amount}`; falha no estorno é logada como "ERRO FATAL".

### `computeAmountInCents(scheduleIds, userId, sessionToken)`
`GET {LARA}/api/schedule/member/{userId}/` (Bearer app + Session) → extrai array → **todo id pedido deve existir** entre os agendamentos do sócio, todos com status `'3'` e `price > 0` → soma em reais → `Math.round(×100)`. Qualquer violação lança erro (→ 500 no handler).

## Pagamento de reserva de espaço social

Mesmo pipeline de servidor, disparado pelo detalhe da reserva (`/espacos-sociais/reservas/[id]`) com `<CheckoutPayment socialBookingId onSocialResult />`:

- O cliente manda `socialBookingId` em vez de `scheduleIds` e **não** revalida horários (não há hold; o prazo é `payment_due_at`).
- `payment_methods`: `computeSocialBookingCharge(id, Session)` → `GET {LARA}/api/social/bookings/{id}` com o Session do sócio (reserva de outro sócio = 404); exige `can_pay === true` e `stage === 'awaiting_payment'`; valor = `round(total × 100)`; `scheduleIds = [schedule_id]` (os do corpo são ignorados — nunca mistura com quadras). Falha aqui → **409** `{reason: 'payment_mismatch'}` sem cobrar nada. O `savePendingPayment` guarda `socialBookingId`.
- `success`: igual às quadras (eRede por `tid`, compara valor, estorna se divergir); o fallback sem cache recalcula pela reserva. `POST schedule/payment` vai com `schedule_ids: [schedule_id]` e `paid_amount` = total. Se a Lara recusar → **estorno** + **409** `{error: reason, reason, message}` (ex.: `payment_mismatch` — fora do estágio/prazo ou valor ≠ total).
- O componente não navega: entrega `{type: 'success'|'refused'|'error'}` a `onSocialResult`, e a tela relê a reserva.

## Página `/checkout`

- `total` = soma de `cart[].price`.
- Lê `?status=`: `success|approved` → limpa carrinho + `router.refresh()`; `failure|rejected|null` → erro; `expired`; `refunded_conflict|conflict_refunded`. Mostra `PaymentStatusMessage` com contador de 15 s e redireciona (sucesso → `/profile?tab=schedules`; expirado/conflito → `/`; erro → volta ao formulário).
- Mobile: resumo vira acordeão.
- Inclui `TutorialOverlay` "Pagamento" cujo `onComplete` **apaga todos os pendentes do carrinho** (`DELETE schedule/delete-pending`) — é o fim do tutorial de primeira reserva (o tutorial guia o sócio a montar um carrinho de exemplo).

## `CheckoutPayment` — detalhes

- Abas: Crédito, Débito. **Pix está comentado** na UI (o código do fluxo Pix existe: QR + copia-e-cola + contador de 180 s, mas não chama `/api/success` — confirmação de Pix não está implementada).
- Máscaras: número (16 dígitos), validade `MM/AA`, CVV (4), titular em maiúsculas. Foco no CVV vira o cartão.
- `identifyBank` muda o tema visual (Nubank, Inter, Itaú, Bradesco, Santander, BB, Neon, Black) e detecta bandeira (Visa/Master/Amex/Elo).
- Campo "CPF do Titular" é coletado mas **não é enviado à eRede** (o handler ignora).

## `checkoutContent`

Lista itens (link para `/place/...?date=` via `URIGen`), botão de remover (`removeCartItem`), `Clock` no item mais antigo, total. Contém `console.log(cart)` de debug.

## Invariantes de segurança (não quebrar)

1. O cliente **nunca** envia `amount`; o servidor recalcula (quadras: soma dos pendentes; espaço social: `total` da reserva lida na Lara).
2. A aprovação é decidida consultando a eRede por `tid`, **não** pelo corpo da requisição.
3. `cardData` **nunca** é logado.
4. `takePendingPayment` consome (apaga) o registro — impede reaproveitar a mesma `reference`.
5. O cache de pagamentos pendentes e o rate limit são por processo (PM2 single). Reiniciar o processo entre `payment_methods` e `success` só força o recálculo (fallback seguro).
