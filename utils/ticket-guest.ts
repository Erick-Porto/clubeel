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

/* -------------------------------------------------------------------------- */
/* Acesso do não sócio a todos os pedidos (CPF + e-mail + código)              */
/* -------------------------------------------------------------------------- */

/**
 * Token de "Meus ingressos" do não sócio (`POST tickets/guest-access/verify`):
 * vale 2 horas (`expires_at`) e vai no header `Ticket-Access-Token`. Fica num
 * cookie httpOnly com o mesmo path dos tokens de pedido e vence junto com ele.
 *
 * Os tokens de CADA pedido que vêm na lista NÃO viram cookie de uma vez (até
 * 50 cookies estourariam o header `Cookie`): o de um pedido só é gravado
 * quando a pessoa abre, paga ou baixa o PDF dele (ver `acesso/pedidos/[id]/abrir`).
 */
const ACCESS_COOKIE = "ingresso_acesso";
const ACCESS_MAX_AGE_S = 2 * 60 * 60;

export function readAccessToken(req: NextApiRequest): string | null {
    const value = req.cookies?.[ACCESS_COOKIE];
    return isGuestToken(value) ? value : null;
}

/** Vence no `expires_at` da Lara (nunca depois de 2 horas). */
export function writeAccessToken(res: NextApiResponse, token: string, expiresAt: unknown): void {
    const until = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
    const seconds = Number.isNaN(until) ? ACCESS_MAX_AGE_S : Math.floor((until - Date.now()) / 1000);
    appendSetCookie(res, serialize(ACCESS_COOKIE, token, Math.max(0, Math.min(ACCESS_MAX_AGE_S, seconds))));
}

export function clearAccessToken(res: NextApiResponse): void {
    appendSetCookie(res, serialize(ACCESS_COOKIE, "", 0));
}

/** Chamada à Lara pelas rotas do site (JSON); falha de conexão vira 502. */
export async function callLara(
    method: "GET" | "POST",
    path: string,
    headers: Record<string, string> = {},
    body?: unknown
): Promise<{ status: number; data: Record<string, unknown> | null }> {
    try {
        const response = await fetch(`${process.env.INTERNAL_LARA_API_URL}/api/${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${process.env.INTERNAL_LARA_API_TOKEN}`,
                ...headers,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        let data: Record<string, unknown> | null = null;
        try {
            const parsed = await response.json();
            data = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
        } catch {
            data = null;
        }
        return { status: response.status, data };
    } catch (error: unknown) {
        console.error(`[ingressos] falha de conexão com a Lara (${path.split("/").slice(0, 2).join("/")}):`, error instanceof Error ? error.message : error);
        return { status: 502, data: { message: "Não foi possível falar com o servidor. Tente de novo em instantes." } };
    }
}

/** Resposta do 401 do acesso (sem cookie, vencido ou adulterado). */
export const ACCESS_EXPIRED = {
    message: "Seu acesso venceu. Informe o CPF e o e-mail de novo.",
    reason: "access_expired",
};
