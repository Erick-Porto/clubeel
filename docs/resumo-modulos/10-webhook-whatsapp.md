# 10 — Webhook de WhatsApp (Poli Digital)

Arquivo único: [pages/api/whatsapp/webhook.ts](../../pages/api/whatsapp/webhook.ts) → `POST /api/whatsapp/webhook`.

Toda mensagem recebida no WhatsApp do clube é enviada pela ferramenta **Poli Digital** para esta rota, que valida a origem e repassa o JSON para a Lara em `POST webhooks/whatsapp` (via `API_CONSUME` no servidor, com o Bearer da aplicação). Não há UI.

## Pipeline

1. Só `POST` (senão 405).
2. `WHATSAPP_WEBHOOK_VERIFY_TOKEN` não configurado → **503**.
3. Rate limit 60/min por IP → 429.
4. Header `x-webhook-verify-token` comparado com o token configurado (SHA-256 dos dois + `timingSafeEqual`) → inválido **401**. Esta é a validação **obrigatória**.
5. Corpo lido **bruto** (`bodyParser: false`), máx. 1 MB (413).
6. Assinatura `x-webhook-signature: t=<ts>,v1=<hex>` — **só exigida se `WHATSAPP_WEBHOOK_SIGNING_SECRET` estiver definido**. HMAC-SHA256 de `"<ts>.<corpo bruto>"`, tolerância de 5 min. O algoritmo segue a convenção Stripe e **não está confirmado** com a Poli: mantenha o segredo vazio até confirmar, para não bloquear webhooks legítimos.
7. JSON válido e objeto (não array) → senão 400.
8. `assertNoInjection(payload)` → 400 em violação.
9. Loga `x-webhook-event`, `x-webhook-delivery-id`, `x-webhook-attempt`.
10. Repassa para a Lara; falha → **502**; sucesso → `200 {received: true}`.

Não logue o corpo das mensagens (dados pessoais).
