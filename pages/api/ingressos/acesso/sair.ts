import type { NextApiRequest, NextApiResponse } from "next";
import { clearAccessToken } from "../../../../utils/ticket-guest";

/**
 * "Sair" do "Meus ingressos" do não sócio: apaga o cookie do acesso. Os
 * cookies dos pedidos já abertos ficam (são os mesmos do link do e-mail).
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ message: "Método não permitido." });
    }
    clearAccessToken(res);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true });
}
