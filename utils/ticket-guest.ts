/**
 * Pedido de ingresso do NÃO SÓCIO no servidor do site: o `access_token` que a
 * Lara devolve uma única vez, na criação do pedido (e que o link do e-mail
 * carrega), fica num cookie httpOnly — um por pedido — e nunca chega ao
 * JavaScript do navegador.
 *
 * Quem lê o cookie e põe o header `Ticket-Order-Token`:
 * - o proxy (`pages/api/backend/[...path].ts`), nas rotas `tickets/guest-orders/{id}`;
 * - o pagamento (`erede/payment_methods` e `success`);
 * - o PDF (`ingressos/pedidos/[id]/pdf`).
 *
 * Por isso o cookie vale para `/api` inteiro (com o prefixo da homologação),
 * e para nada fora dele: as páginas não recebem o token.
 *
 * Só servidor: não importe isto em componente de cliente.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { comBase } from "./base-path";

const COOKIE_PREFIX = "ingresso_pedido_";

/** O path é o que o NAVEGADOR vê: na homologação, /homolog/api. */
const COOKIE_PATH = comBase("/api");

/**
 * Validade do cookie no aparelho. O pedido pode ser comprado meses antes do
 * evento e a pessoa volta para ver o QR Code; quem decide se o token vale é a
 * Lara. Com o cookie vencido, o link do e-mail grava de novo.
 */
const MAX_AGE_S = 180 * 24 * 60 * 60;

/**
 * Formato aceito do token antes de ir para um header. O formato exato é da
 * Lara; aqui só se barra o que poderia quebrar o header ou o cookie.
 */
const TOKEN_FORMAT = /^[A-Za-z0-9|._~+/=-]{8,512}$/;

export function isGuestToken(value: unknown): value is string {
    return typeof value === "string" && TOKEN_FORMAT.test(value);
}

export function parseOrderId(raw: unknown): number | null {
    const value = Array.isArray(raw) ? raw[0] : raw;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function cookieName(orderId: number): string {
    return `${COOKIE_PREFIX}${orderId}`;
}

/** Token deste pedido guardado neste aparelho (ou `null`). */
export function readGuestToken(req: NextApiRequest, orderId: number): string | null {
    const value = req.cookies?.[cookieName(orderId)];
    return isGuestToken(value) ? value : null;
}

/**
 * `Secure` só em produção (mesmo critério da assinatura e da aprovação): em
 * http://localhost o navegador descartaria o cookie.
 */
function serialize(name: string, value: string, maxAge: number): string {
    const parts = [
        `${name}=${encodeURIComponent(value)}`,
        `Path=${COOKIE_PATH}`,
        `Max-Age=${maxAge}`,
        "HttpOnly",
        "SameSite=Lax",
    ];
    if (process.env.NODE_ENV === "production") parts.push("Secure");
    return parts.join("; ");
}

function appendSetCookie(res: NextApiResponse, cookie: string) {
    const current = res.getHeader("Set-Cookie");
    const list = Array.isArray(current) ? current : current ? [String(current)] : [];
    res.setHeader("Set-Cookie", [...list, cookie]);
}

export function writeGuestToken(res: NextApiResponse, orderId: number, token: string): void {
    appendSetCookie(res, serialize(cookieName(orderId), token, MAX_AGE_S));
}

export function clearGuestToken(res: NextApiResponse, orderId: number): void {
    appendSetCookie(res, serialize(cookieName(orderId), "", 0));
}
