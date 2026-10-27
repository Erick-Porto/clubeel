import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]";
import { ticketOrderRoute, type TicketPayer } from "../../../../../utils/lara";
import { parseOrderId, readGuestToken } from "../../../../../utils/ticket-guest";

/**
 * PDF dos ingressos de um pedido pago. Rota própria porque o proxy só repassa
 * JSON (o corpo binário se perderia).
 *
 * Quem pede: o não sócio que tem o cookie do pedido neste aparelho
 * (`tickets/guest-orders/{id}/pdf`, com `Ticket-Order-Token`) ou o sócio
 * logado (`tickets/orders/{id}/pdf`, com `Session`). Recusa da Lara (ex.:
 * `invalid_status` de pedido não pago) volta em JSON, como veio.
 */

const API_URL = process.env.INTERNAL_LARA_API_URL;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ message: "Método não permitido." });
    }

    const orderId = parseOrderId(req.query.id);
    if (!orderId) return res.status(404).json({ message: "Pedido não encontrado.", reason: "order_not_found" });

    let payer: TicketPayer | null = null;
    const guestToken = readGuestToken(req, orderId);
    if (guestToken) {
        payer = { kind: "guest", orderToken: guestToken };
    } else {
        const session = (await getServerSession(req, res, authOptions)) as { accessToken?: string } | null;
        if (session?.accessToken) payer = { kind: "member", sessionToken: session.accessToken };
    }
    if (!payer) return res.status(404).json({ message: "Pedido não encontrado.", reason: "order_not_found" });

    const route = ticketOrderRoute(orderId, payer);
    let response: Response;
    try {
        response = await fetch(`${API_URL}/api/${route.path}/pdf`, {
            method: "GET",
            headers: {
                Accept: "application/pdf, application/json",
                Authorization: `Bearer ${process.env.INTERNAL_LARA_API_TOKEN}`,
                ...route.headers,
            },
        });
    } catch (error: unknown) {
        console.error("[ingressos] PDF: falha de conexão com a Lara:", error instanceof Error ? error.message : error);
        return res.status(502).json({ message: "Não foi possível falar com o servidor. Tente de novo em instantes." });
    }

    const type = response.headers.get("content-type") ?? "";
    res.setHeader("Cache-Control", "no-store");

    if (response.ok && type.includes("pdf")) {
        const file = Buffer.from(await response.arrayBuffer());
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="ingressos-pedido-${orderId}.pdf"`);
        res.setHeader("Content-Length", String(file.length));
        return res.status(200).send(file);
    }

    let data: unknown = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }
    return res.status(response.ok ? 502 : response.status).json(data ?? { message: "Não foi possível gerar o PDF." });
}
