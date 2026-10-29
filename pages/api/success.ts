import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import API_CONSUME from "../../services/api-consume";
import { eredeAuth, eredeBaseUrl, getEredeTransaction } from "../../utils/erede";
import {
    AlreadyPaidError,
    computeAmountInCents,
    computeSocialBookingCharge,
    computeTicketCharge,
    computeTournamentCharge,
    schedulesArePaid,
    socialBookingIsPaid,
    ticketOrderIsPaid,
    ticketOrderRoute,
    tournamentPaymentState,
    TicketChargeRefusal,
    TournamentChargeRefusal,
    type TicketPayer,
} from "../../utils/lara";
import { guardRequest } from "../../utils/sanitize";
import { takePendingPayment } from "../../utils/pending-payments";
import { parseOrderId, readGuestToken } from "../../utils/ticket-guest";

interface ApiErrorResponse {
    ok?: boolean;
    status?: number;
    message?: string;
    error?: string;
}

interface SessionWithToken {
    accessToken?: string;
    user?: { id?: string | number };
}

async function refundTransaction(tid: string, amount: number) {
    const access_token = await eredeAuth();
    const refundRes = await fetch(`${eredeBaseUrl()}/transactions/${tid}/refunds`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
        body: JSON.stringify({ amount: amount })
    });
    if (!refundRes.ok) {
        const err = await refundRes.json().catch(() => ({}));
        console.error("ERRO FATAL: Falha ao estornar:", err);
        throw new Error("Falha no estorno automático");
    }

    return await refundRes.json();
}

interface TournamentConfirmation {
    registrationIds: number[];
    tid: string;
    /** Valor esperado (soma dos `amount`) — é o `paid_amount` exato que a Lara exige. */
    amountCents: number;
    /** Valor que a eRede cobrou (igual ao esperado; usado no estorno). */
    chargedCents: number;
    method: string;
    paidAt?: string;
    accessToken: string;
}

/**
 * Avisa a Lara do pagamento de inscrições de torneio, já aprovado na eRede.
 *
 * Reenviar o mesmo `tid` para as mesmas inscrições é seguro (a Lara devolve
 * 200 com o mesmo pagamento). Por isso, se a resposta se perder (rede ou 5xx),
 * tenta de novo antes de pensar em estorno — estornar um pagamento que a Lara
 * registrou deixaria a inscrição paga sem dinheiro. Esgotadas as tentativas,
 * relê as inscrições: pagas e não pela secretaria → foi o nosso pagamento.
 *
 * Recusa de regra da Lara (`category_full` — a vaga acabou entre a inscrição
 * e o pagamento —, `registration_closed`, `payment_mismatch`...) → estorno e
 * 409 com o `reason`, para a tela reler.
 */
async function confirmTournamentPayment(res: NextApiResponse, data: TournamentConfirmation) {
    const payload = {
        registration_ids: data.registrationIds,
        payment_method: data.method,
        paid_amount: data.amountCents / 100,
        payment_integration_id: data.tid,
        paid_at: data.paidAt,
    };

    let response = await API_CONSUME("POST", "tournaments/payment", { Session: data.accessToken }, payload);
    for (let attempt = 1; attempt < 3 && response.status >= 500; attempt++) {
        response = await API_CONSUME("POST", "tournaments/payment", { Session: data.accessToken }, payload);
    }

    if (response.ok) return res.status(200).json({ success: true });

    const laraReason = (response.data as { reason?: unknown } | null)?.reason;
    let reason = typeof laraReason === "string" ? laraReason : null;

    if (response.status >= 500) {
        const state = await tournamentPaymentState(data.registrationIds, data.accessToken);
        if (state.allPaid && !state.manual) {
            console.warn(`[success] torneio: resposta da Lara perdida, mas as inscrições estão pagas (tid=${data.tid}).`);
            return res.status(200).json({ success: true });
        }
    }

    console.warn(
        `[success] Lara recusou o pagamento do torneio (status=${response.status}, reason=${reason}, message=${response.message}). Iniciando estorno...`
    );
    await refundTransaction(data.tid, data.chargedCents);

    // Paga por outro caminho enquanto o sócio estava no cartão (secretaria):
    // decide pelo estado, como nas quadras.
    if ((!reason || reason === "invalid_status") && (await tournamentPaymentState(data.registrationIds, data.accessToken)).allPaid) {
        reason = "already_paid";
    }

    const detail = response.message || "Não foi possível confirmar o pagamento da inscrição. Valor estornado.";
    if (response.status >= 500 && !reason) {
        return res.status(502).json({ error: detail, reason, message: `${detail} O valor foi estornado.` });
    }
    return res.status(409).json({ error: reason ?? "payment_failed", reason, message: detail });
}

