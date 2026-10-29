import type { NextApiRequest, NextApiResponse } from "next";
import { getClientIp, rateLimit } from "../../../../../../utils/rate-limit";
import {
    ACCESS_EXPIRED,
    callLara,
    clearAccessToken,
    isGuestToken,
    parseOrderId,
    readAccessToken,
    writeGuestToken,
} from "../../../../../../utils/ticket-guest";

/**
 * Abre um pedido a partir do "Meus ingressos" do não sócio: relê a lista
 * (`GET tickets/guest-access/orders`), acha o pedido e grava o cookie do token
 * DELE — o mesmo que a compra e o link do e-mail gravam. Daí em diante a página
 * do pedido, o pagamento e o PDF funcionam como sempre (rotas
 * `tickets/guest-orders/{id}` com `Ticket-Order-Token`).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ message: "Método não permitido." });
    }
    res.setHeader("Cache-Control", "no-store");

    const access = readAccessToken(req);
    if (!access) return res.status(401).json(ACCESS_EXPIRED);

    const orderId = parseOrderId(req.query.id);
    if (!orderId) return res.status(404).json({ message: "Pedido não encontrado.", reason: "order_not_found" });

    const rl = rateLimit(`ticket-access-orders:${getClientIp(req)}`, 60, 60_000);
    if (!rl.ok) {
        res.setHeader("Retry-After", String(rl.retryAfter));
        return res.status(429).json({ message: "Muitas tentativas. Tente novamente em instantes." });
    }

    const { status, data } = await callLara("GET", "tickets/guest-access/orders", { "Ticket-Access-Token": access });
    if (status === 401) {
        clearAccessToken(res);
        return res.status(401).json(data?.reason ? data : ACCESS_EXPIRED);
    }
    if (status !== 200 || !data) return res.status(status).json(data ?? { message: "Não foi possível abrir o pedido." });

    const orders = Array.isArray(data.orders) ? (data.orders as Record<string, unknown>[]) : [];
    const order = orders.find((item) => item && parseOrderId(item.id) === orderId);
    if (!order || !isGuestToken(order.access_token)) {
        return res.status(404).json({ message: "Pedido não encontrado.", reason: "order_not_found" });
    }

    writeGuestToken(res, orderId, order.access_token);
    delete order.access_token;
    return res.status(200).json(order);
}
