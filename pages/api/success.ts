import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import API_CONSUME from "../../services/api-consume";
import { eredeAuth, eredeBaseUrl, getEredeTransaction } from "../../utils/erede";
import { computeAmountInCents } from "../../utils/lara";
import { guardRequest } from "../../utils/sanitize";
import { takePendingPayment } from "../../utils/pending-payments";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = (await getServerSession(req, res, authOptions)) as unknown as SessionWithToken | null;
    const accessToken = session?.accessToken;
    const userId = session?.user?.id;
    if (!session || !accessToken || !userId) {
        return res.status(401).json({ error: "Sessão expirada." });
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido' });
    }

    if (!guardRequest(req, res)) return;

    let currentTid = "";
    let currentAmount = 0;

    try {
        const { transactionData, scheduleIds: clientScheduleIds, method: clientMethod } = req.body;

        if (!transactionData?.tid || !clientScheduleIds) {
            return res.status(400).json({ error: "Dados incompletos." });
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
            return res.status(400).json({ error: "Pagamento não autorizado." });
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

        if (pending && String(pending.userId) === String(userId)) {
            expectedCents = pending.amountCents;
            scheduleIds = pending.scheduleIds;
            method = pending.method;
        } else {
            expectedCents = await computeAmountInCents(clientScheduleIds, userId, accessToken);
            scheduleIds = clientScheduleIds;
            method = clientMethod;
        }

        if (currentAmount !== expectedCents) {
            console.warn(`Valor divergente (cobrado ${currentAmount} != esperado ${expectedCents}). Estornando...`);
            await refundTransaction(currentTid, currentAmount);
            return res.status(400).json({ error: "Valor divergente. Transação estornada." });
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
            console.warn("Erro ao salvar agendamento. Iniciando estorno...");
            await refundTransaction(currentTid, currentAmount);

            return res.status(409).json({
                error: "error",
                message: apiRes?.message || "Erro ao confirmar agendamento. Valor estornado."
            });
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

        const message = error instanceof Error ? error.message : "Erro desconhecido";
        return res.status(500).json({ error: message });
    }
}
