import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/api/auth/[...nextauth]";
import API_CONSUME from "@/services/api-consume";

const REDE_CLIENT_ID = process.env.INTERNAL_EREDE_CLIENT_ID as string;
const REDE_CLIENT_SECRET = process.env.INTERNAL_EREDE_SECRET_ID as string;
const BASE_URL = process.env.INTERNAL_EREDE_API_URL as string;
const AUTH_URL = process.env.INTERNAL_EREDE_AUTH_URL as string;

interface ApiErrorResponse {
    status?: number;
    message?: string;
    error?: string;
}

async function refundTransaction(tid: string, amount: number) {    
    const credentials = Buffer.from(`${REDE_CLIENT_ID}:${REDE_CLIENT_SECRET}`).toString('base64');
    const authRes = await fetch( AUTH_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    
    if (!authRes.ok) throw new Error("Falha ao autenticar para reembolso");
    const { access_token } = await authRes.json();

    const refundRes = await fetch(`${BASE_URL}/transactions/${tid}/refunds`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
        body: JSON.stringify({ amount: amount })
    });

    if (!refundRes.ok) {
        const err = await refundRes.json();
        console.error("ERRO FATAL: Falha ao estornar:", err);
        throw new Error("Falha no estorno automático");
    }

    return await refundRes.json();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.accessToken) {
        return res.status(401).json({ error: "Sessão expirada." });
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido' });
    }

    let currentTid = "";
    let currentAmount = 0;

    try {
        const { transactionData, scheduleIds, method } = req.body;

        if (!transactionData || !scheduleIds) {
            return res.status(400).json({ error: "Dados incompletos." });
        }

        currentTid = transactionData.tid;
        currentAmount = transactionData.amount;

        const isApproved = transactionData.returnCode === "00" || transactionData.capture === true;
        if (!isApproved) {
            return res.status(400).json({ error: "Pagamento não autorizado." });
        }

        const updatePayload = {
            schedule_ids: scheduleIds,
            status_id: 1,
            payment_integration_id: transactionData.tid,
            payment_method: method,
            paid_amount: transactionData.amount / 100, 
            paid_at: transactionData.dateTime,
            metadata: {
                last4: transactionData.last4,
                authorization_code: transactionData.authorizationCode,
                nsu: transactionData.nsu,
                card_brand: transactionData.brandTid,
                reference: transactionData.reference
            }
        };

        const response = await API_CONSUME("POST", `schedule/payment`, {
            Session: `${session.accessToken}` 
        }, updatePayload);

        const apiRes = response as unknown as ApiErrorResponse;

        const hasConflict = apiRes?.status === 409 || 
                            apiRes?.message?.includes("conflito") || 
                            apiRes?.error === "expired";
        
        const hasHttpError = apiRes?.status !== undefined && apiRes.status !== 200 && apiRes.status !== 201;
        const hasGenericError = !!apiRes?.error;

        if (hasConflict || hasHttpError || hasGenericError) {
            console.warn("Erro ao salvar agendamento. Iniciando estorno...");
            await refundTransaction(currentTid, currentAmount);

            return res.status(409).json({ 
                error: "expired", 
                message: apiRes?.message || "Erro ao confirmar agendamento. Valor estornado." 
            });
        }
        
        return res.status(200).json({ success: true });

    } catch (error: unknown) {
        console.error("Erro crítico em success.ts:", error);
        
        if (currentTid) {
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