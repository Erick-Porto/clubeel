import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { eredeAuth, eredeBaseUrl, eredeConfigured } from "../../../utils/erede";
import { AlreadyPaidError, computeAmountInCents, computeSocialBookingCharge } from "../../../utils/lara";
import { rateLimit, getClientIp } from "../../../utils/rate-limit";
import { guardRequest } from "../../../utils/sanitize";
import { savePendingPayment } from "../../../utils/pending-payments";

interface SessionWithToken {
    accessToken?: string;
    user?: { id?: string | number };
}

interface ERedePayload {
    capture: boolean;
    reference: string;
    amount: number;
    kind?: string;
    qrCode?: {
        dateTimeExpiration: string;
    };
    cardNumber?: string;
    cardHolderName?: string;
    expirationMonth?: number;
    expirationYear?: number;
    securityCode?: string;
    installments?: number;
    softDescriptor?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 1. Exige sessão autenticada (impede uso como oráculo de carding).
    const session = (await getServerSession(req, res, authOptions)) as unknown as SessionWithToken | null;
    const accessToken = session?.accessToken;
    const userId = session?.user?.id;
    if (!session || !accessToken || !userId) {
        return res.status(401).json({ error: "Sessão expirada." });
    }

    // 2. Rate limiting por IP.
    const rl = rateLimit(`pay:${getClientIp(req)}`, 10, 60_000);
    if (!rl.ok) {
        res.setHeader('Retry-After', String(rl.retryAfter));
        return res.status(429).json({ error: "Muitas tentativas. Tente novamente em instantes." });
    }

    if (!eredeConfigured()) {
        return res.status(500).json({ error: "Credenciais não configuradas." });
    }

    if (!guardRequest(req, res)) return;

    try {
        const { method, cardData, socialBookingId } = req.body;
        let { scheduleIds } = req.body;

        // 3. O valor é SEMPRE recalculado no servidor — nunca vem do cliente.
        // Reserva de espaço social: o valor é o `total` da reserva lida na
        // Lara, e o agendamento cobrado é só o `schedule_id` dela (os
        // `scheduleIds` do corpo são ignorados — sem misturar com quadras).
        let amount: number;
        let social: number | undefined;
        if (socialBookingId !== undefined && socialBookingId !== null) {
            let charge;
            try {
                charge = await computeSocialBookingCharge(socialBookingId, accessToken);
            } catch (chargeError: unknown) {
                // Nada foi cobrado ainda. A tela relê a reserva ao receber o
                // `reason`, como faria com a recusa da própria Lara. Já paga
                // (baixa manual da secretaria) tem código próprio: não é erro.
                const message = chargeError instanceof Error ? chargeError.message : 'Reserva indisponível para pagamento.';
                const reason = chargeError instanceof AlreadyPaidError ? 'already_paid' : 'payment_mismatch';
                return res.status(409).json({ error: message, reason });
            }
            amount = charge.amountCents;
            scheduleIds = [charge.scheduleId];
            social = charge.bookingId;
        } else {
            try {
                amount = await computeAmountInCents(scheduleIds, userId, accessToken);
            } catch (amountError: unknown) {
                // Quadra confirmada pela secretaria enquanto o sócio estava no
                // checkout: não cobra; a tela relê o carrinho.
                if (amountError instanceof AlreadyPaidError) {
                    return res.status(409).json({ error: 'already_paid', reason: 'already_paid', message: amountError.message });
                }
                throw amountError;
            }
        }

        const access_token = await eredeAuth();

        const reference = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const payload: ERedePayload = {
            capture: true,
            reference: reference,
            amount: amount,
        };

        if (method === 'pix') {
            payload.kind = "Pix";
            const expirationDate = new Date(Date.now() + 30 * 60000); // +30 min
            const expirationString = expirationDate.toISOString().split('.')[0];

            payload.qrCode = {
                dateTimeExpiration: expirationString
            };
        } else {
            payload.kind = method === 'debit' ? 'debit' : 'credit';
            let expMonth = 0;
            let expYear = 0;
            if (cardData?.expiry?.includes('/')) {
                const parts = cardData.expiry.split('/');
                expMonth = parseInt(parts[0], 10);
                expYear = parseInt(`20${parts[1]}`, 10);
            }
            payload.cardNumber = cardData?.number?.replace(/\s/g, '');
            payload.cardHolderName = cardData?.holder;
            payload.expirationMonth = expMonth;
            payload.expirationYear = expYear;
            payload.securityCode = cardData?.cvv;
            if (method === 'credit') payload.installments = 1;
            payload.softDescriptor = "Espacos CFCSN";
        }

        const transactionResponse = await fetch(`${eredeBaseUrl()}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${access_token}`
            },
            body: JSON.stringify(payload)
        });

        const transactionData = await transactionResponse.json();
        if (!transactionResponse.ok) {
            return res.status(400).json({ error: transactionData.returnMessage || 'Erro', details: transactionData });
        }

        // Guarda o valor ja validado nesta requisicao, associado a reference
        // que a eRede vai ecoar na transacao. success.ts reaproveita este
        // registro em vez de recalcular tudo de novo na Lara.
        savePendingPayment(reference, {
            userId,
            scheduleIds,
            amountCents: amount,
            method,
            createdAt: Date.now(),
            socialBookingId: social,
        });

        return res.status(200).json(transactionData);

    } catch (error: unknown) {
        // Nunca logar cardData; apenas a mensagem do erro.
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('[payment_methods] erro:', message);
        return res.status(500).json({ error: message });
    }
}
