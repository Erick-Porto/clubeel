import type { NextApiRequest, NextApiResponse } from "next";
import { guardRequest } from "../../../../../utils/sanitize";
import { getClientIp, rateLimit } from "../../../../../utils/rate-limit";
import { isGuestToken, parseOrderId, writeGuestToken } from "../../../../../utils/ticket-guest";

/**
 * Abre o pedido do não sócio pelo link do e-mail
 * (`/ingressos/pedido/{id}?token=…`): confere o token na Lara
 * (`GET tickets/guest-orders/{id}` com `Ticket-Order-Token`) e, se ele vale,
 * grava o cookie httpOnly deste aparelho. A página então tira o token da URL
 * — ele não fica no histórico nem vai no Referer.
 *
 * Token errado: a Lara responde 404 `order_not_found`, repassado como veio.
 */

const API_URL = process.env.INTERNAL_LARA_API_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ message: "Método não permitido." });
    }

    const rl = rateLimit(`ticket-guest-open:${getClientIp(req)}`, 20, 60_000);
    if (!rl.ok) {
        res.setHeader("Retry-After", String(rl.retryAfter));
        return res.status(429).json({ message: "Muitas tentativas. Tente novamente em instantes." });
    }

    if (!guardRequest(req, res)) return;

    const orderId = parseOrderId(req.query.id);
    const token = (req.body as Record<string, unknown> | undefined)?.token;
    if (!orderId || !isGuestToken(token)) {
        return res.status(404).json({ message: "Pedido não encontrado.", reason: "order_not_found" });
    }

    let response: Response;
    try {
        response = await fetch(`${API_URL}/api/tickets/guest-orders/${orderId}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${process.env.INTERNAL_LARA_API_TOKEN}`,
                "Ticket-Order-Token": token,
            },
        });
    } catch (error: unknown) {
        console.error("[ingressos] abrir pedido pelo link: falha de conexão com a Lara:", error instanceof Error ? error.message : error);
        return res.status(502).json({ message: "Não foi possível falar com o servidor. Tente de novo em instantes." });
    }

    let data: unknown = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (response.ok) writeGuestToken(res, orderId, token);
    res.setHeader("Cache-Control", "no-store");
    return res.status(response.status).json(data ?? { message: "Não foi possível abrir o pedido." });
}
