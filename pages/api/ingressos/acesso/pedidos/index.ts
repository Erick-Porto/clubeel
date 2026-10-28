import type { NextApiRequest, NextApiResponse } from "next";
import { getClientIp, rateLimit } from "../../../../../utils/rate-limit";
import { ACCESS_EXPIRED, callLara, clearAccessToken, readAccessToken } from "../../../../../utils/ticket-guest";

/**
 * "Meus ingressos" do não sócio, passo 3: os pedidos do CPF + e-mail
 * (`GET tickets/guest-access/orders` com `Ticket-Access-Token` do cookie).
 *
 * O `access_token` de cada pedido sai da resposta: o navegador nunca o vê.
 * Para abrir, pagar ou baixar o PDF de um pedido, a tela chama
 * `[id]/abrir`, que grava o cookie só daquele pedido.
 *
 * Sem cookie, token vencido ou adulterado: 401 `access_expired`, e o cookie
 * sai do aparelho.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ message: "Método não permitido." });
    }
    res.setHeader("Cache-Control", "no-store");

    const access = readAccessToken(req);
    if (!access) return res.status(401).json(ACCESS_EXPIRED);

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
    if (status !== 200 || !data) return res.status(status).json(data ?? { message: "Não foi possível carregar os pedidos." });

    const orders = Array.isArray(data.orders) ? data.orders : [];
    for (const order of orders) {
        if (order && typeof order === "object") delete (order as Record<string, unknown>).access_token;
    }
    return res.status(200).json({ buyer: data.buyer ?? null, orders });
}
