import type { NextApiRequest, NextApiResponse } from "next";
import { guardRequest } from "../../../../utils/sanitize";
import { getClientIp, rateLimit } from "../../../../utils/rate-limit";
import { callLara, isGuestToken, writeAccessToken } from "../../../../utils/ticket-guest";

/**
 * "Meus ingressos" do não sócio, passo 2: confere o código de 6 dígitos
 * (`POST tickets/guest-access/verify`). Valendo, o `access_token` (2 horas) vai
 * para o cookie httpOnly e sai do corpo — o navegador recebe só o `expires_at`.
 * Recusas (`access_code_invalid` com `context.attempts_left`,
 * `access_code_expired`) e o 422 do Laravel passam como vieram.
 *
 * Nunca logar o corpo (CPF, e-mail, código).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ message: "Método não permitido." });
    }

    // Mesmo limite da Lara (10/min), por IP de quem chama: lá todas as
    // chamadas chegam do IP deste servidor.
    const rl = rateLimit(`ticket-access-verify:${getClientIp(req)}`, 10, 60_000);
    if (!rl.ok) {
        res.setHeader("Retry-After", String(rl.retryAfter));
        return res.status(429).json({ message: "Muitas tentativas. Espere um minuto e tente de novo." });
    }

    if (!guardRequest(req, res)) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const { status, data } = await callLara("POST", "tickets/guest-access/verify", {}, {
        cpf: body.cpf,
        email: body.email,
        code: body.code,
    });

    res.setHeader("Cache-Control", "no-store");
    if (status !== 200) return res.status(status).json(data ?? { message: "Não foi possível conferir o código." });

    const token = data?.access_token;
    if (!isGuestToken(token)) {
        console.error("[ingressos] guest-access/verify respondeu 200 sem access_token utilizável.");
        return res.status(502).json({ message: "Não foi possível entrar agora. Tente de novo em instantes." });
    }
    writeAccessToken(res, token, data?.expires_at);
    return res.status(200).json({ expires_at: data?.expires_at ?? null });
}
