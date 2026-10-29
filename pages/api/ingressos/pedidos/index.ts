import type { NextApiRequest, NextApiResponse } from "next";
import { guardRequest } from "../../../../utils/sanitize";
import { getClientIp, rateLimit } from "../../../../utils/rate-limit";
import { isGuestToken, parseOrderId, writeGuestToken } from "../../../../utils/ticket-guest";

/**
 * Cria o pedido de ingressos do NÃO SÓCIO (sem login):
 * `POST tickets/events/{id}/guest-orders` na Lara.
 *
 * Não passa pelo proxy porque a Lara devolve o `access_token` do pedido UMA
 * única vez, aqui. Ele vai para um cookie httpOnly deste aparelho (checkout,
 * pagamento e confirmação) e sai do corpo antes de chegar ao navegador. Depois,
 * quem abre o pedido é o link do e-mail (ver `[id]/abrir.ts`).
 *
 * Nunca logar o corpo: tem CPF, nome, e-mail e telefone.
 */

const API_URL = process.env.INTERNAL_LARA_API_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ message: "Método não permitido." });
    }

    // A Lara limita a 10 por minuto por IP — mas aqui todas as chamadas chegam
    // do mesmo IP (o servidor do site). Este limite, por IP de quem compra,
    // segura um abuso antes de ele esgotar o limite de todo mundo.
    const rl = rateLimit(`ticket-guest-order:${getClientIp(req)}`, 10, 60_000);
    if (!rl.ok) {
        res.setHeader("Retry-After", String(rl.retryAfter));
        return res.status(429).json({ message: "Muitas tentativas. Tente novamente em instantes." });
    }

    if (!guardRequest(req, res)) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const eventId = parseOrderId(body.event_id);
    if (!eventId) return res.status(404).json({ message: "Evento não encontrado.", reason: "event_not_found" });

    const payload: Record<string, unknown> = { buyer: body.buyer, tickets: body.tickets };
    if (typeof body.coupon_code === "string" && body.coupon_code.trim()) payload.coupon_code = body.coupon_code.trim();

    let response: Response;
    try {
        response = await fetch(`${API_URL}/api/tickets/events/${eventId}/guest-orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${process.env.INTERNAL_LARA_API_TOKEN}`,
            },
            body: JSON.stringify(payload),
        });
    } catch (error: unknown) {
        console.error("[ingressos] criar pedido sem login: falha de conexão com a Lara:", error instanceof Error ? error.message : error);
        return res.status(502).json({ message: "Não foi possível falar com o servidor. Tente de novo em instantes." });
    }

    let data: Record<string, unknown> | null = null;
    try {
        const parsed = await response.json();
        data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
        data = null;
    }

    if (!response.ok) {
        return res.status(response.status).json(data ?? { message: "Não foi possível criar o pedido." });
    }

    // O pedido pode vir puro ou em `order`/`data`; o token, no pedido ou ao lado dele.
    const order = (data?.order ?? data?.data ?? data ?? {}) as Record<string, unknown>;
    const token = order.access_token ?? data?.access_token;
    const orderId = parseOrderId(order.id);
    if (orderId && isGuestToken(token)) {
        writeGuestToken(res, orderId, token);
    } else {
        // Sem o token o checkout não consegue pagar; a pessoa ainda recebe o link por e-mail.
        console.error(`[ingressos] pedido sem login criado sem access_token utilizável (pedido ${orderId ?? "?"}).`);
    }

    delete order.access_token;
    if (data) delete data.access_token;
    res.setHeader("Cache-Control", "no-store");
    return res.status(response.status).json(order);
}