interface TicketConfirmation {
    orderId: number;
    payer: TicketPayer;
    tid: string;
    /** Valor esperado (`total` do pedido) — é o `paid_amount` exato que a Lara exige. */
    amountCents: number;
    /** Valor que a eRede cobrou (igual ao esperado; usado no estorno). */
    chargedCents: number;
    method: string;
    paidAt?: string;
}

/**
 * Avisa a Lara do pagamento de um pedido de ingressos, já aprovado na eRede
 * (`POST tickets/orders/{id}/payment` do sócio ou `tickets/guest-orders/{id}/payment`
 * do não sócio, com o token do pedido).
 *
 * Reenviar o mesmo `tid` para o mesmo pedido é seguro (a Lara responde 200 com
 * o mesmo pagamento): se a resposta se perder (rede ou 5xx), tenta de novo
 * antes de pensar em estorno. Esgotadas as tentativas, relê o pedido: pago →
 * foi o nosso pagamento.
 *
 * Recusa de regra → estorno e 409 com o `reason`. A principal é `hold_expired`:
 * o prazo do pedido venceu e os lugares acabaram enquanto o cartão era cobrado.
 */
async function confirmTicketPayment(res: NextApiResponse, data: TicketConfirmation) {
    const route = ticketOrderRoute(data.orderId, data.payer);
    const payload = {
        payment_method: data.method,
        paid_amount: data.amountCents / 100,
        payment_integration_id: data.tid,
        paid_at: data.paidAt,
    };

    let response = await API_CONSUME("POST", `${route.path}/payment`, route.headers, payload);
    for (let attempt = 1; attempt < 3 && response.status >= 500; attempt++) {
        response = await API_CONSUME("POST", `${route.path}/payment`, route.headers, payload);
    }

    if (response.ok) return res.status(200).json({ success: true });

    const laraReason = (response.data as { reason?: unknown } | null)?.reason;
    let reason = typeof laraReason === "string" ? laraReason : null;

    if (response.status >= 500 && (await ticketOrderIsPaid(data.orderId, data.payer))) {
        console.warn(`[success] ingressos: resposta da Lara perdida, mas o pedido ${data.orderId} está pago (tid=${data.tid}).`);
        return res.status(200).json({ success: true });
    }

    console.warn(
        `[success] Lara recusou o pagamento do pedido de ingressos ${data.orderId} (status=${response.status}, reason=${reason}, message=${response.message}). Iniciando estorno...`
    );
    await refundTransaction(data.tid, data.chargedCents);

    // Pago por outro caminho enquanto a pessoa estava no cartão: decide pelo
    // estado, como nas quadras e nos torneios.
    if ((!reason || reason === "invalid_status") && (await ticketOrderIsPaid(data.orderId, data.payer))) {
        reason = "already_paid";
    }

    // [lugares] `hold_expired` com `context.seat_ids`: o lugar foi reservado por
    // outra pessoa enquanto o pedido estava vencido.
    const context = (response.data as { context?: { seat_ids?: unknown } } | null)?.context;
    const seatLost = Array.isArray(context?.seat_ids) && context.seat_ids.length > 0;
    const detail =
        reason === "hold_expired"
            ? seatLost
                ? "O lugar escolhido foi reservado por outra pessoa enquanto o pagamento era feito. O valor foi estornado."
                : "Os ingressos esgotaram enquanto o pagamento era feito. O valor foi estornado."
            : response.message || "Não foi possível confirmar o pagamento dos ingressos. Valor estornado.";
    if (response.status >= 500 && !reason) {
        return res.status(502).json({ error: detail, reason, message: `${detail} O valor foi estornado.` });
    }
    return res.status(409).json({ error: reason ?? "payment_failed", reason, message: detail });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Pedido de ingresso do NÃO SÓCIO: sem login; vale o token do pedido no
    // cookie httpOnly deste aparelho (ver payment_methods.ts).
    const guestOrderId = req.body?.ticketGuest === true ? parseOrderId(req.body?.ticketOrderId) : null;
    const guestToken = guestOrderId ? readGuestToken(req, guestOrderId) : null;
    const session = guestToken
        ? null
        : ((await getServerSession(req, res, authOptions)) as unknown as SessionWithToken | null);
    const accessToken = session?.accessToken ?? "";
    const userId = session?.user?.id;
    if (!guestToken && (!session || !accessToken || !userId)) {
        return res.status(401).json({ error: "Sessão expirada.", message: "Sessão expirada." });
    }
    // Dono do registro guardado por payment_methods.ts.
    const owner = guestToken ? `ticket-guest:${guestOrderId}` : String(userId);

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido', message: 'Método não permitido' });
    }

    if (!guardRequest(req, res)) return;

    let currentTid = "";
    let currentAmount = 0;

    try {
        const {
            transactionData,
            scheduleIds: clientScheduleIds,
            method: clientMethod,
            socialBookingId: clientSocialBookingId,
            tournamentRegistrationIds: clientTournamentIds,
            ticketOrderId: clientTicketOrderId,
        } = req.body;
        const clientIsSocial = clientSocialBookingId !== undefined && clientSocialBookingId !== null;
        const clientIsTournament = clientTournamentIds !== undefined && clientTournamentIds !== null;
        const clientIsTicket = !!guestToken || (clientTicketOrderId !== undefined && clientTicketOrderId !== null);

        if (!transactionData?.tid || (!clientScheduleIds && !clientIsSocial && !clientIsTournament && !clientIsTicket)) {
            return res.status(400).json({ error: "Dados incompletos.", message: "Dados incompletos." });
        }

        currentTid = String(transactionData.tid);

        // 1. VERIFICA a transação diretamente na eRede (não confia no corpo).
        const eredeToken = await eredeAuth();
        const tx = await getEredeTransaction(currentTid, eredeToken);
        currentAmount = Number(tx.amount) || 0;
        // Log de diagnóstico: não contém dados sensíveis (sem PAN/CVV, só
        // last4/nsu/authorization_code, que já são persistidos na Lara).
        console.warn(`[success] eRede tx verificada (tid=${currentTid}):`, JSON.stringify(tx));

        const isApproved = tx.returnCode === "00";
        if (!isApproved) {
            const detail = `Pagamento não autorizado (returnCode=${tx.returnCode ?? 'ausente'}).`;
            return res.status(400).json({ error: detail, message: detail });
        }

        // 2. Reaproveita o valor JÁ validado em payment_methods.ts (evita uma
        // segunda consulta à Lara e a janela extra que isso abre para o hold
        // do agendamento expirar). Só recalcula do zero se o registro não for
        // encontrado (processo reiniciado, cache expirado) — fallback seguro
        // que nunca confia no valor vindo do cliente.
        const pending = takePendingPayment(tx.reference);
        let expectedCents: number;
        let scheduleIds: Array<number | string>;
        let method: string;
        // Reserva de espaço social: o agendamento cobrado é só o `schedule_id`
        // dela e o valor é o `total` lido na Lara (ver computeSocialBookingCharge).
        let socialBookingId: number | undefined;
        // Inscrições de torneio: a confirmação vai para `tournaments/payment`.
        let tournamentIds: number[] | undefined;
        // Pedido de ingressos: a confirmação vai para `tickets/(guest-)orders/{id}/payment`.
        let ticketOrderId: number | undefined;
        const ticketPayer: TicketPayer = guestToken
            ? { kind: "guest", orderToken: guestToken }
            : { kind: "member", sessionToken: accessToken };

        if (pending && String(pending.userId) === owner) {
            expectedCents = pending.amountCents;
            scheduleIds = pending.scheduleIds;
            method = pending.method;
            socialBookingId = pending.socialBookingId;
            tournamentIds = pending.tournamentRegistrationIds;
            ticketOrderId = pending.ticketOrderId;
        } else if (clientIsTicket) {
            const charge = await computeTicketCharge(guestOrderId ?? clientTicketOrderId, ticketPayer);
            expectedCents = charge.amountCents;
            scheduleIds = [];
            method = clientMethod;
            ticketOrderId = charge.orderId;
        } else if (guestToken) {
            // Não sócio só paga pedido de ingresso.
            return res.status(400).json({ error: "Dados incompletos.", message: "Dados incompletos." });
        } else if (clientIsTournament) {
            const charge = await computeTournamentCharge(clientTournamentIds, accessToken);
            expectedCents = charge.amountCents;
            scheduleIds = [];
            method = clientMethod;
            tournamentIds = charge.registrationIds;
        } else if (clientIsSocial) {
            const charge = await computeSocialBookingCharge(clientSocialBookingId, accessToken);
            expectedCents = charge.amountCents;
            scheduleIds = [charge.scheduleId];
            method = clientMethod;
            socialBookingId = charge.bookingId;
        } else {
            expectedCents = await computeAmountInCents(clientScheduleIds, userId as string | number, accessToken);
            scheduleIds = clientScheduleIds;
            method = clientMethod;
        }

        if (currentAmount !== expectedCents) {
            console.warn(`Valor divergente (cobrado ${currentAmount} != esperado ${expectedCents}). Estornando...`);
            await refundTransaction(currentTid, currentAmount);
            const detail = `Valor divergente (cobrado ${currentAmount}, esperado ${expectedCents}). Transação estornada.`;
            return res.status(400).json({ error: detail, message: detail });
        }

        if (ticketOrderId !== undefined) {
            return await confirmTicketPayment(res, {
                orderId: ticketOrderId,
                payer: ticketPayer,
                tid: currentTid,
                amountCents: expectedCents,
                chargedCents: currentAmount,
                method,
                paidAt: tx.dateTime,
            });
        }

        if (tournamentIds) {
            return await confirmTournamentPayment(res, {
                registrationIds: tournamentIds,
                tid: currentTid,
                amountCents: expectedCents,
                chargedCents: currentAmount,
                method,
                paidAt: tx.dateTime,
                accessToken,
            });
        }

        // 3. Persiste o pagamento usando os dados AUTORITATIVOS da eRede.
        const updatePayload = {
            schedule_ids: scheduleIds,
            status_id: 1,
            payment_integration_id: currentTid,
            payment_method: method,
            paid_amount: expectedCents / 100,
            paid_at: tx.dateTime,
            metadata: {
                last4: tx.last4,
                authorization_code: tx.authorizationCode,
                nsu: tx.nsu,
                card_brand: tx.brandTid,
                reference: tx.reference
            }
        };

        const response = await API_CONSUME("POST", `schedule/payment`, {
            Session: `${accessToken}`
        }, updatePayload);

        const apiRes = response as unknown as ApiErrorResponse;
        const hasConflict = apiRes?.status === 409 ||
                            apiRes?.message?.includes("conflito") ||
                            apiRes?.error === "expired";

        // Usa o "ok" já calculado por API_CONSUME (a partir do response.ok
        // real do fetch) em vez de reimplementar a checagem por status —
        // mais robusto contra qualquer status 2xx fora de 200/201.
        const hasHttpError = apiRes?.ok === false;
        const hasGenericError = !!apiRes?.error;

        if (hasConflict || hasHttpError || hasGenericError) {
            // Log detalhado do lado Lara: status HTTP, ok e corpo retornado —
            // essencial para diferenciar "reserva expirada" de um problema
            // genuíno na API Lara (fora do ar, payload rejeitado, erro 500).
            console.warn(
                `[success] Falha ao confirmar agendamento na API Lara ` +
                `(status=${apiRes?.status}, ok=${apiRes?.ok}, error=${apiRes?.error}, message=${apiRes?.message}). Iniciando estorno...`
            );
            await refundTransaction(currentTid, currentAmount);

            if (socialBookingId !== undefined) {
                // Espaço social: a Lara recusa com `reason` estável (ex.:
                // `payment_mismatch` — fora do estágio, prazo vencido ou valor
                // diferente do total). Repassa o código para a tela reler a
                // reserva; não há "hold expirado" aqui.
                //
                // O 409 de "já foram pagos" (baixa manual da secretaria) vem
                // sem `reason`: confirma pelo estado da reserva, não pelo texto.
                const laraReason = (response.data as { reason?: unknown } | null)?.reason;
                let reason = typeof laraReason === "string" ? laraReason : null;
                if (!reason && apiRes?.status === 409 && (await socialBookingIsPaid(socialBookingId, accessToken))) {
                    reason = "already_paid";
                }
                const detail = apiRes?.message || "Não foi possível confirmar o pagamento da reserva. Valor estornado.";
                return res.status(409).json({ error: reason ?? "payment_failed", reason, message: detail });
            }

            // Quadra: o 409 pode ser hold expirado/conflito OU baixa manual da
            // secretaria ("já foram pagos"). Decide pelo estado: se todos os
            // agendamentos estão confirmados, não é expiração — a tela relê o
            // carrinho e mostra como confirmados (o cartão já foi estornado).
            if (apiRes?.status === 409 && (await schedulesArePaid(scheduleIds, userId as string | number, accessToken))) {
                const detail = apiRes?.message || "Os agendamentos já foram pagos. O valor do cartão foi estornado.";
                return res.status(409).json({ error: "already_paid", reason: "already_paid", message: detail });
            }

            if (hasConflict) {
                // Reserva expirada / conflito de horário — a Lara recusou
                // porque o hold não existe mais; já tratado no client.
                const detail = apiRes?.message || "Reserva expirada. O valor foi estornado.";
                return res.status(409).json({ error: "expired", message: detail });
            }

            // Erro genuíno do lado da API Lara (fora do ar, payload
            // rejeitado, erro interno) — 502 (Bad Gateway) para distinguir
            // de "reserva expirada" e não mascarar um problema na Lara.
            const detail = apiRes?.message
                || `Falha ao confirmar o agendamento na API Lara (status ${apiRes?.status ?? 'desconhecido'}). Valor estornado.`;
            return res.status(502).json({ error: detail, message: detail });
        }

        return res.status(200).json({ success: true });

    } catch (error: unknown) {
        console.error("Erro crítico em success.ts:", error instanceof Error ? error.message : error);

        if (currentTid && currentAmount > 0) {
            try {
                await refundTransaction(currentTid, currentAmount);
            } catch (_refundErr) {
                console.error("Falha no estorno de emergência.", _refundErr);
            }
        }

        // Recalculo sem cache achou o pedido já pago (baixa manual no meio do
        // caminho): o estorno acima desfez a cobrança; não é erro do sistema.
        if (error instanceof AlreadyPaidError) {
            return res.status(409).json({ error: "already_paid", reason: "already_paid", message: error.message });
        }
        // Torneio, recalculo sem cache: a vaga acabou ou o período fechou
        // depois da cobrança. Já estornado acima; a tela relê pelo `reason`.
        if (error instanceof TournamentChargeRefusal || error instanceof TicketChargeRefusal) {
            return res.status(409).json({ error: error.reason, reason: error.reason, message: `${error.message} O valor foi estornado.` });
        }

        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return res.status(500).json({ error: message, message: message });
    }
}
